import { deleteSnapshots, listSnapshots, saveTodaySnapshot } from "../services/snapshot.service.js";

export async function saveToday(req, res, next) {
  try { res.json({ success: true, snapshot: await saveTodaySnapshot(req.user.id) }); }
  catch (error) { next(error); }
}

export async function history(req, res, next) {
  try { res.json({ success: true, ...(await listSnapshots(req.user.id, req.query.days)) }); }
  catch (error) { next(error); }
}

export async function clear(req, res, next) {
  try { res.json({ success: true, deleted: await deleteSnapshots(req.user.id) }); }
  catch (error) { next(error); }
}
