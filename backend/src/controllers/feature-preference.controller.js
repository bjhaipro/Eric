import { listFeaturePreferences, recordFeatureOpen, resetFeatureUsage, restoreAllFeatures, resetFeatureOrder, saveFeatureOrder, setFeatureFavorite, setFeatureHidden } from "../services/feature-preference.service.js";
export async function list(req,res,next){try{res.json(await listFeaturePreferences(req.user.id))}catch(e){next(e)}}
export async function favorite(req,res,next){try{res.json({item:await setFeatureFavorite(req.user.id,req.params.key,req.body.favorite)})}catch(e){next(e)}}
export async function opened(req,res,next){try{res.json({item:await recordFeatureOpen(req.user.id,req.params.key)})}catch(e){next(e)}}

export async function resetUsage(req,res,next){try{res.json(await resetFeatureUsage(req.user.id))}catch(e){next(e)}}

export async function hidden(req,res,next){try{res.json({item:await setFeatureHidden(req.user.id,req.params.key,req.body.hidden)})}catch(e){next(e)}}
export async function restore(req,res,next){try{res.json(await restoreAllFeatures(req.user.id))}catch(e){next(e)}}

export async function reorder(req,res,next){try{res.json(await saveFeatureOrder(req.user.id,req.body.keys))}catch(e){next(e)}}
export async function resetOrder(req,res,next){try{res.json(await resetFeatureOrder(req.user.id))}catch(e){next(e)}}
