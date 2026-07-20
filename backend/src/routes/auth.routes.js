import { Router } from "express";
import { login, logout, me, refresh, register, profile, password, sessions, removeSession, removeOtherSessions } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();
router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", authenticate, me);
router.put("/profile", authenticate, profile);
router.put("/password", authenticate, password);
router.get("/sessions", authenticate, sessions);
router.delete("/sessions/:id", authenticate, removeSession);
router.post("/sessions/revoke-others", authenticate, removeOtherSessions);
export default router;
