import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { serverConfig } from "@/shared/config/server";
import { verifyGoogleIdToken } from "@/features/identity/infrastructure/oidc";
import { roleHome, signInWithGoogle } from "@/features/identity/application/auth";
import { sessionCookieName, sessionCookieOptions } from "@/features/identity/ui/session";
import { oauthCookieName, oauthCookieOptions, oauthCookiePrefix, safeEqual } from "@/features/identity/infrastructure/oauth-state";
import { noStoreHeaders } from "@/shared/http/response";
import { logEvent } from "@/shared/logging/logger";

export async function GET(request: NextRequest) {
  const url = request.nextUrl; const state = url.searchParams.get("state"); const jar = await cookies(); const saved = state ? jar.get(oauthCookieName(state))?.value : undefined; const [storedState, nonce, verifier] = saved?.split(".") ?? [];
  const clearTransient = (response: NextResponse) => { for (const cookie of jar.getAll()) if (cookie.name.startsWith(oauthCookiePrefix)) response.cookies.set(cookie.name, "", { ...oauthCookieOptions, maxAge: 0 }); return response; };
  const failure = (code: string) => { logEvent({ requestId: request.headers.get("x-request-id") ?? "unknown", feature: "identity", action: "google-sign-in", outcome: "failure", errorCode: code }); return clearTransient(NextResponse.redirect(new URL("/sign-in?error=google", request.url), { headers: noStoreHeaders })); };
  if (!state || !saved || !storedState || !safeEqual(state, storedState) || !nonce || !verifier || !url.searchParams.get("code")) return failure("GOOGLE_STATE_INVALID");
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, cache: "no-store", body: new URLSearchParams({ code: url.searchParams.get("code")!, client_id: serverConfig.GOOGLE_OIDC_CLIENT_ID, client_secret: serverConfig.GOOGLE_OIDC_CLIENT_SECRET, redirect_uri: serverConfig.GOOGLE_OIDC_REDIRECT_URI, grant_type: "authorization_code", code_verifier: verifier }) });
    const tokens = await tokenResponse.json() as { id_token?: string }; if (!tokenResponse.ok || !tokens.id_token) throw new Error("TOKEN_EXCHANGE_FAILED");
    const identity = await verifyGoogleIdToken(tokens.id_token, { issuer: serverConfig.GOOGLE_OIDC_ISSUER, clientId: serverConfig.GOOGLE_OIDC_CLIENT_ID, nonce });
    const { actor, token } = await signInWithGoogle(identity, serverConfig.ADMIN_EMAILS); const response = NextResponse.redirect(new URL(roleHome(actor.role), request.url), { headers: noStoreHeaders }); response.cookies.set(sessionCookieName, token, sessionCookieOptions); logEvent({ requestId: request.headers.get("x-request-id") ?? "unknown", actorId: actor.id, feature: "identity", action: "google-sign-in", outcome: "success" }); return clearTransient(response);
  } catch { return failure("GOOGLE_SIGN_IN_FAILED"); }
}
