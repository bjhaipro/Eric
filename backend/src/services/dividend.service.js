import { db } from "../database/db.js";

function normalize(input = {}) {
  const code = String(input.code ?? "").trim().toUpperCase();
  const name = String(input.name ?? "").trim();
  const exDate = String(input.exDate ?? "").trim();
  const payDate = String(input.payDate ?? "").trim();
  const shares = Number(input.shares);
  const dividendPerShare = Number(input.dividendPerShare);
  const tax = Number(input.tax ?? 0);
  const fee = Number(input.fee ?? 0);
  const note = String(input.note ?? "").trim();
  if (!/^[A-Z0-9._-]{1,20}$/.test(code)) throw Object.assign(new Error("股票代號格式錯誤"), { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(exDate)) throw Object.assign(new Error("除息日格式必須是 YYYY-MM-DD"), { status: 400 });
  if (payDate && !/^\d{4}-\d{2}-\d{2}$/.test(payDate)) throw Object.assign(new Error("發放日格式必須是 YYYY-MM-DD"), { status: 400 });
  if (!Number.isInteger(shares) || shares <= 0) throw Object.assign(new Error("股數必須是正整數"), { status: 400 });
  if (!Number.isFinite(dividendPerShare) || dividendPerShare < 0) throw Object.assign(new Error("每股股利不可小於 0"), { status: 400 });
  if (![tax, fee].every((x) => Number.isFinite(x) && x >= 0)) throw Object.assign(new Error("稅額與費用不可小於 0"), { status: 400 });
  if (name.length > 100 || note.length > 1000) throw Object.assign(new Error("名稱或備註過長"), { status: 400 });
  return { code, name, exDate, payDate: payDate || null, shares, dividendPerShare, tax, fee, note };
}
function map(row) {
  const gross = Number(row.shares) * Number(row.dividend_per_share);
  return { id: row.id, code: row.code, name: row.name, exDate: row.ex_date, payDate: row.pay_date, shares: Number(row.shares), dividendPerShare: Number(row.dividend_per_share), grossAmount: gross, tax: Number(row.tax), fee: Number(row.fee), netAmount: gross - Number(row.tax) - Number(row.fee), note: row.note, createdAt: row.created_at, updatedAt: row.updated_at };
}
export async function listDividends(userId, { year = "" } = {}) {
  const values = [userId]; let where = "user_id=$1";
  if (year) { const y = Number(year); if (!Number.isInteger(y) || y < 2000 || y > 2200) throw Object.assign(new Error("年度格式錯誤"), { status: 400 }); values.push(y); where += " AND EXTRACT(YEAR FROM ex_date)=$2"; }
  const { rows } = await db.query(`SELECT * FROM dividend_records WHERE ${where} ORDER BY ex_date DESC, id DESC`, values);
  const items = rows.map(map);
  const byStock = new Map();
  for (const x of items) byStock.set(x.code, (byStock.get(x.code) || 0) + x.netAmount);
  return { items, summary: { count: items.length, grossAmount: items.reduce((s,x)=>s+x.grossAmount,0), taxAndFee: items.reduce((s,x)=>s+x.tax+x.fee,0), netAmount: items.reduce((s,x)=>s+x.netAmount,0), stockCount: byStock.size }, byStock: [...byStock.entries()].map(([code, netAmount])=>({ code, netAmount })).sort((a,b)=>b.netAmount-a.netAmount) };
}
export async function createDividend(userId, input) { const v=normalize(input); const {rows}=await db.query(`INSERT INTO dividend_records (user_id,code,name,ex_date,pay_date,shares,dividend_per_share,tax,fee,note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[userId,v.code,v.name,v.exDate,v.payDate,v.shares,v.dividendPerShare,v.tax,v.fee,v.note]); return map(rows[0]); }
export async function updateDividend(userId,id,input) { const v=normalize(input); const {rows}=await db.query(`UPDATE dividend_records SET code=$3,name=$4,ex_date=$5,pay_date=$6,shares=$7,dividend_per_share=$8,tax=$9,fee=$10,note=$11,updated_at=NOW() WHERE user_id=$1 AND id=$2 RETURNING *`,[userId,id,v.code,v.name,v.exDate,v.payDate,v.shares,v.dividendPerShare,v.tax,v.fee,v.note]); if(!rows[0]) throw Object.assign(new Error("找不到股利紀錄"),{status:404}); return map(rows[0]); }
export async function deleteDividend(userId,id) { const r=await db.query("DELETE FROM dividend_records WHERE user_id=$1 AND id=$2",[userId,id]); if(!r.rowCount) throw Object.assign(new Error("找不到股利紀錄"),{status:404}); }
