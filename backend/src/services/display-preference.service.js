import { db } from "../database/db.js";

const allowedFontSizes = new Set(["standard", "large", "xlarge"]);
const allowedDensities = new Set(["comfortable", "compact"]);
const allowedStartupViews = new Set(["all", "today", "favorites", "recent"]);

function normalize(input = {}) {
  const fontSize = String(input.fontSize || "standard").toLowerCase();
  const density = String(input.density || "comfortable").toLowerCase();
  const startupView = String(input.startupView || "today").toLowerCase();
  if (!allowedFontSizes.has(fontSize)) {
    const error = new Error("字體大小設定不正確"); error.status = 400; throw error;
  }
  if (!allowedDensities.has(density)) {
    const error = new Error("版面密度設定不正確"); error.status = 400; throw error;
  }
  if (!allowedStartupViews.has(startupView)) {
    const error = new Error("登入首頁模式設定不正確"); error.status = 400; throw error;
  }
  return {
    fontSize,
    density,
    startupView,
    highContrast: Boolean(input.highContrast),
    reduceMotion: Boolean(input.reduceMotion)
  };
}

export async function getDisplayPreference(userId) {
  const result = await db.query(`
    SELECT font_size AS "fontSize", density, startup_view AS "startupView",
           high_contrast AS "highContrast", reduce_motion AS "reduceMotion", updated_at AS "updatedAt"
    FROM user_display_preferences WHERE user_id=$1
  `, [userId]);
  return result.rows[0] || {
    fontSize: "standard", density: "comfortable", startupView: "today", highContrast: false, reduceMotion: false, updatedAt: null
  };
}

export async function saveDisplayPreference(userId, input) {
  const value = normalize(input);
  const result = await db.query(`
    INSERT INTO user_display_preferences(user_id,font_size,density,startup_view,high_contrast,reduce_motion)
    VALUES($1,$2,$3,$4,$5,$6)
    ON CONFLICT(user_id) DO UPDATE SET
      font_size=EXCLUDED.font_size,
      density=EXCLUDED.density,
      startup_view=EXCLUDED.startup_view,
      high_contrast=EXCLUDED.high_contrast,
      reduce_motion=EXCLUDED.reduce_motion,
      updated_at=NOW()
    RETURNING font_size AS "fontSize", density, startup_view AS "startupView",
              high_contrast AS "highContrast", reduce_motion AS "reduceMotion", updated_at AS "updatedAt"
  `, [userId, value.fontSize, value.density, value.startupView, value.highContrast, value.reduceMotion]);
  return result.rows[0];
}
