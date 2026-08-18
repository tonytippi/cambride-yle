---
name: CambridgeYLE
status: current-with-open-gates
sources:
  - ../../prds/prd-CambridgeYLE-2026-08-17/prd.md
  - ../../../../docs/starters-curriculum-and-assessment-blueprint.md
design: DESIGN.md
updated: 2026-08-18
---

# CambridgeYLE Experience Spine

> This document owns behaviour; `DESIGN.md` owns visual rules and the PRD owns decisions/gates. Core P0 policy gates are closed; `GATE-AI-DRAFT-PROVIDER` remains open before AI draft generation.

## Foundation

Responsive web application and installable PWA. Learner practice is mobile-first; teacher, `academic_lead`, and admin work is efficient on desktop but remains usable on tablets. `DESIGN.md` owns visual identity; this document owns behaviour. The P0 UI system is component-based but no library is selected yet.

The product is a Starters practice application, not an official exam service. It shows only original, approved content and uses only the evidence states `secure`, `building`, `needs practice`, and `not assessed yet`. Listening and Reading/Writing are deterministically scored. Speaking, parent accounts, self-registration, payment, and a full mock are outside P0.

## Information Architecture

| Surface | Reached from | Purpose |
| --- | --- | --- |
| Sign in | App entry | Authenticate an admin-created learner, teacher, or admin account. |
| Learner home | Sign in, learner navigation | Choose published practice by topic/task type, see history-based recommendations, resumable drafts, and recent completed results. |
| Practice preparation | Learner home | Confirm media preload and readiness before a set begins. |
| Practice player | Preparation or recovered draft | Complete one learner-selected, published practice set without seeing answers or correctness. |
| Submit confirmation | Practice player | Make the learner intentionally finish the complete set. |
| Result summary | Submission | Show completed status, product-owned evidence labels, and answer-review entry point. |
| Answer review | Result summary | Compare each submitted response with the approved answer after submission. |
| Teacher evidence dashboard | Teacher navigation | Identify patterns by learner, paper, part, and language target across the centre. |
| Learner evidence detail | Teacher dashboard | Inspect a learner's completed sets and item-level evidence. |
| Admin accounts | Admin navigation | Create, edit, and deactivate accounts. |
| Content library | Academic lead/admin navigation; teacher read-only navigation | Academic lead/admin search and manage all content; teacher reads published questions and practice sets. |
| Question editor and review | Content library | Academic lead/admin author, request/edit/rerun text drafts, request/rerun image drafts, validate, preview, approve, publish and retire a question/media version. |
| Practice-set composer | Content library | Assemble only published question/media versions into a set version; publish for learner selection. |
| First-practice setup | Admin navigation | Create a supervised prospective-learner account and help select a published practice set. |

Learner navigation is a simple home-first header. Teacher/admin navigation is a labelled left rail on desktop and a labelled menu sheet on narrow screens. A user sees only surfaces allowed by their role. Dialogs do not stack.

## Voice and Tone

Microcopy is short, literal, and encouraging without being performative. Brand posture is in `DESIGN.md`.

| Do | Don't |
| --- | --- |
| `Listen, then choose a picture.` | `Can you beat this challenge?` |
| `You can check your answers after you finish.` | `Wrong. Try again!` |
| `Ready to submit? You will see your answers next.` | `Final chance to pass!` |
| `Needs practice: numbers in Listening Part 2.` | `Weak at listening.` |
| `This is practice feedback, not an official exam result.` | `You passed Starters.` |
| `Deactivate Minh's account? Sign-in will stop; P0 records will be retained.` | `Delete Minh's account?` |

## Component Patterns

Behavioral rules; visual rules are in `DESIGN.md.Components`.

| Component | Use | Behavioral rules |
| --- | --- | --- |
| Practice-set card | Learner home | Shows title, topic, task type, estimated time, and `Start`, `Resume`, or `Review`. A recommendation explains its relevant practice area without implying a score or removing other choices. |
| Media readiness panel | Practice preparation | Lists required audio/image downloads. `Start` stays unavailable until essentials are available; retry is explicit on failure. |
| Practice header | Player | Shows question position and `Save and leave`. It does not expose score, correctness, or answers. |
| Choice/boolean/yes-no input | Player | Exactly one answer selected; learner can change it until submission. Selection is announced and remains visible. |
| Short text input | Note-taking/cloze | Preserves entered text locally; normalised deterministic scoring occurs only at submission. |
| Audio player | Listening | Has accessible play/replay action with unlimited replay. Playback events are stored. Seeking is not offered unless a template permits it. |
| Submit confirmation | Player | States answered/unanswered count. `Submit practice` is available only after an explicit confirmation; unanswered items remain permitted and are recorded as unanswered. |
| Answer-review row | Post-submission only | Shows prompt/media reference, learner response, approved answer, correct/incorrect/needs-teacher-review result, and approved explanation. |
| Evidence filter | Teacher surfaces | Filters learner, paper, part, vocabulary, grammar, spelling, names, numbers, colours, positions, topic, and practice set. The fixed 30-day evidence rule applies without a time-range filter; drill-down may show matching retained submissions outside that window without recalculating the state. Filters update summaries and drill-down together; every teacher evidence read is audit logged. |
| Status workflow control | Academic lead/admin | Shows separate versioned workflows for questions, media and sets: `draft -> in_review -> approved -> published -> retired`. Academic lead/admin can request/edit/rerun text drafts and request/rerun image drafts through their separate configured gateways. AI-created drafts display gateway kind, model, prompt/reference provenance and output hash; image drafts must pass phone-width preview and cannot bypass human review. Rejection records actor/reason/time and creates a new draft version; revision never mutates publication; retirement grandfathers active attempts. |
| Deactivate-account dialog | Admin | Requires account identifier and consequence text. For the final active admin, show that another admin must first be active and leave the account unchanged. Otherwise, deactivates the account, revokes active sessions, prevents future login and retains GrapeSeed English P0 practice/first-practice records indefinitely only after explicit named confirmation; action is audit logged. |

## Task Engine Behavior

| Engine | Learner action | Pre-submission behaviour | Post-submission review |
| --- | --- | --- | --- |
| `picture_true_false` | Choose true or false for a picture statement | Choice may change; no correctness response | Submitted choice, approved answer, explanation tied to picture/statement |
| `picture_yes_no` | Choose yes or no for a picture statement | Choice may change; no correctness response | Submitted choice, approved answer, explanation |
| `audio_picture_choice` | Replay approved audio and choose A/B/C picture | Unlimited replay; selection may change | Submitted option, approved option, explanation |
| `audio_note_taking` | Replay approved audio and enter a name/number | Unlimited replay; no spelling correction or hint | Normalised result; show accepted answer; `needs teacher review` when policy requires |
| `word_bank_cloze` | Select/copy a word into each blank | Entries may change; no partial correctness | Completed text, approved mapping, explanation per blank or passage |

## State Patterns

| State | Surface | Treatment |
| --- | --- | --- |
| First learner visit | Learner home | Explain that practice answers appear after a completed set. Show topic/task-type choices and a clear recommendation-empty state. |
| No recommendation yet | Learner home | `Choose a topic to start practising.` Do not fabricate evidence-based claims before enough completed items exist. |
| Draft available | Learner home | One `Resume` action with last saved time; `Start again` requires confirmation and preserves prior submitted attempts. |
| Draft changed elsewhere | Learner home/player | A stale revision from another tab/device is not merged or overwritten. Show `This practice changed somewhere else`, preserve the visible unsent input separately, and offer `Reload latest` or `Leave`. |
| Account switch or sign-out | All learner surfaces | Clear the previous account's authorised media and draft namespace before showing another account. A draft/cache key mismatch is blocked and never attached to the new learner. |
| Preload in progress | Preparation | Show each essential asset as preparing; do not begin with absent media. |
| Preload failure | Preparation | Identify failed asset type, offer retry, and provide `Leave` without losing home state. |
| Start revalidation failure | Preparation | If snapshot, authorisation, or essential media changes after preload, keep the set unavailable, create no usable attempt, and offer retry or another published ready set. |
| Offline during practice | Player | Retain responses locally and show a persistent plain-language offline state. Submission waits until a server connection is available unless a later product decision adds queued submission. |
| Offline at submit | Submit confirmation | Keep the attempt open and the verified draft visible. Explain that reconnection is required; do not queue submission or show a partial result. |
| Media authorisation expires mid-attempt | Player | Preserve the open draft, pause only the affected media interaction, request a fresh authorised URL after reconnect/authentication, and offer retry or `Save and leave`; never count a failed refresh as a replay. |
| Save/recovery error | Player | Keep the visible answer; show retry state. Never claim it is saved if it is not. |
| Unanswered questions | Submit confirmation | State count and provide `Review questions` or `Submit anyway`; no forced answer. |
| Scoring in progress | Result transition | Show a brief non-blocking completion state. Do not expose an incomplete score. |
| Empty teacher evidence | Dashboard | `No completed practice yet for this selection.` Offer filters reset; do not infer a learning level. Every signed-in teacher may open a learner detail; the read is audit logged. |
| `not assessed yet` | Teacher/learner result | State that there is insufficient completed evidence, not a deficiency. |
| Item needs teacher review | Result and dashboard | Mark as `Needs teacher review`; exclude it from automatic correct-rate calculations until resolved. |
| Resolution conflict | Staff evidence | Preserve the prior resolution and show a refresh/retry action when another staff member has created a newer resolution version. |
| Permission denied | All protected routes | Redirect to the role's home with `You do not have access to that page.` |
| Retired content in old result | Review | Preserve completed attempt and original item version for teacher review; never re-score it against a replacement. |
| Deactivated account | Sign in/admin account detail | Reject sign-in with a generic failure. Admin sees that the account is deactivated and can review its audit history; P0 does not purge practice or first-practice records automatically. |

## Interaction Primitives

- Tap/click to choose, play audio, continue, or open evidence. Keyboard users can reach and activate every control.
- `Back` in the player opens `Save and leave`; it does not discard a draft silently.
- The bottom action area remains reachable above the mobile browser chrome and software keyboard.
- The player avoids drag, hover-only controls, timed disappearance, forced auto-advance, and per-question correctness animations.
- Audio requires an explicit learner action to play; autoplay is not relied on.
- Teacher tables provide sort/filter controls with a card layout fallback. Rows remain selectable with keyboard and touch.
- Admin account deactivation is always a named, explicit action; no swipe-to-delete for accounts.

## Accessibility Floor

- Meet WCAG 2.2 AA. Contrast decisions follow `DESIGN.md`; all state colour has visible text and programmatic state.
- Learner controls have minimum 48 by 48 CSS pixel targets and generous spacing. Picture options use labels such as `Picture A` rather than position-only instructions.
- Keyboard order follows the instructional reading order. Focus is visible, never trapped outside an open dialog, and returns to its trigger when closed.
- Screen readers announce question number, task instruction, selected answer, audio state, required input constraints, save status, and result status.
- Provide alternative text for teacher/admin review. Do not expose learner-facing alt text, transcripts, or labels that reveal an answer. P0 has no alternate accessible task variant; when essential media cannot be used, the media-dependent set remains unavailable.
- Short answer fields state expected input, for example `Write one number` or `Write one word`; errors after submission explain the accepted answer without ridicule.
- Respect reduced motion and user zoom. No critical task depends on colour perception or fine pointer precision. A media-dependent task remains unavailable when its essential audio or image media cannot be used.

## Responsive & Platform

| Breakpoint | Learner | Teacher/admin/editor |
| --- | --- | --- |
| `< 768px` | Single-column player, fixed safe-area action bar, full-screen navigation sheet | Card/list detail views; labelled navigation sheet; no mandatory horizontal scrolling |
| `768-1023px` | Centred practice column, larger media, persistent header | Compact rail or top navigation; tables may horizontally scroll with a card alternative for key evidence |
| `>= 1024px` | Practice remains focused in a max-width reading column | Persistent labelled rail; dashboard may show summary and drill-down side by side; editor preview includes a phone-width mode |

PWA installation is optional. The app makes install availability discoverable but never blocks use. Offline capability covers shell and local response recovery where feasible; a set is not started until its essential media has preloaded.

## Product-Specific Guardrails

- Results are practice evidence, never official Cambridge results. Prohibited UI language: `pass`, `fail`, `certificate`, `official score`, and Cambridge shields.
- The UI must not reproduce protected assessment text, images, audio scripts, layouts, or answer keys. Content preview and review retain provenance and approval metadata.
- AI-created content is visibly a draft in the editor and cannot bypass validator, academic review, or mobile preview.
- Every result remains associated with the question and answer-policy version used at submission.
- Only admin-created accounts can sign in. First-practice accounts are supervised, not a public sign-up route.

## Key Flows

### Flow 1 - Complete a practice set (Linh, 7, on her mother's phone after class)

1. Linh signs in with the account created by the centre.
2. Learner home shows topic and task-type choices plus a `Listening Part 3: Animals` recommendation, marked `About 6 minutes`, because it relates to a recent practice area.
3. She chooses `Start`. The preparation surface confirms that all three audio clips and pictures are ready.
4. The player presents one question at a time. Linh taps replay, then chooses a picture. She changes one earlier answer without seeing whether either choice is right.
5. She reaches the end. The confirmation says `You answered 5 of 5 questions. When you submit, you can check your answers.`
6. **Climax:** Linh taps `Submit practice`; the result summary changes the unknown attempt into a calm review invitation, with `Check my answers` available only now.
7. She opens answer review and sees her own choice beside the approved answer and a brief explanation. The completed evidence is available to her teacher.

Failure: an audio asset fails before start -> preparation names the problem and offers retry; Linh cannot start a set with missing essential audio.

### Flow 2 - Prepare an offline intervention (Mai, Starters teacher, 20 minutes before class)

1. Mai signs in on her laptop and opens the teacher evidence dashboard.
2. The dashboard applies its fixed 30-day evidence rule and shows `Listening Part 2` as `needs practice` for several learners.
3. She filters the target to `numbers` and opens Linh's evidence detail.
4. The detail shows submitted name/number responses, attempt times, audio replay events, and any item marked `needs teacher review`.
5. **Climax:** Mai identifies a concrete offline activity: number dictation with extra support for two learners, instead of rechecking every home worksheet manually.
6. She guides Linh to the published `Numbers` topic for her next practice; learner choice remains available and no live monitoring is expected.

Failure: no completed data matches the filter -> dashboard says there is not enough completed evidence and allows Mai to reset filters rather than implying a weakness.

### Flow 3 - Publish a safe practice set (An, academic lead, on desktop)

1. An opens a draft question in the content library.
2. The editor shows its required task metadata, answer policy, target vocabulary/grammar, original media, and validation flags.
3. An fixes missing tags, edits or reruns a text draft, or reruns an image draft if needed, and approves the versions as an `academic_lead`.
4. An uses the phone-width preview to verify that image regions, audio controls, and answer options are usable.
5. An may request an AI-generated structured draft, then manually publishes reviewed question/media versions and an immutable set version for learner selection.
6. **Climax:** The set is available to learners with all required media and deterministic answer policy attached; the teacher receives evidence that can be used offline.

Failure: validator finds vocabulary outside the allowed Starters set or missing media -> publish remains unavailable and the editor identifies the field needing review.

### Flow 4 - Supervised first practice and deactivation (Quang, centre admin, with a prospective learner)

1. Quang creates a temporary learner account and helps the learner choose a published practice set.
2. The learner completes it under supervision and receives post-submission practice feedback.
3. Quang or a teacher reviews implemented-part evidence to support a placement conversation, without presenting an official result.
4. **Climax:** If the family does not continue, Quang opens the account record, confirms the named deactivation action, and immediately prevents future sign-in.

Failure: Quang attempts deactivation accidentally -> the confirmation states the learner name and access consequence; cancel returns to the account unchanged.
