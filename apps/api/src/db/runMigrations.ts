import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./client.js";

/**
 * Applies the schema to the configured database.
 *
 * Safe to call on every boot: 001_initial.sql is written entirely with
 * IF NOT EXISTS, and the advisory lock keeps two instances starting at the
 * same time from racing each other. Does not close the pool — the caller
 * owns its lifetime, so the server can keep using it after this returns.
 *
 * Returns false when no database is configured, so the caller can carry on
 * in memory mode rather than treating it as a failure.
 */
export async function runMigrations(): Promise<boolean> {
  if (!pool) return false;

  // Resolved relative to this module so it works the same from src/ under tsx
  // and from dist/ in the container. The Dockerfile copies the .sql alongside
  // the compiled output because tsc does not emit non-TypeScript files.
  const migration = await readFile(
    join(dirname(fileURLToPath(import.meta.url)), "migrations", "001_initial.sql"),
    "utf8",
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(640218)");
    await client.query(migration);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return true;
}
