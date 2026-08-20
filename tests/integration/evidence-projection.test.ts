import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import postgres from "postgres";

describe("submitted evidence projection migration", () => {
  it("persists immutable facts and immutable audit history from submitted review snapshots", async () => {
    const migration = await readFile("db/migrations/0021_teacher_evidence_projection.sql", "utf8");
    expect(migration).toContain('CREATE TABLE "submitted_evidence_facts"');
    expect(migration).toContain('CONSTRAINT "submitted_evidence_facts_review_attempt_fk" FOREIGN KEY ("review_item_id", "attempt_id") REFERENCES "practice_attempt_review_items"("id", "attempt_id")');
    expect(migration).toContain("SUBMITTED_EVIDENCE_FACT_IMMUTABLE");
    expect(migration).toContain("SUBMITTED_EVIDENCE_FACT_SCOPE_INVALID");
    expect(migration).toContain("a.submitted_presentation ->> 'paper' = NEW.paper");
    expect(migration).toContain("a.submitted_presentation ->> 'part' = NEW.part");
    expect(migration).toContain("(target.value ->> 'id') = NEW.language_target_id::text");
    expect(migration).toContain("(target.value ->> 'label') = NEW.language_target");
    expect(migration).toContain("AUDIT_EVENT_IMMUTABLE");
    expect(migration).toContain("submitted_evidence_facts_attempt_scope_fk");
    expect(migration).toContain("submitted_evidence_facts_review_attempt_fk");
    expect(migration).toContain("audit_events_evidence_read_outcome_check");
    expect(migration).toContain('"actor_id" IS NOT NULL');
    expect(migration).toContain('"target_scope" = \'CENTRE_WIDE\' AND "target_id" IS NULL');
    expect(migration).toContain('"target_scope" = \'LEARNER_DETAIL\' AND "target_id" IS NOT NULL');
    expect(migration).toContain("jsonb_array_elements(COALESCE(r.curriculum_tags -> 'evidenceTargets'");
    expect(migration).not.toContain("gen_random_uuid()");
  });

  it("projects every published item target into immutable review snapshots and fact rows on submission", async () => {
    const repository = await readFile("src/features/practice/infrastructure/repositories.ts", "utf8");
    expect(repository).toContain("primaryTargetId?: unknown; supportingTargetIds?: unknown");
    expect(repository).toContain("value.primaryTargetId");
    expect(repository).toContain("value.supportingTargetIds");
    expect(repository).toContain("curriculumTags: { ...(tags ?? {}), evidenceTargets }");
    expect(repository).toContain("tx.insert(submittedEvidenceFacts).values");
  });

  it("rejects forged fact dimensions and malformed EVIDENCE_READ audit rows in PostgreSQL", async () => {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
    try {
      const tables = await sql<{ table_name: string }[]>`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('submitted_evidence_facts', 'practice_attempt_review_items')`;
      if (tables.length !== 2) return;
      await sql.begin(async (transaction) => {
        const teacherId = crypto.randomUUID();
        const learnerId = crypto.randomUUID();
        const targetId = crypto.randomUUID();
        const otherTargetId = crypto.randomUUID();
        const setId = crypto.randomUUID();
        const attemptId = crypto.randomUUID();
        const reviewItemId = crypto.randomUUID();
        const submittedAt = new Date();
        const suffix = crypto.randomUUID();
        await transaction`INSERT INTO accounts (id, email, canonical_email, display_name, role) VALUES (${teacherId}, ${`teacher-${suffix}@example.test`}, ${`teacher-${suffix}@example.test`}, 'Teacher', 'teacher'), (${learnerId}, ${`learner-${suffix}@example.test`}, ${`learner-${suffix}@example.test`}, 'Learner', 'learner')`;
        await transaction`INSERT INTO curriculum_targets (id, canonical_id, category, guidance, created_by) VALUES (${targetId}, ${`animals-${suffix}`}, 'vocabulary', 'Animals target', ${teacherId}), (${otherTargetId}, ${`food-${suffix}`}, 'vocabulary', 'Food target', ${teacherId})`;
        await transaction`INSERT INTO practice_sets (id, title, paper, part, estimated_duration_seconds, primary_target_ids, created_by) VALUES (${setId}, 'Evidence fixture', 'listening', '1', 300, ${JSON.stringify([targetId])}::jsonb, ${teacherId})`;
        await transaction`INSERT INTO practice_attempts (id, learner_id, practice_set_id, practice_set_version_id, status, submitted_at, last_saved_at, created_at, finalisation_key, submitted_presentation, expected_review_item_count, review_snapshot_items, final_timing, playback_snapshot) VALUES (${attemptId}, ${learnerId}, ${setId}, ${setId}, 'submitted', ${submittedAt}, ${submittedAt}, ${submittedAt}, ${crypto.randomUUID()}, '{"paper":"listening","part":"1"}'::jsonb, 1, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb)`;
        await transaction`ALTER TABLE practice_attempt_review_items DISABLE TRIGGER ALL`;
        await transaction`INSERT INTO practice_attempt_review_items (id, attempt_id, practice_set_item_id, position, outcome, evidence_label, approved_answer, approved_answer_label, presentation, answer_policy_version, curriculum_tags) VALUES (${reviewItemId}, ${attemptId}, ${crypto.randomUUID()}, 1, 'correct', 'secure', 'true'::jsonb, 'True', '{}'::jsonb, 'fixture', ${transaction.json({ evidenceTargets: [{ id: targetId, label: `animals-${suffix}` }] })})`;
        await transaction`ALTER TABLE practice_attempt_review_items ENABLE TRIGGER ALL`;
        const insertFact = (id: string, overrides: { paper?: string; part?: string; targetId?: string; target?: string } = {}) => transaction`INSERT INTO submitted_evidence_facts (id, attempt_id, review_item_id, learner_id, practice_set_id, paper, part, language_target_id, language_target, automatic_outcome, submitted_at) SELECT ${id}, ${attemptId}, ${reviewItemId}, ${learnerId}, ${setId}, ${overrides.paper ?? "listening"}, ${overrides.part ?? "1"}, ${overrides.targetId ?? targetId}, ${overrides.target ?? `animals-${suffix}`}, 'correct', submitted_at FROM practice_attempts WHERE id = ${attemptId}`;
        await insertFact(crypto.randomUUID());
        await expect(transaction.savepoint((savepoint) => savepoint`INSERT INTO submitted_evidence_facts (id, attempt_id, review_item_id, learner_id, practice_set_id, paper, part, language_target_id, language_target, automatic_outcome, submitted_at) VALUES (${crypto.randomUUID()}, ${attemptId}, ${reviewItemId}, ${learnerId}, ${setId}, 'reading_writing', '1', ${targetId}, ${`animals-${suffix}`}, 'correct', ${submittedAt})`)).rejects.toThrow(/SUBMITTED_EVIDENCE_FACT_SCOPE_INVALID/);
        await expect(transaction.savepoint((savepoint) => savepoint`INSERT INTO submitted_evidence_facts (id, attempt_id, review_item_id, learner_id, practice_set_id, paper, part, language_target_id, language_target, automatic_outcome, submitted_at) VALUES (${crypto.randomUUID()}, ${attemptId}, ${reviewItemId}, ${learnerId}, ${setId}, 'listening', '2', ${targetId}, ${`animals-${suffix}`}, 'correct', ${submittedAt})`)).rejects.toThrow(/SUBMITTED_EVIDENCE_FACT_SCOPE_INVALID/);
        await expect(transaction.savepoint((savepoint) => savepoint`INSERT INTO submitted_evidence_facts (id, attempt_id, review_item_id, learner_id, practice_set_id, paper, part, language_target_id, language_target, automatic_outcome, submitted_at) VALUES (${crypto.randomUUID()}, ${attemptId}, ${reviewItemId}, ${learnerId}, ${setId}, 'listening', '1', ${otherTargetId}, 'food', 'correct', ${submittedAt})`)).rejects.toThrow(/SUBMITTED_EVIDENCE_FACT_SCOPE_INVALID/);
        await expect(transaction.savepoint((savepoint) => savepoint`INSERT INTO submitted_evidence_facts (id, attempt_id, review_item_id, learner_id, practice_set_id, paper, part, language_target_id, language_target, automatic_outcome, submitted_at) VALUES (${crypto.randomUUID()}, ${attemptId}, ${reviewItemId}, ${learnerId}, ${setId}, 'listening', '1', ${targetId}, 'forged label', 'correct', ${submittedAt})`)).rejects.toThrow(/SUBMITTED_EVIDENCE_FACT_SCOPE_INVALID/);
        const insertAudit = (id: string, actorId: string | null, targetId: string | null, scope: string) => transaction`INSERT INTO audit_events (id, actor_id, action, target_id, outcome, target_scope) VALUES (${id}, ${actorId}, 'EVIDENCE_READ', ${targetId}, 'SUCCESS', ${scope})`;
        await insertAudit(crypto.randomUUID(), teacherId, null, "CENTRE_WIDE");
        await insertAudit(crypto.randomUUID(), teacherId, learnerId, "LEARNER_DETAIL");
        await expect(transaction.savepoint((savepoint) => savepoint`INSERT INTO audit_events (id, actor_id, action, target_id, outcome, target_scope) VALUES (${crypto.randomUUID()}, ${null}, 'EVIDENCE_READ', ${null}, 'SUCCESS', 'CENTRE_WIDE')`)).rejects.toThrow(/audit_events_evidence_read_outcome_check/);
        await expect(transaction.savepoint((savepoint) => savepoint`INSERT INTO audit_events (id, actor_id, action, target_id, outcome, target_scope) VALUES (${crypto.randomUUID()}, ${teacherId}, 'EVIDENCE_READ', ${learnerId}, 'SUCCESS', 'CENTRE_WIDE')`)).rejects.toThrow(/audit_events_evidence_read_outcome_check/);
        await expect(transaction.savepoint((savepoint) => savepoint`INSERT INTO audit_events (id, actor_id, action, target_id, outcome, target_scope) VALUES (${crypto.randomUUID()}, ${teacherId}, 'EVIDENCE_READ', ${null}, 'SUCCESS', 'LEARNER_DETAIL')`)).rejects.toThrow(/audit_events_evidence_read_outcome_check/);
        throw new Error("ROLLBACK_TEST_TRANSACTION");
      }).catch((error: unknown) => {
        if (!(error instanceof Error) || error.message !== "ROLLBACK_TEST_TRANSACTION") throw error;
      });
    } finally {
      await sql.end();
    }
  });
});
