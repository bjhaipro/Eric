import { app } from "./app.js";
import { env } from "./config/env.js";
import { checkDatabase, db } from "./database/db.js";

let server;

async function start() {
  await checkDatabase();
  server = app.listen(env.port, () => {
    console.log(`BJH AI Pro Cloud API: http://localhost:${env.port}`);
  });
}

async function shutdown(signal) {
  console.log(`${signal} received`);
  if (server) server.close();
  await db.end();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start().catch((error) => {
  console.error("Server startup failed", error);
  process.exit(1);
});
