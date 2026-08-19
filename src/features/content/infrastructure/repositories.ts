import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  answerPolicies,
  answerPolicyVersions,
  contentAuditEvents,
  contentGenerationRecords,
  contentPhonePreviewRecords,
  contentReviewRecords,
  contentValidationResults,
  curriculumGuidance,
  curriculumTargets,
  mediaDrafts,
  practiceSetAuditEvents,
  practiceSetItemMedia,
  practiceSetItems,
  practiceSets,
  questionDrafts,
} from "@/../db/schema";
import { database } from "@/infrastructure/database/client";
import { uuidv7 } from "@/features/identity/infrastructure/uuid";
import { createHash } from "node:crypto";
import type { MediaDraftInput, QuestionDraftInput } from "../domain/contracts";
type Database =
  typeof database | Parameters<Parameters<typeof database.transaction>[0]>[0];
const baseValues = (
  input: QuestionDraftInput | MediaDraftInput,
  actorId: string,
  origin: "manual" | "generated",
  sourceVersionId?: string,
) => ({
  ...input,
  part: String(input.part),
  estimatedDurationSeconds: String(input.estimatedDurationSeconds),
  origin,
  sourceVersionId: sourceVersionId ?? null,
  createdBy: actorId,
});
export async function createQuestion(
  input: QuestionDraftInput,
  actorId: string,
  origin: "manual" | "generated",
  db: Database,
  sourceVersionId?: string,
) {
  const id = uuidv7();
  await db.insert(questionDrafts).values({
    id,
    ...baseValues(input, actorId, origin, sourceVersionId),
    answerPolicyVersionId: input.answerPolicyVersionId,
    prompt: input.prompt,
    options: input.options,
  });
  await audit("QUESTION_DRAFT_CREATED", "question", id, actorId, db);
  return id;
}
export async function createMedia(
  input: MediaDraftInput,
  actorId: string,
  origin: "manual" | "generated",
  db: Database,
  sourceVersionId?: string,
) {
  const id = uuidv7();
  await db.insert(mediaDrafts).values({
    id,
    ...baseValues(input, actorId, origin, sourceVersionId),
    mediaType: input.mediaType,
    previewUrl: input.previewUrl,
    description: input.description,
  });
  await audit("MEDIA_DRAFT_CREATED", "media", id, actorId, db);
  return id;
}
export async function getQuestion(id: string, db: Database = database) {
  return (
    await db
      .select()
      .from(questionDrafts)
      .where(eq(questionDrafts.id, id))
      .limit(1)
  )[0];
}
export async function getMedia(id: string, db: Database = database) {
  return (
    await db.select().from(mediaDrafts).where(eq(mediaDrafts.id, id)).limit(1)
  )[0];
}
export async function listDrafts(db: Database = database) {
  return {
    questions: await db
      .select()
      .from(questionDrafts)
      .orderBy(asc(questionDrafts.createdAt)),
    media: await db
      .select()
      .from(mediaDrafts)
      .orderBy(asc(mediaDrafts.createdAt)),
    sets: await db
      .select()
      .from(practiceSets)
      .orderBy(desc(practiceSets.createdAt)),
    generations: await db.select().from(contentGenerationRecords),
    validations: await db
      .select()
      .from(contentValidationResults)
      .orderBy(desc(contentValidationResults.createdAt)),
    reviews: await db
      .select()
      .from(contentReviewRecords)
      .orderBy(desc(contentReviewRecords.createdAt)),
    previews: await db
      .select()
      .from(contentPhonePreviewRecords)
      .orderBy(desc(contentPhonePreviewRecords.createdAt)),
  };
}
export async function getContent(
  kind: "question" | "media",
  id: string,
  db: Database,
) {
  return kind === "question" ? getQuestion(id, db) : getMedia(id, db);
}
export async function updateStatus(
  kind: "question" | "media",
  id: string,
  status: "in_review" | "approved" | "published" | "retired",
  db: Database,
) {
  const table = kind === "question" ? questionDrafts : mediaDrafts;
  await db.update(table).set({ status }).where(eq(table.id, id));
}
export async function recordValidation(
  kind: "question" | "media",
  targetId: string,
  actorId: string,
  findings: unknown,
  db: Database,
) {
  const id = uuidv7();
  await db
    .insert(contentValidationResults)
    .values({ id, kind, targetId, actorId, findings });
  return id;
}
export async function latestValidation(
  kind: "question" | "media",
  targetId: string,
  db: Database,
) {
  return (
    await db
      .select()
      .from(contentValidationResults)
      .where(
        and(
          eq(contentValidationResults.kind, kind),
          eq(contentValidationResults.targetId, targetId),
        ),
      )
      .orderBy(
        desc(contentValidationResults.createdAt),
        desc(contentValidationResults.id),
      )
      .limit(1)
  )[0];
}
export async function recordReview(
  kind: "question" | "media",
  targetId: string,
  actorId: string,
  decision: "submitted" | "approved" | "rejected" | "exception",
  findings: unknown,
  db: Database,
  validationResultId?: string,
  reason?: string,
) {
  await db.insert(contentReviewRecords).values({
    id: uuidv7(),
    kind,
    targetId,
    actorId,
    decision,
    validationResultId,
    reason,
    findings,
  });
}
export async function recordPhonePreview(
  targetId: string,
  actorId: string,
  db: Database,
) {
  await db.insert(contentPhonePreviewRecords).values({
    id: uuidv7(),
    targetId,
    actorId,
    viewportWidth: 375,
    successful: true,
  });
}
export async function hasPhonePreview(targetId: string, db: Database) {
  return Boolean(
    (
      await db
        .select()
        .from(contentPhonePreviewRecords)
        .where(
          and(
            eq(contentPhonePreviewRecords.targetId, targetId),
            eq(contentPhonePreviewRecords.viewportWidth, 375),
            eq(contentPhonePreviewRecords.successful, true),
          ),
        )
        .limit(1)
    )[0],
  );
}
export async function hasExceptionForValidation(
  kind: "question" | "media",
  targetId: string,
  validationResultId: string,
  db: Database,
) {
  return Boolean(
    (
      await db
        .select()
        .from(contentReviewRecords)
        .where(
          and(
            eq(contentReviewRecords.kind, kind),
            eq(contentReviewRecords.targetId, targetId),
            eq(contentReviewRecords.validationResultId, validationResultId),
            eq(contentReviewRecords.decision, "exception"),
          ),
        )
        .limit(1)
    )[0],
  );
}
export async function hasRejection(
  kind: "question" | "media",
  targetId: string,
  db: Database,
) {
  return Boolean(
    (
      await db
        .select()
        .from(contentReviewRecords)
        .where(
          and(
            eq(contentReviewRecords.kind, kind),
            eq(contentReviewRecords.targetId, targetId),
            eq(contentReviewRecords.decision, "rejected"),
          ),
        )
        .limit(1)
    )[0],
  );
}
export async function getControlledReferences(
  input: QuestionDraftInput | MediaDraftInput,
  db: Database,
) {
  const targetIds = [
    input.primaryTargetId,
    ...input.supportingTargetIds,
    ...input.topicIds,
  ];
  const targets = targetIds.length
    ? await db
        .select()
        .from(curriculumTargets)
        .where(inArray(curriculumTargets.id, targetIds))
    : [];
  const guidance = (
    await db
      .select()
      .from(curriculumGuidance)
      .where(eq(curriculumGuidance.id, input.guidanceId))
      .limit(1)
  )[0];
  const policy =
    "answerPolicyVersionId" in input
      ? (
          await db
            .select({ version: answerPolicyVersions, policy: answerPolicies })
            .from(answerPolicyVersions)
            .innerJoin(
              answerPolicies,
              eq(answerPolicyVersions.policyId, answerPolicies.id),
            )
            .where(eq(answerPolicyVersions.id, input.answerPolicyVersionId))
            .limit(1)
        )[0]
      : undefined;
  return {
    targets: targets.filter((target) => targetIds.includes(target.id)),
    guidance,
    policy,
  };
}
export async function recordGeneration(
  kind: "question" | "media",
  targetId: string,
  gatewayKind: "text" | "image",
  endpoint: string,
  model: string,
  promptProvenance: unknown,
  referenceProvenance: unknown,
  hash: string,
  db: Database,
) {
  await db.insert(contentGenerationRecords).values({
    id: uuidv7(),
    kind,
    targetId,
    gatewayKind,
    endpoint,
    model,
    promptProvenance,
    referenceProvenance,
    outputHash: hash,
  });
}
export async function recordAudit(
  action: string,
  kind: "question" | "media",
  targetId: string,
  actorId: string,
  db: Database,
) {
  await db
    .insert(contentAuditEvents)
    .values({ id: uuidv7(), actorId, action, kind, targetId });
}
export async function recordPracticeSetAudit(
  action: string,
  practiceSetId: string,
  actorId: string,
  db: Database,
) {
  await db
    .insert(practiceSetAuditEvents)
    .values({ id: uuidv7(), actorId, action, practiceSetId });
}
async function audit(
  action: string,
  kind: "question" | "media",
  targetId: string,
  actorId: string,
  db: Database,
) {
  await recordAudit(action, kind, targetId, actorId, db);
}
export async function getQuestions(ids: string[], db: Database) {
  return ids.length
    ? db.select().from(questionDrafts).where(inArray(questionDrafts.id, ids))
    : [];
}
export async function lockQuestions(ids: string[], db: Database) {
  return ids.length
    ? db
        .select()
        .from(questionDrafts)
        .where(inArray(questionDrafts.id, ids))
        .for("update")
    : [];
}
export async function getMediaVersions(ids: string[], db: Database) {
  return ids.length
    ? db.select().from(mediaDrafts).where(inArray(mediaDrafts.id, ids))
    : [];
}
export async function lockMediaVersions(ids: string[], db: Database) {
  return ids.length
    ? db
        .select()
        .from(mediaDrafts)
        .where(inArray(mediaDrafts.id, ids))
        .for("update")
    : [];
}
export async function createPublishedPracticeSet(
  input: {
    questions: Awaited<ReturnType<typeof getQuestions>>;
    mediaByQuestion: Map<string, Awaited<ReturnType<typeof getMediaVersions>>>;
    actorId: string;
  },
  db: Database,
) {
  const id = uuidv7();
  const questions = input.questions;
  const duration = questions.reduce(
    (total, question) => total + Number(question.estimatedDurationSeconds),
    0,
  );
  await db.insert(practiceSets).values({
    id,
    paper: questions[0]!.paper,
    part: questions[0]!.part,
    estimatedDurationSeconds: duration,
    primaryTargetIds: [
      ...new Set(questions.map((question) => question.primaryTargetId)),
    ],
    createdBy: input.actorId,
  });
  for (const [index, question] of questions.entries()) {
    const itemId = uuidv7();
    const policy = await db
      .select({ version: answerPolicyVersions, policy: answerPolicies })
      .from(answerPolicyVersions)
      .innerJoin(
        answerPolicies,
        eq(answerPolicyVersions.policyId, answerPolicies.id),
      )
      .where(eq(answerPolicyVersions.id, question.answerPolicyVersionId))
      .limit(1);
    await db.insert(practiceSetItems).values({
      id: itemId,
      practiceSetId: id,
      position: index + 1,
      questionVersionId: question.id,
      engine: question.engine,
      renderedPrompt: question.prompt,
      renderedOptions: question.options,
      answerPolicy: policy[0],
      feedback: { postSubmitHint: question.postSubmitHint ?? null },
      tags: {
        primaryTargetId: question.primaryTargetId,
        supportingTargetIds: question.supportingTargetIds,
        topicIds: question.topicIds,
        guidanceId: question.guidanceId,
      },
      accessibilityMetadata: question.accessibilityMetadata,
      provenance: question.provenance,
    });
    for (const media of input.mediaByQuestion.get(question.id) ?? [])
      await db.insert(practiceSetItemMedia).values({
        id: uuidv7(),
        practiceSetItemId: itemId,
        mediaVersionId: media.id,
        mediaType: media.mediaType,
        objectVersion: media.id,
        contentHash: createHash("sha256")
          .update(
            JSON.stringify({
              id: media.id,
              previewUrl: media.previewUrl,
              description: media.description,
              provenance: media.provenance,
            }),
          )
          .digest("hex"),
        accessibilityMetadata: media.accessibilityMetadata,
        provenance: media.provenance,
      });
  }
  return id;
}
export async function getPracticeSet(id: string, db: Database) {
  return (
    await db.select().from(practiceSets).where(eq(practiceSets.id, id)).limit(1)
  )[0];
}
export async function retirePracticeSet(id: string, db: Database) {
  await db
    .update(practiceSets)
    .set({ status: "retired" })
    .where(eq(practiceSets.id, id));
}
