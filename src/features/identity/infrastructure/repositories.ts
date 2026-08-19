import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { accounts, auditEvents, oidcIdentities, sessions, signInThrottles } from "@/../db/schema";
import { database } from "@/infrastructure/database/client";
import type { Actor, Role } from "../domain/contracts";
import { uuidv7 } from "./uuid";

type Database = typeof database | Parameters<Parameters<typeof database.transaction>[0]>[0];
const toActor = (account: typeof accounts.$inferSelect): Actor => ({ id: account.id, role: account.role, email: account.email, displayName: account.displayName });
const throttleKey = (email: string, origin: string) => createHash("sha256").update(`${email}\0${origin}`).digest("hex");

export async function getAccountByEmail(email: string, db: Database = database) { return (await db.select().from(accounts).where(eq(accounts.email, email)).limit(1))[0]; }
export async function getActorBySessionToken(token: string, db: Database = database): Promise<Actor | undefined> {
  const verifierHash = createHash("sha256").update(token).digest("hex");
  const rows = await db.select({ account: accounts }).from(sessions).innerJoin(accounts, eq(sessions.accountId, accounts.id)).where(and(eq(sessions.verifierHash, verifierHash), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date()), eq(accounts.status, "active"))).limit(1);
  return rows[0] ? toActor(rows[0].account) : undefined;
}
export async function createSession(accountId: string, db: Database = database) {
  const token = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({ id: uuidv7(), accountId, verifierHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14) });
  return token;
}
export async function revokeSession(token: string, db: Database = database) { await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.verifierHash, createHash("sha256").update(token).digest("hex"))); }
export async function isThrottled(email: string, origin: string, db: Database = database) { const entry = (await db.select().from(signInThrottles).where(eq(signInThrottles.keyHash, throttleKey(email, origin))).limit(1))[0]; return Boolean(entry?.blockedUntil && entry.blockedUntil > new Date()); }
export async function recordSignInFailure(email: string, origin: string, db: Database = database) {
  const keyHash = throttleKey(email, origin);
  await db.execute(sql`INSERT INTO sign_in_throttles (key_hash, failures, window_started_at, blocked_until)
    VALUES (${keyHash}, 1, now(), NULL)
    ON CONFLICT (key_hash) DO UPDATE SET
      failures = CASE WHEN sign_in_throttles.window_started_at < now() - interval '15 minutes' THEN 1 ELSE sign_in_throttles.failures + 1 END,
      window_started_at = CASE WHEN sign_in_throttles.window_started_at < now() - interval '15 minutes' THEN now() ELSE sign_in_throttles.window_started_at END,
      blocked_until = CASE WHEN (CASE WHEN sign_in_throttles.window_started_at < now() - interval '15 minutes' THEN 1 ELSE sign_in_throttles.failures + 1 END) >= 5 THEN now() + interval '15 minutes' ELSE NULL END`);
}
export async function clearSignInFailures(email: string, origin: string, db: Database = database) { await db.delete(signInThrottles).where(eq(signInThrottles.keyHash, throttleKey(email, origin))); }
export async function createAccount(input: { email: string; displayName: string; role: Role; passwordHash?: string }, actorId?: string, db: Database = database) {
  const id = uuidv7(); await db.insert(accounts).values({ id, ...input }); await db.insert(auditEvents).values({ id: uuidv7(), actorId, action: "ACCOUNT_CREATED", targetId: id }); return id;
}
export async function getGoogleIdentity(subject: string, db: Database = database) { return (await db.select().from(oidcIdentities).where(and(eq(oidcIdentities.provider, "google"), eq(oidcIdentities.subject, subject))).limit(1))[0]; }
export async function linkGoogleIdentity(subject: string, accountId: string, db: Database = database) { await db.insert(oidcIdentities).values({ provider: "google", subject, accountId }); await db.insert(auditEvents).values({ id: uuidv7(), action: "OIDC_IDENTITY_LINKED", targetId: accountId }); }
export async function promoteGoogleAdmin(accountId: string, db: Database = database) { await db.update(accounts).set({ role: "admin", status: "active", updatedAt: new Date() }).where(eq(accounts.id, accountId)); await db.insert(auditEvents).values({ id: uuidv7(), action: "ACCOUNT_PROMOTED_GOOGLE_ADMIN", targetId: accountId }); }
export async function auditOidcProvisioning(accountId: string, db: Database = database) { await db.insert(auditEvents).values({ id: uuidv7(), action: "OIDC_ACCOUNT_PROVISIONED", targetId: accountId }); }
export { toActor };
