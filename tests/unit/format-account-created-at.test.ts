import { describe, expect, it } from "vitest";
import { formatAccountCreatedAt } from "@/features/identity/ui/format-account-created-at";

describe("formatAccountCreatedAt", () => {
  it("formats the persisted creation date in British English without host timezone drift", () => {
    expect(formatAccountCreatedAt(new Date("2026-08-22T00:30:00Z"))).toBe("22/08/2026");
  });
});
