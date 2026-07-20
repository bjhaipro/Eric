import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { portfolio } from "../controllers/transaction.controller.js";

const router = Router();
router.get("/", authenticate, portfolio);
export default router;
