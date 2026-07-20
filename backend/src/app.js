import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error.js";
import { notFound } from "./middleware/not-found.js";
import authRouter from "./routes/auth.routes.js";
import healthRouter from "./routes/health.routes.js";
import transactionRouter from "./routes/transaction.routes.js";
import portfolioRouter from "./routes/portfolio.routes.js";
import marketRouter from "./routes/market.routes.js";
import strategyRouter from "./routes/strategy.routes.js";
import alertRouter from "./routes/alert.routes.js";
import backupRouter from "./routes/backup.routes.js";
import snapshotRouter from "./routes/snapshot.routes.js";
import csvRouter from "./routes/csv.routes.js";
import watchlistRouter from "./routes/watchlist.routes.js";
import reportRouter from "./routes/report.routes.js";
import journalRouter from "./routes/journal.routes.js";
import allocationRouter from "./routes/allocation.routes.js";
import dividendRouter from "./routes/dividend.routes.js";
import cashRouter from "./routes/cash.routes.js";
import healthScoreRouter from "./routes/health-score.routes.js";
import dailyBriefRouter from "./routes/daily-brief.routes.js";
import notificationRouter from "./routes/notification.routes.js";
import integrityRouter from "./routes/integrity.routes.js";
import auditRouter from "./routes/audit.routes.js";
import searchRouter from "./routes/search.routes.js";
import opportunityRouter from "./routes/opportunity.routes.js";
import tradePlanRouter from "./routes/trade-plan.routes.js";
import reviewTaskRouter from "./routes/review-task.routes.js";
import dailyRoutineRouter from "./routes/daily-routine.routes.js";
import goalRouter from "./routes/goal.routes.js";
import weeklyReviewRouter from "./routes/weekly-review.routes.js";
import featurePreferenceRouter from "./routes/feature-preference.routes.js";
import displayPreferenceRouter from "./routes/display-preference.routes.js";
import onboardingRouter from "./routes/onboarding.routes.js";
import freshnessRouter from "./routes/freshness.routes.js";
import { auditMutation } from "./middleware/audit.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendPath = path.resolve(__dirname, "../../frontend");

export const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (origin === env.corsOrigin) return callback(null, true);

    try {
      const requestOrigin = new URL(origin);
      const allowedHost = process.env.RENDER_EXTERNAL_HOSTNAME;
      if (allowedHost && requestOrigin.hostname === allowedHost) return callback(null, true);
    } catch {
      // Invalid Origin headers are rejected below.
    }

    return callback(new Error("CORS origin not allowed"));
  }
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use("/api/v1", auditMutation);
app.use(express.static(frontendPath, { extensions: ["html"] }));

app.use("/api/v1/health", healthRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/transactions", transactionRouter);
app.use("/api/v1/portfolio", portfolioRouter);
app.use("/api/v1/market", marketRouter);
app.use("/api/v1/strategy", strategyRouter);
app.use("/api/v1/alerts", alertRouter);
app.use("/api/v1/backup", backupRouter);
app.use("/api/v1/snapshots", snapshotRouter);
app.use("/api/v1/csv", csvRouter);
app.use("/api/v1/watchlist", watchlistRouter);
app.use("/api/v1/reports", reportRouter);
app.use("/api/v1/journal", journalRouter);
app.use("/api/v1/allocation", allocationRouter);
app.use("/api/v1/dividends", dividendRouter);
app.use("/api/v1/cash", cashRouter);
app.use("/api/v1/health-score", healthScoreRouter);
app.use("/api/v1/daily-brief", dailyBriefRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/integrity", integrityRouter);
app.use("/api/v1/audit", auditRouter);
app.use("/api/v1/search", searchRouter);
app.use("/api/v1/opportunities", opportunityRouter);
app.use("/api/v1/trade-plans", tradePlanRouter);
app.use("/api/v1/review-tasks", reviewTaskRouter);
app.use("/api/v1/daily-routine", dailyRoutineRouter);
app.use("/api/v1/goals", goalRouter);
app.use("/api/v1/weekly-review", weeklyReviewRouter);
app.use("/api/v1/feature-preferences", featurePreferenceRouter);
app.use("/api/v1/display-preferences", displayPreferenceRouter);
app.use("/api/v1/onboarding", onboardingRouter);
app.use("/api/v1/freshness", freshnessRouter);

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  return res.sendFile(path.join(frontendPath, "index.html"));
});

app.use(notFound);
app.use(errorHandler);
