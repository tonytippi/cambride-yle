import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  curriculumGuidance,
  curriculumTargets,
  practiceAttemptEvidence,
  practiceAttempts,
  practiceAttemptPlaybackEvents,
  practiceAttemptReviewItems,
  practiceAttemptResponses,
  practiceRecommendationAudits,
  practiceSetItems,
  practiceSetItemMedia,
  practiceSets,
  submittedEvidenceFacts,
  teacherEvidenceResolutions,
  accounts,
  auditEvents,
} from "@/../db/schema";
import { evaluateAnswer, normaliseAnswer } from "@/features/curriculum/domain/answer-policy";
import { database } from "@/infrastructure/database/client";
import { uuidv7 } from "@/features/identity/infrastructure/uuid";
import { authoriseMedia, isMediaGatewayConfigured } from "./media-gateway";
import type { LearnerEngine, OpenPracticeAttempt, PracticePlayer, PracticePreparation, PracticeStart, SubmittedEvidence, SubmittedPracticeResult, SubmittedPracticeReview } from "../domain/contracts";
import type { SubmittedEvidenceDetail, SubmittedEvidenceFilter, SubmittedEvidenceReader } from "../application/evidence-contract";

type Database = typeof database | Parameters<Parameters<typeof database.transaction>[0]>[0];

export async function listPublishedSetsForLearner(learnerId: string, db: Database = database) {
  const rows = await db
    .selectDistinctOn([practiceSets.id], {
      id: practiceSets.id,
      title: practiceSets.title,
      paper: practiceSets.paper,
      part: practiceSets.part,
      estimatedDurationSeconds: practiceSets.estimatedDurationSeconds,
      targetIds: practiceSets.primaryTargetIds,
      topic: curriculumGuidance.topic,
      taskType: curriculumGuidance.taskFormat,
      openLastSavedAt: practiceAttempts.lastSavedAt,
      submittedAttemptId: sql<string | null>`(select id from practice_attempts submitted_attempt where submitted_attempt.learner_id = ${learnerId} and submitted_attempt.practice_set_id = ${practiceSets.id} and submitted_attempt.status = 'submitted' order by submitted_attempt.submitted_at desc, submitted_attempt.id desc limit 1)`,
    })
    .from(practiceSets)
    .innerJoin(practiceSetItems, eq(practiceSetItems.practiceSetId, practiceSets.id))
    .innerJoin(curriculumGuidance, sql`${practiceSetItems.tags}->>'guidanceId' = ${curriculumGuidance.id}::text`)
    .leftJoin(practiceAttempts, and(eq(practiceAttempts.practiceSetId, practiceSets.id), eq(practiceAttempts.learnerId, learnerId), eq(practiceAttempts.status, "open")))
    .where(eq(practiceSets.status, "published"))
    .orderBy(practiceSets.id, desc(practiceAttempts.lastSavedAt));
  return rows;
}

export async function listRecentSubmittedEvidence(learnerId: string, since: Date, db: Database = database): Promise<SubmittedEvidence[]> {
  const rows = await db
    .select({ practiceSetId: practiceAttemptEvidence.practiceSetId, attemptId: practiceAttempts.id, submittedAt: practiceAttempts.submittedAt, practiceAreaId: practiceAttemptEvidence.practiceAreaId, label: practiceAttemptEvidence.label })
    .from(practiceAttemptEvidence)
    .innerJoin(practiceAttempts, and(eq(practiceAttempts.id, practiceAttemptEvidence.attemptId), eq(practiceAttempts.learnerId, learnerId), eq(practiceAttempts.status, "submitted"), gte(practiceAttempts.submittedAt, since)))
    .orderBy(desc(practiceAttempts.submittedAt), desc(practiceAttempts.id));
  return rows.filter((row): row is SubmittedEvidence => row.submittedAt !== null);
}

export async function recordRecommendation(learnerId: string, version: string, displayedSetIds: string[], db: Database = database) {
  await db.insert(practiceRecommendationAudits).values({ id: uuidv7(), learnerId, version, displayedSetIds });
}

type Snapshot = { set: { id: string; title: string; status: "published" | "retired" }; media: { id: string; mediaType: string; objectVersion: string; contentHash: string }[] };
type SnapshotResult = Snapshot | { error: "SET_NOT_FOUND" | "SET_RETIRED" };
async function publishedSnapshot(setId: string, db: Database): Promise<SnapshotResult> {
  const set = (await db.select({ id: practiceSets.id, title: practiceSets.title, status: practiceSets.status }).from(practiceSets).where(eq(practiceSets.id, setId)).limit(1))[0];
  if (!set) return { error: "SET_NOT_FOUND" as const };
  if (set.status !== "published") return { error: "SET_RETIRED" as const };
  const media = await db.select({ id: practiceSetItemMedia.id, mediaType: practiceSetItemMedia.mediaType, objectVersion: practiceSetItemMedia.objectVersion, contentHash: practiceSetItemMedia.contentHash })
    .from(practiceSetItemMedia).innerJoin(practiceSetItems, eq(practiceSetItemMedia.practiceSetItemId, practiceSetItems.id)).where(eq(practiceSetItems.practiceSetId, set.id));
  return { set, media };
}

export async function preparePublishedPractice(learnerId: string, setId: string, db: Database = database): Promise<PracticePreparation | { error: "SET_NOT_FOUND" | "SET_RETIRED" | "ESSENTIAL_MEDIA_MISSING" | "MEDIA_UNAVAILABLE" | "MEDIA_AUTHORISATION_FAILED" }> {
  const snapshot = await publishedSnapshot(setId, db);
  if ("error" in snapshot) return snapshot;
  if (!snapshot.media.length) return { error: "ESSENTIAL_MEDIA_MISSING" };
  if (!isMediaGatewayConfigured()) return { error: "MEDIA_AUTHORISATION_FAILED" };
  const assets = await Promise.all(snapshot.media.map(async (media): Promise<PracticePreparation["assets"][number] | undefined> => {
    if (media.mediaType !== "audio" && media.mediaType !== "image") return undefined;
    const capability = await authoriseMedia(learnerId, media);
    return capability ? { id: media.id, type: media.mediaType as "audio" | "image", ...capability } : undefined;
  }));
  if (assets.some((asset) => !asset)) return { error: "MEDIA_UNAVAILABLE" };
  return { setId: snapshot.set.id, setVersionId: snapshot.set.id, title: snapshot.set.title, assets: assets.filter((asset): asset is PracticePreparation["assets"][number] => !!asset) };
}

export async function startPublishedPractice(learnerId: string, setId: string): Promise<PracticeStart | { error: "SET_NOT_FOUND" | "SET_RETIRED" | "ESSENTIAL_MEDIA_MISSING" | "MEDIA_UNAVAILABLE" | "MEDIA_AUTHORISATION_FAILED" }> {
  return database.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${learnerId}), hashtext(${setId}))`);
    const existing = (await tx.select({ id: practiceAttempts.id, practiceSetVersionId: practiceAttempts.practiceSetVersionId, revision: practiceAttempts.revision }).from(practiceAttempts).where(and(eq(practiceAttempts.learnerId, learnerId), eq(practiceAttempts.practiceSetId, setId), eq(practiceAttempts.status, "open"))).limit(1))[0];
    if (existing) return { attemptId: existing.id, setId, setVersionId: existing.practiceSetVersionId, revision: existing.revision, disposition: "resume" };
    // Prevent retirement from committing between the readiness check and attempt insert.
    await tx.execute(sql`SELECT id FROM practice_sets WHERE id = ${setId} FOR UPDATE`);
    const snapshot = await publishedSnapshot(setId, tx);
    if ("error" in snapshot) return snapshot;
    if (!snapshot.media.length) return { error: "ESSENTIAL_MEDIA_MISSING" };
    if (!isMediaGatewayConfigured()) return { error: "MEDIA_AUTHORISATION_FAILED" };
    for (const media of snapshot.media) {
      if (media.mediaType !== "audio" && media.mediaType !== "image") return { error: "MEDIA_UNAVAILABLE" };
      if (!await authoriseMedia(learnerId, media)) return { error: "MEDIA_UNAVAILABLE" };
    }
    const id = uuidv7();
    await tx.insert(practiceAttempts).values({ id, learnerId, practiceSetId: setId, practiceSetVersionId: setId, revision: 0 });
    return { attemptId: id, setId, setVersionId: setId, revision: 0, disposition: "started" };
  });
}

export async function getOpenPracticeAttempt(learnerId: string, setId: string, attemptId: string, db: Database = database): Promise<OpenPracticeAttempt | undefined> {
  const attempt = (await db.select({ attemptId: practiceAttempts.id, setId: practiceAttempts.practiceSetId, setVersionId: practiceAttempts.practiceSetVersionId, revision: practiceAttempts.revision }).from(practiceAttempts).where(and(eq(practiceAttempts.id, attemptId), eq(practiceAttempts.learnerId, learnerId), eq(practiceAttempts.practiceSetId, setId), eq(practiceAttempts.status, "open"))).limit(1))[0];
  return attempt;
}

const supportedEngines = new Set<LearnerEngine>(["picture_true_false", "picture_yes_no", "audio_picture_choice", "audio_note_taking", "word_bank_cloze"]);
const safeOptions = (value: unknown) => Array.isArray(value) && value.every((option) => typeof option === "string" && option.trim() && option.length <= 240) ? value : undefined;
const safeMedia = (type: string, accessibility: unknown) => {
  const metadata = accessibility as { altText?: unknown; choiceLabel?: unknown } | null;
  const altText = typeof metadata?.altText === "string" && metadata.altText.trim() ? metadata.altText : undefined;
  const choiceLabel = typeof metadata?.choiceLabel === "string" && metadata.choiceLabel.trim() ? metadata.choiceLabel : undefined;
  return type === "audio" || (type === "image" && altText) ? { altText, choiceLabel } : undefined;
};

export async function getPracticePlayer(learnerId: string, setId: string, attemptId: string, db: Database = database): Promise<PracticePlayer | { error: "ATTEMPT_SCOPE_MISMATCH" | "ATTEMPT_FINALISED" | "ITEM_INVALID" }> {
  const scoped = (await db.select({ attemptId: practiceAttempts.id, setId: practiceAttempts.practiceSetId, setVersionId: practiceAttempts.practiceSetVersionId, revision: practiceAttempts.revision, status: practiceAttempts.status, title: practiceSets.title }).from(practiceAttempts).innerJoin(practiceSets, eq(practiceSets.id, practiceAttempts.practiceSetVersionId)).where(and(eq(practiceAttempts.id, attemptId), eq(practiceAttempts.learnerId, learnerId))).limit(1))[0];
  if (!scoped || scoped.setId !== setId) return { error: "ATTEMPT_SCOPE_MISMATCH" };
  if (scoped.status !== "open") return { error: "ATTEMPT_FINALISED" };
  const items = await db.select({ id: practiceSetItems.id, position: practiceSetItems.position, engine: practiceSetItems.engine, prompt: practiceSetItems.renderedPrompt, options: practiceSetItems.renderedOptions }).from(practiceSetItems).where(eq(practiceSetItems.practiceSetId, scoped.setVersionId)).orderBy(practiceSetItems.position);
  if (!items.length || items.some((item) => !supportedEngines.has(item.engine as LearnerEngine) || !safeOptions(item.options))) return { error: "ITEM_INVALID" };
  const itemIds = items.map((item) => item.id);
  const [media, responses] = await Promise.all([db.select({ id: practiceSetItemMedia.id, itemId: practiceSetItemMedia.practiceSetItemId, type: practiceSetItemMedia.mediaType, contentHash: practiceSetItemMedia.contentHash, accessibility: practiceSetItemMedia.accessibilityMetadata }).from(practiceSetItemMedia).where(inArray(practiceSetItemMedia.practiceSetItemId, itemIds)), db.select({ itemId: practiceAttemptResponses.practiceSetItemId, value: practiceAttemptResponses.value }).from(practiceAttemptResponses).where(eq(practiceAttemptResponses.attemptId, attemptId))]);
  const playerItems = items.map((item) => ({
    ...item, engine: item.engine as LearnerEngine, options: safeOptions(item.options)!,
    response: responses.find((response) => response.itemId === item.id)?.value as string | boolean | number | undefined,
    media: media.filter((entry) => entry.itemId === item.id && (entry.type === "audio" || entry.type === "image")).map((entry) => ({ id: entry.id, mediaKey: `${entry.id}/${entry.contentHash}`, type: entry.type as "audio" | "image", ...safeMedia(entry.type, entry.accessibility) })),
  }));
  const malformed = playerItems.some((item) => {
    const pictures = item.media.filter((media) => media.type === "image");
    const hasAudio = item.media.some((media) => media.type === "audio");
    return item.media.some((media) => media.type === "image" && !media.altText)
      || ((item.engine === "picture_true_false" || item.engine === "picture_yes_no") && !pictures.length)
      || ((item.engine === "audio_picture_choice" || item.engine === "audio_note_taking") && !hasAudio)
      || (item.engine === "audio_picture_choice" && (!pictures.length || pictures.some((media) => !media.choiceLabel) || new Set(pictures.map((media) => media.choiceLabel)).size !== pictures.length));
  });
  if (malformed) return { error: "ITEM_INVALID" };
  return {
    attemptId, setId, setVersionId: scoped.setVersionId, revision: scoped.revision, title: scoped.title,
    items: playerItems,
  };
}

type MutationError = "ATTEMPT_SCOPE_MISMATCH" | "ATTEMPT_FINALISED" | "ATTEMPT_REVISION_CONFLICT" | "ITEM_INVALID";
async function reviseOpenAttempt(learnerId: string, setId: string, attemptId: string, expectedRevision: number, itemId: string, mediaId?: string, value?: string | boolean | number | null): Promise<{ revision: number } | { error: MutationError }> {
  return database.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM practice_attempts WHERE id = ${attemptId} FOR UPDATE`);
    const attempt = (await tx.select().from(practiceAttempts).where(and(eq(practiceAttempts.id, attemptId), eq(practiceAttempts.learnerId, learnerId))).limit(1))[0];
    if (!attempt || attempt.practiceSetId !== setId) return { error: "ATTEMPT_SCOPE_MISMATCH" };
    if (attempt.status !== "open") return { error: "ATTEMPT_FINALISED" };
    if (attempt.revision !== expectedRevision) return { error: "ATTEMPT_REVISION_CONFLICT" };
    const item = (await tx.select({ id: practiceSetItems.id, engine: practiceSetItems.engine, options: practiceSetItems.renderedOptions }).from(practiceSetItems).where(and(eq(practiceSetItems.id, itemId), eq(practiceSetItems.practiceSetId, attempt.practiceSetVersionId))).limit(1))[0];
    const options = item && safeOptions(item.options);
    const itemMedia = item ? await tx.select({ id: practiceSetItemMedia.id, type: practiceSetItemMedia.mediaType, accessibility: practiceSetItemMedia.accessibilityMetadata }).from(practiceSetItemMedia).where(eq(practiceSetItemMedia.practiceSetItemId, itemId)) : [];
    if (!item || !options || !supportedEngines.has(item.engine as LearnerEngine)) return { error: "ITEM_INVALID" };
    if (mediaId && !itemMedia.some((media) => media.id === mediaId && media.type === "audio")) return { error: "ITEM_INVALID" };
    const pictureLabels = itemMedia.filter((media) => media.type === "image").map((media) => safeMedia(media.type, media.accessibility)?.choiceLabel);
    const validResponse = value === null || (item.engine === "picture_true_false" && typeof value === "boolean") || (item.engine === "picture_yes_no" && (value === "yes" || value === "no")) || (item.engine === "audio_picture_choice" && typeof value === "string" && pictureLabels.includes(value)) || (item.engine === "audio_note_taking" && (typeof value === "string" || typeof value === "number")) || (item.engine === "word_bank_cloze" && typeof value === "string" && options.includes(value));
    if (!mediaId && !validResponse) return { error: "ITEM_INVALID" };
    if (mediaId) await tx.insert(practiceAttemptPlaybackEvents).values({ id: uuidv7(), attemptId, practiceSetItemId: itemId, practiceSetItemMediaId: mediaId });
    else if (value === null) await tx.delete(practiceAttemptResponses).where(and(eq(practiceAttemptResponses.attemptId, attemptId), eq(practiceAttemptResponses.practiceSetItemId, itemId)));
    else await tx.insert(practiceAttemptResponses).values({ id: uuidv7(), attemptId, practiceSetItemId: itemId, value }).onConflictDoUpdate({ target: [practiceAttemptResponses.attemptId, practiceAttemptResponses.practiceSetItemId], set: { value, updatedAt: new Date() } });
    const updated = (await tx.update(practiceAttempts).set({ revision: expectedRevision + 1, lastSavedAt: new Date() }).where(and(eq(practiceAttempts.id, attemptId), eq(practiceAttempts.revision, expectedRevision), eq(practiceAttempts.status, "open"))).returning({ revision: practiceAttempts.revision }))[0];
    return updated ?? { error: "ATTEMPT_REVISION_CONFLICT" };
  });
}
export const savePracticeResponse = (learnerId: string, input: { setId: string; attemptId: string; itemId: string; expectedRevision: number; value: string | boolean | number | null }) => reviseOpenAttempt(learnerId, input.setId, input.attemptId, input.expectedRevision, input.itemId, undefined, input.value);
export const recordPracticePlayback = (learnerId: string, input: { setId: string; attemptId: string; itemId: string; mediaId: string; expectedRevision: number }) => reviseOpenAttempt(learnerId, input.setId, input.attemptId, input.expectedRevision, input.itemId, input.mediaId);

export async function getAttemptMedia(learnerId: string, setId: string, attemptId: string, setVersionId: string, mediaId: string, mediaKey: string, db: Database = database) {
  const media = (await db.select({ id: practiceSetItemMedia.id, objectVersion: practiceSetItemMedia.objectVersion, contentHash: practiceSetItemMedia.contentHash }).from(practiceAttempts).innerJoin(practiceSetItems, eq(practiceSetItems.practiceSetId, practiceAttempts.practiceSetVersionId)).innerJoin(practiceSetItemMedia, and(eq(practiceSetItemMedia.practiceSetItemId, practiceSetItems.id), eq(practiceSetItemMedia.id, mediaId))).where(and(eq(practiceAttempts.id, attemptId), eq(practiceAttempts.learnerId, learnerId), eq(practiceAttempts.practiceSetId, setId), eq(practiceAttempts.practiceSetVersionId, setVersionId), eq(practiceAttempts.status, "open"))).limit(1))[0];
  return media && mediaKey === `${media.id}/${media.contentHash}` ? media : undefined;
}

type FinalisationError = "ATTEMPT_SCOPE_MISMATCH" | "ATTEMPT_FINALISED" | "ATTEMPT_REVISION_CONFLICT" | "ITEM_INVALID";
type StoredPolicy = { canonicalAnswer: string | boolean | number; acceptedAnswers: (string | boolean | number)[]; inputKind: "choice" | "boolean" | "yes_no" | "number" | "name" | "word"; normalisation: { unicode: "NFC"; locale: "en-GB"; caseSensitive: boolean; trimWhitespace: boolean; normalizePunctuation: boolean; normalizeNumberForms: boolean }; maxWords: number; teacherReviewIfUncertain: boolean; policyId?: string; canonicalId?: string };
const isPolicy = (value: unknown): value is StoredPolicy => !!value && typeof value === "object" && "canonicalAnswer" in value && "inputKind" in value && "normalisation" in value && "maxWords" in value && "teacherReviewIfUncertain" in value && "acceptedAnswers" in value;
const explanationFrom = (value: unknown) => {
  const feedback = value as { postSubmitHint?: { message?: unknown } } | null;
  return typeof feedback?.postSubmitHint?.message === "string" ? feedback.postSubmitHint.message : undefined;
};
const evidenceFor = (outcomes: string[]): "secure" | "building" | "needs_practice" | "not_assessed_yet" => outcomes.length === 0 || outcomes.every((outcome) => outcome === "unanswered" || outcome === "needs_teacher_review") ? "not_assessed_yet" : outcomes.every((outcome) => outcome === "correct") ? "secure" : outcomes.some((outcome) => outcome === "correct") ? "building" : "needs_practice";
const answerLabel = (answer: string | boolean | number | undefined, engine: LearnerEngine, choices: string[]) => {
  if (answer === undefined) return undefined;
  if (typeof answer === "boolean") return answer ? "True" : "False";
  return engine === "audio_picture_choice" ? choices.find((choice) => choice === answer) ?? "Selected picture" : String(answer);
};
const snapshotDimensions = (tags: unknown) => {
  const dimensions = (tags as { dimensions?: unknown } | null)?.dimensions;
  if (!dimensions || typeof dimensions !== "object" || Array.isArray(dimensions)) return {};
  return Object.fromEntries(Object.entries(dimensions).flatMap(([key, value]) => ["vocabulary", "grammar", "spelling", "names", "numbers", "colours", "positions", "topic"].includes(key) && Array.isArray(value) && value.every((entry) => typeof entry === "string") ? [[key, value]] : []));
};
export const finalisationResponse = (response: unknown, policy: StoredPolicy) => {
  if (policy.inputKind !== "number" || typeof response !== "string") return response;
  const normalised = normaliseAnswer(response, policy);
  return typeof normalised === "number" ? normalised : typeof normalised === "string" && /^\d+$/.test(normalised) ? Number(normalised) : response;
};
export const finalTimingSnapshot = (attempt: Pick<typeof practiceAttempts.$inferSelect, "createdAt">, submittedAt: Date) => ({ startedAt: attempt.createdAt.toISOString(), lastSavedAt: submittedAt.toISOString(), submittedAt: submittedAt.toISOString() });

export async function submitPracticeAttempt(learnerId: string, input: { setId: string; attemptId: string; expectedRevision: number; idempotencyKey: string }): Promise<SubmittedPracticeResult | { error: FinalisationError }> {
  return database.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM practice_attempts WHERE id = ${input.attemptId} FOR UPDATE`);
    const attempt = (await tx.select().from(practiceAttempts).where(and(eq(practiceAttempts.id, input.attemptId), eq(practiceAttempts.learnerId, learnerId))).limit(1))[0];
    if (!attempt || attempt.practiceSetId !== input.setId) return { error: "ATTEMPT_SCOPE_MISMATCH" };
    if (attempt.status === "submitted") return attempt.finalisationKey === input.idempotencyKey ? { attemptId: attempt.id, setId: attempt.practiceSetId, submittedAt: attempt.submittedAt!, revision: attempt.revision } : { error: "ATTEMPT_FINALISED" };
    if (attempt.revision !== input.expectedRevision) return { error: "ATTEMPT_REVISION_CONFLICT" };
    const set = (await tx.select({ title: practiceSets.title, paper: practiceSets.paper, part: practiceSets.part }).from(practiceSets).where(eq(practiceSets.id, attempt.practiceSetVersionId)).limit(1))[0];
    const items = await tx.select({ id: practiceSetItems.id, position: practiceSetItems.position, engine: practiceSetItems.engine, prompt: practiceSetItems.renderedPrompt, options: practiceSetItems.renderedOptions, answerPolicy: practiceSetItems.answerPolicy, feedback: practiceSetItems.feedback, tags: practiceSetItems.tags }).from(practiceSetItems).where(eq(practiceSetItems.practiceSetId, attempt.practiceSetVersionId)).orderBy(practiceSetItems.position);
    if (!set || !items.length || items.some((item) => !isPolicy(item.answerPolicy) || !supportedEngines.has(item.engine as LearnerEngine) || !safeOptions(item.options))) return { error: "ITEM_INVALID" };
    const responses = await tx.select({ itemId: practiceAttemptResponses.practiceSetItemId, value: practiceAttemptResponses.value }).from(practiceAttemptResponses).where(eq(practiceAttemptResponses.attemptId, attempt.id));
    const playback = await tx.select({ itemId: practiceAttemptPlaybackEvents.practiceSetItemId, mediaId: practiceAttemptPlaybackEvents.practiceSetItemMediaId, createdAt: practiceAttemptPlaybackEvents.createdAt }).from(practiceAttemptPlaybackEvents).where(eq(practiceAttemptPlaybackEvents.attemptId, attempt.id));
    const scored = items.map((item) => {
      const response = responses.find((entry) => entry.itemId === item.id)?.value;
      const policy = item.answerPolicy as StoredPolicy;
      return { item, response, outcome: response === undefined ? "unanswered" : evaluateAnswer(finalisationResponse(response, policy), policy) };
    });
    const targetIdsFor = (tags: unknown) => {
      const value = tags as { primaryTargetId?: unknown; supportingTargetIds?: unknown } | null;
      return [
        ...(typeof value?.primaryTargetId === "string" ? [value.primaryTargetId] : []),
        ...(Array.isArray(value?.supportingTargetIds) ? value.supportingTargetIds.filter((id): id is string => typeof id === "string") : []),
      ];
    };
    const targetIds = [...new Set(items.flatMap((item) => targetIdsFor(item.tags)))];
    const targets = targetIds.length ? await tx.select({ id: curriculumTargets.id, canonicalId: curriculumTargets.canonicalId, category: curriculumTargets.category }).from(curriculumTargets).where(inArray(curriculumTargets.id, targetIds)) : [];
    // A fact cannot be safely projected without every submitted target dimension.
    if (targets.length !== targetIds.length) return { error: "ITEM_INVALID" };
    const label = evidenceFor(scored.map((entry) => entry.outcome));
    const submittedAt = new Date();
    const reviewSnapshotItems = items.map((item) => ({ id: item.id, position: item.position }));
    const updated = (await tx.update(practiceAttempts).set({ status: "submitted", submittedAt, finalisationKey: input.idempotencyKey, revision: attempt.revision + 1, lastSavedAt: submittedAt, submittedTitle: set.title, submittedPresentation: { paper: set.paper, part: set.part }, expectedReviewItemCount: items.length, reviewSnapshotItems, finalTiming: finalTimingSnapshot(attempt, submittedAt), playbackSnapshot: playback.map((event) => ({ itemId: event.itemId, mediaId: event.mediaId, playedAt: event.createdAt.toISOString() })) }).where(and(eq(practiceAttempts.id, attempt.id), eq(practiceAttempts.status, "open"), eq(practiceAttempts.revision, input.expectedRevision))).returning())[0];
    if (!updated) return { error: "ATTEMPT_REVISION_CONFLICT" };
    for (const { item, response, outcome } of scored) {
      const policy = item.answerPolicy as StoredPolicy;
      const choices = safeOptions(item.options)!;
      const tags = item.tags as { primaryTargetId?: unknown; supportingTargetIds?: unknown } | null;
      const itemTargetIds = targetIdsFor(tags);
      const evidenceTargets = itemTargetIds.map((targetId) => {
        const target = targets.find((entry) => entry.id === targetId)!;
        return { id: target.id, label: target.canonicalId };
      });
      await tx.insert(practiceAttemptReviewItems).values({ id: uuidv7(), attemptId: attempt.id, practiceSetItemId: item.id, position: item.position, response: response ?? null, responseLabel: answerLabel(response as string | boolean | number | undefined, item.engine as LearnerEngine, choices), outcome, evidenceLabel: label, approvedAnswer: policy.canonicalAnswer, approvedAnswerLabel: answerLabel(policy.canonicalAnswer, item.engine as LearnerEngine, choices)!, presentation: { engine: item.engine, prompt: item.prompt, options: choices }, explanation: explanationFrom(item.feedback), answerPolicyVersion: policy.policyId ?? policy.canonicalId ?? "published-snapshot", curriculumTags: { ...(tags ?? {}), dimensions: snapshotDimensions(tags), evidenceTargets } });
    }
    const reviewItems = await tx.select({ id: practiceAttemptReviewItems.id, practiceSetItemId: practiceAttemptReviewItems.practiceSetItemId, outcome: practiceAttemptReviewItems.outcome }).from(practiceAttemptReviewItems).where(eq(practiceAttemptReviewItems.attemptId, attempt.id));
    for (const reviewItem of reviewItems) {
      const source = items.find((item) => item.id === reviewItem.practiceSetItemId)!;
      const itemTargetIds = targetIdsFor(source.tags);
      for (const targetId of itemTargetIds) {
        const target = targets.find((entry) => entry.id === targetId)!;
        const reviewTags = (await tx.select({ curriculumTags: practiceAttemptReviewItems.curriculumTags }).from(practiceAttemptReviewItems).where(eq(practiceAttemptReviewItems.id, reviewItem.id)).limit(1))[0]!.curriculumTags;
        await tx.insert(submittedEvidenceFacts).values({ id: uuidv7(), attemptId: attempt.id, reviewItemId: reviewItem.id, learnerId, practiceSetId: attempt.practiceSetId, paper: set.paper, part: set.part, languageTargetId: target.id, languageTarget: target.canonicalId, automaticOutcome: reviewItem.outcome as "correct" | "incorrect" | "unanswered" | "needs_teacher_review", submittedAt, dimensions: snapshotDimensions(reviewTags) });
      }
    }
    const tags = items.flatMap((item) => {
      const value = item.tags as { primaryTargetId?: unknown; supportingTargetIds?: unknown; guidanceId?: unknown };
      return [...targetIdsFor(value), ...(typeof value?.guidanceId === "string" ? [value.guidanceId] : [])];
    });
    for (const area of new Set(tags)) await tx.insert(practiceAttemptEvidence).values({ id: uuidv7(), attemptId: attempt.id, practiceSetId: attempt.practiceSetId, practiceAreaId: area, label });
    return { attemptId: updated.id, setId: updated.practiceSetId, submittedAt: updated.submittedAt!, revision: updated.revision };
  });
}

const filterEvidence = <T extends { learnerId: string; practiceSetId: string; paper: string; part: string; languageTarget: string; dimensions: Record<string, string[]> }>(rows: T[], filter: SubmittedEvidenceFilter = {}) => rows.filter((row) => Object.entries(filter).every(([key, value]) => {
  if (!value) return true;
  if (key === "learnerId" || key === "practiceSetId" || key === "paper" || key === "part") return row[key] === value;
  if (key === "vocabulary" || key === "grammar") return row.languageTarget === value || row.dimensions[key]?.includes(value);
  return row.dimensions[key]?.includes(value) ?? false;
}));

export const submittedEvidenceReader: SubmittedEvidenceReader = {
  async listSubmittedEvidenceFacts() {
    const currentResolution = database.select({ reviewItemId: teacherEvidenceResolutions.reviewItemId, effectiveOutcome: teacherEvidenceResolutions.effectiveOutcome, revision: teacherEvidenceResolutions.revision }).from(teacherEvidenceResolutions).where(sql`NOT EXISTS (SELECT 1 FROM teacher_evidence_resolutions newer WHERE newer.review_item_id = ${teacherEvidenceResolutions.reviewItemId} AND newer.revision > ${teacherEvidenceResolutions.revision})`).as("current_resolution");
    const rows = await database.select({ attemptId: submittedEvidenceFacts.attemptId, learnerId: submittedEvidenceFacts.learnerId, learnerName: accounts.displayName, practiceSetId: submittedEvidenceFacts.practiceSetId, paper: submittedEvidenceFacts.paper, part: submittedEvidenceFacts.part, languageTargetId: submittedEvidenceFacts.languageTargetId, languageTarget: submittedEvidenceFacts.languageTarget, automaticOutcome: submittedEvidenceFacts.automaticOutcome, effectiveOutcome: currentResolution.effectiveOutcome, resolutionRevision: currentResolution.revision, submittedAt: submittedEvidenceFacts.submittedAt, dimensions: submittedEvidenceFacts.dimensions }).from(submittedEvidenceFacts).innerJoin(accounts, eq(accounts.id, submittedEvidenceFacts.learnerId)).leftJoin(currentResolution, eq(currentResolution.reviewItemId, submittedEvidenceFacts.reviewItemId));
    return rows.map((row) => ({ ...row, paper: row.paper as "listening" | "reading_writing", automaticOutcome: row.automaticOutcome as "correct" | "incorrect" | "unanswered" | "needs_teacher_review", effectiveOutcome: (row.effectiveOutcome ?? row.automaticOutcome) as "correct" | "incorrect" | "unanswered" | "needs_teacher_review", resolutionRevision: row.resolutionRevision ?? 0, dimensions: row.dimensions as Record<string, string[]> }));
  },
  async listSubmittedEvidenceDetails(filter) {
    const currentResolution = database.select({ reviewItemId: teacherEvidenceResolutions.reviewItemId, effectiveOutcome: teacherEvidenceResolutions.effectiveOutcome, revision: teacherEvidenceResolutions.revision }).from(teacherEvidenceResolutions).where(sql`NOT EXISTS (SELECT 1 FROM teacher_evidence_resolutions newer WHERE newer.review_item_id = ${teacherEvidenceResolutions.reviewItemId} AND newer.revision > ${teacherEvidenceResolutions.revision})`).as("current_resolution");
    const rows = await database.select({ attemptId: submittedEvidenceFacts.attemptId, reviewItemId: submittedEvidenceFacts.reviewItemId, practiceSetItemId: practiceAttemptReviewItems.practiceSetItemId, learnerId: submittedEvidenceFacts.learnerId, learnerName: accounts.displayName, practiceSetId: submittedEvidenceFacts.practiceSetId, paper: submittedEvidenceFacts.paper, part: submittedEvidenceFacts.part, languageTargetId: submittedEvidenceFacts.languageTargetId, languageTarget: submittedEvidenceFacts.languageTarget, automaticOutcome: submittedEvidenceFacts.automaticOutcome, effectiveOutcome: currentResolution.effectiveOutcome, resolutionRevision: currentResolution.revision, submittedAt: submittedEvidenceFacts.submittedAt, dimensions: submittedEvidenceFacts.dimensions, position: practiceAttemptReviewItems.position, response: practiceAttemptReviewItems.response, responseLabel: practiceAttemptReviewItems.responseLabel, timing: practiceAttempts.finalTiming, playback: practiceAttempts.playbackSnapshot }).from(submittedEvidenceFacts).innerJoin(practiceAttemptReviewItems, and(eq(practiceAttemptReviewItems.id, submittedEvidenceFacts.reviewItemId), eq(practiceAttemptReviewItems.attemptId, submittedEvidenceFacts.attemptId))).innerJoin(practiceAttempts, eq(practiceAttempts.id, submittedEvidenceFacts.attemptId)).innerJoin(accounts, eq(accounts.id, submittedEvidenceFacts.learnerId)).leftJoin(currentResolution, eq(currentResolution.reviewItemId, submittedEvidenceFacts.reviewItemId)).orderBy(desc(submittedEvidenceFacts.submittedAt), desc(submittedEvidenceFacts.attemptId), practiceAttemptReviewItems.position);
    const details = filterEvidence(rows.map((row) => { const timing = row.timing as Partial<SubmittedEvidenceDetail["timing"]> | null; return { ...row, paper: row.paper as "listening" | "reading_writing", automaticOutcome: row.automaticOutcome as SubmittedEvidenceDetail["automaticOutcome"], effectiveOutcome: (row.effectiveOutcome ?? row.automaticOutcome) as SubmittedEvidenceDetail["effectiveOutcome"], resolutionRevision: row.resolutionRevision ?? 0, dimensions: row.dimensions as Record<string, string[]>, response: row.response as SubmittedEvidenceDetail["response"], timing: { startedAt: typeof timing?.startedAt === "string" ? timing.startedAt : "Not recorded", lastSavedAt: typeof timing?.lastSavedAt === "string" ? timing.lastSavedAt : "Not recorded", submittedAt: typeof timing?.submittedAt === "string" ? timing.submittedAt : row.submittedAt.toISOString() }, playback: Array.isArray(row.playback) ? row.playback.filter((event): event is SubmittedEvidenceDetail["playback"][number] => !!event && typeof event === "object" && typeof (event as { itemId?: unknown }).itemId === "string" && typeof (event as { mediaId?: unknown }).mediaId === "string" && typeof (event as { playedAt?: unknown }).playedAt === "string") : [] }; }), filter) as SubmittedEvidenceDetail[];
    return [...new Map(details.map((detail) => [detail.reviewItemId, detail])).values()];
  },
};

export async function appendTeacherEvidenceResolution(input: { reviewItemId: string; outcome: "correct" | "incorrect" | "unanswered"; reason: string; expectedRevision: number; resolverId: string }) {
  return database.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM practice_attempt_review_items WHERE id = ${input.reviewItemId} FOR UPDATE`);
    const item = (await tx.select({ id: practiceAttemptReviewItems.id, attemptId: practiceAttemptReviewItems.attemptId, outcome: practiceAttemptReviewItems.outcome }).from(practiceAttemptReviewItems).where(eq(practiceAttemptReviewItems.id, input.reviewItemId)).limit(1))[0];
    const hasEvidenceFact = item && (await tx.select({ id: submittedEvidenceFacts.id }).from(submittedEvidenceFacts).where(and(eq(submittedEvidenceFacts.reviewItemId, item.id), eq(submittedEvidenceFacts.attemptId, item.attemptId))).limit(1))[0];
    if (!item || item.outcome !== "needs_teacher_review" || !hasEvidenceFact) return { error: "RESOLUTION_TARGET_INVALID" as const };
    const current = (await tx.select({ revision: teacherEvidenceResolutions.revision }).from(teacherEvidenceResolutions).where(eq(teacherEvidenceResolutions.reviewItemId, item.id)).orderBy(desc(teacherEvidenceResolutions.revision)).limit(1))[0];
    const revision = current?.revision ?? 0;
    if (revision !== input.expectedRevision) return { error: "TEACHER_RESOLUTION_CONFLICT" as const };
    await tx.insert(teacherEvidenceResolutions).values({ id: uuidv7(), reviewItemId: item.id, revision: revision + 1, effectiveOutcome: input.outcome, reason: input.reason, resolverId: input.resolverId });
    // This projection is derived from immutable review facts and may be rebuilt without changing them.
    const outcomes = await tx.execute<{ outcome: string }>(sql`SELECT COALESCE((SELECT effective_outcome::text FROM teacher_evidence_resolutions resolution WHERE resolution.review_item_id = review.id ORDER BY revision DESC LIMIT 1), review.outcome) AS outcome FROM practice_attempt_review_items review WHERE review.attempt_id = ${item.attemptId}`);
    const label = evidenceFor(outcomes.map((entry) => entry.outcome));
    await tx.update(practiceAttemptEvidence).set({ label }).where(eq(practiceAttemptEvidence.attemptId, item.attemptId));
    await tx.insert(auditEvents).values({ id: uuidv7(), actorId: input.resolverId, action: "EVIDENCE_RESOLUTION", targetId: item.id, targetScope: "REVIEW_ITEM", outcome: "SUCCESS" });
    return { revision: revision + 1, effectiveOutcome: input.outcome };
  });
}

export async function getSubmittedPracticeReview(learnerId: string, setId: string, attemptId: string, db: Database = database): Promise<SubmittedPracticeReview | { error: "ATTEMPT_SCOPE_MISMATCH" | "ATTEMPT_FINALISED" }> {
  const attempt = (await db.select({ id: practiceAttempts.id, setId: practiceAttempts.practiceSetId, revision: practiceAttempts.revision, submittedAt: practiceAttempts.submittedAt, status: practiceAttempts.status, title: practiceAttempts.submittedTitle, expectedReviewItemCount: practiceAttempts.expectedReviewItemCount, reviewSnapshotItems: practiceAttempts.reviewSnapshotItems, presentation: practiceAttempts.submittedPresentation, timing: practiceAttempts.finalTiming, playback: practiceAttempts.playbackSnapshot }).from(practiceAttempts).where(and(eq(practiceAttempts.id, attemptId), eq(practiceAttempts.learnerId, learnerId))).limit(1))[0];
  if (!attempt || attempt.setId !== setId) return { error: "ATTEMPT_SCOPE_MISMATCH" };
  if (attempt.status !== "submitted" || !attempt.submittedAt || !attempt.title || !attempt.presentation || !attempt.timing || !attempt.playback || !attempt.expectedReviewItemCount || !attempt.reviewSnapshotItems) return { error: "ATTEMPT_FINALISED" };
  const items = await db.select().from(practiceAttemptReviewItems).where(eq(practiceAttemptReviewItems.attemptId, attemptId)).orderBy(practiceAttemptReviewItems.position);
  if (items.length !== attempt.expectedReviewItemCount || JSON.stringify(items.map((item) => ({ id: item.practiceSetItemId, position: item.position }))) !== JSON.stringify(attempt.reviewSnapshotItems) || items.some((item) => !item.presentation || !item.approvedAnswerLabel)) return { error: "ATTEMPT_FINALISED" };
  return { attemptId, setId, submittedAt: attempt.submittedAt, revision: attempt.revision, title: attempt.title, items: items.map((item) => ({ id: item.practiceSetItemId, position: item.position, response: item.response as string | boolean | number | null, responseLabel: item.responseLabel ?? undefined, outcome: item.outcome as SubmittedPracticeReview["items"][number]["outcome"], approvedAnswer: item.approvedAnswer as string | boolean | number, approvedAnswerLabel: item.approvedAnswerLabel, explanation: item.explanation ?? undefined, evidenceLabel: item.evidenceLabel })) };
}
