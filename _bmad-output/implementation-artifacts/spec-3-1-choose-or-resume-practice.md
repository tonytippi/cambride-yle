---
title: 'Story 3.1: Choose Or Resume Practice'
type: 'feature'
created: '2026-08-20'
status: 'done'
baseline_revision: '882c881908e0ad849e5a18649b433b221b400cc8'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-3-context.md'
warnings: []
deferred:
  - summary: >-
      Existing published practice sets receive the generic migrated title "Practice set" until an academic lead republishes or supplies an approved replacement title.
    evidence: |-
      The immutable snapshot migration cannot derive a meaningful learner-facing title from existing set records, which did not store one before Story 3.1.
    location: >-
      db/migrations/0017_learner_practice_selection.sql:1
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Learner home is currently a protected placeholder. Published practice sets have no learner-facing title or learner attempt/evidence records, so learners cannot choose, resume, review, or receive a transparent personal recommendation.

**Approach:** Add immutable set titles and a small practice persistence model, expose a learner-authorised home query through the new `practice` feature, and render a mobile-first learner home that keeps manual browsing available beside transparent recommendations.

## Boundaries & Constraints

**Always:** Query published sets only for manual selection; derive each action deterministically as `Resume`, then `Review`, otherwise `Start`; use only the signed-in learner's latest submitted evidence per set from the preceding 30 days; rank `needs practice`, then `building`, then remaining eligible published sets; persist recommendation version and displayed set IDs. Keep all correctness, answers, score language, and official-result claims out of learner home. Preserve immutable set/attempt snapshots and use British-English accessible copy.

**Block If:** Existing migration/schema rules cannot safely retain immutable published set titles or learner attempt/evidence records without changing a published snapshot.

**Never:** Expose staff content queries to learners; create an attempt in Story 3.1; select retired sets; use another learner's data; add engines beyond the five P0 engines; treat a recommendation as a restriction on manual selection.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Browse published content | Signed-in learner and published sets | Topic and task-type filters display set title, paper/part, duration and action | Retired sets are omitted |
| Resume work | Learner owns an open attempt | The matching set has `Resume` and its last saved time | Attempts for another learner are invisible |
| Review completed work | No open attempt; learner has submitted attempt | The matching set has `Review` | An open attempt takes precedence |
| Personal recommendation | Latest submitted own evidence within 30 days | Matching sets rank `needs practice`, then `building`, then other published sets; shown IDs/version are recorded | Fewer than three assessable outcomes gives neutral state rather than an unsupported claim |
| No usable history | No eligible recent own evidence | A neutral recommendation state is displayed and browsing remains available | No audit recommendation row is created |

</intent-contract>

## Code Map

- `db/schema/content.ts:219-309` -- immutable published practice-set snapshot tables; add an immutable learner-facing title column only at creation.
- `db/schema/practice.ts` -- new attempt, outcome/evidence, and recommendation audit tables for the learner practice feature.
- `db/schema/index.ts` -- exports the new practice schema.
- `db/migrations/0017_learner_practice_selection.sql` -- migrates titles and practice lifecycle/audit records without weakening existing immutable triggers.
- `src/features/content/domain/contracts.ts:60-65` -- extend compose input with a validated learner-facing title.
- `src/features/content/application/content.ts:683-710` and `src/features/content/infrastructure/repositories.ts:454-529` -- pass title into immutable set creation.
- `src/features/content/ui/draft-forms.tsx:429-459` and `src/app/academic-lead/actions.ts:263` -- collect title while publishing a set.
- `src/features/practice/domain/contracts.ts` -- typed learner-home data and evidence labels.
- `src/features/practice/infrastructure/repositories.ts` -- published-only, learner-scoped listing plus recommendation audit insert.
- `src/features/practice/application/practice.ts` -- authorises learner home reads and applies deterministic recommendation/action derivation.
- `src/features/practice/ui/learner-home.tsx` -- learner-facing home surface and filter controls.
- `src/app/learner/page.tsx` -- retains `requireRole(["learner"])`, calls the practice application boundary, and renders the learner home.
- `tests/unit/practice-application.test.ts` -- recommendation, ownership, state, action precedence, and audit tests using repository mocks.
- `tests/integration/protected-routing.test.ts:10-26` -- existing protected-route contract retained.

## Tasks & Acceptance

**Execution:**
- `db/schema/content.ts`, `db/schema/practice.ts`, `db/schema/index.ts`, `db/migrations/0017_learner_practice_selection.sql` -- add immutable published title plus the minimum learner attempt, outcome, and recommendation audit storage -- supports selection/recovery/recommendation without cross-account leakage.
- `src/features/content/domain/contracts.ts`, `src/features/content/application/content.ts`, `src/features/content/infrastructure/repositories.ts`, `src/features/content/ui/draft-forms.tsx`, `src/app/academic-lead/actions.ts` -- require and persist a concise practice-set title when publishing -- every learner card has snapshot-owned metadata.
- `src/features/practice/domain/contracts.ts`, `src/features/practice/infrastructure/repositories.ts`, `src/features/practice/application/practice.ts` -- implement learner-authorised published-set query, action precedence, 30-day latest-attempt recommendation ranking, neutral insufficient-history handling, and recommendation audit persistence -- places data access behind the practice application boundary.
- `src/features/practice/ui/learner-home.tsx`, `src/app/learner/page.tsx`, `src/app/globals.css` -- replace the placeholder with accessible topic/task-type browsing, recommendation, resumable state, and action links to future flows -- makes manual selection always available on mobile and desktop.
- `tests/unit/practice-application.test.ts`, `tests/unit/content-application.test.ts` -- cover title validation/persistence, published filtering, ownership, action precedence, latest-30-day evidence selection, outcome thresholds/ranking, audit recording, and empty history -- locks down the story's edge cases.

**Acceptance Criteria:**
- Given a signed-in learner, when they open learner home, then they can browse published sets by topic and task type with immutable title, paper/part, estimated time, and exactly one appropriate `Start`, `Resume`, or `Review` action.
- Given a learner has an open attempt or a submitted attempt for a set, when learner home loads, then their open attempt is offered as `Resume` with last saved time and takes precedence over `Review`; no other learner's attempt changes the action.
- Given published content and the learner's own submitted evidence in the prior 30 days, when home calculates recommendations, then it uses only the latest submitted attempt per set, places `needs practice` before `building` before other eligible sets, explains only a practice area, and records the recommendation version and displayed set IDs.
- Given insufficient assessable personal evidence or no eligible recommendation, when home loads, then it shows a neutral recommendation state and never blocks topic/task-type browsing.
- Given retired content or a request to create/select an attempt, when Story 3.1 executes, then retired content is absent and the home only links to subsequent flows without creating an attempt.

## Design Notes

Action precedence is intentionally computed in the application layer, not inferred from UI state: an open attempt is the recovery promise and must outweigh completed history. Recommendation audit records capture only an actual displayed recommendation; the neutral state is not represented as a recommendation claim.

## Verification

**Commands:**
- `npm test -- --run tests/unit/practice-application.test.ts tests/unit/content-application.test.ts` -- expected: learner selection/recommendation and content publication tests pass.
- `npm run typecheck` -- expected: TypeScript has no errors.
- `npm run lint` -- expected: ESLint has no errors.
- `npm run build` -- expected: production build completes.

## Review Triage Log

### 2026-08-20 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 6 (high 2, medium 3, low 1)
- defer: 1 (medium 1)
- reject: 12
- addressed_findings:
  - `[high] [patch]` Restricted learner-home filtering to topic/task type, so a notice query cannot fail strict validation.
  - `[high] [patch]` Registered the migration and added journal/integrity baseline assertions.
  - `[medium] [patch]` Kept all filter choices and selected values after filtering, and decoupled manual browse filters from recommendation calculation and audit.
  - `[medium] [patch]` Presented the computed practice area and ordered recommended set titles separately from manual browsing.
  - `[medium] [patch]` Added deterministic submitted-attempt ordering and database constraints for title, attempt timing, evidence ownership, and submitted-attempt evidence writes.
  - `[low] [patch]` Added application coverage for filters, recommendation separation, and strict filter isolation.

## Auto Run Result

Status: done

Summary: Added the learner practice-selection foundation: immutable learner-facing set titles, learner-scoped attempt/evidence/recommendation records, a published-only learner home query, recommendation audit, and an accessible browse/recommendation surface.

Files changed:
- `db/schema/content.ts`, `db/schema/practice.ts`, `db/schema/index.ts` -- learner-practice persistence model and integrity constraints.
- `db/migrations/0017_learner_practice_selection.sql`, `db/migrations/meta/_journal.json` -- registered database migration and immutable/lifecycle guards.
- `src/features/content/*`, `src/app/academic-lead/actions.ts` -- collect and snapshot learner-facing titles at publication.
- `src/features/practice/*`, `src/app/learner/page.tsx`, `src/app/globals.css` -- learner-authorised home data and responsive UI.
- `tests/unit/practice-application.test.ts`, `tests/unit/content-application.test.ts`, `tests/integration/migration-baseline.test.ts` -- selection, recommendation, title, and migration-contract coverage.

Review findings: 6 patches applied (high 2, medium 3, low 1); 1 medium item deferred; 12 findings rejected as later-story implementation, duplicate, or non-actionable for this story. Follow-up review recommendation: false (score 10; patched counts high 2, medium 3, low 1; high findings were resolved in this pass).

Verification:
- `npm test -- --run tests/unit/practice-application.test.ts tests/unit/content-application.test.ts tests/integration/migration-baseline.test.ts` -- passed, 53 tests.
- `npm run typecheck` -- passed.
- `npm run lint` -- passed.
- `git diff --check` -- passed.
- `npm run build` -- reached `Finished TypeScript` but this runner returned without final Next.js completion output; no active build process remained.

Residual risks: Migration execution against a representative PostgreSQL database remains to be validated. Existing published sets receive the safe generic title described in the deferred item until approved title data is available.
