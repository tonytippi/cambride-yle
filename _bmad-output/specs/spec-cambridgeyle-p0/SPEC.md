---
id: SPEC-cambridgeyle-p0
companions:
  - ../../planning-artifacts/ux-designs/ux-CambridgeYLE-2026-08-17/DESIGN.md
  - ../../planning-artifacts/ux-designs/ux-CambridgeYLE-2026-08-17/EXPERIENCE.md
  - ../../planning-artifacts/architecture/architecture-CambridgeYLE-2026-08-17/ARCHITECTURE-SPINE.md
  - ../../../docs/starters-curriculum-and-assessment-blueprint.md
  - ../../../docs/source-manifest.md
sources:
  - ../../planning-artifacts/prds/prd-CambridgeYLE-2026-08-17/prd.md
---

> **Implementation kernel/index.** The PRD owns product decisions and gates. This SPEC preserves and indexes the build contract; each companion owns its domain detail. It is not implementation-ready while a referenced blocking gate is open.

# CambridgeYLE P0

## Why

Existing Starters learners need short online practice whose detailed response evidence lets their teacher prepare targeted offline support, rather than inferring gaps from a worksheet total. The centre also needs an admin-supervised demonstration flow for prospective learners without building a public acquisition product.

## Capabilities

P0 implements exactly `picture_true_false`, `picture_yes_no`, `audio_picture_choice`, `audio_note_taking`, and `word_bank_cloze` for self-directed practice.

- **CAP-1**
  - **intent:** Admin can create learner, teacher, `academic_lead` and admin accounts and deactivate an account when required.
  - **success:** An admin can create accounts and confirm a named deactivation that revokes active sessions and prevents future login while retaining practice/first-practice records and permitted audit metadata.
- **CAP-2**
  - **intent:** A learner can choose published practice by topic or task type, see history-based recommendations, verify essential media readiness, and start or recover an in-progress practice set on phone or desktop.
  - **success:** A learner can resume a locally recovered open draft, while a set with unavailable essential media cannot start and clearly offers retry/leave actions.
- **CAP-3**
  - **intent:** A learner can complete the five P0 Starters engines: picture true/false, picture yes/no, audio picture choice, audio name/number note-taking, and word-bank cloze.
  - **success:** Each engine records the allowed response and required media-playback evidence without exposing correctness while the attempt remains open.
- **CAP-4**
  - **intent:** A learner can submit a complete practice set and then review their responses, approved answers, explanations, and product-owned practice evidence.
  - **success:** Correctness, answers, and explanations are inaccessible before submission and available only from the saved submitted result afterwards.
- **CAP-5**
  - **intent:** The system can deterministically score a submitted attempt and preserve immutable item-level evidence.
  - **success:** A submit request finalises once, returns the same saved result when retried with its idempotency key, and stores responses, outcomes, attempt timing, retry/media playback data, answer-policy version, and curriculum tags from the published snapshot.
- **CAP-6**
  - **intent:** A teacher can inspect every learner's detailed evidence and identify gaps; `academic_lead` and admin can also resolve uncertain outcomes.
  - **success:** A teacher can filter authorised evidence by learner, paper, part, vocabulary, grammar, spelling, names, numbers, colours, positions, topic, time range, and practice set; every evidence read is audit logged and unresolved outcomes do not affect automatic correctness aggregates. Centre-wide staff access remains blocked by `GATE-DATA-GOVERNANCE`.
- **CAP-7**
  - **intent:** An `academic_lead` or admin can create, request/edit/rerun AI drafts for, and review original/licensed/generated content with curriculum, accessibility, media, answer-policy, and provenance validation.
  - **success:** Publish is blocked until an approved question/media version has all required validation/provenance fields, academic approval, and mobile preview; retiring later content does not alter prior attempt results.
- **CAP-8**
  - **intent:** An authorised user can assemble published question/media versions into a practice set for learner selection and history-based recommendation.
  - **success:** Publication atomically creates an immutable set snapshot containing only published question/media versions, and attempts always use that snapshot rather than current editable content.
- **CAP-9**
  - **intent:** Admin can run a supervised first-practice session using standard self-directed practice infrastructure.
  - **success:** An admin creates a pre-provisioned account, helps the learner select a published set, reviews completed practice evidence with a teacher, and can deactivate the account when it is no longer needed.
- **CAP-10**
  - **intent:** The PWA communicates connectivity/media readiness and recovers local drafts without retaining sensitive result data in browser storage.
  - **success:** The application shell and authorised set assets can be cached safely, an offline learner retains a visible draft, and browser caches contain no answer-review, result, or teacher-evidence payload.

## Constraints

- All learner-facing questions, media, scripts, and feedback must be original, licensed, or approved generated content; tags and validation follow the Starters assessment blueprint.
- A learner receives no correct/incorrect indication, answers, or explanations until submitting the complete practice set. Server-side deterministic scoring uses immutable published snapshots.
- Product language uses `secure`, `building`, `needs practice`, and `not assessed yet`; it must not show pass/fail, official scores, certificates, or Cambridge shields.
- P0 uses a responsive web/PWA modular monolith with server-side role/resource authorisation, PostgreSQL as system of record, private object storage for media, and browser storage only for open-attempt recovery.
- Question, media and practice-set lifecycles are independently versioned; rejection creates a new draft version, retirement blocks future selection, and immutable published snapshots grandfather active/completed attempts.
- `teacher` reads published content and centre-wide evidence; `academic_lead` creates, edits, reruns, approves and publishes content; `admin` has all permissions. WCAG 2.2 AA and British English apply to technical artefacts and product copy. `GATE-ACADEMIC-SOURCES`, `GATE-CONTENT-PLAN`, `GATE-PUBLIC-WORDING`, `GATE-DATA-GOVERNANCE`, `GATE-PRODUCT-ASSUMPTIONS`, `GATE-AI-DRAFT-PROVIDER` and `GATE-DEPLOYMENT` remain owned by the PRD.

## Non-goals

- Public self-registration, parent accounts, payment, checkout, admissions funnel, or public diagnostic flow.
- A complete Starters-style mock, Movers/Flyers content, speaking recordings/scoring, chatbot/tutor, or native apps.
- Publishing AI-generated content without required validation and human review.
- A separate P0 diagnostic template, microservices, LMS/xAPI integration, or an analytics warehouse.
- Automatic retention expiry or irreversible deletion/purge of deactivated accounts and practice data.

## Success Signal

- In a 4-6 week pilot, at least 70% of active learners complete two sets weekly and a teacher identifies at least two concrete gaps for each active learner from the dashboard.
- At least 80% of published pilot items require no ambiguity correction after learner use, no critical mobile audio/answer-loss/access issue blocks completion, and one supervised prospective-learner demonstration completes without a public registration flow.

## Assumptions

- The P0 visual direction remains a calm, child-friendly learning workspace until centre brand assets are supplied.
- Production infrastructure remains provider-neutral: one HTTPS Node.js application, managed PostgreSQL, and private S3-compatible object storage.

## Gate Trace

The PRD Decision Register is the sole owner of open decisions. `GATE-CONTENT-PLAN` is closed: teacher-facing curriculum/assessment guidance and individual `academic_lead`/admin approval govern publication. Public copy remains blocked by `GATE-ACADEMIC-SOURCES` and `GATE-PUBLIC-WORDING`; pilot launch and centre-wide teacher evidence access by `GATE-DATA-GOVERNANCE`; pilot acceptance by `GATE-PRODUCT-ASSUMPTIONS`; AI drafts by `GATE-AI-DRAFT-PROVIDER`; and production launch by `GATE-DEPLOYMENT`.
