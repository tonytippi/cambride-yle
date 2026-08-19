import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  isDatabaseHealthy: vi.fn(),
  logEvent: vi.fn()
}));

vi.mock("@/infrastructure/database/health", () => ({ isDatabaseHealthy: dependencies.isDatabaseHealthy }));
vi.mock("@/shared/logging/logger", () => ({ logEvent: dependencies.logEvent }));

import { GET, healthResponse } from "@/app/api/health/route";

describe("health route contract", () => {
  beforeEach(() => vi.clearAllMocks());
  it("reports a healthy dependency with no-store and request headers", async () => {
    const response = healthResponse(true, "request-1");
    expect(response.headers.get("x-request-id")).toBe("request-1");
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toEqual({ data: { status: "ok" } });
  });

  it("reports an unavailable dependency without database internals", async () => {
    const response = healthResponse(false, "request-1");
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: { code: "DEPENDENCY_UNAVAILABLE", message: "Service temporarily unavailable." } });
  });

  it("invokes its dependency, preserves valid request IDs, and logs success", async () => {
    dependencies.isDatabaseHealthy.mockResolvedValue(true);
    const response = await GET(new Request("http://localhost/api/health", { headers: { "x-request-id": "123e4567-e89b-42d3-a456-426614174000" } }));
    expect(dependencies.isDatabaseHealthy).toHaveBeenCalledOnce();
    expect(response.headers.get("x-request-id")).toBe("123e4567-e89b-42d3-a456-426614174000");
    expect(dependencies.logEvent).toHaveBeenCalledWith({ requestId: "123e4567-e89b-42d3-a456-426614174000", feature: "health", action: "check", outcome: "success" });
  });

  it("replaces invalid request IDs and logs dependency failure", async () => {
    dependencies.isDatabaseHealthy.mockResolvedValue(false);
    const response = await GET(new Request("http://localhost/api/health", { headers: { "x-request-id": "untrusted-value" } }));
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/i);
    expect(dependencies.logEvent).toHaveBeenCalledWith(expect.objectContaining({ feature: "health", action: "check", outcome: "failure", errorCode: "DEPENDENCY_UNAVAILABLE" }));
  });
});
