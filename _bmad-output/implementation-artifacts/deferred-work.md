- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-manage-centre-accounts-and-roles.md`
  summary: Repair the pre-existing content lifecycle migration trigger so the full test suite can pass.
  evidence: `npm test` fails only at `tests/integration/migration-baseline.test.ts:336`, expecting `CONTENT_DRAFT_HISTORY_IMMUTABLE` but receiving `record "new" has no field "status"`.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-manage-centre-accounts-and-roles.md`
  summary: Add a PostgreSQL-backed retained-session role-change integration test after the migration baseline is repaired.
  evidence: Focused role tests verify the transaction contract and no session operation, but cannot run the real account/session lookup path while the migration baseline test database is failing.
- source_spec: `_bmad-output/implementation-artifacts/spec-5-1-set-up-a-supervised-first-practice-session.md`
  summary: Repair the pre-existing content lifecycle migration trigger so the full test suite can pass.
  evidence: `npm test` fails only at `tests/integration/migration-baseline.test.ts:336`, expecting `CONTENT_DRAFT_HISTORY_IMMUTABLE` but receiving `record "new" has no field "status"`; Story 5.1 changes no migrations or content lifecycle code.
 - source_spec: none
   summary: Implement the independent practice-set draft, review, approval, publication, and retirement lifecycle with audit evidence.
   evidence: Split from Epic 2 retrospective remediation because it is independently shippable after the prerequisite content correctness fixes.
 - source_spec: none
   summary: Correct readiness proof grouping by topic/task type and vocabulary/grammar target categorisation.
   evidence: Split from Epic 2 retrospective remediation because readiness projection can be reviewed independently of content publication correctness.
 - source_spec: none
   summary: Add database-backed staff-publication-to-learner submission and retirement-preservation integration coverage.
   evidence: Split from Epic 2 retrospective remediation because the coverage depends on the prerequisite content correctness fixes and is independently reviewable.
 - source_spec: none
   summary: Split content application and repository concerns by lifecycle use case after functional remediation.
   evidence: Split from Epic 2 retrospective remediation because maintainability refactoring should follow the correctness fixes it is intended to protect.
- source_spec: none
  summary: Partition content-readiness proof by published topic and task type, including correct vocabulary and grammar target categorisation.
  evidence: Split from the Epic 2 retrospective action items because it is independently shippable from the practice-set content lifecycle.
- source_spec: none
  summary: Add database-backed integration coverage from staff publication through learner selection and submission, preserving evidence after retirement.
  evidence: Split from the Epic 2 retrospective action items because it can be reviewed and merged independently after lifecycle behaviour is established.
- source_spec: none
  summary: Separate content application and repository concerns by lifecycle use case after the blocking lifecycle fixes are complete.
  evidence: Split from the Epic 2 retrospective action items because it is a follow-up internal refactor rather than required lifecycle behaviour.
