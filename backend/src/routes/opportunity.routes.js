import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { list } from "../controllers/opportunity.controller.js";
const router=Router();
router.use(authenticate);
router.get("/",list);
export default router;
