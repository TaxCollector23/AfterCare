import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./client.js";

if (!pool) throw new Error("DATABASE_URL is required to run migrations");

const migrationsDirectory = join(dirname(fileURLToPath(import.meta.url)), "migrations");
const migration = await readFile(join(migrationsDirectory, "001_initial.sql"), "utf8");
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(640218)");
  await client.query(migration);
  await client.query("COMMIT");
  console.log("Applied migration 001_initial.sql");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
