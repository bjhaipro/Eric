import { getPerformanceReport } from "../services/report.service.js";
export async function performance(req, res, next) {
  try { res.json({ success: true, ...(await getPerformanceReport(req.user.id)) }); }
  catch (error) { next(error); }
}
