import { createDividend, deleteDividend, listDividends, updateDividend } from "../services/dividend.service.js";
export async function list(req,res,next){try{res.json({success:true,...await listDividends(req.user.id,req.query)});}catch(e){next(e)}}
export async function create(req,res,next){try{res.status(201).json({success:true,item:await createDividend(req.user.id,req.body)});}catch(e){next(e)}}
export async function update(req,res,next){try{res.json({success:true,item:await updateDividend(req.user.id,req.params.id,req.body)});}catch(e){next(e)}}
export async function remove(req,res,next){try{await deleteDividend(req.user.id,req.params.id);res.status(204).end();}catch(e){next(e)}}
