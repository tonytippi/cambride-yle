---
stepsCompleted:
  - requirements-extracted
  - epics-approved
  - stories-created
  - final-validation-passed
inputDocuments:
  - _bmad-output/specs/spec-cambridgeyle-p0/SPEC.md
  - _bmad-output/planning-artifacts/brief-CambridgeYLE-2026-08-17/brief.md
  - docs/starters-curriculum-and-assessment-blueprint.md
  - _bmad-output/planning-artifacts/ux-designs/ux-CambridgeYLE-2026-08-17/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-CambridgeYLE-2026-08-17/EXPERIENCE.md
  - _bmad-output/planning-artifacts/architecture/architecture-CambridgeYLE-2026-08-17/ARCHITECTURE-SPINE.md
---

# CambridgeYLE - Epic Breakdown

## Overview

This document decomposes the CambridgeYLE P0 specification into implementable, user-value-focused epics and stories. `SPEC.md` plus its companions remain the complete build contract.

## Requirements Inventory

### Functional Requirements

- FR1: Admin can create learner, teacher, and admin accounts; manage cohorts/enrolments; and deactivate accounts when required. [CAP-1]
- FR2: Learner can sign in, see assigned practice, verify media readiness, start/resume a draft, and recover in-progress responses. [CAP-2]
- FR3: Learner can complete picture true/false, picture yes/no, audio picture choice, audio name/number note-taking, and word-bank cloze tasks. [CAP-3]
- FR4: Learner receives answers, explanations, and practice evidence only after submitting a complete set. [CAP-4]
- FR5: System deterministically scores submitted items and persists immutable item-level response/evidence data. [CAP-5]
- FR6: Teacher can filter cohort/learner evidence, identify gaps, resolve uncertain outcomes, and assign approved practice. [CAP-6]
- FR7: Content editor can author, validate, review, mobile-preview, publish, and retire original/licensed/generated content. [CAP-7]
- FR8: Authorized user can compose approved questions into a practice set and assign it to a learner or cohort using immutable publication snapshots. [CAP-8]
- FR9: Admin can run a supervised prospective-learner diagnostic through approved practice-set infrastructure. [CAP-9]
- FR10: PWA reports readiness/connectivity and recovers local drafts without caching answer-review, result, or teacher-evidence data. [CAP-10]

### Non-Functional Requirements

- NFR1: Responsive, mobile-first learner experience; teacher/admin/editor surfaces are usable on tablet and efficient on desktop.
- NFR2: Meet WCAG 2.2 AA, including keyboard flow, 48px learner targets, screen-reader state announcements, non-color state cues, and safe media accommodations.
- NFR3: Server-side role/resource authorization, opaque server sessions, Argon2id password hashing, HTTPS-only production, generic login failures, and deactivated-account login denial.
- NFR4: Published set snapshots, media hashes/versions, answer policies, scoring outcomes, evidence, submission, publication, account deactivation, and teacher resolution remain consistent under retry/concurrency.
- NFR5: All learner content is original/licensed/approved-generated with provenance; no official-result/endorsement language, pass/fail, certificate, or shield UX.
- NFR6: Essential media preloads before an attempt begins; offline drafts persist locally; server remains source of truth and browser caches exclude sensitive result/evidence data.
- NFR7: PostgreSQL migrations are reviewed and ordered; boundaries validate with Zod; structured logs/audit avoid secrets, answers, responses, signed URLs, and raw audio.

### Additional Requirements

- Use the modular-monolith-with-ports-and-adapters architecture from `ARCHITECTURE-SPINE.md`.
- Use Next.js App Router/TypeScript with PostgreSQL, Drizzle migrations, Zod, private S3-compatible media storage, IndexedDB draft storage, and service-worker PWA caching.
- Only server use-cases authorize, validate, publish, score, aggregate evidence, resolve uncertain outcomes, deactivate accounts, and emit audit events.
- The P0 practice lifecycle is open draft -> atomic/idempotent submission -> post-submission answer review; post-submit writes are rejected.
- Content lifecycle is `draft -> in_review -> approved -> published -> retired`; publication accepts only approved question/media versions and captures immutable provenance/accessibility/answer-policy snapshots.
- P0 diagnostic is an admin-supervised assignment of an approved set to a pre-provisioned account, not a separate template or public flow.
- Story guardrail for Epic 2: publish-blocking validation must name the failing reason; status transitions, phone preview, accessible-media handling, and the prohibition on AI self-publication require explicit acceptance criteria.
- Story guardrail for Epic 2: include a pre-pilot content-readiness checkpoint that verifies approved item/asset distribution across all five P0 engines, paper/part, selected topic, vocabulary/grammar target, essential media, estimated duration, and composition into 5-10 minute sets; it must list coverage gaps rather than imply readiness from item count alone.
- Story guardrail for Epic 3: first-use post-submit guidance, save-and-leave, unanswered-submit, media/preload/offline/recovery states, and post-submit-only answer review require explicit acceptance criteria.
- Story guardrail for Epic 3: distinguish offline before start (block start when essential assets are unavailable), offline during an open attempt (retain a verified local draft and show offline), offline at submission (preserve the open draft and require reconnection without creating a partial result), and unavailable/cleared local storage or expired authorized-media URLs (show only verified save/retry states). The application must not claim recovery or readiness it cannot verify.
- Story guardrail for Epic 4: cohort-summary and learner-detail filters stay aligned; unresolved teacher-review outcomes are excluded from automatic aggregates; evidence access follows historical cohort scope; assignment accepts approved sets only.
- Story guardrail for Epic 4: the cohort view must yield a concrete, teacher-actionable gap statement rather than require a teacher to infer an intervention from raw-only analytics. Each summary must show affected learner count, paper/part, vocabulary/grammar/topic target, `needs practice` status, and direct drill-down to submitted item responses; it must not add AI lesson recommendations in P0.
- Story guardrail for Epic 5: diagnostic reuses the approved-set assignment path, uses non-official practice wording, limits review to implemented-part evidence, and supports account deactivation without placing learner responses in audit metadata.
- Story guardrail for Epic 5: diagnostic account records expose creation date and status so manual deactivation remains discoverable; automated expiry and irreversible purge remain out of P0.

### UX Design Requirements

- UX-DR1: Implement the DESIGN.md tokens and calm, child-friendly learning workspace; avoid game mechanics, ranking, streaks, trophies, Cambridge marks, and official-result claims.
- UX-DR2: Implement learner home, media preparation, player, submit confirmation, result summary, answer review, and explicit save-and-leave behavior.
- UX-DR3: Implement all five P0 engine response patterns with post-submit-only correctness and accessible selection/text/audio controls.
- UX-DR4: Implement media readiness, offline, local recovery, unanswered-submit, scoring, empty-evidence, teacher-review, permission, and retired-content states.
- UX-DR5: Implement teacher cohort dashboard, learner evidence detail, evidence filters, and approved-set assignment flow with responsive table/card behavior.
- UX-DR6: Implement admin accounts/cohorts, content library/editor/review, set composer, diagnostic setup, and explicit named account-deactivation confirmation.
- UX-DR7: Enforce WCAG 2.2 AA behavioral requirements, including accessible alternative tasks where media would reveal answers.

### FR Coverage Map

- FR1: Epic 1 - Centre-managed access and cohorts
- FR2: Epic 1, Epic 3 - Authenticated learner access; learner practice readiness/recovery
- FR3: Epic 3 - Five P0 learner task engines
- FR4: Epic 3 - Atomic submit and post-submit review
- FR5: Epic 3, Epic 4 - Deterministic scores then teacher evidence
- FR6: Epic 4 - Teacher evidence and assignment
- FR7: Epic 2 - Safe content lifecycle
- FR8: Epic 2, Epic 4 - Publication/composer then teacher assignment
- FR9: Epic 5 - Supervised diagnostic
- FR10: Epic 3 - Learner PWA safety, media readiness, and local recovery

## Epic List

### Epic 1: Centre-Managed Access And Cohorts

Admin can create and manage the centre's learner/teacher/admin accounts and cohorts, deactivate accounts with the required confirmation and session revocation, and ensure each signed-in user reaches only authorized role- and cohort-scoped surfaces.

**FRs covered:** FR1, FR2 (authentication and scope)

### Epic 2: Safe Starters Practice Content

Content editors can create, validate, review, phone-preview, publish, retire, and compose original approved Starters practice sets with immutable, auditable content/media snapshots. Curriculum tags, provenance, accessible-media behavior, and responsive preview are publish-blocking.

**FRs covered:** FR7, FR8

### Epic 3: Learner Practice And Answer Review

Learners can reliably complete short, media-ready P0 practice sets on phone or desktop, recover drafts, receive clear connectivity/readiness states, submit exactly once, and see answers only afterwards. This epic owns safe PWA caching and all learner-facing offline/recovery behavior.

**FRs covered:** FR2, FR3, FR4, FR5, FR10

### Epic 4: Teacher Evidence And Targeted Follow-Up

Teachers can turn submitted practice into cohort/learner evidence, resolve uncertainty, identify concrete gaps, and assign approved follow-up practice.

**FRs covered:** FR5, FR6, FR8

### Epic 5: Supervised Prospective-Learner Diagnostic

The centre can demonstrate the approved practice experience to a prospective learner under supervision, review resulting evidence, and complete the account deactivation journey when needed. It introduces no public acquisition flow or separate diagnostic template.

**FRs covered:** FR1, FR9

## Epic 1: Centre-Managed Access And Cohorts

Admin can create and manage the centre's learner/teacher/admin accounts and cohorts, deactivate accounts with the required confirmation and session revocation, and ensure each signed-in user reaches only authorized role- and cohort-scoped surfaces.

### Story 1.1: Establish The Application Foundation

As a centre administrator,
I want a secure, deployable application foundation,
So that centre-managed features can be built and operated consistently.

**Acceptance Criteria:**

**Given** a new local or staging environment
**When** the application is started
**Then** it runs as the prescribed Next.js/TypeScript modular monolith with startup-validated server configuration, health endpoint, and HTTPS-ready security headers.

**And** PostgreSQL access uses reviewed Drizzle migrations, structured logs omit secrets/learner responses, and the responsive base layout implements the DESIGN.md tokens with visible keyboard focus.

### Story 1.2: Admin-Created Accounts And Secure Sign-In

As an admin-created user,
I want to sign in securely to my role-specific home,
So that I can access only the centre functions assigned to me.

**Acceptance Criteria:**

**Given** an admin has created an active learner, teacher, or admin account with a password
**When** that user submits valid credentials
**Then** the server creates an opaque Secure HttpOnly SameSite=Lax session and routes the user to their role-appropriate home.

**And** passwords are Argon2id hashes, invalid/unknown/deactivated account attempts return the same generic failure, login attempts are throttled, and browser navigation alone cannot grant a protected role.

### Story 1.3: Manage Cohorts And Enrolments

As an admin,
I want to create cohorts and manage learner and teacher enrolments,
So that practice and evidence are scoped to the centre's real classes.

**Acceptance Criteria:**

**Given** active centre accounts
**When** an admin creates a cohort and adds/removes learners or assigns teachers
**Then** each enrolment and teacher-cohort assignment is persisted with audit data and appears in the relevant admin view.

**And** teacher access is denied outside assigned cohorts, learner access is limited to their own records, and assignment/attempt creation captures its cohort scope for historical evidence access.

### Story 1.4: Deactivate A Centre Account

As an admin,
I want to deactivate an account explicitly,
So that a departed or unneeded user cannot sign in again without losing pilot records accidentally.

**Acceptance Criteria:**

**Given** an active account detail
**When** an admin confirms the named deactivation action
**Then** the server sets `deactivated_at` and `deactivated_by`, revokes active sessions, blocks future authentication/authorization, and records an audit event with no learner response content.

**And** practice and diagnostic records remain retained, the admin UI shows deactivated status/history, and automatic expiry or irreversible purge is not implemented.

## Epic 2: Safe Starters Practice Content

Content editors can create, validate, review, phone-preview, publish, retire, and compose original approved Starters practice sets with immutable, auditable content/media snapshots. Curriculum tags, provenance, accessible-media behavior, and responsive preview are publish-blocking.

### Story 2.1: Maintain Curriculum Targets And Answer Policies

As a content editor,
I want controlled Starters vocabulary, grammar, topic, and answer-policy records,
So that each item can be validated and scored consistently.

**Acceptance Criteria:**

**Given** the approved Starters curriculum reference
**When** an editor creates or updates a target and answer policy
**Then** the system stores canonical target identifiers and a versioned machine-readable policy with exact normalization/matching semantics.

**And** policy conformance vectors cover each input kind used by the five P0 engines, while out-of-level vocabulary/grammar, unapproved names/numbers, and invalid task-template limits produce validation findings.

### Story 2.2: Author Questions And Approved Media Drafts

As a content editor,
I want to create question and media drafts with all required metadata,
So that original practice content can enter academic review safely.

**Acceptance Criteria:**

**Given** an authenticated editor
**When** they author a P0 question and attach media
**Then** the draft records level, task type, paper/part, prompt/options, answer policy, primary language target IDs, primary/supporting vocabulary IDs, introduced vocabulary IDs, primary/supporting grammar IDs, topic IDs, estimated duration, accessibility metadata, and immutable provenance fields.

**And** every image/audio/script/feedback record identifies origin as original, licensed, or generated with creator/source, applicable rights/license reference, and generation metadata where applicable; generated content remains a draft.

### Story 2.3: Validate, Review, And Phone-Preview Content

As an academic reviewer,
I want validation findings and a phone-width preview before approval,
So that unsuitable, inaccessible, ambiguous, or unlicensed material cannot reach learners.

**Acceptance Criteria:**

**Given** a question in `draft` or `in_review`
**When** validation or review is run
**Then** the editor sees named publish-blocking findings for missing tags/keys/alternatives/media, curriculum limits, media approval, provenance, and accessibility requirements.

**And** the reviewer can inspect phone-width prompt/media/answer controls, learner-facing accessibility content cannot reveal answers, media-dependent tasks require an approved equivalent accommodation where required, only an authorized human may transition a valid item through `draft -> in_review -> approved`, and each review/approval status mutation is audit logged.

### Story 2.4: Publish Immutable Practice Sets

As a content editor,
I want to compose and publish approved questions into a practice set,
So that learners receive a stable, auditable activity.

**Acceptance Criteria:**

**Given** approved P0 question and media versions
**When** an authorized editor publishes a valid question/media version, composes it into a set, or later retires source content
**Then** question/media lifecycle transitions enforce `approved -> published -> retired` with audit events, the composer accepts only published approved versions, and set publication atomically creates immutable item snapshots with rendered content, answer policy, tags, feedback, accessibility metadata, provenance, and write-once media hash/version.

**And** the set has 5-10 minute estimated duration, contains only its selected paper/part objectives, its own lifecycle follows `approved -> published -> retired` with audit events, snapshot media binaries remain write-once and retained while any published set or attempt references them, and retiring/editing source content cannot change an already published snapshot.

### Story 2.5: Verify Pilot Content Readiness

As an academic lead,
I want a pre-pilot coverage check,
So that the centre knows whether approved content can support the planned practice cycle.

**Acceptance Criteria:**

**Given** approved and published P0 content
**When** the academic lead runs the readiness view
**Then** it reports distribution by all five engines, paper/part, selected topic, vocabulary/grammar target, approved essential media, and estimated duration.

**And** it proves or flags the ability to compose varied 5-10 minute sets, lists concrete coverage gaps, and never declares readiness from total item count alone.

### Story 2.6: Make Published Practice Available To Learners

As an admin,
I want to assign a published practice set to a learner or cohort,
So that pilot learners have an authorized set available before teacher follow-up workflows exist.

**Acceptance Criteria:**

**Given** an admin has authorized learner/cohort scope and a published immutable set version exists
**When** the admin assigns that set
**Then** the server captures the learner/cohort scope, audit logs the assignment, and shows the set on each eligible learner home surface.

**And** draft, in-review, approved-but-unpublished, and retired content cannot be assigned, and this assignment uses the same immutable set-version contract that later teacher assignments reuse.

## Epic 3: Learner Practice And Answer Review

Learners can reliably complete short, media-ready P0 practice sets on phone or desktop, recover drafts, receive clear connectivity/readiness states, submit exactly once, and see answers only afterwards. This epic owns safe PWA caching and all learner-facing offline/recovery behavior.

### Story 3.1: Start Or Resume An Assigned Practice Set

As a learner,
I want to see assigned practice and resume unfinished work,
So that I can complete the activity at a suitable time without losing progress.

**Acceptance Criteria:**

**Given** a learner has an authorized assigned published set
**When** they open learner home
**Then** they see title, paper/part, estimated time, and `Start`, `Resume`, or post-submission `Review` as appropriate, plus first-use guidance that answers appear only after complete submission.

**And** `Start` first routes to media preparation rather than creating an attempt, `Resume` opens a previously created open draft, `Save and leave` preserves only an open draft, and `Start again` requires confirmation without altering prior submitted attempts.

### Story 3.2: Prepare Essential Media And Safe PWA Storage

As a learner,
I want to know that required media is ready before practice starts,
So that listening or picture tasks do not begin incomplete.

**Acceptance Criteria:**

**Given** a learner has an authorized assignment to a published immutable set snapshot and has not yet started an attempt
**When** the learner enters preparation
**Then** the app verifies essential authorized assets, displays preparation status by asset type, and blocks attempt creation until all essentials are available.

**And** once readiness succeeds the server creates an open attempt bound to the immutable set snapshot, the service worker caches only application shell and authorized set assets, browser caches never contain answer-review/result/teacher-evidence payloads, and a failed or expired media URL offers retry/leave without claiming readiness.

### Story 3.3: Complete Selection-Based Practice Tasks

As a learner,
I want to answer true/false, yes/no, and audio picture-choice questions,
So that I can practise core Starters reading and listening formats.

**Acceptance Criteria:**

**Given** an open prepared attempt containing `picture_true_false`, `picture_yes_no`, or `audio_picture_choice` items
**When** the learner selects or changes an answer and uses allowed audio replay
**Then** the response and playback events are saved only while the attempt is open, with one large accessible choice at a time and no correctness indication.

**And** controls are keyboard-operable with minimum 48 by 48 CSS-pixel touch targets, announce question position, selection, and audio state, picture choices have non-positional accessible labels, and replay/seek behavior follows the snapshot playback policy.

### Story 3.4: Complete Controlled Text And Cloze Tasks

As a learner,
I want to enter dictated names/numbers and complete word-bank cloze items,
So that I can practise controlled listening and reading/writing responses.

**Acceptance Criteria:**

**Given** an open prepared attempt containing `audio_note_taking` or `word_bank_cloze` items
**When** the learner enters a response or maps words to blanks
**Then** the app preserves the entered response without spelling hints, partial correctness, or answer disclosure.

**And** fields and word-bank controls are keyboard-operable with minimum 48 by 48 CSS-pixel touch targets, fields state their expected controlled input, word-bank assignment remains editable until submission, and answer data is validated server-side against the attempt snapshot rather than browser heuristics.

### Story 3.5: Recover Open Attempts During Connectivity Loss

As a learner,
I want honest offline and recovery behavior,
So that I know whether my practice is safely retained and what I need to do next.

**Acceptance Criteria:**

**Given** an open learner attempt
**When** connectivity is lost during practice
**Then** the app visibly reports offline status and retains a verified local draft in IndexedDB where available.

**And** offline before start blocks a set without essential media, offline submission preserves the open draft and requires reconnection without creating a partial result, unavailable/cleared storage reports that recovery is unavailable, and the UI never claims a save/recovery it cannot verify.

### Story 3.6: Submit, Score, And Review A Practice Set

As a learner,
I want to submit once and then check my answers,
So that feedback arrives only after I have completed the activity.

**Acceptance Criteria:**

**Given** an open attempt
**When** the learner opens submit confirmation
**Then** it states answered/unanswered counts and offers `Review questions` or explicit `Submit anyway` without forcing an answer.

**And** server submission locks the open write set, applies idempotent deterministic scoring in one transaction, persists final immutable item responses, automatic outcomes, attempt timing, retry/playback events, answer-policy version, and curriculum tags from the published snapshot, projects evidence, rejects post-submit writes, and returns the same result for a retry with the same idempotency key.

**Given** a submitted attempt
**When** the learner opens result or answer review
**Then** they can see only the snapshot-based response, approved answer, explanation, and product-owned `secure`, `building`, `needs practice`, or `not assessed yet` labels without pass/fail or official-result language.

## Epic 4: Teacher Evidence And Targeted Follow-Up

Teachers can turn submitted practice into cohort/learner evidence, resolve uncertainty, identify concrete gaps, and assign approved follow-up practice.

### Story 4.1: View Cohort Evidence And Actionable Gaps

As a teacher,
I want a cohort summary of completed practice evidence,
So that I can prepare a targeted offline activity before class.

**Acceptance Criteria:**

**Given** a teacher assigned to a cohort with submitted attempts
**When** they open the cohort dashboard
**Then** they see product-owned evidence states and a concrete `needs practice` gap statement containing affected learner count, paper/part, and vocabulary/grammar/topic target.

**And** unresolved `needs_teacher_review` outcomes are excluded from automatic aggregates, the dashboard does not use pass/fail, official-result claims, or AI lesson recommendations, and no matching completed data shows `not assessed yet` rather than inferring a weakness.

### Story 4.2: Filter And Drill Down Into Learner Evidence

As a teacher,
I want to filter and inspect evidence at item level,
So that I can understand what a learner actually did before class.

**Acceptance Criteria:**

**Given** authorized submitted evidence
**When** a teacher filters by learner, cohort, paper, part, vocabulary, grammar, topic, time range, or practice set
**Then** cohort summary and learner detail use the same filter semantics and direct drill-down reaches snapshot-based submitted responses, outcomes, timing, and playback events.

**And** access is evaluated against the attempt's cohort-scope snapshot and the teacher's current cohort assignment, preventing access to another cohort while preserving consistent transfer/unenrolment behavior.

### Story 4.3: Resolve Uncertain Item Outcomes

As a teacher,
I want to resolve an uncertain controlled response,
So that the learner's evidence can reflect a justified teaching decision.

**Acceptance Criteria:**

**Given** an item outcome marked `needs_teacher_review`
**When** an authorized teacher records a resolution
**Then** the system preserves the automatic outcome, actor, time, and reason while creating the immutable effective outcome in one transaction.

**And** affected item evidence and aggregates update from effective outcome, while unresolved outcomes remain excluded from automatic correct-rate aggregates.

### Story 4.4: Assign Approved Follow-Up Practice

As a teacher,
I want to assign an approved practice set to a learner or cohort,
So that identified gaps can be reinforced through the next online activity.

**Acceptance Criteria:**

**Given** a teacher has authorized learner/cohort scope and published sets exist
**When** they assign a set
**Then** the server accepts only a published immutable set version, captures the cohort scope, and shows the assignment on eligible learner home surfaces.

**And** the teacher cannot assign to an unauthorized cohort or select draft/in-review/approved-but-unpublished/retired content, and assignment mutations are audit logged.

## Epic 5: Supervised Prospective-Learner Diagnostic

The centre can demonstrate the approved practice experience to a prospective learner under supervision, review resulting evidence, and complete the account deactivation journey when needed. It introduces no public acquisition flow or separate diagnostic template.

### Story 5.1: Set Up A Supervised Diagnostic

As an admin,
I want to create a prospective learner account and assign an approved practice set,
So that the centre can run a supervised readiness demonstration without public sign-up.

**Acceptance Criteria:**

**Given** an admin and a published set
**When** the admin creates a prospective learner account and diagnostic assignment
**Then** the system reuses the standard account, assignment, and practice-set snapshot flow rather than creating a separate diagnostic template or self-registration route.

**And** the account record displays creation date and active/deactivated status, while all learner-facing/result wording remains neutral practice language and never presents an official result.

### Story 5.2: Review Diagnostic Evidence And Deactivate Access

As centre staff,
I want to review completed diagnostic evidence and deactivate the account when appropriate,
So that I can support a placement conversation without leaving unnecessary active access.

**Acceptance Criteria:**

**Given** a supervised prospective learner has submitted a diagnostic assignment
**When** authorized staff review the result
**Then** they can inspect evidence only for implemented parts through the same teacher evidence views, without a separate score or placement algorithm.

**And** when an admin confirms named deactivation, sessions are revoked and future login is denied while diagnostic/practice records remain retained; audit metadata excludes learner responses and automated expiry/purge remains out of P0.
