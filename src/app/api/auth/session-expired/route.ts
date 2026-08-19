import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, sessionCookieOptions } from "@/features/identity/ui/session";
import { verifiesSessionCleanupToken } from "@/features/identity/infrastructure/session-cleanup";
import { noStoreHeaders } from "@/shared/http/response";

export async function GET(request: NextRequest) {
  const token = (await cookies()).get(sessionCookieName)?.value ?? "";
  const response = NextResponse.redirect(new URL("/sign-in", request.url), { status: 303, headers: noStoreHeaders });
  if (verifiesSessionCleanupToken(request.nextUrl.searchParams.get("token"), token)) response.cookies.set(sessionCookieName, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
}
