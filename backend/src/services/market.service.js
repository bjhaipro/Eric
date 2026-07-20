import { db } from "../database/db.js";

const round = (value, digits = 4) => Number(Number(value).toFixed(digits));

function normalizeQuote(input) {
  const code = String(input.code ?? "").trim().toUpperCase();
  const price = Number(input.price);
  if (!/^[A-Z0-9.-]{1,20}$/.test(code)) {
    const error = new Error("股票代碼格式不正確"); error.status = 400; throw error;
  }
  if (!Number.isFinite(price) || price <= 0) {
    const error = new Error("目前價格必須大於 0"); error.status = 400; throw error;
  }
  return { code, price: round(price) };
}

async function saveQuoteWithClient(client, userId, input) {
  const { code, price } = normalizeQuote(input);
  const previous = await client.query(
    `SELECT price::float8 AS price FROM market_quotes WHERE user_id=$1 AND code=$2 FOR UPDATE`,
    [userId, code]
  );
  const previousPrice = previous.rows[0]?.price ?? null;

  const result = await client.query(`
    INSERT INTO market_quotes (user_id, code, price, quoted_at, updated_at)
    VALUES ($1, $2, $3, NOW(), NOW())
    ON CONFLICT (user_id, code)
    DO UPDATE SET price = EXCLUDED.price, quoted_at = NOW(), updated_at = NOW()
    RETURNING code, price::float8 AS price, quoted_at AS "quotedAt"
  `, [userId, code, price]);

  await client.query(`
    INSERT INTO market_quote_history (user_id, code, price, previous_price, quoted_at)
    VALUES ($1,$2,$3,$4,NOW())
  `, [userId, code, price, previousPrice]);

  return {
    ...result.rows[0],
    previousPrice,
    change: previousPrice == null ? null : round(price - previousPrice),
    changeRate: previousPrice == null ? null : round((price - previousPrice) / previousPrice, 6)
  };
}

export async function upsertQuote(userId, input) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const quote = await saveQuoteWithClient(client, userId, input);
    await client.query("COMMIT");
    return quote;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function batchUpsertQuotes(userId, inputs) {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    const error = new Error("請至少輸入一筆股價"); error.status = 400; throw error;
  }
  if (inputs.length > 100) {
    const error = new Error("單次最多更新 100 筆股價"); error.status = 400; throw error;
  }
  const normalized = inputs.map(normalizeQuote);
  const duplicate = normalized.find((item, index) => normalized.findIndex((x) => x.code === item.code) !== index);
  if (duplicate) { const error = new Error(`股票代碼重複：${duplicate.code}`); error.status = 400; throw error; }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const quotes = [];
    for (const item of normalized) quotes.push(await saveQuoteWithClient(client, userId, item));
    await client.query("COMMIT");
    return quotes;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function listQuotes(userId) {
  const result = await db.query(`
    SELECT q.code, q.price::float8 AS price, q.quoted_at AS "quotedAt",
      h.previous_price::float8 AS "previousPrice",
      CASE WHEN h.previous_price IS NULL THEN NULL ELSE (q.price-h.previous_price)::float8 END AS change,
      CASE WHEN h.previous_price IS NULL OR h.previous_price=0 THEN NULL ELSE ((q.price-h.previous_price)/h.previous_price)::float8 END AS "changeRate"
    FROM market_quotes q
    LEFT JOIN LATERAL (
      SELECT previous_price FROM market_quote_history
      WHERE user_id=q.user_id AND code=q.code
      ORDER BY id DESC LIMIT 1
    ) h ON TRUE
    WHERE q.user_id = $1 ORDER BY q.code
  `, [userId]);
  return result.rows;
}

export async function quoteHistory(userId, code, limit = 30) {
  const normalizedCode = String(code ?? "").trim().toUpperCase();
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 365);
  const result = await db.query(`
    SELECT id, code, price::float8 AS price, previous_price::float8 AS "previousPrice", quoted_at AS "quotedAt"
    FROM market_quote_history
    WHERE user_id=$1 AND code=$2
    ORDER BY quoted_at DESC, id DESC LIMIT $3
  `, [userId, normalizedCode, safeLimit]);
  return result.rows;
}
