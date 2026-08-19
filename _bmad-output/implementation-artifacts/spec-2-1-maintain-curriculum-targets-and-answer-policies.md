---
title: 'Story 2.1: Maintain Curriculum Targets And Answer Policies'
type: 'feature'
created: '2026-08-19'
status: 'done'
baseline_commit: '1ce9b8dca2c6cee3c44648935e991548de441252'
review_loop_iteration: 0
context:
  - 'docs/starters-curriculum-and-assessment-blueprint.md'
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The application has no controlled curriculum catalogue or answer-policy implementation. Content authors therefore cannot consistently tag Starters items, validate their boundaries, or define deterministic scoring semantics for later practice and evidence flows.

**Approach:** Deliver an authenticated staff workspace and server-authoritative curriculum feature for internal Starters guidance, canonical targets, versioned answer policies, and policy conformance checks. It will establish the controlled records and validation results that later content drafting, publishing, and scoring consume without exposing a public curriculum claim.

## Boundaries & Constraints

**Always:** Support exactly the five P0 engines (`picture_true_false`, `picture_yes_no`, `audio_picture_choice`, `audio_note_taking`, `word_bank_cloze`); permit curriculum/policy reads and mutations only to `academic_lead` and `admin`; persist canonical identifiers and immutable versions; implement explicit Unicode, locale/case, whitespace, punctuation, and number-form matching semantics; return stable `{ error: { code, message } }` failures; audit staff policy mutations without answer keys or raw response data in logs; use British English and WCAG 2.2 AA.

**Ask First:** Any change to the five-engine boundary, supported answer input kinds, target taxonomy beyond the internal guidance source, public curriculum/alignment wording, or a decision to make teachers read this new workspace.

**Never:** Do not copy, publish, download, or present imported Cambridge word lists; do not add learner-facing content, question/media lifecycle work, AI generation, scoring attempts, speaking, public sign-up, or policy approval/publishing workflow; do not let an LLM decide answer correctness; do not close a governed gate.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create target | Authorised staff submits a unique canonical target with valid category, level and guidance metadata | A controlled target is stored and appears in the staff catalogue | Duplicate identifier returns `TARGET_ID_CONFLICT`; malformed values return field findings |
| Update policy | Authorised staff submits a new version for an existing policy with answer semantics and vectors | A new immutable version becomes the current editable policy reference; prior versions remain readable | Unknown policy/target returns stable not-found; malformed semantics/vectors return named findings |
| Conformance | A stored policy is evaluated against its vectors for an engine input kind | Each vector records the expected deterministic match, non-match, or teacher-review result | Unsupported input kind or inconsistent expected result blocks saving |
| Unauthorised request | Learner or teacher invokes a curriculum mutation or protected route | No records are changed and the actor is denied | Application layer returns `FORBIDDEN`; route redirects through existing role handling |
| Out-of-bound guidance | Staff tries to record invalid engine, out-of-level vocabulary/grammar, unapproved name/number, or excessive template limits | The catalogue/editor displays specific validation findings rather than silently accepting the value | Validation is returned as structured findings and no invalid policy version is persisted |

</frozen-after-approval>

## Code Map

- `docs/starters-curriculum-and-assessment-blueprint.md:140-208` -- read-only internal source for required tags, named validation domains, policy record fields, and uncertain-outcome rule.
- `_bmad-output/implementation-artifacts/epic-2-context.md:17-56` -- Epic 2 constraints, persistence boundaries, staff UX, and downstream consumers.
- `db/schema/identity.ts:4-43` -- reuse account roles and account foreign keys; current audit target is account-only, so curriculum audit storage must avoid an invalid content foreign key.
- `db/schema/index.ts` -- export the new curriculum schema for database consumers and Drizzle generation.
- `db/migrations/meta/_journal.json` and `db/migrations/` -- add one generated, ordered migration and committed journal metadata.
- `src/features/identity/application/auth.ts:9-12` -- reuse `authorise(actor, ["academic_lead", "admin"])` at application boundaries.
- `src/features/identity/ui/session.ts:10-11` -- reuse protected-role session resolution, extending the shared workspace route to admit admins deliberately.
- `src/app/academic-lead/page.tsx:1-3` -- replace the placeholder with the staff guidance/catalogue page; preserve role-specific home redirects for other roles.
- `src/app/admin/actions.ts:1-16` and `src/features/identity/ui/create-account-form.tsx:1-6` -- patterns for Zod server actions, action-state forms, accessible status/errors, pending submits, and revalidation.
- `tests/unit/deactivate-centre-account.test.ts:17-50`, `tests/unit/admin-deactivation-action.test.ts:1-26`, `tests/integration/migration-baseline.test.ts:5-37` -- reuse authorisation, action-boundary, and migration-contract test patterns.

## Tasks & Acceptance

**Execution:**
- [x] `db/schema/curriculum.ts`, `db/schema/index.ts`, `db/migrations/`, `db/migrations/meta/_journal.json` -- add relational controlled target, guidance, policy-version, conformance-vector, and safe curriculum-audit persistence with enum/check/unique constraints; generate and commit the ordered Drizzle migration so versions cannot be overwritten.
- [x] `src/features/curriculum/domain/contracts.ts`, `src/features/curriculum/domain/answer-policy.ts` -- define Zod contracts, canonical-ID rules, fixed engine-to-input-kind mapping, named validation findings, and pure deterministic normalisation/matching evaluation used to validate persisted vectors.
- [x] `src/features/curriculum/application/curriculum.ts`, `src/features/curriculum/infrastructure/repositories.ts` -- implement transactional authorised catalogue/query/create/update use cases; create a new policy version rather than mutating history; persist only valid conformance vectors and audit safe mutation metadata.
- [x] `src/app/academic-lead/page.tsx`, `src/app/academic-lead/actions.ts`, `src/features/curriculum/ui/*` -- provide a responsive, keyboard-accessible internal guidance and maintenance workspace for both permitted roles, with labelled fields and actionable validation results.
- [x] `tests/unit/curriculum-*.test.ts`, `tests/integration/curriculum-*.test.ts`, `tests/integration/migration-baseline.test.ts` -- cover authorisation, canonical conflicts, version preservation, every engine input kind, normalisation cases, uncertain controlled input, invalid target/template findings, action responses, and database constraints.

**Acceptance Criteria:**
- Given an `academic_lead` or admin opens the protected workspace, when guidance is loaded, then it presents internal paper/part, P0 engine, topic, vocabulary/grammar, and task-format guidance without a public curriculum claim.
- Given authorised staff create or update controlled records, when submissions satisfy their contracts, then canonical targets and versioned machine-readable answer policies persist with exact matching semantics and historical policy versions remain unchanged.
- Given policies for each input kind required by the five P0 engines, when their conformance vectors run, then expected correct, incorrect, and `needs_teacher_review` outcomes are deterministic and saving fails on a conflicting vector.
- Given vocabulary/grammar, approved name/number, engine, or task-template data falls outside controlled guidance, when staff submit it, then the system returns named validation findings and does not persist an invalid policy version.
- Given a learner or teacher attempts any protected curriculum mutation, when the request reaches the application boundary, then it returns `FORBIDDEN` and leaves all controlled records unchanged.

## Design Notes

Answer-policy versions are append-only because a published snapshot must later identify the exact semantics used for scoring. The Story 2.1 catalogue may designate one current version for authoring, but later stories must copy the selected version into their immutable snapshots rather than dereference it at scoring time.

## Verification

**Commands:**
- `npm run db:generate` -- expected: generated migration reflects only the curriculum schema change.
- `npm run db:migrate` -- expected: migration succeeds against configured PostgreSQL.
- `npm run lint` -- expected: no ESLint errors.
- `npm run typecheck` -- expected: TypeScript completes without errors.
- `npm test` -- expected: unit and integration tests, including curriculum conformance coverage, pass.
- `npm run test:e2e` -- expected: protected staff workspace and role routing checks pass.

## Suggested Review Order

**Policy Boundary**

- Validates controlled target, selected guidance scope, and immutable policy append constraints.
  [`curriculum.ts:17`](../../src/features/curriculum/application/curriculum.ts#L17)

- Persists canonical targets, exact policy guidance references, and append-only policy version records.
  [`curriculum.ts:11`](../../db/schema/curriculum.ts#L11)

- Prevents ambiguous legacy guidance assignment before enforcing the required policy reference.
  [`0007_answer_policy_guidance_reference.sql:1`](../../db/migrations/0007_answer_policy_guidance_reference.sql#L1)

**Staff Workspace**

- Binds protected catalogue data and authorised create/edit forms into one internal workspace.
  [`page.tsx:1`](../../src/app/academic-lead/page.tsx#L1)

- Parses staff submissions strictly and forwards structured policy inputs to application boundaries.
  [`actions.ts:9`](../../src/app/academic-lead/actions.ts#L9)

**Verification**

- Exercises authorisation, controlled guidance, immutable scope, and named validation failures.
  [`curriculum-application.test.ts:11`](../../tests/unit/curriculum-application.test.ts#L11)
