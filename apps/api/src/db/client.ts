import { Pool, type QueryResultRow } from "pg";
import { config } from "../config.js";

export const pool = config.DATABASE_URL
  ? new Pool({ connectionString: config.DATABASE_URL, max: 10 })
  : null;

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  if (!pool) return null;
  return pool.query<T>(text, values);
}

export function databaseStatus() {
  return { configured: Boolean(pool), mode: pool ? "postgres" : "memory" } as const;
}
