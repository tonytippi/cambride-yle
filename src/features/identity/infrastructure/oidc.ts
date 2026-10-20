import { createRemoteJWKSet, jwtVerify } from "jose";

/* Google's signing keys, from jwks_uri in https://accounts.google.com/.well-known/openid-configuration; jose caches and rotates them. */
export const googleJwksUri = "https://www.googleapis.com/oauth2/v3/certs";
const googleKeys = createRemoteJWKSet(new URL(googleJwksUri));

export type VerifiedGoogleIdentity = { subject: string; email: string; displayName: string };

export async function verifyGoogleIdToken(idToken: string, config: { issuer: string; clientId: string; nonce: string }): Promise<VerifiedGoogleIdentity> {
  const { payload } = await jwtVerify(idToken, googleKeys, { issuer: config.issuer, audience: config.clientId });
  if (payload.nonce !== config.nonce) throw new Error("INVALID_GOOGLE_NONCE");
  if (typeof payload.sub !== "string" || typeof payload.email !== "string" || payload.email_verified !== true) throw new Error("INVALID_GOOGLE_IDENTITY");
  return { subject: payload.sub, email: payload.email.trim().toLowerCase(), displayName: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : payload.email };
}
