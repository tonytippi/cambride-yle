import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const oauthCookiePrefix = "cambridgeyle_google_oauth_";
export const oauthCookieOptions = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 600 };
export function randomOAuthValue() { return randomBytes(32).toString("base64url"); }
export function codeChallenge(verifier: string) { return createHash("sha256").update(verifier).digest("base64url"); }
export function safeEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left); const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}
export function oauthCookieName(state: string) { return `${oauthCookiePrefix}${state}`; }
