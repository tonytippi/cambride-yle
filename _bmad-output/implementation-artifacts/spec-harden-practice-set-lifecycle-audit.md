---
title: 'Harden Practice-Set Lifecycle Audit Evidence'
type: 'feature'
created: '2026-08-22'
status: 'done'
baseline_commit: '5a4b370'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
warnings: []
deferred: []
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Practice sets now have an independent draft-to-retired lifecycle, but the successful database-backed lifecycle regression does not demonstrate the required audit and review evidence. A future change could preserve learner selection behaviour while silently omitting evidence needed to establish who performed a lifecycle transition.

**Approach:** Extend the existing staff-publication-to-learner integration path to assert the complete immutable review and audit trail for a successfully created, submitted, independently approved, published, and retired practice set, while retaining the retirement guarantee for existing attempts.

## Boundaries & Constraints

**Always:** Preserve the exact `draft -> in_review -> approved -> published -> retired` lifecycle, require only `academic_lead` or admin through existing application authorisation, and prove review/audit records contain the appropriate actors and lifecycle actions in transition order. Use the existing transactional application use cases and immutable database tables; retain published snapshot and attempt evidence unchanged. A retired set must remain unavailable for a new learner start while an existing open attempt can continue and submit. Keep all P0 engine, curriculum, media, scoring, and public-claim behaviour unchanged.

**Ask First:** Any change to lifecycle states, actor-role policy, audit schema shape, immutable database guards, or retirement semantics.

**Never:** Do not add a rejection/return-to-draft flow, direct SQL lifecycle bypass, new learner/staff route, migration, change to published snapshots, or a synthetic audit mechanism. Do not modify imported curriculum evidence or close product gates.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Complete staff lifecycle | Different authorised staff create, submit, approve, publish, then retire a valid draft | Review records show submitted then approved with the respective actor IDs; immutable audit rows show created, submitted, approved, published, retired in that order | Existing application failures remain unchanged |
| Retired set with existing attempt | Learner starts the published set before staff retire it | New starts are rejected; the existing attempt submits using its immutable snapshot; audit history remains intact | Existing `PRACTICE_SET_UNAVAILABLE` semantics for new starts |
| Failed publish | Validly approved set becomes invalid before publication revalidation | Status remains approved and no published audit row or snapshots exist | Existing validation error and transaction rollback semantics |

</frozen-after-approval>

## Code Map

- `src/features/content/application/content.ts:737-961` -- authoritative create, review, approval, publication, retirement use cases; retain their transaction and audit ordering.
- `src/features/content/infrastructure/repositories.ts:416-607` -- existing review/audit writes, locks, transition persistence, and immutable snapshot materialisation; do not duplicate writes in tests.
- `db/schema/content.ts:220-299` -- authoritative lifecycle, audit, review, composition and snapshot table definitions; read-only for this scope.
- `db/migrations/0029_practice_set_lifecycle_hardening.sql:3-42` -- migrated-database lifecycle constraints and publication guard; read-only for this scope.
- `src/features/practice/infrastructure/repositories.ts:47-97` -- published-only discovery and immutable snapshot attempt behaviour used by the retirement assertion.
- `tests/integration/published-practice-snapshot.test.ts:26-127` -- database-backed complete lifecycle and retirement-preservation regression to extend rather than replace.
- `tests/unit/content-application.test.ts:926-1037` -- existing lifecycle failure/unit coverage; do not duplicate database integration assertions here.
- `_bmad-output/implementation-artifacts/epic-2-context.md:17-37` -- lifecycle, audit, immutability and retirement invariants.

## Tasks & Acceptance

**Execution:**
- [x] `tests/integration/published-practice-snapshot.test.ts` -- extend the successful lifecycle fixture and assertions to retrieve the persisted review/audit rows and verify their actor IDs, actions and chronological transition order -- proves the application transaction persists the declared auditable lifecycle rather than only observable learner availability.
- [x] `tests/integration/published-practice-snapshot.test.ts` -- retain and explicitly connect the retirement assertion to the verified audit history after the existing attempt submits -- protects the combined publication, retirement and immutable-evidence contract without a second divergent fixture.

**Acceptance Criteria:**
- Given distinct authorised staff successfully create, submit, approve, publish and retire a valid practice-set draft, when the database-backed integration test reads its review and audit evidence, then it finds submitted and approved review records with the appropriate actors and exactly the ordered lifecycle audit actions `PRACTICE_SET_DRAFT_CREATED`, `PRACTICE_SET_SUBMITTED`, `PRACTICE_SET_APPROVED`, `PRACTICE_SET_PUBLISHED`, and `PRACTICE_SET_RETIRED`.
- Given the set is retired after a learner has started it, when a different learner starts it and the original learner submits the existing attempt, then the new start remains unavailable, submission succeeds from the immutable snapshot, and the previously asserted lifecycle evidence remains unchanged.
- Given publish-time revalidation fails, when the integration path inspects persistence, then the set stays approved with no snapshots or `PRACTICE_SET_PUBLISHED` audit evidence.

## Design Notes

The lifecycle and audit writes are already performed by the same application transactions. This scope adds no parallel audit enforcement or schema change: it makes the existing contract observable at the migrated PostgreSQL boundary. Query only the rows attached to the fixture's opaque practice-set ID and compare explicit fields rather than relying on global table order.

## Verification

**Commands:**
- `npm test -- tests/integration/published-practice-snapshot.test.ts` -- expected: complete lifecycle, audit evidence, publication rollback, and retirement-preservation regression passes against PostgreSQL.
- `npm run lint` -- expected: no ESLint errors.
- `npm run typecheck` -- expected: TypeScript completes without error.
- `npm test` -- expected: full suite passes; if a pre-existing unrelated failure remains, report its command output and isolation.

## Suggested Review Order

- The database-backed fixture now requires every lifecycle evidence table before exercising the workflow.
  [`published-practice-snapshot.test.ts:27`](../../tests/integration/published-practice-snapshot.test.ts#L27)

- The successful staff workflow verifies immutable review actors and pre-retirement audit transition order.
  [`published-practice-snapshot.test.ts:50`](../../tests/integration/published-practice-snapshot.test.ts#L50)

- Retirement preserves the original attempt while recording its final lifecycle event.
  [`published-practice-snapshot.test.ts:89`](../../tests/integration/published-practice-snapshot.test.ts#L89)

- Attempt submission leaves the verified practice-set audit history untouched.
  [`published-practice-snapshot.test.ts:98`](../../tests/integration/published-practice-snapshot.test.ts#L98)
