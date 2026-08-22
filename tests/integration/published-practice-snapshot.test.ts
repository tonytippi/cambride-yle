import { describe, expect, it } from "vitest";
import postgres from "postgres";
import { publishPracticeSet } from "@/features/content/application/content";
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

describe("published practice snapshots", () => {
  it("publishes a current policy snapshot that a learner can score and submit", async () => {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
    try {
      const tables = await sql<{ table_name: string }[]>`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('practice_sets', 'practice_attempts', 'answer_policy_versions', 'submitted_evidence_facts')`;
      if (tables.length !== 4) return;

      const suffix = crypto.randomUUID();
      const leadId = crypto.randomUUID();
      const learnerId = crypto.randomUUID();
      const targetId = crypto.randomUUID();
      const guidanceId = crypto.randomUUID();
      const policyId = crypto.randomUUID();
      const policyVersionId = crypto.randomUUID();
      const questionId = crypto.randomUUID();
      await sql`INSERT INTO accounts (id, email, canonical_email, display_name, role) VALUES (${leadId}, ${`lead-${suffix}@example.test`}, ${`lead-${suffix}@example.test`}, 'Lead', 'academic_lead'), (${learnerId}, ${`learner-${suffix}@example.test`}, ${`learner-${suffix}@example.test`}, 'Learner', 'learner')`;
      await sql`INSERT INTO curriculum_targets (id, canonical_id, category, guidance, is_approved, created_by) VALUES (${targetId}, ${`animals-${suffix}`}, 'vocabulary', 'Animal vocabulary', true, ${leadId})`;
      await sql`INSERT INTO curriculum_guidance (id, paper, part, engine, topic, task_format, max_words, max_options, approved_names, approved_numbers) VALUES (${guidanceId}, 'reading_writing', 1, 'word_bank_cloze', ${`Animals ${suffix}`}, ${`Word bank cloze ${suffix}`}, 10, 2, '[]'::jsonb, '[]'::jsonb)`;
      await sql`INSERT INTO answer_policies (id, canonical_id, target_id, guidance_id, paper, part, engine) VALUES (${policyId}, ${`policy-${suffix}`}, ${targetId}, ${guidanceId}, 'reading_writing', 1, 'word_bank_cloze')`;
      await sql`INSERT INTO answer_policy_versions (id, policy_id, version, input_kind, canonical_answer, accepted_answers, normalisation, max_words, teacher_review_if_uncertain, created_by) VALUES (${policyVersionId}, ${policyId}, 1, 'word', '"cat"'::jsonb, '[]'::jsonb, '{"unicode":"NFC","locale":"en-GB","caseSensitive":false,"trimWhitespace":true,"normalizePunctuation":false,"normalizeNumberForms":false}'::jsonb, 1, false, ${leadId})`;
      await sql`INSERT INTO question_drafts (id, status, origin, paper, part, engine, primary_target_id, supporting_target_ids, topic_ids, guidance_id, estimated_duration_seconds, accessibility_metadata, provenance, created_by, answer_policy_version_id, prompt, options) VALUES (${questionId}, 'published', 'manual', 'reading_writing', '1', 'word_bank_cloze', ${targetId}, '[]'::jsonb, ${JSON.stringify([targetId])}::jsonb, ${guidanceId}, '300', '{"altText":"A cat"}'::jsonb, '{"source":"Original staff writing","rightsReference":"Centre-owned"}'::jsonb, ${leadId}, ${policyVersionId}, 'Choose the animal.', '["cat","dog"]'::jsonb)`;

      const setId = await publishPracticeSet(lead(leadId), {
        title: "Animal word practice",
        questionIds: [questionId],
      });
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
    } finally {
      await sql.end();
    }
  });
});
