import { closeCache } from "./cache/index.js";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { closeDatabase } from "./db/client.js";
import { storageStatus } from "./integrations/storage.js";

// These two are the only console calls in the API. no-console is right for
// request handling — logs there risk carrying PHI — but a boot-time config
// warning has to reach the deploy log, and there is no logger to route it to.
/* eslint-disable no-console */

// Uploads are the first thing a misconfigured key breaks, and they break with a
// 500 that looks like a bug rather than a setting. Say so at boot instead.
const storage = storageStatus();
if (!storage.encryption.ready) {
  console.error(
    `[startup] uploads will fail: STORAGE_ENCRYPTION_KEY is missing or unusable. ` +
      `Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
  );
}
// Memory mode survives a demo and nothing else: the free instance sleeps after
// ~15 minutes idle, and every account and document goes with it.
if (storage.mode === "memory" && config.NODE_ENV === "production") {
  console.warn(
    "[startup] S3_BUCKET is unset — uploaded documents are held in memory and " +
      "will be lost when this instance restarts.",
  );
}
/* eslint-enable no-console */

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
