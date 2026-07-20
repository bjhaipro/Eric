import { db } from "../database/db.js";
import { getDashboard } from "./dashboard.service.js";
import { getCashLedger } from "./cash.service.js";
import { getDividendRecords } from "./dividend.service.js";
import { getPerformanceReport } from "./report.service.js";

const TYPES=new Set(["NET_WORTH","MARKET_VALUE","CASH","DIVIDEND","REALIZED_PROFIT"]);
const STATUSES=new Set(["ACTIVE","COMPLETED","CANCELLED"]);
const text=(v,max=1000)=>String(v??"").trim().slice(0,max);
function normalize(payload){
  const title=text(payload.title,160),goalType=text(payload.goalType,20).toUpperCase(),status=text(payload.status||"ACTIVE",12).toUpperCase();
  const targetAmount=Number(payload.targetAmount),targetDate=text(payload.targetDate,10);
  if(!title){const e=new Error("請輸入目標名稱");e.status=400;throw e}
  if(!TYPES.has(goalType)||!STATUSES.has(status)){const e=new Error("目標類型或狀態不正確");e.status=400;throw e}
  if(!Number.isFinite(targetAmount)||targetAmount<=0){const e=new Error("目標金額必須大於 0");e.status=400;throw e}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)){const e=new Error("目標日期格式不正確");e.status=400;throw e}
  return {title,goalType,targetAmount,targetDate,status,note:text(payload.note,1000)};
}
const rowMap=r=>({id:r.id,title:r.title,goalType:r.goal_type,targetAmount:Number(r.target_amount),targetDate:r.target_date,status:r.status,note:r.note,createdAt:r.created_at,updatedAt:r.updated_at});
async function currentMetrics(userId){
  const [dashboard,cash,dividends,performance]=await Promise.all([getDashboard(userId),getCashLedger(userId),getDividendRecords(userId),getPerformanceReport(userId)]);
  const marketValue=Number(dashboard.summary?.marketValue||0),cashBalance=Number(cash.summary?.estimatedBalance||0);
  return {NET_WORTH:marketValue+cashBalance,MARKET_VALUE:marketValue,CASH:cashBalance,DIVIDEND:Number(dividends.summary?.netIncome||0),REALIZED_PROFIT:Number(performance.summary?.realizedProfit||0)};
}
export async function listGoals(userId){
  const [{rows},metrics]=await Promise.all([db.query(`SELECT * FROM investment_goals WHERE user_id=$1 ORDER BY CASE status WHEN 'ACTIVE' THEN 0 WHEN 'COMPLETED' THEN 1 ELSE 2 END,target_date ASC,id DESC`,[userId]),currentMetrics(userId)]);
  const today=new Date().toISOString().slice(0,10);
  const items=rows.map(rowMap).map(g=>{const currentAmount=Number(metrics[g.goalType]||0);const progress=g.targetAmount>0?Math.max(0,Math.min(100,currentAmount/g.targetAmount*100)):0;return {...g,currentAmount,progress,remainingAmount:Math.max(0,g.targetAmount-currentAmount),daysRemaining:Math.ceil((new Date(`${g.targetDate}T00:00:00Z`)-new Date(`${today}T00:00:00Z`))/86400000),isReached:currentAmount>=g.targetAmount};});
  return {items,metrics,summary:{total:items.length,active:items.filter(x=>x.status==='ACTIVE').length,reached:items.filter(x=>x.status==='ACTIVE'&&x.isReached).length,overdue:items.filter(x=>x.status==='ACTIVE'&&!x.isReached&&x.targetDate<today).length}};
}
export async function createGoal(userId,payload){const p=normalize(payload);const {rows}=await db.query(`INSERT INTO investment_goals(user_id,title,goal_type,target_amount,target_date,status,note) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[userId,p.title,p.goalType,p.targetAmount,p.targetDate,p.status,p.note]);return rowMap(rows[0])}
export async function updateGoal(userId,id,payload){const p=normalize(payload);const {rows}=await db.query(`UPDATE investment_goals SET title=$3,goal_type=$4,target_amount=$5,target_date=$6,status=$7,note=$8,updated_at=NOW() WHERE user_id=$1 AND id=$2 RETURNING *`,[userId,id,p.title,p.goalType,p.targetAmount,p.targetDate,p.status,p.note]);if(!rows[0]){const e=new Error("找不到投資目標");e.status=404;throw e}return rowMap(rows[0])}
export async function deleteGoal(userId,id){const r=await db.query(`DELETE FROM investment_goals WHERE user_id=$1 AND id=$2`,[userId,id]);if(!r.rowCount){const e=new Error("找不到投資目標");e.status=404;throw e}}
