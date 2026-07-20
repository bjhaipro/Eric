import { getOpportunities } from "../services/opportunity.service.js";
export async function list(req,res,next){ try { res.json(await getOpportunities(req.user.id)); } catch(error){ next(error); } }
