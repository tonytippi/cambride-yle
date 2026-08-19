import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/features/identity/infrastructure/password";
import { uuidv7 } from "@/features/identity/infrastructure/uuid";
import { sessionCookieOptions } from "@/features/identity/ui/session";
import { createSessionCleanupToken, verifiesSessionCleanupToken } from "@/features/identity/infrastructure/session-cleanup";
import { noStoreHeaders } from "@/shared/http/response";

describe("identity primitives", () => {
  it("uses Argon2id password hashes", async () => { const hash = await hashPassword("a secure temporary password"); expect(hash).toContain("$argon2id$"); expect(await verifyPassword(hash, "a secure temporary password")).toBe(true); expect(await verifyPassword(hash, "wrong password")).toBe(false); });
  it("creates UUIDv7 opaque identifiers", () => expect(uuidv7()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/));
  it("sets secure opaque-session cookie flags", () => expect(sessionCookieOptions).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" }));
  it("marks credential-bearing HTTP responses as non-cacheable", () => expect(noStoreHeaders["Cache-Control"]).toBe("no-store, max-age=0"));
  it("binds session cleanup tokens to the invalid cookie for one short-lived redirect", () => { const token = createSessionCleanupToken("invalid-session", 1_000); expect(verifiesSessionCleanupToken(token, "invalid-session", 1_001)).toBe(true); expect(verifiesSessionCleanupToken(token, "another-session", 1_001)).toBe(false); expect(verifiesSessionCleanupToken(token, "invalid-session", 61_001)).toBe(false); });
});
