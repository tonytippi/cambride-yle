---
title: CambridgeYLE P0 PRD
status: approved-with-open-gates
created: 2026-08-17
updated: 2026-08-18
sources:
  - ../../brief-CambridgeYLE-2026-08-17/brief.md
  - ../../../../docs/starters-curriculum-and-assessment-blueprint.md
  - ../../../../docs/source-manifest.md
derived_artifacts:
  - ../../../specs/spec-cambridgeyle-p0/SPEC.md
  - ../../ux-designs/ux-CambridgeYLE-2026-08-17/EXPERIENCE.md
  - ../../ux-designs/ux-CambridgeYLE-2026-08-17/DESIGN.md
  - ../../architecture/architecture-CambridgeYLE-2026-08-17/ARCHITECTURE-SPINE.md
  - ../../epics.md
---

# CambridgeYLE P0

> **Product authority.** This PRD owns product scope, requirements, decision status and release gates. The SPEC indexes implementation contracts; the curriculum, architecture, experience and design companions own their respective domain detail. Epics only decompose and trace. The historical brief and addendum are superseded. This suite is not implementation-ready or pilot-ready while a blocking gate below remains open.

## Product Decision

CambridgeYLE P0 is a responsive web application and installable PWA for existing Pre A1 Starters learners at a centre. Learners choose brief, original online practice by topic or task type, or start a published recommendation based on their own evidence history. The product records item-level evidence; teachers use that evidence to guide the learner.

P0 releases **Starters only**. Movers and Flyers are deferred until Starters pilot evidence validates the operating loop, content workflow, and learner experience. The product must keep curriculum and content records level-aware so later levels can reuse the same operating model without a redesign.

This product is practice support, not an official Cambridge examination service. It must never represent practice evidence as an official score, pass/fail result, certificate, or Cambridge endorsement.

## Problem And Opportunity

Teachers currently receive home-practice scores without the detail needed to decide whether a learner needs help with a particular paper part, vocabulary/grammar target, spelling, names, numbers, or listening behaviour. This turns offline intervention into broad rechecking rather than focused teaching.

The P0 opportunity is an online-to-offline evidence loop:

```text
Learner completes short practice
-> product stores response-level evidence
-> teacher identifies a recurring, specific gap
-> teacher prepares an offline reinforcement activity
-> learner practises again and progress is visible
```

The centre may also use a published practice set as a supervised first-practice session for a prospective learner. This supports a placement conversation; it is not a public acquisition, registration, or admissions workflow.

## Pilot Outcome And Measures

Within a 4-6 week pilot, learners can start short Starters practice independently, and teachers can identify concrete gaps from the shared evidence history and use those gaps to guide a focused offline activity.

The pilot succeeds when:

- At least 70% of active pilot learners complete two practice sets each week.
- Teachers identify at least two concrete learning gaps for each active learner before the relevant offline session.
- Teachers report less time checking home practice than in the current process.
- At least 80% of published pilot items require no correction for ambiguity after learner use.
- At least one supervised prospective-learner demonstration completes end-to-end without self-registration.
- No critical mobile audio, answer-loss, or account-access problem blocks completion of a learner-selected set.

Measurement definitions:

- **Weekly completion:** active learners with at least two completed practice sets in the pilot week / active pilot learners at the end of that week. Deactivated learners are excluded from subsequent weeks. The pilot owner calculates it from the system of record; a product analytics/export feature is not added to P0.
- **Actionable gap coverage:** for each active learner, a teacher records at least two evidence-backed gaps in the pilot's external operational worksheet. A gap names paper/part and a language target and records the supporting dashboard drill-down reference. `Not assessed yet` is a separate coverage exception and does not count. An in-product intervention/gap record is not a P0 capability.
- **Teacher time:** each pilot teacher records minutes in an external pilot log for one baseline week and weekly during P0. Compare the per-teacher weekly median and collect a short explanation for material changes; this does not add a time-tracking feature.
- **Item ambiguity:** the academic lead maintains an external correction log. The measure is published items without an ambiguity correction / published items used by at least one learner during the pilot.
- **Critical completion issue:** a confirmed incident that prevents a learner from signing in, selecting a published set, starting essential media, retaining an open answer, submitting after reconnection, or accessing the submitted result. The pilot owner maintains the external incident log; incident-management tooling is outside P0.

Counter-metrics to monitor:

- Practice completion must not be raised by revealing correctness before submission or using punitive/game-like mechanics.
- Dashboard usage must lead to a specific offline intervention, not merely more reporting activity.
- Content volume must not be treated as readiness when items do not cover all implemented engines, targets, media needs, and 5-10 minute set compositions.

## Users And Product Boundaries

| User | Need | P0 authority |
| --- | --- | --- |
| Learner | Choose understandable, short Starters practice without losing work or receiving premature answers. | Access only own published practice choices, recommendations, attempts and results. |
| Teacher | Identify actionable learner gaps and guide follow-up practice. | Read detailed evidence history for every learner account and read published practice content. |
| Academic lead | Confirm curriculum/content quality and create or improve practice content. | Create, edit and rerun AI drafts; approve and publish reviewed content; run content-readiness guidance. |
| Admin | Operate the centre workspace. | All P0 permissions, including account/role management and every academic-lead capability. |

P0 excludes self-registration, parent accounts, payment, public checkout, admissions workflows, cohorts/classes, teacher-directed assignments, native applications, Movers/Flyers content, a full Starters-style mock, automated speaking scoring, learner speaking recordings, chat/tutor features, and publishing unreviewed AI-generated material.

## Product Scope

### Learner Practice

P0 delivers short, 5-10 minute, single-paper/part Starters practice sets targeting one or two learning objectives for these five engines:

1. Reading and Writing Part 1: `picture_true_false`.
2. Reading and Writing Part 2: `picture_yes_no`.
3. Listening Part 3: `audio_picture_choice`.
4. Listening Part 2: `audio_note_taking` for dictated names/numbers.
5. Reading and Writing Part 4: `word_bank_cloze`.

Learner flow: sign in -> choose a published set by topic/task type or accept a history-based recommendation -> prepare essential media -> complete answers -> intentionally submit or reconnect -> review answers and child-friendly feedback.

### Teacher Evidence

Teachers can review completed evidence for every learner account by learner, paper, part, vocabulary target, grammar target, spelling, names, numbers, colours, positions, topic, practice set, and time range. The dashboard uses only the evidence states `secure`, `building`, `needs practice`, and `not assessed yet`; it must state a concrete `needs practice` gap and drill down to submitted responses.

An `academic_lead` or `admin` may resolve controlled responses marked `needs_teacher_review`; the automatic result and the resolver's reason remain auditable. Unresolved outcomes are excluded from automatic correctness aggregates.

A `needs practice` statement is shown when the selected filter includes at least three assessable submitted items for the same paper/part and language target in the last 30 days, and fewer than 60% of automatically assessable or teacher-resolved outcomes are correct. From 60% to under 80% shows `building`; 80% or more shows `secure`; fewer than three assessable items, or an all-unresolved selection, shows `not assessed yet`. This versioned rule is not a teacher-side dashboard setting.

### Content And Accounts

Admins create learner, teacher, `academic_lead` and admin accounts and explicitly deactivate accounts. `teacher` can read published content and evidence but cannot create, change, approve or publish content. `academic_lead` can author, validate, create/supply AI drafts, edit, rerun, preview, approve, publish, retire and compose content; `admin` has all these permissions and manages roles. Each lifecycle transition records its actor and timestamp. An AI provider may create structured drafts only after `GATE-AI-DRAFT-PROVIDER` closes; every version still requires manual academic-lead/admin approval and publication. `GATE-ACADEMIC-SOURCES` requires the `academic_lead` role to verify imported-source editions, provenance, citations and discrepancies before public curriculum claims; it does not require naming a person outside the system. `GATE-CONTENT-PLAN` is satisfied through teacher-facing content guidance and academic-lead/admin approval of each publication, not a fixed item quota.

Question, media and practice-set publication have separate versioned lifecycles: `draft -> in_review -> approved -> published -> retired`, plus `in_review -> rejected -> new draft version`. Revision never mutates a published version; retirement blocks future selection but grandfathers active/completed attempts through immutable snapshots. AI-originated material is always a draft until human content and academic review completes.

### Supervised First Practice

An admin can create a learner account for a supervised first practice session. The learner selects a published set through the standard self-directed flow, and teachers review resulting evidence through the normal evidence surfaces using neutral practice wording. The account can later be deactivated; P0 does not automatically expire or irreversibly purge it.

## User Journeys

### UJ-1: Linh Completes Practice

Linh, age 7, uses her mother's phone after class. She signs in to the account created by the centre, chooses `Animals` and Listening Part 3 from published practice, and sees a six-minute recommended set because it targets a recent `needs practice` area. She waits for its audio and images to confirm readiness. She answers one question at a time, can replay permitted audio and change answers, but sees no correctness, score, or answers. At the end she sees answered/unanswered counts, explicitly submits, then reviews her response, approved answer, explanation, and calm practice feedback. Every signed-in teacher can inspect the evidence.

If essential media fails before start, Linh sees which asset failed and can retry or leave; the set cannot start incomplete. If connectivity fails during an open attempt, the app retains only a verified local draft and makes clear that submission requires reconnection.

### UJ-2: Mai Plans An Intervention

Mai, a Starters teacher, opens the learner evidence dashboard twenty minutes before class. She filters completed attempts from the last week and sees that Linh needs practice with numbers in Listening Part 2. She opens Linh's detail to inspect submitted name/number responses, attempt time, playback events, and uncertain outcomes. Mai plans a number-dictation activity and points Linh to the published `Numbers` practice category.

If no completed practice matches a filter, the dashboard shows `not assessed yet`, not a learning deficiency.

### UJ-3: An Publishes Safe Practice

An, an `academic_lead`, chooses a curriculum/assessment guide and asks the configured OpenAI-compatible gateway for a structured draft question. An reviews or edits its target tags, answer policy, original media plan and provenance, then reruns the draft if needed. Validation reports any missing or out-of-level data. An previews it in a phone-width surface and manually publishes it only after approval. An then composes published question/media versions into a set and publishes the immutable set version for learner selection. Source revision or retirement cannot alter an attempt snapshot.

### UJ-4: Quang Runs A Diagnostic

Quang, a centre admin, creates a prospective learner account and helps the learner select a published practice set while supervising the session. After submission, Quang or a teacher reviews evidence for implemented parts to support a placement conversation. If the family does not continue, Quang explicitly confirms deactivation, ending future access while retaining P0 records and audit metadata according to policy.

## Functional Requirements

### Account Management And Access

- **FR-1.** An admin can create learner, teacher, `academic_lead` and admin accounts, assign their roles, and provision their sign-in access.
- **FR-2.** A signed-in learner can access only their own practice choices, open attempts and submitted results. Every signed-in `teacher`, `academic_lead` and `admin` can access detailed evidence history for every learner account; the system audit logs every evidence read and mutation.
- **FR-3.** An admin can view and manage account roles and activation status. `teacher` is read-only for published content/evidence; `academic_lead` can create, edit, rerun, approve and publish content; `admin` has all permissions. P0 has no cohort, class or teacher-assignment model.
- **FR-4.** An admin can explicitly deactivate an account after a named confirmation. Deactivation revokes active sessions, blocks future sign-in, preserves practice/first-practice records, and records an audit event without learner-response content.

### Learner Practice

- **FR-5.** A learner can sign in, choose published practice by topic or task type, view a recoverable open draft and history-based recommendations, and see title, paper/part, estimated duration, and `Start`, `Resume`, or `Review` actions. Recommendations rank published sets that target `needs practice`, then `building`, and then other available content; they never claim an official result or hide learner choice.
- **FR-6.** Before starting, the learner can verify all essential authorised media assets. The system blocks attempt creation until essential media is available and identifies failed assets with retry and leave actions.
- **FR-7.** A learner can complete the five P0 task engines, change an open response, and use audio only under the snapshot playback policy. P0 supports `unlimited_replay` and `max_replays` policies; an item declares the allowed replay count, seeking is unavailable unless explicitly allowed, the remaining replay count is displayed when limited, and every play/replay event is stored with the open attempt.
- **FR-8.** The product must not show correctness, answers, explanations, predicted scores, or score-like UI before final submission.
- **FR-9.** The learner can save and leave an open practice set without silent loss. The application preserves a verified local draft where available and communicates offline, save, and recovery states honestly.
- **FR-10.** The learner can review answered/unanswered counts, return to questions, or explicitly submit with unanswered items recorded as unanswered.
- **FR-11.** On submission, the system stores the final responses and returns only post-submission result data. The learner can then review their responses, approved answers, explanations, and product-owned practice labels.

### Scoring And Evidence

- **FR-12.** The system deterministically scores all implemented Listening and Reading/Writing items against the versioned answer policy attached to the submitted item.
- **FR-13.** The system stores item-level response, automatic outcome, submitted time, playback/retry evidence, answer-policy version, and curriculum tags needed for later analysis, including language-target dimensions for vocabulary, grammar, spelling, names, numbers, colours, and positions where applicable.
- **FR-14.** The system reports only `correct`, `incorrect`, `unanswered`, or `needs_teacher_review` as automatic outcomes and does not silently treat uncertain short answers as correct. A submission retry using the same idempotency key returns the saved final result; a different key after finalisation and every post-submission write are rejected with a stable conflict result.
- **FR-15.** Every signed-in teacher can view completed evidence for every learner account; filter by learner, paper, part, vocabulary, grammar, spelling, names, numbers, colours, positions, topic, time range, and practice set; and drill down to submitted item responses. Every evidence read is audit logged.
- **FR-16.** The teacher dashboard presents an actionable gap statement with evidence state, paper/part, and relevant language target. It does not issue AI lesson recommendations in P0.
- **FR-17.** An `academic_lead` or `admin` can resolve `needs_teacher_review` outcomes with a reason. The system preserves the automatic outcome and recalculates affected evidence from the effective outcome.
- **FR-18.** The system can recommend published practice sets to a learner from their own evidence history without making a teacher assignment. The learner can always choose another published set by topic or task type.

### Content And Publication

- **FR-19.** An `academic_lead` or `admin` can author question and media drafts, or request, edit and rerun structured AI-generated drafts through the configured OpenAI-compatible gateway after `GATE-AI-DRAFT-PROVIDER` closes. Every draft records level, paper, part, task type, prompt/options, answer policy, a primary learning-objective identifier, supporting curriculum tags, estimated duration, accessibility metadata and immutable provenance metadata.
- **FR-20.** Before review or publication, validation identifies missing tags, answer keys/alternatives, required media, approved names/numbers, task-template limits, out-of-level vocabulary/grammar, provenance gaps, and accessibility issues.
- **FR-21.** Only an `academic_lead` or `admin` can move valid content through the lifecycle. Generated content cannot bypass content review, academic approval, or phone-width preview.
- **FR-22.** An `academic_lead` or `admin` can publish approved question/media versions and compose only published versions into a 5-10 minute, single-paper/part practice set. Composition validates that the set contains one or two distinct primary learning-objective identifiers and reports a publication-blocking finding otherwise.
- **FR-23.** Publication preserves an immutable snapshot of the question, media, answer policy, feedback, tags, accessibility metadata and provenance. Later source edits or retirement cannot alter an active or completed attempt.
- **FR-24.** An `academic_lead` or `admin` can open teacher-facing curriculum/assessment guidance, use it to create or review practice content, and run a readiness view by P0 engine, paper/part, topic, vocabulary/grammar target, essential media and duration; the view must list coverage gaps without imposing a fixed item quota.

### First Practice And PWA

- **FR-25.** An admin can provision a prospective learner account and start a supervised first practice session through the standard account/self-directed-practice/publication workflow, without self-registration or a separate diagnostic template.
- **FR-26.** Authorised staff can inspect first-practice evidence only for implemented parts and deactivate the account through the standard named deactivation flow.
- **FR-27.** The PWA communicates media readiness and connectivity, caches only the application shell and authorised set assets, and keeps open-attempt recovery separate from answer review, results, and teacher evidence.

## Non-Functional Requirements

- **NFR-1 Responsive experience.** Learner practice is mobile-first. Teacher/admin/editor work is usable on tablet and efficient on desktop, with responsive card alternatives for key tables. [ASSUMPTION] Pilot support covers the current and immediately previous stable versions of Safari on iOS, Chrome on Android, and Chrome, Safari, Edge, and Firefox on desktop; PWA installation is optional and unavailable installation must not block browser use.
- **NFR-2 Accessibility.** The product meets WCAG 2.2 AA. Learner controls have 48 by 48 CSS-pixel minimum targets; keyboard order follows instruction order; focus and state are visible and announced; critical meaning never depends on colour, hover, drag, fine pointer control, or audio without an approved accommodation.
- **NFR-3 Privacy and access.** The product collects the minimum profile data needed for centre operation: account identity/contact fields approved by the centre, role, attempts, and first-practice status. Learners access only their own records; every signed-in `teacher`, `academic_lead` and `admin` has centre-wide detailed evidence access, and every read/mutation is audit logged. Production uses HTTPS, generic login failures, secure server sessions, and no speaking recordings in P0. The centre must approve a P0 child-data governance policy before pilot launch covering parent/guardian or centre authorisation, data controller/owner, retention schedule, access/correction/deletion request workflow, disposition of prospective-learner records, and the necessity/proportionality of centre-wide staff access.
- **NFR-4 Data correctness.** Published content and active/completed attempts use immutable snapshots. Submission is atomic and idempotent; duplicate or post-submission writes cannot alter results, scoring, or evidence.
- **NFR-5 Content integrity.** Learner-facing content and media are original, licensed, or approved generated content with provenance. The product does not copy protected assessment text, images, scripts, audio, layouts, or answer keys.
- **NFR-6 PWA safety.** Essential assets preload before a set begins. Local browser persistence is restricted to open-attempt recovery; answer review, result, and teacher-evidence payloads are not browser-cached.
- **NFR-7 Observability and audit.** Account, content-status, AI-draft request, publication, deactivation, teacher evidence read, and teacher-resolution changes are audit logged. Logs do not contain passwords, sessions, learner responses, answer keys, signed media URLs, or raw audio.

## Experience And Content Guardrails

- Use calm, concise, child-friendly language and the product labels `secure`, `building`, `needs practice`, and `not assessed yet`.
- Do not use pass/fail, official score, certificate, Cambridge shields, rankings, streaks, trophies, or punitive/competitive feedback.
- Present one learner task at a time with an explicit `Save and leave`; do not silently discard work or force answers before submission.
- Preserve accessibility metadata for teacher/admin review but never expose learner-facing transcripts, alt text, or labels that reveal an answer. Require an approved equivalent task when necessary.
- A full Starters-style mock is a later capability only after all Listening and Reading/Writing parts, item counts, timing, and audio policy are defined and academically approved.

## Decision Register And Release Gates

This is the sole normative inventory of undecided product matters. Affected artefacts reference the gate ID rather than copying this list. Only the named owner may change status to `closed` and record the approved decision.

| ID | Decision | Owner | Status | Gate / affected artefacts |
| --- | --- | --- | --- | --- |
| `GATE-ACADEMIC-SOURCES` | An `academic_lead` or `admin` verifies imported-source editions, provenance, citations and discrepancies, including the 2025 wordlist. | `academic_lead` or `admin` | Open — blocking for public curriculum claims | Source manifest, blueprint, SPEC and Epic 2.1–2.5. Content remains original and human-approved. |
| `GATE-CONTENT-PLAN` | Teacher-facing curriculum/assessment guidance is the content-creation/review source. Each set is approved individually; P0 has no fixed initial item inventory or self-approval exception. | `academic_lead` or `admin` | Closed — user-approved 2026-08-18 | Blueprint, SPEC and Epic 2.1–2.5. |
| `GATE-PUBLIC-WORDING` | Approve wording for YLE skill/format alignment without implying Cambridge endorsement. | Centre owner with legal/academic review | Open — blocking | Before public-facing use. README, blueprint, UX, content workflow. |
| `GATE-DATA-GOVERNANCE` | Approve child/prospective-learner authorisation, data controller/owner, retention schedule, access/correction/deletion request workflow, disposition of first-practice records, and the necessity/proportionality of all-teacher detailed evidence access. | Centre owner | Open — blocking | Before pilot launch. PRD NFR-3, architecture, account/first-practice UX and Epics 1/4. P0 still deactivates with retention; it does not purge. |
| `GATE-PRODUCT-ASSUMPTIONS` | Approve the versioned evidence-state policy: 30-day window, at least three assessable items per paper/part and language target, `needs practice` below 60%, `building` from 60% to under 80%, `secure` from 80%, plus repeated-attempt weighting and unresolved-review treatment; also approve audio replay policies and supported-browser matrix. | Product owner | Open — blocking | Before pilot acceptance testing. PRD metrics/FRs, SPEC, UX, architecture and Epics 2/3. |
| `GATE-AI-DRAFT-PROVIDER` | Configure the supplied OpenAI-compatible AI Gateway endpoint and server-side API key; confirm permitted prompt inputs, output provenance and failure handling for structured content drafts. No budget-management feature is required. | `admin` | Open — blocking | Before enabling AI draft generation. PRD FR-19/21, architecture, content UX and Epic 2. The key is server-only; AI output remains a human-reviewed draft. |
| `GATE-DEPLOYMENT` | Select provider, region/data residency, budget owner, backup/restore objectives (RPO/RTO), and concrete production services. | Centre owner and technical owner | Open — blocking for production | Architecture deployment topology and deployment guide. Provider-neutral development may proceed only after other implementation gates close. |
| `DEC-BRAND` | Supply centre brand assets or approve the current calm visual direction. | Centre owner | Assumption — non-blocking for prototype | DESIGN only. |
| `DEC-SPEAKING-DATA` | Consent, retention, access and deletion policy for speaking recordings. | Centre owner | Deferred / out of P0 | Required before any speaking-recording feature. |

## Release Criteria

P0 is ready for pilot when:

- The five specified task engines work on supported phone and desktop browsers with media readiness, explicit submit, post-submit-only answer review, and verified draft recovery states.
- All role, account-deactivation, self-directed practice, recommendation, content-publication, and first-practice flows meet their functional and authorisation requirements.
- Teacher dashboard filters and drill-down produce actionable, centre-wide evidence from submitted immutable snapshots, with auditable reads.
- The content readiness view demonstrates or explicitly flags coverage gaps for the pilot's approved content plan.
- Accessibility, privacy, content-provenance, non-official-result guardrails, and the defined supported-browser matrix are verified.
- The named open decisions required before public communication are resolved by their owners. `GATE-CONTENT-PLAN` is closed through the teacher-facing guidance and individual publication approval process.
- `GATE-DATA-GOVERNANCE` is closed before centre-wide teacher evidence access is implemented, `GATE-AI-DRAFT-PROVIDER` is closed before AI draft generation is enabled, and `GATE-DEPLOYMENT` is closed before production launch.

## Future Direction

After pilot evidence, the centre may add remaining Starters engines, teacher-led speaking observation, Movers, Flyers, full mock-style templates, and eventually AI-assisted speaking only after appropriate consent, retention, access, deletion, quality, and fairness decisions. These additions must reuse the same controlled content lifecycle, immutable attempt snapshots, deterministic scoring boundaries where applicable, and teacher-evidence loop.
