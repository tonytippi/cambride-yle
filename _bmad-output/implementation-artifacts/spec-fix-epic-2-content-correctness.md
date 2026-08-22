---
title: 'Fix Epic 2 Published Content Correctness'
type: 'bugfix'
created: '2026-08-22'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'c1f799b6330063fcb5a1bbcd7051b598b421612f'
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
  - '_bmad-output/implementation-artifacts/epic-2-retro-08-22-2026.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic 2 can publish content that fails migrated PostgreSQL immutable-history protection, snapshots an unusable answer-policy shape, or lacks the media and guidance limits the learner runtime requires. This leaves a staff-published practice set unable to complete the learner scoring flow.

**Approach:** Repair the content publication boundary so new publications retain correct immutable scoring policies and only accept engine-valid media and selected-guidance task shapes. Preserve existing immutable snapshots and use a forward migration for the database trigger repair.

## Boundaries & Constraints

**Always:** Keep the five P0 engines only; maintain server-authoritative validation and immutable published/attempt snapshots; use a new ordered migration rather than editing applied migrations; preserve `CONTENT_DRAFT_HISTORY_IMMUTABLE`; require image media for `picture_true_false` and `picture_yes_no`, audio plus labelled images for `audio_picture_choice`, audio for `audio_note_taking`, and no essential media for `word_bank_cloze`; labels must be unique, normalised, non-answer-revealing plain text; enforce the selected guidance's `maxWords` and `maxOptions`; retain British English and WCAG 2.2 AA.

**Ask First:** Backfilling or mutating existing published snapshots, changing the five-engine boundary, changing learner answer semantics, or introducing a new accessible task variant.

**Never:** Do not implement the deferred practice-set review lifecycle, readiness grouping/categorisation remediation, broad module refactor, public curriculum claims, AI-gate changes, binary storage, or protected Cambridge content.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| History guard | Direct update/delete of generated provenance or content audit row in migrated PostgreSQL | Rejects with `CONTENT_DRAFT_HISTORY_IMMUTABLE` | The lifecycle trigger is never invoked for tables without `status` |
| Publish and submit | Approved published question with a valid policy version | Snapshot stores top-level immutable scoring fields and learner submission can score it | Missing policy version blocks composition without partial rows |
| Required media | Question or set lacks image/audio required by its engine, or picture-choice labels are absent/duplicate/unsafe | Named media or label findings block draft validation and set publication | Learner runtime retains defensive `ITEM_INVALID` validation |
| Guidance limits | Prompt exceeds selected `maxWords` or options exceed selected `maxOptions` | Named findings block draft persistence, review, and publication | Generic absolute schema limits remain in force |

</frozen-after-approval>

## Code Map

- `db/migrations/0008_content_drafts.sql:34-38` and `0009_content_review_workflow.sql:5-10` -- historical trigger binding and overwritten lifecycle function; read-only evidence of the regression.
- `db/migrations/meta/_journal.json` -- register one new forward migration in the existing generated order.
- `db/migrations/0025_first_practice_e2e_regressions.sql` -- latest migration naming/order reference.
- `db/schema/content.ts:271-312` -- `practice_set_items.answerPolicy` and media snapshot JSON contracts; no schema change is required for correcting the JSON shape.
- `src/features/content/domain/contracts.ts:3-71` -- five-engine contracts, plain-text normalisation, accessibility metadata, and shared engine-media rule location.
- `src/features/content/application/content.ts:178-251,321-436,683-803` -- controlled reference checks, stored validation, and atomic practice-set publication boundary.
- `src/features/content/infrastructure/repositories.ts:459-551` -- immutable set snapshot materialisation; must copy policy version fields rather than the join wrapper.
- `src/features/practice/infrastructure/repositories.ts:124-154,192-232` -- learner defence-in-depth requirements and expected top-level stored policy contract; do not weaken these guards.
- `src/app/academic-lead/actions.ts` and `src/features/content/ui/draft-forms.tsx` -- parse and author the optional image choice label without exposing correctness.
- `tests/integration/migration-baseline.test.ts:319-368` -- migrated PostgreSQL trigger regression coverage.
- `tests/unit/content-application.test.ts` and `tests/unit/content-contracts.test.ts` -- authoring, composition, readiness-adjacent media, and contract test conventions to extend.
- `tests/e2e/teacher-evidence.spec.ts:8-10` -- update its explicit migration list when adding the forward migration.

## Tasks & Acceptance

**Execution:**
- [x] `db/migrations/0026_content_history_trigger_fix.sql`, `db/migrations/meta/_journal.json`, `tests/e2e/teacher-evidence.spec.ts` -- add and register a forward migration that separates generic content-history immutability from lifecycle status transitions, rebinds generation/audit triggers, and keeps disposable E2E schema setup current.
- [x] `src/features/content/domain/contracts.ts`, `src/app/academic-lead/actions.ts`, `src/features/content/ui/draft-forms.tsx` -- define shared engine-media requirements and learner-safe image choice-label input/validation.
- [x] `src/features/content/application/content.ts` -- apply the shared media/label requirements and selected guidance word/option limits before draft persistence, during stored validation, and before composition; retain existing learner-side defensive validation.
- [x] `src/features/content/infrastructure/repositories.ts` -- persist an explicit immutable scoring-policy version snapshot with its stable policy identifier, and fail atomically when the referenced version is unavailable.
- [x] `tests/integration/migration-baseline.test.ts`, `tests/unit/content-application.test.ts`, `tests/unit/content-contracts.test.ts`, and focused practice/integration coverage -- verify trigger errors, policy snapshot/submission, required-media matrix, label safety/uniqueness, and guidance-limit boundaries.

**Acceptance Criteria:**
- Given a migrated database, when generated provenance or content audit history is updated or deleted, then each operation is rejected with `CONTENT_DRAFT_HISTORY_IMMUTABLE` while legal content status transitions still use their lifecycle checks.
- Given a newly published valid practice set, when a learner submits its open attempt, then its immutable answer-policy snapshot is sufficient for deterministic server scoring and does not return `ITEM_INVALID` because of policy shape.
- Given staff author or publish content, when an engine lacks essential media or `audio_picture_choice` image labels are missing, duplicate, or answer-revealing, then named findings prevent persistence/review/publication; valid labelled media remains available to the learner runtime.
- Given a question exceeds its selected guidance's word or option cap, when staff create, generate, revise, validate, or compose it, then the system returns named blocking findings and leaves no partial content or set.

## Design Notes

The policy repair changes only future publication writes. Existing malformed snapshots remain immutable and require replacement publication rather than backfill. Generic immutable-record protection must be a separate PostgreSQL trigger function because generation and audit records have no lifecycle `status` column.

## Verification

**Commands:**
- `npm run db:migrate` -- expected: the forward migration applies successfully to the configured PostgreSQL database.
- `npm run lint` -- expected: no ESLint errors.
- `npm run typecheck` -- expected: TypeScript completes without errors.
- `npm test` -- expected: all unit and migrated-database integration tests pass, including immutable history and published snapshot scoring paths.
- `npm run test:e2e` -- expected: disposable-schema E2E setup applies the full migration sequence and all Playwright tests pass.

## Suggested Review Order

**Content Safety**

- Enforces non-bypassable media, policy, and guidance boundaries before publication.
  [`content.ts:179`](../../src/features/content/application/content.ts#L179)

- Defines canonical engine-media and picture-label requirements shared by all authoring paths.
  [`contracts.ts:61`](../../src/features/content/domain/contracts.ts#L61)

- Writes a scoring-ready policy snapshot rather than a database join wrapper.
  [`repositories.ts:459`](../../src/features/content/infrastructure/repositories.ts#L459)

**Learner Runtime**

- Permits no-media word-bank practice while retaining required-media defences for other engines.
  [`repositories.ts:64`](../../src/features/practice/infrastructure/repositories.ts#L64)

- Explains a valid zero-media preparation state without implying missing assets.
  [`preparation.tsx:20`](../../src/features/practice/ui/preparation.tsx#L20)

**Database And Verification**

- Separates generic immutable history protection from lifecycle transition triggers.
  [`0026_content_history_trigger_fix.sql:1`](../../db/migrations/0026_content_history_trigger_fix.sql#L1)

- Proves real publication snapshots can start, score, and submit correctly.
  [`published-practice-snapshot.test.ts:25`](../../tests/integration/published-practice-snapshot.test.ts#L25)

- Creates a fully migrated temporary database only for runs that include integration tests.
  [`global-setup.ts:1`](../../tests/global-setup.ts#L1)
