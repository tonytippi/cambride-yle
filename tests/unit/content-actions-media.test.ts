import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ currentActor: vi.fn(), requestAiDraft: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: dependencies.revalidatePath }));
vi.mock("@/features/identity/ui/session", () => ({ currentActor: dependencies.currentActor }));
vi.mock("@/features/curriculum/application/curriculum", () => ({ CurriculumError: class CurriculumError extends Error { code = "FORBIDDEN"; }, createAnswerPolicyVersion: vi.fn(), createCurriculumGuidance: vi.fn(), createCurriculumTarget: vi.fn(), updateCurriculumGuidance: vi.fn(), updateCurriculumTarget: vi.fn() }));
vi.mock("@/features/content/application/content", () => ({ createManualQuestion: vi.fn(), createManualMedia: vi.fn(), requestAiDraft: dependencies.requestAiDraft, validateContent: vi.fn(), submitForReview: vi.fn(), approveContent: vi.fn(), publishContent: vi.fn(), retireContent: vi.fn(), createPracticeSetDraft: vi.fn(), submitPracticeSetForReview: vi.fn(), approvePracticeSet: vi.fn(), publishPracticeSet: vi.fn(), retirePracticeSet: vi.fn(), rejectContent: vi.fn(), acceptException: vi.fn(), recordPhonePreview: vi.fn() }));
import { requestAiDraftAction } from "@/app/academic-lead/actions";

describe("AI question draft action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.currentActor.mockResolvedValue({ id: "018f0000-0000-7000-8000-000000000001", role: "admin" });
  });
  it("passes all selected question media IDs to the authoritative use case", async () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ draftType: "question", kind: "text", staffPrompt: "Create a cat question", paper: "reading_writing", part: "1", engine: "picture_true_false", primaryTargetId: "018f0000-0000-7000-8000-000000000002", topicId: "018f0000-0000-7000-8000-000000000003", guidanceId: "018f0000-0000-7000-8000-000000000004", estimatedDurationSeconds: "60", altText: "A cat", source: "Original", rightsReference: "Centre-owned", answerPolicyVersionId: "018f0000-0000-7000-8000-000000000005", prompt: "Cat", options: "true\nfalse" })) form.set(key, value);
    form.append("mediaIds", "018f0000-0000-7000-8000-000000000006");
    form.append("mediaIds", "018f0000-0000-7000-8000-000000000007");
    await requestAiDraftAction({}, form);
    expect(dependencies.requestAiDraft).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ draft: expect.objectContaining({ mediaIds: ["018f0000-0000-7000-8000-000000000006", "018f0000-0000-7000-8000-000000000007"] }) }), undefined);
  });
});
