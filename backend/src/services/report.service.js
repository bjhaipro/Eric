import { db } from "../database/db.js";

const round = (value, digits = 4) => Number(Number(value || 0).toFixed(digits));

export async function getPerformanceReport(userId) {
  const [transactionsResult, quotesResult] = await Promise.all([
    db.query(`SELECT code, name, type, shares, price, fee, tax,
      trade_date AS "tradeDate", created_at AS "createdAt", id
      FROM transactions WHERE user_id=$1
      ORDER BY trade_date ASC, created_at ASC, id ASC`, [userId]),
    db.query(`SELECT code, price, quoted_at AS "quotedAt" FROM market_quotes WHERE user_id=$1`, [userId])
  ]);

  const quotes = new Map(quotesResult.rows.map((row) => [row.code, Number(row.price)]));
  const holdings = new Map();
  const monthly = new Map();
  let buyAmount = 0, sellAmount = 0, totalFees = 0, totalTaxes = 0, realizedProfit = 0;
  let winningSells = 0, losingSells = 0, breakEvenSells = 0;

  for (const row of transactionsResult.rows) {
    const code = String(row.code).toUpperCase();
    const shares = Number(row.shares); const price = Number(row.price);
    const fee = Number(row.fee || 0); const tax = Number(row.tax || 0);
    const holding = holdings.get(code) || { code, name: row.name || "", shares: 0, totalCost: 0, realizedProfit: 0, sells: 0, wins: 0 };
    if (row.name) holding.name = row.name;
    totalFees += fee; totalTaxes += tax;

    if (row.type === "BUY") {
      const amount = shares * price + fee + tax;
      buyAmount += amount; holding.totalCost += amount; holding.shares += shares;
    } else {
      const averageCost = holding.shares > 0 ? holding.totalCost / holding.shares : 0;
      const allocatedCost = averageCost * shares;
      const proceeds = shares * price - fee - tax;
      const profit = proceeds - allocatedCost;
      sellAmount += proceeds; realizedProfit += profit;
      holding.realizedProfit += profit; holding.sells += 1;
      if (profit > 0.0001) { winningSells += 1; holding.wins += 1; }
      else if (profit < -0.0001) losingSells += 1;
      else breakEvenSells += 1;
      holding.shares -= shares; holding.totalCost -= allocatedCost;
      if (holding.shares <= 0) { holding.shares = 0; holding.totalCost = 0; }

      const month = String(row.tradeDate).slice(0, 7);
      const entry = monthly.get(month) || { month, realizedProfit: 0, sellCount: 0 };
      entry.realizedProfit += profit; entry.sellCount += 1; monthly.set(month, entry);
    }
    holdings.set(code, holding);
  }

  const stocks = [...holdings.values()].map((h) => {
    const currentPrice = quotes.get(h.code) ?? null;
    const marketValue = currentPrice == null ? null : h.shares * currentPrice;
    const unrealizedProfit = marketValue == null ? null : marketValue - h.totalCost;
    return {
      code: h.code, name: h.name, shares: h.shares,
      averageCost: h.shares ? round(h.totalCost / h.shares) : 0,
      totalCost: round(h.totalCost), currentPrice,
      marketValue: marketValue == null ? null : round(marketValue),
      unrealizedProfit: unrealizedProfit == null ? null : round(unrealizedProfit),
      realizedProfit: round(h.realizedProfit), sellCount: h.sells,
      winRate: h.sells ? round(h.wins / h.sells, 6) : null
    };
  }).sort((a, b) => (b.realizedProfit + (b.unrealizedProfit || 0)) - (a.realizedProfit + (a.unrealizedProfit || 0)));

  const totalMarketValue = stocks.reduce((sum, s) => sum + (s.marketValue || 0), 0);
  const totalCost = stocks.reduce((sum, s) => sum + s.totalCost, 0);
  const unrealizedProfit = totalMarketValue - totalCost;
  const sellCount = winningSells + losingSells + breakEvenSells;

  return {
    summary: {
      transactionCount: transactionsResult.rows.length,
      buyAmount: round(buyAmount), sellAmount: round(sellAmount),
      totalFees: round(totalFees), totalTaxes: round(totalTaxes),
      realizedProfit: round(realizedProfit), unrealizedProfit: round(unrealizedProfit),
      totalProfit: round(realizedProfit + unrealizedProfit),
      sellCount, winningSells, losingSells, breakEvenSells,
      winRate: sellCount ? round(winningSells / sellCount, 6) : 0
    },
    monthly: [...monthly.values()].map((m) => ({ ...m, realizedProfit: round(m.realizedProfit) })).sort((a,b) => b.month.localeCompare(a.month)).slice(0, 12),
    stocks
  };
}
