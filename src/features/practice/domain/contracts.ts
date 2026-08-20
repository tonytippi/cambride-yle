import { z } from "zod";

export const evidenceLabels = ["secure", "building", "needs_practice", "not_assessed_yet"] as const;
export type EvidenceLabel = (typeof evidenceLabels)[number];
export type LearnerPracticeAction = "Start" | "Resume" | "Review";
export type LearnerPracticeSet = {
  id: string;
  title: string;
  paper: "listening" | "reading_writing";
  part: string;
  estimatedDurationSeconds: number;
  topic: string;
  taskType: string;
  targetIds: string[];
  action: LearnerPracticeAction;
  lastSavedAt?: Date;
};
export type SubmittedEvidence = {
  practiceSetId: string;
  attemptId: string;
  submittedAt: Date;
  practiceAreaId: string;
  label: EvidenceLabel;
};
export type LearnerHome = {
  allSets: LearnerPracticeSet[];
  sets: LearnerPracticeSet[];
  filters: { topic?: string; taskType?: string; topics: string[]; taskTypes: string[] };
  recommendation: { version: string; setIds: string[]; practiceArea: string } | undefined;
};
export const learnerHomeFilterSchema = z.object({ topic: z.string().trim().max(120).optional(), taskType: z.string().trim().max(120).optional() }).strict();

export const practiceSetIdSchema = z.string().uuid();
export const preparePracticeSchema = z.object({ setId: practiceSetIdSchema }).strict();
export const startPracticeSchema = z.object({ setId: practiceSetIdSchema }).strict();
export type PreparationAsset = { id: string; type: "audio" | "image"; url: string; cacheKey: string };
export type PracticePreparation = { setId: string; setVersionId: string; title: string; assets: PreparationAsset[] };
export type PracticeStart = { attemptId: string; setId: string; setVersionId: string; revision: number; disposition: "started" | "resume" };
export type OpenPracticeAttempt = { attemptId: string; setId: string; setVersionId: string; revision: number };
export type PracticeErrorCode = "FORBIDDEN" | "INPUT_INVALID" | "SET_NOT_FOUND" | "SET_RETIRED" | "OPEN_ATTEMPT_EXISTS" | "ESSENTIAL_MEDIA_MISSING" | "MEDIA_UNAVAILABLE" | "MEDIA_AUTHORISATION_FAILED";
export type PracticeResult<T> = { data: T } | { error: { code: PracticeErrorCode; message: string } };
