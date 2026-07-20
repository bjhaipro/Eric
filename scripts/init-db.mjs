import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = path.join(root, "database", "schema.sql");
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const sql = await fs.readFile(schemaPath, "utf8");
const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

try {
  await client.connect();
  await client.query(sql);
  console.log("Database schema initialized.");
} finally {
  await client.end();
}
