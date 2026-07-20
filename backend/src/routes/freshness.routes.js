import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { get, update } from "../controllers/freshness.controller.js";

const router = Router();
router.use(authenticate);
router.get("/", get);
router.put("/preferences", update);
export default router;
