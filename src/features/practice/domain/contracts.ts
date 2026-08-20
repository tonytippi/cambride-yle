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
  submittedAttemptId?: string | null;
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
export const learnerEngines = ["picture_true_false", "picture_yes_no", "audio_picture_choice", "audio_note_taking", "word_bank_cloze"] as const;
export type LearnerEngine = (typeof learnerEngines)[number];
export type PracticePlayerItem = { id: string; position: number; engine: LearnerEngine; prompt: string; options: string[]; response?: string | boolean | number; media: { id: string; mediaKey: string; type: "audio" | "image"; altText?: string; choiceLabel?: string }[] };
export type PracticePlayer = OpenPracticeAttempt & { title: string; items: PracticePlayerItem[] };
export type PracticeRecoveryState = "online" | "offline" | "saved" | "unsaved" | "stale";
export const practiceAttemptSchema = z.object({ setId: practiceSetIdSchema, attemptId: z.string().uuid() }).strict();
export const responseSchema = practiceAttemptSchema.extend({ itemId: z.string().uuid(), value: z.union([z.string().trim().max(120), z.boolean(), z.number().int().min(0).max(20), z.null()]), expectedRevision: z.number().int().min(0) }).strict();
export const playbackSchema = practiceAttemptSchema.extend({ itemId: z.string().uuid(), mediaId: z.string().uuid(), expectedRevision: z.number().int().min(0) }).strict();
export const submitAttemptSchema = practiceAttemptSchema.extend({ expectedRevision: z.number().int().min(0), idempotencyKey: z.string().uuid() }).strict();
export const attemptMediaSchema = practiceAttemptSchema.extend({ mediaId: z.string().uuid(), setVersionId: z.string().uuid(), mediaKey: z.string().min(1).max(300) }).strict();
export type SubmittedPracticeResult = { attemptId: string; setId: string; submittedAt: Date; revision: number };
export type SubmittedPracticeReview = SubmittedPracticeResult & { title: string; items: { id: string; position: number; response: string | boolean | number | null; responseLabel?: string; outcome: "correct" | "incorrect" | "unanswered" | "needs_teacher_review"; approvedAnswer: string | boolean | number; approvedAnswerLabel: string; explanation?: string; evidenceLabel: EvidenceLabel }[] };
export type PracticeErrorCode = "FORBIDDEN" | "INPUT_INVALID" | "SET_NOT_FOUND" | "SET_RETIRED" | "OPEN_ATTEMPT_EXISTS" | "ESSENTIAL_MEDIA_MISSING" | "MEDIA_UNAVAILABLE" | "MEDIA_AUTHORISATION_FAILED" | "ATTEMPT_SCOPE_MISMATCH" | "ATTEMPT_REVISION_CONFLICT" | "ATTEMPT_FINALISED" | "ITEM_INVALID";
export type PracticeResult<T> = { data: T } | { error: { code: PracticeErrorCode; message: string } };
