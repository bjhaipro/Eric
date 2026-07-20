import { db } from "../database/db.js";

const allowedTypes = new Set(["all", "transaction", "watchlist", "journal", "dividend", "cash"]);

export async function searchUserData(userId, query = {}) {
  const keyword = String(query.q || "").trim();
  const type = allowedTypes.has(String(query.type || "all")) ? String(query.type || "all") : "all";
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100);

  if (keyword.length < 2) {
    const error = new Error("請輸入至少 2 個字元");
    error.status = 400;
    throw error;
  }

  const pattern = `%${keyword}%`;
  const groups = [];

  if (type === "all" || type === "transaction") {
    groups.push(db.query(`
      SELECT 'transaction' AS type, id::text, code, name,
             CASE WHEN type='BUY' THEN '買進' ELSE '賣出' END AS title,
             CONCAT(trade_date, '・', shares, ' 股・', price, ' 元', CASE WHEN note<>'' THEN '・'||note ELSE '' END) AS detail,
             trade_date::text AS event_date
      FROM transactions
      WHERE user_id=$1 AND (code ILIKE $2 OR name ILIKE $2 OR note ILIKE $2)
      ORDER BY trade_date DESC, id DESC LIMIT $3`, [userId, pattern, limit]));
  }

  if (type === "all" || type === "watchlist") {
    groups.push(db.query(`
      SELECT 'watchlist' AS type, id::text, code, name,
             '觀察清單' AS title,
             CONCAT('優先 ', priority, '・買進價 ', COALESCE(target_buy_price::text,'—'), '・賣出價 ', COALESCE(target_sell_price::text,'—'), CASE WHEN note<>'' THEN '・'||note ELSE '' END) AS detail,
             updated_at::date::text AS event_date
      FROM watchlist_items
      WHERE user_id=$1 AND (code ILIKE $2 OR name ILIKE $2 OR note ILIKE $2)
      ORDER BY updated_at DESC, id DESC LIMIT $3`, [userId, pattern, limit]));
  }

  if (type === "all" || type === "journal") {
    groups.push(db.query(`
      SELECT 'journal' AS type, id::text, code, '' AS name, title,
             CONCAT(plan, CASE WHEN result<>'' THEN '・結果：'||result ELSE '' END, CASE WHEN lesson<>'' THEN '・心得：'||lesson ELSE '' END) AS detail,
             entry_date::text AS event_date
      FROM investment_journal_entries
      WHERE user_id=$1 AND (code ILIKE $2 OR title ILIKE $2 OR plan ILIKE $2 OR result ILIKE $2 OR lesson ILIKE $2)
      ORDER BY entry_date DESC, id DESC LIMIT $3`, [userId, pattern, limit]));
  }

  if (type === "all" || type === "dividend") {
    groups.push(db.query(`
      SELECT 'dividend' AS type, id::text, code, name, '股利收入' AS title,
             CONCAT(shares, ' 股 × ', dividend_per_share, ' 元', CASE WHEN note<>'' THEN '・'||note ELSE '' END) AS detail,
             ex_date::text AS event_date
      FROM dividend_records
      WHERE user_id=$1 AND (code ILIKE $2 OR name ILIKE $2 OR note ILIKE $2)
      ORDER BY ex_date DESC, id DESC LIMIT $3`, [userId, pattern, limit]));
  }

  if (type === "all" || type === "cash") {
    groups.push(db.query(`
      SELECT 'cash' AS type, id::text, '' AS code, '' AS name,
             CASE type WHEN 'DEPOSIT' THEN '資金存入' WHEN 'WITHDRAW' THEN '資金提領' WHEN 'INTEREST' THEN '利息收入' WHEN 'FEE' THEN '帳戶費用' WHEN 'OTHER_IN' THEN '其他收入' ELSE '其他支出' END AS title,
             CONCAT(amount, ' 元', CASE WHEN note<>'' THEN '・'||note ELSE '' END) AS detail,
             entry_date::text AS event_date
      FROM cash_ledger_entries
      WHERE user_id=$1 AND note ILIKE $2
      ORDER BY entry_date DESC, id DESC LIMIT $3`, [userId, pattern, limit]));
  }

  const results = await Promise.all(groups);
  const items = results.flatMap((result) => result.rows)
    .sort((a, b) => String(b.event_date).localeCompare(String(a.event_date)))
    .slice(0, limit)
    .map((row) => ({
      type: row.type,
      id: row.id,
      code: row.code || "",
      name: row.name || "",
      title: row.title,
      detail: row.detail || "",
      eventDate: row.event_date
    }));

  return { keyword, type, total: items.length, items };
}
