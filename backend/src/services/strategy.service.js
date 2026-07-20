import { db } from "../database/db.js";
import { getDashboard } from "./dashboard.service.js";

const DEFAULTS = {
  targetProfitRate: 0.03,
  stopLossRate: 0.08,
  maxPositionRate: 0.35,
  staleQuoteHours: 24
};

const round = (value, digits = 4) => Number(Number(value).toFixed(digits));

function normalizeSettings(row = {}) {
  return {
    targetProfitRate: Number(row.targetProfitRate ?? DEFAULTS.targetProfitRate),
    stopLossRate: Number(row.stopLossRate ?? DEFAULTS.stopLossRate),
    maxPositionRate: Number(row.maxPositionRate ?? DEFAULTS.maxPositionRate),
    staleQuoteHours: Number(row.staleQuoteHours ?? DEFAULTS.staleQuoteHours)
  };
}

function validateSettings(input) {
  const settings = {
    targetProfitRate: Number(input.targetProfitRate),
    stopLossRate: Number(input.stopLossRate),
    maxPositionRate: Number(input.maxPositionRate),
    staleQuoteHours: Number(input.staleQuoteHours)
  };
  if (!Number.isFinite(settings.targetProfitRate) || settings.targetProfitRate < 0.005 || settings.targetProfitRate > 1) throw Object.assign(new Error("目標獲利率須介於 0.5% 到 100%"), { status: 400 });
  if (!Number.isFinite(settings.stopLossRate) || settings.stopLossRate < 0.01 || settings.stopLossRate > 1) throw Object.assign(new Error("停損率須介於 1% 到 100%"), { status: 400 });
  if (!Number.isFinite(settings.maxPositionRate) || settings.maxPositionRate < 0.05 || settings.maxPositionRate > 1) throw Object.assign(new Error("單一持股上限須介於 5% 到 100%"), { status: 400 });
  if (!Number.isInteger(settings.staleQuoteHours) || settings.staleQuoteHours < 1 || settings.staleQuoteHours > 720) throw Object.assign(new Error("股價有效時間須介於 1 到 720 小時"), { status: 400 });
  return settings;
}

export async function getStrategy(userId) {
  const result = await db.query(`SELECT target_profit_rate::float8 AS "targetProfitRate",
    stop_loss_rate::float8 AS "stopLossRate", max_position_rate::float8 AS "maxPositionRate",
    stale_quote_hours AS "staleQuoteHours" FROM user_strategies WHERE user_id=$1`, [userId]);
  return normalizeSettings(result.rows[0]);
}

export async function saveStrategy(userId, input) {
  const s = validateSettings(input);
  const result = await db.query(`INSERT INTO user_strategies
    (user_id, target_profit_rate, stop_loss_rate, max_position_rate, stale_quote_hours)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (user_id) DO UPDATE SET target_profit_rate=EXCLUDED.target_profit_rate,
      stop_loss_rate=EXCLUDED.stop_loss_rate, max_position_rate=EXCLUDED.max_position_rate,
      stale_quote_hours=EXCLUDED.stale_quote_hours, updated_at=NOW()
    RETURNING target_profit_rate::float8 AS "targetProfitRate", stop_loss_rate::float8 AS "stopLossRate",
      max_position_rate::float8 AS "maxPositionRate", stale_quote_hours AS "staleQuoteHours"`,
    [userId, s.targetProfitRate, s.stopLossRate, s.maxPositionRate, s.staleQuoteHours]);
  return normalizeSettings(result.rows[0]);
}

function quoteAgeHours(quotedAt) {
  if (!quotedAt) return Infinity;
  return Math.max(0, (Date.now() - new Date(quotedAt).getTime()) / 36e5);
}

function analyzePosition(position, summary, settings) {
  const reasons = [];
  const warnings = [];
  const roi = position.roi == null ? null : Number(position.roi);
  const weight = summary.marketValue > 0 && position.marketValue != null ? Number(position.marketValue) / Number(summary.marketValue) : null;
  const age = quoteAgeHours(position.quotedAt);
  let action = "觀察";
  let score = 50;

  if (position.currentPrice == null) {
    action = "補價格";
    score = 20;
    warnings.push("尚未輸入目前股價，無法判斷損益與風險");
  } else {
    if (roi >= settings.targetProfitRate) {
      action = "分批停利";
      score += 20;
      reasons.push(`報酬率已達 ${(roi * 100).toFixed(2)}%，超過目標 ${(settings.targetProfitRate * 100).toFixed(2)}%`);
    } else if (roi <= -settings.stopLossRate) {
      action = "風險處理";
      score -= 30;
      warnings.push(`跌幅已達 ${(Math.abs(roi) * 100).toFixed(2)}%，超過停損設定 ${(settings.stopLossRate * 100).toFixed(2)}%`);
    } else if (roi > 0) {
      action = "續抱觀察";
      score += 10;
      reasons.push("目前仍為未實現獲利，但尚未達目標");
    } else {
      action = "觀察支撐";
      score -= 5;
      warnings.push("目前為未實現虧損，尚未觸及停損門檻");
    }

    if (age > settings.staleQuoteHours) {
      score -= 15;
      warnings.push(`股價資料已超過 ${settings.staleQuoteHours} 小時，請先更新`);
    } else {
      reasons.push("股價資料仍在設定的有效時間內");
    }

    if (weight != null && weight > settings.maxPositionRate) {
      score -= 20;
      warnings.push(`持股比重 ${(weight * 100).toFixed(2)}% 超過上限 ${(settings.maxPositionRate * 100).toFixed(2)}%`);
      if (action === "續抱觀察" || action === "觀察支撐") action = "降低集中度";
    } else if (weight != null) {
      reasons.push(`持股比重 ${(weight * 100).toFixed(2)}% 未超過風險上限`);
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    code: position.code,
    name: position.name,
    action,
    score,
    confidence: score >= 75 ? "高" : score >= 50 ? "中" : "低",
    roi,
    weight: weight == null ? null : round(weight, 6),
    targetPrice: round(position.averageCost * (1 + settings.targetProfitRate)),
    stopPrice: round(position.averageCost * (1 - settings.stopLossRate)),
    reasons,
    warnings,
    disclaimer: "此結果依持股成本、手動股價與風險設定計算，不代表保證獲利或即時投資建議。"
  };
}

export async function getAnalysis(userId) {
  const [dashboard, settings] = await Promise.all([getDashboard(userId), getStrategy(userId)]);
  const analyses = dashboard.positions.map((p) => analyzePosition(p, dashboard.summary, settings));
  return {
    settings,
    generatedAt: new Date().toISOString(),
    analyses,
    summary: {
      total: analyses.length,
      takeProfit: analyses.filter((a) => a.action === "分批停利").length,
      risk: analyses.filter((a) => ["風險處理", "降低集中度"].includes(a.action)).length,
      missingPrice: analyses.filter((a) => a.action === "補價格").length
    }
  };
}
