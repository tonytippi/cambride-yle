import { describe, expect, it, vi } from "vitest";
import postgres from "postgres";

// The object store is external; every published media version is treated as available.
// Media files are stored content-addressed in the private object store, which is external here.
vi.mock("@/infrastructure/storage/object-store", () => ({ isObjectStoreConfigured: () => true, isObjectStoreWritable: () => true, hasObject: async () => true, putObject: async () => undefined, getObject: async () => undefined }));
vi.mock("@/features/practice/infrastructure/media-gateway", () => ({
  isMediaGatewayConfigured: () => true,
  authoriseMedia: async (_learnerId: string, media: { id: string; contentHash: string }) => ({ url: `/api/practice/media?token=test-${media.id}`, cacheKey: `media/${media.id}/${media.contentHash}` }),
  verifyMediaCapability: () => undefined,
  fetchAuthorisedMedia: async () => undefined,
}));

import { createAnswerPolicyVersion, createCurriculumGuidance, createCurriculumTarget } from "@/features/curriculum/application/curriculum";
import { approveContent, approvePracticeSet, createManualMedia, createManualQuestion, createPracticeSetDraft, publishContent, publishPracticeSet, submitForReview, submitPracticeSetForReview, validateContent } from "@/features/content/application/content";
import { getOpenPracticeAttempt, getPracticePlayer, getSubmittedPracticeReview, recordPracticePlayback, savePracticeResponse, startPractice, submitPracticeAttempt } from "@/features/practice/application/practice";

type Role = "learner" | "academic_lead" | "admin";
const actor = (id: string, role: Role) => ({ id, email: `${role}@example.test`, displayName: role, role });
const required = <T,>(value: T | undefined): T => { if (value === undefined) throw new Error("Expected a created record"); return value; };
const data = <T,>(result: { data: T } | { error: unknown }): T => { if (!("data" in result)) throw new Error(JSON.stringify(result)); return result.data; };

/* Publishes a one-question Listening Part 2 note-taking set with audio through the staff lifecycle. */
async function publishNoteTakingSet(sql: postgres.Sql) {
  const suffix = crypto.randomUUID();
  const ids = { lead: crypto.randomUUID(), admin: crypto.randomUUID(), owner: crypto.randomUUID(), other: crypto.randomUUID() };
  for (const [id, role] of [[ids.lead, "academic_lead"], [ids.admin, "admin"], [ids.owner, "learner"], [ids.other, "learner"]] as const)
    await sql`INSERT INTO accounts (id, email, canonical_email, display_name, role) VALUES (${id}, ${`${role}-${id}@example.test`}, ${`${role}-${id}@example.test`}, ${role}, ${role})`;
  const lead = actor(ids.lead, "academic_lead");
  const admin = actor(ids.admin, "admin");
  const targetId = required(await createCurriculumTarget(lead, { canonicalId: `names-${suffix}`, category: "language_target", guidance: "Names", isApproved: true }));
  const topicId = required(await createCurriculumTarget(lead, { canonicalId: `family-${suffix}`, category: "topic", guidance: "Family", isApproved: true }));
  const guidanceId = required(await createCurriculumGuidance(lead, { paper: "listening", part: 2, engine: "audio_note_taking", topic: `Family ${suffix}`, taskFormat: `Listen and write ${suffix}`, maxWords: 10, maxOptions: 2, approvedNames: ["Tom"], approvedNumbers: [] }));
  const policy = required(await createAnswerPolicyVersion(lead, { canonicalId: `cat-name-${suffix}`, targetId, guidanceId, paper: "listening", part: 2, engine: "audio_note_taking", inputKind: "name", canonicalAnswer: "Tom", acceptedAnswers: [], maxWords: 1, teacherReviewIfUncertain: false, normalisation: { unicode: "NFC", locale: "en-GB", caseSensitive: false, trimWhitespace: true, normalizePunctuation: true, normalizeNumberForms: false }, vectors: [{ response: "tom", expectedOutcome: "correct" }, { response: "Sam", expectedOutcome: "incorrect" }] }));
  const scope = { paper: "listening" as const, part: 2, engine: "audio_note_taking" as const, primaryTargetId: targetId, supportingTargetIds: [], topicIds: [topicId], guidanceId, provenance: { source: "Centre-created original content", rightsReference: `centre-${suffix}` } };
  const mediaId = await createManualMedia(lead, { ...scope, mediaType: "audio", description: "A child says the cat's name", estimatedDurationSeconds: 300, accessibilityMetadata: { altText: "A short recording about a cat" } }, { bytes: new TextEncoder().encode("RIFF\0\0\0\0WAVEfmt ") });
  const questionId = await createManualQuestion(lead, { ...scope, answerPolicyVersionId: policy.versionId, prompt: "Write the cat's name.", options: ["Listen and write"], estimatedDurationSeconds: 300, accessibilityMetadata: { altText: "Listening question" }, mediaIds: [mediaId] });
  for (const content of [{ kind: "media" as const, targetId: mediaId }, { kind: "question" as const, targetId: questionId }]) {
    await validateContent(lead, content);
    await submitForReview(lead, content);
    await approveContent(admin, content);
    await publishContent(lead, content);
  }
  const setId = await createPracticeSetDraft(lead, { title: `Cat names ${suffix}`, questionIds: [questionId] });
  await submitPracticeSetForReview(lead, { practiceSetId: setId });
  await approvePracticeSet(admin, { practiceSetId: setId });
  await publishPracticeSet(lead, { practiceSetId: setId });
  return { setId, owner: actor(ids.owner, "learner"), other: actor(ids.other, "learner") };
}

describe("practice attempt guards", () => {
  it("scopes attempts to their learner, rejects stale revisions and finalises idempotently", async () => {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
    try {
      const { setId, owner, other } = await publishNoteTakingSet(sql);

      // Concurrent starts converge on one open attempt.
      const [first, second] = await Promise.all([startPractice(owner, { setId }), startPractice(owner, { setId })]);
      const attemptId = data(first).attemptId;
      expect(data(second).attemptId).toBe(attemptId);
      expect([data(first).disposition, data(second).disposition].sort()).toEqual(["resume", "started"]);
      await expect(sql`SELECT count(*)::int AS open FROM practice_attempts WHERE learner_id = ${owner.id} AND practice_set_id = ${setId} AND status = 'open'`).resolves.toEqual([{ open: 1 }]);

      const player = data(await getPracticePlayer(owner, { setId, attemptId }));
      const item = player.items[0]!;
      const mediaId = item.media[0]!.id;
      const attempt = { setId, attemptId };

      // Another learner cannot read, change, submit or review the attempt.
      await expect(getPracticePlayer(other, attempt)).resolves.toMatchObject({ error: { code: "ATTEMPT_SCOPE_MISMATCH" } });
      await expect(getOpenPracticeAttempt(other, attempt)).resolves.toMatchObject({ error: { code: "SET_NOT_FOUND" } });
      await expect(savePracticeResponse(other, { ...attempt, itemId: item.id, expectedRevision: 0, value: "Sam" })).resolves.toMatchObject({ error: { code: "ATTEMPT_SCOPE_MISMATCH" } });
      await expect(recordPracticePlayback(other, { ...attempt, itemId: item.id, mediaId, expectedRevision: 0 })).resolves.toMatchObject({ error: { code: "ATTEMPT_SCOPE_MISMATCH" } });
      await expect(submitPracticeAttempt(other, { ...attempt, expectedRevision: 0, idempotencyKey: crypto.randomUUID() })).resolves.toMatchObject({ error: { code: "ATTEMPT_SCOPE_MISMATCH" } });
      await expect(getSubmittedPracticeReview(other, attempt)).resolves.toMatchObject({ error: { code: "ATTEMPT_SCOPE_MISMATCH" } });

      // Every mutation is revision-checked.
      await expect(recordPracticePlayback(owner, { ...attempt, itemId: item.id, mediaId, expectedRevision: 0 })).resolves.toEqual({ data: { revision: 1 } });
      await expect(savePracticeResponse(owner, { ...attempt, itemId: item.id, expectedRevision: 0, value: "Sam" })).resolves.toMatchObject({ error: { code: "ATTEMPT_REVISION_CONFLICT" } });
      await expect(recordPracticePlayback(owner, { ...attempt, itemId: item.id, mediaId, expectedRevision: 0 })).resolves.toMatchObject({ error: { code: "ATTEMPT_REVISION_CONFLICT" } });
      await expect(savePracticeResponse(owner, { ...attempt, itemId: item.id, expectedRevision: 1, value: "tom" })).resolves.toEqual({ data: { revision: 2 } });
      await expect(submitPracticeAttempt(owner, { ...attempt, expectedRevision: 1, idempotencyKey: crypto.randomUUID() })).resolves.toMatchObject({ error: { code: "ATTEMPT_REVISION_CONFLICT" } });

      // Submission is idempotent per key, and the attempt is closed to every later write.
      const key = crypto.randomUUID();
      const submitted = data(await submitPracticeAttempt(owner, { ...attempt, expectedRevision: 2, idempotencyKey: key }));
      await expect(submitPracticeAttempt(owner, { ...attempt, expectedRevision: 2, idempotencyKey: key })).resolves.toEqual({ data: submitted });
      await expect(submitPracticeAttempt(owner, { ...attempt, expectedRevision: submitted.revision, idempotencyKey: crypto.randomUUID() })).resolves.toMatchObject({ error: { code: "ATTEMPT_FINALISED" } });
      await expect(savePracticeResponse(owner, { ...attempt, itemId: item.id, expectedRevision: submitted.revision, value: "Sam" })).resolves.toMatchObject({ error: { code: "ATTEMPT_FINALISED" } });
      await expect(recordPracticePlayback(owner, { ...attempt, itemId: item.id, mediaId, expectedRevision: submitted.revision })).resolves.toMatchObject({ error: { code: "ATTEMPT_FINALISED" } });
      await expect(getPracticePlayer(owner, attempt)).resolves.toMatchObject({ error: { code: "ATTEMPT_FINALISED" } });
      await expect(getSubmittedPracticeReview(owner, attempt)).resolves.toMatchObject({ data: { items: [expect.objectContaining({ response: "tom", outcome: "correct" })] } });
      await expect(sql`SELECT count(*)::int AS events FROM practice_attempt_playback_events WHERE attempt_id = ${attemptId}`).resolves.toEqual([{ events: 1 }]);
    } finally {
      await sql.end();
    }
  });

  it("closes an attempt replaced by Start again to every write, including a late submission from another tab", async () => {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
    try {
      const { setId, owner } = await publishNoteTakingSet(sql);
      const replaced = data(await startPractice(owner, { setId }));
      const player = data(await getPracticePlayer(owner, { setId, attemptId: replaced.attemptId }));
      data(await startPractice(owner, { setId, replaceAttemptId: replaced.attemptId }));
      const attempt = { setId, attemptId: replaced.attemptId };
      await expect(savePracticeResponse(owner, { ...attempt, itemId: player.items[0]!.id, expectedRevision: 0, value: "tom" })).resolves.toMatchObject({ error: { code: "ATTEMPT_FINALISED" } });
      await expect(submitPracticeAttempt(owner, { ...attempt, expectedRevision: 0, idempotencyKey: crypto.randomUUID() })).resolves.toMatchObject({ error: { code: "ATTEMPT_FINALISED" } });
      await expect(sql`SELECT status::text FROM practice_attempts WHERE id = ${replaced.attemptId}`).resolves.toEqual([{ status: "abandoned" }]);
    } finally {
      await sql.end();
    }
  });
});
