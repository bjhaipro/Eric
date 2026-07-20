import { db } from "../database/db.js";
import { getDailyBrief } from "./daily-brief.service.js";

const fingerprint = (item) => [item.category || "", item.code || "", item.title || "", item.detail || ""].join("|");

export async function syncNotifications(userId) {
  const brief = await getDailyBrief(userId);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    for (const item of brief.actions || []) {
      await client.query(
        `INSERT INTO notifications (user_id, fingerprint, severity, category, code, title, detail, source, occurred_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'DAILY_BRIEF',NOW())
         ON CONFLICT (user_id, fingerprint)
         DO UPDATE SET severity=EXCLUDED.severity, category=EXCLUDED.category, code=EXCLUDED.code,
           title=EXCLUDED.title, detail=EXCLUDED.detail, occurred_at=NOW(), dismissed_at=NULL`,
        [userId, fingerprint(item), item.type, item.category, item.code, item.title, item.detail]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return listNotifications(userId);
}

export async function listNotifications(userId, { unreadOnly = false, limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const params = [userId, safeLimit];
  const unreadClause = unreadOnly ? "AND read_at IS NULL" : "";
  const { rows } = await db.query(
    `SELECT id, severity, category, code, title, detail, source,
            occurred_at AS "occurredAt", read_at AS "readAt", dismissed_at AS "dismissedAt"
     FROM notifications
     WHERE user_id=$1 AND dismissed_at IS NULL ${unreadClause}
     ORDER BY CASE severity WHEN 'urgent' THEN 3 WHEN 'important' THEN 2 ELSE 1 END DESC,
              occurred_at DESC, id DESC
     LIMIT $2`,
    params
  );
  const summaryResult = await db.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE read_at IS NULL)::int AS unread,
            COUNT(*) FILTER (WHERE severity='urgent' AND read_at IS NULL)::int AS urgent
     FROM notifications WHERE user_id=$1 AND dismissed_at IS NULL`,
    [userId]
  );
  return { items: rows, summary: summaryResult.rows[0] };
}

export async function markNotificationRead(userId, id, read = true) {
  const { rows } = await db.query(
    `UPDATE notifications SET read_at=CASE WHEN $3 THEN NOW() ELSE NULL END
     WHERE id=$1 AND user_id=$2 AND dismissed_at IS NULL
     RETURNING id, read_at AS "readAt"`,
    [id, userId, Boolean(read)]
  );
  if (!rows[0]) { const error = new Error("找不到通知"); error.status = 404; throw error; }
  return rows[0];
}

export async function markAllRead(userId) {
  const result = await db.query(
    `UPDATE notifications SET read_at=NOW()
     WHERE user_id=$1 AND dismissed_at IS NULL AND read_at IS NULL`, [userId]
  );
  return { updated: result.rowCount };
}

export async function dismissNotification(userId, id) {
  const result = await db.query(
    `UPDATE notifications SET dismissed_at=NOW() WHERE id=$1 AND user_id=$2 AND dismissed_at IS NULL`,
    [id, userId]
  );
  if (!result.rowCount) { const error = new Error("找不到通知"); error.status = 404; throw error; }
  return { id: Number(id) };
}
