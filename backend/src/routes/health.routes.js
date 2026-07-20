import { Router } from "express";
import { checkDatabase } from "../database/db.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res, next) => {
  try {
    const database = await checkDatabase();
    res.json({
      success: true,
      data: {
        status: "ok",
        database: "connected",
        databaseTime: database.now,
        version: "1.0.0"
      },
      message: ""
    });
  } catch (error) {
    next(error);
  }
});
