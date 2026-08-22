import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { accounts, auditEvents, oidcIdentities, sessions, signInThrottles } from "@/../db/schema";
import { database } from "@/infrastructure/database/client";
import { canonicalEmail, type Actor, type Role } from "../domain/contracts";
import { uuidv7 } from "./uuid";

type Database = typeof database | Parameters<Parameters<typeof database.transaction>[0]>[0];
const toActor = (account: typeof accounts.$inferSelect): Actor => ({ id: account.id, role: account.role, email: account.email, displayName: account.displayName });
const throttleKey = (email: string, origin: string) => createHash("sha256").update(`${canonicalEmail(email)}\0${origin}`).digest("hex");

export async function getAccountByEmail(email: string, db: Database = database) { return (await db.select().from(accounts).where(eq(accounts.canonicalEmail, canonicalEmail(email))).limit(1))[0]; }
export async function getAccountById(id: string, db: Database = database) { return (await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, id)).limit(1))[0]; }
export async function getActiveLearnerById(id: string, db: Database = database) { return (await db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.id, id), eq(accounts.role, "learner"), eq(accounts.status, "active"))).limit(1))[0]; }
export async function getActorBySessionToken(token: string, db: Database = database): Promise<Actor | undefined> {
  const verifierHash = createHash("sha256").update(token).digest("hex");
  const rows = await db.select({ account: accounts }).from(sessions).innerJoin(accounts, eq(sessions.accountId, accounts.id)).where(and(eq(sessions.verifierHash, verifierHash), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date()), eq(accounts.status, "active"))).limit(1);
  return rows[0] ? toActor(rows[0].account) : undefined;
}
export async function createSession(accountId: string, db: Database = database) {
  const token = randomBytes(32).toString("base64url");
  const id = uuidv7();
  const verifierHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
  const inserted = await db.execute<{ id: string }>(sql`INSERT INTO sessions (id, account_id, verifier_hash, expires_at)
    SELECT ${id}, ${accountId}, ${verifierHash}, ${expiresAt}
    FROM accounts WHERE id = ${accountId} AND status = 'active' FOR UPDATE
    RETURNING id`);
  if (!inserted[0]) throw new Error("ACCOUNT_NOT_ACTIVE");
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
  const id = uuidv7(); await db.insert(accounts).values({ id, ...input, canonicalEmail: canonicalEmail(input.email) }); await db.insert(auditEvents).values({ id: uuidv7(), actorId, action: "ACCOUNT_CREATED", targetId: id }); return id;
}
export async function listCentreAccounts(db: Database = database) {
  return db.select({ id: accounts.id, email: accounts.email, displayName: accounts.displayName, role: accounts.role, status: accounts.status, createdAt: accounts.createdAt, deactivatedAt: accounts.deactivatedAt }).from(accounts).orderBy(accounts.displayName, accounts.email);
}
export async function getCentreAccountDetail(id: string, db: Database = database) {
  const account = (await db.select({ id: accounts.id, email: accounts.email, displayName: accounts.displayName, role: accounts.role, status: accounts.status, createdAt: accounts.createdAt, deactivatedAt: accounts.deactivatedAt, deactivatedBy: accounts.deactivatedBy }).from(accounts).where(eq(accounts.id, id)).limit(1))[0];
  if (!account) return undefined;
  const history = await db.select({ id: auditEvents.id, actorId: auditEvents.actorId, action: auditEvents.action, targetId: auditEvents.targetId, createdAt: auditEvents.createdAt }).from(auditEvents).where(eq(auditEvents.targetId, id)).orderBy(desc(auditEvents.createdAt));
  return { account, history };
}
export async function deactivateAccount(accountId: string, actorId: string, confirmation: string, db: Database) {
  // Lock every active admin before deciding so concurrent admin removals cannot remove them all.
  const activeAdmins = await db.execute<{ id: string }>(sql`SELECT id FROM accounts WHERE role = 'admin' AND status = 'active' ORDER BY id FOR UPDATE`);
  const lockedTargets = await db.execute<{ id: string; email: string; role: Role; status: "active" | "deactivated" }>(sql`SELECT id, email, role, status FROM accounts WHERE id = ${accountId} FOR UPDATE`);
  const target = lockedTargets[0];
  if (!target || target.status !== "active") throw new Error("ACCOUNT_NOT_ACTIVE");
  if (confirmation !== target.email) throw new Error("CONFIRMATION_MISMATCH");
  if (target.role === "admin" && activeAdmins.length === 1 && activeAdmins[0]?.id === accountId) throw new Error("LAST_ACTIVE_ADMIN");
  const deactivatedAt = new Date();
  await db.update(accounts).set({ status: "deactivated", deactivatedAt, deactivatedBy: actorId, updatedAt: deactivatedAt }).where(eq(accounts.id, accountId));
  await db.update(sessions).set({ revokedAt: deactivatedAt }).where(and(eq(sessions.accountId, accountId), isNull(sessions.revokedAt)));
  await db.insert(auditEvents).values({ id: uuidv7(), actorId, action: "ACCOUNT_DEACTIVATED", targetId: accountId });
}
export async function changeAccountRole(accountId: string, role: Role, actorId: string, db: Database) {
  // Lock every active admin before deciding so concurrent admin changes cannot remove them all.
  const activeAdmins = await db.execute<{ id: string }>(sql`SELECT id FROM accounts WHERE role = 'admin' AND status = 'active' ORDER BY id FOR UPDATE`);
  const lockedTargets = await db.execute<{ id: string; role: Role; status: "active" | "deactivated" }>(sql`SELECT id, role, status FROM accounts WHERE id = ${accountId} FOR UPDATE`);
  const target = lockedTargets[0];
  if (!target) throw new Error("ACCOUNT_NOT_FOUND");
  if (target.status !== "active") throw new Error("ACCOUNT_NOT_ACTIVE");
  if (target.role === "admin" && target.status === "active" && role !== "admin" && activeAdmins.length === 1 && activeAdmins[0]?.id === accountId) throw new Error("LAST_ACTIVE_ADMIN");
  if (target.role === role) return;
  await db.update(accounts).set({ role, updatedAt: new Date() }).where(eq(accounts.id, accountId));
  await db.insert(auditEvents).values({ id: uuidv7(), actorId, action: "ACCOUNT_ROLE_CHANGED", targetId: accountId });
}
export async function getGoogleIdentity(subject: string, db: Database = database) { return (await db.select().from(oidcIdentities).where(and(eq(oidcIdentities.provider, "google"), eq(oidcIdentities.subject, subject))).limit(1))[0]; }
export async function linkGoogleIdentity(subject: string, accountId: string, db: Database = database) { await db.insert(oidcIdentities).values({ provider: "google", subject, accountId }); await db.insert(auditEvents).values({ id: uuidv7(), action: "OIDC_IDENTITY_LINKED", targetId: accountId }); }
export async function auditOidcProvisioning(accountId: string, db: Database = database) { await db.insert(auditEvents).values({ id: uuidv7(), action: "OIDC_ACCOUNT_PROVISIONED", targetId: accountId }); }
export async function recordEvidenceRead(actorId: string, learnerId: string | undefined, outcome: "SUCCESS" | "NO_DATA", db: Database = database) {
  await db.insert(auditEvents).values({ id: uuidv7(), actorId, action: "EVIDENCE_READ", targetId: learnerId, targetScope: learnerId ? "LEARNER_DETAIL" : "CENTRE_WIDE", outcome });
}
export async function recordEvidenceResolution(actorId: string, reviewItemId: string, outcome: "SUCCESS" | "CONFLICT", db: Database = database) {
  await db.insert(auditEvents).values({ id: uuidv7(), actorId, action: "EVIDENCE_RESOLUTION", targetId: reviewItemId, targetScope: "REVIEW_ITEM", outcome });
}
export { toActor };
