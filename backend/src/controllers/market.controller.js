import { batchUpsertQuotes, listQuotes, quoteHistory, upsertQuote } from "../services/market.service.js";
import { getDashboard } from "../services/dashboard.service.js";

export async function saveQuote(req, res, next) {
  try { res.json({ success: true, quote: await upsertQuote(req.user.id, req.body) }); }
  catch (error) { next(error); }
}
export async function saveQuotes(req, res, next) {
  try { const quotes = await batchUpsertQuotes(req.user.id, req.body.quotes); res.json({ success:true, count:quotes.length, quotes }); }
  catch (error) { next(error); }
}
export async function quotes(req, res, next) {
  try { res.json({ success: true, quotes: await listQuotes(req.user.id) }); }
  catch (error) { next(error); }
}
export async function history(req, res, next) {
  try { res.json({ success:true, code:req.params.code.toUpperCase(), history:await quoteHistory(req.user.id, req.params.code, req.query.limit) }); }
  catch (error) { next(error); }
}
export async function dashboard(req, res, next) {
  try { res.json({ success: true, ...(await getDashboard(req.user.id)) }); }
  catch (error) { next(error); }
}
