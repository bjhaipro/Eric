import bcrypt from "bcryptjs";
import { db } from "../database/db.js";
import {
  createAccessToken,
  createRefreshToken,
  hashToken,
  newTokenId,
  verifyRefreshToken
} from "../utils/tokens.js";

const HASH_ROUNDS = 12;

function publicUser(row) {
  return { id: String(row.id), email: row.email, name: row.name };
}

export async function registerUser({ email, password, name }) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await db.query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
  if (existing.rowCount) {
    const error = new Error("Email 已經註冊");
    error.status = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, HASH_ROUNDS);
  const result = await db.query(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3)
     RETURNING id, email, name`,
    [normalizedEmail, passwordHash, name.trim()]
  );
  return publicUser(result.rows[0]);
}

export async function loginUser({ email, password, userAgent = null, ipAddress = null }) {
  const normalizedEmail = email.trim().toLowerCase();
  const result = await db.query(
    `SELECT id, email, name, password_hash, status
       FROM users
      WHERE email = $1`,
    [normalizedEmail]
  );
  const user = result.rows[0];
  const valid = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!valid || user.status !== "active") {
    const error = new Error("帳號或密碼錯誤");
    error.status = 401;
    throw error;
  }

  const tokenId = newTokenId();
  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user, tokenId);
  const decoded = verifyRefreshToken(refreshToken);

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO refresh_tokens
       (id, user_id, token_hash, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, to_timestamp($4), $5, $6)`,
      [tokenId, user.id, hashToken(refreshToken), decoded.exp, userAgent, ipAddress]
    );
    await client.query("UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1", [user.id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return { user: publicUser(user), accessToken, refreshToken };
}

export async function rotateRefreshToken(rawToken, { userAgent = null, ipAddress = null } = {}) {
  let payload;
  try {
    payload = verifyRefreshToken(rawToken);
  } catch {
    const error = new Error("登入狀態已失效，請重新登入");
    error.status = 401;
    throw error;
  }

  const result = await db.query(
    `SELECT rt.id, rt.user_id, rt.token_hash, rt.revoked_at,
            u.email, u.name, u.status
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
      WHERE rt.id = $1 AND rt.expires_at > NOW()`,
    [payload.jti]
  );
  const session = result.rows[0];
  if (!session || session.revoked_at || session.token_hash !== hashToken(rawToken) || session.status !== "active") {
    const error = new Error("登入狀態已失效，請重新登入");
    error.status = 401;
    throw error;
  }

  const user = { id: session.user_id, email: session.email, name: session.name };
  const nextId = newTokenId();
  const nextRefreshToken = createRefreshToken(user, nextId);
  const decoded = verifyRefreshToken(nextRefreshToken);

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by = $2 WHERE id = $1", [session.id, nextId]);
    await client.query(
      `INSERT INTO refresh_tokens
       (id, user_id, token_hash, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, to_timestamp($4), $5, $6)`,
      [nextId, user.id, hashToken(nextRefreshToken), decoded.exp, userAgent, ipAddress]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return {
    user: publicUser(user),
    accessToken: createAccessToken(user),
    refreshToken: nextRefreshToken
  };
}

export async function revokeRefreshToken(rawToken) {
  if (!rawToken) return;
  try {
    const payload = verifyRefreshToken(rawToken);
    await db.query(
      "UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE id = $1 AND token_hash = $2",
      [payload.jti, hashToken(rawToken)]
    );
  } catch {
    // Logout remains idempotent even for expired or malformed tokens.
  }
}


export async function updateProfile(userId, { name }) {
  const cleanName = String(name ?? "").trim();
  if (!cleanName || cleanName.length > 100) {
    const error = new Error("姓名不可空白且不得超過 100 個字元"); error.status = 400; throw error;
  }
  const result = await db.query(
    `UPDATE users SET name = $2, updated_at = NOW() WHERE id = $1 AND status = 'active' RETURNING id, email, name, last_login_at`,
    [userId, cleanName]
  );
  if (!result.rowCount) { const error = new Error("找不到使用者"); error.status = 404; throw error; }
  return { ...result.rows[0], id: String(result.rows[0].id) };
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  if (String(newPassword ?? "").length < 8 || String(newPassword ?? "").length > 72) {
    const error = new Error("新密碼長度需為 8 到 72 個字元"); error.status = 400; throw error;
  }
  const result = await db.query("SELECT password_hash FROM users WHERE id = $1 AND status = 'active'", [userId]);
  if (!result.rowCount || !(await bcrypt.compare(String(currentPassword ?? ""), result.rows[0].password_hash))) {
    const error = new Error("目前密碼不正確"); error.status = 401; throw error;
  }
  if (await bcrypt.compare(String(newPassword), result.rows[0].password_hash)) {
    const error = new Error("新密碼不可與目前密碼相同"); error.status = 400; throw error;
  }
  const passwordHash = await bcrypt.hash(String(newPassword), HASH_ROUNDS);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1", [userId, passwordHash]);
    await client.query("UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE user_id = $1", [userId]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function listSessions(userId) {
  const result = await db.query(
    `SELECT id, user_agent, host(ip_address) AS ip_address, created_at, expires_at, revoked_at
       FROM refresh_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30`, [userId]
  );
  return result.rows.map((row) => ({
    id: row.id, userAgent: row.user_agent || "未知裝置", ipAddress: row.ip_address || "未知",
    createdAt: row.created_at, expiresAt: row.expires_at, active: !row.revoked_at && new Date(row.expires_at) > new Date()
  }));
}

export async function revokeSession(userId, sessionId) {
  const result = await db.query(
    `UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE id = $1 AND user_id = $2 RETURNING id`,
    [sessionId, userId]
  );
  if (!result.rowCount) { const error = new Error("找不到登入裝置"); error.status = 404; throw error; }
}

export async function revokeOtherSessions(userId, currentRawToken) {
  let currentId = null;
  try { currentId = currentRawToken ? verifyRefreshToken(currentRawToken).jti : null; } catch {}
  if (currentId) {
    await db.query(`UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE user_id = $1 AND id <> $2`, [userId, currentId]);
  } else {
    await db.query(`UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE user_id = $1`, [userId]);
  }
}
