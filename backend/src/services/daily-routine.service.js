import { db } from "../database/db.js";

const TEMPLATES = {
  PREMARKET: [
    ["market_news","確認市場與 AI 產業重大消息"],
    ["holdings_risk","查看持股風險與價格提醒"],
    ["trade_plan","確認今日交易計畫與停損價"],
    ["cash_check","確認可用資金，不追價下單"]
  ],
  POSTMARKET: [
    ["update_quotes","更新持股與觀察清單價格"],
    ["record_trades","補登今日買賣交易"],
    ["review_result","檢查損益、提醒與異常持股"],
    ["save_snapshot","儲存今日資產快照與日誌"]
  ]
};
const dateText=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||""))?String(v):new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Taipei"});
export async function getDailyRoutine(userId,date){
  const routineDate=dateText(date);
  const {rows}=await db.query(`SELECT period,item_key,completed,completed_at FROM daily_routine_checks WHERE user_id=$1 AND routine_date=$2`,[userId,routineDate]);
  const saved=new Map(rows.map(x=>[`${x.period}:${x.item_key}`,x]));
  const groups=Object.entries(TEMPLATES).map(([period,items])=>({period,items:items.map(([key,title])=>{const x=saved.get(`${period}:${key}`);return {key,title,completed:Boolean(x?.completed),completedAt:x?.completed_at||null}})}));
  const all=groups.flatMap(x=>x.items),done=all.filter(x=>x.completed).length;
  return {date:routineDate,groups,summary:{total:all.length,completed:done,remaining:all.length-done,progress:all.length?Math.round(done/all.length*100):0}};
}
export async function setRoutineCheck(userId,payload){
  const routineDate=dateText(payload.date),period=String(payload.period||"").toUpperCase(),itemKey=String(payload.itemKey||"");
  if(!TEMPLATES[period]?.some(([key])=>key===itemKey)){const e=new Error("檢查項目不正確");e.status=400;throw e}
  const completed=payload.completed!==false;
  await db.query(`INSERT INTO daily_routine_checks(user_id,routine_date,period,item_key,completed,completed_at) VALUES($1,$2,$3,$4,$5,CASE WHEN $5 THEN NOW() ELSE NULL END) ON CONFLICT(user_id,routine_date,period,item_key) DO UPDATE SET completed=EXCLUDED.completed,completed_at=CASE WHEN EXCLUDED.completed THEN NOW() ELSE NULL END,updated_at=NOW()`,[userId,routineDate,period,itemKey,completed]);
  return getDailyRoutine(userId,routineDate);
}
export async function resetDailyRoutine(userId,date){const routineDate=dateText(date);await db.query(`DELETE FROM daily_routine_checks WHERE user_id=$1 AND routine_date=$2`,[userId,routineDate]);return getDailyRoutine(userId,routineDate)}


export async function getRoutineHistory(userId, days = 30) {
  const safeDays = Math.min(365, Math.max(7, Number(days) || 30));
  const { rows } = await db.query(`
    WITH dates AS (
      SELECT generate_series(
        (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::date - ($2::int - 1),
        (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::date,
        interval '1 day'
      )::date AS routine_date
    ), completed AS (
      SELECT routine_date,
        COUNT(*) FILTER (WHERE completed)::int AS completed_count,
        COUNT(*) FILTER (WHERE completed AND period='PREMARKET')::int AS premarket_count,
        COUNT(*) FILTER (WHERE completed AND period='POSTMARKET')::int AS postmarket_count
      FROM daily_routine_checks
      WHERE user_id=$1
        AND routine_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::date - ($2::int - 1)
      GROUP BY routine_date
    )
    SELECT d.routine_date,
      COALESCE(c.completed_count,0)::int AS completed_count,
      COALESCE(c.premarket_count,0)::int AS premarket_count,
      COALESCE(c.postmarket_count,0)::int AS postmarket_count
    FROM dates d LEFT JOIN completed c USING(routine_date)
    ORDER BY d.routine_date DESC
  `,[userId,safeDays]);
  const items=rows.map(r=>({date:String(r.routine_date).slice(0,10),completed:r.completed_count,total:8,progress:Math.round(r.completed_count/8*100),premarketCompleted:r.premarket_count,postmarketCompleted:r.postmarket_count,fullyCompleted:r.completed_count===8}));
  let currentStreak=0; for(const item of items){if(item.fullyCompleted)currentStreak++;else break;}
  let bestStreak=0,run=0; for(const item of [...items].reverse()){run=item.fullyCompleted?run+1:0;bestStreak=Math.max(bestStreak,run);}
  const completedDays=items.filter(x=>x.fullyCompleted).length;
  const averageProgress=items.length?Math.round(items.reduce((sum,x)=>sum+x.progress,0)/items.length):0;
  return {days:safeDays,summary:{completedDays,currentStreak,bestStreak,averageProgress},items};
}
