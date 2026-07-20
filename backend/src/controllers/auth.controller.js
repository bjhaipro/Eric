import { env } from "../config/env.js";
import { db } from "../database/db.js";
import {
  loginUser,
  registerUser,
  revokeRefreshToken,
  rotateRefreshToken,
  updateProfile,
  changePassword,
  listSessions,
  revokeSession,
  revokeOtherSessions
} from "../services/auth.service.js";

const cookieOptions = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: "lax",
  path: "/api/v1/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000
};

function validateCredentials(body, requireName = false) {
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  const name = String(body.name ?? "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return "Email 格式不正確";
  if (password.length < 8 || password.length > 72) return "密碼長度需為 8 到 72 個字元";
  if (requireName && (name.length < 1 || name.length > 100)) return "姓名不可空白且不得超過 100 個字元";
  return null;
}

export async function register(req, res, next) {
  try {
    const validationError = validateCredentials(req.body, true);
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    const user = await registerUser(req.body);
    return res.status(201).json({ success: true, message: "帳號建立成功", user });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const validationError = validateCredentials(req.body);
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    const result = await loginUser({
      ...req.body,
      userAgent: req.get("user-agent") ?? null,
      ipAddress: req.ip
    });
    res.cookie("bjh_refresh", result.refreshToken, cookieOptions);
    return res.json({ success: true, accessToken: result.accessToken, user: result.user });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req, res, next) {
  try {
    const rawToken = req.cookies.bjh_refresh;
    if (!rawToken) return res.status(401).json({ success: false, message: "缺少登入憑證" });
    const result = await rotateRefreshToken(rawToken, {
      userAgent: req.get("user-agent") ?? null,
      ipAddress: req.ip
    });
    res.cookie("bjh_refresh", result.refreshToken, cookieOptions);
    return res.json({ success: true, accessToken: result.accessToken, user: result.user });
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res, next) {
  try {
    await revokeRefreshToken(req.cookies.bjh_refresh);
    res.clearCookie("bjh_refresh", cookieOptions);
    return res.json({ success: true, message: "已安全登出" });
  } catch (error) {
    next(error);
  }
}

export async function me(req, res, next) {
  try {
    const result = await db.query(
      "SELECT id, email, name, last_login_at FROM users WHERE id = $1 AND status = 'active'",
      [req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ success: false, message: "找不到使用者" });
    const user = result.rows[0];
    return res.json({ success: true, user: { ...user, id: String(user.id) } });
  } catch (error) {
    next(error);
  }
}


export async function profile(req, res, next) {
  try { return res.json({ success: true, user: await updateProfile(req.user.id, req.body) }); }
  catch (error) { next(error); }
}

export async function password(req, res, next) {
  try {
    await changePassword(req.user.id, req.body);
    res.clearCookie("bjh_refresh", cookieOptions);
    return res.json({ success: true, message: "密碼已更新，請重新登入" });
  } catch (error) { next(error); }
}

export async function sessions(req, res, next) {
  try { return res.json({ success: true, items: await listSessions(req.user.id) }); }
  catch (error) { next(error); }
}

export async function removeSession(req, res, next) {
  try { await revokeSession(req.user.id, req.params.id); return res.json({ success: true, message: "登入裝置已登出" }); }
  catch (error) { next(error); }
}

export async function removeOtherSessions(req, res, next) {
  try { await revokeOtherSessions(req.user.id, req.cookies.bjh_refresh); return res.json({ success: true, message: "其他裝置已全部登出" }); }
  catch (error) { next(error); }
}
