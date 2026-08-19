import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { revokeSession } from "@/features/identity/infrastructure/repositories";
import { sessionCookieName, sessionCookieOptions } from "@/features/identity/ui/session";

export async function POST(request: NextRequest) { const jar = await cookies(); const token = jar.get(sessionCookieName)?.value; if (token) await revokeSession(token); const response = NextResponse.redirect(new URL("/sign-in", request.url), { status: 303 }); response.cookies.set(sessionCookieName, "", { ...sessionCookieOptions, maxAge: 0 }); return response; }
