import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => {
  const cookieJar = {
    values: new Map<string, string>(), set: vi.fn((name: string, value: string) => cookieJar.values.set(name, value)), get: vi.fn((name: string) => {
      const value = cookieJar.values.get(name); return value ? { name, value } : undefined;
    }), getAll: vi.fn(() => [...cookieJar.values].map(([name, value]) => ({ name, value })))
  };
  return {
    cookieJar,
    headers: vi.fn(async () => new Headers({ host: "trusted.test" })),
    redirect: vi.fn((location: string) => { throw new Error(`REDIRECT:${location}`); }),
    logEvent: vi.fn(),
    signInLocally: vi.fn(), signInWithGoogle: vi.fn(), verifyGoogleIdToken: vi.fn(), revokeSession: vi.fn(),
    repository: { isThrottled: vi.fn(), getAccountByEmail: vi.fn(), recordSignInFailure: vi.fn(), clearSignInFailures: vi.fn(), createSession: vi.fn(), revokeSession: vi.fn(), toActor: vi.fn((account) => ({ id: account.id, email: account.email, displayName: account.displayName, role: account.role })), getGoogleIdentity: vi.fn(), createAccount: vi.fn(), linkGoogleIdentity: vi.fn(), auditOidcProvisioning: vi.fn(), promoteGoogleAdmin: vi.fn() },
    verifyPassword: vi.fn(), verifyDummyPassword: vi.fn(),
    transaction: vi.fn(),
    selectAccount: undefined as unknown
  };
});

vi.mock("next/headers", () => ({ cookies: async () => dependencies.cookieJar, headers: dependencies.headers }));
vi.mock("next/navigation", () => ({ redirect: dependencies.redirect }));
vi.mock("@/shared/logging/logger", () => ({ logEvent: dependencies.logEvent }));
vi.mock("@/features/identity/ui/session", () => ({ sessionCookieName: "cambridgeyle_session", sessionCookieOptions: { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 100 } }));
vi.mock("@/features/identity/application/auth", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/features/identity/application/auth")>()), signInLocally: dependencies.signInLocally, signInWithGoogle: dependencies.signInWithGoogle }));
vi.mock("@/features/identity/infrastructure/oidc", () => ({ verifyGoogleIdToken: dependencies.verifyGoogleIdToken }));
vi.mock("@/features/identity/infrastructure/repositories", () => dependencies.repository);
vi.mock("@/features/identity/infrastructure/password", () => ({ verifyPassword: dependencies.verifyPassword, verifyDummyPassword: dependencies.verifyDummyPassword, hashPassword: vi.fn() }));
vi.mock("@/infrastructure/database/client", () => ({ database: { transaction: dependencies.transaction } }));

import { signInAction } from "@/app/sign-in/actions";
import { GET as googleCallback } from "@/app/api/auth/google/callback/route";
import { POST as signOut } from "@/app/api/auth/sign-out/route";
import { IdentityError } from "@/features/identity/application/auth";

const form = (email = "learner@example.test", password = "correct-password") => { const data = new FormData(); data.set("email", email); data.set("password", password); return data; };
const actor = { id: "018f0000-0000-7000-8000-000000000001", email: "learner@example.test", displayName: "Learner", role: "learner" as const };
const nextRequest = (url: string) => ({ url, nextUrl: new URL(url), headers: new Headers() }) as never;

describe("identity I/O matrix without external services", () => {
  beforeEach(() => {
    vi.clearAllMocks(); dependencies.cookieJar.values.clear();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id_token: "mocked-id-token" }), { status: 200 })));
    // eslint-disable-next-line no-unused-vars
    dependencies.transaction.mockImplementation(async (callback: (transaction: unknown) => unknown) => callback({ select: () => ({ from: () => ({ where: () => ({ limit: async () => [dependencies.selectAccount] }) }) }) }));
  });

  it("routes valid local credentials to the role home and sets a secure opaque session cookie", async () => {
    dependencies.signInLocally.mockResolvedValue({ actor, token: "opaque-session-token" });
    await expect(signInAction({}, form())).rejects.toThrow("REDIRECT:/learner");
    expect(dependencies.cookieJar.set).toHaveBeenCalledWith("cambridgeyle_session", "opaque-session-token", expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax", path: "/" }));
  });

  it("returns the identical generic result for unknown, wrong, deactivated, and throttled local inputs", async () => {
    const failures = ["unknown", "wrong", "deactivated", "throttled"];
    const results = [];
    for (const failure of failures) { dependencies.signInLocally.mockRejectedValueOnce(new Error(failure)); results.push(await signInAction({}, form())); }
    expect(results).toEqual(Array(4).fill({ error: "We could not sign you in with those details." }));
  });

  it("uses real local-auth branches for unknown, invalid, deactivated, and throttled credentials without exposing the cause", async () => {
    dependencies.repository.isThrottled.mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    dependencies.repository.getAccountByEmail.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ ...actor, status: "active", passwordHash: "hash" }).mockResolvedValueOnce({ ...actor, status: "deactivated", passwordHash: "hash" });
    dependencies.verifyPassword.mockResolvedValue(false); dependencies.verifyDummyPassword.mockResolvedValue(undefined);
    const { signInLocally: realSignInLocally } = await vi.importActual<typeof import("@/features/identity/application/auth")>("@/features/identity/application/auth");
    const outcomes = await Promise.all(["a", "b", "c", "d"].map(async (email) => {
      try { await realSignInLocally(email, "password", "trusted.test"); return "success"; } catch (error) { return (error as IdentityError).message; }
    }));
    expect(outcomes).toEqual(Array(4).fill("We could not sign you in with those details."));
  });

  it("handles a verified Google callback with no-store session response for both admin and learner actors", async () => {
    dependencies.cookieJar.values.set("cambridgeyle_google_oauth_state", "state.nonce.verifier"); dependencies.verifyGoogleIdToken.mockResolvedValue({ subject: "sub", email: "admin@example.test", displayName: "Admin" }); dependencies.signInWithGoogle.mockResolvedValue({ actor: { ...actor, role: "admin" }, token: "admin-session" });
    const admin = await googleCallback(nextRequest("http://app.test/api/auth/google/callback?state=state&code=code"));
    expect(admin.headers.get("location")).toBe("http://app.test/admin"); expect(admin.headers.get("cache-control")).toContain("no-store"); expect(admin.headers.get("set-cookie")).toContain("cambridgeyle_session=admin-session");
    dependencies.cookieJar.values.set("cambridgeyle_google_oauth_state", "state.nonce.verifier"); dependencies.verifyGoogleIdToken.mockResolvedValue({ subject: "sub2", email: "learner@example.test", displayName: "Learner" }); dependencies.signInWithGoogle.mockResolvedValue({ actor, token: "learner-session" });
    const learner = await googleCallback(nextRequest("http://app.test/api/auth/google/callback?state=state&code=code"));
    expect(learner.headers.get("location")).toBe("http://app.test/learner");
  });

  it("uses the real Google provisioning use case to promote configured admins and create new learners", async () => {
    dependencies.repository.getGoogleIdentity.mockResolvedValue(undefined); dependencies.repository.getAccountByEmail.mockResolvedValueOnce({ ...actor, id: "existing", role: "learner", status: "active" }); dependencies.repository.createSession.mockResolvedValue("session");
    const { signInWithGoogle: realSignInWithGoogle } = await vi.importActual<typeof import("@/features/identity/application/auth")>("@/features/identity/application/auth");
    const promoted = await realSignInWithGoogle({ subject: "admin-sub", email: "admin@example.test", displayName: "Admin" }, ["admin@example.test"]);
    expect(promoted.actor.role).toBe("admin"); expect(dependencies.repository.promoteGoogleAdmin).toHaveBeenCalledWith("existing", expect.anything());
    dependencies.repository.getAccountByEmail.mockResolvedValueOnce(undefined); dependencies.repository.createAccount.mockResolvedValue("new-learner"); dependencies.selectAccount = { ...actor, id: "new-learner" };
    const learner = await realSignInWithGoogle({ subject: "learner-sub", email: "learner@example.test", displayName: "Learner" }, ["admin@example.test"]);
    expect(learner.actor.role).toBe("learner"); expect(dependencies.repository.createAccount).toHaveBeenLastCalledWith(expect.objectContaining({ role: "learner" }), undefined, expect.anything()); expect(dependencies.repository.auditOidcProvisioning).toHaveBeenCalledWith("new-learner", expect.anything());
  });

  it("rejects invalid state, invalid token, and unverified identities without provisioning", async () => {
    const invalidState = await googleCallback(nextRequest("http://app.test/api/auth/google/callback?state=missing&code=code")); expect(invalidState.headers.get("location")).toContain("/sign-in?error=google");
    dependencies.cookieJar.values.set("cambridgeyle_google_oauth_state", "state.nonce.verifier"); dependencies.verifyGoogleIdToken.mockRejectedValue(new Error("unverified"));
    const invalidToken = await googleCallback(nextRequest("http://app.test/api/auth/google/callback?state=state&code=code"));
    expect(invalidToken.headers.get("location")).toContain("/sign-in?error=google"); expect(dependencies.signInWithGoogle).not.toHaveBeenCalled();
  });

  it("signs out with 303, clears the cookie, and revokes its server session", async () => {
    dependencies.cookieJar.values.set("cambridgeyle_session", "opaque-session-token"); const response = await signOut(new Request("http://app.test/api/auth/sign-out", { method: "POST" }) as never);
    expect(response.status).toBe(303); expect(response.headers.get("location")).toBe("http://app.test/sign-in"); expect(dependencies.repository.revokeSession).toHaveBeenCalledWith("opaque-session-token"); expect(response.headers.get("set-cookie")).toContain("cambridgeyle_session=; ");
  });
});
