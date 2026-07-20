import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { getToday, history, reset, updateCheck } from "../controllers/daily-routine.controller.js";
const router=Router();router.use(authenticate);router.get("/today",getToday);router.get("/history",history);router.put("/check",updateCheck);router.post("/reset",reset);export default router;
