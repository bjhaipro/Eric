import { getDailyBrief } from "../services/daily-brief.service.js";
export async function getBrief(req, res, next) {
  try { res.json({ success: true, ...(await getDailyBrief(req.user.id)) }); }
  catch (error) { next(error); }
}
