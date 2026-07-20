import { Router } from "express";
import { getHealth } from "../controllers/health.controller.js";
import { authenticate } from "../middleware/auth.js";
const router = Router();
router.use(authenticate);
router.get("/", getHealth);
export default router;
