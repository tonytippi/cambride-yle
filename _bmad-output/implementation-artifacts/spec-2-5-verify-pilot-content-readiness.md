---
title: 'Story 2.5: Verify Pilot Content Readiness'
type: 'feature'
created: '2026-08-19'
status: 'blocked'
baseline_commit: '4c3eaa80a36b2f71f6a1aa8b62485585b93ebb59'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Staff can publish individual questions, media, and practice sets, but have no pre-pilot view showing whether the published catalogue supports the promised learner choices. Raw item totals cannot establish that useful 5-10 minute sets can be made.

**Approach:** Add a staff-only, read-only readiness report to the academic-lead workspace. It will evaluate published question/media candidates using the same composition constraints as publication, report coverage at the required dimensions, and show concrete gaps per published topic/task-type choice.

## Boundaries & Constraints

**Always:** Permit only `academic_lead` and admin. Read approved and published content without mutation, but base composability on currently published question/media versions. Cover exactly the five P0 engines, paper/part, topic, controlled vocabulary/grammar target, essential-media availability, and estimated duration. A ready result requires a varied candidate composition that uses one paper/part, totals 300-600 seconds, and has one or two primary objectives; never infer readiness from aggregate item count. Audio engines require associated published audio media. Use server-authoritative authorisation and British English UI copy.

**Block If:** The existing persisted data cannot identify the topic/task type or media association needed to evaluate a requirement, or a new product definition of “varied” is necessary beyond the available distinct question candidates and existing one/two-objective composition rule.

**Never:** Do not add migrations, lifecycle mutations, a new route, teacher/learner functionality, public curriculum claims, content upload/storage behaviour, engines, or a synthetic readiness score. Do not treat approved-only versions as publishable learner content or expose protected/learner data.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Composable coverage | Published questions for a guidance topic/task type share paper/part, have valid 5-10 minute combinations, one/two objectives, and required audio | Report engine/paper-part/topic/target/media/duration coverage and a ready composition result | No error expected |
| No viable composition | Published candidate count exists but duration, paper/part, objective, or essential media rules prevent a set | Report the dimension counts and named concrete gap(s), never ready from totals | No mutation or inferred readiness |
| Missing published audio | Audio-engine question has no associated published audio media | Flag the affected topic/task-type choice with an essential-audio gap | No mutation |
| Unauthorised read | Learner or teacher calls the use case | Reject at the application boundary | Existing identity error semantics |

</intent-contract>

## Code Map

- `src/features/content/application/content.ts:42-67,544-690` -- reuse `staff(actor)` and the composition rules for server-authoritative readiness evaluation; keep this read-only use case in the content application boundary.
- `src/features/content/infrastructure/repositories.ts:88-115,358-461` -- existing content and immutable set persistence; add a focused published-content read with question/media association and controlled guidance/target labels.
- `db/schema/content.ts` -- read-only source of published question/media versions and immutable practice-set item/media associations; do not modify schema.
- `db/schema/curriculum.ts` -- read-only controlled guidance and target taxonomy used to label paper/part, topic, vocabulary and grammar coverage.
- `src/app/academic-lead/page.tsx:41-46,120-245` -- protected staff workspace and server-rendered content library; load the report in parallel and render one accessible read-only readiness section.
- `tests/unit/content-application.test.ts` -- established application mock and authorisation tests; add report grouping, gap and non-count-based readiness cases.
- `tests/unit/content-ui.test.ts` -- static server markup convention; cover the readiness heading, coverage labels and concrete gap rendering.
- `_bmad-output/implementation-artifacts/epic-2-context.md:17-27` -- read-only source for the Story 2.5 coverage and composition invariants.

## Tasks & Acceptance

**Execution:**
- [x] `src/features/content/infrastructure/repositories.ts` -- add one typed, read-only query that returns published question candidates, their published media associations, and required controlled guidance/target labels -- avoids using unbounded draft-library reads or duplicating joins in UI code.
- [x] `src/features/content/application/content.ts` -- add `getPilotContentReadiness(actor)` that authorises staff, groups coverage, tests viable 300-600 second same-paper/part compositions with one/two primary objectives, and returns explicit stable gap codes/messages -- keeps readiness rules server-side and prevents totals-only results.
- [x] `src/app/academic-lead/page.tsx` -- request the report with existing staff data and render a keyboard-readable “Pilot content readiness” section listing required coverage and gaps for each published topic/task-type choice -- provides the required teacher-facing guidance surface without a new route.
- [x] `tests/unit/content-application.test.ts`, `tests/unit/content-ui.test.ts` -- add focused report tests for staff access, ready composition, duration/objective/paper-part gaps, audio-media gaps, and visible concrete gaps -- protects the report from becoming a count-only dashboard.

**Acceptance Criteria:**
- Given an authenticated `academic_lead` or admin and published P0 content, when they open the academic-lead workspace, then it displays coverage by each P0 engine, paper/part, topic/task type, controlled vocabulary/grammar target, essential media status, and estimated duration.
- Given a published topic/task-type choice has a same-paper/part, 5-10 minute composition with one or two primary objectives and required media, when readiness is evaluated, then the report identifies it as composable without relying on its total item count.
- Given candidate content cannot form such a composition because of duration, paper/part, objectives, or missing essential audio, when readiness is evaluated, then the report lists the affected choice and concrete named gap(s) rather than declaring readiness.
- Given a teacher or learner attempts to obtain readiness data, when the content application use case runs, then authorisation rejects the read and no content state changes.

## Design Notes

Evaluate distinct published question versions by guidance/topic and preserve the exact composer constraints already enforced by `publishPracticeSet`. “Varied” remains observable and minimal here: a choice needs a valid composition from distinct candidate questions, not a numerical quota or a new scoring model. The report must still list all five engine buckets so an absent engine is visible as a coverage gap.

## Verification

**Commands:**
- `npm run lint` -- expected: no ESLint errors.
- `npm run typecheck` -- expected: TypeScript completes without error.
- `npm test -- tests/unit/content-application.test.ts tests/unit/content-ui.test.ts` -- expected: readiness authorisation, composition/gap logic, and rendered report tests pass.
- `npm run build` -- expected: production build completes.

## Review Triage Log

### 2026-08-19 — Review pass
- intent_gap: 1 (high 1, medium 0, low 0)
- bad_spec: 0
- patch: 0
- defer: 0
- reject: 14
- addressed_findings:
  - none

## Auto Run Result

Status: blocked

Blocking condition: intent gap

The existing model has no current question-to-media eligibility association before a practice set is published. The attempted report inferred it from historical immutable practice-set snapshots, which can mark unpublished prospective associations missing and retired-set associations available. This violates the readiness requirement to prove or flag future composability, and the intent contract explicitly requires a block when that association cannot be identified.

Attempted change saved at `_bmad-output/implementation-artifacts/story-2-5-readiness-attempt.patch`.

Verification performed before the review block:
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm test -- tests/unit/content-application.test.ts tests/unit/content-ui.test.ts` passed: 38 tests.
- `npm run build` passed.
- `git diff --check` passed.
