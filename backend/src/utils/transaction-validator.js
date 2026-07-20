function toNumber(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw Object.assign(new Error(`${field} 格式錯誤`), { status: 400 });
  return number;
}

export function normalizeTransactionInput(body = {}) {
  const type = String(body.type ?? "").trim().toUpperCase();
  const code = String(body.code ?? "").trim().toUpperCase();
  const name = String(body.name ?? "").trim();
  const shares = toNumber(body.shares, "股數");
  const price = toNumber(body.price, "成交價");
  const fee = body.fee === undefined || body.fee === "" ? 0 : toNumber(body.fee, "手續費");
  const tax = body.tax === undefined || body.tax === "" ? 0 : toNumber(body.tax, "交易稅");
  const tradeDate = String(body.tradeDate ?? body.trade_date ?? "").trim();
  const note = String(body.note ?? "").trim();

  if (!code || code.length > 20) throw Object.assign(new Error("股票代碼不可空白，且不得超過 20 字元"), { status: 400 });
  if (name.length > 100) throw Object.assign(new Error("股票名稱不得超過 100 字元"), { status: 400 });
  if (!['BUY', 'SELL'].includes(type)) throw Object.assign(new Error("交易類型只能是 BUY 或 SELL"), { status: 400 });
  if (!Number.isSafeInteger(shares) || shares <= 0) throw Object.assign(new Error("股數必須是大於 0 的整數"), { status: 400 });
  if (price <= 0) throw Object.assign(new Error("成交價必須大於 0"), { status: 400 });
  if (fee < 0 || tax < 0) throw Object.assign(new Error("手續費與交易稅不可小於 0"), { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tradeDate) || Number.isNaN(Date.parse(`${tradeDate}T00:00:00Z`))) {
    throw Object.assign(new Error("交易日期格式必須是 YYYY-MM-DD"), { status: 400 });
  }

  return { code, name, type, shares, price, fee, tax, tradeDate, note };
}
