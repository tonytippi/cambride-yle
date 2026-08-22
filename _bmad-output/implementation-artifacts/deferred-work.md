- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-manage-centre-accounts-and-roles.md`
  summary: Repair the pre-existing content lifecycle migration trigger so the full test suite can pass.
  evidence: `npm test` fails only at `tests/integration/migration-baseline.test.ts:336`, expecting `CONTENT_DRAFT_HISTORY_IMMUTABLE` but receiving `record "new" has no field "status"`.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-manage-centre-accounts-and-roles.md`
  summary: Add a PostgreSQL-backed retained-session role-change integration test after the migration baseline is repaired.
  evidence: Focused role tests verify the transaction contract and no session operation, but cannot run the real account/session lookup path while the migration baseline test database is failing.
- source_spec: `_bmad-output/implementation-artifacts/spec-5-1-set-up-a-supervised-first-practice-session.md`
  summary: Repair the pre-existing content lifecycle migration trigger so the full test suite can pass.
  evidence: `npm test` fails only at `tests/integration/migration-baseline.test.ts:336`, expecting `CONTENT_DRAFT_HISTORY_IMMUTABLE` but receiving `record "new" has no field "status"`; Story 5.1 changes no migrations or content lifecycle code.
