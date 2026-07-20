import { db } from "../database/db.js";

const CATEGORIES=new Set(["REVIEW","PRICE","RISK","RESEARCH","REPORT","OTHER"]);
const STATUSES=new Set(["OPEN","DONE","CANCELLED"]);
const REPEATS=new Set(["NONE","DAILY","WEEKLY","MONTHLY","QUARTERLY"]);
const text=(v,max=500)=>String(v??"").trim().slice(0,max);
function normalize(payload){
  const title=text(payload.title,160); const code=text(payload.code,20).toUpperCase();
  const category=text(payload.category||"REVIEW",30).toUpperCase();
  const status=text(payload.status||"OPEN",12).toUpperCase();
  const repeatRule=text(payload.repeatRule||"NONE",12).toUpperCase();
  const dueDate=text(payload.dueDate,10); const priority=Math.trunc(Number(payload.priority??3));
  if(!title){const e=new Error("請輸入任務名稱");e.status=400;throw e}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)){const e=new Error("到期日期格式不正確");e.status=400;throw e}
  if(!CATEGORIES.has(category)||!STATUSES.has(status)||!REPEATS.has(repeatRule)||priority<1||priority>5){const e=new Error("任務設定不正確");e.status=400;throw e}
  return {title,code,category,status,repeatRule,dueDate,priority,note:text(payload.note,1000)};
}
const map=r=>({id:r.id,title:r.title,code:r.code,category:r.category,dueDate:r.due_date,priority:Number(r.priority),status:r.status,repeatRule:r.repeat_rule,note:r.note,completedAt:r.completed_at,createdAt:r.created_at,updatedAt:r.updated_at});
export async function listReviewTasks(userId){
  const {rows}=await db.query(`SELECT * FROM review_tasks WHERE user_id=$1 ORDER BY CASE status WHEN 'OPEN' THEN 0 WHEN 'DONE' THEN 1 ELSE 2 END,due_date ASC,priority DESC,id DESC`,[userId]);
  const items=rows.map(map),today=new Date().toISOString().slice(0,10);
  return {items,summary:{total:items.length,open:items.filter(x=>x.status==='OPEN').length,overdue:items.filter(x=>x.status==='OPEN'&&x.dueDate<today).length,dueToday:items.filter(x=>x.status==='OPEN'&&x.dueDate===today).length,highPriority:items.filter(x=>x.status==='OPEN'&&x.priority>=4).length}};
}
export async function createReviewTask(userId,payload){const p=normalize(payload);const {rows}=await db.query(`INSERT INTO review_tasks(user_id,title,code,category,due_date,priority,status,repeat_rule,note,completed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,CASE WHEN $7='DONE' THEN NOW() ELSE NULL END) RETURNING *`,[userId,p.title,p.code,p.category,p.dueDate,p.priority,p.status,p.repeatRule,p.note]);return map(rows[0])}
export async function updateReviewTask(userId,id,payload){const p=normalize(payload);const {rows}=await db.query(`UPDATE review_tasks SET title=$3,code=$4,category=$5,due_date=$6,priority=$7,status=$8,repeat_rule=$9,note=$10,completed_at=CASE WHEN $8='DONE' THEN COALESCE(completed_at,NOW()) ELSE NULL END,updated_at=NOW() WHERE user_id=$1 AND id=$2 RETURNING *`,[userId,id,p.title,p.code,p.category,p.dueDate,p.priority,p.status,p.repeatRule,p.note]);if(!rows[0]){const e=new Error('找不到檢查任務');e.status=404;throw e}return map(rows[0])}
export async function deleteReviewTask(userId,id){const r=await db.query(`DELETE FROM review_tasks WHERE user_id=$1 AND id=$2`,[userId,id]);if(!r.rowCount){const e=new Error('找不到檢查任務');e.status=404;throw e}}
