import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { favorite, hidden, list, opened, reorder, resetOrder, resetUsage, restore } from "../controllers/feature-preference.controller.js";
const router=Router(); router.use(authenticate); router.get("/",list); router.put("/order",reorder); router.post("/reset-order",resetOrder); router.post("/reset-usage",resetUsage); router.post("/restore-hidden",restore); router.put("/:key/favorite",favorite); router.put("/:key/hidden",hidden); router.post("/:key/open",opened); export default router;
