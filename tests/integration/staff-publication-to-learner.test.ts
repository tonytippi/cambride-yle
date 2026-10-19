import { describe, expect, it, vi } from "vitest";
import postgres from "postgres";

// The object store is an external boundary; the browser E2E exercises it over HTTPS.
// Here every published media version is treated as available so the database-backed
// contract from staff publication to learner evidence is the only behaviour under test.
vi.mock("@/features/practice/infrastructure/media-gateway", () => ({
  isMediaGatewayConfigured: () => true,
  authoriseMedia: async (_learnerId: string, media: { id: string; contentHash: string }) => ({ url: `/api/practice/media?token=test-${media.id}`, cacheKey: `media/${media.id}/${media.contentHash}` }),
  verifyMediaCapability: () => undefined,
  fetchAuthorisedMedia: async () => undefined,
}));

import { createAnswerPolicyVersion, createCurriculumGuidance, createCurriculumTarget } from "@/features/curriculum/application/curriculum";
import {
  approveContent,
  approvePracticeSet,
  getContentReadiness,
  createManualMedia,
  createManualQuestion,
  createPracticeSetDraft,
  publishContent,
  publishPracticeSet,
  recordPhonePreview,
  retireContent,
  retirePracticeSet,
  submitForReview,
  submitPracticeSetForReview,
  validateContent,
} from "@/features/content/application/content";
import {
  getLearnerHome,
  getPracticePlayer,
  getSubmittedPracticeReview,
  preparePractice,
  savePracticeResponse,
  startPractice,
  submitPracticeAttempt,
} from "@/features/practice/application/practice";
import { getCentreEvidence } from "@/features/evidence/application/get-centre-evidence";

type Role = "learner" | "teacher" | "academic_lead" | "admin";
const required = <T>(value: T | undefined): T => { if (value === undefined) throw new Error("Expected a created record"); return value; };
const actor = (id: string, role: Role) => ({ id, email: `${role}@example.test`, displayName: role, role });

describe("staff publication to learner evidence", () => {
  it("carries staff-authored media content through learner submission and preserves evidence after retirement", async () => {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
    try {
      const suffix = crypto.randomUUID();
      const ids = { lead: crypto.randomUUID(), admin: crypto.randomUUID(), teacher: crypto.randomUUID(), submitter: crypto.randomUUID(), openLearner: crypto.randomUUID(), freshLearner: crypto.randomUUID() };
      const accounts: [string, Role][] = [[ids.lead, "academic_lead"], [ids.admin, "admin"], [ids.teacher, "teacher"], [ids.submitter, "learner"], [ids.openLearner, "learner"], [ids.freshLearner, "learner"]];
      for (const [id, role] of accounts)
        await sql`INSERT INTO accounts (id, email, canonical_email, display_name, role) VALUES (${id}, ${`${role}-${id}@example.test`}, ${`${role}-${id}@example.test`}, ${`${role} ${suffix.slice(0, 8)}`}, ${role})`;
      const lead = actor(ids.lead, "academic_lead");
      const admin = actor(ids.admin, "admin");
      const submitter = actor(ids.submitter, "learner");
      const openLearner = actor(ids.openLearner, "learner");
      const freshLearner = actor(ids.freshLearner, "learner");

      // Controlled references through the curriculum application.
      const targetId = required(await createCurriculumTarget(lead, { canonicalId: `colours-${suffix}`, category: "vocabulary", guidance: "Colour vocabulary", isApproved: true }));
      const topicId = required(await createCurriculumTarget(lead, { canonicalId: `toys-${suffix}`, category: "topic", guidance: "Toys topic", isApproved: true }));
      const topic = `Toys ${suffix}`;
      const taskFormat = `Picture true or false ${suffix}`;
      const guidanceId = required(await createCurriculumGuidance(lead, { paper: "reading_writing", part: 1, engine: "picture_true_false", topic, taskFormat, maxWords: 12, maxOptions: 2, approvedNames: [], approvedNumbers: [] }));
      const policy = required(await createAnswerPolicyVersion(lead, {
        canonicalId: `ball-colour-${suffix}`, targetId, guidanceId, paper: "reading_writing", part: 1, engine: "picture_true_false",
        inputKind: "boolean", canonicalAnswer: true, acceptedAnswers: [], maxWords: 1, teacherReviewIfUncertain: false,
        normalisation: { unicode: "NFC", locale: "en-GB", caseSensitive: false, trimWhitespace: true, normalizePunctuation: true, normalizeNumberForms: false },
        vectors: [{ response: true, expectedOutcome: "correct" }, { response: false, expectedOutcome: "incorrect" }],
      }));
      const scope = { paper: "reading_writing" as const, part: 1, engine: "picture_true_false" as const, primaryTargetId: targetId, supportingTargetIds: [], topicIds: [topicId], guidanceId, provenance: { source: "Centre-created original content", rightsReference: `centre-${suffix}` } };

      // Image media: draft -> validate -> review -> 375px preview -> approve -> publish.
      const mediaId = await createManualMedia(lead, { ...scope, mediaType: "image", description: "A child holds a ball in a garden", estimatedDurationSeconds: 300, accessibilityMetadata: { altText: "A child in a garden holding a round toy" } });
      const media = { kind: "media" as const, targetId: mediaId };
      await expect(validateContent(lead, media)).resolves.toMatchObject({ findings: [] });
      await submitForReview(lead, media);
      await recordPhonePreview(lead, { ...media, viewportWidth: 375, successful: true });
      await approveContent(admin, media);
      await publishContent(lead, media);

      // Question associated with the published media follows the same lifecycle.
      const questionId = await createManualQuestion(lead, { ...scope, answerPolicyVersionId: policy.versionId, prompt: "The ball is red.", options: ["True", "False"], estimatedDurationSeconds: 300, accessibilityMetadata: { altText: "A child in a garden holding a round toy" }, mediaIds: [mediaId] });
      const question = { kind: "question" as const, targetId: questionId };
      await expect(validateContent(lead, question)).resolves.toMatchObject({ findings: [] });
      await submitForReview(lead, question);
      await approveContent(admin, question);
      await publishContent(lead, question);

      const readiness = await getContentReadiness(lead);
      expect(readiness.coverage.filter((item) => item.guidanceId === guidanceId)).toEqual([expect.objectContaining({ topicTargetId: topicId, vocabularyTargetIds: [targetId], grammarTargetIds: [], mediaEligible: true, composition: expect.objectContaining({ questionIds: [questionId] }), gaps: [] })]);

      // Set lifecycle with independent approval.
      const setId = await createPracticeSetDraft(lead, { title: `Toy colours ${suffix}`, questionIds: [questionId] });
      await expect(getLearnerHome(submitter)).resolves.toMatchObject({ allSets: expect.not.arrayContaining([expect.objectContaining({ id: setId })]) });
      await submitPracticeSetForReview(lead, { practiceSetId: setId });
      await approvePracticeSet(admin, { practiceSetId: setId });
      await publishPracticeSet(lead, { practiceSetId: setId });

      // Learner selection by topic and task type.
      const home = await getLearnerHome(submitter, { topic, taskType: taskFormat });
      expect(home.sets).toEqual([expect.objectContaining({ id: setId, action: "Start", paper: "reading_writing" })]);
      await expect(preparePractice(submitter, { setId })).resolves.toMatchObject({ data: { setId, assets: [expect.objectContaining({ type: "image" })] } });

      const started = await startPractice(submitter, { setId });
      if (!("data" in started)) throw new Error(`Practice did not start: ${JSON.stringify(started)}`);
      const player = await getPracticePlayer(submitter, { setId, attemptId: started.data.attemptId });
      if (!("data" in player)) throw new Error(`Practice player was invalid: ${JSON.stringify(player)}`);
      expect(player.data.items).toEqual([expect.objectContaining({ engine: "picture_true_false", media: [expect.objectContaining({ type: "image", altText: "A child in a garden holding a round toy" })] })]);
      expect(JSON.stringify(player.data)).not.toMatch(/canonicalAnswer|acceptedAnswers|outcome/);
      const itemId = player.data.items[0]!.id;
      await expect(savePracticeResponse(submitter, { setId, attemptId: started.data.attemptId, itemId, expectedRevision: player.data.revision, value: true })).resolves.toEqual({ data: { revision: 1 } });
      await expect(submitPracticeAttempt(submitter, { setId, attemptId: started.data.attemptId, expectedRevision: 1, idempotencyKey: crypto.randomUUID() })).resolves.toMatchObject({ data: { attemptId: started.data.attemptId } });

      // A second learner leaves an attempt open before retirement.
      const open = await startPractice(openLearner, { setId });
      if (!("data" in open)) throw new Error(`Open practice did not start: ${JSON.stringify(open)}`);
      const openPlayer = await getPracticePlayer(openLearner, { setId, attemptId: open.data.attemptId });
      if (!("data" in openPlayer)) throw new Error("Open practice player was invalid");

      const snapshotBefore = await sql`SELECT i.id, i.answer_policy, i.rendered_prompt, i.rendered_options, i.tags, m.object_version, m.content_hash, m.accessibility_metadata FROM practice_set_items i JOIN practice_set_item_media m ON m.practice_set_item_id = i.id WHERE i.practice_set_id = ${setId}`;
      const teacher = actor(ids.teacher, "teacher");
      const evidenceBefore = await getCentreEvidence(teacher, { learnerId: ids.submitter });
      if (!("data" in evidenceBefore)) throw new Error("Teacher evidence was invalid");
      expect(evidenceBefore.data.details).toEqual([expect.objectContaining({ attemptId: started.data.attemptId, practiceSetId: setId, effectiveOutcome: "correct" })]);

      // Retire the set and its sources.
      await retirePracticeSet(admin, { practiceSetId: setId });
      await retireContent(admin, question);
      await retireContent(admin, media);

      await expect(getLearnerHome(freshLearner)).resolves.toMatchObject({ allSets: expect.not.arrayContaining([expect.objectContaining({ id: setId })]) });
      await expect(startPractice(freshLearner, { setId })).resolves.toMatchObject({ error: { code: "SET_RETIRED" } });

      // Completed evidence is unchanged for learner and teacher.
      await expect(getSubmittedPracticeReview(submitter, { setId, attemptId: started.data.attemptId })).resolves.toMatchObject({ data: { attemptId: started.data.attemptId, items: [expect.objectContaining({ outcome: "correct" })] } });
      const evidenceAfter = await getCentreEvidence(teacher, { learnerId: ids.submitter });
      if (!("data" in evidenceAfter)) throw new Error("Teacher evidence was invalid after retirement");
      expect(evidenceAfter.data.details).toEqual(evidenceBefore.data.details);
      expect(evidenceAfter.data.rows).toEqual(evidenceBefore.data.rows);

      // The open attempt is grandfathered and still submits against its snapshot.
      await expect(getPracticePlayer(openLearner, { setId, attemptId: open.data.attemptId })).resolves.toMatchObject({ data: { items: [expect.objectContaining({ id: openPlayer.data.items[0]!.id })] } });
      await expect(savePracticeResponse(openLearner, { setId, attemptId: open.data.attemptId, itemId: openPlayer.data.items[0]!.id, expectedRevision: openPlayer.data.revision, value: false })).resolves.toEqual({ data: { revision: 1 } });
      await expect(submitPracticeAttempt(openLearner, { setId, attemptId: open.data.attemptId, expectedRevision: 1, idempotencyKey: crypto.randomUUID() })).resolves.toMatchObject({ data: { attemptId: open.data.attemptId } });
      await expect(getSubmittedPracticeReview(openLearner, { setId, attemptId: open.data.attemptId })).resolves.toMatchObject({ data: { items: [expect.objectContaining({ outcome: "incorrect" })] } });

      await expect(sql`SELECT i.id, i.answer_policy, i.rendered_prompt, i.rendered_options, i.tags, m.object_version, m.content_hash, m.accessibility_metadata FROM practice_set_items i JOIN practice_set_item_media m ON m.practice_set_item_id = i.id WHERE i.practice_set_id = ${setId}`).resolves.toEqual(snapshotBefore);
    } finally {
      await sql.end();
    }
  });
});
