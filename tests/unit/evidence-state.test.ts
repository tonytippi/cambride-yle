import { describe, expect, it } from "vitest";
import { actionableText, evidenceState, latestFactsPerSet } from "@/features/evidence/domain/evidence-state";

const fact = (outcome: "correct" | "incorrect" | "unanswered" | "needs_teacher_review") => ({ automaticOutcome: outcome });

describe("evidence state", () => {
  it("uses the specified assessable thresholds and excludes unresolved outcomes", () => {
    expect(evidenceState([fact("correct"), fact("correct")]).state).toBe("not assessed yet");
    expect(evidenceState([fact("needs_teacher_review"), fact("needs_teacher_review")]).state).toBe("not assessed yet");
    expect(evidenceState([fact("correct"), fact("incorrect"), fact("incorrect")]).state).toBe("needs practice");
    expect(evidenceState([fact("correct"), fact("correct"), fact("correct"), fact("incorrect"), fact("incorrect")]).state).toBe("building");
    expect(evidenceState([fact("correct"), fact("correct"), fact("correct"), fact("correct"), fact("incorrect")]).state).toBe("secure");
  });

  it("keeps only facts from the latest submitted attempt for every learner and set", () => {
    const latest = new Date("2026-08-20T12:00:00Z");
    const facts = latestFactsPerSet([
      { attemptId: "attempt-older", learnerId: "learner", practiceSetId: "set", submittedAt: new Date("2026-08-19T12:00:00Z") },
      { attemptId: "attempt-latest", learnerId: "learner", practiceSetId: "set", submittedAt: latest },
      { attemptId: "attempt-other", learnerId: "other", practiceSetId: "set", submittedAt: new Date("2026-08-19T12:00:00Z") },
    ] as never);
    expect(facts).toHaveLength(2);
    expect(facts.map((entry) => entry.submittedAt)).toContainEqual(latest);
  });
  it("breaks matching submission timestamps by attempt ID", () => {
    const latest = latestFactsPerSet([
      { attemptId: "attempt-a", learnerId: "learner", practiceSetId: "set", submittedAt: new Date("2026-08-20T12:00:00Z") },
      { attemptId: "attempt-b", learnerId: "learner", practiceSetId: "set", submittedAt: new Date("2026-08-20T12:00:00Z") },
    ] as never);
    expect(latest).toEqual([expect.objectContaining({ attemptId: "attempt-b" })]);
  });
  it("provides deterministic actionable text for every evidence state", () => {
    expect(["secure", "building", "needs practice", "not assessed yet"].map((state) => actionableText(state as never, "listening", "2", "numbers"))).toEqual([
      "Secure: continue practising Listening Part 2: numbers.",
      "Building: practise Listening Part 2: numbers.",
      "Needs practice: practise Listening Part 2: numbers.",
      "Not assessed yet: complete more practice for Listening Part 2: numbers.",
    ]);
  });
});
