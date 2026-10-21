import { describe, expect, it, vi } from "vitest";
import postgres from "postgres";

// The R2 object store is external; the archive runs against an in-memory library store instead.
vi.mock("@/infrastructure/storage/object-store", () => ({ isObjectStoreConfigured: () => true, isObjectStoreWritable: () => true, hasObject: async () => true, putObject: async () => undefined, getObject: async () => undefined, contentLibraryBucket: () => undefined, listObjectKeys: async () => [] }));
vi.mock("@/features/practice/infrastructure/media-gateway", () => ({
  isMediaGatewayConfigured: () => true,
  authoriseMedia: async (_learnerId: string, media: { id: string; contentHash: string }) => ({ url: `/api/practice/media?token=test-${media.id}`, cacheKey: `media/${media.id}/${media.contentHash}` }),
  verifyMediaCapability: () => undefined,
  fetchAuthorisedMedia: async () => undefined,
}));

import { createAnswerPolicyVersion, createCurriculumGuidance, createCurriculumTarget } from "@/features/curriculum/application/curriculum";
import { approveContent, approvePracticeSet, createManualMedia, createManualQuestion, createPracticeSetDraft, publishContent, publishPracticeSet, recordPhonePreview, submitForReview, submitPracticeSetForReview, validateContent } from "@/features/content/application/content";
import { getLearnerHome } from "@/features/practice/application/practice";
import { getContentArchive, importFromLibrary } from "@/features/content-library/application/import";
import { pushToLibrary } from "@/features/content-library/application/sync";
import type { LibraryStore } from "@/features/content-library/infrastructure/library-store";
import { mediaFileKey } from "@/features/content-library/domain/records";

type Role = "learner" | "teacher" | "academic_lead" | "admin";
const required = <T>(value: T | undefined): T => { if (value === undefined) throw new Error("Expected a created record"); return value; };

function memoryStore() {
  const files = new Map<string, string>();
  const binaries = new Set<string>();
  const store: LibraryStore = {
    listKeys: async (prefix) => [...files.keys(), ...binaries].filter((key) => key.startsWith(prefix)),
    readText: async (key) => files.get(key),
    writeText: async (key, text) => void files.set(key, text),
    copyMedia: async (direction, sha256) => {
      if (direction === "to_library") return binaries.has(mediaFileKey(sha256)) ? "present" : (binaries.add(mediaFileKey(sha256)), "copied");
      return binaries.has(mediaFileKey(sha256)) ? "present" : "missing";
    },
  };
  return { store, files, binaries };
}

describe("content library round trip", () => {
  it("pushes approved and published content, then imports it into a database that lacks it with its status", async () => {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
    try {
      const suffix = crypto.randomUUID().slice(0, 8);
      const people = { lead: crypto.randomUUID(), admin: crypto.randomUUID(), learner: crypto.randomUUID() };
      const emails = { lead: `library-lead-${crypto.randomUUID()}@example.test`, admin: `library-admin-${crypto.randomUUID()}@example.test`, learner: `library-learner-${crypto.randomUUID()}@example.test` };
      const roles: Record<keyof typeof people, Role> = { lead: "academic_lead", admin: "admin", learner: "learner" };
      for (const key of Object.keys(people) as (keyof typeof people)[])
        await sql`INSERT INTO accounts (id, email, canonical_email, display_name, role) VALUES (${people[key]}, ${emails[key]}, ${emails[key]}, ${key}, ${roles[key]})`;
      const lead = { id: people.lead, email: emails.lead, displayName: "Lead", role: "academic_lead" as const };
      const admin = { id: people.admin, email: emails.admin, displayName: "Admin", role: "admin" as const };
      const learner = { id: people.learner, email: emails.learner, displayName: "Learner", role: "learner" as const };

      const targetId = required(await createCurriculumTarget(lead, { canonicalId: `library-colours-${suffix}`, category: "vocabulary", guidance: "Colour vocabulary", isApproved: true }));
      const topicId = required(await createCurriculumTarget(lead, { canonicalId: `library-toys-${suffix}`, category: "topic", guidance: "Toys topic", isApproved: true }));
      const topic = `Library toys ${suffix}`;
      const guidanceId = required(await createCurriculumGuidance(lead, { paper: "reading_writing", part: 1, engine: "picture_true_false", topic, taskFormat: `Picture true or false ${suffix}`, maxWords: 12, maxOptions: 2, approvedNames: [], approvedNumbers: [] }));
      const policy = required(await createAnswerPolicyVersion(lead, {
        canonicalId: `library-ball-${suffix}`, targetId, guidanceId, paper: "reading_writing", part: 1, engine: "picture_true_false",
        inputKind: "boolean", canonicalAnswer: true, acceptedAnswers: [], maxWords: 1, teacherReviewIfUncertain: false,
        normalisation: { unicode: "NFC", locale: "en-GB", caseSensitive: false, trimWhitespace: true, normalizePunctuation: true, normalizeNumberForms: false },
        vectors: [{ response: true, expectedOutcome: "correct" }, { response: false, expectedOutcome: "incorrect" }],
      }));
      const scope = { paper: "reading_writing" as const, part: 1, engine: "picture_true_false" as const, primaryTargetId: targetId, supportingTargetIds: [], topicIds: [topicId], guidanceId, provenance: { source: "Centre-created original content", rightsReference: `centre-${suffix}` } };

      const mediaId = await createManualMedia(lead, { ...scope, mediaType: "image", description: `A ball in a garden ${suffix}`, estimatedDurationSeconds: 300, accessibilityMetadata: { altText: "A round toy in a garden" } }, { bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7, 7, 7, 7]) });
      const media = { kind: "media" as const, targetId: mediaId };
      await validateContent(lead, media);
      await submitForReview(lead, media);
      await recordPhonePreview(lead, { ...media, viewportWidth: 375, successful: true });
      await approveContent(admin, media);
      await publishContent(lead, media);
      const questionId = await createManualQuestion(lead, { ...scope, answerPolicyVersionId: policy.versionId, prompt: `The ball is red ${suffix}.`, options: ["True", "False"], estimatedDurationSeconds: 300, accessibilityMetadata: { altText: "A round toy in a garden" }, mediaIds: [mediaId] });
      const question = { kind: "question" as const, targetId: questionId };
      await validateContent(lead, question);
      await submitForReview(lead, question);
      await approveContent(admin, question);
      await publishContent(lead, question);
      const setId = await createPracticeSetDraft(lead, { title: `Library toys ${suffix}`, questionIds: [questionId] });
      await submitPracticeSetForReview(lead, { practiceSetId: setId });
      // The submitter may approve their own set.
      await approvePracticeSet(lead, { practiceSetId: setId });
      await publishPracticeSet(lead, { practiceSetId: setId });

      const { store, files, binaries } = memoryStore();
      const pushed = await pushToLibrary({ store, fresh: true });
      expect(pushed.failed).toEqual([]);
      const setFile = files.get(`content-library/v1/practice-sets/${setId}.json`);
      expect(JSON.parse(required(setFile))).toMatchObject({ status: "published", approvedBy: emails.lead, questionIds: [questionId] });
      expect(JSON.parse(required(files.get(`content-library/v1/questions/${questionId}.json`)))).toMatchObject({ status: "published", approvedBy: emails.admin, mediaIds: [mediaId] });
      expect(binaries.size).toBeGreaterThan(0);
      // A repeat push leaves this content's files alone, and publication added no version file.
      const ownKeys = () => [...files.keys()].filter((key) => [setId, questionId, mediaId].some((id) => key.includes(id))).sort();
      const before = ownKeys().map((key) => files.get(key));
      await expect(pushToLibrary({ store })).resolves.toMatchObject({ failed: [] });
      expect(ownKeys()).toHaveLength(3);
      expect(ownKeys().map((key) => files.get(key))).toEqual(before);

      // Simulate a reset database: every ID and curriculum key of this content is new to the database.
      const nextSuffix = crypto.randomUUID().slice(0, 8);
      const remap = new Map([targetId, topicId, guidanceId, policy.policyId, policy.versionId, mediaId, questionId, setId].map((id) => [id, crypto.randomUUID()]));
      const rewrite = (text: string) => [...remap].reduce((value, [from, to]) => value.replaceAll(from, to), text.replaceAll(suffix, nextSuffix));
      for (const [key, text] of [...files]) if ([...remap.keys()].some((id) => key.includes(id))) files.set(rewrite(key), rewrite(text));
      const ids = { set: remap.get(setId)!, question: remap.get(questionId)!, media: remap.get(mediaId)! };
      // The original approver of the question is gone; the importing staff member stands in.
      const questionKey = `content-library/v1/questions/${ids.question}.json`;
      files.set(questionKey, required(files.get(questionKey)).replaceAll(emails.admin, "departed@example.test"));

      await expect(getContentArchive(lead, store)).resolves.toMatchObject({ sets: expect.arrayContaining([expect.objectContaining({ id: ids.set, status: "published", localStatus: undefined })]) });
      const report = await importFromLibrary(lead, { practiceSetIds: [ids.set] }, store);
      expect(report.failed).toEqual([]);
      expect(report.imported).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: "media", id: ids.media, status: "published" }),
        expect.objectContaining({ kind: "question", id: ids.question, status: "published" }),
        expect.objectContaining({ kind: "practice_set", id: ids.set, status: "published" }),
      ]));
      await expect(sql`SELECT status::text FROM practice_sets WHERE id = ${ids.set}`).resolves.toEqual([{ status: "published" }]);
      await expect(sql`SELECT count(*)::int AS items FROM practice_set_items WHERE practice_set_id = ${ids.set}`).resolves.toEqual([{ items: 1 }]);
      await expect(sql`SELECT canonical_id FROM curriculum_targets WHERE id = ${remap.get(targetId)!}`).resolves.toEqual([{ canonical_id: `library-colours-${nextSuffix}` }]);
      await expect(sql`SELECT actor_id FROM content_review_records WHERE target_id = ${ids.question} AND decision = 'approved'`).resolves.toEqual([{ actor_id: people.lead }]);
      await expect(sql`SELECT actor_id FROM content_review_records WHERE target_id = ${ids.media} AND decision = 'approved'`).resolves.toEqual([{ actor_id: people.admin }]);
      await expect(getLearnerHome(learner)).resolves.toMatchObject({ allSets: expect.arrayContaining([expect.objectContaining({ id: ids.set, action: "Start" })]) });

      // Importing again finds everything already here.
      const again = await importFromLibrary(lead, { practiceSetIds: [ids.set] }, store);
      expect(again.imported).toEqual([]);
      expect(again.present.map((item) => item.id)).toEqual(expect.arrayContaining([ids.set, ids.question, ids.media]));
    } finally {
      await sql.end();
    }
  });
});
