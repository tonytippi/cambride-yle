import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { sessionCookieName, sessionCookieOptions } from "@/features/identity/ui/session";
import { verifiesSessionCleanupToken } from "@/features/identity/infrastructure/session-cleanup";
import { redirectTo } from "@/shared/http/response";
import { getEndedSessionAccount } from "@/features/identity/infrastructure/repositories";
import { signInPath } from "@/features/identity/application/auth";

export async function GET(request: NextRequest) {
  const token = (await cookies()).get(sessionCookieName)?.value ?? "";
  const verified = verifiesSessionCleanupToken(request.nextUrl.searchParams.get("token"), token);
  // A deactivated learner's device is told to remove that learner's local practice data; an ordinary expiry keeps unsynced drafts.
  const account = verified ? await getEndedSessionAccount(token) : undefined;
  const deactivated = account?.status === "deactivated" && account.role === "learner";
  // A staff page sends ended staff sessions back to staff sign-in; the parameter only chooses between two fixed pages.
  const response = redirectTo(deactivated ? `/sign-in?${new URLSearchParams({ ended: "deactivated", account: account.id })}` : signInPath(request.nextUrl.searchParams.get("audience") === "staff" ? "staff" : "learner"));
  if (verified) response.cookies.set(sessionCookieName, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
}
