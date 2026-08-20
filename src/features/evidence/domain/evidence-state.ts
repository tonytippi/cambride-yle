import type { SubmittedEvidenceFact } from "@/features/practice/application/evidence-contract";

export type EvidenceState = "secure" | "building" | "needs practice" | "not assessed yet";
export type EvidenceSummary = { state: EvidenceState; assessableOutcomes: number; correctOutcomes: number };

export function actionableText(state: EvidenceState, paper: string, part: string, languageTarget: string) {
  const selection = `${paper === "reading_writing" ? "Reading and Writing" : "Listening"} Part ${part}: ${languageTarget}.`;
  if (state === "secure") return `Secure: continue practising ${selection}`;
  if (state === "building") return `Building: practise ${selection}`;
  if (state === "needs practice") return `Needs practice: practise ${selection}`;
  return `Not assessed yet: complete more practice for ${selection}`;
}

export function evidenceState(facts: Pick<SubmittedEvidenceFact, "automaticOutcome">[]): EvidenceSummary {
  const assessable = facts.filter((fact) => fact.automaticOutcome === "correct" || fact.automaticOutcome === "incorrect" || fact.automaticOutcome === "unanswered");
  const correct = assessable.filter((fact) => fact.automaticOutcome === "correct").length;
  if (assessable.length < 3) return { state: "not assessed yet", assessableOutcomes: assessable.length, correctOutcomes: correct };
  const rate = correct / assessable.length;
  return { state: rate < 0.6 ? "needs practice" : rate < 0.8 ? "building" : "secure", assessableOutcomes: assessable.length, correctOutcomes: correct };
}

export function latestFactsPerSet(facts: SubmittedEvidenceFact[]) {
  const latestByLearnerSet = new Map<string, Pick<SubmittedEvidenceFact, "submittedAt" | "attemptId">>();
  for (const fact of facts) {
    const key = `${fact.learnerId}\0${fact.practiceSetId}`;
    const latest = latestByLearnerSet.get(key);
    if (!latest || fact.submittedAt > latest.submittedAt || (fact.submittedAt.getTime() === latest.submittedAt.getTime() && fact.attemptId > latest.attemptId)) latestByLearnerSet.set(key, fact);
  }
  return facts.filter((fact) => latestByLearnerSet.get(`${fact.learnerId}\0${fact.practiceSetId}`)?.attemptId === fact.attemptId);
}
