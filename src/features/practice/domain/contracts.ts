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
