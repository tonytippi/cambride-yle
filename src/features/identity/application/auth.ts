import { database } from "@/infrastructure/database/client";
import { accounts } from "@/../db/schema";
import { eq } from "drizzle-orm";
import { genericSignInError, type Actor, type Role } from "../domain/contracts";
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
  await repository.clearSignInFailures(email, origin); return { actor: repository.toActor(account), token: await repository.createSession(account.id) };
}
export async function createCentreAccount(actor: Actor, input: { email: string; displayName: string; password: string; role: Role }) {
  authorise(actor, ["admin"]); return database.transaction(async (tx) => repository.createAccount({ email: input.email, displayName: input.displayName, role: input.role, passwordHash: await hashPassword(input.password) }, actor.id, tx));
}
export async function signInWithGoogle(identity: VerifiedGoogleIdentity, adminEmails: string[]) {
  return database.transaction(async (tx) => {
    const linked = await repository.getGoogleIdentity(identity.subject, tx);
    if (linked) { const account = (await tx.select().from(accounts).where(eq(accounts.id, linked.accountId)).limit(1))[0]; if (!account || account.status !== "active" || account.email !== identity.email) throw new IdentityError("GOOGLE_SIGN_IN_FAILED", "We could not sign you in with Google."); const role = adminEmails.includes(identity.email) ? "admin" : account.role; if (role === "admin" && account.role !== "admin") await repository.promoteGoogleAdmin(account.id, tx); return { actor: { ...repository.toActor(account), role }, token: await repository.createSession(account.id, tx) }; }
    const existing = await repository.getAccountByEmail(identity.email, tx);
    if (existing) {
      if (existing.status !== "active") throw new IdentityError("GOOGLE_SIGN_IN_FAILED", "We could not sign you in with Google.");
      const role = adminEmails.includes(identity.email) ? "admin" : existing.role; if (role === "admin") await repository.promoteGoogleAdmin(existing.id, tx); else if (existing.role !== "learner") throw new IdentityError("GOOGLE_IDENTITY_CONFLICT", "We could not sign you in with Google.");
      await repository.linkGoogleIdentity(identity.subject, existing.id, tx); return { actor: { ...repository.toActor(existing), role }, token: await repository.createSession(existing.id, tx) };
    }
    const id = await repository.createAccount({ email: identity.email, displayName: identity.displayName, role: adminEmails.includes(identity.email) ? "admin" : "learner" }, undefined, tx);
    await repository.linkGoogleIdentity(identity.subject, id, tx); await repository.auditOidcProvisioning(id, tx); const account = (await tx.select().from(accounts).where(eq(accounts.id, id)).limit(1))[0]!; return { actor: repository.toActor(account), token: await repository.createSession(id, tx) };
  });
}
