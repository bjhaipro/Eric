import { exportBackup, importBackup } from "../services/backup.service.js";

export async function download(req, res, next) {
  try {
    const backup = await exportBackup(req.user.id);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"BJH_AI_Pro_Backup_${date}.json\"`);
    res.send(JSON.stringify(backup, null, 2));
  } catch (error) { next(error); }
}

export async function restore(req, res, next) {
  try {
    const result = await importBackup(req.user.id, req.body.backup, String(req.body.mode ?? "replace"));
    res.json({ success: true, message: "備份資料匯入完成", ...result });
  } catch (error) { next(error); }
}
