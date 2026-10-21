import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getActorBySessionToken } from "../infrastructure/repositories";
import { createSessionCleanupToken } from "../infrastructure/session-cleanup";
import { roleHome, signInPath } from "../application/auth";
import type { Actor, Role } from "../domain/contracts";

export const sessionCookieName = "cambridgeyle_session";
export const sessionCookieOptions = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 14 };
export async function currentActor(): Promise<Actor | undefined> { return getActorBySessionToken((await cookies()).get(sessionCookieName)?.value ?? ""); }
export async function requireRole(roles: Role[]): Promise<Actor> { const token = (await cookies()).get(sessionCookieName)?.value ?? ""; const actor = await getActorBySessionToken(token); const audience = roles.includes("learner") ? "learner" : "staff"; if (!actor) redirect(token ? `/api/auth/session-expired?${new URLSearchParams({ token: createSessionCleanupToken(token), ...(audience === "staff" ? { audience } : {}) })}` : signInPath(audience)); if (!roles.includes(actor.role)) redirect(`${roleHome(actor.role)}?notice=${encodeURIComponent("You do not have access to that page.")}`); return actor; }
