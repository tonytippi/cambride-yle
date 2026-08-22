import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { appendTeacherEvidenceResolution, listRecentSubmittedEvidence, submittedEvidenceReader } from "@/features/practice/infrastructure/repositories";

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
    expect(repository).toContain("dimensions: snapshotDimensions(tags), evidenceTargets");
    expect(repository).toContain("tx.insert(submittedEvidenceFacts).values");
  });

  it("adds immutable submitted filter dimensions without deriving historical values", async () => {
    const migration = await readFile("db/migrations/0022_teacher_evidence_filter_drilldown.sql", "utf8");
    expect(migration).toContain('ADD COLUMN "dimensions" jsonb NOT NULL');
    expect(migration).toContain("Historical rows deliberately remain empty");
    expect(migration).toContain("SUBMITTED_EVIDENCE_FACT_DIMENSIONS_INVALID");
    expect(migration).toContain("r.curriculum_tags -> 'dimensions'");
  });

  it("returns each submitted review item once when it has multiple evidence targets", async () => {
    const repository = await readFile("src/features/practice/infrastructure/repositories.ts", "utf8");
    expect(repository).toContain("new Map(details.map((detail) => [detail.reviewItemId, detail]))");
  });

  it("defines append-only, evidence-scoped resolutions and action-scoped audit targets", async () => {
    const migration = await readFile("db/migrations/0024_teacher_evidence_resolution.sql", "utf8");
    expect(migration).toContain('CREATE TABLE "teacher_evidence_resolutions"');
    expect(migration).toContain("TEACHER_EVIDENCE_RESOLUTION_IMMUTABLE");
    expect(migration).toContain('FROM "submitted_evidence_facts" fact');
    expect(migration).toContain("enforce_audit_event_target_scope");
    expect(migration).toContain("NEW.action = 'EVIDENCE_RESOLUTION'");
    expect(migration).toContain("FROM \"accounts\" WHERE id = NEW.target_id");
  });

  it("persists effective resolution history while protecting submitted review output", async () => {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
    try {
      const tables = await sql<{ table_name: string }[]>`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('teacher_evidence_resolutions', 'submitted_evidence_facts')`;
      if (tables.length !== 2) return;
      await sql.begin(async (transaction) => {
        const suffix = crypto.randomUUID();
        const leadId = crypto.randomUUID(); const learnerId = crypto.randomUUID(); const targetId = crypto.randomUUID(); const setId = crypto.randomUUID(); const attemptId = crypto.randomUUID(); const itemId = crypto.randomUUID(); const reviewId = crypto.randomUUID(); const noFactReviewId = crypto.randomUUID(); const submittedAt = new Date();
        await transaction`INSERT INTO accounts (id, email, canonical_email, display_name, role) VALUES (${leadId}, ${`lead-${suffix}@example.test`}, ${`lead-${suffix}@example.test`}, 'Lead', 'academic_lead'), (${learnerId}, ${`learner-${suffix}@example.test`}, ${`learner-${suffix}@example.test`}, 'Learner', 'learner')`;
        await transaction`INSERT INTO curriculum_targets (id, canonical_id, category, guidance, created_by) VALUES (${targetId}, ${`target-${suffix}`}, 'vocabulary', 'Target', ${leadId})`;
        await transaction`INSERT INTO practice_sets (id, title, paper, part, estimated_duration_seconds, primary_target_ids, created_by) VALUES (${setId}, 'Set', 'listening', '1', 300, ${JSON.stringify([targetId])}::jsonb, ${leadId})`;
        await transaction`INSERT INTO practice_attempts (id, learner_id, practice_set_id, practice_set_version_id, status, submitted_at, last_saved_at, created_at, finalisation_key, submitted_presentation, expected_review_item_count, review_snapshot_items, final_timing, playback_snapshot) VALUES (${attemptId}, ${learnerId}, ${setId}, ${setId}, 'submitted', ${submittedAt}, ${submittedAt}, ${submittedAt}, ${crypto.randomUUID()}, '{"paper":"listening","part":"1"}'::jsonb, 1, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb)`;
        await transaction`ALTER TABLE practice_attempt_review_items DISABLE TRIGGER ALL`;
        await transaction`INSERT INTO practice_attempt_review_items (id, attempt_id, practice_set_item_id, position, response, outcome, evidence_label, approved_answer, approved_answer_label, presentation, answer_policy_version, curriculum_tags) VALUES (${reviewId}, ${attemptId}, ${itemId}, 1, '"learner response"'::jsonb, 'needs_teacher_review', 'not_assessed_yet', '"approved"'::jsonb, 'Approved', '{}'::jsonb, 'fixture', ${transaction.json({ evidenceTargets: [{ id: targetId, label: `target-${suffix}` }] })})`;
        await transaction`INSERT INTO practice_attempt_review_items (id, attempt_id, practice_set_item_id, position, outcome, evidence_label, approved_answer, approved_answer_label, presentation, answer_policy_version, curriculum_tags) VALUES (${noFactReviewId}, ${attemptId}, ${crypto.randomUUID()}, 2, 'needs_teacher_review', 'not_assessed_yet', '"approved"'::jsonb, 'Approved', '{}'::jsonb, 'fixture', ${transaction.json({ evidenceTargets: [{ id: targetId, label: `target-${suffix}` }] })})`;
        await transaction`ALTER TABLE practice_attempt_review_items ENABLE TRIGGER ALL`;
        await transaction`INSERT INTO submitted_evidence_facts (id, attempt_id, review_item_id, learner_id, practice_set_id, paper, part, language_target_id, language_target, automatic_outcome, dimensions, submitted_at) VALUES (${crypto.randomUUID()}, ${attemptId}, ${reviewId}, ${learnerId}, ${setId}, 'listening', '1', ${targetId}, ${`target-${suffix}`}, 'needs_teacher_review', '{}'::jsonb, ${submittedAt})`;
        await transaction`INSERT INTO teacher_evidence_resolutions (id, review_item_id, revision, effective_outcome, reason, resolver_id) VALUES (${crypto.randomUUID()}, ${reviewId}, 1, 'correct', 'Accepted answer', ${leadId}), (${crypto.randomUUID()}, ${reviewId}, 2, 'incorrect', 'Correction', ${leadId})`;
        await expect(transaction.savepoint((savepoint) => savepoint`UPDATE teacher_evidence_resolutions SET reason = 'Changed' WHERE review_item_id = ${reviewId}`)).rejects.toThrow(/TEACHER_EVIDENCE_RESOLUTION_IMMUTABLE/);
        await expect(transaction.savepoint((savepoint) => savepoint`INSERT INTO teacher_evidence_resolutions (id, review_item_id, revision, effective_outcome, reason, resolver_id) VALUES (${crypto.randomUUID()}, ${reviewId}, 2, 'correct', 'Stale', ${leadId})`)).rejects.toThrow(/teacher_evidence_resolutions_review_revision_unique/);
        await expect(transaction.savepoint((savepoint) => savepoint`INSERT INTO teacher_evidence_resolutions (id, review_item_id, revision, effective_outcome, reason, resolver_id) VALUES (${crypto.randomUUID()}, ${noFactReviewId}, 1, 'correct', 'No evidence fact', ${leadId})`)).rejects.toThrow(/TEACHER_RESOLUTION_SCOPE_INVALID/);
        const current = await transaction<{ effective_outcome: string; revision: number }[]>`SELECT effective_outcome::text, revision FROM teacher_evidence_resolutions WHERE review_item_id = ${reviewId} ORDER BY revision DESC LIMIT 1`;
        expect(current).toEqual([{ effective_outcome: "incorrect", revision: 2 }]);
        const effective = await transaction<{ effective_outcome: string; resolution_revision: number }[]>`SELECT COALESCE((SELECT effective_outcome::text FROM teacher_evidence_resolutions resolution WHERE resolution.review_item_id = fact.review_item_id ORDER BY revision DESC LIMIT 1), fact.automatic_outcome::text) AS effective_outcome, COALESCE((SELECT revision FROM teacher_evidence_resolutions resolution WHERE resolution.review_item_id = fact.review_item_id ORDER BY revision DESC LIMIT 1), 0) AS resolution_revision FROM submitted_evidence_facts fact WHERE fact.review_item_id = ${reviewId}`;
        expect(effective).toEqual([{ effective_outcome: "incorrect", resolution_revision: 2 }]);
        const review = await transaction<{ outcome: string; response: string }[]>`SELECT outcome, response::text FROM practice_attempt_review_items WHERE id = ${reviewId}`;
        expect(review).toEqual([{ outcome: "needs_teacher_review", response: '"learner response"' }]);
        await expect(transaction.savepoint((savepoint) => savepoint`INSERT INTO audit_events (id, actor_id, action, target_id, target_scope, outcome) VALUES (${crypto.randomUUID()}, ${leadId}, 'EVIDENCE_RESOLUTION', ${crypto.randomUUID()}, 'REVIEW_ITEM', 'SUCCESS')`)).rejects.toThrow(/AUDIT_EVENT_TARGET_SCOPE_INVALID/);
        throw new Error("ROLLBACK_TEST_TRANSACTION");
      }).catch((error: unknown) => { if (!(error instanceof Error) || error.message !== "ROLLBACK_TEST_TRANSACTION") throw error; });
    } finally { await sql.end(); }
  });

  it("appends a resolution and derives current evidence without updating immutable submission snapshots", async () => {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
    try {
      const tables = await sql<{ table_name: string }[]>`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('teacher_evidence_resolutions', 'submitted_evidence_facts', 'practice_attempt_evidence')`;
      if (tables.length !== 3) return;
      const suffix = crypto.randomUUID();
      const leadId = crypto.randomUUID(); const learnerId = crypto.randomUUID(); const targetId = crypto.randomUUID(); const setId = crypto.randomUUID(); const attemptId = crypto.randomUUID(); const itemId = crypto.randomUUID(); const reviewId = crypto.randomUUID(); const submittedAt = new Date(); const targetLabel = `target-${suffix}`;
      await sql.begin(async (transaction) => {
        await transaction`INSERT INTO accounts (id, email, canonical_email, display_name, role) VALUES (${leadId}, ${`lead-${suffix}@example.test`}, ${`lead-${suffix}@example.test`}, 'Lead', 'academic_lead'), (${learnerId}, ${`learner-${suffix}@example.test`}, ${`learner-${suffix}@example.test`}, 'Learner', 'learner')`;
        await transaction`INSERT INTO curriculum_targets (id, canonical_id, category, guidance, created_by) VALUES (${targetId}, ${`target-${suffix}`}, 'vocabulary', 'Target', ${leadId})`;
        await transaction`INSERT INTO practice_sets (id, title, paper, part, estimated_duration_seconds, primary_target_ids, created_by) VALUES (${setId}, 'Set', 'listening', '1', 300, ${JSON.stringify([targetId])}::jsonb, ${leadId})`;
        await transaction`INSERT INTO practice_attempts (id, learner_id, practice_set_id, practice_set_version_id, status, submitted_at, last_saved_at, created_at, finalisation_key, submitted_presentation, expected_review_item_count, review_snapshot_items, final_timing, playback_snapshot) VALUES (${attemptId}, ${learnerId}, ${setId}, ${setId}, 'submitted', ${submittedAt}, ${submittedAt}, ${submittedAt}, ${crypto.randomUUID()}, '{"paper":"listening","part":"1"}'::jsonb, 1, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb)`;
        await transaction`ALTER TABLE practice_attempt_review_items DISABLE TRIGGER ALL`;
        await transaction`INSERT INTO practice_attempt_review_items (id, attempt_id, practice_set_item_id, position, response, outcome, evidence_label, approved_answer, approved_answer_label, presentation, answer_policy_version, curriculum_tags) VALUES (${reviewId}, ${attemptId}, ${itemId}, 1, '"learner response"'::jsonb, 'needs_teacher_review', 'not_assessed_yet', '"approved"'::jsonb, 'Approved', '{}'::jsonb, 'fixture', ${transaction.json({ evidenceTargets: [{ id: targetId, label: targetLabel }] })})`;
        await transaction`ALTER TABLE practice_attempt_review_items ENABLE TRIGGER ALL`;
        await transaction`INSERT INTO submitted_evidence_facts (id, attempt_id, review_item_id, learner_id, practice_set_id, paper, part, language_target_id, language_target, automatic_outcome, dimensions, submitted_at) VALUES (${crypto.randomUUID()}, ${attemptId}, ${reviewId}, ${learnerId}, ${setId}, 'listening', '1', ${targetId}, ${targetLabel}, 'needs_teacher_review', '{}'::jsonb, ${submittedAt})`;
        await transaction`INSERT INTO practice_attempt_evidence (id, attempt_id, practice_set_id, practice_area_id, label) VALUES (${crypto.randomUUID()}, ${attemptId}, ${setId}, ${targetId}, 'not_assessed_yet')`;
      });
      await expect(appendTeacherEvidenceResolution({ reviewItemId: reviewId, outcome: "correct", reason: "Accepted answer", expectedRevision: 0, resolverId: leadId })).resolves.toEqual({ revision: 1, effectiveOutcome: "correct" });
      const [resolution, audit, snapshot] = await Promise.all([
        sql<{ revision: number; effective_outcome: string }[]>`SELECT revision, effective_outcome::text FROM teacher_evidence_resolutions WHERE review_item_id = ${reviewId}`,
        sql<{ outcome: string }[]>`SELECT outcome FROM audit_events WHERE actor_id = ${leadId} AND action = 'EVIDENCE_RESOLUTION' AND target_id = ${reviewId}`,
        sql<{ outcome: string; response: string; evidence_label: string; label: string }[]>`SELECT review.outcome::text, review.response::text, review.evidence_label::text, evidence.label::text FROM practice_attempt_review_items review JOIN practice_attempt_evidence evidence ON evidence.attempt_id = review.attempt_id WHERE review.id = ${reviewId}`,
      ]);
      expect(resolution).toEqual([{ revision: 1, effective_outcome: "correct" }]);
      expect(audit).toEqual([{ outcome: "SUCCESS" }]);
      expect(snapshot).toEqual([{ outcome: "needs_teacher_review", response: '"learner response"', evidence_label: "not_assessed_yet", label: "not_assessed_yet" }]);
      expect((await submittedEvidenceReader.listSubmittedEvidenceFacts()).find((fact) => fact.attemptId === attemptId)?.effectiveOutcome).toBe("correct");
      expect((await listRecentSubmittedEvidence(learnerId, new Date(submittedAt.getTime() - 1))).find((evidence) => evidence.attemptId === attemptId)?.label).toBe("secure");
      await expect(appendTeacherEvidenceResolution({ reviewItemId: reviewId, outcome: "incorrect", reason: "Stale correction", expectedRevision: 0, resolverId: leadId })).resolves.toEqual({ error: "TEACHER_RESOLUTION_CONFLICT" });
      expect(await sql<{ count: string }[]>`SELECT count(*) FROM teacher_evidence_resolutions WHERE review_item_id = ${reviewId}`).toEqual([{ count: "1" }]);
      expect((await listRecentSubmittedEvidence(learnerId, new Date(submittedAt.getTime() - 1))).find((evidence) => evidence.attemptId === attemptId)?.label).toBe("secure");
      await expect(appendTeacherEvidenceResolution({ reviewItemId: reviewId, outcome: "incorrect", reason: "Correction", expectedRevision: 1, resolverId: leadId })).resolves.toEqual({ revision: 2, effectiveOutcome: "incorrect" });
      expect((await listRecentSubmittedEvidence(learnerId, new Date(submittedAt.getTime() - 1))).find((evidence) => evidence.attemptId === attemptId)?.label).toBe("needs_practice");
    } finally { await sql.end(); }
  });

  it("rejects forged fact dimensions and malformed EVIDENCE_READ audit rows in PostgreSQL", async () => {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
    try {
      const tables = await sql<{ table_name: string }[]>`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('submitted_evidence_facts', 'practice_attempt_review_items')`;
      if (tables.length !== 2) return;
      const dimensions = await sql<{ column_name: string }[]>`SELECT column_name FROM information_schema.columns WHERE table_name = 'submitted_evidence_facts' AND column_name = 'dimensions'`;
      if (!dimensions.length) return;
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
        const insertFact = (id: string, overrides: { paper?: string; part?: string; targetId?: string; target?: string; dimensions?: Record<string, string[] | string> } = {}) => transaction`INSERT INTO submitted_evidence_facts (id, attempt_id, review_item_id, learner_id, practice_set_id, paper, part, language_target_id, language_target, automatic_outcome, dimensions, submitted_at) SELECT ${id}, ${attemptId}, ${reviewItemId}, ${learnerId}, ${setId}, ${overrides.paper ?? "listening"}, ${overrides.part ?? "1"}, ${overrides.targetId ?? targetId}, ${overrides.target ?? `animals-${suffix}`}, 'correct', ${transaction.json(overrides.dimensions ?? {})}, submitted_at FROM practice_attempts WHERE id = ${attemptId}`;
        await insertFact(crypto.randomUUID());
        await expect(transaction.savepoint((savepoint) => savepoint`INSERT INTO submitted_evidence_facts (id, attempt_id, review_item_id, learner_id, practice_set_id, paper, part, language_target_id, language_target, automatic_outcome, submitted_at) VALUES (${crypto.randomUUID()}, ${attemptId}, ${reviewItemId}, ${learnerId}, ${setId}, 'reading_writing', '1', ${targetId}, ${`animals-${suffix}`}, 'correct', ${submittedAt})`)).rejects.toThrow(/SUBMITTED_EVIDENCE_FACT_SCOPE_INVALID/);
        await expect(transaction.savepoint((savepoint) => savepoint`INSERT INTO submitted_evidence_facts (id, attempt_id, review_item_id, learner_id, practice_set_id, paper, part, language_target_id, language_target, automatic_outcome, submitted_at) VALUES (${crypto.randomUUID()}, ${attemptId}, ${reviewItemId}, ${learnerId}, ${setId}, 'listening', '2', ${targetId}, ${`animals-${suffix}`}, 'correct', ${submittedAt})`)).rejects.toThrow(/SUBMITTED_EVIDENCE_FACT_SCOPE_INVALID/);
        await expect(transaction.savepoint((savepoint) => savepoint`INSERT INTO submitted_evidence_facts (id, attempt_id, review_item_id, learner_id, practice_set_id, paper, part, language_target_id, language_target, automatic_outcome, submitted_at) VALUES (${crypto.randomUUID()}, ${attemptId}, ${reviewItemId}, ${learnerId}, ${setId}, 'listening', '1', ${otherTargetId}, 'food', 'correct', ${submittedAt})`)).rejects.toThrow(/SUBMITTED_EVIDENCE_FACT_SCOPE_INVALID/);
        await expect(transaction.savepoint((savepoint) => savepoint`INSERT INTO submitted_evidence_facts (id, attempt_id, review_item_id, learner_id, practice_set_id, paper, part, language_target_id, language_target, automatic_outcome, submitted_at) VALUES (${crypto.randomUUID()}, ${attemptId}, ${reviewItemId}, ${learnerId}, ${setId}, 'listening', '1', ${targetId}, 'forged label', 'correct', ${submittedAt})`)).rejects.toThrow(/SUBMITTED_EVIDENCE_FACT_SCOPE_INVALID/);
        await expect(transaction.savepoint(() => insertFact(crypto.randomUUID(), { dimensions: { topic: ["Forged"] } }))).rejects.toThrow(/SUBMITTED_EVIDENCE_FACT_SCOPE_INVALID/);
        await expect(transaction.savepoint(() => insertFact(crypto.randomUUID(), { dimensions: { topic: "Forged" } }))).rejects.toThrow(/SUBMITTED_EVIDENCE_FACT_DIMENSIONS_INVALID/);
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
