import { db } from "../database/db.js";

function normalizeKey(value) {
  const key = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,99}$/.test(key)) {
    const error = new Error("功能識別碼格式錯誤"); error.status = 400; throw error;
  }
  return key;
}

export async function listFeaturePreferences(userId) {
  const result = await db.query(`
    SELECT feature_key AS "featureKey", is_favorite AS "isFavorite", is_hidden AS "isHidden",
           last_opened_at AS "lastOpenedAt", open_count AS "openCount", sort_order AS "sortOrder"
    FROM user_feature_preferences WHERE user_id=$1
    ORDER BY sort_order ASC NULLS LAST, is_favorite DESC, last_opened_at DESC NULLS LAST, feature_key
  `,[userId]);
  return { items: result.rows };
}

export async function setFeatureFavorite(userId, rawKey, favorite) {
  const featureKey = normalizeKey(rawKey);
  const result = await db.query(`
    INSERT INTO user_feature_preferences(user_id,feature_key,is_favorite) VALUES($1,$2,$3)
    ON CONFLICT(user_id,feature_key) DO UPDATE SET is_favorite=EXCLUDED.is_favorite,updated_at=NOW()
    RETURNING feature_key AS "featureKey",is_favorite AS "isFavorite",is_hidden AS "isHidden",last_opened_at AS "lastOpenedAt",open_count AS "openCount",sort_order AS "sortOrder"
  `,[userId,featureKey,Boolean(favorite)]);
  return result.rows[0];
}

export async function recordFeatureOpen(userId, rawKey) {
  const featureKey = normalizeKey(rawKey);
  const result = await db.query(`
    INSERT INTO user_feature_preferences(user_id,feature_key,is_favorite,last_opened_at,open_count)
    VALUES($1,$2,FALSE,NOW(),1)
    ON CONFLICT(user_id,feature_key) DO UPDATE SET last_opened_at=NOW(),open_count=user_feature_preferences.open_count+1,updated_at=NOW()
    RETURNING feature_key AS "featureKey",is_favorite AS "isFavorite",is_hidden AS "isHidden",last_opened_at AS "lastOpenedAt",open_count AS "openCount",sort_order AS "sortOrder"
  `,[userId,featureKey]);
  return result.rows[0];
}


export async function resetFeatureUsage(userId) {
  const result = await db.query(`
    UPDATE user_feature_preferences
    SET last_opened_at=NULL, open_count=0, updated_at=NOW()
    WHERE user_id=$1
  `,[userId]);
  return { resetCount: result.rowCount };
}


export async function setFeatureHidden(userId, rawKey, hidden) {
  const featureKey = normalizeKey(rawKey);
  const result = await db.query(`
    INSERT INTO user_feature_preferences(user_id,feature_key,is_favorite,is_hidden) VALUES($1,$2,FALSE,$3)
    ON CONFLICT(user_id,feature_key) DO UPDATE SET is_hidden=EXCLUDED.is_hidden,updated_at=NOW()
    RETURNING feature_key AS "featureKey",is_favorite AS "isFavorite",is_hidden AS "isHidden",last_opened_at AS "lastOpenedAt",open_count AS "openCount",sort_order AS "sortOrder"
  `,[userId,featureKey,Boolean(hidden)]);
  return result.rows[0];
}

export async function restoreAllFeatures(userId) {
  const result = await db.query(`UPDATE user_feature_preferences SET is_hidden=FALSE,updated_at=NOW() WHERE user_id=$1 AND is_hidden=TRUE`,[userId]);
  return { restoredCount: result.rowCount };
}


export async function saveFeatureOrder(userId, rawKeys) {
  if (!Array.isArray(rawKeys) || rawKeys.length === 0 || rawKeys.length > 100) {
    const error = new Error("功能排序資料格式錯誤"); error.status = 400; throw error;
  }
  const keys = rawKeys.map(normalizeKey);
  if (new Set(keys).size !== keys.length) {
    const error = new Error("功能排序不可重複"); error.status = 400; throw error;
  }
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    for (let index = 0; index < keys.length; index += 1) {
      await client.query(`
        INSERT INTO user_feature_preferences(user_id,feature_key,is_favorite,sort_order)
        VALUES($1,$2,FALSE,$3)
        ON CONFLICT(user_id,feature_key) DO UPDATE SET sort_order=EXCLUDED.sort_order,updated_at=NOW()
      `,[userId,keys[index],index]);
    }
    await client.query("COMMIT");
    return { savedCount: keys.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function resetFeatureOrder(userId) {
  const result = await db.query(`UPDATE user_feature_preferences SET sort_order=NULL,updated_at=NOW() WHERE user_id=$1 AND sort_order IS NOT NULL`,[userId]);
  return { resetCount: result.rowCount };
}
