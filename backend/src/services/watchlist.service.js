import { db } from "../database/db.js";

function normalize(input = {}) {
  const code = String(input.code || "").trim().toUpperCase();
  const name = String(input.name || "").trim();
  const note = String(input.note || "").trim();
  const priority = Number(input.priority ?? 3);
  const targetBuyPrice = input.targetBuyPrice === "" || input.targetBuyPrice == null ? null : Number(input.targetBuyPrice);
  const targetSellPrice = input.targetSellPrice === "" || input.targetSellPrice == null ? null : Number(input.targetSellPrice);
  if (!/^[A-Z0-9._-]{1,20}$/.test(code)) throw Object.assign(new Error("股票代號格式錯誤"), { status: 400 });
  if (name.length > 100 || note.length > 1000) throw Object.assign(new Error("名稱或備註過長"), { status: 400 });
  if (!Number.isInteger(priority) || priority < 1 || priority > 5) throw Object.assign(new Error("優先程度必須為 1 到 5"), { status: 400 });
  for (const [label, value] of [["目標買進價", targetBuyPrice], ["目標賣出價", targetSellPrice]]) {
    if (value != null && (!Number.isFinite(value) || value <= 0)) throw Object.assign(new Error(`${label}必須大於 0`), { status: 400 });
  }
  return { code, name, note, priority, targetBuyPrice, targetSellPrice };
}

function map(row) {
  const currentPrice = row.current_price == null ? null : Number(row.current_price);
  const buy = row.target_buy_price == null ? null : Number(row.target_buy_price);
  const sell = row.target_sell_price == null ? null : Number(row.target_sell_price);
  let status = "觀察中";
  if (currentPrice != null && buy != null && currentPrice <= buy) status = "到達買進觀察價";
  if (currentPrice != null && sell != null && currentPrice >= sell) status = "到達賣出觀察價";
  return {
    id: row.id, code: row.code, name: row.name,
    targetBuyPrice: buy, targetSellPrice: sell,
    priority: Number(row.priority), note: row.note,
    currentPrice, quotedAt: row.quoted_at, status,
    createdAt: row.created_at, updatedAt: row.updated_at
  };
}

export async function listWatchlist(userId) {
  const { rows } = await db.query(`
    SELECT w.*, q.price AS current_price, q.quoted_at
    FROM watchlist_items w
    LEFT JOIN market_quotes q ON q.user_id=w.user_id AND q.code=w.code
    WHERE w.user_id=$1
    ORDER BY w.priority DESC, w.updated_at DESC, w.id DESC`, [userId]);
  const items = rows.map(map);
  return { items, summary: { total: items.length, buyReady: items.filter(x=>x.status==="到達買進觀察價").length, sellReady: items.filter(x=>x.status==="到達賣出觀察價").length, missingPrice: items.filter(x=>x.currentPrice==null).length } };
}

export async function createWatchlistItem(userId, input) {
  const v = normalize(input);
  try {
    const { rows } = await db.query(`INSERT INTO watchlist_items
      (user_id,code,name,target_buy_price,target_sell_price,priority,note)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [userId,v.code,v.name,v.targetBuyPrice,v.targetSellPrice,v.priority,v.note]);
    return map(rows[0]);
  } catch (e) {
    if (e.code === "23505") throw Object.assign(new Error("這支股票已在觀察清單"), { status: 409 });
    throw e;
  }
}

export async function updateWatchlistItem(userId, id, input) {
  const v = normalize(input);
  const { rows } = await db.query(`UPDATE watchlist_items SET
    code=$3,name=$4,target_buy_price=$5,target_sell_price=$6,priority=$7,note=$8,updated_at=NOW()
    WHERE id=$2 AND user_id=$1 RETURNING *`, [userId,id,v.code,v.name,v.targetBuyPrice,v.targetSellPrice,v.priority,v.note]);
  if (!rows[0]) throw Object.assign(new Error("找不到觀察項目"), { status: 404 });
  return map(rows[0]);
}

export async function deleteWatchlistItem(userId, id) {
  const result = await db.query("DELETE FROM watchlist_items WHERE id=$2 AND user_id=$1", [userId,id]);
  if (!result.rowCount) throw Object.assign(new Error("找不到觀察項目"), { status: 404 });
}
