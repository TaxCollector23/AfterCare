import { closeCache } from "./cache/index.js";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { closeDatabase } from "./db/client.js";
import { encryptionStatus } from "./integrations/storage.js";

// Uploads are the first thing a misconfigured key breaks, and they break with a
// 500 that looks like a bug rather than a setting. Say so at boot instead.
const encryption = encryptionStatus();
if (!encryption.configured) {
  console.error(
    `[startup] uploads will fail: ${encryption.problem}. ` +
      `Generate a key with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
  );
}

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
