---
title: 'Harden Epic 5 first-practice E2E regressions'
type: 'feature'
created: '2026-08-22'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'f73635ca1a0a6770f86e4c199e3b3bea5b0c37cc'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-retro-08-22-2026.md'
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic 5 verifies that an admin can review evidence and deactivate a learner, but it only inspects persisted revocation fields. It also validates provision and practice-start contracts independently rather than proving the supervised first-practice journey from account creation to a persisted attempt.

**Approach:** Extend the database-backed browser suite with a replay of an already-issued learner credential after deactivation, and one composed admin-provisioning to learner-practice-start journey. Add only test harness support needed for an owned, ready essential-media asset; do not loosen production media, authentication or authorisation rules.

## Boundaries & Constraints

**Always:** Run against the disposable `*_e2e` PostgreSQL schema. Reuse the existing centre-account, sign-in, learner-selection, preparation and authoritative start routes. Prove the deactivated cookie cannot read a protected learner page or create a new attempt. Prove the provisioned user remains a normal active `learner`, and the started attempt is persisted with the selected immutable set/version and revision zero. Keep server-side essential-media readiness real by supplying an E2E-only HTTPS media origin that handles the server's `HEAD` and browser `GET` requests. Keep test media product-owned and non-sensitive.

**Ask First:** Stop for direction if making the browser suite pass requires weakening HTTPS media-origin validation, adding production-only bypasses, changing account/practice schema, or altering the existing immutable snapshot/start semantics.

**Never:** Do not add a prospective-learner account type, an admin on-behalf-of attempt API, a diagnostic/placement flow, public registration, a production media endpoint exception, or assertions that reveal correctness before submission. Do not make the fixture depend on an external network service.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Replay revoked credential | Browser context retains a learner cookie issued before named deactivation | Protected learner preparation redirects to sign-in; the start API returns `FORBIDDEN`; no additional attempt is stored | Assert protected learner content is absent and attempt counts remain unchanged |
| Supervised first practice | Admin creates a valid learner; learner signs in and chooses a published set with ready owned media | Existing preparation/start flow creates one open attempt for that learner and immutable set version | The test fails if lifecycle role/status, media readiness, route authentication or persistence contract regresses |
| Media readiness harness | Next server checks the E2E media origin and browser preloads its asset | HTTPS origin accepts signed server `HEAD` and browser `GET` without production configuration changes | Keep certificate/secret local to test harness and reject unrecognised media paths |

</frozen-after-approval>

## Code Map

- `tests/e2e/teacher-evidence.spec.ts` -- existing single-worker disposable database fixture, issued learner/admin cookies, migrations and deactivation journey; extend rather than create a competing schema-reset suite.
- `tests/e2e/foundation.spec.ts` -- current browser suite conventions; inspect only if shared browser/TLS configuration needs a reusable helper.
- `playwright.config.ts` -- web-server environment for the E2E Next process; supply only test media-origin/signing configuration and keep normal app startup.
- `src/app/api/practice/start/route.ts` -- uses `currentActor` and returns `403 FORBIDDEN` before start when a revoked cookie no longer resolves.
- `src/features/identity/infrastructure/repositories.ts` -- `getActorBySessionToken` excludes revoked sessions and inactive accounts; `deactivateAccount` revokes all active target sessions atomically.
- `src/app/sign-in/actions.ts` and `src/app/admin/actions.ts` -- existing browser actions for real learner authentication and admin account provision; reuse without new API.
- `src/app/learner/page.tsx`, `src/app/learner/practice/[setId]/page.tsx`, `src/features/practice/ui/preparation.tsx` -- normal selection, preload and Start controls to exercise in the composed journey.
- `src/features/practice/infrastructure/repositories.ts` and `src/features/practice/infrastructure/media-gateway.ts` -- authoritative transaction rechecks media readiness via signed `HEAD`; the test origin must meet this contract.
- `db/migrations/0015_publish_immutable_practice_set_schema.sql` -- practice set/item/media snapshot inserts must occur in the fixture transaction so immutable composition triggers allow them.

## Tasks & Acceptance

**Execution:**
- [x] `tests/e2e/teacher-evidence.spec.ts` -- seed one independently published, learner-visible set with an owned essential media association and add the two composed browser/API regression paths -- proves the Epic 5 boundaries without duplicating production logic.
- [x] `tests/e2e/*` test-only media harness and `playwright.config.ts` -- provide a local HTTPS origin and deterministic test signing configuration for the Next server and browser preload -- allows the actual readiness `HEAD`/`GET` contract to run without external infrastructure or production policy changes.
- [x] `tests/e2e/teacher-evidence.spec.ts` -- after named deactivation, replay the original learner cookie against learner preparation and `POST /api/practice/start`, then assert redirect/`FORBIDDEN`, absent protected content and unchanged attempt count -- covers session revocation at the UI and mutation boundaries.
- [x] `tests/e2e/teacher-evidence.spec.ts` -- provision through the admin UI, authenticate through sign-in, select/preload/start the published ready set, and verify the persisted open attempt -- covers the entire supervised first-practice composition.

**Acceptance Criteria:**
- Given an admin has deactivated a learner with an already-issued session, when that browser reuses the cookie on learner preparation or attempt start, then it cannot access learner content or create an attempt and retained submitted evidence remains unchanged.
- Given an admin creates an ordinary learner account, when that learner signs in and starts an existing published practice set with ready essential media, then the standard flow creates exactly one server-authoritative open attempt bound to that learner and immutable set version.
- Given the E2E suite supplies its required media, when production-like readiness checks execute, then both the server-side signed `HEAD` and browser preload use the local HTTPS test origin and no production security validation is relaxed.

## Design Notes

The existing teacher-evidence spec is the only suite that resets the E2E schema, so both cases belong there. A browser route interception cannot prove readiness because the server-side transaction itself sends the media `HEAD`; a narrowly scoped TLS test origin is required to exercise the same contract without an external dependency.

## Verification

**Commands:**
- `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/cambridgeyle_e2e npx playwright test tests/e2e/teacher-evidence.spec.ts --reporter=list` -- expected: existing evidence flows and both new lifecycle/composition paths pass.
- `npm run lint` -- expected: lint completes without errors.
- `npm run typecheck` -- expected: TypeScript completes without errors.
- `git diff --check` -- expected: no whitespace errors.

## Suggested Review Order

**Authentication And Lifecycle**

- Serialises the raw SQL session expiry for the postgres-js driver.
  [`repositories.ts:20`](../../src/features/identity/infrastructure/repositories.ts#L20)

- Replays the issued learner credential after named deactivation across read and mutation boundaries.
  [`teacher-evidence.spec.ts:132`](../../tests/e2e/teacher-evidence.spec.ts#L132)

**Immutable Media Composition**

- Repairs the trigger for already-migrated databases without rewriting migration history.
  [`0025_practice_set_composition_trigger_fix.sql:1`](../../db/migrations/0025_practice_set_composition_trigger_fix.sql#L1)

- Registers the corrective migration in deterministic order.
  [`_journal.json:174`](../../db/migrations/meta/_journal.json#L174)

**End-To-End Harness**

- Supervises the local TLS media origin and waits before launching Next.
  [`start-server.mjs:1`](../../tests/e2e/start-server.mjs#L1)

- Configures only test-local media signing and trust for the real readiness checks.
  [`playwright.config.ts:13`](../../playwright.config.ts#L13)

- Exercises provision, real sign-in, preload, authoritative start, and player rendering.
  [`teacher-evidence.spec.ts:178`](../../tests/e2e/teacher-evidence.spec.ts#L178)
