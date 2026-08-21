import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ listSubmittedEvidenceFacts: vi.fn(), listSubmittedEvidenceDetails: vi.fn(), appendTeacherEvidenceResolution: vi.fn(), getActiveLearnerById: vi.fn(), recordEvidenceRead: vi.fn(), recordEvidenceResolution: vi.fn() }));
vi.mock("@/features/evidence/infrastructure/repositories", () => ({ submittedEvidenceReader: { listSubmittedEvidenceFacts: dependencies.listSubmittedEvidenceFacts, listSubmittedEvidenceDetails: dependencies.listSubmittedEvidenceDetails }, appendTeacherEvidenceResolution: dependencies.appendTeacherEvidenceResolution }));
vi.mock("@/features/identity/infrastructure/repositories", () => ({ getActiveLearnerById: dependencies.getActiveLearnerById, recordEvidenceRead: dependencies.recordEvidenceRead, recordEvidenceResolution: dependencies.recordEvidenceResolution }));
import { getCentreEvidence, resolveUncertainItemOutcome } from "@/features/evidence/application/get-centre-evidence";

const teacher = { id: "018f0000-0000-7000-8000-000000000001", role: "teacher" as const, email: "teacher@example.test", displayName: "Teacher" };
const academicLead = { ...teacher, role: "academic_lead" as const };
const resolutionInput = { reviewItemId: "018f0000-0000-7000-8000-000000000006", outcome: "correct" as const, reason: "Accepted controlled answer", revision: 0 };
const row = (outcome: "correct" | "incorrect" | "unanswered" | "needs_teacher_review", learnerId = "018f0000-0000-7000-8000-000000000002") => ({ attemptId: "018f0000-0000-7000-8000-000000000005", learnerId, learnerName: "Learner", practiceSetId: "018f0000-0000-7000-8000-000000000003", paper: "listening" as const, part: "2", languageTargetId: "018f0000-0000-7000-8000-000000000004", languageTarget: "numbers", automaticOutcome: outcome, submittedAt: new Date("2026-08-20T12:00:00Z") });

describe("centre evidence application", () => {
  beforeEach(() => { vi.clearAllMocks(); dependencies.getActiveLearnerById.mockResolvedValue({ id: row("correct").learnerId }); dependencies.listSubmittedEvidenceFacts.mockResolvedValue([]); dependencies.listSubmittedEvidenceDetails.mockResolvedValue([]); });
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
    dependencies.getActiveLearnerById.mockResolvedValue(undefined);
    await expect(getCentreEvidence(teacher, { learnerId })).resolves.toEqual({ error: { code: "INPUT_INVALID", message: "Choose a valid evidence view." } });
    expect(dependencies.getActiveLearnerById).toHaveBeenCalledWith(learnerId);
    expect(dependencies.listSubmittedEvidenceFacts).not.toHaveBeenCalled();
    expect(dependencies.recordEvidenceRead).not.toHaveBeenCalled();
  });
  it("applies one filter intersection to the 30-day summary and retained detail", async () => {
    const fact = { ...row("incorrect"), dimensions: { topic: ["Animals"] } };
    const detail = { ...fact, reviewItemId: "018f0000-0000-7000-8000-000000000006", position: 1, response: false, responseLabel: "False", timing: { startedAt: "2026-08-20T11:00:00Z", lastSavedAt: "2026-08-20T12:00:00Z", submittedAt: "2026-08-20T12:00:00Z" }, playback: [], effectiveOutcome: "incorrect" as const };
    dependencies.listSubmittedEvidenceFacts.mockResolvedValue([fact]);
    dependencies.listSubmittedEvidenceDetails.mockResolvedValue([detail]);
    const result = await getCentreEvidence(teacher, { topic: "Animals" });
    expect("data" in result && result.data.details).toEqual([detail]);
    expect(dependencies.listSubmittedEvidenceFacts).toHaveBeenCalledWith();
    expect(dependencies.listSubmittedEvidenceDetails).toHaveBeenCalledWith({ topic: "Animals" });
  });
  it("selects the latest attempt before applying summary filters while retaining matching history", async () => {
    const older = { ...row("correct"), attemptId: "018f0000-0000-7000-8000-000000000001", submittedAt: new Date("2026-08-19T12:00:00Z"), dimensions: { topic: ["Animals"] } };
    const latest = { ...older, attemptId: "018f0000-0000-7000-8000-000000000007", submittedAt: new Date("2026-08-20T12:00:00Z"), dimensions: { topic: ["Food"] } };
    dependencies.listSubmittedEvidenceFacts.mockResolvedValue([older, latest]);
    dependencies.listSubmittedEvidenceDetails.mockResolvedValue([{ ...older, reviewItemId: "018f0000-0000-7000-8000-000000000006", practiceSetItemId: "item", position: 1, response: null, timing: { startedAt: "Not recorded", lastSavedAt: "Not recorded", submittedAt: "2026-08-19T12:00:00Z" }, playback: [], effectiveOutcome: "correct" }]);
    await expect(getCentreEvidence(teacher, { topic: "Animals" })).resolves.toMatchObject({ data: { rows: [], details: [expect.objectContaining({ attemptId: older.attemptId })] } });
  });
  it("keeps the latest submitted attempt inside the 30-day window even when older history exists", async () => {
    const expired = { ...row("correct"), attemptId: "018f0000-0000-7000-8000-000000000001", submittedAt: new Date("2020-08-20T12:00:00Z"), dimensions: { topic: ["Animals"] } };
    const current = { ...expired, attemptId: "018f0000-0000-7000-8000-000000000007", submittedAt: new Date(), automaticOutcome: "incorrect" as const };
    dependencies.listSubmittedEvidenceFacts.mockResolvedValue([expired, current]);
    await expect(getCentreEvidence(teacher, { topic: "Animals" })).resolves.toMatchObject({ data: { rows: [expect.objectContaining({ correctOutcomes: 0, assessableOutcomes: 1 })] } });
  });
  it("rejects invalid parts before reading evidence", async () => {
    await expect(getCentreEvidence(teacher, { part: "6" })).resolves.toEqual({ error: { code: "INPUT_INVALID", message: "Choose a valid evidence view." } });
    expect(dependencies.listSubmittedEvidenceFacts).not.toHaveBeenCalled();
  });
  it("authorises an academic lead resolution through the transaction-owned audit mutation", async () => {
    dependencies.appendTeacherEvidenceResolution.mockResolvedValue({ revision: 1, effectiveOutcome: "correct" });
    await expect(resolveUncertainItemOutcome(academicLead, resolutionInput)).resolves.toEqual({ data: { revision: 1, effectiveOutcome: "correct" } });
    expect(dependencies.appendTeacherEvidenceResolution).toHaveBeenCalledWith({ reviewItemId: resolutionInput.reviewItemId, outcome: resolutionInput.outcome, reason: resolutionInput.reason, expectedRevision: resolutionInput.revision, resolverId: academicLead.id });
    expect(dependencies.recordEvidenceResolution).not.toHaveBeenCalled();
  });
  it("rejects a teacher before attempting an evidence resolution", async () => {
    await expect(resolveUncertainItemOutcome(teacher, resolutionInput)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dependencies.appendTeacherEvidenceResolution).not.toHaveBeenCalled();
  });
  it("preserves the existing resolution on a stale correction", async () => {
    dependencies.appendTeacherEvidenceResolution.mockResolvedValue({ error: "TEACHER_RESOLUTION_CONFLICT" });
    await expect(resolveUncertainItemOutcome(academicLead, resolutionInput)).resolves.toEqual({ error: { code: "TEACHER_RESOLUTION_CONFLICT", message: "This item was updated by someone else. Refresh and try again." } });
    expect(dependencies.recordEvidenceResolution).toHaveBeenCalledWith(academicLead.id, resolutionInput.reviewItemId, "CONFLICT");
  });
  it("rejects malformed resolution input before any mutation", async () => {
    await expect(resolveUncertainItemOutcome(academicLead, { ...resolutionInput, reason: "" })).resolves.toEqual({ error: { code: "INPUT_INVALID", message: "Choose a valid resolution." } });
    expect(dependencies.appendTeacherEvidenceResolution).not.toHaveBeenCalled();
  });
});
