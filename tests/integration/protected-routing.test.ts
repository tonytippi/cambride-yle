import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ getActorBySessionToken: vi.fn(), redirect: vi.fn((location: string) => { throw new Error(`REDIRECT:${location}`); }), cookie: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: dependencies.cookie }) }));
vi.mock("next/navigation", () => ({ redirect: dependencies.redirect }));
vi.mock("@/features/identity/infrastructure/repositories", () => ({ getActorBySessionToken: dependencies.getActorBySessionToken }));

import { requireRole } from "@/features/identity/ui/session";

describe("protected routing", () => {
  beforeEach(() => { vi.clearAllMocks(); dependencies.cookie.mockReturnValue(undefined); });
  it("redirects an anonymous protected request to sign-in without reading protected data", async () => {
    dependencies.getActorBySessionToken.mockResolvedValue(undefined);
    await expect(requireRole(["admin"])).rejects.toThrow("REDIRECT:/sign-in");
    expect(dependencies.getActorBySessionToken).toHaveBeenCalledWith("");
  });
  it("clears an invalid session through the expiry route before returning to sign-in", async () => {
    dependencies.cookie.mockReturnValue({ value: "expired-session" }); dependencies.getActorBySessionToken.mockResolvedValue(undefined);
    await expect(requireRole(["admin"])).rejects.toThrow(/^REDIRECT:\/api\/auth\/session-expired\?token=/);
    expect(dependencies.getActorBySessionToken).toHaveBeenCalledWith("expired-session");
  });
  it("redirects a wrong-role actor to its role home with the exact denial notice", async () => {
    dependencies.cookie.mockReturnValue({ value: "opaque-session" }); dependencies.getActorBySessionToken.mockResolvedValue({ id: "opaque-actor", role: "teacher", email: "teacher@example.test", displayName: "Teacher" });
    await expect(requireRole(["admin"])).rejects.toThrow(`REDIRECT:/teacher?notice=${encodeURIComponent("You do not have access to that page.")}`);
  });
  it("allows every active staff role to enter the teacher evidence route", async () => {
    dependencies.cookie.mockReturnValue({ value: "staff-session" });
    for (const role of ["teacher", "academic_lead", "admin"] as const) {
      dependencies.getActorBySessionToken.mockResolvedValue({ id: "opaque-staff", role, email: "staff@example.test", displayName: "Staff" });
      await expect(requireRole(["teacher", "academic_lead", "admin"])).resolves.toMatchObject({ role });
    }
  });
});
