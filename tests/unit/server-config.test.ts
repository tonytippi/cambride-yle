import { describe, expect, it } from "vitest";
import { parseServerConfig } from "@/shared/config/server";

describe("server configuration", () => {
  it("accepts a PostgreSQL database URL", () => expect(parseServerConfig({ DATABASE_URL: "postgres://localhost:5432/app" }).DATABASE_URL).toContain("postgres"));
  it("accepts postgresql URLs but rejects non-PostgreSQL schemes", () => {
    expect(parseServerConfig({ DATABASE_URL: "postgresql://localhost:5432/app" }).DATABASE_URL).toContain("postgresql");
    expect(() => parseServerConfig({ DATABASE_URL: "postgresqlx://localhost:5432/app" })).toThrow("DATABASE_URL");
  });
  it("names invalid keys without exposing supplied values", () => {
    expect(() => parseServerConfig({ DATABASE_URL: "secret-value" })).toThrow("DATABASE_URL");
    expect(() => parseServerConfig({ DATABASE_URL: "secret-value" })).not.toThrow("secret-value");
  });
});
