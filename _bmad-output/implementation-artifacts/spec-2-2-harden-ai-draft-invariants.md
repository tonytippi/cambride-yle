---
title: 'Story 2.2: Harden AI Draft Invariants'
type: 'bugfix'
created: '2026-08-19'
status: 'done'
baseline_commit: '55d63b88b19618065515662e89bd9792b5b3f5d3'
review_loop_iteration: 0
context:
  - 'docs/starters-curriculum-and-assessment-blueprint.md'
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
  - '_bmad-output/implementation-artifacts/spec-2-2-create-manual-or-ai-content-drafts.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** AI image generation currently accepts a media draft labelled as audio, so the generated provenance and media type can contradict each other. Valid AI requests which fail after parsing are not consistently represented in the safe audit history.

**Approach:** Make the image-request contract accept only image media while retaining manual audio drafting. For successfully parsed AI requests, write one opaque, payload-safe failure audit record when subsequent validation, source lookup, generation, output validation, or final persistence fails.

## Boundaries & Constraints

**Always:** Keep `mediaDraftSchema` valid for manual image and audio drafts; reject an audio draft in a `kind: "image"` generation request before the gateway is invoked. Preserve the existing gate-open audit outcome without a duplicate generic failure record. Use only the existing immutable audit fields: opaque actor ID, target ID, content kind, action and timestamp. Retain atomic generated-draft, provenance, generation-record and success-audit persistence.

**Ask First:** Changing audit-table fields, recording diagnostic request/provider data, changing AI payload allowlists, or introducing an audio generation gateway.

**Never:** Persist staff prompts, permitted-reference descriptions, provider outputs, credentials, raw media, answer keys, signed URLs, learner/account/attempt/response/evidence data in audit records. Do not audit requests which fail `generationRequestSchema` parsing as valid AI requests. Do not change provider-gate configuration or the manual media workflow.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Image request media type | Parsed `kind: "image"` request with `mediaType: "image"` | Image gateway remains eligible after normal checks | Normal validation and provider failures apply |
| Invalid image media type | `kind: "image"` request with `mediaType: "audio"` | Request fails contract validation before the gate, transaction or gateway | `VALIDATION_FAILED`; no audit requirement for unparsed request |
| Post-parse request failure | Gate closed, parsed request then validation, lookup, provider, output or write failure | Original stable error is returned and no partial generated draft persists | One separate `AI_DRAFT_REQUEST_FAILED` safe audit record commits |
| Gate open | Parsed request while provider gate remains open | Gateway is not invoked; no generated draft is created | Keep one `AI_DRAFT_REQUEST_BLOCKED_GATE_OPEN` audit record only |

</frozen-after-approval>

## Code Map

- `src/features/content/domain/contracts.ts:14-18` -- `mediaDraftSchema` intentionally allows manual audio, while `generationRequestSchema` needs a narrower image-only draft branch.
- `src/features/content/application/content.ts:20-27` -- `requestAiDraft` parses input, writes the gate-open audit, runs preflight, calls the provider and atomically persists successful generated content.
- `src/features/content/infrastructure/repositories.ts:20-21` -- `recordAudit` accepts only opaque IDs and an action; reuse it without storing request or provider payloads.
- `db/schema/content.ts:54-61` and `db/migrations/0008_content_drafts.sql:34-38` -- existing audit rows have the required safe shape and are append-only; no database change is needed.
- `tests/unit/content-contracts.test.ts` -- existing contract coverage is the correct location for rejecting image requests carrying audio media.
- `tests/unit/content-application.test.ts:12-23` -- mocked transactions and audit repository calls support verification of independent failure auditing and no gateway/persistence side effects.

## Tasks & Acceptance

**Execution:**
- [x] `src/features/content/domain/contracts.ts` -- define the image-generation request arm with an image-only media draft, while leaving manual media validation unchanged.
- [x] `src/features/content/application/content.ts` -- after successful request parsing, catch expected downstream failures, persist one safe failure audit in an independent completed transaction, and rethrow the original error; preserve existing gate-open and atomic success paths.
- [x] `tests/unit/content-contracts.test.ts` -- prove an audio media draft is rejected for image generation and a valid image draft remains accepted.
- [x] `tests/unit/content-application.test.ts` -- cover preflight/provider or output failures, audit argument safety, absence of generated persistence, and no duplicate generic audit for an open gate.

**Acceptance Criteria:**
- Given a manual audio media draft, when it is validated for manual creation, then it remains valid.
- Given an AI request with `kind: "image"` and an audio media draft, when it reaches `requestAiDraft`, then it returns `VALIDATION_FAILED` and invokes neither gateway nor audit mutation.
- Given a successfully parsed, gate-closed AI request, when preflight, generation, generated-output parsing or final persistence fails, then its stable error is retained, exactly one payload-safe failure audit record persists and no partial generated content survives.
- Given a parsed AI request while the provider gate is open, when it is rejected, then it records only `AI_DRAFT_REQUEST_BLOCKED_GATE_OPEN` and never calls a gateway.

## Design Notes

Failure evidence must use a transaction independent from the failed operation. An audit insert inside the preflight or generated-content transaction would roll back with that operation and fail the evidence requirement. The success transaction remains unchanged so its draft, generation record and audit event still commit or roll back together.

## Verification

**Commands:**
- `npm test -- tests/unit/content-contracts.test.ts tests/unit/content-application.test.ts` -- expected: AI image contract and safe failure-audit paths pass.
- `npm run typecheck` -- expected: TypeScript completes without error.

## Suggested Review Order

**AI Request Boundary**

- Narrow image-generation input without breaking manual audio media drafts.
  [`contracts.ts:14`](../../src/features/content/domain/contracts.ts#L14)

- Record post-parse failures separately while preserving the original stable error.
  [`content.ts:20`](../../src/features/content/application/content.ts#L20)

**Behavioural Coverage**

- Verify image request shape and manual audio remain distinct contract paths.
  [`content-contracts.test.ts:5`](../../tests/unit/content-contracts.test.ts#L5)

- Cover gate, source, text and image failure audits without generated persistence.
  [`content-application.test.ts:18`](../../tests/unit/content-application.test.ts#L18)
