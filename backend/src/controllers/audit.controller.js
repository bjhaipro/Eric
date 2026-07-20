import { cleanupAuditLogs, listAuditLogs } from "../services/audit.service.js";

export async function getAuditLogs(req, res, next) {
  try {
    res.json({ success: true, ...(await listAuditLogs(req.user.id, req.query)) });
  } catch (error) { next(error); }
}

export async function cleanupAudit(req, res, next) {
  try {
    res.json({ success: true, cleanup: await cleanupAuditLogs(req.user.id, req.body?.retentionDays) });
  } catch (error) { next(error); }
}
