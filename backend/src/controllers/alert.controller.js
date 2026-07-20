import { createAlert, deleteAlert, evaluateAlerts, listAlerts, updateAlert } from "../services/alert.service.js";

export async function list(req, res, next) { try { res.json({ success: true, alerts: await listAlerts(req.user.id) }); } catch (e) { next(e); } }
export async function create(req, res, next) { try { res.status(201).json({ success: true, alert: await createAlert(req.user.id, req.body) }); } catch (e) { next(e); } }
export async function update(req, res, next) { try { res.json({ success: true, alert: await updateAlert(req.user.id, req.params.id, req.body) }); } catch (e) { next(e); } }
export async function remove(req, res, next) { try { await deleteAlert(req.user.id, req.params.id); res.status(204).end(); } catch (e) { next(e); } }
export async function evaluate(req, res, next) { try { res.json({ success: true, ...(await evaluateAlerts(req.user.id)) }); } catch (e) { next(e); } }
