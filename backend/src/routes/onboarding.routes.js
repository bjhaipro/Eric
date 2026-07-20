import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { get, update } from "../controllers/onboarding.controller.js";

const router = Router();
router.use(authenticate);
router.get("/", get);
router.put("/", update);
export default router;
