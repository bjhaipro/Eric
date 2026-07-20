import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;
export const db = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.nodeEnv === "production" ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

db.on("error", (error) => console.error("[DATABASE]", error));

export async function checkDatabase() {
  const result = await db.query("SELECT NOW() AS now");
  return result.rows[0];
}
