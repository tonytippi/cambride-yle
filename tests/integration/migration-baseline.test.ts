import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import postgres from "postgres";

describe("migration baseline", () => {
  it("registers an ordered committed SQL migration", async () => {
    const journal = await readFile("db/migrations/meta/_journal.json", "utf8");
    const migration = await readFile(
      "db/migrations/0000_initial_baseline.sql",
      "utf8",
    );
    const identityMigration = await readFile(
      "db/migrations/0001_identity.sql",
      "utf8",
    );
    const canonicalEmailMigration = await readFile(
      "db/migrations/0002_canonical_account_email.sql",
      "utf8",
    );
    const curriculumMigration = await readFile(
      "db/migrations/0003_curriculum.sql",
      "utf8",
    );
    const hardeningMigration = await readFile(
      "db/migrations/0004_curriculum_policy_hardening.sql",
      "utf8",
    );
    const controlledPolicyMigration = await readFile(
      "db/migrations/0005_curriculum_controlled_policy.sql",
      "utf8",
    );
    const guidanceReferenceMigration = await readFile(
      "db/migrations/0007_answer_policy_guidance_reference.sql",
      "utf8",
    );
    const contentMigration = await readFile(
      "db/migrations/0008_content_drafts.sql",
      "utf8",
    );
    const reviewMigration = await readFile(
      "db/migrations/0009_content_review_workflow.sql",
      "utf8",
    );
    const triggerFixMigration = await readFile(
      "db/migrations/0010_content_review_trigger_fix.sql",
      "utf8",
    );
    const integrityMigration = await readFile(
      "db/migrations/0011_content_review_integrity.sql",
      "utf8",
    );
    const rejectionGuardMigration = await readFile(
      "db/migrations/0012_content_rejection_approval_guard.sql",
      "utf8",
    );
    const approvalEvidenceMigration = await readFile(
      "db/migrations/0013_content_approval_evidence_guard.sql",
      "utf8",
    );
    const publicationMigration = await readFile(
      "db/migrations/0014_publish_immutable_practice_sets.sql",
      "utf8",
    );
    const publicationSchemaMigration = await readFile(
      "db/migrations/0015_publish_immutable_practice_set_schema.sql",
      "utf8",
    );
    const questionMediaMigration = await readFile(
      "db/migrations/0016_question_version_media.sql",
      "utf8",
    );
    const learnerPracticeMigration = await readFile(
      "db/migrations/0017_learner_practice_selection.sql",
      "utf8",
    );
    const practiceSnapshotMigration = await readFile(
      "db/migrations/0018_practice_attempt_snapshot_metadata.sql",
      "utf8",
    );
    const practiceResponseMigration = await readFile(
      "db/migrations/0019_practice_attempt_responses_and_playback.sql",
      "utf8",
    );
    const submissionReviewMigration = await readFile(
      "db/migrations/0020_practice_attempt_submission_review.sql",
      "utf8",
    );
    const evidenceProjectionMigration = await readFile(
      "db/migrations/0021_teacher_evidence_projection.sql",
      "utf8",
    );
    expect(journal).toContain("0000_initial_baseline");
    expect(migration).toContain("Initial reviewed baseline");
    expect(journal).toContain("0001_identity");
    expect(identityMigration).toContain('CREATE TABLE "accounts"');
    expect(identityMigration).toContain("accounts_lifecycle_check");
    expect(identityMigration).toContain("accounts_set_updated_at");
    expect(identityMigration).toContain(
      "CREATE TRIGGER accounts_set_updated_at",
    );
    expect(identityMigration).not.toMatch(/password(?!_hash)/i);
    expect(journal).toContain("0002_canonical_account_email");
    expect(canonicalEmailMigration).toContain('lower(btrim("email"))');
    expect(canonicalEmailMigration).toContain(
      "duplicate canonical emails exist",
    );
    expect(canonicalEmailMigration).toContain(
      "accounts_canonical_email_unique",
    );
    expect(journal).toContain("0003_curriculum");
    expect(curriculumMigration).toContain('CREATE TABLE "curriculum_targets"');
    expect(curriculumMigration).toContain(
      "answer_policy_versions_policy_version_unique",
    );
    expect(curriculumMigration).toContain(
      "policy_conformance_vectors_outcome_check",
    );
    expect(journal).toContain("0004_curriculum_policy_hardening");
    expect(hardeningMigration).toContain("curriculum_guidance_engine_unique");
    expect(hardeningMigration).toContain("curriculum_guidance_record_unique");
    expect(hardeningMigration).toContain(
      'teacher_review_if_uncertain" TYPE boolean',
    );
    expect(hardeningMigration).toContain(
      "answer_policies_current_version_owned",
    );
    expect(journal).toContain("0005_curriculum_controlled_policy");
    expect(controlledPolicyMigration).toContain(
      "answer_policy_versions_immutable BEFORE UPDATE OR DELETE",
    );
    expect(controlledPolicyMigration).toContain(
      "policy_conformance_vectors_immutable BEFORE UPDATE OR DELETE",
    );
    expect(controlledPolicyMigration).toContain(
      "CURRICULUM_POLICY_HISTORY_IMMUTABLE",
    );
    expect(journal).toContain("0007_answer_policy_guidance_reference");
    expect(guidanceReferenceMigration).toContain("HAVING count(*) = 1");
    expect(guidanceReferenceMigration).toContain(
      "ANSWER_POLICY_GUIDANCE_BACKFILL_AMBIGUOUS_OR_MISSING",
    );
    expect(guidanceReferenceMigration).toContain('WHERE "guidance_id" IS NULL');
    expect(
      guidanceReferenceMigration.indexOf(
        "ANSWER_POLICY_GUIDANCE_BACKFILL_AMBIGUOUS_OR_MISSING",
      ),
    ).toBeLessThan(
      guidanceReferenceMigration.indexOf(
        'ALTER COLUMN "guidance_id" SET NOT NULL',
      ),
    );
    expect(journal).toContain("0008_content_drafts");
    expect(contentMigration).toContain('CREATE TABLE "question_drafts"');
    expect(contentMigration).toContain("CONTENT_DRAFT_HISTORY_IMMUTABLE");
    expect(contentMigration).toContain(
      '"source_version_id" uuid REFERENCES "question_drafts"("id")',
    );
    expect(contentMigration).toContain(
      '"source_version_id" uuid REFERENCES "media_drafts"("id")',
    );
    expect(contentMigration).toContain("content_audit_events_immutable");
    expect(journal).toContain("0009_content_review_workflow");
    expect(reviewMigration).toContain(
      "ALTER TYPE \"content_status\" ADD VALUE IF NOT EXISTS 'in_review'",
    );
    expect(reviewMigration).toContain(
      'CREATE TABLE "content_validation_results"',
    );
    expect(reviewMigration).toContain('CREATE TABLE "content_review_records"');
    expect(reviewMigration).toContain(
      'CREATE TABLE "content_phone_preview_records"',
    );
    expect(reviewMigration).toContain("CONTENT_DRAFT_HISTORY_IMMUTABLE");
    expect(journal).toContain("0010_content_review_trigger_fix");
    expect(triggerFixMigration).toContain("CONTENT_REVIEW_HISTORY_IMMUTABLE");
    expect(journal).toContain("0011_content_review_integrity");
    expect(integrityMigration).toContain(
      'ADD COLUMN "validation_result_id" uuid REFERENCES "content_validation_results"',
    );
    expect(integrityMigration).toContain("CONTENT_STATUS_TRANSITION_INVALID");
    expect(integrityMigration).toContain("CONTENT_REVIEW_VALIDATION_MISMATCH");
    expect(integrityMigration).toContain(
      "CONTENT_PHONE_PREVIEW_TARGET_INVALID",
    );
    expect(journal).toContain("0012_content_rejection_approval_guard");
    expect(rejectionGuardMigration).toContain(
      "CONTENT_STATUS_TRANSITION_INVALID",
    );
    expect(rejectionGuardMigration).toContain(
      "CONTENT_REVIEW_VALIDATION_REQUIRED",
    );
    expect(journal).toContain("0013_content_approval_evidence_guard");
    expect(approvalEvidenceMigration).toContain(
      "CONTENT_REVIEW_EVIDENCE_REQUIRED",
    );
    expect(approvalEvidenceMigration).toContain(
      "CONTENT_APPROVAL_EVIDENCE_REQUIRED",
    );
    expect(approvalEvidenceMigration).toContain(
      "CONTENT_PHONE_PREVIEW_REQUIRED",
    );
    expect(journal).toContain("0014_publish_immutable_practice_sets");
    expect(publicationMigration).toContain(
      'ALTER TYPE "content_status" ADD VALUE IF NOT EXISTS \'published\'',
    );
    expect(journal).toContain("0015_publish_immutable_practice_set_schema");
    expect(publicationSchemaMigration).toContain('CREATE TABLE "practice_sets"');
    expect(publicationSchemaMigration).toContain('CREATE TABLE "practice_set_items"');
    expect(publicationSchemaMigration).toContain("PRACTICE_SET_SNAPSHOT_IMMUTABLE");
    expect(publicationSchemaMigration).toContain("PUBLISHED_CONTENT_IMMUTABLE");
    expect(publicationSchemaMigration).toContain(
      "PRACTICE_SET_COMPOSITION_IMMUTABLE",
    );
    expect(publicationSchemaMigration).toContain(
      'CREATE TABLE "practice_set_audit_events"',
    );
    expect(publicationSchemaMigration).toContain(
      "question_drafts_published_immutable",
    );
    expect(publicationSchemaMigration).toContain("practice_sets_immutable");
    expect(journal).toContain("0016_question_version_media");
    expect(questionMediaMigration).toContain(
      'CREATE TABLE "question_version_media"',
    );
    expect(questionMediaMigration).toContain("QUESTION_MEDIA_SCOPE_MISMATCH");
    expect(questionMediaMigration).toContain(
      "QUESTION_MEDIA_ASSOCIATION_IMMUTABLE",
    );
    expect(journal).toContain("0017_learner_practice_selection");
    expect(learnerPracticeMigration).toContain('CREATE TABLE "practice_attempts"');
    expect(learnerPracticeMigration).toContain('CREATE TABLE "practice_attempt_evidence"');
    expect(learnerPracticeMigration).toContain('CREATE TABLE "practice_recommendation_audits"');
    expect(learnerPracticeMigration).toContain("practice_sets_title_check");
    expect(learnerPracticeMigration).toContain("practice_attempts_id_set_unique");
    expect(learnerPracticeMigration).toContain("practice_attempt_evidence_attempt_set_fk");
    expect(learnerPracticeMigration).toContain("PRACTICE_ATTEMPT_EVIDENCE_REQUIRES_SUBMITTED_ATTEMPT");
    expect(journal).toContain("0018_practice_attempt_snapshot_metadata");
    expect(practiceSnapshotMigration).toContain('ADD COLUMN "practice_set_version_id" uuid');
    expect(practiceSnapshotMigration).toContain("practice_attempts_snapshot_check");
    expect(practiceSnapshotMigration).toContain("PRACTICE_ATTEMPT_SNAPSHOT_IMMUTABLE");
    expect(journal).toContain("0019_practice_attempt_responses_and_playback");
    expect(practiceResponseMigration).toContain('CREATE TABLE "practice_attempt_responses"');
    expect(practiceResponseMigration).toContain('CREATE TABLE "practice_attempt_playback_events"');
    expect(practiceResponseMigration).toContain("practice_attempt_responses_delete_guard");
    expect(practiceResponseMigration).toContain("m.media_type = 'audio'");
    const entries = JSON.parse(journal).entries as { idx: number; when: number; tag: string }[];
    expect(entries.map((entry) => entry.idx)).toEqual(entries.map((_, index) => index));
    expect(entries.map((entry) => entry.tag)).toEqual([...entries].sort((a, b) => a.tag.localeCompare(b.tag)).map((entry) => entry.tag));
    expect(entries.map((entry) => entry.when)).toEqual([...entries].sort((a, b) => a.when - b.when).map((entry) => entry.when));
    expect(journal).toContain("0020_practice_attempt_submission_review");
    expect(submissionReviewMigration).toContain('"submitted_title" text');
    expect(submissionReviewMigration).toContain('"playback_snapshot" jsonb');
    expect(submissionReviewMigration).toContain("PRACTICE_ATTEMPT_REVIEW_SCOPE_INVALID");
    expect(submissionReviewMigration).toContain("PRACTICE_ATTEMPT_REVIEW_SNAPSHOT_COMPLETE");
    expect(submissionReviewMigration).toContain("PRACTICE_ATTEMPT_REVIEW_SNAPSHOT_INCOMPLETE");
    expect(submissionReviewMigration).toContain("DEFERRABLE INITIALLY DEFERRED");
    expect(submissionReviewMigration).toContain("a.status = 'submitted'");
    expect(journal).toContain("0021_teacher_evidence_projection");
    expect(evidenceProjectionMigration).toContain('CREATE TABLE "submitted_evidence_facts"');
    expect(evidenceProjectionMigration).toContain("AUDIT_EVENT_IMMUTABLE");
  });

  it("enforces canonical email uniqueness in the migrated database", async () => {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
    try {
      const columns = await sql<
        { is_nullable: string }[]
      >`SELECT is_nullable FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'canonical_email'`;
      expect(columns).toEqual([{ is_nullable: "NO" }]);
      await sql
        .begin(async (transaction) => {
          const suffix = crypto.randomUUID();
          await transaction`INSERT INTO accounts (id, email, canonical_email, display_name, role) VALUES (${crypto.randomUUID()}, ${`Case-${suffix}@example.test`}, ${`case-${suffix}@example.test`}, 'Case', 'learner')`;
          await expect(
            transaction`INSERT INTO accounts (id, email, canonical_email, display_name, role) VALUES (${crypto.randomUUID()}, ${`case-${suffix}@example.test`}, ${`case-${suffix}@example.test`}, 'Duplicate', 'learner')`,
          ).rejects.toThrow();
          throw new Error("ROLLBACK_TEST_TRANSACTION");
        })
        .catch((error: unknown) => {
          if (
            !(error instanceof Error) ||
            error.message !== "ROLLBACK_TEST_TRANSACTION"
          )
            throw error;
        });
    } finally {
      await sql.end();
    }
  });

  it("enforces lifecycle evidence for direct migrated content status updates", async () => {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
    try {
      const tables = await sql<
        { table_name: string }[]
      >`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('curriculum_targets', 'curriculum_guidance', 'media_drafts', 'content_validation_results', 'content_review_records')`;
      if (tables.length !== 5) return;
      await sql
        .begin(async (transaction) => {
          const suffix = crypto.randomUUID();
          const accountId = crypto.randomUUID();
          const targetId = crypto.randomUUID();
          const guidanceId = crypto.randomUUID();
          const mediaId = crypto.randomUUID();
          const validationId = crypto.randomUUID();
          const reviewId = crypto.randomUUID();
          const approvalId = crypto.randomUUID();
          await transaction`INSERT INTO accounts (id, email, canonical_email, display_name, role) VALUES (${accountId}, ${`review-${suffix}@example.test`}, ${`review-${suffix}@example.test`}, 'Reviewer', 'academic_lead')`;
          await transaction`INSERT INTO curriculum_targets (id, canonical_id, category, guidance, is_approved, created_by) VALUES (${targetId}, ${`target-${suffix}`}, 'vocabulary', 'Controlled target', true, ${accountId})`;
          await transaction`INSERT INTO curriculum_guidance (id, paper, part, engine, topic, task_format, max_words, max_options, approved_names, approved_numbers) VALUES (${guidanceId}, 'reading_writing', 1, 'picture_true_false', 'Animals', 'Picture true false', 10, 2, '[]'::jsonb, '[]'::jsonb)`;
          await transaction`INSERT INTO media_drafts (id, status, origin, paper, part, engine, primary_target_id, supporting_target_ids, topic_ids, guidance_id, estimated_duration_seconds, accessibility_metadata, provenance, created_by, media_type, description) VALUES (${mediaId}, 'draft', 'manual', 'reading_writing', '1', 'picture_true_false', ${targetId}, '[]'::jsonb, ${JSON.stringify([targetId])}::jsonb, ${guidanceId}, '60', '{"altText":"A cat"}'::jsonb, '{"source":"Original","rightsReference":"Owned"}'::jsonb, ${accountId}, 'audio', 'Cat audio')`;
          await transaction`INSERT INTO content_generation_records (id, kind, target_id, gateway_kind, endpoint, model, prompt_provenance, reference_provenance, output_hash) VALUES (${crypto.randomUUID()}, 'media', ${mediaId}, 'image', 'https://provider.example.test', 'model', '{}'::jsonb, '[]'::jsonb, 'hash')`;
          await transaction`INSERT INTO content_audit_events (id, actor_id, action, kind, target_id) VALUES (${crypto.randomUUID()}, ${accountId}, 'MEDIA_DRAFT_CREATED', 'media', ${mediaId})`;
          await expect(transaction.savepoint((savepoint) => savepoint`UPDATE media_drafts SET description = 'Changed' WHERE id = ${mediaId}`)).rejects.toThrow(/CONTENT_DRAFT_HISTORY_IMMUTABLE/);
          await expect(transaction.savepoint((savepoint) => savepoint`UPDATE content_generation_records SET model = 'changed' WHERE target_id = ${mediaId}`)).rejects.toThrow(/CONTENT_DRAFT_HISTORY_IMMUTABLE/);
          await expect(transaction.savepoint((savepoint) => savepoint`DELETE FROM content_audit_events WHERE target_id = ${mediaId}`)).rejects.toThrow(/CONTENT_DRAFT_HISTORY_IMMUTABLE/);
          await expect(
            transaction`UPDATE media_drafts SET status = 'in_review' WHERE id = ${mediaId}`,
          ).rejects.toThrow(/CONTENT_REVIEW_EVIDENCE_REQUIRED/);
          await transaction`INSERT INTO content_validation_results (id, kind, target_id, actor_id, findings) VALUES (${validationId}, 'media', ${mediaId}, ${accountId}, '[]'::jsonb)`;
          await transaction`INSERT INTO content_review_records (id, kind, target_id, actor_id, decision, validation_result_id, findings) VALUES (${reviewId}, 'media', ${mediaId}, ${accountId}, 'submitted', ${validationId}, '[]'::jsonb)`;
          await transaction`UPDATE media_drafts SET status = 'in_review' WHERE id = ${mediaId}`;
          await expect(
            transaction`UPDATE media_drafts SET status = 'approved' WHERE id = ${mediaId}`,
          ).rejects.toThrow(/CONTENT_APPROVAL_EVIDENCE_REQUIRED/);
          await transaction`INSERT INTO content_review_records (id, kind, target_id, actor_id, decision, validation_result_id, findings) VALUES (${approvalId}, 'media', ${mediaId}, ${accountId}, 'approved', ${validationId}, '[]'::jsonb)`;
          await transaction`UPDATE media_drafts SET status = 'approved' WHERE id = ${mediaId}`;
          throw new Error("ROLLBACK_TEST_TRANSACTION");
        })
        .catch((error: unknown) => {
          if (
            !(error instanceof Error) ||
            error.message !== "ROLLBACK_TEST_TRANSACTION"
          )
            throw error;
        });
    } finally {
      await sql.end();
    }
  });
  it("rejects direct question-media association mutations and invalid lifecycle/scope inserts", async () => {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
    try {
      const tables = await sql<{ table_name: string }[]>`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('question_version_media', 'question_drafts', 'media_drafts', 'curriculum_targets', 'curriculum_guidance', 'answer_policies', 'answer_policy_versions')`;
      if (tables.length !== 7) return;
      await sql.begin(async (transaction) => {
        const suffix = crypto.randomUUID();
        const accountId = crypto.randomUUID();
        const targetId = crypto.randomUUID();
        const guidanceId = crypto.randomUUID();
        const policyId = crypto.randomUUID();
        const policyVersionId = crypto.randomUUID();
        const questionId = crypto.randomUUID();
        const matchingMediaId = crypto.randomUUID();
        const mismatchedMediaId = crypto.randomUUID();
        const associationId = crypto.randomUUID();
        const validationId = crypto.randomUUID();
        const reviewId = crypto.randomUUID();
        await transaction`INSERT INTO accounts (id, email, canonical_email, display_name, role) VALUES (${accountId}, ${`association-${suffix}@example.test`}, ${`association-${suffix}@example.test`}, 'Reviewer', 'academic_lead')`;
        await transaction`INSERT INTO curriculum_targets (id, canonical_id, category, guidance, is_approved, created_by) VALUES (${targetId}, ${`target-${suffix}`}, 'vocabulary', 'Controlled target', true, ${accountId})`;
        await transaction`INSERT INTO curriculum_guidance (id, paper, part, engine, topic, task_format, max_words, max_options, approved_names, approved_numbers) VALUES (${guidanceId}, 'reading_writing', 1, 'picture_true_false', 'Animals', 'Picture true false', 10, 2, '[]'::jsonb, '[]'::jsonb)`;
        await transaction`INSERT INTO answer_policies (id, canonical_id, target_id, guidance_id, paper, part, engine) VALUES (${policyId}, ${`policy-${suffix}`}, ${targetId}, ${guidanceId}, 'reading_writing', 1, 'picture_true_false')`;
        await transaction`INSERT INTO answer_policy_versions (id, policy_id, version, input_kind, canonical_answer, accepted_answers, normalisation, max_words, teacher_review_if_uncertain, created_by) VALUES (${policyVersionId}, ${policyId}, 1, 'boolean', 'true'::jsonb, '[]'::jsonb, '{}'::jsonb, 1, false, ${accountId})`;
        await transaction`INSERT INTO question_drafts (id, status, origin, paper, part, engine, primary_target_id, supporting_target_ids, topic_ids, guidance_id, estimated_duration_seconds, accessibility_metadata, provenance, created_by, answer_policy_version_id, prompt, options) VALUES (${questionId}, 'draft', 'manual', 'reading_writing', '1', 'picture_true_false', ${targetId}, '[]'::jsonb, ${JSON.stringify([targetId])}::jsonb, ${guidanceId}, '60', '{"altText":"A cat"}'::jsonb, '{"source":"Original","rightsReference":"Owned"}'::jsonb, ${accountId}, ${policyVersionId}, 'Cat', '["true","false"]'::jsonb)`;
        for (const [id, paper] of [[matchingMediaId, "reading_writing"], [mismatchedMediaId, "listening"]] as const)
          await transaction`INSERT INTO media_drafts (id, status, origin, paper, part, engine, primary_target_id, supporting_target_ids, topic_ids, guidance_id, estimated_duration_seconds, accessibility_metadata, provenance, created_by, media_type, description) VALUES (${id}, 'draft', 'manual', ${paper}, '1', 'picture_true_false', ${targetId}, '[]'::jsonb, ${JSON.stringify([targetId])}::jsonb, ${guidanceId}, '60', '{"altText":"A cat"}'::jsonb, '{"source":"Original","rightsReference":"Owned"}'::jsonb, ${accountId}, 'image', 'Cat image')`;
        await expect(transaction.savepoint((savepoint) => savepoint`INSERT INTO question_version_media (id, question_version_id, media_version_id, position) VALUES (${crypto.randomUUID()}, ${questionId}, ${mismatchedMediaId}, 1)`)).rejects.toThrow(/QUESTION_MEDIA_SCOPE_MISMATCH/);
        await transaction`INSERT INTO question_version_media (id, question_version_id, media_version_id, position) VALUES (${associationId}, ${questionId}, ${matchingMediaId}, 1)`;
        await expect(transaction.savepoint((savepoint) => savepoint`INSERT INTO question_version_media (id, question_version_id, media_version_id, position) VALUES (${crypto.randomUUID()}, ${questionId}, ${matchingMediaId}, 2)`)).rejects.toThrow(/question_version_media_question_media_unique/);
        await expect(transaction.savepoint((savepoint) => savepoint`UPDATE question_version_media SET position = 2 WHERE id = ${associationId}`)).rejects.toThrow(/QUESTION_MEDIA_ASSOCIATION_IMMUTABLE/);
        await expect(transaction.savepoint((savepoint) => savepoint`DELETE FROM question_version_media WHERE id = ${associationId}`)).rejects.toThrow(/QUESTION_MEDIA_ASSOCIATION_IMMUTABLE/);
        await transaction`INSERT INTO content_validation_results (id, kind, target_id, actor_id, findings) VALUES (${validationId}, 'question', ${questionId}, ${accountId}, '[]'::jsonb)`;
        await transaction`INSERT INTO content_review_records (id, kind, target_id, actor_id, decision, validation_result_id, findings) VALUES (${reviewId}, 'question', ${questionId}, ${accountId}, 'submitted', ${validationId}, '[]'::jsonb)`;
        await transaction`UPDATE question_drafts SET status = 'in_review' WHERE id = ${questionId}`;
        await expect(transaction.savepoint((savepoint) => savepoint`INSERT INTO question_version_media (id, question_version_id, media_version_id, position) VALUES (${crypto.randomUUID()}, ${questionId}, ${matchingMediaId}, 2)`)).rejects.toThrow(/QUESTION_MEDIA_QUESTION_NOT_DRAFT/);
        throw new Error("ROLLBACK_TEST_TRANSACTION");
      }).catch((error: unknown) => {
        if (!(error instanceof Error) || error.message !== "ROLLBACK_TEST_TRANSACTION") throw error;
      });
    } finally {
      await sql.end();
    }
  });
});
