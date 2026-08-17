---
id: SPEC-cambridgeyle-p0
companions:
  - ../../planning-artifacts/ux-designs/ux-CambridgeYLE-2026-08-17/DESIGN.md
  - ../../planning-artifacts/ux-designs/ux-CambridgeYLE-2026-08-17/EXPERIENCE.md
  - ../../planning-artifacts/architecture/architecture-CambridgeYLE-2026-08-17/ARCHITECTURE-SPINE.md
  - ../../docs/starters-curriculum-and-assessment-blueprint.md
sources:
  - ../../planning-artifacts/brief-CambridgeYLE-2026-08-17/brief.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate.

# CambridgeYLE P0

## Why

Existing Starters learners need short online practice whose detailed response evidence lets their teacher prepare targeted offline support, rather than inferring gaps from a worksheet total. The centre also needs an admin-supervised demonstration flow for prospective learners without building a public acquisition product.

## Capabilities

- **CAP-1**
  - **intent:** Admin can create learner, teacher, and admin accounts; manage cohorts/enrolments; and deactivate an account when required.
  - **success:** An admin can create accounts, enrol a learner, and confirm a named deactivation that revokes active sessions and prevents future login while retaining practice/diagnostic records and permitted audit metadata.
- **CAP-2**
  - **intent:** A learner can sign in, see assigned practice, verify essential media readiness, and start or recover an in-progress practice set on phone or desktop.
  - **success:** A learner can resume a locally recovered open draft, while a set with unavailable essential media cannot start and clearly offers retry/leave actions.
- **CAP-3**
  - **intent:** A learner can complete the five P0 Starters engines: picture true/false, picture yes/no, audio picture choice, audio name/number note-taking, and word-bank cloze.
  - **success:** Each engine records the allowed response and required media-playback evidence without exposing correctness while the attempt remains open.
- **CAP-4**
  - **intent:** A learner can submit a complete practice set and then review their responses, approved answers, explanations, and product-owned practice evidence.
  - **success:** Correctness, answers, and explanations are inaccessible before submission and available only from the saved submitted result afterwards.
- **CAP-5**
  - **intent:** The system can deterministically score a submitted attempt and preserve immutable item-level evidence.
  - **success:** A submit request finalizes once, returns the same saved result when retried with its idempotency key, and stores responses, outcomes, attempt timing, retry/media playback data, answer-policy version, and curriculum tags from the published snapshot.
- **CAP-6**
  - **intent:** A teacher can inspect cohort and learner evidence, identify gaps, resolve uncertain outcomes, and assign approved practice.
  - **success:** A teacher can filter authorized evidence by learner, cohort, paper, part, vocabulary, grammar, topic, time range, and practice set; unresolved outcomes do not affect automatic correctness aggregates.
- **CAP-7**
  - **intent:** A content editor can create and review original/licensed/generated content with curriculum, accessibility, media, answer-policy, and provenance validation.
  - **success:** Publish is blocked until an approved question/media version has all required validation/provenance fields, academic approval, and mobile preview; retiring later content does not alter prior attempt results.
- **CAP-8**
  - **intent:** An authorized user can assemble approved questions into a practice set and assign it to a learner or cohort.
  - **success:** Publication atomically creates an immutable set snapshot containing only approved question/media versions, and attempts always use that snapshot rather than current editable content.
- **CAP-9**
  - **intent:** Admin can run a supervised prospective-learner diagnostic using approved practice-set infrastructure.
  - **success:** An admin creates a pre-provisioned account, assigns an approved set, reviews completed practice evidence with a teacher, and can deactivate the account when it is no longer needed.
- **CAP-10**
  - **intent:** The PWA communicates connectivity/media readiness and recovers local drafts without retaining sensitive result data in browser storage.
  - **success:** The application shell and authorized set assets can be cached safely, an offline learner retains a visible draft, and browser caches contain no answer-review, result, or teacher-evidence payload.

## Constraints

- All learner-facing questions, media, scripts, and feedback must be original, licensed, or approved generated content; tags and validation follow the Starters assessment blueprint.
- A learner receives no correct/incorrect indication, answers, or explanations until submitting the complete practice set. Server-side deterministic scoring uses immutable published snapshots.
- Product language uses `secure`, `building`, `needs practice`, and `not assessed yet`; it must not show pass/fail, official scores, certificates, or Cambridge shields.
- P0 uses a responsive web/PWA modular monolith with server-side role/resource authorization, PostgreSQL as system of record, private object storage for media, and browser storage only for open-attempt recovery.

## Non-goals

- Public self-registration, parent accounts, payment, checkout, admissions funnel, or public diagnostic flow.
- A complete Starters-style mock, Movers/Flyers content, speaking recordings/scoring, chatbot/tutor, or native apps.
- Publishing AI-generated content without required validation and human review.
- A separate P0 diagnostic template, microservices, LMS/xAPI integration, or an analytics warehouse.
- Automatic retention expiry or irreversible deletion/purge of deactivated accounts and practice data.

## Success Signal

- In a 4-6 week pilot, at least 70% of enrolled learners complete two sets weekly and a teacher identifies at least two concrete gaps for each active learner before class from the dashboard.
- At least 80% of published pilot items require no ambiguity correction after learner use, no critical mobile audio/answer-loss/access issue blocks completion, and one supervised prospective-learner demonstration completes without a public registration flow.

## Assumptions

- The P0 visual direction remains a calm, child-friendly learning workspace until centre brand assets are supplied.
- Production infrastructure remains provider-neutral: one HTTPS Node.js application, managed PostgreSQL, and private S3-compatible object storage.

## Open Questions

- Which 6-8 Starters topics and grammar targets form the first 50-100 original items?
- Who is the academic lead and what source/version approval process authorizes the imported curriculum references?
- What public wording may describe skill/format alignment without implying Cambridge endorsement?
