import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ execute: vi.fn(), select: vi.fn(), update: vi.fn(), insert: vi.fn(), sessions: vi.fn() }));
vi.mock("@/infrastructure/database/client", () => ({ database: {} }));

import { changeAccountRole, createSession, deactivateAccount, getCentreAccountDetail, listCentreAccounts } from "@/features/identity/infrastructure/repositories";

const adminId = "018f0000-0000-7000-8000-000000000001";
const learnerId = "018f0000-0000-7000-8000-000000000002";
const statementText = (statement: { queryChunks: Array<{ value?: string[] }> }) => statement.queryChunks.flatMap((chunk) => chunk.value ?? []).join("");

describe("identity repository locking", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns persisted creation and lifecycle values in the centre-account list", async () => {
    const createdAt = new Date("2026-08-22T09:00:00Z");
    const orderBy = vi.fn().mockResolvedValue([{ id: learnerId, createdAt, status: "active" }]);
    const from = vi.fn(() => ({ orderBy }));
    const select = vi.fn(() => ({ from }));
    const accounts = await listCentreAccounts({ select } as never);
    expect(accounts).toEqual([{ id: learnerId, createdAt, status: "active" }]);
    expect(select).toHaveBeenCalledWith(expect.objectContaining({ createdAt: expect.anything(), status: expect.anything(), deactivatedAt: expect.anything() }));
  });

  it("returns persisted creation and lifecycle values in centre-account detail", async () => {
    const createdAt = new Date("2026-08-22T09:00:00Z");
    const detailLimit = vi.fn().mockResolvedValue([{ id: learnerId, createdAt, status: "deactivated", deactivatedAt: createdAt, deactivatedBy: adminId }]);
    const detailWhere = vi.fn(() => ({ limit: detailLimit }));
    const historyOrderBy = vi.fn().mockResolvedValue([]);
    const historyWhere = vi.fn(() => ({ orderBy: historyOrderBy }));
    const from = vi.fn().mockReturnValueOnce({ where: detailWhere }).mockReturnValueOnce({ where: historyWhere });
    const select = vi.fn(() => ({ from }));
    await expect(getCentreAccountDetail(learnerId, { select } as never)).resolves.toMatchObject({ account: { id: learnerId, createdAt, status: "deactivated", deactivatedAt: createdAt } });
    expect(select.mock.calls.at(0)).toEqual([expect.objectContaining({ createdAt: expect.anything(), status: expect.anything(), deactivatedAt: expect.anything(), deactivatedBy: expect.anything() })]);
  });

  it("locks the account while checking active status before creating a session", async () => {
    dependencies.execute.mockResolvedValueOnce([{ id: "session" }]);
    await createSession(learnerId, { execute: dependencies.execute } as never);
    expect(statementText(dependencies.execute.mock.calls[0][0])).toContain("FOR UPDATE");
  });

  it("locks active admins in a stable order before locking the target account", async () => {
    dependencies.execute.mockResolvedValueOnce([{ id: adminId }]).mockResolvedValueOnce([{ id: learnerId, email: "learner@example.test", role: "learner", status: "active" }]);
    const tx = { execute: dependencies.execute, update: dependencies.update, insert: dependencies.insert, sessions: dependencies.sessions } as never;
    dependencies.update.mockReturnValue({ set: () => ({ where: vi.fn().mockResolvedValue(undefined) }) });
    dependencies.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    await deactivateAccount(learnerId, adminId, "learner@example.test", tx);
    const statements = dependencies.execute.mock.calls.map(([statement]) => statementText(statement));
    expect(statements[0]).toContain("ORDER BY id FOR UPDATE");
    expect(statements[1]).toContain("WHERE id = ");
  });

  it("records an audit event after a role update without touching sessions", async () => {
    dependencies.execute.mockResolvedValueOnce([{ id: adminId }]).mockResolvedValueOnce([{ id: learnerId, role: "learner", status: "active" }]);
    const where = vi.fn().mockResolvedValue(undefined);
    dependencies.update.mockReturnValue({ set: () => ({ where }) });
    const values = vi.fn().mockResolvedValue(undefined);
    dependencies.insert.mockReturnValue({ values });
    const tx = { execute: dependencies.execute, update: dependencies.update, insert: dependencies.insert } as never;
    await changeAccountRole(learnerId, "teacher", adminId, tx);
    const statements = dependencies.execute.mock.calls.map(([statement]) => statementText(statement));
    expect(statements[0]).toContain("ORDER BY id FOR UPDATE");
    expect(statements[1]).toContain("WHERE id = ");
    expect(dependencies.update).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ actorId: adminId, action: "ACCOUNT_ROLE_CHANGED", targetId: learnerId }));
    expect(dependencies.sessions).not.toHaveBeenCalled();
  });

  it("leaves the role and audit unchanged when downgrading the final active admin", async () => {
    dependencies.execute.mockResolvedValueOnce([{ id: adminId }]).mockResolvedValueOnce([{ id: adminId, role: "admin", status: "active" }]);
    const tx = { execute: dependencies.execute, update: dependencies.update, insert: dependencies.insert } as never;
    await expect(changeAccountRole(adminId, "teacher", adminId, tx)).rejects.toThrow("LAST_ACTIVE_ADMIN");
    expect(dependencies.update).not.toHaveBeenCalled();
    expect(dependencies.insert).not.toHaveBeenCalled();
  });

  it("rejects role changes for deactivated accounts before writing an audit event", async () => {
    dependencies.execute.mockResolvedValueOnce([{ id: adminId }]).mockResolvedValueOnce([{ id: learnerId, role: "learner", status: "deactivated" }]);
    const tx = { execute: dependencies.execute, update: dependencies.update, insert: dependencies.insert, sessions: dependencies.sessions } as never;
    await expect(changeAccountRole(learnerId, "teacher", adminId, tx)).rejects.toThrow("ACCOUNT_NOT_ACTIVE");
    expect(dependencies.update).not.toHaveBeenCalled();
    expect(dependencies.insert).not.toHaveBeenCalled();
    expect(dependencies.sessions).not.toHaveBeenCalled();
  });

  it("does not write an update or audit event for an unchanged role", async () => {
    dependencies.execute.mockResolvedValueOnce([{ id: adminId }]).mockResolvedValueOnce([{ id: learnerId, role: "teacher", status: "active" }]);
    const tx = { execute: dependencies.execute, update: dependencies.update, insert: dependencies.insert, sessions: dependencies.sessions } as never;
    await expect(changeAccountRole(learnerId, "teacher", adminId, tx)).resolves.toBeUndefined();
    expect(dependencies.update).not.toHaveBeenCalled();
    expect(dependencies.insert).not.toHaveBeenCalled();
    expect(dependencies.sessions).not.toHaveBeenCalled();
  });
});
