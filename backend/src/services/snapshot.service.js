import { db } from "../database/db.js";
import { getDashboard } from "./dashboard.service.js";

const ALLOWED_DAYS = new Set([7, 30, 90, 180, 365]);

function taipeiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function normalizeDays(value) {
  const days = Number(value || 30);
  return ALLOWED_DAYS.has(days) ? days : 30;
}

export async function saveTodaySnapshot(userId) {
  const dashboard = await getDashboard(userId);
  const summary = dashboard.summary || {};
  const snapshotDate = taipeiDate();
  const totalCost = Number(summary.totalCost || 0);
  const marketValue = Number(summary.marketValue || 0);
  const unrealizedProfit = Number(summary.unrealizedProfit || 0);
  const realizedProfit = Number(summary.realizedProfit || 0);
  const roi = Number(summary.unrealizedRoi || 0);

  const result = await db.query(
    `INSERT INTO portfolio_snapshots
      (user_id, snapshot_date, market_value, total_cost, unrealized_profit, realized_profit, roi)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (user_id, snapshot_date)
     DO UPDATE SET market_value=EXCLUDED.market_value,
       total_cost=EXCLUDED.total_cost,
       unrealized_profit=EXCLUDED.unrealized_profit,
       realized_profit=EXCLUDED.realized_profit,
       roi=EXCLUDED.roi,
       updated_at=NOW()
     RETURNING snapshot_date AS "snapshotDate",
       market_value::float8 AS "marketValue",
       total_cost::float8 AS "totalCost",
       unrealized_profit::float8 AS "unrealizedProfit",
       realized_profit::float8 AS "realizedProfit",
       roi::float8 AS roi,
       created_at AS "savedAt"`,
    [userId, snapshotDate, marketValue, totalCost, unrealizedProfit, realizedProfit, roi]
  );
  return result.rows[0];
}

export async function listSnapshots(userId, requestedDays) {
  const days = normalizeDays(requestedDays);
  const result = await db.query(
    `SELECT snapshot_date AS "snapshotDate",
       market_value::float8 AS "marketValue",
       total_cost::float8 AS "totalCost",
       unrealized_profit::float8 AS "unrealizedProfit",
       realized_profit::float8 AS "realizedProfit",
       roi::float8 AS roi,
       created_at AS "savedAt"
     FROM portfolio_snapshots
     WHERE user_id=$1 AND snapshot_date >= (CURRENT_DATE - ($2::int - 1))
     ORDER BY snapshot_date ASC`,
    [userId, days]
  );

  const items = result.rows;
  const first = items[0];
  const last = items.at(-1);
  const change = first && last ? Number(last.marketValue) - Number(first.marketValue) : 0;
  const changeRate = first && Number(first.marketValue) !== 0 ? change / Number(first.marketValue) : 0;
  return { days, snapshots: items, summary: { count: items.length, change, changeRate } };
}

export async function deleteSnapshots(userId) {
  const result = await db.query("DELETE FROM portfolio_snapshots WHERE user_id=$1", [userId]);
  return result.rowCount;
}
