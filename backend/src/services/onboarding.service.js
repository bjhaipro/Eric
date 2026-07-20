import { db } from "../database/db.js";

const steps = [
  {
    key: "transaction",
    title: "新增第一筆交易",
    detail: "輸入買進或賣出紀錄，建立持股資料。",
    target: "trade",
    check: (counts) => counts.transactions > 0
  },
  {
    key: "quote",
    title: "輸入目前股價",
    detail: "加入股價後，才能計算市值與未實現損益。",
    target: "trade",
    check: (counts) => counts.quotes > 0
  },
  {
    key: "strategy",
    title: "設定投資策略",
    detail: "設定目標獲利、停損與持股集中度上限。",
    target: "research",
    check: (counts) => counts.strategy > 0
  },
  {
    key: "watchlist",
    title: "建立觀察清單",
    detail: "加入想追蹤的股票與目標買進價。",
    target: "research",
    check: (counts) => counts.watchlist > 0
  },
  {
    key: "routine",
    title: "開始每日盤前／盤後檢查",
    detail: "完成至少一個每日檢查項目。",
    target: "today",
    check: (counts) => counts.routine > 0
  },
  {
    key: "backup",
    title: "完成第一次備份",
    detail: "下載完整備份，保留交易與設定資料。",
    target: "system",
    check: (counts) => counts.backups > 0
  }
];

export async function getOnboarding(userId) {
  const result = await db.query(`
    SELECT
      (SELECT COUNT(*)::int FROM transactions WHERE user_id=$1) AS transactions,
      (SELECT COUNT(*)::int FROM market_quotes WHERE user_id=$1) AS quotes,
      (SELECT COUNT(*)::int FROM user_strategies WHERE user_id=$1) AS strategy,
      (SELECT COUNT(*)::int FROM watchlist_items WHERE user_id=$1) AS watchlist,
      (SELECT COUNT(*)::int FROM daily_routine_checks WHERE user_id=$1 AND completed=TRUE) AS routine,
      (SELECT COUNT(*)::int FROM audit_logs
         WHERE user_id=$1 AND resource='/api/v1/backup/export' AND status_code BETWEEN 200 AND 299) AS backups,
      COALESCE((SELECT is_dismissed FROM user_onboarding_preferences WHERE user_id=$1), FALSE) AS dismissed
  `, [userId]);

  const counts = result.rows[0];
  const items = steps.map((step) => ({
    key: step.key,
    title: step.title,
    detail: step.detail,
    target: step.target,
    completed: step.check(counts)
  }));
  const completed = items.filter((item) => item.completed).length;

  return {
    dismissed: Boolean(counts.dismissed),
    completed,
    total: items.length,
    progress: Math.round((completed / items.length) * 100),
    finished: completed === items.length,
    items
  };
}

export async function setOnboardingDismissed(userId, dismissed) {
  await db.query(`
    INSERT INTO user_onboarding_preferences(user_id,is_dismissed)
    VALUES($1,$2)
    ON CONFLICT(user_id) DO UPDATE SET
      is_dismissed=EXCLUDED.is_dismissed,
      updated_at=NOW()
  `, [userId, Boolean(dismissed)]);
  return getOnboarding(userId);
}
