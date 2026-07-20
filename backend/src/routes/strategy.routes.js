import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { analysis, strategy, updateStrategy } from "../controllers/strategy.controller.js";
const router = Router();
router.get("/", authenticate, strategy);
router.put("/", authenticate, updateStrategy);
router.get("/analysis", authenticate, analysis);
export default router;
