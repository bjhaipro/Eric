import { db } from "../database/db.js";
import { buildPortfolio } from "./portfolio-builder.js";

const round = (value, digits = 4) => Number(Number(value).toFixed(digits));

export async function getDashboard(userId) {
  const [txResult, quoteResult] = await Promise.all([
    db.query(`SELECT code, name, type, shares::float8 AS shares, price::float8 AS price,
      fee::float8 AS fee, tax::float8 AS tax, trade_date AS "tradeDate", id
      FROM transactions WHERE user_id=$1 ORDER BY trade_date ASC, id ASC`, [userId]),
    db.query(`SELECT code, price::float8 AS price, quoted_at AS "quotedAt"
      FROM market_quotes WHERE user_id=$1`, [userId])
  ]);
  const portfolio = buildPortfolio(txResult.rows);
  const quotes = new Map(quoteResult.rows.map((q) => [q.code, q]));
  let marketValue = 0;
  let totalCost = 0;
  const positions = portfolio.positions.map((p) => {
    const quote = quotes.get(p.code);
    const currentPrice = quote ? Number(quote.price) : null;
    const value = currentPrice == null ? null : p.shares * currentPrice;
    const unrealizedProfit = value == null ? null : value - p.totalCost;
    const roi = unrealizedProfit == null || p.totalCost === 0 ? null : unrealizedProfit / p.totalCost;
    totalCost += p.totalCost;
    if (value != null) marketValue += value;
    return { ...p, currentPrice, marketValue: value == null ? null : round(value),
      unrealizedProfit: unrealizedProfit == null ? null : round(unrealizedProfit),
      roi: roi == null ? null : round(roi, 6), quotedAt: quote?.quotedAt ?? null };
  });
  const pricedCost = positions.filter((p) => p.currentPrice != null).reduce((s,p)=>s+p.totalCost,0);
  const unrealizedProfit = marketValue - pricedCost;
  return {
    positions,
    summary: {
      positionCount: positions.length,
      pricedPositionCount: positions.filter((p) => p.currentPrice != null).length,
      totalCost: round(totalCost), marketValue: round(marketValue),
      unrealizedProfit: round(unrealizedProfit),
      unrealizedRoi: pricedCost ? round(unrealizedProfit / pricedCost, 6) : 0,
      realizedProfit: portfolio.summary.realizedProfit
    }
  };
}
