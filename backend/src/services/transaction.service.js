import { db } from "../database/db.js";
import { buildPortfolio } from "./portfolio-builder.js";

const transactionColumns = `
  id, code, name, type, shares, price, fee, tax,
  trade_date AS "tradeDate", note, created_at AS "createdAt", updated_at AS "updatedAt"
`;

async function lockUser(client, userId) {
  await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [userId]);
}

async function loadAll(client, userId) {
  const result = await client.query(
    `SELECT ${transactionColumns} FROM transactions
     WHERE user_id = $1 ORDER BY trade_date ASC, created_at ASC, id ASC`,
    [userId]
  );
  return result.rows;
}

export async function listTransactions(userId, { code, limit = 100, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const values = [userId];
  let filter = "";
  if (code) {
    values.push(String(code).toUpperCase());
    filter = ` AND code = $${values.length}`;
  }
  values.push(safeLimit, safeOffset);
  const result = await db.query(
    `SELECT ${transactionColumns} FROM transactions
     WHERE user_id = $1${filter}
     ORDER BY trade_date DESC, created_at DESC, id DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return result.rows;
}

export async function createTransaction(userId, input) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await lockUser(client, userId);
    const existing = await loadAll(client, userId);
    buildPortfolio([...existing, { ...input, tradeDate: input.tradeDate }].sort(sortTransactions));

    const result = await client.query(
      `INSERT INTO transactions
       (user_id, code, name, type, shares, price, fee, tax, trade_date, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING ${transactionColumns}`,
      [userId, input.code, input.name, input.type, input.shares, input.price, input.fee, input.tax, input.tradeDate, input.note]
    );
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateTransaction(userId, transactionId, input) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await lockUser(client, userId);
    const existing = await loadAll(client, userId);
    const index = existing.findIndex((row) => String(row.id) === String(transactionId));
    if (index < 0) throw Object.assign(new Error("找不到交易紀錄"), { status: 404 });
    const replay = [...existing];
    replay[index] = { ...replay[index], ...input, tradeDate: input.tradeDate };
    buildPortfolio(replay.sort(sortTransactions));

    const result = await client.query(
      `UPDATE transactions SET
       code=$3, name=$4, type=$5, shares=$6, price=$7, fee=$8, tax=$9,
       trade_date=$10, note=$11, updated_at=NOW()
       WHERE id=$2 AND user_id=$1 RETURNING ${transactionColumns}`,
      [userId, transactionId, input.code, input.name, input.type, input.shares, input.price, input.fee, input.tax, input.tradeDate, input.note]
    );
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteTransaction(userId, transactionId) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await lockUser(client, userId);
    const existing = await loadAll(client, userId);
    const replay = existing.filter((row) => String(row.id) !== String(transactionId));
    if (replay.length === existing.length) throw Object.assign(new Error("找不到交易紀錄"), { status: 404 });
    buildPortfolio(replay.sort(sortTransactions));
    await client.query("DELETE FROM transactions WHERE id=$2 AND user_id=$1", [userId, transactionId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getPortfolio(userId) {
  const result = await db.query(
    `SELECT ${transactionColumns} FROM transactions
     WHERE user_id=$1 ORDER BY trade_date ASC, created_at ASC, id ASC`,
    [userId]
  );
  return buildPortfolio(result.rows);
}

function sortTransactions(a, b) {
  const dateA = String(a.tradeDate ?? a.trade_date);
  const dateB = String(b.tradeDate ?? b.trade_date);
  if (dateA !== dateB) return dateA.localeCompare(dateB);
  return Number(a.id ?? Number.MAX_SAFE_INTEGER) - Number(b.id ?? Number.MAX_SAFE_INTEGER);
}
