import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("migration baseline", () => {
  it("registers an ordered committed SQL migration", async () => {
    const journal = await readFile("db/migrations/meta/_journal.json", "utf8");
    const migration = await readFile("db/migrations/0000_initial_baseline.sql", "utf8");
    expect(journal).toContain("0000_initial_baseline");
    expect(migration).toContain("Initial reviewed baseline");
  });
});
