import { Router } from "express";
import { performance } from "../controllers/report.controller.js";
import { authenticate } from "../middleware/auth.js";
const router = Router();
router.use(authenticate);
router.get("/performance", performance);
export default router;
