import { describe, expect, it, vi } from "vitest";
import { logEvent, redact } from "@/shared/logging/logger";

describe("structured logging redaction", () => {
  it("retains operational fields and redacts nested protected values", () => {
    expect(redact({ requestId: "request-1", actorId: "actor-1", password: "hidden", apiKey: "hidden", nested: { learnerResponse: "hidden", databaseUrl: "hidden" } })).toEqual({ requestId: "request-1", actorId: "actor-1", password: "[REDACTED]", apiKey: "[REDACTED]", nested: { learnerResponse: "[REDACTED]", databaseUrl: "[REDACTED]" } });
  });
  it("omits arbitrary metadata from structured events", () => {
    const circular: Record<string, unknown> = { count: 1n, cookie: "hidden" };
    circular.self = circular;
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logEvent({ requestId: "request-1", feature: "health", action: "check", outcome: "success", metadata: circular });
    expect(info).toHaveBeenCalledWith('{"requestId":"request-1","feature":"health","action":"check","outcome":"success"}');
    info.mockRestore();
  });
});
