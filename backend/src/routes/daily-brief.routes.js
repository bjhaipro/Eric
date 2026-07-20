import { Router } from "express";
import { getBrief } from "../controllers/daily-brief.controller.js";
import { authenticate } from "../middleware/auth.js";
const router = Router();
router.use(authenticate);
router.get("/", getBrief);
export default router;
