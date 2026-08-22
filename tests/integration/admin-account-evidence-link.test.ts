import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ requireRole: vi.fn(), getCentreAccountDetail: vi.fn() }));
vi.mock("@/features/identity/ui/session", () => ({ requireRole: dependencies.requireRole }));
vi.mock("@/features/identity/application/auth", () => ({ getCentreAccountDetail: dependencies.getCentreAccountDetail }));
vi.mock("@/features/identity/ui/deactivate-account-form", () => ({ DeactivateAccountForm: () => null }));
vi.mock("@/features/identity/ui/change-account-role-form", () => ({ ChangeAccountRoleForm: () => null }));

import AccountDetailPage from "@/app/admin/accounts/[accountId]/page";

const accountId = "018f0000-0000-7000-8000-000000000002";
const actor = { id: "018f0000-0000-7000-8000-000000000001", email: "admin@example.test", displayName: "Admin", role: "admin" as const };
const account = (role: "learner" | "teacher" | "academic_lead" | "admin", status: "active" | "deactivated" = "active") => ({ id: accountId, email: `${role}@example.test`, displayName: role === "learner" ? "Learner" : "Staff", role, status, createdAt: new Date("2026-08-22T00:00:00.000Z"), deactivatedAt: status === "deactivated" ? new Date("2026-08-23T00:00:00.000Z") : null, deactivatedBy: null });

describe("admin account evidence navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requireRole.mockResolvedValue(actor);
  });

  it("renders the existing filtered evidence link only for learner accounts", async () => {
    dependencies.getCentreAccountDetail.mockResolvedValue({ account: account("learner"), history: [] });

    const markup = renderToStaticMarkup(await AccountDetailPage({ params: Promise.resolve({ accountId }) }));

    expect(markup).toContain(`href="/teacher?learner=${accountId}"`);
    expect(markup).toContain("Review practice evidence");
    expect(dependencies.requireRole).toHaveBeenCalledWith(["admin"]);
    expect(dependencies.getCentreAccountDetail).toHaveBeenCalledWith(actor, accountId);
  });

  it("does not offer an evidence request from a deactivated learner account record", async () => {
    dependencies.getCentreAccountDetail.mockResolvedValue({ account: account("learner", "deactivated"), history: [] });

    const markup = renderToStaticMarkup(await AccountDetailPage({ params: Promise.resolve({ accountId }) }));

    expect(markup).not.toContain("Review practice evidence");
    expect(markup).not.toContain("/teacher?learner=");
  });

  it("does not offer an evidence request from non-learner account records", async () => {
    for (const role of ["teacher", "academic_lead", "admin"] as const) {
      dependencies.getCentreAccountDetail.mockResolvedValue({ account: account(role), history: [] });

      const markup = renderToStaticMarkup(await AccountDetailPage({ params: Promise.resolve({ accountId }) }));

      expect(markup).not.toContain("Review practice evidence");
      expect(markup).not.toContain("/teacher?learner=");
    }
  });
});
