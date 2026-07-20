import { getAnalysis, getStrategy, saveStrategy } from "../services/strategy.service.js";

export async function strategy(req, res, next) {
  try { res.json({ success: true, strategy: await getStrategy(req.user.id) }); }
  catch (error) { next(error); }
}
export async function updateStrategy(req, res, next) {
  try { res.json({ success: true, strategy: await saveStrategy(req.user.id, req.body) }); }
  catch (error) { next(error); }
}
export async function analysis(req, res, next) {
  try { res.json({ success: true, ...(await getAnalysis(req.user.id)) }); }
  catch (error) { next(error); }
}
