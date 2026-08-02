import { Pool, type QueryResultRow } from "pg";
import { config } from "../config.js";

export const pool = config.DATABASE_URL
  ? new Pool({ connectionString: config.DATABASE_URL, max: 10 })
  : null;

export async function query<T extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  if (!pool) return null;
  return pool.query<T>(text, values);
}

export function databaseStatus() {
  return {
    configured: Boolean(pool),
    mode: pool ? "postgres" : "memory",
  } as const;
}

/**
 * Live readiness probe for /health. In memory mode there is nothing to
 * check, so the database is always healthy; with a configured pool it runs
 * a trivial query and reports failure on any error.
 */
export async function databaseHealth(): Promise<
  ReturnType<typeof databaseStatus> & { ok: boolean }
> {
  if (!pool) return { ...databaseStatus(), ok: true };
  try {
    await pool.query("SELECT 1");
    return { ...databaseStatus(), ok: true };
  } catch {
    return { ...databaseStatus(), ok: false };
  }
}

/** Closes the Postgres pool. Call on graceful shutdown; safe to call even if never configured. */
export async function closeDatabase(): Promise<void> {
  if (pool) await pool.end();
}
