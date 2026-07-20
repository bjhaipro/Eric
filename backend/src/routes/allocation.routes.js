import { Router } from "express";
import { analysis, remove, save } from "../controllers/allocation.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();
router.use(authenticate);
router.get("/analysis", analysis);
router.put("/:code", save);
router.delete("/:code", remove);
export default router;
