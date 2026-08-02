import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runMigrations } from "./runMigrations.js";

const here = dirname(fileURLToPath(import.meta.url));

describe("runMigrations", () => {
  it("is a no-op when no database is configured", async () => {
    // The test env sets no DATABASE_URL. Memory mode has to stay a supported
    // way to boot, so this must resolve false rather than throw.
    await expect(runMigrations()).resolves.toBe(false);
  });

  it("resolves the migration SQL next to its own module", async () => {
    // runMigrations reads this path relative to itself, which is the same in
    // src/ and in dist/. Losing the file breaks the very first boot against a
    // real database, and nothing else would catch it before deploy.
    const sql = await readFile(
      join(here, "migrations", "001_initial.sql"),
      "utf8",
    );
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS users");
  });

  it("is shipped into the runtime image by the Dockerfile", async () => {
    // tsc emits only JavaScript, so without an explicit COPY the container
    // gets compiled code and no SQL — a connection to zero tables.
    const dockerfile = await readFile(join(here, "..", "..", "Dockerfile"), "utf8");
    expect(dockerfile).toContain("apps/api/dist/db/migrations");
  });

  it("keeps the migration safe to re-run on every boot", async () => {
    // The server applies this at startup, so a non-idempotent statement would
    // crash-loop the service on its second deploy.
    const sql = await readFile(
      join(here, "migrations", "001_initial.sql"),
      "utf8",
    );
    const creates = sql.match(/CREATE (TABLE|INDEX)(?! IF NOT EXISTS)/g) ?? [];
    expect(creates).toEqual([]);
  });
});
