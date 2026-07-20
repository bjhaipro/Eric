import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { getReview } from "../controllers/weekly-review.controller.js";
const router=Router();router.use(authenticate);router.get("/",getReview);export default router;
