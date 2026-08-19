import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import postgres from "postgres";

describe("migration baseline", () => {
  it("registers an ordered committed SQL migration", async () => {
    const journal = await readFile("db/migrations/meta/_journal.json", "utf8");
    const migration = await readFile("db/migrations/0000_initial_baseline.sql", "utf8");
    const identityMigration = await readFile("db/migrations/0001_identity.sql", "utf8");
    const canonicalEmailMigration = await readFile("db/migrations/0002_canonical_account_email.sql", "utf8");
    const curriculumMigration = await readFile("db/migrations/0003_curriculum.sql", "utf8");
    const hardeningMigration = await readFile("db/migrations/0004_curriculum_policy_hardening.sql", "utf8");
    const controlledPolicyMigration = await readFile("db/migrations/0005_curriculum_controlled_policy.sql", "utf8");
    const guidanceReferenceMigration = await readFile("db/migrations/0007_answer_policy_guidance_reference.sql", "utf8");
    const contentMigration = await readFile("db/migrations/0008_content_drafts.sql", "utf8");
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
    expect(journal).toContain("0003_curriculum");
    expect(curriculumMigration).toContain('CREATE TABLE "curriculum_targets"');
    expect(curriculumMigration).toContain("answer_policy_versions_policy_version_unique");
    expect(curriculumMigration).toContain("policy_conformance_vectors_outcome_check");
    expect(journal).toContain("0004_curriculum_policy_hardening");
    expect(hardeningMigration).toContain("curriculum_guidance_engine_unique");
    expect(hardeningMigration).toContain("curriculum_guidance_record_unique");
    expect(hardeningMigration).toContain("teacher_review_if_uncertain\" TYPE boolean");
    expect(hardeningMigration).toContain("answer_policies_current_version_owned");
    expect(journal).toContain("0005_curriculum_controlled_policy");
    expect(controlledPolicyMigration).toContain("answer_policy_versions_immutable BEFORE UPDATE OR DELETE");
    expect(controlledPolicyMigration).toContain("policy_conformance_vectors_immutable BEFORE UPDATE OR DELETE");
    expect(controlledPolicyMigration).toContain("CURRICULUM_POLICY_HISTORY_IMMUTABLE");
    expect(journal).toContain("0007_answer_policy_guidance_reference");
    expect(guidanceReferenceMigration).toContain("HAVING count(*) = 1");
    expect(guidanceReferenceMigration).toContain("ANSWER_POLICY_GUIDANCE_BACKFILL_AMBIGUOUS_OR_MISSING");
    expect(guidanceReferenceMigration).toContain('WHERE "guidance_id" IS NULL');
    expect(guidanceReferenceMigration.indexOf("ANSWER_POLICY_GUIDANCE_BACKFILL_AMBIGUOUS_OR_MISSING")).toBeLessThan(guidanceReferenceMigration.indexOf('ALTER COLUMN "guidance_id" SET NOT NULL'));
    expect(journal).toContain("0008_content_drafts");
    expect(contentMigration).toContain('CREATE TABLE "question_drafts"');
    expect(contentMigration).toContain("CONTENT_DRAFT_HISTORY_IMMUTABLE");
    expect(contentMigration).toContain('"source_version_id" uuid REFERENCES "question_drafts"("id")');
    expect(contentMigration).toContain('"source_version_id" uuid REFERENCES "media_drafts"("id")');
    expect(contentMigration).toContain("content_audit_events_immutable");
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
