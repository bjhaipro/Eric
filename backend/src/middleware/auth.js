import { verifyAccessToken } from "../utils/tokens.js";

export function authenticate(req, res, next) {
  const header = req.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ success: false, message: "請先登入" });
  }
  try {
    const payload = verifyAccessToken(token);
    if (payload.type !== "access") throw new Error("Invalid token type");
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ success: false, message: "登入憑證已過期或無效" });
  }
}
