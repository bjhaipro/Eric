import { searchUserData } from "../services/search.service.js";

export async function search(req, res, next) {
  try {
    res.json({ success: true, ...(await searchUserData(req.user.id, req.query)) });
  } catch (error) { next(error); }
}
