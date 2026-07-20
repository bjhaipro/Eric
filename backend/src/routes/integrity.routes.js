import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { getIntegrity, maintainIntegrity } from "../controllers/integrity.controller.js";
const router = Router();
router.use(authenticate);
router.get("/", getIntegrity);
router.post("/maintenance", maintainIntegrity);
export default router;
