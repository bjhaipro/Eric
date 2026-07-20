import { createWatchlistItem, deleteWatchlistItem, listWatchlist, updateWatchlistItem } from "../services/watchlist.service.js";
export async function list(req,res,next){ try{ res.json(await listWatchlist(req.user.id)); }catch(e){ next(e); } }
export async function create(req,res,next){ try{ res.status(201).json({success:true,item:await createWatchlistItem(req.user.id,req.body)}); }catch(e){ next(e); } }
export async function update(req,res,next){ try{ res.json({success:true,item:await updateWatchlistItem(req.user.id,req.params.id,req.body)}); }catch(e){ next(e); } }
export async function remove(req,res,next){ try{ await deleteWatchlistItem(req.user.id,req.params.id); res.status(204).end(); }catch(e){ next(e); } }
