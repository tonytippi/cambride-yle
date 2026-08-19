import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ currentActor: vi.fn(), deactivateCentreAccount: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: dependencies.revalidatePath }));
vi.mock("@/features/identity/ui/session", () => ({ currentActor: dependencies.currentActor }));
vi.mock("@/features/identity/application/auth", () => ({ deactivateCentreAccount: dependencies.deactivateCentreAccount, IdentityError: class IdentityError extends Error { code = "LAST_ACTIVE_ADMIN"; } }));

import { deactivateAccountAction } from "@/app/admin/actions";

const accountId = "018f0000-0000-7000-8000-000000000002";
const actor = { id: "018f0000-0000-7000-8000-000000000001", email: "admin@example.test", displayName: "Admin", role: "admin" as const };
const form = (confirmation = "learner@example.test") => { const data = new FormData(); data.set("accountId", accountId); data.set("confirmation", confirmation); return data; };

describe("deactivate account action", () => {
  beforeEach(() => { vi.clearAllMocks(); dependencies.currentActor.mockResolvedValue(actor); });
  it("revalidates the account list and target detail after a successful deactivation", async () => {
    await expect(deactivateAccountAction({}, form())).resolves.toEqual({ success: "Account deactivated. Sign-in has stopped and records are retained." });
    expect(dependencies.deactivateCentreAccount).toHaveBeenCalledWith(actor, { accountId, confirmation: "learner@example.test" });
    expect(dependencies.revalidatePath).toHaveBeenNthCalledWith(1, "/admin");
    expect(dependencies.revalidatePath).toHaveBeenNthCalledWith(2, `/admin/accounts/${accountId}`);
  });
  it("rejects whitespace confirmation before it reaches the use case", async () => {
    await expect(deactivateAccountAction({}, form(" learner@example.test"))).resolves.toEqual({ error: "Enter the account email exactly to confirm deactivation." });
    expect(dependencies.deactivateCentreAccount).not.toHaveBeenCalled();
  });
});
