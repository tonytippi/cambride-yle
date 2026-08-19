import { beforeEach, describe, expect, it, vi } from "vitest";
const dependencies = vi.hoisted(() => ({ currentActor: vi.fn(), createCurriculumTarget: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: dependencies.revalidatePath }));
vi.mock("@/features/identity/ui/session", () => ({ currentActor: dependencies.currentActor }));
vi.mock("@/features/curriculum/application/curriculum", () => ({ createCurriculumTarget: dependencies.createCurriculumTarget, createAnswerPolicyVersion: vi.fn(), createCurriculumGuidance: vi.fn(), CurriculumError: class CurriculumError extends Error { code: string; findings = []; constructor(code: string, message: string) { super(message); this.code = code; } } }));
import { createTargetAction } from "@/app/academic-lead/actions";
describe("curriculum actions", () => {
  beforeEach(() => { vi.clearAllMocks(); dependencies.currentActor.mockResolvedValue({ id: "018f0000-0000-7000-8000-000000000001", role: "admin" }); });
  it("returns the stable forbidden response when no actor is present", async () => { dependencies.currentActor.mockResolvedValue(undefined); await expect(createTargetAction({}, new FormData())).resolves.toEqual({ error: { code: "FORBIDDEN", message: "You do not have access to that page." } }); });
  it("revalidates the staff workspace after a saved target", async () => { const form = new FormData(); form.set("canonicalId", "animals"); form.set("category", "topic"); form.set("guidance", "Animals"); await expect(createTargetAction({}, form)).resolves.toEqual({ success: "Curriculum target saved." }); expect(dependencies.revalidatePath).toHaveBeenCalledWith("/academic-lead"); });
});
