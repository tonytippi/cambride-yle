export type SubmittedEvidenceFact = {
  attemptId: string;
  learnerId: string;
  learnerName: string;
  practiceSetId: string;
  paper: "listening" | "reading_writing";
  part: string;
  languageTargetId: string;
  languageTarget: string;
  automaticOutcome: "correct" | "incorrect" | "unanswered" | "needs_teacher_review";
  submittedAt: Date;
  dimensions: Record<string, string[]>;
};

export type SubmittedEvidenceFilter = Partial<Record<"learnerId" | "paper" | "part" | "vocabulary" | "grammar" | "spelling" | "names" | "numbers" | "colours" | "positions" | "topic" | "practiceSetId", string>>;
export type SubmittedEvidenceDetail = SubmittedEvidenceFact & { reviewItemId: string; practiceSetItemId: string; position: number; responseLabel?: string; response: string | boolean | number | null; timing: { startedAt: string; lastSavedAt: string; submittedAt: string }; playback: { itemId: string; mediaId: string; playedAt: string }[]; effectiveOutcome: SubmittedEvidenceFact["automaticOutcome"] };

export type SubmittedEvidenceReader = {
  listSubmittedEvidenceFacts: () => Promise<SubmittedEvidenceFact[]>;
  // eslint-disable-next-line no-unused-vars
  listSubmittedEvidenceDetails: (...args: [SubmittedEvidenceFilter?]) => Promise<SubmittedEvidenceDetail[]>;
};
