import { db } from "../database/db.js";

const TYPES = new Set(["DEPOSIT", "WITHDRAW", "INTEREST", "FEE", "OTHER_IN", "OTHER_OUT"]);
function bad(message) { return Object.assign(new Error(message), { status: 400 }); }
function normalize(input = {}) {
  const entryDate = String(input.entryDate ?? "").trim();
  const type = String(input.type ?? "").trim().toUpperCase();
  const amount = Number(input.amount);
  const note = String(input.note ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) throw bad("日期格式必須是 YYYY-MM-DD");
  if (!TYPES.has(type)) throw bad("現金異動類型錯誤");
  if (!Number.isFinite(amount) || amount <= 0) throw bad("金額必須大於 0");
  if (note.length > 1000) throw bad("備註過長");
  return { entryDate, type, amount, note };
}
function signedAmount(type, amount) {
  return ["DEPOSIT", "INTEREST", "OTHER_IN"].includes(type) ? Number(amount) : -Number(amount);
}
function map(row) {
  const amount = Number(row.amount);
  return { id: row.id, entryDate: row.entry_date, type: row.type, amount, signedAmount: signedAmount(row.type, amount), note: row.note, createdAt: row.created_at, updatedAt: row.updated_at };
}
export async function listCashEntries(userId, { year = "" } = {}) {
  const values = [userId]; let where = "user_id=$1";
  if (year) { const y=Number(year); if(!Number.isInteger(y)||y<2000||y>2200) throw bad("年度格式錯誤"); values.push(y); where += " AND EXTRACT(YEAR FROM entry_date)=$2"; }
  const { rows } = await db.query(`SELECT * FROM cash_ledger_entries WHERE ${where} ORDER BY entry_date DESC, id DESC`, values);
  const items = rows.map(map);
  const inflow = items.filter(x=>x.signedAmount>0).reduce((s,x)=>s+x.signedAmount,0);
  const outflow = Math.abs(items.filter(x=>x.signedAmount<0).reduce((s,x)=>s+x.signedAmount,0));
  const { rows: txRows } = await db.query(`SELECT type, shares, price, fee, tax FROM transactions WHERE user_id=$1`, [userId]);
  let tradingCashFlow = 0;
  for (const x of txRows) tradingCashFlow += x.type === "BUY" ? -(Number(x.shares)*Number(x.price)+Number(x.fee)+Number(x.tax)) : Number(x.shares)*Number(x.price)-Number(x.fee)-Number(x.tax);
  const { rows: dividendRows } = await db.query(`SELECT shares, dividend_per_share, tax, fee FROM dividend_records WHERE user_id=$1`, [userId]);
  const dividendIncome = dividendRows.reduce((s,x)=>s+Number(x.shares)*Number(x.dividend_per_share)-Number(x.tax)-Number(x.fee),0);
  return { items, summary: { count: items.length, inflow, outflow, manualBalance: inflow-outflow, tradingCashFlow, dividendIncome, estimatedCashBalance: inflow-outflow+tradingCashFlow+dividendIncome } };
}
export async function createCashEntry(userId,input){ const v=normalize(input); const {rows}=await db.query(`INSERT INTO cash_ledger_entries(user_id,entry_date,type,amount,note) VALUES($1,$2,$3,$4,$5) RETURNING *`,[userId,v.entryDate,v.type,v.amount,v.note]); return map(rows[0]); }
export async function updateCashEntry(userId,id,input){ const v=normalize(input); const {rows}=await db.query(`UPDATE cash_ledger_entries SET entry_date=$3,type=$4,amount=$5,note=$6,updated_at=NOW() WHERE user_id=$1 AND id=$2 RETURNING *`,[userId,id,v.entryDate,v.type,v.amount,v.note]); if(!rows[0]) throw Object.assign(new Error("找不到現金紀錄"),{status:404}); return map(rows[0]); }
export async function deleteCashEntry(userId,id){ const r=await db.query(`DELETE FROM cash_ledger_entries WHERE user_id=$1 AND id=$2`,[userId,id]); if(!r.rowCount) throw Object.assign(new Error("找不到現金紀錄"),{status:404}); }
