import { db } from "../database/db.js";

const ACTIONS = new Set(["BUY", "SELL"]);
const STATUSES = new Set(["PLANNED", "EXECUTED", "CANCELLED"]);
function text(value, max = 200) { return String(value ?? "").trim().slice(0, max); }
function number(value, name, { min = 0, required = true } = {}) {
  if ((value === "" || value == null) && !required) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) { const error = new Error(`${name}格式不正確`); error.status = 400; throw error; }
  return parsed;
}
function normalize(payload) {
  const code = text(payload.code, 20).toUpperCase();
  const name = text(payload.name, 100);
  const action = text(payload.action, 10).toUpperCase();
  const status = text(payload.status || "PLANNED", 12).toUpperCase();
  if (!code) { const error = new Error("請輸入股票代號"); error.status = 400; throw error; }
  if (!ACTIONS.has(action)) { const error = new Error("交易方向只能是買進或賣出"); error.status = 400; throw error; }
  if (!STATUSES.has(status)) { const error = new Error("計畫狀態不正確"); error.status = 400; throw error; }
  const plannedPrice = number(payload.plannedPrice, "計畫價格", { min: 0.0001 });
  const shares = Math.trunc(number(payload.shares, "股數", { min: 1 }));
  const stopLossPrice = number(payload.stopLossPrice, "停損價", { min: 0.0001, required: false });
  const targetPrice = number(payload.targetPrice, "目標價", { min: 0.0001, required: false });
  if (action === "BUY" && stopLossPrice != null && stopLossPrice >= plannedPrice) { const error = new Error("買進計畫的停損價必須低於計畫價格"); error.status = 400; throw error; }
  if (action === "BUY" && targetPrice != null && targetPrice <= plannedPrice) { const error = new Error("買進計畫的目標價必須高於計畫價格"); error.status = 400; throw error; }
  return { code, name, action, status, plannedPrice, shares, stopLossPrice, targetPrice, plannedDate: payload.plannedDate || new Date().toISOString().slice(0,10), note: text(payload.note, 1000) };
}
function map(row) {
  const plannedPrice = Number(row.planned_price), shares = Number(row.shares);
  const stop = row.stop_loss_price == null ? null : Number(row.stop_loss_price);
  const target = row.target_price == null ? null : Number(row.target_price);
  const current = row.current_price == null ? null : Number(row.current_price);
  const capital = plannedPrice * shares;
  const riskAmount = stop == null ? null : Math.abs(plannedPrice - stop) * shares;
  const rewardAmount = target == null ? null : Math.abs(target - plannedPrice) * shares;
  const rewardRiskRatio = riskAmount && rewardAmount != null ? rewardAmount / riskAmount : null;
  let trigger = "等待中";
  if (current == null) trigger = "缺少目前股價";
  else if (row.action === "BUY" && current <= plannedPrice) trigger = "到達買進價";
  else if (row.action === "SELL" && current >= plannedPrice) trigger = "到達賣出價";
  return { id: row.id, code: row.code, name: row.name, action: row.action, status: row.status, plannedPrice, shares, stopLossPrice: stop, targetPrice: target, plannedDate: row.planned_date, note: row.note, currentPrice: current, quotedAt: row.quoted_at, capital, riskAmount, rewardAmount, rewardRiskRatio, trigger, createdAt: row.created_at, updatedAt: row.updated_at };
}
export async function listTradePlans(userId) {
  const { rows } = await db.query(`SELECT p.*,q.price AS current_price,q.quoted_at FROM trade_plans p LEFT JOIN market_quotes q ON q.user_id=p.user_id AND q.code=p.code WHERE p.user_id=$1 ORDER BY CASE p.status WHEN 'PLANNED' THEN 0 WHEN 'EXECUTED' THEN 1 ELSE 2 END,p.planned_date DESC,p.id DESC`,[userId]);
  const items=rows.map(map);
  return { items, summary: { total: items.length, planned: items.filter(x=>x.status==='PLANNED').length, triggered: items.filter(x=>x.status==='PLANNED' && x.trigger.startsWith('到達')).length, totalCapital: items.filter(x=>x.status==='PLANNED').reduce((s,x)=>s+x.capital,0), highQuality: items.filter(x=>x.status==='PLANNED' && x.rewardRiskRatio!=null && x.rewardRiskRatio>=2).length } };
}
export async function createTradePlan(userId,payload) {
  const p=normalize(payload); const {rows}=await db.query(`INSERT INTO trade_plans(user_id,code,name,action,status,planned_price,shares,stop_loss_price,target_price,planned_date,note) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[userId,p.code,p.name,p.action,p.status,p.plannedPrice,p.shares,p.stopLossPrice,p.targetPrice,p.plannedDate,p.note]); return map(rows[0]);
}
export async function updateTradePlan(userId,id,payload) {
  const p=normalize(payload); const {rows}=await db.query(`UPDATE trade_plans SET code=$3,name=$4,action=$5,status=$6,planned_price=$7,shares=$8,stop_loss_price=$9,target_price=$10,planned_date=$11,note=$12,updated_at=NOW() WHERE id=$2 AND user_id=$1 RETURNING *`,[userId,id,p.code,p.name,p.action,p.status,p.plannedPrice,p.shares,p.stopLossPrice,p.targetPrice,p.plannedDate,p.note]); if(!rows[0]){const e=new Error('找不到交易計畫');e.status=404;throw e} return map(rows[0]);
}
export async function deleteTradePlan(userId,id) { const r=await db.query(`DELETE FROM trade_plans WHERE id=$2 AND user_id=$1`,[userId,id]); if(!r.rowCount){const e=new Error('找不到交易計畫');e.status=404;throw e} }
