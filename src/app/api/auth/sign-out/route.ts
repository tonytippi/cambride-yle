import { cookies } from "next/headers";
import { revokeSession } from "@/features/identity/infrastructure/repositories";
import { sessionCookieName, sessionCookieOptions } from "@/features/identity/ui/session";
import { redirectTo } from "@/shared/http/response";

export async function POST() { const jar = await cookies(); const token = jar.get(sessionCookieName)?.value; if (token) await revokeSession(token); const response = redirectTo("/sign-in"); response.cookies.set(sessionCookieName, "", { ...sessionCookieOptions, maxAge: 0 }); return response; }
