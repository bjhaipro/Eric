import { writeAuditLog } from "../services/audit.service.js";

export function auditMutation(req, res, next) {
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  const isBackupExport = req.method === "GET" && req.originalUrl.startsWith("/api/v1/backup/export");
  if (!isMutation && !isBackupExport) return next();
  if (req.originalUrl.startsWith("/api/v1/alerts/evaluate")) return next();
  res.once("finish", () => {
    writeAuditLog({
      userId: req.user?.id,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      ipAddress: req.ip,
      userAgent: req.get("user-agent")
    }).catch((error) => console.error("audit log failed", error.message));
  });
  next();
}
