import { inspectIntegrity, runMaintenance } from "../services/integrity.service.js";
export async function getIntegrity(req, res, next) {
  try { res.json({ success: true, ...(await inspectIntegrity(req.user.id)) }); } catch (error) { next(error); }
}
export async function maintainIntegrity(req, res, next) {
  try { res.json({ success: true, maintenance: await runMaintenance(req.user.id), report: await inspectIntegrity(req.user.id) }); } catch (error) { next(error); }
}
