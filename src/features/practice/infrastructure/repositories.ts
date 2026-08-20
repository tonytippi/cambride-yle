import { and, desc, eq, gte, sql } from "drizzle-orm";
import {
  curriculumGuidance,
  practiceAttemptEvidence,
  practiceAttempts,
  practiceRecommendationAudits,
  practiceSetItems,
  practiceSets,
} from "@/../db/schema";
import { database } from "@/infrastructure/database/client";
import { uuidv7 } from "@/features/identity/infrastructure/uuid";
import type { SubmittedEvidence } from "../domain/contracts";

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
