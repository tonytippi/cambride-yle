import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  transaction: vi.fn(),
  deactivateAccount: vi.fn()
}));

vi.mock("@/infrastructure/database/client", () => ({ database: { transaction: dependencies.transaction } }));
vi.mock("@/features/identity/infrastructure/repositories", () => ({
  deactivateAccount: dependencies.deactivateAccount
}));
vi.mock("@/features/identity/infrastructure/password", () => ({ hashPassword: vi.fn(), verifyPassword: vi.fn(), verifyDummyPassword: vi.fn() }));

import { deactivateCentreAccount, IdentityError } from "@/features/identity/application/auth";
import { deactivateAccountSchema } from "@/features/identity/domain/contracts";

const admin = { id: "018f0000-0000-7000-8000-000000000001", email: "admin@example.test", displayName: "Admin", role: "admin" as const };
const learner = { id: "018f0000-0000-7000-8000-000000000002", email: "learner@example.test", displayName: "Learner", role: "learner" as const };
describe("centre account deactivation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line no-unused-vars
    dependencies.transaction.mockImplementation(async (callback: (tx: object) => unknown) => callback({ transaction: "boundary" }));
  });

  it("uses one transaction to deactivate a named active account, revoke sessions, and retain records", async () => {
    await deactivateCentreAccount(admin, { accountId: learner.id, confirmation: learner.email });
    expect(dependencies.transaction).toHaveBeenCalledTimes(1);
    expect(dependencies.deactivateAccount).toHaveBeenCalledWith(learner.id, admin.id, learner.email, { transaction: "boundary" });
  });

  it("rejects a non-admin direct call without reading or mutating the target", async () => {
    await expect(deactivateCentreAccount(learner, { accountId: learner.id, confirmation: learner.email })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dependencies.transaction).not.toHaveBeenCalled();
    expect(dependencies.deactivateAccount).not.toHaveBeenCalled();
  });

  it("maps locked-target validation errors without another application mutation", async () => {
    for (const [error, code] of [["CONFIRMATION_MISMATCH", "CONFIRMATION_MISMATCH"], ["ACCOUNT_NOT_ACTIVE", "ACCOUNT_NOT_ACTIVE"], ["LAST_ACTIVE_ADMIN", "LAST_ACTIVE_ADMIN"]] as const) {
      dependencies.deactivateAccount.mockRejectedValueOnce(new Error(error));
      await expect(deactivateCentreAccount(admin, { accountId: learner.id, confirmation: learner.email })).rejects.toMatchObject({ code } satisfies Partial<IdentityError>);
    }
    expect(dependencies.transaction).toHaveBeenCalledTimes(3);
    expect(dependencies.deactivateAccount).toHaveBeenCalledTimes(3);
  });

  it("rejects confirmation whitespace rather than normalising it", () => {
    expect(deactivateAccountSchema.safeParse({ accountId: learner.id, confirmation: ` ${learner.email}` }).success).toBe(false);
    expect(deactivateAccountSchema.safeParse({ accountId: learner.id, confirmation: `${learner.email} ` }).success).toBe(false);
    expect(deactivateAccountSchema.safeParse({ accountId: learner.id, confirmation: learner.email }).success).toBe(true);
  });

});
