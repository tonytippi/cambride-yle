import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ transaction: vi.fn(), changeAccountRole: vi.fn() }));
vi.mock("@/infrastructure/database/client", () => ({ database: { transaction: dependencies.transaction } }));
vi.mock("@/features/identity/infrastructure/repositories", () => ({ changeAccountRole: dependencies.changeAccountRole }));
vi.mock("@/features/identity/infrastructure/password", () => ({ hashPassword: vi.fn(), verifyPassword: vi.fn(), verifyDummyPassword: vi.fn() }));

import { changeCentreAccountRole } from "@/features/identity/application/auth";
import { changeAccountRoleSchema } from "@/features/identity/domain/contracts";

const admin = { id: "018f0000-0000-7000-8000-000000000001", email: "admin@example.test", displayName: "Admin", role: "admin" as const };
const learner = { id: "018f0000-0000-7000-8000-000000000002", email: "learner@example.test", displayName: "Learner", role: "learner" as const };

describe("centre account role changes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line no-unused-vars
    dependencies.transaction.mockImplementation(async (callback: (tx: object) => unknown) => callback({ transaction: "boundary" }));
  });

  it("uses one transaction to change a permitted account role", async () => {
    await changeCentreAccountRole(admin, { accountId: learner.id, role: "teacher" });
    expect(dependencies.transaction).toHaveBeenCalledTimes(1);
    expect(dependencies.changeAccountRole).toHaveBeenCalledWith(learner.id, "teacher", admin.id, { transaction: "boundary" });
  });

  it("rejects a non-admin direct call before opening a transaction", async () => {
    await expect(changeCentreAccountRole(learner, { accountId: learner.id, role: "teacher" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dependencies.transaction).not.toHaveBeenCalled();
    expect(dependencies.changeAccountRole).not.toHaveBeenCalled();
  });

  it("maps the final-active-admin and missing-target errors", async () => {
    for (const [error, code] of [["LAST_ACTIVE_ADMIN", "LAST_ACTIVE_ADMIN"], ["ACCOUNT_NOT_FOUND", "ACCOUNT_NOT_FOUND"], ["ACCOUNT_NOT_ACTIVE", "ACCOUNT_NOT_ACTIVE"]] as const) {
      dependencies.changeAccountRole.mockRejectedValueOnce(new Error(error));
      await expect(changeCentreAccountRole(admin, { accountId: learner.id, role: "teacher" })).rejects.toMatchObject({ code });
    }
  });

  it("accepts only UUID account IDs and canonical roles", () => {
    expect(changeAccountRoleSchema.safeParse({ accountId: learner.id, role: "academic_lead" }).success).toBe(true);
    expect(changeAccountRoleSchema.safeParse({ accountId: "not-a-uuid", role: "teacher" }).success).toBe(false);
    expect(changeAccountRoleSchema.safeParse({ accountId: learner.id, role: "owner" }).success).toBe(false);
  });
});
