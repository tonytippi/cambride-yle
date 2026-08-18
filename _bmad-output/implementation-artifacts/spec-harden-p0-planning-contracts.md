---
title: 'Harden P0 planning contracts from review findings'
type: 'chore'
created: '2026-08-18'
status: 'done'
review_loop_iteration: 0
baseline_commit: '062acb3e12ba9a90994d57764698c4c59aad1499'
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The P0 planning suite has material implementation ambiguities in account safety, evidence aggregation, content/media security, and immutable attempt handling. Several findings cross the PRD and its companion contracts, so implementers could otherwise make incompatible choices.

**Approach:** Strengthen the authoritative PRD requirements first, then synchronise the implementation index, technical invariants, experience rules, curriculum policy, and epic acceptance criteria. Keep scope deliberately small: remove teacher time-range filtering, make media-dependent sets unavailable until ready, and do not add tenant, credential-recovery, accessibility-variant, licence-expiry, or scorer-version features.

## Boundaries & Constraints

**Always:** Preserve the PRD as decision and requirement owner; maintain exactly five P0 engines, immutable published/attempt snapshots, server-authoritative deterministic scoring, post-submit-only review, deactivation-with-retention, WCAG 2.2 AA, and British English. Do not permit correction of submitted attempts, snapshots, scores, or audit records. State concrete behaviours rather than selecting providers. Keep `teacher` read-only for content and evidence, and `academic_lead`/`admin` as the only content publication authorities.

**Ask First:** Any change that closes or changes `GATE-ACADEMIC-SOURCES`, `GATE-PUBLIC-WORDING`, `GATE-AI-DRAFT-PROVIDER`, or `GATE-DEPLOYMENT`; any provider, data-residency, retention, or public-copy decision; any change to imported Cambridge reference files.

**Never:** Add product features outside P0, self-registration, deletion/purge, public curriculum claims, AI scoring/self-publication, queued offline submission, speaking, a full mock, public acquisition flows, tenant/workspace scoping, self-service password recovery, accessible task variants, licence-expiry management, or scorer-version persistence. Do not alter imported evidence or turn a documentation correction into a gate closure.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Last admin deactivation | Target is the final active centre admin | No deactivation mutation occurs | Stable `LAST_ACTIVE_ADMIN` conflict; nominate/activate another admin first |
| Start after preparation | Essential media is unavailable or changes between preload and start | Server atomically revalidates snapshot, authorisation and essentials before opening attempt | No usable attempt is created; learner can choose another published ready set or retry |
| Stale attempt write | Another tab/device advances revision | Server preserves authority and local visible input | Stable conflict; client reloads and offers safe local preservation |
| Teacher resolution correction | A resolution supersedes an earlier resolution | Automatic outcome stays immutable; current projections update from versioned effective outcome | Optimistic-concurrency conflict leaves prior resolution intact |
| Sign-out or deactivation | Browser holds PWA cache/draft keys | Only allowed assets are purged from the correct account namespace | Never cache API, result, evidence, HTML, or signed-URL responses |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/prds/prd-CambridgeYLE-2026-08-17/prd.md` -- normative product requirements, NFRs, Decision Register, and release criteria; remove teacher evidence time-range filtering.
- `_bmad-output/specs/spec-cambridgeyle-p0/SPEC.md` -- concise implementation kernel that indexes the strengthened constraints.
- `_bmad-output/planning-artifacts/architecture/architecture-CambridgeYLE-2026-08-17/ARCHITECTURE-SPINE.md` -- technical invariants AD-2 through AD-13, storage/cache boundaries, transactions, and deferred credential mechanism.
- `_bmad-output/planning-artifacts/ux-designs/ux-CambridgeYLE-2026-08-17/EXPERIENCE.md` -- learner/staff observable media, recovery, accommodation, evidence-filter and deactivation behaviour.
- `_bmad-output/planning-artifacts/ux-designs/ux-CambridgeYLE-2026-08-17/DESIGN.md` -- British-English terminology correction only.
- `docs/starters-curriculum-and-assessment-blueprint.md` -- read/write curriculum and assessment policy; imported source files remain read-only.
- `_bmad-output/planning-artifacts/epics.md` -- non-normative story traceability and acceptance coverage for the revised contracts.

## Tasks & Acceptance

**Execution:**
- [x] `prd.md` -- define correction-request immutability limits, final-admin guard, fixed evidence-window behaviour without a teacher time filter, start revalidation, resolution-projection semantics, simple objective mapping, and cache/content-safety controls -- establish normative P0 requirements.
- [x] `ARCHITECTURE-SPINE.md` -- translate PRD decisions into enforceable transactional, cache, sanitisation/upload, provenance, attempt-write, scoring, and evidence-projection invariants -- prevent divergent implementations without choosing gated providers.
- [x] `EXPERIENCE.md` and `DESIGN.md` -- expose only safe learner and staff behaviours for conflicts, preparation, cache-clearing, evidence without time filters, and named deactivation; correct British-English terminology -- keep UX consistent with the PRD.
- [x] `SPEC.md`, `starters-curriculum-and-assessment-blueprint.md`, and `epics.md` -- index the final contracts, tighten curriculum content/answer-policy records without version expansion, correct role terminology, and add Given/When/Then coverage -- preserve traceability without creating a second requirement source.
- [x] Planning suite -- verify all specified edge cases and authority/gate references remain internally consistent -- prevent regressions from cross-document edits.

**Acceptance Criteria:**
- Given a final active admin, when deactivation is requested, then the server rejects it without revoking sessions or changing account state.
- Given a teacher opens evidence, when filtering is needed, then learner, paper, part, language target, topic, practice set and fixed 30-day evidence rules apply without a time-range filter.
- Given a learner starts after media preparation, when the server creates an attempt, then it atomically validates the published snapshot, media authorisation and essential availability; unavailable-media sets remain unstartable.
- Given staff-provided content or media, when it enters review or publication, then sanitisation, upload-safety and provenance controls are required.
- Given a post-submission resolution, when it is corrected, then the automatic outcome and history remain immutable while current evidence/recommendation projections identify the applied effective-resolution version.

## Design Notes

Requirements must define product semantics while companions state their owned details. Credential recovery is outside P0. Media scanning remains provider-neutral; production service selection stays governed by `GATE-DEPLOYMENT`. P0 does not provide an equivalent accessible task variant: a media-dependent set stays unavailable when its essential media cannot be used.

## Verification

**Commands:**
- `rg -n "LAST_ACTIVE_ADMIN|time-range|sanitis|revalidat|signed URL|media-dependent" _bmad-output docs` -- expected: authoritative contract and downstream traceability cover every hardened boundary.
- `rg -n "Academic_lead|## Colors|Revisioned" _bmad-output docs` -- expected: no remaining role, spelling, or terminology drift.
- `git diff --check` -- expected: no whitespace errors.

**Manual checks:**
- Compare every changed companion requirement with the PRD: no companion introduces scope, closes a gate, or conflicts with the Decision Register.
- Confirm the three imported `docs/cambridge-young-learners-*.md` files remain untouched.

## Suggested Review Order

**Authoritative Behaviour**

- Establishes the fixed evidence window, immutable corrections, safe start, and PWA boundaries.
  [`prd.md:100`](../planning-artifacts/prds/prd-CambridgeYLE-2026-08-17/prd.md#L100)

- Protects account administration from the final-admin deactivation or demotion path.
  [`prd.md:143`](../planning-artifacts/prds/prd-CambridgeYLE-2026-08-17/prd.md#L143)

- Defines content/media review safety and unavailable media-dependent sets.
  [`prd.md:169`](../planning-artifacts/prds/prd-CambridgeYLE-2026-08-17/prd.md#L169)

**Technical Enforcement**

- Makes attempt start, browser storage, and protected-response caching enforceable.
  [`ARCHITECTURE-SPINE.md:85`](../planning-artifacts/architecture/architecture-CambridgeYLE-2026-08-17/ARCHITECTURE-SPINE.md#L85)

- Locks account/role mutations and preserves immutable submitted evidence.
  [`ARCHITECTURE-SPINE.md:91`](../planning-artifacts/architecture/architecture-CambridgeYLE-2026-08-17/ARCHITECTURE-SPINE.md#L91)

- Defines fixed-window staff evidence and resolution-projection behaviour.
  [`ARCHITECTURE-SPINE.md:103`](../planning-artifacts/architecture/architecture-CambridgeYLE-2026-08-17/ARCHITECTURE-SPINE.md#L103)

**User And Delivery Traceability**

- Shows the learner/staff states created by the revised contracts.
  [`EXPERIENCE.md:59`](../planning-artifacts/ux-designs/ux-CambridgeYLE-2026-08-17/EXPERIENCE.md#L59)

- Adds task-level Given/When/Then coverage for the hardened paths.
  [`epics.md:65`](../planning-artifacts/epics.md#L65)

- Aligns curriculum validation records with content-safety review.
  [`starters-curriculum-and-assessment-blueprint.md:157`](../../docs/starters-curriculum-and-assessment-blueprint.md#L157)
