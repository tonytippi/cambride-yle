import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ currentActor: vi.fn(), changeCentreAccountRole: vi.fn(), revalidatePath: vi.fn(), IdentityError: class IdentityError extends Error { code = "LAST_ACTIVE_ADMIN"; } }));
vi.mock("next/cache", () => ({ revalidatePath: dependencies.revalidatePath }));
vi.mock("@/features/identity/ui/session", () => ({ currentActor: dependencies.currentActor }));
vi.mock("@/features/identity/application/auth", () => ({ changeCentreAccountRole: dependencies.changeCentreAccountRole, IdentityError: dependencies.IdentityError }));

import { changeAccountRoleAction } from "@/app/admin/actions";

const accountId = "018f0000-0000-7000-8000-000000000002";
const actor = { id: "018f0000-0000-7000-8000-000000000001", email: "admin@example.test", displayName: "Admin", role: "admin" as const };
const form = (role = "teacher") => { const data = new FormData(); data.set("accountId", accountId); data.set("role", role); return data; };

describe("change account role action", () => {
  beforeEach(() => { vi.clearAllMocks(); dependencies.currentActor.mockResolvedValue(actor); });

  it("revalidates the account list and target detail after a successful role change", async () => {
    await expect(changeAccountRoleAction({}, form())).resolves.toEqual({ success: "Account role updated." });
    expect(dependencies.changeCentreAccountRole).toHaveBeenCalledWith(actor, { accountId, role: "teacher" });
    expect(dependencies.revalidatePath).toHaveBeenNthCalledWith(1, "/admin");
    expect(dependencies.revalidatePath).toHaveBeenNthCalledWith(2, `/admin/accounts/${accountId}`);
  });

  it("rejects malformed browser input before it reaches the use case", async () => {
    await expect(changeAccountRoleAction({}, form("owner"))).resolves.toEqual({ error: "Choose a valid account role." });
    expect(dependencies.changeCentreAccountRole).not.toHaveBeenCalled();
  });

  it("rejects a malformed account ID before it reaches the use case", async () => {
    const malformed = form(); malformed.set("accountId", "not-a-uuid");
    await expect(changeAccountRoleAction({}, malformed)).resolves.toEqual({ error: "Choose a valid account role." });
    expect(dependencies.changeCentreAccountRole).not.toHaveBeenCalled();
  });

  it("does not invoke a role mutation without a server-derived actor", async () => {
    dependencies.currentActor.mockResolvedValue(undefined);
    await expect(changeAccountRoleAction({}, form())).resolves.toEqual({ error: "You do not have access to that page." });
    expect(dependencies.changeCentreAccountRole).not.toHaveBeenCalled();
    expect(dependencies.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns the stable final-admin message without revalidating", async () => {
    dependencies.changeCentreAccountRole.mockRejectedValue(new dependencies.IdentityError("Another active admin must be available before this account's role can be changed."));
    await expect(changeAccountRoleAction({}, form())).resolves.toEqual({ code: "LAST_ACTIVE_ADMIN", error: "Another active admin must be available before this account's role can be changed." });
    expect(dependencies.revalidatePath).not.toHaveBeenCalled();
  });
});
