import { db } from "../database/db.js";

const allowedDecisions = new Set(["BUY", "SELL", "HOLD", "OBSERVE", "REVIEW"]);

function normalize(input = {}) {
  const entryDate = String(input.entryDate ?? "").trim();
  const code = String(input.code ?? "").trim().toUpperCase();
  const title = String(input.title ?? "").trim();
  const decision = String(input.decision ?? "OBSERVE").trim().toUpperCase();
  const confidence = Number(input.confidence ?? 3);
  const plan = String(input.plan ?? "").trim();
  const result = String(input.result ?? "").trim();
  const lesson = String(input.lesson ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate) || Number.isNaN(Date.parse(`${entryDate}T00:00:00Z`))) {
    throw Object.assign(new Error("紀錄日期格式必須是 YYYY-MM-DD"), { status: 400 });
  }
  if (code && !/^[A-Z0-9._-]{1,20}$/.test(code)) throw Object.assign(new Error("股票代號格式錯誤"), { status: 400 });
  if (!title || title.length > 160) throw Object.assign(new Error("標題不可空白且不得超過 160 字元"), { status: 400 });
  if (!allowedDecisions.has(decision)) throw Object.assign(new Error("決策類型錯誤"), { status: 400 });
  if (!Number.isInteger(confidence) || confidence < 1 || confidence > 5) throw Object.assign(new Error("信心程度必須為 1 到 5"), { status: 400 });
  if (plan.length > 5000 || result.length > 5000 || lesson.length > 5000) throw Object.assign(new Error("文字內容過長"), { status: 400 });

  return { entryDate, code, title, decision, confidence, plan, result, lesson };
}

function map(row) {
  return {
    id: row.id,
    entryDate: row.entry_date,
    code: row.code,
    title: row.title,
    decision: row.decision,
    confidence: Number(row.confidence),
    plan: row.plan,
    result: row.result,
    lesson: row.lesson,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listJournalEntries(userId, { limit = 100, code = "" } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const normalizedCode = String(code || "").trim().toUpperCase();
  const values = [userId, safeLimit];
  let where = "user_id=$1";
  if (normalizedCode) { values.push(normalizedCode); where += ` AND code=$3`; }
  const { rows } = await db.query(
    `SELECT * FROM investment_journal_entries WHERE ${where}
     ORDER BY entry_date DESC, id DESC LIMIT $2`, values
  );
  const entries = rows.map(map);
  return {
    entries,
    summary: {
      total: entries.length,
      highConfidence: entries.filter((entry) => entry.confidence >= 4).length,
      reviewed: entries.filter((entry) => entry.result || entry.lesson).length
    }
  };
}

export async function createJournalEntry(userId, input) {
  const v = normalize(input);
  const { rows } = await db.query(
    `INSERT INTO investment_journal_entries
     (user_id, entry_date, code, title, decision, confidence, plan, result, lesson)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [userId, v.entryDate, v.code, v.title, v.decision, v.confidence, v.plan, v.result, v.lesson]
  );
  return map(rows[0]);
}

export async function updateJournalEntry(userId, id, input) {
  const v = normalize(input);
  const { rows } = await db.query(
    `UPDATE investment_journal_entries SET
     entry_date=$3, code=$4, title=$5, decision=$6, confidence=$7,
     plan=$8, result=$9, lesson=$10, updated_at=NOW()
     WHERE user_id=$1 AND id=$2 RETURNING *`,
    [userId, id, v.entryDate, v.code, v.title, v.decision, v.confidence, v.plan, v.result, v.lesson]
  );
  if (!rows[0]) throw Object.assign(new Error("找不到投資紀錄"), { status: 404 });
  return map(rows[0]);
}

export async function deleteJournalEntry(userId, id) {
  const result = await db.query("DELETE FROM investment_journal_entries WHERE user_id=$1 AND id=$2", [userId, id]);
  if (!result.rowCount) throw Object.assign(new Error("找不到投資紀錄"), { status: 404 });
}
