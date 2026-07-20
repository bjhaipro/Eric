import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { get, save } from "../controllers/display-preference.controller.js";
const router=Router(); router.use(authenticate); router.get("/",get); router.put("/",save); export default router;
