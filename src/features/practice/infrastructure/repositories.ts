import { and, desc, eq, gte, sql } from "drizzle-orm";
import {
  curriculumGuidance,
  practiceAttemptEvidence,
  practiceAttempts,
  practiceRecommendationAudits,
  practiceSetItems,
  practiceSetItemMedia,
  practiceSets,
} from "@/../db/schema";
import { database } from "@/infrastructure/database/client";
import { uuidv7 } from "@/features/identity/infrastructure/uuid";
import { authoriseMedia, isMediaGatewayConfigured } from "./media-gateway";
import type { OpenPracticeAttempt, PracticePreparation, PracticeStart, SubmittedEvidence } from "../domain/contracts";

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
