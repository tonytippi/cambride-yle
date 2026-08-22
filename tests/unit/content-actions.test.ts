import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  currentActor: vi.fn(), createManualMedia: vi.fn(), createPracticeSetDraft: vi.fn(),
  submitPracticeSetForReview: vi.fn(), approvePracticeSet: vi.fn(), publishPracticeSet: vi.fn(),
  requestAiDraft: vi.fn(), recordPhonePreview: vi.fn(), revalidatePath: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: dependencies.revalidatePath }));
vi.mock("@/features/identity/ui/session", () => ({ currentActor: dependencies.currentActor }));
vi.mock("@/features/curriculum/application/curriculum", () => ({ CurriculumError: class CurriculumError extends Error { code: string; findings = []; constructor(code: string, message: string) { super(message); this.code = code; } }, createAnswerPolicyVersion: vi.fn(), createCurriculumGuidance: vi.fn(), createCurriculumTarget: vi.fn(), updateCurriculumGuidance: vi.fn(), updateCurriculumTarget: vi.fn() }));
vi.mock("@/features/content/application/content", () => ({
  createManualQuestion: vi.fn(), createManualMedia: dependencies.createManualMedia, requestAiDraft: dependencies.requestAiDraft,
  validateContent: vi.fn(), submitForReview: vi.fn(), approveContent: vi.fn(), publishContent: vi.fn(), retireContent: vi.fn(),
  createPracticeSetDraft: dependencies.createPracticeSetDraft, submitPracticeSetForReview: dependencies.submitPracticeSetForReview,
  approvePracticeSet: dependencies.approvePracticeSet, publishPracticeSet: dependencies.publishPracticeSet, retirePracticeSet: vi.fn(),
  rejectContent: vi.fn(), acceptException: vi.fn(), recordPhonePreview: dependencies.recordPhonePreview,
}));
import { approvePracticeSetAction, createMediaDraftAction, createPracticeSetDraftAction, phonePreviewAction, publishPracticeSetAction, requestAiDraftAction, submitPracticeSetForReviewAction } from "@/app/academic-lead/actions";

const form = () => {
  const data = new FormData();
  for (const [key, value] of Object.entries({ paper: "reading_writing", part: "1", engine: "picture_true_false", primaryTargetId: "018f0000-0000-7000-8000-000000000002", topicId: "018f0000-0000-7000-8000-000000000003", guidanceId: "018f0000-0000-7000-8000-000000000004", estimatedDurationSeconds: "60", altText: "A cat", source: "Original", rightsReference: "Centre-owned", mediaType: "image", description: "A cat illustration" })) data.set(key, value);
  return data;
};
describe("content actions", () => {
  beforeEach(() => { vi.clearAllMocks(); dependencies.currentActor.mockResolvedValue({ id: "018f0000-0000-7000-8000-000000000001", role: "admin" }); });
  it("passes media text to the authoritative content use case and revalidates on success", async () => {
    const data = form(); data.set("supportingTargetIds", "018f0000-0000-7000-8000-000000000006"); data.set("description", "  A   cat illustration ");
    await expect(createMediaDraftAction({}, data)).resolves.toEqual({ success: "Media draft saved for academic review." });
    expect(dependencies.createManualMedia).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ supportingTargetIds: ["018f0000-0000-7000-8000-000000000006"], mediaType: "image", description: "  A   cat illustration " }));
  });
  it("passes fixed successful 375px evidence to the phone-preview use case", async () => {
    const data = new FormData(); data.set("kind", "media"); data.set("targetId", "018f0000-0000-7000-8000-000000000009");
    await expect(phonePreviewAction({}, data)).resolves.toEqual({ success: "375px phone preview confirmed." });
    expect(dependencies.recordPhonePreview).toHaveBeenCalledWith(expect.anything(), { kind: "media", targetId: "018f0000-0000-7000-8000-000000000009", viewportWidth: 375, successful: true });
  });
  it("parses draft and lifecycle inputs, uses the actor and revalidates", async () => {
    const id = "018f0000-0000-7000-8000-000000000009";
    const draft = new FormData(); draft.set("title", "Animal practice"); draft.set("questionIds", id); dependencies.createPracticeSetDraft.mockResolvedValue(id);
    await createPracticeSetDraftAction({}, draft);
    expect(dependencies.createPracticeSetDraft).toHaveBeenCalledWith(expect.objectContaining({ role: "admin" }), { title: "Animal practice", questionIds: [id] });
    for (const [action, useCase] of [[submitPracticeSetForReviewAction, dependencies.submitPracticeSetForReview], [approvePracticeSetAction, dependencies.approvePracticeSet], [publishPracticeSetAction, dependencies.publishPracticeSet]] as const) {
      const data = new FormData(); data.set("practiceSetId", id); await action({}, data);
      expect(useCase).toHaveBeenCalledWith(expect.objectContaining({ role: "admin" }), { practiceSetId: id });
    }
    expect(dependencies.revalidatePath).toHaveBeenCalledWith("/academic-lead");
  });
  it("returns stable findings without revalidation", async () => {
    dependencies.requestAiDraft.mockRejectedValue(Object.assign(new Error("Check findings"), { code: "VALIDATION_FAILED", findings: [{ field: "guidanceId", code: "GUIDANCE_NOT_FOUND", message: "Missing" }] }));
    const data = form(); data.set("draftType", "media"); data.set("kind", "image"); data.set("staffPrompt", "Create a friendly cat"); data.set("permittedReferences", "licence-1 | Licensed original");
    await expect(requestAiDraftAction({}, data)).resolves.toEqual({ error: { code: "VALIDATION_FAILED", message: "Check findings", findings: [{ field: "guidanceId", code: "GUIDANCE_NOT_FOUND", message: "Missing" }] } });
    expect(dependencies.revalidatePath).not.toHaveBeenCalled();
  });
});
