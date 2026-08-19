import { asc, desc, eq } from "drizzle-orm";
import { answerPolicies, answerPolicyVersions, curriculumAuditEvents, curriculumGuidance, curriculumTargets, policyConformanceVectors } from "@/../db/schema";
import { database } from "@/infrastructure/database/client";
import { uuidv7 } from "@/features/identity/infrastructure/uuid";
import type { GuidanceInput, PolicyVersionInput, TargetInput } from "../domain/contracts";
type Database = typeof database | Parameters<Parameters<typeof database.transaction>[0]>[0];
export async function listCatalogue(db: Database = database) {
  const policies = await db.select().from(answerPolicies).orderBy(answerPolicies.canonicalId);
  const versions = await db.select().from(answerPolicyVersions).orderBy(asc(answerPolicyVersions.policyId), asc(answerPolicyVersions.version));
  const vectors = await db.select().from(policyConformanceVectors).orderBy(policyConformanceVectors.policyVersionId);
  return { targets: await db.select().from(curriculumTargets).orderBy(curriculumTargets.canonicalId), guidance: await db.select().from(curriculumGuidance).orderBy(curriculumGuidance.paper, curriculumGuidance.part, curriculumGuidance.taskFormat), policies: policies.map((policy) => ({ ...policy, versions: versions.filter((version) => version.policyId === policy.id).map((version) => ({ ...version, vectors: vectors.filter((vector) => vector.policyVersionId === version.id) })) })) };
}
export async function createTarget(input: TargetInput, actorId: string, db: Database) { const id = uuidv7(); await db.insert(curriculumTargets).values({ id, ...input, createdBy: actorId }); await audit("CURRICULUM_TARGET_CREATED", id, actorId, db); return id; }
export async function createGuidance(input: GuidanceInput, actorId: string, db: Database) { const id = uuidv7(); await db.insert(curriculumGuidance).values({ id, ...input }); await audit("CURRICULUM_GUIDANCE_CREATED", id, actorId, db); return id; }
export async function updateTarget(id: string, input: Omit<TargetInput, "canonicalId">, actorId: string, db: Database) { const updated = await db.update(curriculumTargets).set(input).where(eq(curriculumTargets.id, id)).returning({ id: curriculumTargets.id }); if (!updated[0]) return false; await audit("CURRICULUM_TARGET_UPDATED", id, actorId, db); return true; }
export async function updateGuidance(id: string, input: GuidanceInput, actorId: string, db: Database) { const updated = await db.update(curriculumGuidance).set(input).where(eq(curriculumGuidance.id, id)).returning({ id: curriculumGuidance.id }); if (!updated[0]) return false; await audit("CURRICULUM_GUIDANCE_UPDATED", id, actorId, db); return true; }
export async function getPolicy(id: string, db: Database) { return (await db.select().from(answerPolicies).where(eq(answerPolicies.id, id)).limit(1))[0]; }
export async function createPolicyVersion(input: PolicyVersionInput, actorId: string, db: Database) {
  let policy = input.policyId ? await getPolicy(input.policyId, db) : undefined;
  if (!policy) { const id = uuidv7(); await db.insert(answerPolicies).values({ id, canonicalId: input.canonicalId!, targetId: input.targetId, guidanceId: input.guidanceId, paper: input.paper, part: input.part, engine: input.engine }); policy = { id, canonicalId: input.canonicalId!, targetId: input.targetId, guidanceId: input.guidanceId, paper: input.paper, part: input.part, engine: input.engine, currentVersionId: null, createdAt: new Date() }; }
  const existing = await db.select({ version: answerPolicyVersions.version }).from(answerPolicyVersions).where(eq(answerPolicyVersions.policyId, policy.id)).orderBy(desc(answerPolicyVersions.version)).limit(1);
  const id = uuidv7(); const version = (existing[0]?.version ?? 0) + 1;
  await db.insert(answerPolicyVersions).values({ id, policyId: policy.id, version, inputKind: input.inputKind, canonicalAnswer: input.canonicalAnswer, acceptedAnswers: input.acceptedAnswers, normalisation: input.normalisation, maxWords: input.maxWords, teacherReviewIfUncertain: input.teacherReviewIfUncertain, createdBy: actorId });
  await db.insert(policyConformanceVectors).values(input.vectors.map((vector) => ({ id: uuidv7(), policyVersionId: id, response: vector.response, expectedOutcome: vector.expectedOutcome })));
  await db.update(answerPolicies).set({ currentVersionId: id }).where(eq(answerPolicies.id, policy.id)); await audit("ANSWER_POLICY_VERSION_CREATED", policy.id, actorId, db); return { policyId: policy.id, versionId: id, version };
}
export async function targetExists(id: string, db: Database = database) { return Boolean((await db.select({ id: curriculumTargets.id }).from(curriculumTargets).where(eq(curriculumTargets.id, id)).limit(1))[0]); }
export async function getTarget(id: string, db: Database = database) { return (await db.select().from(curriculumTargets).where(eq(curriculumTargets.id, id)).limit(1))[0]; }
export async function getGuidance(id: string, db: Database = database) { return (await db.select().from(curriculumGuidance).where(eq(curriculumGuidance.id, id)).limit(1))[0]; }
export async function policyCanonicalExists(canonicalId: string, db: Database = database) { return Boolean((await db.select({ id: answerPolicies.id }).from(answerPolicies).where(eq(answerPolicies.canonicalId, canonicalId)).limit(1))[0]); }
async function audit(action: string, targetId: string, actorId: string, db: Database) { await db.insert(curriculumAuditEvents).values({ id: uuidv7(), actorId, action, targetId }); }
