import { afterEach, describe, expect, it, vi } from "vitest";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { googleJwksUri, verifyGoogleIdToken } from "@/features/identity/infrastructure/oidc";

const config = { issuer: "https://accounts.google.com", clientId: "client-id.apps.googleusercontent.com", nonce: "nonce-1" };

describe("Google ID token verification", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("verifies tokens against Google's published key set and rejects a wrong nonce or unverified email", async () => {
    expect(googleJwksUri).toBe("https://www.googleapis.com/oauth2/v3/certs");
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const jwk = { ...(await exportJWK(publicKey)), kid: "key-1", alg: "RS256", use: "sig" };
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : String(input);
      return url === googleJwksUri ? Response.json({ keys: [jwk] }) : new Response("Not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const sign = (claims: Record<string, unknown>) => new SignJWT({ email: "Teacher@Example.test", email_verified: true, name: "Teacher", nonce: "nonce-1", ...claims })
      .setProtectedHeader({ alg: "RS256", kid: "key-1" }).setIssuer(config.issuer).setAudience(config.clientId).setSubject("google-subject").setIssuedAt().setExpirationTime("5m").sign(privateKey);

    await expect(verifyGoogleIdToken(await sign({}), config)).resolves.toEqual({ subject: "google-subject", email: "teacher@example.test", displayName: "Teacher" });
    expect(fetchMock.mock.calls.some(([input]) => String(input instanceof Request ? input.url : input) === googleJwksUri)).toBe(true);
    await expect(verifyGoogleIdToken(await sign({ nonce: "other" }), config)).rejects.toThrow("INVALID_GOOGLE_NONCE");
    await expect(verifyGoogleIdToken(await sign({ email_verified: false }), config)).rejects.toThrow("INVALID_GOOGLE_IDENTITY");
    await expect(verifyGoogleIdToken(await sign({}), { ...config, clientId: "another-client" })).rejects.toThrow();
  });
});
