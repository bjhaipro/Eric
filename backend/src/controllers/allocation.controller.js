import { deleteAllocationTarget, getAllocationAnalysis, saveAllocationTarget } from "../services/allocation.service.js";

export async function analysis(req, res, next) {
  try { res.json({ success: true, ...(await getAllocationAnalysis(req.user.id)) }); }
  catch (error) { next(error); }
}
export async function save(req, res, next) {
  try { res.json({ success: true, target: await saveAllocationTarget(req.user.id, { ...req.body, code: req.params.code }) }); }
  catch (error) { next(error); }
}
export async function remove(req, res, next) {
  try { await deleteAllocationTarget(req.user.id, req.params.code); res.status(204).end(); }
  catch (error) { next(error); }
}
