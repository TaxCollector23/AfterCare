import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DataType, newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

describe("database migration", () => {
  it("applies to a PostgreSQL-compatible local test database", async () => {
    const database = newDb({ autoCreateForeignKeyIndices: true });
    database.registerExtension("pgcrypto", (schema) => {
      schema.registerFunction({
        name: "gen_random_uuid",
        returns: DataType.uuid,
        implementation: randomUUID,
        impure: true,
      });
    });
    const migrationPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "migrations",
      "001_initial.sql",
    );
    database.public.none(await readFile(migrationPath, "utf8"));

    const tables = database.public.many<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    );
    expect(tables.map(({ table_name }) => table_name).sort()).toEqual([
      "appointments",
      "audit_logs",
      "documents",
      "medications",
      "recovery_plans",
      "sessions",
      "users",
    ]);
  });
});
