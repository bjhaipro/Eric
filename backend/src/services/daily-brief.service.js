import { getPortfolioHealth } from "./health.service.js";
import { getAnalysis } from "./strategy.service.js";
import { evaluateAlerts } from "./alert.service.js";
import { listWatchlist } from "./watchlist.service.js";

const priorityOf = (type) => ({ urgent: 3, important: 2, normal: 1 })[type] || 0;

export async function getDailyBrief(userId) {
  const [health, analysis, alerts, watchlist] = await Promise.all([
    getPortfolioHealth(userId),
    getAnalysis(userId),
    evaluateAlerts(userId),
    listWatchlist(userId)
  ]);

  const actions = [];
  for (const item of alerts.triggered || []) {
    actions.push({
      type: "urgent",
      category: "價格提醒",
      code: item.code,
      title: `${item.code} 已觸發價格提醒`,
      detail: `目前價格 ${item.lastSeenPrice ?? "—"}，目標價格 ${item.targetPrice}`
    });
  }

  for (const item of analysis.analyses || []) {
    if (["風險處理", "降低集中度"].includes(item.action)) {
      actions.push({
        type: "urgent",
        category: "持股風險",
        code: item.code,
        title: `${item.code}：${item.action}`,
        detail: item.warnings?.[0] || "請檢視持股風險。"
      });
    } else if (item.action === "分批停利") {
      actions.push({
        type: "important",
        category: "獲利管理",
        code: item.code,
        title: `${item.code}：可檢視分批停利`,
        detail: item.reasons?.[0] || "報酬率已達設定目標。"
      });
    } else if (item.action === "補價格") {
      actions.push({
        type: "important",
        category: "資料更新",
        code: item.code,
        title: `${item.code}：補上目前股價`,
        detail: "缺少目前價格，市值與損益判斷不完整。"
      });
    }
  }

  for (const item of watchlist.items || []) {
    if (item.status === "到達買進觀察價" || item.status === "到達賣出觀察價") {
      actions.push({
        type: "important",
        category: "觀察清單",
        code: item.code,
        title: `${item.code}：${item.status}`,
        detail: `目前價格 ${item.currentPrice ?? "—"}，優先程度 ${item.priority}`
      });
    }
  }

  for (const issue of health.issues || []) {
    if (!actions.some((x) => x.detail === issue)) {
      actions.push({ type: "normal", category: "健康檢查", code: null, title: issue, detail: "請依健康檢查建議逐項確認。" });
    }
  }

  actions.sort((a, b) => priorityOf(b.type) - priorityOf(a.type));
  const limited = actions.slice(0, 12);
  return {
    generatedAt: new Date().toISOString(),
    headline: limited.length ? `今天有 ${limited.length} 項需要查看` : "今天沒有明顯待辦事項",
    summary: {
      healthScore: health.score,
      healthGrade: health.grade,
      urgent: limited.filter((x) => x.type === "urgent").length,
      important: limited.filter((x) => x.type === "important").length,
      normal: limited.filter((x) => x.type === "normal").length,
      triggeredAlerts: alerts.summary?.triggered || 0,
      watchSignals: (watchlist.summary?.buyReady || 0) + (watchlist.summary?.sellReady || 0)
    },
    actions: limited,
    note: "此清單依手動股價、持股紀錄與個人策略整理，不是即時報價或自動交易指令。"
  };
}
