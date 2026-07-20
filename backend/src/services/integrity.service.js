import { db } from "../database/db.js";
import { buildPortfolio } from "./portfolio-builder.js";

const transactionColumns = `id, code, name, type, shares, price, fee, tax,
  trade_date AS "tradeDate", note, created_at AS "createdAt", updated_at AS "updatedAt"`;

export async function inspectIntegrity(userId) {
  const [transactionsResult, countsResult, quoteResult, staleSessionsResult] = await Promise.all([
    db.query(`SELECT ${transactionColumns} FROM transactions WHERE user_id=$1 ORDER BY trade_date ASC, created_at ASC, id ASC`, [userId]),
    db.query(`SELECT
      (SELECT COUNT(*)::int FROM transactions WHERE user_id=$1) AS transactions,
      (SELECT COUNT(*)::int FROM market_quotes WHERE user_id=$1) AS quotes,
      (SELECT COUNT(*)::int FROM price_alerts WHERE user_id=$1) AS alerts,
      (SELECT COUNT(*)::int FROM watchlist_items WHERE user_id=$1) AS watchlist,
      (SELECT COUNT(*)::int FROM portfolio_snapshots WHERE user_id=$1) AS snapshots,
      (SELECT COUNT(*)::int FROM investment_journal_entries WHERE user_id=$1) AS journal,
      (SELECT COUNT(*)::int FROM dividend_records WHERE user_id=$1) AS dividends,
      (SELECT COUNT(*)::int FROM cash_ledger_entries WHERE user_id=$1) AS cash`, [userId]),
    db.query(`SELECT COUNT(*)::int AS missing
      FROM (SELECT DISTINCT code FROM transactions WHERE user_id=$1) t
      LEFT JOIN market_quotes q ON q.user_id=$1 AND q.code=t.code
      WHERE q.code IS NULL`, [userId]),
    db.query(`SELECT COUNT(*)::int AS count FROM refresh_tokens
      WHERE user_id=$1 AND (expires_at < NOW() OR revoked_at IS NOT NULL)`, [userId])
  ]);

  const issues = [];
  let portfolioValid = true;
  let portfolioError = "";
  try { buildPortfolio(transactionsResult.rows); }
  catch (error) { portfolioValid = false; portfolioError = error.message; issues.push(`交易歷史無法重建持股：${error.message}`); }

  const missingQuotes = Number(quoteResult.rows[0]?.missing || 0);
  if (missingQuotes) issues.push(`${missingQuotes} 檔曾交易股票尚未建立目前價格`);
  const staleSessions = Number(staleSessionsResult.rows[0]?.count || 0);
  if (staleSessions) issues.push(`${staleSessions} 筆過期或已撤銷登入憑證可清理`);

  return {
    status: portfolioValid ? (issues.length ? "attention" : "healthy") : "error",
    checkedAt: new Date().toISOString(),
    portfolioValid,
    portfolioError,
    counts: countsResult.rows[0],
    missingQuotes,
    staleSessions,
    issues,
    recommendations: issues.length ? [
      ...(missingQuotes ? ["補上缺少的目前價格，讓市值與損益計算完整。"] : []),
      ...(staleSessions ? ["執行安全清理，移除過期登入憑證。"] : []),
      ...(!portfolioValid ? ["先檢查交易日期與賣出股數，修正後再重新檢查。"] : [])
    ] : ["資料結構與交易重建正常，目前不需要處理。"]
  };
}

export async function runMaintenance(userId) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const sessions = await client.query(`DELETE FROM refresh_tokens
      WHERE user_id=$1 AND (expires_at < NOW() - INTERVAL '7 days' OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '7 days'))`, [userId]);
    const notifications = await client.query(`DELETE FROM notifications
      WHERE user_id=$1 AND dismissed_at IS NOT NULL AND dismissed_at < NOW() - INTERVAL '30 days'`, [userId]);
    await client.query("COMMIT");
    return { removedSessions: sessions.rowCount, removedNotifications: notifications.rowCount };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
