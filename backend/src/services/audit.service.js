import { db } from "../database/db.js";

const ACTION_LABELS = {
  GET: "下載",
  POST: "新增",
  PUT: "修改",
  PATCH: "修改",
  DELETE: "刪除"
};

function cleanPath(path = "") {
  return path.replace(/\?.*$/, "").slice(0, 240);
}

export async function writeAuditLog({ userId, method, path, statusCode, ipAddress, userAgent }) {
  if (!userId || !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) return;
  const resource = cleanPath(path);
  await db.query(
    `INSERT INTO audit_logs
      (user_id, action, method, resource, status_code, ip_address, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [userId, ACTION_LABELS[method] || method, method, resource, statusCode, ipAddress || null, String(userAgent || "").slice(0, 500)]
  );
}

export async function listAuditLogs(userId, { days = 30, limit = 100 } = {}) {
  const safeDays = Math.min(Math.max(Number(days) || 30, 1), 365);
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const result = await db.query(
    `SELECT id, action, method, resource, status_code AS "statusCode",
            COALESCE(ip_address::text, '') AS "ipAddress",
            COALESCE(user_agent, '') AS "userAgent", created_at AS "createdAt"
       FROM audit_logs
      WHERE user_id=$1 AND created_at >= NOW() - ($2::int * INTERVAL '1 day')
      ORDER BY created_at DESC, id DESC
      LIMIT $3`,
    [userId, safeDays, safeLimit]
  );
  const summaryResult = await db.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status_code >= 400)::int AS failed,
            COUNT(*) FILTER (WHERE method='DELETE')::int AS deleted,
            COUNT(DISTINCT DATE(created_at))::int AS "activeDays"
       FROM audit_logs
      WHERE user_id=$1 AND created_at >= NOW() - ($2::int * INTERVAL '1 day')`,
    [userId, safeDays]
  );
  return { days: safeDays, items: result.rows, summary: summaryResult.rows[0] };
}

export async function cleanupAuditLogs(userId, retentionDays = 180) {
  const safeDays = Math.min(Math.max(Number(retentionDays) || 180, 30), 730);
  const result = await db.query(
    `DELETE FROM audit_logs WHERE user_id=$1 AND created_at < NOW() - ($2::int * INTERVAL '1 day')`,
    [userId, safeDays]
  );
  return { removed: result.rowCount, retentionDays: safeDays };
}
