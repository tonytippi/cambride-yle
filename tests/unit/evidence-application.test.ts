import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ listSubmittedEvidenceFacts: vi.fn(), getAccountById: vi.fn(), recordEvidenceRead: vi.fn() }));
vi.mock("@/features/evidence/infrastructure/repositories", () => ({ submittedEvidenceReader: { listSubmittedEvidenceFacts: dependencies.listSubmittedEvidenceFacts } }));
vi.mock("@/features/identity/infrastructure/repositories", () => ({ getAccountById: dependencies.getAccountById, recordEvidenceRead: dependencies.recordEvidenceRead }));
import { getCentreEvidence } from "@/features/evidence/application/get-centre-evidence";

const teacher = { id: "018f0000-0000-7000-8000-000000000001", role: "teacher" as const, email: "teacher@example.test", displayName: "Teacher" };
const row = (outcome: "correct" | "incorrect" | "unanswered" | "needs_teacher_review", learnerId = "018f0000-0000-7000-8000-000000000002") => ({ attemptId: "018f0000-0000-7000-8000-000000000005", learnerId, learnerName: "Learner", practiceSetId: "018f0000-0000-7000-8000-000000000003", paper: "listening" as const, part: "2", languageTargetId: "018f0000-0000-7000-8000-000000000004", languageTarget: "numbers", automaticOutcome: outcome, submittedAt: new Date("2026-08-20T12:00:00Z") });

describe("centre evidence application", () => {
  beforeEach(() => { vi.clearAllMocks(); dependencies.getAccountById.mockResolvedValue({ id: row("correct").learnerId }); dependencies.listSubmittedEvidenceFacts.mockResolvedValue([]); });
  it("authorises before reading evidence", async () => {
    await expect(getCentreEvidence({ ...teacher, role: "learner" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dependencies.listSubmittedEvidenceFacts).not.toHaveBeenCalled();
  });
  it("returns a neutral empty result and safely audits the read", async () => {
    await expect(getCentreEvidence(teacher)).resolves.toMatchObject({ data: { rows: [] } });
    expect(dependencies.recordEvidenceRead).toHaveBeenCalledWith(teacher.id, undefined, "NO_DATA");
  });
  it("uses snapshot facts and audits the requested learner detail", async () => {
    dependencies.listSubmittedEvidenceFacts.mockResolvedValue([row("correct"), row("correct"), row("incorrect")]);
    const learnerId = row("correct").learnerId;
    await expect(getCentreEvidence(teacher, { learnerId })).resolves.toMatchObject({ data: { rows: [expect.objectContaining({ state: "building", languageTarget: "numbers" })] } });
    expect(dependencies.recordEvidenceRead).toHaveBeenCalledWith(teacher.id, learnerId, "SUCCESS");
  });
  it("returns stable invalid learner input without reading or auditing", async () => {
    await expect(getCentreEvidence(teacher, { learnerId: "invalid" })).resolves.toEqual({ error: { code: "INPUT_INVALID", message: "Choose a valid evidence view." } });
    expect(dependencies.listSubmittedEvidenceFacts).not.toHaveBeenCalled();
    expect(dependencies.recordEvidenceRead).not.toHaveBeenCalled();
  });
  it("rejects a valid but nonexistent learner before reading facts or auditing", async () => {
    const learnerId = "018f0000-0000-7000-8000-000000000099";
    dependencies.getAccountById.mockResolvedValue(undefined);
    await expect(getCentreEvidence(teacher, { learnerId })).resolves.toEqual({ error: { code: "INPUT_INVALID", message: "Choose a valid evidence view." } });
    expect(dependencies.getAccountById).toHaveBeenCalledWith(learnerId);
    expect(dependencies.listSubmittedEvidenceFacts).not.toHaveBeenCalled();
    expect(dependencies.recordEvidenceRead).not.toHaveBeenCalled();
  });
});
