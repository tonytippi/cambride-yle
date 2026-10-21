import { cookies } from "next/headers";
import { getActorBySessionToken, revokeSession } from "@/features/identity/infrastructure/repositories";
import { audienceOf, signInPath } from "@/features/identity/application/auth";
import { sessionCookieName, sessionCookieOptions } from "@/features/identity/ui/session";
import { redirectTo } from "@/shared/http/response";

/* Signing out returns staff to staff sign-in and learners to learner sign-in. */
export async function POST() { const jar = await cookies(); const token = jar.get(sessionCookieName)?.value; const actor = token ? await getActorBySessionToken(token) : undefined; if (token) await revokeSession(token); const response = redirectTo(signInPath(actor ? audienceOf(actor.role) : "learner")); response.cookies.set(sessionCookieName, "", { ...sessionCookieOptions, maxAge: 0 }); return response; }
