import { closeCache } from "./cache/index.js";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { closeDatabase } from "./db/client.js";

const server = createApp().listen(config.PORT);

function shutdown() {
  server.close(async () => {
    await Promise.allSettled([closeDatabase(), closeCache()]);
    process.exit(0);
  });
  // Force-exit if in-flight requests never drain (e.g. a stuck upstream call).
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
