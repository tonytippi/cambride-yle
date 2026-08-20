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
};

export type SubmittedEvidenceReader = {
  // eslint-disable-next-line no-unused-vars
  listSubmittedEvidenceFacts: (...args: [Date]) => Promise<SubmittedEvidenceFact[]>;
};
