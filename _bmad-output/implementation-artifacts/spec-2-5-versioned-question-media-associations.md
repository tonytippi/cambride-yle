---
title: 'Story 2.5: Versioned Question Media Associations'
type: 'feature'
created: '2026-08-19'
status: 'done'
baseline_commit: '4c3eaa80a36b2f71f6a1aa8b62485585b93ebb59'
review_loop_iteration: 0
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A question version has no persisted current media plan before it enters a practice set. This prevents truthful pre-pilot readiness checks and makes the composer rely on manually supplied mappings rather than the reviewed question version.

**Approach:** Add a version-scoped question-to-media association selected while a question draft is created or revised. The practice-set composer will derive its media from those associations, and Story 2.5 readiness will read the same current published associations.

## Boundaries & Constraints

**Always:** Associations are append-only and belong to one question version; a revision needs its own explicit association list. Only `academic_lead` and admin may create/revise or publish content. A question-media association may be created only for matching paper, part and engine versions. A set still accepts only currently published question/media versions, requires published audio for audio engines, and snapshots media metadata unchanged. Existing published sets and attempts remain immutable.

**Ask First:** Stop if the direct association needs an additional product meaning beyond version eligibility, such as ordering, learner-visible roles, mandatory images for a non-audio engine, or multiple media classes not represented by the present metadata model.

**Never:** Do not modify historical `practice_set_item_media` snapshots, inherit associations automatically from a source version, add learner/teacher flows, storage/upload behaviour, engines, or public curriculum claims. Do not permit association update/delete or attachment to a published/retired question version.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create question plan | Staff creates a draft question with compatible media IDs | Question and append-only versioned associations persist in one transaction | Invalid/missing/scope-mismatched media rejects all writes |
| Revise question plan | Staff revises a question with a new explicit media list | New draft version gets only the supplied associations | Source associations are not inherited |
| Publish set | Staff selects published questions with associated published media | Composer derives mappings from stored associations and snapshots them using existing writer | Missing/unpublished/mismatched media returns named findings with no partial set |
| Direct mutation | Association update/delete or new association for published question | Database rejects the mutation | Existing snapshots and attempts remain unchanged |
| Readiness media | Published audio question has an associated published audio version | Readiness can evaluate it as media-eligible before any set exists | Missing/retired/unpublished audio is a concrete readiness gap |

</frozen-after-approval>

## Code Map

- `db/schema/content.ts`, `db/migrations/0015_publish_immutable_practice_set_schema.sql`, `db/migrations/meta/_journal.json` -- existing version and snapshot model; add the ordered append-only `question_version_media` schema/migration without touching historical snapshots.
- `src/features/content/domain/contracts.ts` -- `questionDraftSchema` and `composePracticeSetSchema`; accept deduplicated question media IDs and remove client-owned composer mappings.
- `src/features/content/application/content.ts:126-176,544-690,719-795` -- create/revise/reject/publish use cases and existing publication validation; persist associations transactionally and construct mappings from locked stored associations.
- `src/features/content/infrastructure/repositories.ts:38-55,358-461` -- draft persistence and existing snapshot writer; add association writes/reads/locks and current readiness candidate query.
- `src/app/academic-lead/actions.ts`, `src/features/content/ui/draft-forms.tsx`, `src/app/academic-lead/page.tsx` -- current staff forms and composer; select media with the question, remove manual set mapping, and render the readiness report in the protected existing workspace.
- `tests/unit/content-contracts.test.ts`, `tests/unit/content-application.test.ts`, `tests/unit/content-actions.test.ts`, `tests/unit/content-ui.test.ts`, `tests/integration/migration-baseline.test.ts` -- established contract, use-case, action/UI and migration guard coverage.

## Tasks & Acceptance

**Execution:**
- [x] `db/schema/content.ts`, `db/migrations/`, `db/migrations/meta/_journal.json` -- add an immutable versioned question-media association table with uniqueness, lifecycle/scope guards, and ordered migration metadata.
- [x] `src/features/content/domain/contracts.ts`, `src/features/content/infrastructure/repositories.ts`, `src/features/content/application/content.ts` -- validate and persist explicit draft associations; reuse them as the only composer mapping source and as the readiness read model.
- [x] `src/app/academic-lead/actions.ts`, `src/features/content/ui/draft-forms.tsx`, `src/app/academic-lead/page.tsx` -- expose compatible media selection during question authoring/revision, remove manual composer mapping input, and render staff-only readiness coverage/gaps.
- [x] `tests/unit/content-contracts.test.ts`, `tests/unit/content-application.test.ts`, `tests/unit/content-actions.test.ts`, `tests/unit/content-ui.test.ts`, `tests/integration/migration-baseline.test.ts` -- cover every matrix scenario, role protection, transaction atomicity, stored-media publication, truthful readiness, and association immutability.

**Acceptance Criteria:**
- Given an authorised staff member creates or revises a question draft with compatible media IDs, when it is saved, then only that new question version records immutable associations atomically and invalid references create neither question nor associations.
- Given selected published questions have stored associated media, when staff publishes a valid practice set, then the server derives and validates those associations before materialising the existing immutable media snapshots; client-supplied mappings cannot alter the result.
- Given an audio question has no associated currently published audio, when staff publishes a set or opens readiness, then the system returns a named audio-media finding rather than treating an historical set snapshot or raw question count as proof.
- Given a question version or association is published or historical, when an association mutation is attempted, then the database rejects it and existing practice-set snapshots and attempts remain unchanged.
- Given an academic lead or admin opens the existing staff workspace, when published content exists, then the readiness view reports all five engines, paper/part, topic/task type, vocabulary/grammar targets, essential-media eligibility, duration and concrete composition gaps.

## Design Notes

The association is a reviewed part of a question version, not a mutable library relationship. A draft may reference compatible media that is not yet published, but publication and readiness must independently check the associated media's present lifecycle state. Practice-set snapshot rows remain the immutable evidence of a specific publication; they are never used to determine whether a future set can be composed.

## Verification

**Commands:**
- `npm run db:generate` -- expected: one ordered association migration only.
- `npm run db:migrate` -- expected: configured database applies the migration successfully.
- `npm run lint` -- expected: no ESLint errors.
- `npm run typecheck` -- expected: TypeScript completes without error.
- `npm test -- tests/unit/content-contracts.test.ts tests/unit/content-application.test.ts tests/unit/content-actions.test.ts tests/unit/content-ui.test.ts tests/integration/migration-baseline.test.ts` -- expected: media association, composer, readiness and migration guards pass.
- `npm run build` -- expected: production build completes.

## Review Result

Final review resolved the actionable findings: AI question drafts preserve and validate selected media before provider calls; publication locks stored media; readiness groups compositions by the reported engine, paper/part, topic and task type; and rejection revisions begin with an explicit empty association list. No unresolved implementation findings remain.

## Suggested Review Order

**Versioned Association Boundary**

- Immutable database association guards preserve version integrity.
  [`content.ts:87`](../../db/schema/content.ts#L87)

- Migration enforces scope, draft lifecycle and append-only rows.
  [`0016_question_version_media.sql:1`](../../db/migrations/0016_question_version_media.sql#L1)

**Publication And Readiness**

- Composer derives and locks media from stored associations.
  [`content.ts:576`](../../src/features/content/application/content.ts#L576)

- Readiness evaluates current eligible associations by published choice.
  [`content.ts:83`](../../src/features/content/application/content.ts#L83)

- Repository joins the current association model rather than snapshots.
  [`repositories.ts:130`](../../src/features/content/infrastructure/repositories.ts#L130)

**Staff Surface And Evidence**

- Question editor selects version media; composer no longer maps media manually.
  [`draft-forms.tsx:130`](../../src/features/content/ui/draft-forms.tsx#L130)

- Readiness cards make coverage and concrete gaps visible to staff.
  [`readiness-report.tsx:1`](../../src/features/content/ui/readiness-report.tsx#L1)

- Focused tests cover associations, snapshots, readiness and migration guards.
  [`content-application.test.ts:140`](../../tests/unit/content-application.test.ts#L140)
  [`migration-baseline.test.ts:284`](../../tests/integration/migration-baseline.test.ts#L284)
