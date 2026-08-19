---
title: 'Story 2.3: Validate, Review And Phone-Preview Content'
type: 'feature'
created: '2026-08-19'
status: 'done'
baseline_commit: '13310329eb525f34020b9817a966e5b142b11331'
review_loop_iteration: 1
context:
  - 'docs/starters-curriculum-and-assessment-blueprint.md'
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Draft question and media versions have no server-authoritative validation, review/approval lifecycle, review evidence, or enforced phone-width check. As a result, unsuitable or inaccessible material can appear ready without visible findings and accountable staff judgement.

**Approach:** Add authorised validation and `draft -> in_review -> approved` workflow for existing immutable content versions. Findings block by default, but an `academic_lead` or admin can accept any exception only by recording an immutable reason, actor and time; image approval additionally requires recorded phone-width preview evidence.

## Boundaries & Constraints

**Always:** Support only the five P0 engines and only `academic_lead`/admin mutations. Show named findings for metadata/tags, answer keys or alternatives, existing media metadata/evidence, template limits, controlled names/numbers, provenance, plain-text sanitisation and accessibility answer leakage. Stored staff text, including every question option, is plain text with normalised whitespace and must not contain HTML/markup. Accessibility validation detects explicit answer disclosure (for example `correct answer`, `answer is`, `choose true/false`) and direct option-token disclosure in `altText`. Reuse controlled guidance/policy references and return stable `{ error: { code, message } }` failures. Preserve immutable source versions, append-only review/validation/exception history, lineage on rejection, UTC evidence, and payload-safe audit events. A finding blocks review/approval until validation passes or an authorised staff member records a non-empty exception reason. Require a persisted phone-width preview decision before approving image content; do not expose answer-revealing accessibility text to learners.

**Ask First:** Adding a question-media association, binary object storage, a malware-scanning provider, rich-text editing, automatic vocabulary/grammar analysis beyond available controlled records, new staff roles, or restricting the stated academic-lead/admin exception authority.

**Never:** Do not publish, retire, compose practice sets, create immutable publication snapshots, alter AI-provider gates, add learner/scoring surfaces, or mutate published/previous versions. Do not store answer keys, raw media, prompts, provider output, secrets or signed URLs in audit records. Do not treat a client-side disabled control or visual preview as approval enforcement.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Run validation | Authorised staff selects a `draft` or `in_review` question/media version | Returns named findings and persists an immutable validation result suitable for review | Invalid version/state returns a stable validation or conflict error without transition |
| Submit or approve clean item | Authorised staff submits valid `draft`, then approves valid `in_review` content | Applies only legal transition and records review/approval evidence plus safe audit event | Invalid transition, non-approved dependency or unresolved findings returns stable error with no partial mutation |
| Accept exception | Findings remain and authorised staff provides a reason | Immutable decision records finding set, reason, actor and UTC time; review/approval may proceed | Empty reason or unauthorised actor is rejected; findings never disappear |
| Image approval | Image version is otherwise approvable and staff records phone-width preview | Evidence records reviewer, timestamp and phone viewport/result before approval | Missing/failed preview blocks approval server-side |
| Reject review | Authorised reviewer rejects `in_review` version with reason | Retains source/history, creates linked editable `draft` revision, and audits decision | Missing reason or wrong state returns stable error and creates no revision |

</frozen-after-approval>

## Code Map

- `db/schema/content.ts:6-74` -- expand the draft-only lifecycle and add append-only validation, review/exception and phone-preview evidence associated with immutable question/media versions; retain existing safe content audit shape.
- `db/migrations/0008_content_drafts.sql:1-38`, `db/migrations/meta/_journal.json` -- do not alter the shipped draft migration or its immutability trigger; create and register the ordered follow-up migration with lifecycle/history constraints.
- `src/features/content/domain/contracts.ts:3-24` -- extend existing strict Zod contracts and `ContentFindings` for validation, workflow decision, required rejection/exception reason and image preview input.
- `src/features/content/application/content.ts:10-19` -- reuse `staff`, transaction ownership and controlled-reference validation; add server-authoritative validator and legal review/approve/reject use cases.
- `src/features/content/infrastructure/repositories.ts:7-22` -- extend content reads and append-only persistence for findings/results, review history, exception decisions, preview evidence and safe status audits.
- `src/features/curriculum/domain/contracts.ts:18-27,50-60,110-182` and `src/features/curriculum/application/curriculum.ts:17-26` -- reuse engine guidance, named findings, paper/part scope, template limits and approved name/number rules; do not duplicate taxonomy semantics.
- `src/app/academic-lead/actions.ts:23-44,235-245` -- follow existing FormData parsing, `actorFor`, stable failure response and success-only `revalidatePath` pattern for workflow actions.
- `src/features/content/ui/draft-forms.tsx:8-14`, `src/app/academic-lead/page.tsx:1-8`, `src/app/globals.css:19-20` -- surface accessible findings/history/workflow controls and make the existing 375px phone preview an explicit staff confirmation, not merely a display.
- `tests/unit/content-application.test.ts:1-29`, `tests/unit/content-contracts.test.ts:1-5`, `tests/unit/content-actions.test.ts:1-9`, `tests/integration/migration-baseline.test.ts:5-52` -- follow existing transaction, authorisation, Zod/action and migration baseline test patterns.

## Tasks & Acceptance

**Execution:**
- [x] `db/schema/content.ts`, `db/migrations/`, `db/migrations/meta/_journal.json` -- add constrained reviewable lifecycle and immutable validation/review/exception/preview records in a new migration, preserving prior draft rows and source immutability.
- [x] `src/features/content/domain/contracts.ts`, `src/features/content/application/content.ts`, `src/features/content/infrastructure/repositories.ts` -- implement scoped named validation and authorised validate, submit-review, approve, reject and exception/preview use cases with atomic history and audit persistence.
- [x] `src/app/academic-lead/actions.ts`, `src/app/academic-lead/page.tsx`, `src/features/content/ui/draft-forms.tsx`, `src/app/globals.css` -- provide keyboard-accessible staff controls, visible non-colour status/findings/history, required-reason forms and explicit 375px image-preview confirmation.
- [x] `tests/unit/content-contracts.test.ts`, `tests/unit/content-application.test.ts`, `tests/unit/content-actions.test.ts`, `tests/integration/migration-baseline.test.ts` -- cover matrix behaviour, legal transitions, roles, immutable exception/rejection evidence, server-side preview gate and migration constraints.

**Acceptance Criteria:**
- Given a `draft` or `in_review` question/media version, when authorised staff runs validation, then named findings identify each unmet supported requirement and are retained as immutable review evidence.
- Given a valid draft, when an `academic_lead` or admin submits it for review and later approves it, then only `draft -> in_review -> approved` succeeds, each mutation has safe audit/history evidence, and unauthorised actors or illegal states cannot mutate content.
- Given unresolved findings, when authorised staff accepts an exception with a reason, then the recorded actor, time, reason and finding context remain immutable while the item can proceed; an empty reason cannot bypass the block.
- Given image content is being approved, when no successful persisted phone-width preview exists, then approval is rejected server-side even if the client control is enabled; when it exists and other requirements are satisfied or accepted as exceptions, approval succeeds.
- Given a reviewer rejects an item in review, when they provide a reason, then the reviewed version remains unchanged and a linked new `draft` revision preserves the rejection evidence.

## Spec Change Log

- Review loop 1: clarified that Story 2.3 validates only metadata and safety evidence available in the current draft model. This avoids incorrectly requiring an unimplemented question-media association, binary upload safety pipeline or automated lexical analysis; retain the reviewed lifecycle, immutable evidence, exception and server-side phone-preview requirements.
- Review loop 2: selected plain-text sanitisation for existing staff text. This avoids ambiguous HTML handling while retaining named markup findings and the authorised exception path.
- Review loop 3: selected explicit answer-disclosure detection for accessibility text and extended plain-text validation to question options. This avoids a subjective broad text-overlap ban while ensuring clear answer leakage is a named finding.

## Design Notes

Keep validation findings and staff exceptions distinct. A finding is factual, reproducible evidence; an exception is accountable human judgement. This preserves the default safety signal without contradicting the product decision that academic leads and admins have full authority to accept exceptions.

Metadata-only validation is intentional for this story. It validates safety evidence and references stored by the current draft model; linking required media, binary upload safety and automated lexical analysis require separate data or provider capabilities and remain deferred.

## Verification

**Commands:**
- `npm run db:generate` -- expected: generated migration represents only the Story 2.3 lifecycle/evidence additions.
- `npm run db:migrate` -- expected: ordered migration applies successfully against configured PostgreSQL.
- `npm run lint` -- expected: no ESLint errors.
- `npm run typecheck` -- expected: TypeScript completes without error.
- `npm test -- tests/unit/content-contracts.test.ts tests/unit/content-application.test.ts tests/unit/content-actions.test.ts tests/integration/migration-baseline.test.ts` -- expected: workflow, evidence, authorisation, preview and migration coverage passes.

## Suggested Review Order

**Workflow And Evidence**

- Start with authorised lifecycle decisions and exact validation-exception binding.
  [`content.ts:37`](../../src/features/content/application/content.ts#L37)

- Review immutable evidence persistence and kind-scoped lookup semantics.
  [`repositories.ts:12`](../../src/features/content/infrastructure/repositories.ts#L12)

- Confirm direct database updates require lifecycle and approval evidence.
  [`0013_content_approval_evidence_guard.sql:1`](../../db/migrations/0013_content_approval_evidence_guard.sql#L1)

**Content Safety**

- Check plain-text normalisation and narrow explicit answer-leak detection.
  [`contracts.ts:4`](../../src/features/content/domain/contracts.ts#L4)

**Staff Workflow**

- Verify state-specific controls and 375px image-preview confirmation.
  [`draft-forms.tsx:15`](../../src/features/content/ui/draft-forms.tsx#L15)

- Inspect named findings, review evidence and linked rejection revisions.
  [`page.tsx:13`](../../src/app/academic-lead/page.tsx#L13)

**Verification**

- Follow scenario coverage for transitions, exceptions, previews and rejection lineage.
  [`content-application.test.ts:29`](../../tests/unit/content-application.test.ts#L29)

- Check contract boundaries and marker-based accessibility leak regressions.
  [`content-contracts.test.ts:5`](../../tests/unit/content-contracts.test.ts#L5)
