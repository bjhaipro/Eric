import { db } from "../database/db.js";

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function round(value, digits = 2) { const p = 10 ** digits; return Math.round((Number(value) + Number.EPSILON) * p) / p; }

export async function getOpportunities(userId) {
  const { rows } = await db.query(`
    WITH holdings AS (
      SELECT code,
        SUM(CASE WHEN type='BUY' THEN shares ELSE -shares END)::bigint AS shares
      FROM transactions WHERE user_id=$1 GROUP BY code
    ), latest_journal AS (
      SELECT DISTINCT ON (code) code, decision, confidence, entry_date
      FROM investment_journal_entries
      WHERE user_id=$1 AND code<>''
      ORDER BY code, entry_date DESC, id DESC
    )
    SELECT w.id,w.code,w.name,w.priority,w.target_buy_price,w.target_sell_price,w.note,
      q.price AS current_price,q.quoted_at,
      COALESCE(h.shares,0) AS held_shares,
      j.decision AS journal_decision,j.confidence AS journal_confidence,j.entry_date AS journal_date
    FROM watchlist_items w
    LEFT JOIN market_quotes q ON q.user_id=w.user_id AND q.code=w.code
    LEFT JOIN holdings h ON h.code=w.code
    LEFT JOIN latest_journal j ON j.code=w.code
    WHERE w.user_id=$1
    ORDER BY w.priority DESC,w.updated_at DESC,w.id DESC`, [userId]);

  const items = rows.map((row) => {
    const price = row.current_price == null ? null : Number(row.current_price);
    const buy = row.target_buy_price == null ? null : Number(row.target_buy_price);
    const sell = row.target_sell_price == null ? null : Number(row.target_sell_price);
    const priority = Number(row.priority);
    const heldShares = Number(row.held_shares || 0);
    const confidence = row.journal_confidence == null ? null : Number(row.journal_confidence);
    let score = priority * 10;
    const reasons = [`觀察優先級 ${priority}/5`];

    let distanceToBuy = null;
    if (price == null) {
      reasons.push("尚未輸入目前價格");
      score -= 25;
    } else if (buy != null) {
      distanceToBuy = (price - buy) / buy;
      if (price <= buy) { score += 30; reasons.push("已到達或低於目標買進價"); }
      else if (distanceToBuy <= 0.03) { score += 20; reasons.push("距離目標買進價 3% 以內"); }
      else if (distanceToBuy <= 0.08) { score += 10; reasons.push("接近目標買進區"); }
      else { reasons.push("目前仍高於目標買進價"); }
    } else {
      reasons.push("尚未設定目標買進價");
      score -= 10;
    }

    if (confidence != null) {
      score += (confidence - 3) * 5;
      reasons.push(`最近日誌信心 ${confidence}/5`);
    }
    if (row.journal_decision === "BUY") { score += 8; reasons.push("最近日誌決策為買進"); }
    if (row.journal_decision === "SELL") { score -= 15; reasons.push("最近日誌決策為賣出"); }
    if (heldShares > 0) { score -= 5; reasons.push(`目前已持有 ${heldShares} 股`); }

    score = clamp(Math.round(score), 0, 100);
    let signal = "觀察";
    if (price == null || buy == null) signal = "資料不足";
    else if (score >= 75 && price <= buy) signal = "優先研究";
    else if (score >= 60) signal = "接近機會";
    else if (price >= (sell || Infinity)) signal = "避免追價";

    return {
      code: row.code, name: row.name, priority, score, signal,
      currentPrice: price, targetBuyPrice: buy, targetSellPrice: sell,
      distanceToBuyRate: distanceToBuy == null ? null : round(distanceToBuy, 4),
      heldShares, journalDecision: row.journal_decision,
      journalConfidence: confidence, journalDate: row.journal_date,
      quotedAt: row.quoted_at, note: row.note, reasons
    };
  }).sort((a,b) => b.score - a.score || b.priority - a.priority || a.code.localeCompare(b.code));

  return {
    generatedAt: new Date().toISOString(),
    items,
    summary: {
      total: items.length,
      priorityResearch: items.filter(x => x.signal === "優先研究").length,
      approaching: items.filter(x => x.signal === "接近機會").length,
      missingData: items.filter(x => x.signal === "資料不足").length,
      held: items.filter(x => x.heldShares > 0).length
    },
    disclaimer: "Alpha Finder 依觀察清單、手動股價、目標價與投資日誌進行規則排序，不是即時報價、獲利保證或自動下單。"
  };
}
