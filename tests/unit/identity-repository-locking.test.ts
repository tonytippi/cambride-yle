import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ execute: vi.fn(), update: vi.fn(), insert: vi.fn() }));
vi.mock("@/infrastructure/database/client", () => ({ database: {} }));

import { createSession, deactivateAccount } from "@/features/identity/infrastructure/repositories";

const adminId = "018f0000-0000-7000-8000-000000000001";
const learnerId = "018f0000-0000-7000-8000-000000000002";
const statementText = (statement: { queryChunks: Array<{ value?: string[] }> }) => statement.queryChunks.flatMap((chunk) => chunk.value ?? []).join("");

describe("identity repository locking", () => {
  beforeEach(() => vi.clearAllMocks());

  it("locks the account while checking active status before creating a session", async () => {
    dependencies.execute.mockResolvedValueOnce([{ id: "session" }]);
    await createSession(learnerId, { execute: dependencies.execute } as never);
    expect(statementText(dependencies.execute.mock.calls[0][0])).toContain("FOR UPDATE");
  });

  it("locks active admins in a stable order before locking the target account", async () => {
    dependencies.execute.mockResolvedValueOnce([{ id: adminId }]).mockResolvedValueOnce([{ id: learnerId, email: "learner@example.test", role: "learner", status: "active" }]);
    const tx = { execute: dependencies.execute, update: dependencies.update, insert: dependencies.insert } as never;
    dependencies.update.mockReturnValue({ set: () => ({ where: vi.fn().mockResolvedValue(undefined) }) });
    dependencies.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    await deactivateAccount(learnerId, adminId, "learner@example.test", tx);
    const statements = dependencies.execute.mock.calls.map(([statement]) => statementText(statement));
    expect(statements[0]).toContain("ORDER BY id FOR UPDATE");
    expect(statements[1]).toContain("WHERE id = ");
  });
});
