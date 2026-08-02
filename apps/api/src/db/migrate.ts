import { pool } from "./client.js";
import { runMigrations } from "./runMigrations.js";

// CLI entry point (`pnpm --filter @discharge-guide/api migrate`). The server
// runs the same migration at boot; this exists for applying it by hand.
if (!pool) throw new Error("DATABASE_URL is required to run migrations");

try {
  await runMigrations();
} finally {
  await pool.end();
}
