import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ requireRole: vi.fn(), getCentreEvidence: vi.fn() }));
vi.mock("@/features/identity/ui/session", () => ({ requireRole: dependencies.requireRole }));
vi.mock("@/features/evidence/application/get-centre-evidence", () => ({ getCentreEvidence: dependencies.getCentreEvidence }));
vi.mock("@/features/evidence/ui/evidence-dashboard", () => ({ EvidenceDashboard: (props: { error?: string }) => createElement("output", undefined, props.error) }));

import TeacherHome from "@/app/teacher/page";

const teacher = { id: "018f0000-0000-7000-8000-000000000001", role: "teacher" as const, email: "teacher@example.test", displayName: "Teacher" };

describe("teacher evidence page", () => {
  beforeEach(() => { vi.clearAllMocks(); dependencies.requireRole.mockResolvedValue(teacher); });

  it("renders the stable invalid response for a valid but nonexistent learner UUID", async () => {
    const learnerId = "018f0000-0000-7000-8000-000000000099";
    dependencies.getCentreEvidence.mockResolvedValue({ error: { code: "INPUT_INVALID", message: "Choose a valid evidence view." } });
    const page = await TeacherHome({ searchParams: Promise.resolve({ learner: learnerId }) });
    expect(page.props.children.props.error).toBe("Choose a valid evidence view.");
    expect(dependencies.getCentreEvidence).toHaveBeenCalledWith(teacher, { learnerId });
  });
});
