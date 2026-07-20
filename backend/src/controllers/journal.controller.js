import { createJournalEntry, deleteJournalEntry, listJournalEntries, updateJournalEntry } from "../services/journal.service.js";

export async function list(req, res, next) {
  try { res.json({ success: true, ...(await listJournalEntries(req.user.id, req.query)) }); }
  catch (error) { next(error); }
}
export async function create(req, res, next) {
  try { res.status(201).json({ success: true, entry: await createJournalEntry(req.user.id, req.body) }); }
  catch (error) { next(error); }
}
export async function update(req, res, next) {
  try { res.json({ success: true, entry: await updateJournalEntry(req.user.id, req.params.id, req.body) }); }
  catch (error) { next(error); }
}
export async function remove(req, res, next) {
  try { await deleteJournalEntry(req.user.id, req.params.id); res.status(204).end(); }
  catch (error) { next(error); }
}
