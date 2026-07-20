import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendSrc = path.join(root, "backend", "src");
const frontend = path.join(root, "frontend");
const schemaPath = path.join(root, "database", "schema.sql");

function walk(dir, extension) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, extension);
    return entry.name.endsWith(extension) ? [full] : [];
  });
}

const errors = [];
const jsFiles = [...walk(backendSrc, ".js"), ...walk(frontend, ".js")];

for (const file of jsFiles) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (error) {
    errors.push(`JavaScript 語法錯誤：${path.relative(root, file)}`);
  }
}

for (const file of walk(backendSrc, ".js")) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
    const target = path.resolve(path.dirname(file), match[1]);
    if (![target, `${target}.js`, path.join(target, "index.js")].some(fs.existsSync)) {
      errors.push(`找不到匯入檔案：${path.relative(root, file)} → ${match[1]}`);
    }
  }
}

const html = fs.readFileSync(path.join(frontend, "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(frontend, "js", "app.js"), "utf8");
const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
const jsIds = new Set([...appJs.matchAll(/\$\("([^"]+)"\)/g)].map((m) => m[1]));
const dynamicIds = new Set(["featureEmptyState"]);
for (const id of jsIds) {
  if (!htmlIds.has(id) && !dynamicIds.has(id)) errors.push(`前端缺少 HTML id：${id}`);
}

const schema = fs.readFileSync(schemaPath, "utf8");
const tables = new Set([...schema.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-z_][a-z0-9_]*)/gi)].map((m) => m[1].toLowerCase()));
const ignoredSqlTokens = new Set(["set", "lateral", "dates", "holdings", "latest_journal", "evaluated", "completed", "entry_date", "ex_date"]);
for (const file of walk(backendSrc, ".js")) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE|DELETE FROM)\s+([a-z_][a-z0-9_]*)/gi)) {
    const table = match[1].toLowerCase();
    if (!tables.has(table) && !ignoredSqlTokens.has(table)) {
      errors.push(`SQL 引用不存在資料表：${table}（${path.relative(root, file)}）`);
    }
  }
}

const appSource = fs.readFileSync(path.join(backendSrc, "app.js"), "utf8");
for (const route of walk(path.join(backendSrc, "routes"), ".js")) {
  const base = path.basename(route);
  if (!appSource.includes(base)) errors.push(`路由尚未掛載：${base}`);
}

if (errors.length) {
  console.error(`整合檢查失敗，共 ${errors.length} 項`);
  errors.forEach((e, i) => console.error(`${i + 1}. ${e}`));
  process.exit(1);
}

console.log("整合檢查通過");
console.log(`- JavaScript 檔案：${jsFiles.length}`);
console.log(`- 後端資料表：${tables.size}`);
console.log(`- HTML 元件 ID：${htmlIds.size}`);
console.log(`- 前端程式 ID 引用：${jsIds.size}`);
