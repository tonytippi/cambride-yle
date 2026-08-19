import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import postgres from "postgres";

describe("migration baseline", () => {
  it("registers an ordered committed SQL migration", async () => {
    const journal = await readFile("db/migrations/meta/_journal.json", "utf8");
    const migration = await readFile("db/migrations/0000_initial_baseline.sql", "utf8");
    const identityMigration = await readFile("db/migrations/0001_identity.sql", "utf8");
    const canonicalEmailMigration = await readFile("db/migrations/0002_canonical_account_email.sql", "utf8");
    expect(journal).toContain("0000_initial_baseline");
    expect(migration).toContain("Initial reviewed baseline");
    expect(journal).toContain("0001_identity");
    expect(identityMigration).toContain("CREATE TABLE \"accounts\"");
    expect(identityMigration).toContain("accounts_lifecycle_check");
    expect(identityMigration).toContain("accounts_set_updated_at");
    expect(identityMigration).toContain("CREATE TRIGGER accounts_set_updated_at");
    expect(identityMigration).not.toMatch(/password(?!_hash)/i);
    expect(journal).toContain("0002_canonical_account_email");
    expect(canonicalEmailMigration).toContain("lower(btrim(\"email\"))");
    expect(canonicalEmailMigration).toContain("duplicate canonical emails exist");
    expect(canonicalEmailMigration).toContain("accounts_canonical_email_unique");
  });

  it("enforces canonical email uniqueness in the migrated database", async () => {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
    try {
      const columns = await sql<{ is_nullable: string }[]>`SELECT is_nullable FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'canonical_email'`;
      expect(columns).toEqual([{ is_nullable: "NO" }]);
      await sql.begin(async (transaction) => {
        const suffix = crypto.randomUUID();
        await transaction`INSERT INTO accounts (id, email, canonical_email, display_name, role) VALUES (${crypto.randomUUID()}, ${`Case-${suffix}@example.test`}, ${`case-${suffix}@example.test`}, 'Case', 'learner')`;
        await expect(transaction`INSERT INTO accounts (id, email, canonical_email, display_name, role) VALUES (${crypto.randomUUID()}, ${`case-${suffix}@example.test`}, ${`case-${suffix}@example.test`}, 'Duplicate', 'learner')`).rejects.toThrow();
        throw new Error("ROLLBACK_TEST_TRANSACTION");
      }).catch((error: unknown) => { if (!(error instanceof Error) || error.message !== "ROLLBACK_TEST_TRANSACTION") throw error; });
    } finally { await sql.end(); }
  });
});
