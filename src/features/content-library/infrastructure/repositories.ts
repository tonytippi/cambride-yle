import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  accounts,
  answerPolicies,
  answerPolicyVersions,
  contentReviewRecords,
  curriculumGuidance,
  curriculumTargets,
  mediaDrafts,
  policyConformanceVectors,
  practiceSetCompositions,
  practiceSetItems,
  practiceSetReviewRecords,
  practiceSets,
  questionDrafts,
  questionVersionMedia,
} from "@/../db/schema";
import { database } from "@/infrastructure/database/client";
import { uuidv7 } from "@/features/identity/infrastructure/uuid";
import type { GuidanceRecord, LibraryRecord, MediaRecord, PolicyRecord, PracticeSetRecord, QuestionRecord, TargetRecord } from "../domain/records";

type Database = typeof database | Parameters<Parameters<typeof database.transaction>[0]>[0];
/* eslint-disable no-unused-vars */
type Refs = (id: string) => string;
type ActorFor = (email: string | null) => string;
/* eslint-enable no-unused-vars */
const strings = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

/* Reads every curriculum record, content version and practice set as library records. */
export async function loadExportRecords(db: Database = database): Promise<LibraryRecord[]> {
  const people = new Map((await db.select({ id: accounts.id, email: accounts.canonicalEmail }).from(accounts)).map((row) => [row.id, row.email]));
  const emailOf = (id: string | null | undefined) => (id && people.get(id)) || null;
  const [targets, guidance, policies, versions, vectors, questions, media, associations, sets, compositions, items, contentApprovals, setApprovals] = await Promise.all([
    db.select().from(curriculumTargets),
    db.select().from(curriculumGuidance),
    db.select().from(answerPolicies),
    db.select().from(answerPolicyVersions).orderBy(asc(answerPolicyVersions.version)),
    db.select().from(policyConformanceVectors),
    db.select().from(questionDrafts),
    db.select().from(mediaDrafts),
    db.select().from(questionVersionMedia).orderBy(asc(questionVersionMedia.position)),
    db.select().from(practiceSets),
    db.select().from(practiceSetCompositions).orderBy(asc(practiceSetCompositions.position)),
    db.select({ practiceSetId: practiceSetItems.practiceSetId, questionVersionId: practiceSetItems.questionVersionId }).from(practiceSetItems).orderBy(asc(practiceSetItems.position)),
    db.select({ targetId: contentReviewRecords.targetId, actorId: contentReviewRecords.actorId }).from(contentReviewRecords).where(eq(contentReviewRecords.decision, "approved")).orderBy(desc(contentReviewRecords.createdAt)),
    db.select({ practiceSetId: practiceSetReviewRecords.practiceSetId, actorId: practiceSetReviewRecords.actorId }).from(practiceSetReviewRecords).where(eq(practiceSetReviewRecords.decision, "approved")).orderBy(desc(practiceSetReviewRecords.createdAt)),
  ]);
  const contentApprover = (id: string) => emailOf(contentApprovals.find((row) => row.targetId === id)?.actorId);
  const base = (row: (typeof questions)[number] | (typeof media)[number]) => ({
    schemaVersion: 1 as const, id: row.id, status: row.status, approvedBy: contentApprover(row.id), origin: row.origin, level: row.level, paper: row.paper, part: row.part, engine: row.engine,
    primaryTargetId: row.primaryTargetId, supportingTargetIds: strings(row.supportingTargetIds), topicIds: strings(row.topicIds), guidanceId: row.guidanceId,
    evidenceDimensions: row.evidenceDimensions, estimatedDurationSeconds: row.estimatedDurationSeconds, accessibilityMetadata: row.accessibilityMetadata, provenance: row.provenance,
    sourceVersionId: row.sourceVersionId, createdBy: emailOf(row.createdBy), createdAt: row.createdAt.toISOString(),
  });
  return [
    ...targets.map((row): TargetRecord => ({ schemaVersion: 1, kind: "target", id: row.id, canonicalId: row.canonicalId, category: row.category, level: row.level, guidance: row.guidance, isApproved: row.isApproved, createdBy: emailOf(row.createdBy) })),
    ...guidance.map((row): GuidanceRecord => ({ schemaVersion: 1, kind: "guidance", id: row.id, paper: row.paper, part: row.part, engine: row.engine, topic: row.topic, taskFormat: row.taskFormat, maxWords: row.maxWords, maxOptions: row.maxOptions, approvedNames: row.approvedNames, approvedNumbers: row.approvedNumbers })),
    ...policies.map((row): PolicyRecord => ({
      schemaVersion: 1, kind: "policy", id: row.id, canonicalId: row.canonicalId, targetId: row.targetId, guidanceId: row.guidanceId, paper: row.paper, part: row.part, engine: row.engine,
      versions: versions.filter((version) => version.policyId === row.id).map((version) => ({
        id: version.id, version: version.version, inputKind: version.inputKind, canonicalAnswer: version.canonicalAnswer, acceptedAnswers: version.acceptedAnswers, normalisation: version.normalisation,
        maxWords: version.maxWords, teacherReviewIfUncertain: version.teacherReviewIfUncertain, createdBy: emailOf(version.createdBy),
        vectors: vectors.filter((vector) => vector.policyVersionId === version.id).map((vector) => ({ response: vector.response, expectedOutcome: vector.expectedOutcome })),
      })),
    })),
    ...media.map((row): MediaRecord => ({
      ...base(row), kind: "media", mediaType: row.mediaType, previewUrl: row.previewUrl, description: row.description,
      file: row.objectKey && row.contentType && row.byteSize && row.contentSha256 ? { objectKey: row.objectKey, contentType: row.contentType, byteSize: row.byteSize, contentSha256: row.contentSha256 } : null,
    })),
    ...questions.map((row): QuestionRecord => ({
      ...base(row), kind: "question", answerPolicyVersionId: row.answerPolicyVersionId, prompt: row.prompt, options: row.options, postSubmitHint: row.postSubmitHint,
      mediaIds: associations.filter((entry) => entry.questionVersionId === row.id).map((entry) => entry.mediaVersionId),
    })),
    ...sets.map((row): PracticeSetRecord => {
      const composed = compositions.filter((entry) => entry.practiceSetId === row.id);
      // Sets published before compositions existed only have their snapshot items.
      const questionIds = (composed.length ? composed : items.filter((entry) => entry.practiceSetId === row.id)).map((entry) => entry.questionVersionId);
      return {
        schemaVersion: 1, kind: "practice_set", id: row.id, status: row.status, approvedBy: emailOf(setApprovals.find((entry) => entry.practiceSetId === row.id)?.actorId),
        title: row.title, paper: row.paper, part: row.part, estimatedDurationSeconds: row.estimatedDurationSeconds, primaryTargetIds: strings(row.primaryTargetIds), questionIds,
        createdBy: emailOf(row.createdBy), createdAt: row.createdAt.toISOString(),
      };
    }),
  ];
}

export async function accountIdsByEmail(emails: (string | null)[], db: Database) {
  const wanted = [...new Set(emails.filter((value): value is string => Boolean(value)))];
  const rows = wanted.length ? await db.select({ id: accounts.id, email: accounts.canonicalEmail }).from(accounts).where(inArray(accounts.canonicalEmail, wanted)) : [];
  return new Map(rows.map((row) => [row.email, row.id]));
}

export async function existingContentIds(db: Database = database) {
  const [questions, media, sets] = await Promise.all([
    db.select({ id: questionDrafts.id, status: questionDrafts.status }).from(questionDrafts),
    db.select({ id: mediaDrafts.id, status: mediaDrafts.status }).from(mediaDrafts),
    db.select({ id: practiceSets.id, status: practiceSets.status }).from(practiceSets),
  ]);
  return new Map([...questions, ...media, ...sets].map((row) => [row.id, row.status]));
}

/* Curriculum resolution by natural key: an existing record wins, otherwise the library record keeps its ID. */
export async function resolveTarget(record: TargetRecord, createdBy: string, db: Database) {
  const existing = (await db.select().from(curriculumTargets).where(eq(curriculumTargets.canonicalId, record.canonicalId)).limit(1))[0];
  if (existing) return { id: existing.id, created: false, differs: existing.category !== record.category || existing.guidance !== record.guidance || existing.isApproved !== record.isApproved };
  await db.insert(curriculumTargets).values({ id: record.id, canonicalId: record.canonicalId, category: record.category, level: record.level, guidance: record.guidance, isApproved: record.isApproved, createdBy });
  return { id: record.id, created: true, differs: false };
}
export async function resolveGuidance(record: GuidanceRecord, db: Database) {
  const engine = record.engine as typeof curriculumGuidance.$inferSelect.engine;
  const existing = (await db.select().from(curriculumGuidance).where(and(eq(curriculumGuidance.paper, record.paper), eq(curriculumGuidance.part, record.part), eq(curriculumGuidance.engine, engine), eq(curriculumGuidance.topic, record.topic), eq(curriculumGuidance.taskFormat, record.taskFormat))).limit(1))[0];
  if (existing) return { id: existing.id, created: false, differs: existing.maxWords !== record.maxWords || existing.maxOptions !== record.maxOptions || JSON.stringify(existing.approvedNames) !== JSON.stringify(record.approvedNames) || JSON.stringify(existing.approvedNumbers) !== JSON.stringify(record.approvedNumbers) };
  await db.insert(curriculumGuidance).values({ id: record.id, paper: record.paper, part: record.part, engine, topic: record.topic, taskFormat: record.taskFormat, maxWords: record.maxWords, maxOptions: record.maxOptions, approvedNames: record.approvedNames, approvedNumbers: record.approvedNumbers });
  return { id: record.id, created: true, differs: false };
}
/* Returns library version ID -> local version ID; missing versions are inserted with their original numbers. */
export async function resolvePolicy(record: PolicyRecord, targetId: string, guidanceId: string, actorFor: ActorFor, db: Database) {
  const engine = record.engine as typeof answerPolicies.$inferSelect.engine;
  let policy = (await db.select().from(answerPolicies).where(eq(answerPolicies.canonicalId, record.canonicalId)).limit(1))[0];
  if (!policy) {
    await db.insert(answerPolicies).values({ id: record.id, canonicalId: record.canonicalId, targetId, guidanceId, paper: record.paper, part: record.part, engine });
    policy = (await db.select().from(answerPolicies).where(eq(answerPolicies.id, record.id)).limit(1))[0]!;
  }
  const local = await db.select().from(answerPolicyVersions).where(eq(answerPolicyVersions.policyId, policy.id));
  const ids = new Map<string, string>();
  let differs = false;
  let inserted = false;
  for (const version of record.versions) {
    const match = local.find((entry) => entry.version === version.version);
    if (match) {
      ids.set(version.id, match.id);
      differs ||= match.inputKind !== version.inputKind || JSON.stringify(match.canonicalAnswer) !== JSON.stringify(version.canonicalAnswer) || JSON.stringify(match.acceptedAnswers) !== JSON.stringify(version.acceptedAnswers);
      continue;
    }
    const id = local.some((entry) => entry.id === version.id) ? uuidv7() : version.id;
    await db.insert(answerPolicyVersions).values({
      id, policyId: policy.id, version: version.version, inputKind: version.inputKind as typeof answerPolicyVersions.$inferSelect.inputKind, canonicalAnswer: version.canonicalAnswer,
      acceptedAnswers: version.acceptedAnswers, normalisation: version.normalisation, maxWords: version.maxWords, teacherReviewIfUncertain: version.teacherReviewIfUncertain, createdBy: actorFor(version.createdBy),
    });
    if (version.vectors.length) await db.insert(policyConformanceVectors).values(version.vectors.map((vector) => ({ id: uuidv7(), policyVersionId: id, response: vector.response, expectedOutcome: vector.expectedOutcome })));
    ids.set(version.id, id);
    inserted = true;
  }
  if (inserted) {
    const latest = (await db.select({ id: answerPolicyVersions.id }).from(answerPolicyVersions).where(eq(answerPolicyVersions.policyId, policy.id)).orderBy(desc(answerPolicyVersions.version)).limit(1))[0];
    if (latest) await db.update(answerPolicies).set({ currentVersionId: latest.id }).where(eq(answerPolicies.id, policy.id));
  }
  return { ids, differs };
}

type ContentRow = Omit<typeof questionDrafts.$inferInsert, "answerPolicyVersionId" | "prompt" | "options" | "postSubmitHint">;
const contentRow = (record: QuestionRecord | MediaRecord, refs: Refs, createdBy: string): ContentRow => ({
  id: record.id, status: "draft", origin: record.origin, level: record.level, paper: record.paper, part: record.part, engine: record.engine as ContentRow["engine"],
  primaryTargetId: refs(record.primaryTargetId), supportingTargetIds: record.supportingTargetIds.map(refs), topicIds: record.topicIds.map(refs), guidanceId: refs(record.guidanceId),
  evidenceDimensions: record.evidenceDimensions ?? {}, estimatedDurationSeconds: record.estimatedDurationSeconds, accessibilityMetadata: record.accessibilityMetadata, provenance: record.provenance,
  sourceVersionId: record.sourceVersionId, createdBy, createdAt: new Date(record.createdAt),
});
export async function insertMediaDraft(record: MediaRecord, refs: Refs, createdBy: string, db: Database) {
  await db.insert(mediaDrafts).values({
    ...contentRow(record, refs, createdBy), mediaType: record.mediaType, previewUrl: record.previewUrl, description: record.description,
    ...(record.file && { objectKey: record.file.objectKey, contentType: record.file.contentType, byteSize: record.file.byteSize, contentSha256: record.file.contentSha256 }),
  });
}
export async function insertQuestionDraft(record: QuestionRecord, refs: Refs, createdBy: string, db: Database) {
  await db.insert(questionDrafts).values({ ...contentRow(record, refs, createdBy), answerPolicyVersionId: refs(record.answerPolicyVersionId), prompt: record.prompt, options: record.options, postSubmitHint: record.postSubmitHint ?? null });
  if (record.mediaIds.length) await db.insert(questionVersionMedia).values(record.mediaIds.map((mediaVersionId, index) => ({ id: uuidv7(), questionVersionId: record.id, mediaVersionId, position: index + 1 })));
}
export async function insertPracticeSetDraft(record: PracticeSetRecord, refs: Refs, createdBy: string, db: Database) {
  await db.insert(practiceSets).values({ id: record.id, status: "draft", title: record.title, paper: record.paper, part: record.part, estimatedDurationSeconds: record.estimatedDurationSeconds, primaryTargetIds: record.primaryTargetIds.map(refs), createdBy, createdAt: new Date(record.createdAt) });
  await db.insert(practiceSetCompositions).values(record.questionIds.map((questionVersionId, index) => ({ id: uuidv7(), practiceSetId: record.id, questionVersionId, position: index + 1 })));
}
