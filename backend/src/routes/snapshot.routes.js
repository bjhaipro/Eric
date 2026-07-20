import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { clear, history, saveToday } from "../controllers/snapshot.controller.js";

const router = Router();
router.use(authenticate);
router.get("/", history);
router.post("/today", saveToday);
router.delete("/", clear);
export default router;
