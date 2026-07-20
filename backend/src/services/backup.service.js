import { db } from "../database/db.js";
import { buildPortfolio } from "./portfolio-builder.js";
import { normalizeTransactionInput } from "../utils/transaction-validator.js";

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

function normalizeQuote(input = {}) {
  const code = String(input.code ?? "").trim().toUpperCase();
  const price = Number(input.price);
  const quotedAt = input.quotedAt ? new Date(input.quotedAt) : new Date();
  if (!/^[A-Z0-9.-]{1,20}$/.test(code)) throw badRequest("備份中的股票代碼格式不正確");
  if (!Number.isFinite(price) || price <= 0) throw badRequest(`${code} 的目前價格不正確`);
  if (Number.isNaN(quotedAt.getTime())) throw badRequest(`${code} 的報價時間不正確`);
  return { code, price: Number(price.toFixed(4)), quotedAt };
}

function normalizeAlert(input = {}) {
  const code = String(input.code ?? "").trim().toUpperCase();
  const name = String(input.name ?? "").trim().slice(0, 100);
  const direction = String(input.direction ?? "").trim().toUpperCase();
  const targetPrice = Number(input.targetPrice);
  if (!/^[A-Z0-9.-]{1,20}$/.test(code)) throw badRequest("提醒股票代碼格式不正確");
  if (!['ABOVE', 'BELOW'].includes(direction)) throw badRequest(`${code} 的提醒方向不正確`);
  if (!Number.isFinite(targetPrice) || targetPrice <= 0) throw badRequest(`${code} 的提醒價格不正確`);
  return { code, name, direction, targetPrice: Number(targetPrice.toFixed(4)), enabled: input.enabled !== false };
}

function normalizeStrategy(input = {}) {
  const strategy = {
    targetProfitRate: Number(input.targetProfitRate ?? 0.03),
    stopLossRate: Number(input.stopLossRate ?? 0.08),
    maxPositionRate: Number(input.maxPositionRate ?? 0.35),
    staleQuoteHours: Number(input.staleQuoteHours ?? 24)
  };
  if (!(strategy.targetProfitRate >= 0.005 && strategy.targetProfitRate <= 1)) throw badRequest("目標獲利率不正確");
  if (!(strategy.stopLossRate >= 0.01 && strategy.stopLossRate <= 1)) throw badRequest("停損率不正確");
  if (!(strategy.maxPositionRate >= 0.05 && strategy.maxPositionRate <= 1)) throw badRequest("持股比重上限不正確");
  if (!Number.isInteger(strategy.staleQuoteHours) || strategy.staleQuoteHours < 1 || strategy.staleQuoteHours > 720) throw badRequest("股價有效時間不正確");
  return strategy;
}

export async function exportBackup(userId) {
  const [userResult, transactionResult, quoteResult, strategyResult, alertResult] = await Promise.all([
    db.query("SELECT email, name FROM users WHERE id=$1", [userId]),
    db.query(`SELECT code, name, type, shares::float8 AS shares, price::float8 AS price,
      fee::float8 AS fee, tax::float8 AS tax, trade_date AS "tradeDate", note
      FROM transactions WHERE user_id=$1 ORDER BY trade_date, created_at, id`, [userId]),
    db.query(`SELECT code, price::float8 AS price, quoted_at AS "quotedAt"
      FROM market_quotes WHERE user_id=$1 ORDER BY code`, [userId]),
    db.query(`SELECT target_profit_rate::float8 AS "targetProfitRate", stop_loss_rate::float8 AS "stopLossRate",
      max_position_rate::float8 AS "maxPositionRate", stale_quote_hours AS "staleQuoteHours"
      FROM user_strategies WHERE user_id=$1`, [userId]),
    db.query(`SELECT code, name, direction, target_price::float8 AS "targetPrice", enabled
      FROM price_alerts WHERE user_id=$1 ORDER BY code, id`, [userId])
  ]);

  return {
    format: "BJH_AI_PRO_BACKUP",
    version: 1,
    exportedAt: new Date().toISOString(),
    user: userResult.rows[0] ?? null,
    data: {
      transactions: transactionResult.rows,
      quotes: quoteResult.rows,
      strategy: strategyResult.rows[0] ?? null,
      alerts: alertResult.rows
    }
  };
}

export async function importBackup(userId, payload, mode = "replace") {
  if (!payload || payload.format !== "BJH_AI_PRO_BACKUP" || Number(payload.version) !== 1) {
    throw badRequest("不是有效的 BJH AI Pro 備份檔");
  }
  if (!['replace', 'merge'].includes(mode)) throw badRequest("匯入模式只能是 replace 或 merge");

  const raw = payload.data ?? {};
  const transactions = (Array.isArray(raw.transactions) ? raw.transactions : []).map(normalizeTransactionInput);
  transactions.sort((a, b) => String(a.tradeDate).localeCompare(String(b.tradeDate)));
  buildPortfolio(transactions);
  const quotes = (Array.isArray(raw.quotes) ? raw.quotes : []).map(normalizeQuote);
  const alerts = (Array.isArray(raw.alerts) ? raw.alerts : []).map(normalizeAlert);
  const strategy = raw.strategy ? normalizeStrategy(raw.strategy) : null;

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [userId]);

    if (mode === "replace") {
      await client.query("DELETE FROM price_alerts WHERE user_id=$1", [userId]);
      await client.query("DELETE FROM market_quotes WHERE user_id=$1", [userId]);
      await client.query("DELETE FROM transactions WHERE user_id=$1", [userId]);
      await client.query("DELETE FROM user_strategies WHERE user_id=$1", [userId]);
    }

    for (const t of transactions) {
      await client.query(`INSERT INTO transactions
        (user_id, code, name, type, shares, price, fee, tax, trade_date, note)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [userId, t.code, t.name, t.type, t.shares, t.price, t.fee, t.tax, t.tradeDate, t.note]);
    }

    for (const q of quotes) {
      await client.query(`INSERT INTO market_quotes (user_id, code, price, quoted_at, updated_at)
        VALUES ($1,$2,$3,$4,NOW())
        ON CONFLICT (user_id, code) DO UPDATE SET price=EXCLUDED.price, quoted_at=EXCLUDED.quoted_at, updated_at=NOW()`,
        [userId, q.code, q.price, q.quotedAt]);
    }

    if (strategy) {
      await client.query(`INSERT INTO user_strategies
        (user_id, target_profit_rate, stop_loss_rate, max_position_rate, stale_quote_hours)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (user_id) DO UPDATE SET target_profit_rate=EXCLUDED.target_profit_rate,
        stop_loss_rate=EXCLUDED.stop_loss_rate, max_position_rate=EXCLUDED.max_position_rate,
        stale_quote_hours=EXCLUDED.stale_quote_hours, updated_at=NOW()`,
        [userId, strategy.targetProfitRate, strategy.stopLossRate, strategy.maxPositionRate, strategy.staleQuoteHours]);
    }

    for (const a of alerts) {
      await client.query(`INSERT INTO price_alerts
        (user_id, code, name, direction, target_price, enabled)
        VALUES ($1,$2,$3,$4,$5,$6)`,
        [userId, a.code, a.name, a.direction, a.targetPrice, a.enabled]);
    }

    if (mode === "merge") {
      const all = await client.query(`SELECT code, name, type, shares, price, fee, tax,
        trade_date AS "tradeDate" FROM transactions WHERE user_id=$1 ORDER BY trade_date, created_at, id`, [userId]);
      buildPortfolio(all.rows);
    }

    await client.query("COMMIT");
    return { mode, imported: { transactions: transactions.length, quotes: quotes.length, alerts: alerts.length, strategy: Boolean(strategy) } };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
