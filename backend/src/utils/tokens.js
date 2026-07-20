import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function createAccessToken(user) {
  return jwt.sign(
    { sub: String(user.id), email: user.email, type: "access" },
    env.jwtAccessSecret,
    { expiresIn: env.accessTokenTtl, issuer: "bjh-ai-pro", audience: "bjh-ai-pro-web" }
  );
}

export function createRefreshToken(user, tokenId) {
  return jwt.sign(
    { sub: String(user.id), jti: tokenId, type: "refresh" },
    env.jwtRefreshSecret,
    { expiresIn: env.refreshTokenTtl, issuer: "bjh-ai-pro", audience: "bjh-ai-pro-web" }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtAccessSecret, {
    issuer: "bjh-ai-pro",
    audience: "bjh-ai-pro-web"
  });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwtRefreshSecret, {
    issuer: "bjh-ai-pro",
    audience: "bjh-ai-pro-web"
  });
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function newTokenId() {
  return crypto.randomUUID();
}
