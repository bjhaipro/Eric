import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { create, list, remove, update } from "../controllers/transaction.controller.js";

const router = Router();
router.use(authenticate);
router.get("/", list);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);
export default router;
