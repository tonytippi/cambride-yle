---
title: 'Story 3.5: Submit, Score And Review A Practice Set'
type: 'feature'
created: '2026-08-20'
status: 'done'
baseline_revision: '20870d85f8ffb3806b2bdf80c040ca7f16a2636c'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-3-context.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Learners can save open responses but cannot confirm submission, receive deterministic server-authoritative scoring, or review their submitted snapshot. The existing learner-home Review action has no review destination.

**Approach:** Finalise an owned open attempt atomically and idempotently from its immutable published snapshot, then expose a separate submitted-result read model and accessible learner UI. Keep the open-player DTO and all pre-submit surfaces answer-free.

## Boundaries & Constraints

**Always:** Accept only an authenticated learner's matching open attempt and expected revision. In one database transaction lock/finalise the attempt, preserve final response, playback, timing, answer-policy-version and curriculum-tag snapshots, score with the existing deterministic evaluator, persist only `correct`, `incorrect`, `unanswered` or `needs_teacher_review`, and project product-owned evidence. Repeat of the same idempotency key returns the saved submitted result. Submitted review is authorised to its learner and sourced exclusively from stored attempt snapshots; it may show response, approved answer, explanation and `secure`, `building`, `needs practice` or `not assessed yet`. Use British English and WCAG 2.2 AA.

**Block If:** The published item snapshot does not contain sufficient machine-readable answer-policy, approved-answer, explanation, and curriculum-tag data to persist the required post-submit record without reading editable source content.

**Never:** Reveal correctness, answers, explanations, feedback, outcomes or score-like wording in the open player; queue or partially finalise an offline submit; mutate an existing submitted attempt; merge stale drafts; use pass/fail, official-result, certificate, ranking or competitive language; add engines outside the five P0 engines.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Submit confirmation | Owned open attempt with answered and unanswered items | States both counts, allows `Review questions` or explicit `Submit anyway` | No answer is required |
| Successful finalisation | Online owned open attempt, matching revision and new key | Atomically saves immutable final records, outcomes, evidence and submitted result | Redirect to result/review only after success |
| Idempotent retry | Same attempt and finalisation key after success | Returns the original saved result | Does not rescore or duplicate evidence |
| Stale/post-submit write | Revision conflict, another finalisation key, response or playback after submit | Server state remains authoritative | Stable conflict/finalised error; no mutation |
| Offline submit | Browser offline | Attempt and draft stay open | Require reconnection; no queued request or partial result |
| Review access | Submitted attempt owned by learner | Shows only stored response, approved answer/explanation, outcome and evidence label | Other learners and open attempts receive no review data |

</intent-contract>

## Code Map

- `db/schema/practice.ts` -- open/submitted lifecycle and mutable response/playback/evidence tables; extend with immutable finalisation and idempotency storage.
- `db/migrations/0017_learner_practice_selection.sql`, `0018_practice_attempt_snapshot_metadata.sql`, `0019_practice_attempt_responses_and_playback.sql` -- existing DB immutability guards; add a forward migration compatible with their trigger ordering.
- `src/features/practice/infrastructure/repositories.ts` -- server authority for scoped open-player reads and revisioned writes; add transaction and submitted snapshot query here.
- `src/features/practice/application/practice.ts` and `domain/contracts.ts` -- learner-only validation, stable envelopes and new submit/result DTOs; retain the pre-submit allow-list.
- `src/features/curriculum/domain/answer-policy.ts` -- reuse `evaluateAnswer` and its supported `needs_teacher_review` outcome rather than duplicating scoring.
- `src/app/api/practice/attempt/[attemptId]/response/route.ts`, `playback/route.ts` -- existing no-store mutation boundary whose finalised behaviour must remain intact; add a sibling submit route.
- `src/features/practice/ui/practice-player.tsx` -- revision-serialised, recovery-aware open player; add confirmation and online-only finalisation without weakening Story 3.4 draft rules.
- `src/app/learner/practice/[setId]/attempt/[attemptId]/page.tsx` -- protected open-player entry; route successful submit to a separate submitted-result page.
- `src/features/practice/ui/learner-home.tsx` -- Review action currently targets preparation/start; link it to the owned submitted attempt.
- `tests/unit/practice-application.test.ts`, migration/integration tests -- current practice authority coverage; add finalisation, idempotency, snapshot and review checks.

## Tasks & Acceptance

**Execution:**
- `db/schema/practice.ts` and a new `db/migrations/*.sql` -- persist immutable final item/review snapshots and finalisation idempotency, with guards preserving open-only writes and one transaction-compatible submitted transition.
- `src/features/practice/domain/contracts.ts`, `application/practice.ts`, `infrastructure/repositories.ts` -- define validated submit/review contracts, implement authoritative atomic finalisation/scoring/evidence projection, and expose an owned submitted-snapshot query.
- `src/app/api/practice/attempt/[attemptId]/submit/route.ts` and learner result route/page -- add no-store protected submit transport and a dedicated submitted review surface.
- `src/features/practice/ui/practice-player.tsx`, `ui/learner-home.tsx`, `src/app/globals.css` -- add accessible counts/confirmation, explicit online submit and review navigation while retaining unsaved/offline behaviour.
- `tests/unit/practice-application.test.ts` and focused repository/migration tests -- cover every matrix case, evaluator outcomes, immutable snapshots, evidence projection and no pre-submit disclosure.

**Acceptance Criteria:**
- Given an open learner attempt, when its submission confirmation opens, then it reports answered and unanswered counts and offers `Review questions` or `Submit anyway` without requiring an answer.
- Given a valid online submission, when the learner submits once, then the server atomically finalises, deterministically scores and persists the immutable snapshot/evidence required by the story, and rejects later response or playback writes.
- Given a retry using the same idempotency key, when the initial finalisation succeeded, then it returns the saved result without duplicate scoring or evidence.
- Given a submitted owned attempt, when the learner opens result/review, then it renders only submitted snapshot data and approved post-submit feedback with the permitted product-owned labels.

## Design Notes

Finalisation must use persisted published-snapshot material, not editable content records. Treat the submitted result as a separate capability from the open player: this makes pre-submit disclosure structurally impossible and keeps a retired source revision reviewable.

## Verification

**Commands:**
- `npm test -- --run tests/unit/practice-application.test.ts` -- expected: application submission, scoring and review contracts pass.
- `npm test` -- expected: full Vitest suite passes.
- `npm run typecheck` -- expected: TypeScript has no errors.
- `npm run lint` -- expected: ESLint has no errors.
- `npm run build` -- expected: production build completes.
- `git diff --check` -- expected: no whitespace errors.

## Suggested Review Order

**Finalisation authority**

- Locks, validates, scores and snapshots only published attempt material.
  [`repositories.ts:186`](../../src/features/practice/infrastructure/repositories.ts#L186)

- Persists finalisation keys and immutable review records.
  [`practice.ts:22`](../../db/schema/practice.ts#L22)

- Creates immutable database structures and mutation guards.
  [`0020_practice_attempt_submission_review.sql:1`](../../db/migrations/0020_practice_attempt_submission_review.sql#L1)

**Learner release path**

- Validates learner-facing submit and review application contracts.
  [`practice.ts:128`](../../src/features/practice/application/practice.ts#L128)

- Sends no-store authenticated finalisation requests.
  [`route.ts:1`](../../src/app/api/practice/attempt/[attemptId]/submit/route.ts#L1)

- Confirms counts, blocks offline submit and reuses retry idempotency keys.
  [`practice-player.tsx:122`](../../src/features/practice/ui/practice-player.tsx#L122)

- Renders feedback solely from submitted snapshot data.
  [`submitted-practice-review.tsx:4`](../../src/features/practice/ui/submitted-practice-review.tsx#L4)

**Contract coverage**

- Covers authorisation, idempotent results and submitted-only review contracts.
  [`practice-application.test.ts:100`](../../tests/unit/practice-application.test.ts#L100)

## Migration Compatibility

Attempts submitted before migration `0020_practice_attempt_submission_review.sql` cannot receive the new immutable review snapshot without violating submitted-attempt immutability. Their review route therefore fails closed when the required stored snapshot is absent; no legacy attempt is mutated or reconstructed from editable content.

## Review Triage Log

### 2026-08-20 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 18 (high 2, medium 10, low 6)
- defer: 0
- reject: 1
- addressed_findings:
  - `[high] [patch]` Registered migration `0020` and reordered finalisation writes so submitted-only evidence guards allow the atomic transaction.
  - `[high] [patch]` Added exact immutable submitted-review snapshots, database scope/completeness guards, fail-closed reads and readable review labels.
  - `[medium] [patch]` Preserved final timing/playback snapshots, structured offline/stale submission recovery and migration contract coverage.

### 2026-08-20 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 5 (high 2, medium 3, low 0)
- defer: 0
- reject: 7
- addressed_findings:
  - `[high] [patch]` Ordered the migration journal and added a deferred exact-snapshot constraint so submitted reviews cannot contain a partial or extraneous item set.
  - `[medium] [patch]` Made final timing consistent with the submitted attempt and normalised numeric audio-note responses before deterministic scoring.

## Auto Run Result

Status: done

Summary: Implemented the learner submission lifecycle: accessible confirmation, server-authoritative idempotent finalisation and scoring, immutable submitted review snapshots, and learner-owned post-submit review.

Files changed:
- `db/schema/practice.ts`, `db/migrations/0020_practice_attempt_submission_review.sql`, `db/migrations/meta/_journal.json` -- immutable finalisation/review storage, database guards and registered migration.
- `src/features/practice/application/practice.ts`, `domain/contracts.ts`, `infrastructure/repositories.ts` -- validated submit/review contracts, atomic scoring and snapshot-only review query.
- `src/app/api/practice/attempt/[attemptId]/submit/route.ts`, learner review page and practice UI files -- protected no-store transport, submit confirmation/recovery and review presentation.
- `tests/unit/practice-application.test.ts`, `tests/unit/curriculum-answer-policy.test.ts`, `tests/integration/migration-baseline.test.ts` -- application, numeric scoring and migration-contract coverage.

Review findings: 23 patches applied (high 4, medium 13, low 6); 0 deferred; 8 rejected. Follow-up review recommendation: true (high findings were fixed).

Verification:
- `npm test -- --run tests/unit/practice-application.test.ts tests/integration/migration-baseline.test.ts tests/unit/curriculum-answer-policy.test.ts` -- passed.
- `npm test` -- passed, 26 files and 154 tests.
- `npm run typecheck` -- passed.
- `npm run lint` -- passed.
- `npm run build` -- passed.
- `git diff --check` -- passed.

Residual risks: Review-item trigger behaviour is verified by migration-contract tests, not a live PostgreSQL integration harness. Attempts submitted before migration `0020` safely remain non-reviewable because immutable snapshot fields cannot be backfilled without changing historic submitted records.
