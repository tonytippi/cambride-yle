import { describe, expect, it } from "vitest";
import postgres from "postgres";
import { approvePracticeSet, createPracticeSetDraft, publishPracticeSet, retirePracticeSet, submitPracticeSetForReview } from "@/features/content/application/content";
import {
  getPracticePlayer,
  savePracticeResponse,
  startPractice,
  submitPracticeAttempt,
} from "@/features/practice/application/practice";

const lead = (id: string) => ({
  id,
  email: "lead@example.test",
  displayName: "Lead",
  role: "academic_lead" as const,
});

const learner = (id: string) => ({
  id,
  email: "learner@example.test",
  displayName: "Learner",
  role: "learner" as const,
});
const admin = (id: string) => ({ id, email: "admin@example.test", displayName: "Admin", role: "admin" as const });

describe("published practice snapshots", () => {
  it("publishes a current policy snapshot that a learner can score and submit", async () => {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
    try {
      const tables = await sql<{ table_name: string }[]>`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('practice_sets', 'practice_attempts', 'answer_policy_versions', 'submitted_evidence_facts')`;
      if (tables.length !== 4) return;

      const suffix = crypto.randomUUID();
      const leadId = crypto.randomUUID();
      const learnerId = crypto.randomUUID();
      const freshLearnerId = crypto.randomUUID();
      const adminId = crypto.randomUUID();
      const targetId = crypto.randomUUID();
      const guidanceId = crypto.randomUUID();
      const policyId = crypto.randomUUID();
      const policyVersionId = crypto.randomUUID();
      const questionId = crypto.randomUUID();
      await sql`INSERT INTO accounts (id, email, canonical_email, display_name, role) VALUES (${leadId}, ${`lead-${suffix}@example.test`}, ${`lead-${suffix}@example.test`}, 'Lead', 'academic_lead'), (${adminId}, ${`admin-${suffix}@example.test`}, ${`admin-${suffix}@example.test`}, 'Admin', 'admin'), (${learnerId}, ${`learner-${suffix}@example.test`}, ${`learner-${suffix}@example.test`}, 'Learner', 'learner'), (${freshLearnerId}, ${`fresh-${suffix}@example.test`}, ${`fresh-${suffix}@example.test`}, 'Fresh learner', 'learner')`;
      await sql`INSERT INTO curriculum_targets (id, canonical_id, category, guidance, is_approved, created_by) VALUES (${targetId}, ${`animals-${suffix}`}, 'vocabulary', 'Animal vocabulary', true, ${leadId})`;
      await sql`INSERT INTO curriculum_guidance (id, paper, part, engine, topic, task_format, max_words, max_options, approved_names, approved_numbers) VALUES (${guidanceId}, 'reading_writing', 1, 'word_bank_cloze', ${`Animals ${suffix}`}, ${`Word bank cloze ${suffix}`}, 10, 2, '[]'::jsonb, '[]'::jsonb)`;
      await sql`INSERT INTO answer_policies (id, canonical_id, target_id, guidance_id, paper, part, engine) VALUES (${policyId}, ${`policy-${suffix}`}, ${targetId}, ${guidanceId}, 'reading_writing', 1, 'word_bank_cloze')`;
      await sql`INSERT INTO answer_policy_versions (id, policy_id, version, input_kind, canonical_answer, accepted_answers, normalisation, max_words, teacher_review_if_uncertain, created_by) VALUES (${policyVersionId}, ${policyId}, 1, 'word', '"cat"'::jsonb, '[]'::jsonb, '{"unicode":"NFC","locale":"en-GB","caseSensitive":false,"trimWhitespace":true,"normalizePunctuation":false,"normalizeNumberForms":false}'::jsonb, 1, false, ${leadId})`;
      await sql`INSERT INTO question_drafts (id, status, origin, paper, part, engine, primary_target_id, supporting_target_ids, topic_ids, guidance_id, estimated_duration_seconds, accessibility_metadata, provenance, created_by, answer_policy_version_id, prompt, options) VALUES (${questionId}, 'published', 'manual', 'reading_writing', '1', 'word_bank_cloze', ${targetId}, '[]'::jsonb, ${JSON.stringify([targetId])}::jsonb, ${guidanceId}, '300', '{"altText":"A cat"}'::jsonb, '{"source":"Original staff writing","rightsReference":"Centre-owned"}'::jsonb, ${leadId}, ${policyVersionId}, 'Choose the animal.', '["cat","dog"]'::jsonb)`;

      const setId = await createPracticeSetDraft(lead(leadId), {
        title: "Animal word practice",
        questionIds: [questionId],
      });
      await submitPracticeSetForReview(lead(leadId), { practiceSetId: setId });
      await approvePracticeSet(admin(adminId), { practiceSetId: setId });
      await publishPracticeSet(lead(leadId), { practiceSetId: setId });
      const [snapshot] = await sql<{ answer_policy: { canonicalAnswer?: string; version?: unknown } }[]>`SELECT answer_policy FROM practice_set_items WHERE practice_set_id = ${setId}`;
      expect(snapshot.answer_policy).toMatchObject({
        canonicalAnswer: "cat",
        inputKind: "word",
        policyId,
      });
      expect(snapshot.answer_policy.version).toBe(1);
      expect(snapshot.answer_policy).not.toHaveProperty("version.canonicalAnswer");

      const started = await startPractice(learner(learnerId), { setId });
      expect(started).toMatchObject({ data: { setId, revision: 0, disposition: "started" } });
      if (!("data" in started)) throw new Error("Practice did not start");

       const player = await getPracticePlayer(learner(learnerId), {
        setId,
        attemptId: started.data.attemptId,
      });
      expect(player).toMatchObject({ data: { items: [{ engine: "word_bank_cloze" }] } });
       if (!("data" in player)) throw new Error("Practice player was invalid");

       await retirePracticeSet(admin(adminId), { practiceSetId: setId });
       await expect(startPractice(learner(freshLearnerId), { setId })).resolves.toMatchObject({ error: { code: "SET_RETIRED" } });
       await expect(getPracticePlayer(learner(learnerId), { setId, attemptId: started.data.attemptId })).resolves.toMatchObject({ data: { attemptId: started.data.attemptId } });

      const saved = await savePracticeResponse(learner(learnerId), {
        setId,
        attemptId: started.data.attemptId,
        itemId: player.data.items[0]!.id,
        expectedRevision: player.data.revision,
        value: "cat",
      });
      expect(saved).toEqual({ data: { revision: 1 } });
      await expect(
        submitPracticeAttempt(learner(learnerId), {
          setId,
          attemptId: started.data.attemptId,
          expectedRevision: 1,
          idempotencyKey: crypto.randomUUID(),
        }),
      ).resolves.toMatchObject({ data: { attemptId: started.data.attemptId, setId, revision: 2 } });
       await expect(sql<{ outcome: string }[]>`SELECT outcome::text FROM practice_attempt_review_items WHERE attempt_id = ${started.data.attemptId}`).resolves.toEqual([{ outcome: "correct" }]);
       await expect((await import("@/features/practice/application/practice")).getSubmittedPracticeReview(learner(learnerId), { setId, attemptId: started.data.attemptId })).resolves.toMatchObject({ data: { attemptId: started.data.attemptId, items: [{ outcome: "correct" }] } });
    } finally {
      await sql.end();
    }
  });
  it("keeps an approved set unchanged when its source is invalidated before publication", async () => {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
    try {
      const tables = await sql<{ table_name: string }[]>`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('practice_sets', 'practice_set_items', 'practice_set_audit_events')`;
      if (tables.length !== 3) return;
      const suffix = crypto.randomUUID();
      const leadId = crypto.randomUUID(); const adminId = crypto.randomUUID(); const targetId = crypto.randomUUID(); const guidanceId = crypto.randomUUID(); const policyId = crypto.randomUUID(); const policyVersionId = crypto.randomUUID(); const questionId = crypto.randomUUID();
      await sql`INSERT INTO accounts (id, email, canonical_email, display_name, role) VALUES (${leadId}, ${`invalidating-lead-${suffix}@example.test`}, ${`invalidating-lead-${suffix}@example.test`}, 'Lead', 'academic_lead'), (${adminId}, ${`invalidating-admin-${suffix}@example.test`}, ${`invalidating-admin-${suffix}@example.test`}, 'Admin', 'admin')`;
      await sql`INSERT INTO curriculum_targets (id, canonical_id, category, guidance, is_approved, created_by) VALUES (${targetId}, ${`animals-invalid-${suffix}`}, 'vocabulary', 'Animal vocabulary', true, ${leadId})`;
      await sql`INSERT INTO curriculum_guidance (id, paper, part, engine, topic, task_format, max_words, max_options, approved_names, approved_numbers) VALUES (${guidanceId}, 'reading_writing', 1, 'word_bank_cloze', ${`Animals invalid ${suffix}`}, ${`Word bank invalid ${suffix}`}, 10, 2, '[]'::jsonb, '[]'::jsonb)`;
      await sql`INSERT INTO answer_policies (id, canonical_id, target_id, guidance_id, paper, part, engine) VALUES (${policyId}, ${`policy-invalid-${suffix}`}, ${targetId}, ${guidanceId}, 'reading_writing', 1, 'word_bank_cloze')`;
      await sql`INSERT INTO answer_policy_versions (id, policy_id, version, input_kind, canonical_answer, accepted_answers, normalisation, max_words, teacher_review_if_uncertain, created_by) VALUES (${policyVersionId}, ${policyId}, 1, 'word', '"cat"'::jsonb, '[]'::jsonb, '{"unicode":"NFC","locale":"en-GB","caseSensitive":false,"trimWhitespace":true,"normalizePunctuation":false,"normalizeNumberForms":false}'::jsonb, 1, false, ${leadId})`;
      await sql`INSERT INTO question_drafts (id, status, origin, paper, part, engine, primary_target_id, supporting_target_ids, topic_ids, guidance_id, estimated_duration_seconds, accessibility_metadata, provenance, created_by, answer_policy_version_id, prompt, options) VALUES (${questionId}, 'published', 'manual', 'reading_writing', '1', 'word_bank_cloze', ${targetId}, '[]'::jsonb, ${JSON.stringify([targetId])}::jsonb, ${guidanceId}, '300', '{"altText":"A cat"}'::jsonb, '{"source":"Original staff writing","rightsReference":"Centre-owned"}'::jsonb, ${leadId}, ${policyVersionId}, 'Choose the animal.', '["cat","dog"]'::jsonb)`;
      const setId = await createPracticeSetDraft(lead(leadId), { title: "Invalidated source practice", questionIds: [questionId] });
      await submitPracticeSetForReview(lead(leadId), { practiceSetId: setId });
      await approvePracticeSet(admin(adminId), { practiceSetId: setId });
      await sql`UPDATE question_drafts SET status = 'retired' WHERE id = ${questionId}`;
      await expect(publishPracticeSet(lead(leadId), { practiceSetId: setId })).rejects.toMatchObject({ code: "VALIDATION_FAILED", findings: expect.arrayContaining([expect.objectContaining({ code: "QUESTION_NOT_PUBLISHED" })]) });
      await expect(sql`SELECT status::text FROM practice_sets WHERE id = ${setId}`).resolves.toEqual([{ status: "approved" }]);
      await expect(sql`SELECT id FROM practice_set_items WHERE practice_set_id = ${setId}`).resolves.toEqual([]);
      await expect(sql`SELECT action FROM practice_set_audit_events WHERE practice_set_id = ${setId} AND action = 'PRACTICE_SET_PUBLISHED'`).resolves.toEqual([]);
    } finally {
      await sql.end();
    }
  });
});
