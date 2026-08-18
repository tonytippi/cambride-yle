---
title: CambridgeYLE P0 PRD
status: final
created: 2026-08-17
updated: 2026-08-17
sources:
  - ../../brief-CambridgeYLE-2026-08-17/brief.md
  - ../../../specs/spec-cambridgeyle-p0/SPEC.md
  - ../../ux-designs/ux-CambridgeYLE-2026-08-17/EXPERIENCE.md
  - ../../ux-designs/ux-CambridgeYLE-2026-08-17/DESIGN.md
  - ../../architecture/architecture-CambridgeYLE-2026-08-17/ARCHITECTURE-SPINE.md
  - ../../../../docs/starters-curriculum-and-assessment-blueprint.md
---

# CambridgeYLE P0

## Product Decision

CambridgeYLE P0 is a responsive web application and installable PWA for existing Pre A1 Starters learners at a centre. Learners complete brief, original online practice; the product records item-level evidence; teachers use that evidence to plan targeted offline reinforcement.

P0 releases **Starters only**. Movers and Flyers are deferred until Starters pilot evidence validates the operating loop, content workflow, and learner experience. The product must keep curriculum and content records level-aware so later levels can reuse the same operating model without a redesign.

This product is practice support, not an official Cambridge examination service. It must never represent practice evidence as an official score, pass/fail result, certificate, or Cambridge endorsement.

## Problem And Opportunity

Teachers currently receive home-practice scores without the detail needed to decide whether a learner needs help with a particular paper part, vocabulary/grammar target, spelling, names, numbers, or listening behavior. This turns offline intervention into broad rechecking rather than focused teaching.

The P0 opportunity is an online-to-offline evidence loop:

```text
Learner completes short practice
-> product stores response-level evidence
-> teacher identifies a recurring, specific gap
-> teacher prepares an offline reinforcement activity
-> learner practises again and progress is visible
```

The centre may also use an approved practice set as a supervised diagnostic demonstration for a prospective learner. This supports a placement conversation; it is not a public acquisition, registration, or admissions workflow.

## Pilot Outcome And Measures

Within a 4-6 week pilot, teachers can assign short Starters practice, identify at least two concrete gaps for each active learner before class, and use those gaps to plan a focused offline activity.

The pilot succeeds when:

- At least 70% of enrolled pilot learners complete two practice sets each week.
- Teachers identify at least two concrete learning gaps for each active learner before the relevant offline session.
- Teachers report less time checking home practice than in the current process.
- At least 80% of published pilot items require no correction for ambiguity after learner use.
- At least one supervised prospective-learner demonstration completes end-to-end without self-registration.
- No critical mobile audio, answer-loss, or account-access problem blocks completion of an assigned set.

Measurement definitions:

- **Weekly completion:** completed distinct assigned sets / distinct assigned sets due in that pilot week. A learner with an active centre enrolment for the entire week is included; a formally deactivated or unenrolled learner is excluded from subsequent weeks. The pilot owner exports this metric weekly.
- **Actionable gap coverage:** for each active learner, the assigned teacher records at least two evidence-backed gaps. A gap names paper/part and a language target, and links to the supporting dashboard drill-down. `Not assessed yet` is recorded with its reason as a separate coverage exception and does not count toward the two-gap success criterion; the pilot owner reports its count and resolves whether missing assignments, completion, or content coverage caused it.
- **Teacher time:** each pilot teacher records the minutes spent checking home practice for one baseline week before P0 and weekly during P0. Compare the per-teacher weekly median; collect a short free-text explanation for material changes in workload.
- **Item ambiguity:** an academic lead logs each published item correction and its reason. The measure is published items without an ambiguity correction / published items used by at least one learner during the pilot.
- **Critical completion issue:** a confirmed incident that prevents an assigned learner from signing in, starting essential media, retaining an open answer, submitting after reconnection, or accessing the submitted result. The pilot owner maintains the incident log.

Counter-metrics to monitor:

- Practice completion must not be raised by revealing correctness before submission or using punitive/game-like mechanics.
- Dashboard usage must lead to a specific offline intervention, not merely more reporting activity.
- Content volume must not be treated as readiness when items do not cover all implemented engines, targets, media needs, and 5-10 minute set compositions.

## Users And Product Boundaries

| User | Need | P0 authority |
| --- | --- | --- |
| Learner | Complete understandable, short Starters practice without losing work or receiving premature answers. | Access only own assigned practice and submitted results. |
| Teacher | Identify actionable cohort/learner gaps and assign appropriate approved follow-up practice. | Access assigned cohorts and their historical evidence scope only. |
| Admin/content editor | Manage centre users/cohorts and move safe, original content through approval into published sets. | Manage accounts, cohorts, content, publication, and supervised diagnostics. |
| Prospective learner | Experience a supervised practice diagnostic. | Uses a pre-provisioned account; no self-service access. |

P0 excludes self-registration, parent accounts, payment, public checkout, admissions workflows, native applications, Movers/Flyers content, a full Starters-style mock, automated speaking scoring, learner speaking recordings, chat/tutor features, and publishing unreviewed AI-generated material.

## Product Scope

### Learner Practice

P0 delivers short, 5-10 minute, single-paper/part Starters practice sets targeting one or two learning objectives for these five engines:

1. Reading and Writing Part 1: `picture_true_false`.
2. Reading and Writing Part 2: `picture_yes_no`.
3. Listening Part 3: `audio_picture_choice`.
4. Listening Part 2: `audio_note_taking` for dictated names/numbers.
5. Reading and Writing Part 4: `word_bank_cloze`.

Learner flow: sign in -> see assigned practice or recovered draft -> prepare essential media -> complete answers -> intentionally submit or reconnect -> review answers and child-friendly feedback.

### Teacher Evidence

Teachers can review completed evidence by learner, cohort, paper, part, vocabulary target, grammar target, topic, practice set, and time range. The cohort view must state a concrete `needs practice` gap with affected learner count and drill-down to submitted responses, not require a teacher to infer an intervention from raw analytics.

Teachers may resolve controlled responses marked `needs_teacher_review`; the automatic result and the teacher's reason remain auditable. Unresolved outcomes are excluded from automatic correctness aggregates.

[ASSUMPTION] A `needs practice` statement is shown only when the selected filter includes at least two submitted items for the same paper/part and language target in the last 28 days, and fewer than 70% of automatically assessable or teacher-resolved outcomes are correct. Fewer than two assessable items, or an all-unresolved selection, shows `not assessed yet`. This rule is configurable only through a future governed product decision, not a teacher-side dashboard setting.

### Content, Assignment, And Accounts

Admins create learner, teacher, and admin accounts; manage cohorts/enrolments; and explicitly deactivate accounts. For P0, admin is the content-editor and academic-approval role: an admin can author, validate, review, approve, preview on a phone-width layout, publish, retire, and compose content. Each lifecycle transition records its actor and timestamp; an academic lead approves documented validation exceptions. [ASSUMPTION] The centre will name the academic lead before content production. P0 permits a qualified admin to author and approve an item, but audit records must make that visible for pilot governance.

The content lifecycle is `draft -> in_review -> approved -> published -> retired`. AI-originated material is always a draft until a human content and academic review completes.

### Supervised Diagnostic

An admin can create a temporary or pre-provisioned learner account and assign an approved set under centre supervision. The resulting evidence is reviewed through the normal teacher evidence surfaces using neutral practice wording. The account can later be deactivated; P0 does not automatically expire or irreversibly purge it.

## User Journeys

### UJ-1: Linh Completes Practice

Linh, age 7, uses her mother's phone after class. She signs in to the account created by the centre, chooses an assigned six-minute Listening Part 3 set, and waits for its audio and images to confirm readiness. She answers one question at a time, can replay permitted audio and change answers, but sees no correctness, score, or answers. At the end she sees answered/unanswered counts, explicitly submits, then reviews her response, approved answer, explanation, and calm practice feedback. Her teacher can now inspect the evidence.

If essential media fails before start, Linh sees which asset failed and can retry or leave; the set cannot start incomplete. If connectivity fails during an open attempt, the app retains only a verified local draft and makes clear that submission requires reconnection.

### UJ-2: Mai Plans An Intervention

Mai, a Starters teacher, opens her cohort dashboard twenty minutes before class. She filters completed attempts from the last week and sees that several learners need practice with numbers in Listening Part 2. She opens Linh's detail to inspect submitted name/number responses, attempt time, playback events, and uncertain outcomes. Mai plans a number-dictation activity for the affected learners, then assigns an approved follow-up set to the cohort.

If no completed practice matches a filter, the dashboard shows `not assessed yet`, not a learning deficiency.

### UJ-3: An Publishes Safe Practice

An, the admin/content editor, authors a draft question with target tags, answer policy, original media, and provenance. Validation reports any missing or out-of-level data. An sends a valid draft to academic review, previews it in a phone-width surface, and publishes it only after approval. An then composes approved questions into a short set and assigns it to Mai's cohort. Learners receive an immutable approved version even if source content is later edited or retired.

### UJ-4: Quang Runs A Diagnostic

Quang, a centre admin, creates a prospective learner account and assigns an approved practice set while supervising the session. After submission, Quang or a teacher reviews evidence for implemented parts to support a placement conversation. If the family does not continue, Quang explicitly confirms deactivation, ending future access while retaining P0 records and audit metadata according to policy.

## Functional Requirements

### Account And Cohort Management

- **FR-1.** An admin can create learner, teacher, and admin accounts, assign their roles, and provision their sign-in access.
- **FR-2.** An admin can create cohorts, enrol or remove learners, and assign teachers to cohorts.
- **FR-3.** A signed-in user can access only role-authorized surfaces and resource scopes; a teacher cannot access another cohort's evidence and a learner cannot access another learner's records.
- **FR-4.** An admin can explicitly deactivate an account after a named confirmation. Deactivation revokes active sessions, blocks future sign-in, preserves practice/diagnostic records, and records an audit event without learner-response content.

### Learner Practice

- **FR-5.** A learner can sign in, view assigned published practice sets and a recoverable open draft, and see title, paper/part, estimated duration, and `Start`, `Resume`, or `Review` actions.
- **FR-6.** Before starting, the learner can verify all essential authorized media assets. The system blocks attempt creation until essential media is available and identifies failed assets with retry and leave actions.
- **FR-7.** A learner can complete the five P0 task engines, change an open response, and use audio only under the snapshot playback policy. P0 supports `unlimited_replay` and `max_replays` policies; an item declares the allowed replay count, seeking is unavailable unless explicitly allowed, the remaining replay count is displayed when limited, and every play/replay event is stored with the open attempt.
- **FR-8.** The product must not show correctness, answers, explanations, predicted scores, or score-like UI before final submission.
- **FR-9.** The learner can save and leave an open practice set without silent loss. The application preserves a verified local draft where available and communicates offline, save, and recovery states honestly.
- **FR-10.** The learner can review answered/unanswered counts, return to questions, or explicitly submit with unanswered items recorded as unanswered.
- **FR-11.** On submission, the system stores the final responses and returns only post-submission result data. The learner can then review their responses, approved answers, explanations, and product-owned practice labels.

### Scoring And Evidence

- **FR-12.** The system deterministically scores all implemented Listening and Reading/Writing items against the versioned answer policy attached to the submitted item.
- **FR-13.** The system stores item-level response, automatic outcome, submitted time, playback/retry evidence, answer-policy version, and curriculum tags needed for later analysis, including language-target dimensions for vocabulary, grammar, spelling, names, numbers, colours, and positions where applicable.
- **FR-14.** The system reports only `correct`, `incorrect`, `unanswered`, or `needs_teacher_review` as automatic outcomes and does not silently treat uncertain short answers as correct. A submission retry using the same idempotency key returns the saved final result; a different key after finalization and every post-submission write are rejected with a stable conflict result.
- **FR-15.** A teacher can view completed evidence by cohort and learner; filter by learner, cohort, paper, part, vocabulary, grammar, spelling, names, numbers, colours, positions, topic, time range, and practice set; and drill down to submitted item responses.
- **FR-16.** The teacher dashboard presents an actionable gap statement with evidence state, affected learner count, paper/part, and relevant language target. It does not issue AI lesson recommendations in P0.
- **FR-17.** An authorized teacher can resolve `needs_teacher_review` outcomes with a reason. The system preserves the automatic outcome and recalculates affected evidence from the effective outcome.
- **FR-18.** An authorized teacher can assign a published practice set to an eligible learner or cohort.

### Content And Publication

- **FR-19.** A content editor can author question and media drafts with level, paper, part, task type, prompt/options, answer policy, a primary learning-objective identifier, supporting curriculum tags, estimated duration, accessibility metadata, and immutable provenance metadata.
- **FR-20.** Before review or publication, validation identifies missing tags, answer keys/alternatives, required media, approved names/numbers, task-template limits, out-of-level vocabulary/grammar, provenance gaps, and accessibility issues.
- **FR-21.** Only an authorized human can move valid content through the lifecycle. Generated content cannot bypass content review, academic approval, or phone-width preview.
- **FR-22.** An authorized content editor can publish approved questions/media and compose only approved content into a 5-10 minute, single-paper/part practice set. Composition validates that the set contains one or two distinct primary learning-objective identifiers and reports a publish-blocking finding otherwise.
- **FR-23.** Publication preserves an immutable snapshot of the question, media, answer policy, feedback, tags, accessibility metadata, and provenance. Later source edits or retirement cannot alter an active or completed attempt.
- **FR-24.** An academic lead can run a readiness view that reports coverage across all P0 engines, paper/part, topic, vocabulary/grammar target, essential media, duration, and varied set composition; it must list coverage gaps.

### Diagnostic And PWA

- **FR-25.** An admin can provision a prospective learner and assign an approved practice set through the standard account/assignment/published-set workflow, without self-registration or a separate diagnostic template.
- **FR-26.** Authorized staff can inspect diagnostic evidence only for implemented parts and deactivate a diagnostic account through the standard named deactivation flow.
- **FR-27.** The PWA communicates media readiness and connectivity, caches only the application shell and authorized set assets, and keeps open-attempt recovery separate from answer review, results, and teacher evidence.

## Non-Functional Requirements

- **NFR-1 Responsive experience.** Learner practice is mobile-first. Teacher/admin/editor work is usable on tablet and efficient on desktop, with responsive card alternatives for key tables. [ASSUMPTION] Pilot support covers the current and immediately previous stable versions of Safari on iOS, Chrome on Android, and Chrome, Safari, Edge, and Firefox on desktop; PWA installation is optional and unavailable installation must not block browser use.
- **NFR-2 Accessibility.** The product meets WCAG 2.2 AA. Learner controls have 48 by 48 CSS-pixel minimum targets; keyboard order follows instruction order; focus and state are visible and announced; critical meaning never depends on color, hover, drag, fine pointer control, or audio without an approved accommodation.
- **NFR-3 Privacy and access.** The product collects the minimum profile data needed for centre operation: account identity/contact fields approved by the centre, role, cohort membership, assignments, attempts, and diagnostic status. Authorization occurs for every protected action and resource. Production uses HTTPS, generic login failures, secure server sessions, and no speaking recordings in P0. The centre must approve a P0 child-data governance policy before pilot launch covering parent/guardian or centre authorization, data controller/owner, retention schedule, access/correction/deletion request workflow, and disposition of prospective-learner diagnostic records.
- **NFR-4 Data correctness.** Published content and active/completed attempts use immutable snapshots. Submission is atomic and idempotent; duplicate or post-submission writes cannot alter results, scoring, or evidence.
- **NFR-5 Content integrity.** Learner-facing content and media are original, licensed, or approved generated content with provenance. The product does not copy protected assessment text, images, scripts, audio, layouts, or answer keys.
- **NFR-6 PWA safety.** Essential assets preload before a set begins. Local browser persistence is restricted to open-attempt recovery; answer review, result, and teacher-evidence payloads are not browser-cached.
- **NFR-7 Observability and audit.** Account/cohort, content-status, assignment, publication, deactivation, and teacher-resolution changes are audit logged. Logs do not contain passwords, sessions, learner responses, answer keys, signed media URLs, or raw audio.

## Experience And Content Guardrails

- Use calm, concise, child-friendly language and the product labels `secure`, `building`, `needs practice`, and `not assessed yet`.
- Do not use pass/fail, official score, certificate, Cambridge shields, rankings, streaks, trophies, or punitive/competitive feedback.
- Present one learner task at a time with an explicit `Save and leave`; do not silently discard work or force answers before submission.
- Preserve accessibility metadata for teacher/admin review but never expose learner-facing transcripts, alt text, or labels that reveal an answer. Require an approved equivalent task when necessary.
- A full Starters-style mock is a later capability only after all Listening and Reading/Writing parts, item counts, timing, and audio policy are defined and academically approved.

## Dependencies And Open Decisions

| Item | Status | Owner / revisit condition |
| --- | --- | --- |
| Initial 6-8 Starters topics and grammar targets for the first 50-100 original items | Open | Academic lead before content production begins. |
| Pilot inventory and coverage target by engine, objective, media need, and repeatable 5-10 minute set composition | Open | Academic lead before pilot content is approved; readiness findings alone cannot waive this gate. |
| Academic lead and source/version approval process for imported curriculum references | Open | Centre owner before content review/publishing. |
| Approved public wording for skill/format alignment without Cambridge endorsement | Open | Centre owner with legal/academic review before public-facing use. |
| P0 child/prospective-learner data governance policy | Open | Centre owner before pilot launch; covers authorization, retention, access/correction/deletion requests, and diagnostic-account disposition. |
| Validate or replace the assumed needs-practice threshold, audio replay policies, and supported-browser matrix | [ASSUMPTION] | Product owner before pilot acceptance testing. |
| Parent consent, retention, access, and deletion policy for speaking recordings | Deferred | Required before any speaking recording feature; speaking is out of P0. |
| Production provider, region, and concrete deployment services | Deferred | Decide before production launch based on budget, ownership, and data-residency requirements. |
| Centre brand assets | [ASSUMPTION] | P0 uses the existing calm child-friendly visual direction until supplied. |

## Release Criteria

P0 is ready for pilot when:

- The five specified task engines work on supported phone and desktop browsers with media readiness, explicit submit, post-submit-only answer review, and verified draft recovery states.
- All role, cohort, account-deactivation, content-publication, assignment, and diagnostic flows meet their functional and authorization requirements.
- Teacher dashboard filters and drill-down produce actionable, scoped evidence from submitted immutable snapshots.
- The content readiness view demonstrates or explicitly flags coverage gaps for the pilot's approved content plan.
- Accessibility, privacy, content-provenance, non-official-result guardrails, and the defined supported-browser matrix are verified.
- The named open decisions required before content production or public communication are resolved by their owners.

## Future Direction

After pilot evidence, the centre may add remaining Starters engines, teacher-led speaking observation, Movers, Flyers, full mock-style templates, and eventually AI-assisted speaking only after appropriate consent, retention, access, deletion, quality, and fairness decisions. These additions must reuse the same controlled content lifecycle, immutable attempt snapshots, deterministic scoring boundaries where applicable, and teacher-evidence loop.
