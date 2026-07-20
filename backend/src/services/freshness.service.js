import { db } from "../database/db.js";

function classifyAge(updatedAt, staleHours) {
  if (!updatedAt) return { status: "missing", ageHours: null };
  const ageHours = Math.max(0, (Date.now() - new Date(updatedAt).getTime()) / 3600000);
  return {
    status: ageHours > staleHours ? "stale" : "fresh",
    ageHours: Math.round(ageHours * 10) / 10
  };
}

export async function getFreshness(userId) {
  const prefResult = await db.query(`
    SELECT quote_stale_hours AS "quoteStaleHours",
           snapshot_stale_hours AS "snapshotStaleHours"
    FROM user_freshness_preferences
    WHERE user_id=$1
  `, [userId]);

  const preference = prefResult.rows[0] || {
    quoteStaleHours: 24,
    snapshotStaleHours: 36
  };

  const result = await db.query(`
    SELECT
      (SELECT MAX(updated_at) FROM market_quotes WHERE user_id=$1) AS "lastQuoteAt",
      (SELECT MAX(created_at) FROM transactions WHERE user_id=$1) AS "lastTransactionAt",
      (SELECT MAX(snapshot_date::timestamptz) FROM portfolio_snapshots WHERE user_id=$1) AS "lastSnapshotAt",
      (SELECT MAX(updated_at) FROM user_strategies WHERE user_id=$1) AS "lastStrategyAt",
      (SELECT MAX(updated_at) FROM watchlist_items WHERE user_id=$1) AS "lastWatchlistAt",
      (SELECT COUNT(*)::int FROM market_quotes WHERE user_id=$1) AS "quoteCount",
      (SELECT COUNT(*)::int FROM portfolio_snapshots WHERE user_id=$1) AS "snapshotCount"
  `, [userId]);

  const row = result.rows[0];
  const quote = classifyAge(row.lastQuoteAt, preference.quoteStaleHours);
  const snapshot = classifyAge(row.lastSnapshotAt, preference.snapshotStaleHours);

  const items = [
    {
      key: "quotes",
      title: "目前股價",
      updatedAt: row.lastQuoteAt,
      count: row.quoteCount,
      ...quote,
      action: "trade"
    },
    {
      key: "transactions",
      title: "交易紀錄",
      updatedAt: row.lastTransactionAt,
      count: null,
      ...classifyAge(row.lastTransactionAt, 168),
      action: "trade"
    },
    {
      key: "snapshots",
      title: "資產快照",
      updatedAt: row.lastSnapshotAt,
      count: row.snapshotCount,
      ...snapshot,
      action: "report"
    },
    {
      key: "strategy",
      title: "投資策略",
      updatedAt: row.lastStrategyAt,
      count: null,
      ...classifyAge(row.lastStrategyAt, 720),
      action: "research"
    },
    {
      key: "watchlist",
      title: "觀察清單",
      updatedAt: row.lastWatchlistAt,
      count: null,
      ...classifyAge(row.lastWatchlistAt, 720),
      action: "research"
    }
  ];

  return {
    preference,
    summary: {
      fresh: items.filter((item) => item.status === "fresh").length,
      stale: items.filter((item) => item.status === "stale").length,
      missing: items.filter((item) => item.status === "missing").length
    },
    items
  };
}

export async function saveFreshnessPreference(userId, input) {
  const quoteStaleHours = Number(input.quoteStaleHours);
  const snapshotStaleHours = Number(input.snapshotStaleHours);

  if (!Number.isInteger(quoteStaleHours) || quoteStaleHours < 1 || quoteStaleHours > 720) {
    const error = new Error("股價過期時數需為 1～720 小時");
    error.status = 400;
    throw error;
  }
  if (!Number.isInteger(snapshotStaleHours) || snapshotStaleHours < 1 || snapshotStaleHours > 720) {
    const error = new Error("快照過期時數需為 1～720 小時");
    error.status = 400;
    throw error;
  }

  await db.query(`
    INSERT INTO user_freshness_preferences(user_id,quote_stale_hours,snapshot_stale_hours)
    VALUES($1,$2,$3)
    ON CONFLICT(user_id) DO UPDATE SET
      quote_stale_hours=EXCLUDED.quote_stale_hours,
      snapshot_stale_hours=EXCLUDED.snapshot_stale_hours,
      updated_at=NOW()
  `, [userId, quoteStaleHours, snapshotStaleHours]);

  return getFreshness(userId);
}
