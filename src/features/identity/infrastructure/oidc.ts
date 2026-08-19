import { createRemoteJWKSet, jwtVerify } from "jose";

export type VerifiedGoogleIdentity = { subject: string; email: string; displayName: string };

export async function verifyGoogleIdToken(idToken: string, config: { issuer: string; clientId: string; nonce: string }): Promise<VerifiedGoogleIdentity> {
  const issuer = new URL(config.issuer);
  const keys = createRemoteJWKSet(new URL("/oauth2/v3/certs", issuer));
  const { payload } = await jwtVerify(idToken, keys, { issuer: config.issuer, audience: config.clientId });
  if (payload.nonce !== config.nonce) throw new Error("INVALID_GOOGLE_NONCE");
  if (typeof payload.sub !== "string" || typeof payload.email !== "string" || payload.email_verified !== true) throw new Error("INVALID_GOOGLE_IDENTITY");
  return { subject: payload.sub, email: payload.email.trim().toLowerCase(), displayName: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : payload.email };
}
