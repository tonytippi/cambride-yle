import { describe, expect, it } from "vitest";
import { failure, success } from "@/shared/http/response";

describe("HTTP response contract", () => {
  it("returns a non-cacheable success envelope", async () => {
    const response = success({ status: "ok" }, 200, "request-1");
    await expect(response.json()).resolves.toEqual({ data: { status: "ok" } });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("returns a stable dependency failure without internals", async () => {
    const response = failure("DEPENDENCY_UNAVAILABLE", "Service temporarily unavailable.", 503);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: { code: "DEPENDENCY_UNAVAILABLE", message: "Service temporarily unavailable." } });
  });
});
