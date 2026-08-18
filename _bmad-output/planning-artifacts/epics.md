---
stepsCompleted:
  - requirements-extracted
  - epics-replanned-for-self-directed-practice
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-CambridgeYLE-2026-08-17/prd.md
  - _bmad-output/specs/spec-cambridgeyle-p0/SPEC.md
  - docs/starters-curriculum-and-assessment-blueprint.md
  - _bmad-output/planning-artifacts/ux-designs/ux-CambridgeYLE-2026-08-17/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-CambridgeYLE-2026-08-17/EXPERIENCE.md
  - _bmad-output/planning-artifacts/architecture/architecture-CambridgeYLE-2026-08-17/ARCHITECTURE-SPINE.md
---

# CambridgeYLE - Epic Breakdown

## Overview

This document decomposes and traces the CambridgeYLE P0 contract into implementable stories. It is not a requirement or decision source: the PRD owns requirements and gates, the SPEC is the implementation kernel, and each domain companion owns its detail. P0 is self-directed practice: it has no cohort, class or teacher-assignment model.

## Traceability Matrix

| PRD requirement | SPEC | Domain contract | Story coverage | Release gate |
| --- | --- | --- | --- | --- |
| FR-1–4 accounts, role access and deactivation-with-retention | CAP-1 | AD-6, AD-8; EXPERIENCE account states | 1.1–1.3, 5.2 | `GATE-DATA-GOVERNANCE` |
| FR-5–11 learner-selected practice, recommendation, recovery, submit/review | CAP-2–4, CAP-10 | AD-2, AD-4, AD-7, AD-13; EXPERIENCE learner/PWA states | 3.1–3.6 | `GATE-PRODUCT-ASSUMPTIONS` |
| FR-12–14 deterministic scoring and immutable evidence | CAP-5 | AD-2–5, AD-10 | 3.6, 4.3 | `GATE-PRODUCT-ASSUMPTIONS` |
| FR-15–18 teacher evidence, simple evidence states and recommendation | CAP-6, CAP-8 | AD-6, AD-10, AD-13; EXPERIENCE teacher states | 3.1, 4.1–4.3 | `GATE-DATA-GOVERNANCE`, `GATE-PRODUCT-ASSUMPTIONS` |
| FR-19–24 content/media/set lifecycle and readiness | CAP-7–8 | Blueprint sections 5–9; AD-3, AD-9, AD-11–12 | 2.1–2.5 | `GATE-ACADEMIC-SOURCES`, `GATE-CONTENT-PLAN`, `GATE-PUBLIC-WORDING`, `GATE-AI-DRAFT-PROVIDER` |
| FR-25–27 supervised first practice and safe PWA | CAP-9–10 | AD-7, AD-8, AD-10; EXPERIENCE first-practice/PWA states | 3.2, 3.5, 5.1–5.2 | `GATE-DATA-GOVERNANCE` |

## Epic 1: Centre-Managed Accounts And Access

Admin can create learner, teacher, `academic_lead` and admin accounts, deactivate accounts with session revocation and record retention, and ensure learners see only their own records. Teacher reads published content and centre-wide detailed evidence; `academic_lead` creates and confirms content; admin has all permissions. Every staff evidence read is audited.

**FRs covered:** FR-1–4

### Story 1.1: Establish The Application Foundation

As a centre administrator,
I want a secure, deployable application foundation,
So that centre-managed features can be built and operated consistently.

**Acceptance Criteria:**

**Given** a new local or staging environment
**When** the application is started
**Then** it runs as the prescribed Next.js/TypeScript modular monolith with startup-validated server configuration, health endpoint, and HTTPS-ready security headers.

**And** PostgreSQL access uses reviewed Drizzle migrations, structured logs omit secrets and learner responses, and the responsive base layout implements the DESIGN.md tokens with verified focus contrast.

### Story 1.2: Admin-Created Accounts And Secure Sign-In

As an admin-created user,
I want to sign in securely to my role-specific home,
So that I can use the centre functions available to my role.

**Acceptance Criteria:**

**Given** an admin has created an active learner, teacher, `academic_lead` or admin account with a password
**When** that user submits valid credentials
**Then** the server creates an opaque Secure HttpOnly SameSite=Lax session and routes the user to their role-appropriate home.

**And** passwords are Argon2id hashes, invalid, unknown and deactivated account attempts return the same generic failure, login attempts are throttled, and browser navigation alone cannot grant a protected role.

### Story 1.3: Deactivate A Centre Account

As an admin,
I want to deactivate an account explicitly,
So that a departed or unneeded user cannot sign in again without losing pilot records accidentally.

**Acceptance Criteria:**

**Given** an active account detail
**When** an admin confirms the named deactivation action
**Then** the server sets `deactivated_at` and `deactivated_by`, revokes active sessions, blocks future authentication/authorisation, and records an audit event with no learner response content.

**And** practice and first-practice records remain retained, the admin UI shows deactivated status/history, and automatic expiry, account deletion and irreversible purge are not implemented.

## Epic 2: Safe Starters Practice Content

`Academic_lead` and admin can create or request structured AI drafts, validate, review, phone-preview, publish, retire and compose original approved Starters practice sets with immutable, auditable content/media snapshots. AI output is always a draft and cannot bypass human review or publication.

**FRs covered:** FR-19–24

### Story 2.1: Maintain Curriculum Targets And Answer Policies

As an `academic_lead`,
I want teacher-facing Starters curriculum and assessment guidance with controlled vocabulary, grammar, topic and answer-policy records,
So that each item can be validated and scored consistently.

**Acceptance Criteria:**

**Given** the current Starters curriculum reference
**When** an `academic_lead` or admin opens the guidance and creates or updates a target and answer policy
**Then** the system presents paper/part, engine, topic, vocabulary/grammar and task-format guidance, and stores canonical target identifiers with a versioned machine-readable policy using exact normalisation/matching semantics.

**And** policy conformance vectors cover each input kind used by the five P0 engines, while out-of-level vocabulary/grammar, unapproved names/numbers and invalid task-template limits produce validation findings.

### Story 2.2: Create Manual Or AI Content Drafts

As an `academic_lead`,
I want to create a question/media draft manually or request a structured AI draft,
So that safe practice content can enter academic review efficiently.

**Acceptance Criteria:**

**Given** an authenticated `academic_lead` or admin and a closed `GATE-AI-DRAFT-PROVIDER` for AI requests
**When** they create a manual draft or request an AI draft
**Then** the draft records level, task type, paper/part, prompt/options, answer policy, target IDs, topic IDs, estimated duration, accessibility metadata and immutable provenance fields.

**And** an AI draft calls the configured OpenAI-compatible gateway with its server-only API key, records gateway/model/prompt provenance and generated origin, remains `draft`, and cannot be published without `academic_lead`/admin approval and phone-width preview.

### Story 2.3: Validate, Review And Phone-Preview Content

As an `academic_lead`,
I want validation findings and a phone-width preview before approval,
So that unsuitable, inaccessible, ambiguous or unlicensed material cannot reach learners.

**Acceptance Criteria:**

**Given** a question in `draft` or `in_review`
**When** validation or review is run
**Then** the editor sees named publication-blocking findings for missing tags/keys/alternatives/media, curriculum limits, media approval, provenance and accessibility requirements.

**And** only an `academic_lead` or admin may transition a valid item through `draft -> in_review -> approved`, each review/approval mutation is audit logged, and learner-facing accessibility content cannot reveal answers.

### Story 2.4: Publish Immutable Practice Sets

As an `academic_lead`,
I want to compose and publish question/media versions into a practice set,
So that learners can select a stable, auditable activity.

**Acceptance Criteria:**

**Given** published P0 question and media versions
**When** an `academic_lead` or admin composes and publishes a set, or later retires source content
**Then** question, media and practice-set state machines independently enforce `draft -> in_review -> approved -> published -> retired`; the composer accepts only published versions; and publication atomically creates immutable snapshots with rendered content, answer policy, tags, feedback, accessibility metadata, provenance and write-once media hash/version.

**And** the set has 5-10 minute estimated duration and one or two distinct primary objectives for one paper/part; retirement blocks future selection while active/completed attempts remain unchanged.

### Story 2.5: Verify Pilot Content Readiness

As an `academic_lead`,
I want a pre-pilot coverage check,
So that the centre knows whether published content can support learner choice and recommendations.

**Acceptance Criteria:**

**Given** approved and published P0 content
**When** the `academic_lead` or admin opens teacher-facing curriculum/assessment guidance and runs the readiness view
**Then** it reports distribution by all five engines, paper/part, selected topic, vocabulary/grammar target, approved essential media and estimated duration.

**And** it proves or flags the ability to compose varied 5-10 minute sets for each published topic/task-type choice, lists concrete coverage gaps, and never declares readiness from total item count alone.

## Epic 3: Learner-Selected Practice And Answer Review

Learners can choose short, media-ready P0 practice by topic or task type, use transparent history-based recommendations, recover drafts, submit exactly once and see answers only afterwards. This epic owns safe PWA caching and learner-facing offline/recovery behaviour.

**FRs covered:** FR-5–14, FR-18, FR-27

### Story 3.1: Choose Or Resume Practice

As a learner,
I want to choose published practice or use a recommendation and resume unfinished work,
So that I can practise at a suitable time without losing progress.

**Acceptance Criteria:**

**Given** a learner has signed in
**When** they open learner home
**Then** they can browse published sets by topic and task type, see title, paper/part, estimated time and `Start`, `Resume` or post-submission `Review` actions.

**And** recommendations use only the learner's own 30-day evidence, rank `needs practice` before `building` before other published content, explain the practice area without an official-result claim, record the recommendation version/shown set IDs, and never block manual selection.

### Story 3.2: Prepare Essential Media And Safe PWA Storage

As a learner,
I want to know that required media is ready before practice starts,
So that listening or picture tasks do not begin incomplete.

**Acceptance Criteria:**

**Given** a learner has selected a published immutable set snapshot and has not yet started an attempt
**When** the learner enters preparation
**Then** the app verifies essential authorised assets, displays preparation status by asset type, and blocks attempt creation until all essentials are available.

**And** readiness creates an open attempt bound to the immutable set snapshot, the service worker caches only application shell and authorised set assets, browser caches never contain answer-review/result/teacher-evidence payloads, and failed or expired media offers retry/leave without claiming readiness.

### Story 3.3: Complete The Five P0 Task Engines

As a learner,
I want to complete the five supported Starters task engines,
So that I can practise core reading and listening formats.

**Acceptance Criteria:**

**Given** an open prepared attempt containing P0 task items
**When** the learner selects, changes or enters an answer and uses allowed audio replay
**Then** responses and playback events are saved only while the attempt is open, controls are keyboard-operable with minimum 48 by 48 CSS-pixel targets, and no correctness indication is shown.

**And** text fields state their controlled input, word-bank choices remain editable until submission, picture choices have non-positional accessible labels, and replay/seek behaviour follows the snapshot playback policy governed by `GATE-PRODUCT-ASSUMPTIONS`.

### Story 3.4: Recover Open Attempts During Connectivity Loss

As a learner,
I want honest offline and recovery behaviour,
So that I know whether my practice is safely retained and what I need to do next.

**Acceptance Criteria:**

**Given** an open learner attempt
**When** connectivity is lost during practice
**Then** the app visibly reports offline status and retains a verified local draft in IndexedDB where available.

**And** offline before start blocks a set without essential media; offline submission preserves the open draft and requires reconnection without queueing or creating a partial result; unavailable/cleared storage reports recovery unavailable; account switch clears the prior account namespace; and a stale revision or key mismatch produces a stable conflict rather than overwriting/reattaching a draft.

### Story 3.5: Submit, Score And Review A Practice Set

As a learner,
I want to submit once and then check my answers,
So that feedback arrives only after I have completed the activity.

**Acceptance Criteria:**

**Given** an open attempt
**When** the learner opens submit confirmation
**Then** it states answered/unanswered counts and offers `Review questions` or explicit `Submit anyway` without forcing an answer.

**And** server submission locks the open write set, applies idempotent deterministic scoring in one transaction, persists final immutable item responses, automatic outcomes, attempt timing, retry/playback events, answer-policy version and curriculum tags from the published snapshot, projects evidence, rejects post-submit writes and returns the same result for a retry with the same idempotency key.

**Given** a submitted attempt
**When** the learner opens result or answer review
**Then** they can see only the snapshot-based response, approved answer, explanation and product-owned `secure`, `building`, `needs practice` or `not assessed yet` labels without pass/fail or official-result language.

## Epic 4: Teacher Evidence And Learner Guidance

Teachers can inspect every learner's submitted evidence and identify simple evidence states to guide an appropriate next practice choice. `academic_lead` and admin can also resolve uncertainty. All staff evidence reads are audit logged and require closed data-governance approval.

**FRs covered:** FR-15–18

### Story 4.1: View Centre-Wide Evidence And Actionable Gaps

As a teacher,
I want to see every learner's completed practice evidence,
So that I can guide a learner's next activity.

**Acceptance Criteria:**

**Given** `GATE-DATA-GOVERNANCE` is closed and submitted attempts exist
**When** a teacher opens the evidence dashboard
**Then** they can open any learner's evidence detail and the system audit logs the read with actor, target opaque ID, time and outcome; `teacher` remains read-only for content/evidence while `academic_lead` and admin may resolve uncertain outcomes.

**And** the dashboard applies the versioned 30-day rule: fewer than three assessable outcomes is `not assessed yet`, under 60% is `needs practice`, 60% to under 80% is `building`, and 80% or more is `secure` for the selected paper/part and language target; unresolved outcomes are excluded.

### Story 4.2: Filter And Drill Down Into Learner Evidence

As an `academic_lead` or admin,
I want to filter and inspect evidence at item level,
So that I can understand what a learner actually did before guiding them.

**Acceptance Criteria:**

**Given** authorised submitted evidence
**When** a teacher filters by learner, paper, part, vocabulary, grammar, spelling, names, numbers, colours, positions, topic, time range or practice set
**Then** summary and learner detail use the same filter semantics and direct drill-down reaches snapshot-based submitted responses, outcomes, timing and playback events.

**And** every evidence read is audit logged, learner details never expose another learner's information to a learner account, and no matching completed data shows `not assessed yet` rather than inferring a weakness.

### Story 4.3: Resolve Uncertain Item Outcomes

As a teacher,
I want to resolve an uncertain controlled response,
So that the learner's evidence can reflect a justified teaching decision.

**Acceptance Criteria:**

**Given** an item outcome marked `needs_teacher_review`
**When** the `academic_lead` or admin records a resolution
**Then** the system preserves the automatic outcome, actor, time and reason while creating the immutable effective outcome in one transaction.

**And** affected item evidence and aggregates update from effective outcome, while unresolved outcomes remain excluded from automatic correct-rate aggregates.

## Epic 5: Supervised First Practice

The centre can help a prospective learner use the published self-directed practice flow under supervision, review resulting evidence and deactivate the account when needed. It introduces no public acquisition flow or separate diagnostic template.

**FRs covered:** FR-25–26

### Story 5.1: Set Up A Supervised First Practice Session

As an admin,
I want to create a prospective learner account and help select a published practice set,
So that the centre can run a supervised first practice session without public sign-up.

**Acceptance Criteria:**

**Given** an admin and published sets
**When** the admin creates a prospective learner account and starts supervised practice
**Then** the system reuses the standard account, learner selection and practice-set snapshot flow rather than creating a separate diagnostic template or self-registration route.

**And** the account record displays creation date and active/deactivated status, while all learner-facing/result wording remains neutral practice language and never presents an official result.

### Story 5.2: Review First-Practice Evidence And Deactivate Access

As centre staff,
I want to review completed first-practice evidence and deactivate the account when appropriate,
So that I can support a placement conversation without leaving unnecessary active access.

**Acceptance Criteria:**

**Given** a supervised prospective learner has submitted a practice set
**When** authorised staff review the result
**Then** they can inspect evidence only for implemented parts through the same teacher evidence views, without a separate score or placement algorithm.

**And** when an admin confirms named deactivation, sessions are revoked and future login is denied while first-practice records remain retained; audit metadata excludes learner responses and automated expiry/purge remains out of P0.
