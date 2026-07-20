import { exportTransactionsCsv, importTransactionsCsv } from "../services/csv.service.js";

export async function downloadTransactions(req, res, next) {
  try {
    const csv = await exportTransactionsCsv(req.user.id);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"BJH_AI_Pro_Transactions_${date}.csv\"`);
    res.send(csv);
  } catch (error) { next(error); }
}

export async function uploadTransactions(req, res, next) {
  try {
    const result = await importTransactionsCsv(req.user.id, req.body.csv, String(req.body.mode ?? "merge"));
    res.json({ success: true, message: `已匯入 ${result.imported} 筆交易`, ...result });
  } catch (error) { next(error); }
}
