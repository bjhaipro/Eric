import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { download, restore } from "../controllers/backup.controller.js";

const router = Router();
router.use(authenticate);
router.get("/export", download);
router.post("/import", restore);
export default router;
