import { createTradePlan, deleteTradePlan, listTradePlans, updateTradePlan } from "../services/trade-plan.service.js";
export async function list(req,res,next){try{res.json(await listTradePlans(req.user.id))}catch(e){next(e)}}
export async function create(req,res,next){try{res.status(201).json({item:await createTradePlan(req.user.id,req.body)})}catch(e){next(e)}}
export async function update(req,res,next){try{res.json({item:await updateTradePlan(req.user.id,req.params.id,req.body)})}catch(e){next(e)}}
export async function remove(req,res,next){try{await deleteTradePlan(req.user.id,req.params.id);res.status(204).end()}catch(e){next(e)}}
