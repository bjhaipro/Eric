import { getPortfolioHealth } from "../services/health.service.js";
export async function getHealth(req, res, next) {
  try { res.json({ success: true, ...(await getPortfolioHealth(req.user.id)) }); }
  catch (error) { next(error); }
}
