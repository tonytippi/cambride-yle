---
title: 'Story 2.3: Restrict Validation To Drafts'
type: 'bugfix'
created: '2026-08-19'
status: 'done'
baseline_commit: 'a651ba0a436714b19eedfc96a99b2036c767f848'
review_loop_iteration: 0
context:
  - '_bmad-output/implementation-artifacts/spec-2-3-validate-review-and-phone-preview-content.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** A staff member can re-run validation after content enters `in_review`. That creates a newer validation result without a matching submission record, so the database approval guard rejects the otherwise valid item.

**Approach:** Make validation a draft-only operation at both the server boundary and staff UI. Keep the current review, exception, rejection and approval lifecycle unchanged.

## Boundaries & Constraints

**Always:** Enforce the state restriction server-side; UI visibility must match the server rule; retain the stable `CONTENT_TRANSITION_CONFLICT` error; preserve all existing immutable validation and review evidence.

**Ask First:** Supporting revalidation while in review, automatically resubmitting content, or changing the review-evidence database guard.

**Never:** Do not add statuses, migrations, new workflow actions, or alter exception, rejection, preview or approval behaviour.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Validate draft | Authorised staff selects a `draft` question or media version | Persists immutable validation findings as before | Existing validation failures remain named findings |
| Validate in-review content | Authorised staff calls validation for an `in_review` version | Does not persist a validation result | Returns `CONTENT_TRANSITION_CONFLICT` |
| Staff review controls | Content is `in_review` | Does not show the validation form | Existing approval, rejection, exception and preview controls remain available |

</frozen-after-approval>

## Code Map

- `src/features/content/application/content.ts:37` -- `validateContent` owns the authoritative status guard within the transaction; change its accepted state from `draft`/`in_review` to `draft` only.
- `src/features/content/ui/draft-forms.tsx:15` -- `ContentWorkflowControls` renders review controls; render the validation form only for `draft` to match the server restriction.
- `tests/unit/content-application.test.ts:29-30` -- existing validation tests establish the repository mock and draft path; add an in-review rejection regression case with no `recordValidation` call.
- `db/migrations/0013_content_approval_evidence_guard.sql:4-11` -- read-only rationale: approval requires the current validation to have review evidence, so no migration change is needed when revalidation is blocked.
- `src/app/academic-lead/actions.ts:245-247` -- read-only delegation: the action supplies only `kind` and `targetId`; status remains server-authoritative in the use case.

## Tasks & Acceptance

**Execution:**
- [x] `src/features/content/application/content.ts` -- reject validation unless the stored content status is `draft`; prevent new validation evidence after submission.
- [x] `src/features/content/ui/draft-forms.tsx` -- show the `Run validation` form only for draft content; prevent staff from entering the blocked path through the normal UI.
- [x] `tests/unit/content-application.test.ts` -- verify an in-review validation request returns the stable conflict code and creates no validation record.
- [x] `tests/unit/content-ui.test.ts` -- verify review controls hide validation for `in_review` while retaining approval.

**Acceptance Criteria:**
- Given an authorised staff member and a draft question or media version, when they run validation, then validation evidence is recorded exactly as before.
- Given an authorised staff member and an in-review question or media version, when they call validation directly, then the use case returns `CONTENT_TRANSITION_CONFLICT` and no validation evidence is recorded.
- Given staff views an in-review item, when workflow controls render, then validation is unavailable while existing in-review actions remain available.

## Design Notes

Restricting validation instead of adding automatic re-submission preserves the approved Story 2.3 lifecycle: validation happens before `draft -> in_review`. A reviewer who needs an editable, newly validated version can reject the reviewed version, which already creates a linked draft revision.

## Verification

**Commands:**
- `npm test -- tests/unit/content-application.test.ts tests/unit/content-actions.test.ts tests/unit/content-ui.test.ts` -- expected: draft validation, the in-review conflict regression and UI control visibility pass.
- `npm run lint` -- expected: no ESLint errors.
- `npm run typecheck` -- expected: TypeScript completes without error.

## Suggested Review Order

**Validation boundary**

- Enforces the lifecycle at the server rather than relying on hidden UI controls.
  [`content.ts:37`](../../src/features/content/application/content.ts#L37)

**Staff controls**

- Keeps the visible workflow aligned with the server-side draft-only validation rule.
  [`draft-forms.tsx:15`](../../src/features/content/ui/draft-forms.tsx#L15)

**Regression coverage**

- Proves direct in-review calls cannot write new validation evidence.
  [`content-application.test.ts:30`](../../tests/unit/content-application.test.ts#L30)

- Proves reviewed content omits validation while retaining approval controls.
  [`content-ui.test.ts:9`](../../tests/unit/content-ui.test.ts#L9)
