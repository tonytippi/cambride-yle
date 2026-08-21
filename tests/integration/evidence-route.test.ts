import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ currentActor: vi.fn(), getCentreEvidence: vi.fn(), resolveUncertainItemOutcome: vi.fn(), logEvent: vi.fn() }));
vi.mock("@/features/identity/ui/session", () => ({ currentActor: dependencies.currentActor }));
vi.mock("@/features/evidence/application/get-centre-evidence", () => ({ getCentreEvidence: dependencies.getCentreEvidence, resolveUncertainItemOutcome: dependencies.resolveUncertainItemOutcome }));
vi.mock("@/shared/logging/logger", () => ({ logEvent: dependencies.logEvent }));

import { GET, POST } from "@/app/api/evidence/route";

const teacher = { id: "018f0000-0000-7000-8000-000000000001", role: "teacher" as const, email: "teacher@example.test", displayName: "Teacher" };

describe("evidence route", () => {
  beforeEach(() => { vi.clearAllMocks(); dependencies.currentActor.mockResolvedValue(teacher); });
  it("returns stable invalid learner input without querying a learner", async () => {
    dependencies.getCentreEvidence.mockResolvedValue({ error: { code: "INPUT_INVALID", message: "Choose a valid evidence view." } });
    const response = await GET(new Request("http://localhost/api/evidence?learner=invalid"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: { code: "INPUT_INVALID", message: "Choose a valid evidence view." } });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(dependencies.getCentreEvidence).toHaveBeenCalledWith(teacher, { learnerId: "invalid" });
  });
  it("returns stable invalid output for a valid but nonexistent learner UUID", async () => {
    const learnerId = "018f0000-0000-7000-8000-000000000099";
    dependencies.getCentreEvidence.mockResolvedValue({ error: { code: "INPUT_INVALID", message: "Choose a valid evidence view." } });
    const response = await GET(new Request(`http://localhost/api/evidence?learner=${learnerId}`));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: { code: "INPUT_INVALID", message: "Choose a valid evidence view." } });
    expect(dependencies.getCentreEvidence).toHaveBeenCalledWith(teacher, { learnerId });
  });
  it("distinguishes an unavailable dependency from forbidden access", async () => {
    dependencies.getCentreEvidence.mockRejectedValue(new Error("database unavailable"));
    const response = await GET(new Request("http://localhost/api/evidence"));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: { code: "EVIDENCE_UNAVAILABLE", message: "Evidence is temporarily unavailable." } });
  });
  it("returns a no-store successful resolution envelope", async () => {
    const actor = { ...teacher, role: "academic_lead" as const };
    const input = { reviewItemId: "018f0000-0000-7000-8000-000000000006", outcome: "correct", reason: "Accepted controlled answer", revision: 0 };
    dependencies.currentActor.mockResolvedValue(actor);
    dependencies.resolveUncertainItemOutcome.mockResolvedValue({ data: { revision: 1, effectiveOutcome: "correct" } });
    const response = await POST(new Request("http://localhost/api/evidence", { method: "POST", body: JSON.stringify(input) }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toMatchObject({ data: { revision: 1, effectiveOutcome: "correct" } });
    expect(dependencies.resolveUncertainItemOutcome).toHaveBeenCalledWith(actor, input);
  });
  it("returns a stable conflict without retrying the mutation", async () => {
    dependencies.resolveUncertainItemOutcome.mockResolvedValue({ error: { code: "TEACHER_RESOLUTION_CONFLICT", message: "This item was updated by someone else. Refresh and try again." } });
    const response = await POST(new Request("http://localhost/api/evidence", { method: "POST", body: JSON.stringify({}) }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "TEACHER_RESOLUTION_CONFLICT" } });
  });
  it("rejects malformed resolution JSON with a no-store input failure", async () => {
    const response = await POST(new Request("http://localhost/api/evidence", { method: "POST", body: "{" }));
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(dependencies.resolveUncertainItemOutcome).not.toHaveBeenCalled();
  });
});
