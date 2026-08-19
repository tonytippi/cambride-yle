import { describe, expect, it } from "vitest";
import { codeChallenge, oauthCookieName, safeEqual } from "@/features/identity/infrastructure/oauth-state";
import { localSignInSchema } from "@/features/identity/domain/contracts";

describe("OAuth transient state", () => {
  it("uses an S256 PKCE challenge and state-scoped cookies for concurrent flows", () => {
    expect(codeChallenge("verifier")).toBe("iMnq5o6zALKXGivsnlom_0F5_WYda32GHkxlV7mq7hQ");
    expect(oauthCookieName("one")).not.toBe(oauthCookieName("two"));
  });
  it("rejects mismatched state without relying on ordinary string equality", () => { expect(safeEqual("same", "same")).toBe(true); expect(safeEqual("same", "other")).toBe(false); expect(safeEqual("same", "longer")).toBe(false); });
  it("trims email whitespace before validating and canonicalising", () => expect(localSignInSchema.parse({ email: "  ADMIN@EXAMPLE.TEST ", password: "password" }).email).toBe("admin@example.test"));
});
