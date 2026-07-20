import { dismissNotification, listNotifications, markAllRead, markNotificationRead, syncNotifications } from "../services/notification.service.js";
export async function list(req,res,next){ try { res.json({success:true,...await listNotifications(req.user.id,{unreadOnly:req.query.unread==='true',limit:req.query.limit})}); } catch(e){next(e);} }
export async function sync(req,res,next){ try { res.json({success:true,...await syncNotifications(req.user.id)}); } catch(e){next(e);} }
export async function setRead(req,res,next){ try { res.json({success:true,item:await markNotificationRead(req.user.id,req.params.id,req.body.read!==false)}); } catch(e){next(e);} }
export async function readAll(req,res,next){ try { res.json({success:true,...await markAllRead(req.user.id)}); } catch(e){next(e);} }
export async function dismiss(req,res,next){ try { res.json({success:true,...await dismissNotification(req.user.id,req.params.id)}); } catch(e){next(e);} }
