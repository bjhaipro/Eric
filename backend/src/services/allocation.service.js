import { db } from "../database/db.js";
import { getDashboard } from "./dashboard.service.js";

const round = (value, digits = 6) => Number(Number(value).toFixed(digits));

function normalize(input = {}) {
  const code = String(input.code || "").trim().toUpperCase();
  const category = String(input.category || "未分類").trim() || "未分類";
  const targetRate = Number(input.targetRate);
  if (!/^[A-Z0-9._-]{1,20}$/.test(code)) throw Object.assign(new Error("股票代號格式錯誤"), { status: 400 });
  if (category.length > 80) throw Object.assign(new Error("分類名稱不可超過 80 字"), { status: 400 });
  if (!Number.isFinite(targetRate) || targetRate < 0 || targetRate > 1) throw Object.assign(new Error("目標比重必須介於 0% 到 100%"), { status: 400 });
  return { code, category, targetRate };
}

export async function saveAllocationTarget(userId, input) {
  const v = normalize(input);
  const { rows } = await db.query(`INSERT INTO allocation_targets(user_id,code,category,target_rate)
    VALUES($1,$2,$3,$4)
    ON CONFLICT(user_id,code) DO UPDATE SET category=EXCLUDED.category,target_rate=EXCLUDED.target_rate,updated_at=NOW()
    RETURNING code,category,target_rate::float8 AS "targetRate",updated_at AS "updatedAt"`,
    [userId, v.code, v.category, v.targetRate]);
  return rows[0];
}

export async function deleteAllocationTarget(userId, code) {
  const result = await db.query("DELETE FROM allocation_targets WHERE user_id=$1 AND code=$2", [userId, String(code).trim().toUpperCase()]);
  if (!result.rowCount) throw Object.assign(new Error("找不到配置目標"), { status: 404 });
}

export async function getAllocationAnalysis(userId) {
  const [dashboard, targetResult] = await Promise.all([
    getDashboard(userId),
    db.query(`SELECT code,category,target_rate::float8 AS "targetRate",updated_at AS "updatedAt"
      FROM allocation_targets WHERE user_id=$1 ORDER BY category,code`, [userId])
  ]);
  const targets = new Map(targetResult.rows.map((x) => [x.code, x]));
  const totalMarketValue = Number(dashboard.summary.marketValue || 0);
  const positions = dashboard.positions.map((p) => {
    const target = targets.get(p.code);
    const currentValue = p.marketValue == null ? 0 : Number(p.marketValue);
    const currentRate = totalMarketValue > 0 ? currentValue / totalMarketValue : 0;
    const targetRate = target ? Number(target.targetRate) : 0;
    const gapRate = targetRate - currentRate;
    const rebalanceAmount = gapRate * totalMarketValue;
    let action = "尚未設定目標";
    if (target) {
      if (Math.abs(gapRate) < 0.01) action = "接近目標";
      else if (gapRate > 0) action = "可考慮增加";
      else action = "可考慮降低";
    }
    return {
      code: p.code, name: p.name, category: target?.category || "未分類",
      currentValue: round(currentValue, 2), currentRate: round(currentRate),
      targetRate: round(targetRate), gapRate: round(gapRate),
      rebalanceAmount: round(rebalanceAmount, 2), action,
      hasPrice: p.marketValue != null
    };
  });
  const absentTargets = targetResult.rows.filter((t) => !positions.some((p) => p.code === t.code)).map((t) => ({
    code: t.code, name: "", category: t.category, currentValue: 0, currentRate: 0,
    targetRate: Number(t.targetRate), gapRate: Number(t.targetRate),
    rebalanceAmount: round(Number(t.targetRate) * totalMarketValue, 2), action: "目前未持有", hasPrice: false
  }));
  const items = [...positions, ...absentTargets].sort((a,b) => b.targetRate - a.targetRate || a.code.localeCompare(b.code));
  const targetTotal = items.reduce((sum, x) => sum + x.targetRate, 0);
  return {
    items,
    summary: {
      totalMarketValue: round(totalMarketValue, 2),
      targetTotal: round(targetTotal),
      configured: items.filter((x) => x.targetRate > 0).length,
      overweight: items.filter((x) => x.action === "可考慮降低").length,
      underweight: items.filter((x) => x.action === "可考慮增加" || x.action === "目前未持有").length,
      missingPrice: dashboard.positions.filter((p) => p.marketValue == null).length
    }
  };
}
