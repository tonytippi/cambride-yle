import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  curriculumGuidance,
  practiceAttemptEvidence,
  practiceAttempts,
  practiceAttemptPlaybackEvents,
  practiceAttemptResponses,
  practiceRecommendationAudits,
  practiceSetItems,
  practiceSetItemMedia,
  practiceSets,
} from "@/../db/schema";
import { database } from "@/infrastructure/database/client";
import { uuidv7 } from "@/features/identity/infrastructure/uuid";
import { authoriseMedia, isMediaGatewayConfigured } from "./media-gateway";
import type { LearnerEngine, OpenPracticeAttempt, PracticePlayer, PracticePreparation, PracticeStart, SubmittedEvidence } from "../domain/contracts";

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
  const [media, responses] = await Promise.all([db.select({ id: practiceSetItemMedia.id, itemId: practiceSetItemMedia.practiceSetItemId, type: practiceSetItemMedia.mediaType, accessibility: practiceSetItemMedia.accessibilityMetadata }).from(practiceSetItemMedia).where(inArray(practiceSetItemMedia.practiceSetItemId, itemIds)), db.select({ itemId: practiceAttemptResponses.practiceSetItemId, value: practiceAttemptResponses.value }).from(practiceAttemptResponses).where(eq(practiceAttemptResponses.attemptId, attemptId))]);
  const playerItems = items.map((item) => ({
    ...item, engine: item.engine as LearnerEngine, options: safeOptions(item.options)!,
    response: responses.find((response) => response.itemId === item.id)?.value as string | boolean | number | undefined,
    media: media.filter((entry) => entry.itemId === item.id && (entry.type === "audio" || entry.type === "image")).map((entry) => ({ id: entry.id, type: entry.type as "audio" | "image", ...safeMedia(entry.type, entry.accessibility) })),
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

export async function getAttemptMedia(learnerId: string, setId: string, attemptId: string, mediaId: string, db: Database = database) {
  const media = (await db.select({ id: practiceSetItemMedia.id, objectVersion: practiceSetItemMedia.objectVersion, contentHash: practiceSetItemMedia.contentHash }).from(practiceAttempts).innerJoin(practiceSetItems, eq(practiceSetItems.practiceSetId, practiceAttempts.practiceSetVersionId)).innerJoin(practiceSetItemMedia, and(eq(practiceSetItemMedia.practiceSetItemId, practiceSetItems.id), eq(practiceSetItemMedia.id, mediaId))).where(and(eq(practiceAttempts.id, attemptId), eq(practiceAttempts.learnerId, learnerId), eq(practiceAttempts.practiceSetId, setId), eq(practiceAttempts.status, "open"))).limit(1))[0];
  return media;
}
