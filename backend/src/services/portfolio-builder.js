const round = (value, digits = 4) => Number(Number(value).toFixed(digits));

export function buildPortfolio(transactions) {
  const holdings = new Map();
  let realizedProfit = 0;

  for (const row of transactions) {
    const code = String(row.code).toUpperCase();
    const type = String(row.type).toUpperCase();
    const shares = Number(row.shares);
    const price = Number(row.price);
    const fee = Number(row.fee ?? 0);
    const tax = Number(row.tax ?? 0);

    const holding = holdings.get(code) ?? {
      code,
      name: row.name ?? "",
      shares: 0,
      totalCost: 0,
      averageCost: 0,
      realizedProfit: 0
    };
    if (row.name) holding.name = row.name;

    if (type === 'BUY') {
      holding.totalCost += shares * price + fee + tax;
      holding.shares += shares;
      holding.averageCost = holding.totalCost / holding.shares;
    } else if (type === 'SELL') {
      if (shares > holding.shares) {
        const error = new Error(`${code} 賣出 ${shares} 股，但當時僅持有 ${holding.shares} 股`);
        error.status = 409;
        error.code = 'INSUFFICIENT_SHARES';
        throw error;
      }
      const allocatedCost = holding.averageCost * shares;
      const proceeds = shares * price - fee - tax;
      const profit = proceeds - allocatedCost;
      holding.shares -= shares;
      holding.totalCost -= allocatedCost;
      holding.realizedProfit += profit;
      realizedProfit += profit;

      if (holding.shares === 0) {
        holding.totalCost = 0;
        holding.averageCost = 0;
      }
    } else {
      const error = new Error(`不支援的交易類型：${type}`);
      error.status = 400;
      throw error;
    }

    holdings.set(code, holding);
  }

  const positions = [...holdings.values()]
    .filter((holding) => holding.shares > 0)
    .map((holding) => ({
      code: holding.code,
      name: holding.name,
      shares: holding.shares,
      averageCost: round(holding.averageCost),
      totalCost: round(holding.totalCost),
      realizedProfit: round(holding.realizedProfit)
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  return {
    positions,
    summary: {
      positionCount: positions.length,
      totalCost: round(positions.reduce((sum, item) => sum + item.totalCost, 0)),
      realizedProfit: round(realizedProfit)
    }
  };
}
