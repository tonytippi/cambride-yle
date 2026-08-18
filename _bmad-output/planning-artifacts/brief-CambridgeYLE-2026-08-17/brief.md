---
title: CambridgeYLE MVP Product Brief
status: superseded
created: 2026-08-17
updated: 2026-08-18
---

# CambridgeYLE MVP Product Brief

> **Historical input — superseded.** This brief records early discovery only. The [PRD](../prds/prd-CambridgeYLE-2026-08-17/prd.md) owns current product decisions and gates; do not implement from this file.

## Product Intent

CambridgeYLE is a responsive web application and installable PWA for young learners preparing for Pre A1 Starters. It gives learners short, original practice activities online and gives teachers specific evidence to plan the centre's offline lessons.

The first release is not a generic English-learning app and not a replacement for an official exam. Its value is the online-to-offline loop:

```text
Learner completes assigned practice
-> app records evidence by paper, part, vocabulary, and grammar
-> teacher sees the learner's recurring gaps
-> teacher reinforces those gaps in the next offline session
-> learner practices again and improvement is visible
```

## Pilot And Users

### Primary pilot users

- Existing Starters learners at the centre.
- Their teachers, who need to assign practice and prepare targeted offline support.
- An admin/content editor who creates accounts, maintains content, and publishes approved practice sets.

### Secondary commercial use

The app may be demonstrated to prospective learners who have not enrolled at the centre. A supervised diagnostic practice set can show the learner's current readiness and provide a concrete starting point for a consultation or placement conversation.

This is a sales-support use case, not public self-service acquisition in v1.

### Account policy

- No self-registration in v1.
- Admin creates learner, teacher, and admin accounts.
- A learner belongs to a cohort/class through an admin-managed enrolment.
- Parent accounts, payment, and public checkout are out of scope.

## Problem

Teachers currently lack structured, granular evidence from home practice. A total worksheet score does not reliably reveal whether a child struggles with listening for names, numbers, picture choices, vocabulary, spelling, positions, or grammar. This makes offline intervention broad and reactive.

Prospective learners also need a low-friction way to experience the centre's teaching approach and identify an appropriate starting point without building a public registration funnel.

## MVP Outcome

Within a 4-6 week pilot, a teacher can assign short Starters practice, review each learner's gaps before class, and use that information to plan a focused offline activity. Admin can create accounts and demonstrate an approved diagnostic practice set to a prospective learner.

## Scope

### P0: pilot release

- Responsive learner web experience, mobile-first and installable as a PWA.
- Admin-created accounts and cohort enrolments.
- Teacher, learner, and admin roles.
- Approved question bank with `draft -> in_review -> approved -> published -> retired` status.
- Short, original Starters practice sets of 5-10 minutes.
- Deterministic scoring and item-level response storage.
- Teacher dashboard by learner, cohort, paper, part, and tagged language target.
- Admin/content workflow with mobile preview before publish.
- PWA app shell, asset preload before a practice set starts, online/offline status, and local response recovery where feasible.

### P0 task engines

1. Reading and Writing Part 1: picture statement true/false.
2. Reading and Writing Part 2: picture statement yes/no.
3. Listening Part 3: three-option picture choice.
4. Listening Part 2: dictated name/number note-taking.
5. Reading and Writing Part 4: word-bank cloze.

### P1: after pilot evidence

- Listening Part 1: scene matching.
- Reading and Writing Part 3: picture word unscramble.
- Reading and Writing Part 5: picture-story one-word answer.
- Listening Part 4: audio-directed scene colouring.
- Teacher-led offline speaking prompts and observation record.
- Supervised diagnostic template for prospective learners if P0 practice data validates the flow.

### Explicitly out of scope

- Self-registration, parent account, public checkout, payment, or admissions workflow.
- Full Starters-style mock test in P0.
- Movers and Flyers learner content.
- AI speech scoring or automated speaking score.
- Chatbot/tutor experience.
- AI-generated assets published without teacher approval.
- Self-hosted speech/image models, Learning Locker/xAPI, Moodle/Open edX/Frappe integration.
- Native iOS/Android applications.

## Curriculum And Assessment Constraints

- All content is original, licensed, or generated for the product and teacher-approved.
- The internal curriculum framework is cumulative:
  - Starters uses Starters entries.
  - Movers later includes Starters plus Movers additions.
  - Flyers later includes Starters, Movers, and Flyers additions.
- Grammar targets follow the same cumulative rule.
- Every question has a level, paper, part, task type, vocabulary tags, grammar tags, topic tags, answer policy, and approved media.
- Product reporting uses internal practice language such as `secure`, `building`, and `needs practice`; it never presents pass/fail, certificates, or Cambridge shields.
- A future full Starters-style mock requires all four Listening parts and all five Reading and Writing parts, with the required item counts, timing, and audio policy.

The current curriculum contract is the [Starters curriculum and assessment blueprint](../../../docs/starters-curriculum-and-assessment-blueprint.md).

## User Flows

### Learner

```text
Admin-created account
-> sign in
-> see assigned practice set
-> preload required assets
-> complete questions
-> submit or resume recovered draft
-> see child-friendly post-submission feedback
-> teacher uses the detailed result offline
```

### Teacher

```text
Sign in
-> view cohort dashboard
-> identify weak part/target patterns
-> inspect a learner's item responses
-> assign an approved practice set
-> use evidence to prepare the next offline lesson
```

### Admin/content editor

```text
Create learner/teacher accounts and cohorts
-> author or generate content draft
-> validate vocabulary, grammar, answers, and assets
-> teacher/academic review
-> preview on phone layout
-> publish to question bank
-> compose and assign practice sets
```

### Prospective learner demonstration

```text
Admin creates temporary or pre-provisioned learner account
-> learner completes supervised diagnostic practice
-> teacher/admin reviews readiness by implemented parts
-> centre explains recommended class or support plan
```

## Pilot Success Measures

- At least 70% of enrolled pilot learners complete two practice sets per week.
- Teachers can identify at least two concrete learning gaps for each active learner before the offline session.
- Teachers report that the dashboard reduces time spent checking home practice compared with the current process.
- At least 80% of published pilot items need no correction for ambiguity after learner use.
- At least one prospective-learner demonstration is completed end-to-end without needing a self-registration flow.
- No critical mobile audio, answer-loss, or account-access issue blocks a learner from completing assigned practice.

## Feedback Policy

- A learner sees no correct/incorrect indication and no answer explanation while completing a practice set.
- The learner sees answers, explanations, and child-friendly next-step feedback only after submitting the full practice set.
- The learner may review their submitted answers alongside the correct answers after submission.
- Teachers can review item-level evidence after submission; no live monitoring is required in v1.

## Risks And Guardrails

| Risk | Guardrail |
| --- | --- |
| AI content is unsuitable, ambiguous, or beyond level | AI creates drafts only; validator and academic review are required before publish. |
| Cambridge copyright or endorsement confusion | Use original assets/content; approved public wording; no official-result claims. |
| Young learner data is mishandled | Minimum data collection and role-based access. Account deactivation revokes access while retaining P0 records; policy remains governed by the PRD. |
| A PWA fails during an activity | Preload essential assets, save draft responses locally where feasible, make connectivity state visible. |
| Pilot scope expands into an LMS | Keep P0 to accounts, cohorts, practice, progress, and content review. |
| Sales use becomes a public product flow | Admin-supervised diagnostics only; no self-registration in v1. |

## Historical Open Decisions

This section is intentionally not a decision register. All current open decisions, owners, statuses and gates live only in the PRD Decision Register.

## Supersession

The discovery sequence represented here is complete. Follow the PRD and README authority map for current artefacts and gates; this historical brief does not prescribe a next deliverable.
