import { getWeeklyReview } from "../services/weekly-review.service.js";
export async function getReview(req,res,next){try{res.json(await getWeeklyReview(req.user.id));}catch(error){next(error);}}
