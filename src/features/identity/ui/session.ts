import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getActorBySessionToken } from "../infrastructure/repositories";
import { roleHome } from "../application/auth";
import type { Actor, Role } from "../domain/contracts";

export const sessionCookieName = "cambridgeyle_session";
export const sessionCookieOptions = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 14 };
export async function currentActor(): Promise<Actor | undefined> { return getActorBySessionToken((await cookies()).get(sessionCookieName)?.value ?? ""); }
export async function requireRole(roles: Role[]): Promise<Actor> { const actor = await currentActor(); if (!actor) redirect("/sign-in"); if (!roles.includes(actor.role)) redirect(`${roleHome(actor.role)}?notice=${encodeURIComponent("You do not have access to that page.")}`); return actor; }
