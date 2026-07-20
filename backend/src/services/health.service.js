import { db } from "../database/db.js";
import { getDashboard } from "./dashboard.service.js";
import { listCashEntries } from "./cash.service.js";
import { getAllocationAnalysis } from "./allocation.service.js";

const round = (value, digits = 4) => Number(Number(value || 0).toFixed(digits));

export async function getPortfolioHealth(userId) {
  const [dashboard, cash, allocation, strategyResult, alertResult] = await Promise.all([
    getDashboard(userId),
    listCashEntries(userId),
    getAllocationAnalysis(userId),
    db.query(`SELECT max_position_rate::float8 AS "maxPositionRate", stale_quote_hours AS "staleQuoteHours"
      FROM user_strategies WHERE user_id=$1`, [userId]),
    db.query(`SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE enabled=TRUE)::int AS enabled,
      COUNT(*) FILTER (WHERE enabled=TRUE AND triggered_at IS NOT NULL)::int AS triggered
      FROM price_alerts WHERE user_id=$1`, [userId])
  ]);

  const strategy = strategyResult.rows[0] || { maxPositionRate: 0.35, staleQuoteHours: 24 };
  const alerts = alertResult.rows[0] || { total: 0, enabled: 0, triggered: 0 };
  const positions = dashboard.positions || [];
  const marketValue = Number(dashboard.summary.marketValue || 0);
  const estimatedCash = Number(cash.summary.estimatedCashBalance || 0);
  const netAsset = marketValue + estimatedCash;
  const now = Date.now();
  const staleMs = Number(strategy.staleQuoteHours || 24) * 3600_000;

  const missingPrice = positions.filter((p) => p.currentPrice == null).length;
  const stalePrice = positions.filter((p) => p.quotedAt && now - new Date(p.quotedAt).getTime() > staleMs).length;
  const weighted = positions
    .filter((p) => p.marketValue != null && marketValue > 0)
    .map((p) => ({ code: p.code, name: p.name, rate: Number(p.marketValue) / marketValue }))
    .sort((a, b) => b.rate - a.rate);
  const largest = weighted[0] || null;
  const concentrationLimit = Number(strategy.maxPositionRate || 0.35);
  const targetTotal = Number(allocation.summary.targetTotal || 0);

  let score = 100;
  const issues = [];
  const recommendations = [];
  if (missingPrice) {
    score -= Math.min(30, missingPrice * 10);
    issues.push(`${missingPrice} 檔持股缺少目前價格`);
    recommendations.push("補齊持股價格後，再查看完整市值與損益。");
  }
  if (stalePrice) {
    score -= Math.min(15, stalePrice * 5);
    issues.push(`${stalePrice} 檔價格已超過有效時間`);
    recommendations.push("更新過期股價，避免使用舊價格做決策。");
  }
  if (largest && largest.rate > concentrationLimit) {
    const excess = largest.rate - concentrationLimit;
    score -= Math.min(25, Math.ceil(excess * 100));
    issues.push(`${largest.code} 比重 ${(largest.rate * 100).toFixed(1)}%，高於上限 ${(concentrationLimit * 100).toFixed(0)}%`);
    recommendations.push(`檢視 ${largest.code} 的集中風險，避免單一持股影響整體資產。`);
  }
  if (estimatedCash < 0) {
    score -= 20;
    issues.push("估算現金餘額為負數");
    recommendations.push("檢查資金存入、提領與交易紀錄是否完整。");
  }
  if (Number(alerts.triggered) > 0) {
    score -= Math.min(15, Number(alerts.triggered) * 5);
    issues.push(`${alerts.triggered} 個價格提醒已觸發`);
    recommendations.push("查看已觸發提醒，確認是否需要執行原定策略。");
  }
  if (targetTotal > 0 && Math.abs(targetTotal - 1) > 0.02) {
    score -= 10;
    issues.push(`配置目標合計 ${(targetTotal * 100).toFixed(1)}%，未接近 100%`);
    recommendations.push("調整配置目標，使總比重接近 100%。");
  }
  score = Math.max(0, Math.min(100, score));
  let grade = "健康";
  if (score < 60) grade = "高風險";
  else if (score < 80) grade = "需注意";
  else if (score < 90) grade = "良好";

  return {
    score,
    grade,
    summary: {
      netAsset: round(netAsset, 2), marketValue: round(marketValue, 2), estimatedCash: round(estimatedCash, 2),
      positionCount: positions.length, missingPrice, stalePrice,
      largestPositionCode: largest?.code || null, largestPositionRate: round(largest?.rate || 0, 6),
      concentrationLimit: round(concentrationLimit, 6), targetTotal: round(targetTotal, 6),
      triggeredAlerts: Number(alerts.triggered || 0)
    },
    issues,
    recommendations: recommendations.length ? [...new Set(recommendations)] : ["目前沒有明顯異常，持續更新價格與交易紀錄。"]
  };
}
