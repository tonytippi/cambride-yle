import { asc, eq, inArray } from "drizzle-orm";
import { answerPolicies, answerPolicyVersions, contentAuditEvents, contentGenerationRecords, curriculumGuidance, curriculumTargets, mediaDrafts, questionDrafts } from "@/../db/schema";
import { database } from "@/infrastructure/database/client";
import { uuidv7 } from "@/features/identity/infrastructure/uuid";
import type { MediaDraftInput, QuestionDraftInput } from "../domain/contracts";
type Database = typeof database | Parameters<Parameters<typeof database.transaction>[0]>[0];
const baseValues = (input: QuestionDraftInput | MediaDraftInput, actorId: string, origin: "manual" | "generated", sourceVersionId?: string) => ({ ...input, part: String(input.part), estimatedDurationSeconds: String(input.estimatedDurationSeconds), origin, sourceVersionId: sourceVersionId ?? null, createdBy: actorId });
export async function createQuestion(input: QuestionDraftInput, actorId: string, origin: "manual" | "generated", db: Database, sourceVersionId?: string) { const id = uuidv7(); await db.insert(questionDrafts).values({ id, ...baseValues(input, actorId, origin, sourceVersionId), answerPolicyVersionId: input.answerPolicyVersionId, prompt: input.prompt, options: input.options }); await audit("QUESTION_DRAFT_CREATED", "question", id, actorId, db); return id; }
export async function createMedia(input: MediaDraftInput, actorId: string, origin: "manual" | "generated", db: Database, sourceVersionId?: string) { const id = uuidv7(); await db.insert(mediaDrafts).values({ id, ...baseValues(input, actorId, origin, sourceVersionId), mediaType: input.mediaType, previewUrl: input.previewUrl, description: input.description }); await audit("MEDIA_DRAFT_CREATED", "media", id, actorId, db); return id; }
export async function getQuestion(id: string, db: Database = database) { return (await db.select().from(questionDrafts).where(eq(questionDrafts.id, id)).limit(1))[0]; }
export async function getMedia(id: string, db: Database = database) { return (await db.select().from(mediaDrafts).where(eq(mediaDrafts.id, id)).limit(1))[0]; }
export async function listDrafts(db: Database = database) { return { questions: await db.select().from(questionDrafts).orderBy(asc(questionDrafts.createdAt)), media: await db.select().from(mediaDrafts).orderBy(asc(mediaDrafts.createdAt)), generations: await db.select().from(contentGenerationRecords) }; }
export async function getControlledReferences(input: QuestionDraftInput | MediaDraftInput, db: Database) {
  const targetIds = [input.primaryTargetId, ...input.supportingTargetIds, ...input.topicIds];
  const targets = targetIds.length ? await db.select().from(curriculumTargets).where(inArray(curriculumTargets.id, targetIds)) : [];
  const guidance = (await db.select().from(curriculumGuidance).where(eq(curriculumGuidance.id, input.guidanceId)).limit(1))[0];
  const policy = "answerPolicyVersionId" in input ? (await db.select({ version: answerPolicyVersions, policy: answerPolicies }).from(answerPolicyVersions).innerJoin(answerPolicies, eq(answerPolicyVersions.policyId, answerPolicies.id)).where(eq(answerPolicyVersions.id, input.answerPolicyVersionId)).limit(1))[0] : undefined;
  return { targets: targets.filter((target) => targetIds.includes(target.id)), guidance, policy };
}
export async function recordGeneration(kind: "question" | "media", targetId: string, gatewayKind: "text" | "image", endpoint: string, model: string, promptProvenance: unknown, referenceProvenance: unknown, hash: string, db: Database) { await db.insert(contentGenerationRecords).values({ id: uuidv7(), kind, targetId, gatewayKind, endpoint, model, promptProvenance, referenceProvenance, outputHash: hash }); }
export async function recordAudit(action: string, kind: "question" | "media", targetId: string, actorId: string, db: Database) { await db.insert(contentAuditEvents).values({ id: uuidv7(), actorId, action, kind, targetId }); }
async function audit(action: string, kind: "question" | "media", targetId: string, actorId: string, db: Database) { await recordAudit(action, kind, targetId, actorId, db); }
