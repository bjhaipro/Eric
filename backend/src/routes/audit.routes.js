import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { cleanupAudit, getAuditLogs } from "../controllers/audit.controller.js";
const router = Router();
router.use(authenticate);
router.get("/", getAuditLogs);
router.post("/cleanup", cleanupAudit);
export default router;
