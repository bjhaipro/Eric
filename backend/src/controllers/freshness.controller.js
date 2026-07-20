import { getFreshness, saveFreshnessPreference } from "../services/freshness.service.js";

export async function get(req, res, next) {
  try {
    res.json(await getFreshness(req.user.id));
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    res.json(await saveFreshnessPreference(req.user.id, req.body));
  } catch (error) {
    next(error);
  }
}
