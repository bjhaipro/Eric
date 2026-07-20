import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { downloadTransactions, uploadTransactions } from "../controllers/csv.controller.js";

const router = Router();
router.use(authenticate);
router.get("/transactions/export", downloadTransactions);
router.post("/transactions/import", uploadTransactions);
export default router;
