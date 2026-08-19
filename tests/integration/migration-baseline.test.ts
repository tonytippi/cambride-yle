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
    const reviewMigration = await readFile("db/migrations/0009_content_review_workflow.sql", "utf8");
    const triggerFixMigration = await readFile("db/migrations/0010_content_review_trigger_fix.sql", "utf8");
    const integrityMigration = await readFile("db/migrations/0011_content_review_integrity.sql", "utf8");
    const rejectionGuardMigration = await readFile("db/migrations/0012_content_rejection_approval_guard.sql", "utf8");
    const approvalEvidenceMigration = await readFile("db/migrations/0013_content_approval_evidence_guard.sql", "utf8");
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
    expect(journal).toContain("0009_content_review_workflow");
    expect(reviewMigration).toContain("ALTER TYPE \"content_status\" ADD VALUE IF NOT EXISTS 'in_review'");
    expect(reviewMigration).toContain('CREATE TABLE "content_validation_results"');
    expect(reviewMigration).toContain('CREATE TABLE "content_review_records"');
    expect(reviewMigration).toContain('CREATE TABLE "content_phone_preview_records"');
    expect(reviewMigration).toContain("CONTENT_DRAFT_HISTORY_IMMUTABLE");
    expect(journal).toContain("0010_content_review_trigger_fix");
    expect(triggerFixMigration).toContain("CONTENT_REVIEW_HISTORY_IMMUTABLE");
    expect(journal).toContain("0011_content_review_integrity");
    expect(integrityMigration).toContain('ADD COLUMN "validation_result_id" uuid REFERENCES "content_validation_results"');
    expect(integrityMigration).toContain("CONTENT_STATUS_TRANSITION_INVALID");
    expect(integrityMigration).toContain("CONTENT_REVIEW_VALIDATION_MISMATCH");
    expect(integrityMigration).toContain("CONTENT_PHONE_PREVIEW_TARGET_INVALID");
    expect(journal).toContain("0012_content_rejection_approval_guard");
    expect(rejectionGuardMigration).toContain("CONTENT_STATUS_TRANSITION_INVALID");
    expect(rejectionGuardMigration).toContain("CONTENT_REVIEW_VALIDATION_REQUIRED");
    expect(journal).toContain("0013_content_approval_evidence_guard");
    expect(approvalEvidenceMigration).toContain("CONTENT_REVIEW_EVIDENCE_REQUIRED");
    expect(approvalEvidenceMigration).toContain("CONTENT_APPROVAL_EVIDENCE_REQUIRED");
    expect(approvalEvidenceMigration).toContain("CONTENT_PHONE_PREVIEW_REQUIRED");
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

  it("enforces lifecycle evidence for direct migrated content status updates", async () => {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
    try {
      const tables = await sql<{ table_name: string }[]>`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('curriculum_targets', 'curriculum_guidance', 'media_drafts', 'content_validation_results', 'content_review_records')`;
      if (tables.length !== 5) return;
      await sql.begin(async (transaction) => {
        const suffix = crypto.randomUUID(); const accountId = crypto.randomUUID(); const targetId = crypto.randomUUID(); const guidanceId = crypto.randomUUID(); const mediaId = crypto.randomUUID(); const validationId = crypto.randomUUID(); const reviewId = crypto.randomUUID(); const approvalId = crypto.randomUUID();
        await transaction`INSERT INTO accounts (id, email, canonical_email, display_name, role) VALUES (${accountId}, ${`review-${suffix}@example.test`}, ${`review-${suffix}@example.test`}, 'Reviewer', 'academic_lead')`;
        await transaction`INSERT INTO curriculum_targets (id, canonical_id, category, guidance, is_approved, created_by) VALUES (${targetId}, ${`target-${suffix}`}, 'vocabulary', 'Controlled target', true, ${accountId})`;
        await transaction`INSERT INTO curriculum_guidance (id, paper, part, engine, topic, task_format, max_words, max_options, approved_names, approved_numbers) VALUES (${guidanceId}, 'reading_writing', 1, 'picture_true_false', 'Animals', 'Picture true false', 10, 2, '[]'::jsonb, '[]'::jsonb)`;
        await transaction`INSERT INTO media_drafts (id, status, origin, paper, part, engine, primary_target_id, supporting_target_ids, topic_ids, guidance_id, estimated_duration_seconds, accessibility_metadata, provenance, created_by, media_type, description) VALUES (${mediaId}, 'draft', 'manual', 'reading_writing', '1', 'picture_true_false', ${targetId}, '[]'::jsonb, ${JSON.stringify([targetId])}::jsonb, ${guidanceId}, '60', '{"altText":"A cat"}'::jsonb, '{"source":"Original","rightsReference":"Owned"}'::jsonb, ${accountId}, 'audio', 'Cat audio')`;
        await expect(transaction`UPDATE media_drafts SET status = 'in_review' WHERE id = ${mediaId}`).rejects.toThrow(/CONTENT_REVIEW_EVIDENCE_REQUIRED/);
        await transaction`INSERT INTO content_validation_results (id, kind, target_id, actor_id, findings) VALUES (${validationId}, 'media', ${mediaId}, ${accountId}, '[]'::jsonb)`;
        await transaction`INSERT INTO content_review_records (id, kind, target_id, actor_id, decision, validation_result_id, findings) VALUES (${reviewId}, 'media', ${mediaId}, ${accountId}, 'submitted', ${validationId}, '[]'::jsonb)`;
        await transaction`UPDATE media_drafts SET status = 'in_review' WHERE id = ${mediaId}`;
        await expect(transaction`UPDATE media_drafts SET status = 'approved' WHERE id = ${mediaId}`).rejects.toThrow(/CONTENT_APPROVAL_EVIDENCE_REQUIRED/);
        await transaction`INSERT INTO content_review_records (id, kind, target_id, actor_id, decision, validation_result_id, findings) VALUES (${approvalId}, 'media', ${mediaId}, ${accountId}, 'approved', ${validationId}, '[]'::jsonb)`;
        await transaction`UPDATE media_drafts SET status = 'approved' WHERE id = ${mediaId}`;
        throw new Error("ROLLBACK_TEST_TRANSACTION");
      }).catch((error: unknown) => { if (!(error instanceof Error) || error.message !== "ROLLBACK_TEST_TRANSACTION") throw error; });
    } finally { await sql.end(); }
  });

});
