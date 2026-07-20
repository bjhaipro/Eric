import { getPerformanceReport } from "./report.service.js";
import { getPortfolioHealth } from "./health.service.js";
import { getRoutineHistory } from "./daily-routine.service.js";
import { listGoals } from "./goal.service.js";
import { listReviewTasks } from "./review-task.service.js";
import { getDailyBrief } from "./daily-brief.service.js";

const round = (value, digits = 2) => Number(Number(value || 0).toFixed(digits));

export async function getWeeklyReview(userId) {
  const [performance, health, routine, goals, tasks, brief] = await Promise.all([
    getPerformanceReport(userId),
    getPortfolioHealth(userId),
    getRoutineHistory(userId, 7),
    listGoals(userId),
    listReviewTasks(userId),
    getDailyBrief(userId)
  ]);

  const summary = performance.summary || {};
  const taskItems = tasks.items || [];
  const activeGoals = (goals.items || []).filter((item) => item.status === "ACTIVE");
  const topGoals = activeGoals.slice(0, 3).map((item) => ({
    id: item.id, title: item.title, progress: round(item.progress, 1),
    remainingAmount: round(item.remainingAmount), targetDate: item.targetDate,
    isReached: item.isReached
  }));

  const wins = [];
  if ((routine.summary?.completedDays || 0) > 0) wins.push(`本週完整完成 ${routine.summary.completedDays} 天盤前／盤後檢查`);
  if (Number(summary.realizedProfit || 0) > 0) wins.push(`累計已實現損益為正：${round(summary.realizedProfit)} 元`);
  if ((goals.summary?.reached || 0) > 0) wins.push(`${goals.summary.reached} 個進行中目標已達標`);
  if ((health.score || 0) >= 80) wins.push(`資產健康分數 ${health.score}，維持良好`);

  const risks = [];
  for (const issue of (health.issues || []).slice(0, 5)) risks.push(issue);
  if ((routine.summary?.averageProgress || 0) < 70) risks.push(`本週執行紀律平均 ${routine.summary?.averageProgress || 0}%，建議補強每日檢查`);
  const overdue = taskItems.filter((item) => item.status === "OPEN" && item.isOverdue);
  if (overdue.length) risks.push(`${overdue.length} 個投資檢查任務已逾期`);

  const nextActions = (brief.actions || []).slice(0, 5).map((item) => ({
    priority: item.type, title: item.title, detail: item.detail, code: item.code || null
  }));
  if (!nextActions.length) nextActions.push({ priority: "normal", title: "維持每日盤前／盤後檢查", detail: "目前沒有明顯緊急事項。", code: null });

  return {
    success: true,
    period: { days: 7, generatedAt: new Date().toISOString() },
    scorecard: {
      healthScore: health.score || 0,
      healthGrade: health.grade || "—",
      disciplineProgress: routine.summary?.averageProgress || 0,
      completedRoutineDays: routine.summary?.completedDays || 0,
      totalProfit: round(summary.totalProfit),
      realizedProfit: round(summary.realizedProfit),
      unrealizedProfit: round(summary.unrealizedProfit),
      winRate: round((summary.winRate || 0) * 100, 1),
      openTasks: taskItems.filter((item) => item.status === "OPEN").length,
      overdueTasks: overdue.length
    },
    wins, risks, nextActions, goals: topGoals,
    note: "週報依系統內交易、手動股價、每日檢查與目標資料整理，不是即時行情或投資保證。"
  };
}
