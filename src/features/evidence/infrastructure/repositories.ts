import { submittedEvidenceFacts, accounts } from "@/../db/schema";
import { gte, eq } from "drizzle-orm";
import { database } from "@/infrastructure/database/client";
import type { SubmittedEvidenceReader } from "@/features/practice/application/evidence-contract";

export const submittedEvidenceReader: SubmittedEvidenceReader = {
  async listSubmittedEvidenceFacts(since) {
    return database.select({ attemptId: submittedEvidenceFacts.attemptId, learnerId: submittedEvidenceFacts.learnerId, learnerName: accounts.displayName, practiceSetId: submittedEvidenceFacts.practiceSetId, paper: submittedEvidenceFacts.paper, part: submittedEvidenceFacts.part, languageTargetId: submittedEvidenceFacts.languageTargetId, languageTarget: submittedEvidenceFacts.languageTarget, automaticOutcome: submittedEvidenceFacts.automaticOutcome, submittedAt: submittedEvidenceFacts.submittedAt })
      .from(submittedEvidenceFacts).innerJoin(accounts, eq(accounts.id, submittedEvidenceFacts.learnerId)).where(gte(submittedEvidenceFacts.submittedAt, since)) as ReturnType<SubmittedEvidenceReader["listSubmittedEvidenceFacts"]>;
  },
};
