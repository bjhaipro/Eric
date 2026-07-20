import { Router } from "express";
import { create, list, remove, update } from "../controllers/dividend.controller.js";
import { authenticate } from "../middleware/auth.js";
const router=Router(); router.use(authenticate); router.get("/",list); router.post("/",create); router.put("/:id",update); router.delete("/:id",remove); export default router;
