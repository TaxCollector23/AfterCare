import { closeCache } from "./cache/index.js";
import { config } from "./config.js";
import { pool } from "./db/client.js";
import { createApp } from "./app.js";

const server = createApp().listen(config.PORT);

async function shutdown(_signal: string) {
  server.close(async () => {
    await closeCache();
    if (pool) await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
