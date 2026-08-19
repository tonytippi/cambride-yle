import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { serverConfig } from "@/shared/config/server";
import { codeChallenge, oauthCookieName, oauthCookieOptions, randomOAuthValue } from "@/features/identity/infrastructure/oauth-state";

export async function GET() {
  const state = randomOAuthValue(); const nonce = randomOAuthValue(); const verifier = randomOAuthValue();
  (await cookies()).set(oauthCookieName(state), `${state}.${nonce}.${verifier}`, oauthCookieOptions);
  const url = new URL("/o/oauth2/v2/auth", serverConfig.GOOGLE_OIDC_ISSUER); url.searchParams.set("client_id", serverConfig.GOOGLE_OIDC_CLIENT_ID); url.searchParams.set("redirect_uri", serverConfig.GOOGLE_OIDC_REDIRECT_URI); url.searchParams.set("response_type", "code"); url.searchParams.set("scope", "openid email profile"); url.searchParams.set("state", state); url.searchParams.set("nonce", nonce); url.searchParams.set("code_challenge", codeChallenge(verifier)); url.searchParams.set("code_challenge_method", "S256");
  return NextResponse.redirect(url);
}
