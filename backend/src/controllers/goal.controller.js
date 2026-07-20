import { createGoal, deleteGoal, listGoals, updateGoal } from "../services/goal.service.js";
export async function list(req,res,next){try{res.json(await listGoals(req.user.id))}catch(e){next(e)}}
export async function create(req,res,next){try{res.status(201).json({item:await createGoal(req.user.id,req.body)})}catch(e){next(e)}}
export async function update(req,res,next){try{res.json({item:await updateGoal(req.user.id,req.params.id,req.body)})}catch(e){next(e)}}
export async function remove(req,res,next){try{await deleteGoal(req.user.id,req.params.id);res.status(204).end()}catch(e){next(e)}}
