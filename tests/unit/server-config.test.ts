import { describe, expect, it } from "vitest";
import { parseServerConfig } from "@/shared/config/server";

describe("server configuration", () => {
  const valid = { DATABASE_URL: "postgres://localhost:5432/app", GOOGLE_OIDC_CLIENT_ID: "client", GOOGLE_OIDC_CLIENT_SECRET: "secret", GOOGLE_OIDC_ISSUER: "https://accounts.google.com", GOOGLE_OIDC_REDIRECT_URI: "http://localhost:3000/api/auth/google/callback", ADMIN_EMAILS: "Admin@Example.Test,other@example.test" };
  it("accepts server-only identity configuration and normalises admin emails", () => {
    expect(parseServerConfig(valid).DATABASE_URL).toContain("postgres");
    expect(parseServerConfig(valid).ADMIN_EMAILS).toEqual(["admin@example.test", "other@example.test"]);
  });
  it("accepts postgresql URLs but rejects non-PostgreSQL schemes", () => {
    expect(parseServerConfig({ ...valid, DATABASE_URL: "postgresql://localhost:5432/app" }).DATABASE_URL).toContain("postgresql");
    expect(() => parseServerConfig({ ...valid, DATABASE_URL: "postgresqlx://localhost:5432/app" })).toThrow("DATABASE_URL");
  });
  it("names invalid keys without exposing supplied values", () => {
    expect(() => parseServerConfig({ ...valid, DATABASE_URL: "secret-value" })).toThrow("DATABASE_URL");
    expect(() => parseServerConfig({ ...valid, DATABASE_URL: "secret-value" })).not.toThrow("secret-value");
  });
  it("keeps AI credentials optional while the provider gate is open", () => {
    const config = parseServerConfig(valid);
    expect(config.AI_DRAFT_PROVIDER_GATE_CLOSED).toBe(false);
    expect(config.AI_TEXT_API_KEY).toBeUndefined();
    expect(config).not.toHaveProperty("NEXT_PUBLIC_AI_TEXT_API_KEY");
  });
});
