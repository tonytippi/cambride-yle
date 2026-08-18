import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("security-header policy", () => {
  it("applies HTTPS-ready security headers to every route", async () => {
    const rules = await nextConfig.headers?.();
    const headers = rules?.[0]?.headers ?? [];
    expect(rules?.[0]?.source).toBe("/(.*)");
    expect(headers).toEqual(expect.arrayContaining([
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" }
    ]));
  });
});
