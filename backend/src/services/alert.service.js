import { db } from "../database/db.js";

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });
const notFound = (message) => Object.assign(new Error(message), { status: 404 });

function normalize(input) {
  const code = String(input.code ?? "").trim().toUpperCase();
  const name = String(input.name ?? "").trim().slice(0, 100);
  const direction = String(input.direction ?? "").trim().toUpperCase();
  const targetPrice = Number(input.targetPrice);
  if (!/^[A-Z0-9.-]{1,20}$/.test(code)) throw badRequest("股票代碼格式不正確");
  if (!["ABOVE", "BELOW"].includes(direction)) throw badRequest("提醒方向必須是 ABOVE 或 BELOW");
  if (!Number.isFinite(targetPrice) || targetPrice <= 0) throw badRequest("提醒價格必須大於 0");
  return { code, name, direction, targetPrice: Number(targetPrice.toFixed(4)) };
}

const selectFields = `id, code, name, direction, target_price::float8 AS "targetPrice",
  enabled, triggered_at AS "triggeredAt", last_seen_price::float8 AS "lastSeenPrice",
  created_at AS "createdAt", updated_at AS "updatedAt"`;

export async function listAlerts(userId) {
  const result = await db.query(`SELECT ${selectFields} FROM price_alerts WHERE user_id=$1 ORDER BY enabled DESC, code, id DESC`, [userId]);
  return result.rows;
}

export async function createAlert(userId, input) {
  const a = normalize(input);
  const result = await db.query(`INSERT INTO price_alerts (user_id, code, name, direction, target_price)
    VALUES ($1,$2,$3,$4,$5) RETURNING ${selectFields}`,
    [userId, a.code, a.name, a.direction, a.targetPrice]);
  return result.rows[0];
}

export async function updateAlert(userId, id, input) {
  const a = normalize(input);
  const enabled = input.enabled !== false;
  const result = await db.query(`UPDATE price_alerts SET code=$3, name=$4, direction=$5, target_price=$6,
    enabled=$7, triggered_at=CASE WHEN enabled<>$7 OR target_price<>$6 OR direction<>$5 THEN NULL ELSE triggered_at END,
    updated_at=NOW() WHERE id=$2 AND user_id=$1 RETURNING ${selectFields}`,
    [userId, id, a.code, a.name, a.direction, a.targetPrice, enabled]);
  if (!result.rows[0]) throw notFound("找不到價格提醒");
  return result.rows[0];
}

export async function deleteAlert(userId, id) {
  const result = await db.query("DELETE FROM price_alerts WHERE id=$2 AND user_id=$1 RETURNING id", [userId, id]);
  if (!result.rows[0]) throw notFound("找不到價格提醒");
}

export async function evaluateAlerts(userId) {
  const result = await db.query(`WITH evaluated AS (
    SELECT a.id, q.price,
      CASE WHEN a.direction='ABOVE' THEN q.price >= a.target_price ELSE q.price <= a.target_price END AS hit
    FROM price_alerts a
    LEFT JOIN market_quotes q ON q.user_id=a.user_id AND q.code=a.code
    WHERE a.user_id=$1 AND a.enabled=TRUE
  )
  UPDATE price_alerts a SET
    last_seen_price=e.price,
    triggered_at=CASE WHEN e.hit AND a.triggered_at IS NULL THEN NOW() WHEN NOT e.hit THEN NULL ELSE a.triggered_at END,
    updated_at=NOW()
  FROM evaluated e WHERE a.id=e.id
  RETURNING ${selectFields}`,[userId]);
  const all = await listAlerts(userId);
  return {
    alerts: all,
    triggered: all.filter((a) => a.enabled && a.triggeredAt),
    summary: {
      total: all.length,
      enabled: all.filter((a) => a.enabled).length,
      triggered: all.filter((a) => a.enabled && a.triggeredAt).length,
      waitingPrice: all.filter((a) => a.enabled && a.lastSeenPrice == null).length
    }
  };
}
