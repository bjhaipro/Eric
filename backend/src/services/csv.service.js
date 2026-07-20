import { db } from "../database/db.js";
import { buildPortfolio } from "./portfolio-builder.js";
import { normalizeTransactionInput } from "../utils/transaction-validator.js";

const headers = ["type", "code", "name", "shares", "price", "fee", "tax", "tradeDate", "note"];

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ""; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (quoted) throw Object.assign(new Error("CSV 引號未正確結束"), { status: 400 });
  if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((r) => r.some((v) => String(v).trim() !== ""));
}

export async function exportTransactionsCsv(userId) {
  const result = await db.query(
    `SELECT type, code, name, shares, price, fee, tax,
            trade_date AS "tradeDate", note
       FROM transactions WHERE user_id=$1
       ORDER BY trade_date ASC, created_at ASC, id ASC`,
    [userId]
  );
  const lines = [headers.join(",")];
  for (const row of result.rows) lines.push(headers.map((key) => csvEscape(row[key])).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export async function importTransactionsCsv(userId, csvText, mode = "merge") {
  if (typeof csvText !== "string" || !csvText.trim()) throw Object.assign(new Error("請選擇有效的 CSV 檔案"), { status: 400 });
  if (!['merge', 'replace'].includes(mode)) throw Object.assign(new Error("匯入模式錯誤"), { status: 400 });
  const rows = parseCsv(csvText.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw Object.assign(new Error("CSV 沒有交易資料"), { status: 400 });
  const incomingHeaders = rows[0].map((v) => String(v).trim());
  const missing = headers.filter((h) => !incomingHeaders.includes(h));
  if (missing.length) throw Object.assign(new Error(`CSV 缺少欄位：${missing.join("、")}`), { status: 400 });
  if (rows.length > 5001) throw Object.assign(new Error("單次最多匯入 5000 筆交易"), { status: 400 });

  const parsed = rows.slice(1).map((cells, index) => {
    const raw = Object.fromEntries(incomingHeaders.map((h, i) => [h, cells[i] ?? ""]));
    try { return normalizeTransactionInput(raw); }
    catch (error) { throw Object.assign(new Error(`第 ${index + 2} 列：${error.message}`), { status: 400 }); }
  });

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [userId]);
    const existingResult = await client.query(
      `SELECT id, code, name, type, shares, price, fee, tax,
              trade_date AS "tradeDate", note, created_at AS "createdAt"
         FROM transactions WHERE user_id=$1
         ORDER BY trade_date ASC, created_at ASC, id ASC`, [userId]
    );
    const replay = mode === "replace" ? parsed : [...existingResult.rows, ...parsed];
    replay.sort((a, b) => String(a.tradeDate).localeCompare(String(b.tradeDate)) || Number(a.id ?? Number.MAX_SAFE_INTEGER) - Number(b.id ?? Number.MAX_SAFE_INTEGER));
    buildPortfolio(replay);

    if (mode === "replace") await client.query("DELETE FROM transactions WHERE user_id=$1", [userId]);
    for (const t of parsed) {
      await client.query(
        `INSERT INTO transactions (user_id, code, name, type, shares, price, fee, tax, trade_date, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [userId, t.code, t.name, t.type, t.shares, t.price, t.fee, t.tax, t.tradeDate, t.note]
      );
    }
    await client.query("COMMIT");
    return { imported: parsed.length, mode };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
