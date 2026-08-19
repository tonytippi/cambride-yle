import { database } from "@/infrastructure/database/client";
import { accounts } from "@/../db/schema";
import { eq } from "drizzle-orm";
import { canonicalEmail, genericSignInError, type Actor, type Role } from "../domain/contracts";
import { hashPassword, verifyDummyPassword, verifyPassword } from "../infrastructure/password";
import * as repository from "../infrastructure/repositories";
import type { VerifiedGoogleIdentity } from "../infrastructure/oidc";

export class IdentityError extends Error { readonly code: string; constructor(code: string, message: string) { super(message); this.code = code; } }
export const roleHome = (role: Role) => `/${role === "academic_lead" ? "academic-lead" : role}`;
export function authorise(actor: Actor, allowed: Role[]) { if (!allowed.includes(actor.role)) throw new IdentityError("FORBIDDEN", "You do not have access to that page."); }

export async function signInLocally(email: string, password: string, origin: string) {
  if (await repository.isThrottled(email, origin)) throw new IdentityError(genericSignInError.code, genericSignInError.message);
  const account = await repository.getAccountByEmail(email);
  const valid = account?.status === "active" && account.passwordHash ? await verifyPassword(account.passwordHash, password) : (await verifyDummyPassword(password), false);
  if (!valid || !account) { await repository.recordSignInFailure(email, origin); throw new IdentityError(genericSignInError.code, genericSignInError.message); }
  try { const token = await repository.createSession(account.id); await repository.clearSignInFailures(email, origin); return { actor: repository.toActor(account), token }; }
  catch (error) { if (error instanceof Error && error.message === "ACCOUNT_NOT_ACTIVE") throw new IdentityError(genericSignInError.code, genericSignInError.message); throw error; }
}
export async function createCentreAccount(actor: Actor, input: { email: string; displayName: string; password: string; role: Role }) {
  authorise(actor, ["admin"]); return database.transaction(async (tx) => repository.createAccount({ email: input.email, displayName: input.displayName, role: input.role, passwordHash: await hashPassword(input.password) }, actor.id, tx));
}
export async function deactivateCentreAccount(actor: Actor, input: { accountId: string; confirmation: string }) {
  authorise(actor, ["admin"]);
  return database.transaction(async (tx) => {
    try { await repository.deactivateAccount(input.accountId, actor.id, input.confirmation, tx); }
    catch (error) {
      if (error instanceof Error && error.message === "LAST_ACTIVE_ADMIN") throw new IdentityError("LAST_ACTIVE_ADMIN", "Another active admin must be available before this account can be deactivated.");
      if (error instanceof Error && error.message === "ACCOUNT_NOT_ACTIVE") throw new IdentityError("ACCOUNT_NOT_ACTIVE", "This account is no longer active.");
      if (error instanceof Error && error.message === "CONFIRMATION_MISMATCH") throw new IdentityError("CONFIRMATION_MISMATCH", "Enter the account email exactly to confirm deactivation.");
      throw error;
    }
  });
}
export async function getCentreAccounts(actor: Actor) { authorise(actor, ["admin"]); return repository.listCentreAccounts(); }
export async function getCentreAccountDetail(actor: Actor, accountId: string) { authorise(actor, ["admin"]); return repository.getCentreAccountDetail(accountId); }
export async function signInWithGoogle(identity: VerifiedGoogleIdentity, adminEmails: string[]) {
  return database.transaction(async (tx) => {
    const linked = await repository.getGoogleIdentity(identity.subject, tx);
    if (linked) { const account = (await tx.select().from(accounts).where(eq(accounts.id, linked.accountId)).limit(1))[0]; if (!account || account.status !== "active" || canonicalEmail(account.email) !== canonicalEmail(identity.email)) throw new IdentityError("GOOGLE_SIGN_IN_FAILED", "We could not sign you in with Google."); const role = adminEmails.includes(identity.email) ? "admin" : account.role; if (role === "admin" && account.role !== "admin") await repository.promoteGoogleAdmin(account.id, tx); try { return { actor: { ...repository.toActor(account), role }, token: await repository.createSession(account.id, tx) }; } catch (error) { if (error instanceof Error && error.message === "ACCOUNT_NOT_ACTIVE") throw new IdentityError("GOOGLE_SIGN_IN_FAILED", "We could not sign you in with Google."); throw error; } }
    const existing = await repository.getAccountByEmail(identity.email, tx);
    if (existing) {
      if (existing.status !== "active") throw new IdentityError("GOOGLE_SIGN_IN_FAILED", "We could not sign you in with Google.");
      const role = adminEmails.includes(identity.email) ? "admin" : existing.role; if (role === "admin") await repository.promoteGoogleAdmin(existing.id, tx);
      await repository.linkGoogleIdentity(identity.subject, existing.id, tx); try { return { actor: { ...repository.toActor(existing), role }, token: await repository.createSession(existing.id, tx) }; } catch (error) { if (error instanceof Error && error.message === "ACCOUNT_NOT_ACTIVE") throw new IdentityError("GOOGLE_SIGN_IN_FAILED", "We could not sign you in with Google."); throw error; }
    }
    const id = await repository.createAccount({ email: identity.email, displayName: identity.displayName, role: adminEmails.includes(identity.email) ? "admin" : "learner" }, undefined, tx);
    await repository.linkGoogleIdentity(identity.subject, id, tx); await repository.auditOidcProvisioning(id, tx); const account = (await tx.select().from(accounts).where(eq(accounts.id, id)).limit(1))[0]!; return { actor: repository.toActor(account), token: await repository.createSession(id, tx) };
  });
}
