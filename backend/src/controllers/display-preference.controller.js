import { getDisplayPreference, saveDisplayPreference } from "../services/display-preference.service.js";
export async function get(req,res,next){try{res.json({preference:await getDisplayPreference(req.user.id)})}catch(e){next(e)}}
export async function save(req,res,next){try{res.json({preference:await saveDisplayPreference(req.user.id,req.body)})}catch(e){next(e)}}
