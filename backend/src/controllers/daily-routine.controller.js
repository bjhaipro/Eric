import { getDailyRoutine, getRoutineHistory, resetDailyRoutine, setRoutineCheck } from "../services/daily-routine.service.js";
export async function getToday(req,res,next){try{res.json(await getDailyRoutine(req.user.id,req.query.date))}catch(e){next(e)}}
export async function updateCheck(req,res,next){try{res.json(await setRoutineCheck(req.user.id,req.body))}catch(e){next(e)}}
export async function reset(req,res,next){try{res.json(await resetDailyRoutine(req.user.id,req.body.date))}catch(e){next(e)}}

export async function history(req,res,next){try{res.json(await getRoutineHistory(req.user.id,req.query.days))}catch(e){next(e)}}
