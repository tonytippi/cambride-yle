---
name: CambridgeYLE
status: final
sources:
  - ../../brief-CambridgeYLE-2026-08-17/brief.md
  - ../../../../docs/starters-curriculum-and-assessment-blueprint.md
design: DESIGN.md
updated: 2026-08-17
---

# CambridgeYLE Experience Spine

## Foundation

Responsive web application and installable PWA. Learner practice is mobile-first; teacher, admin, and content-editor work is efficient on desktop but remains usable on tablets. `DESIGN.md` owns visual identity; this document owns behavior. The P0 UI system is component-based but no library is selected yet.

The product is a Starters practice application, not an official exam service. It shows only original, approved content and uses product-owned progress labels. Listening and Reading/Writing are deterministically scored. Speaking, parent accounts, self-registration, payment, and a full mock are outside P0.

## Information Architecture

| Surface | Reached from | Purpose |
| --- | --- | --- |
| Sign in | App entry | Authenticate an admin-created learner, teacher, or admin account. |
| Learner home | Sign in, learner navigation | Show assigned/recommended practice sets, resumable drafts, and recent completed results. |
| Practice preparation | Learner home | Confirm media preload and readiness before a set begins. |
| Practice player | Preparation or recovered draft | Complete one approved practice set without seeing answers or correctness. |
| Submit confirmation | Practice player | Make the learner intentionally finish the complete set. |
| Result summary | Submission | Show completed status, product-owned evidence labels, and answer-review entry point. |
| Answer review | Result summary | Compare each submitted response with the approved answer after submission. |
| Teacher cohort dashboard | Teacher navigation | Identify patterns by cohort, learner, paper, part, and language target. |
| Learner evidence detail | Cohort dashboard | Inspect a learner's completed sets and item-level evidence. |
| Assignment flow | Teacher dashboard | Assign an approved set to one learner or cohort. |
| Admin accounts and cohorts | Admin navigation | Create, edit, enrol, and delete accounts; manage cohorts. |
| Content library | Admin navigation | Search/filter approved and unpublished questions and practice sets. |
| Question editor and review | Content library | Author, validate, preview, review, publish, retire a question. |
| Practice-set composer | Content library | Assemble only approved questions into an assigned or diagnostic set. |
| Diagnostic setup | Admin navigation | Create a supervised prospective-learner account and assign a diagnostic practice set. |

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
| `Delete Minh's account? This also removes their diagnostic data.` | `Are you sure?` |

## Component Patterns

Behavioral rules; visual rules are in `DESIGN.md.Components`.

| Component | Use | Behavioral rules |
| --- | --- | --- |
| Practice-set card | Learner home | Shows title, part, estimated time, and `Start`, `Resume`, or `Review`. It never shows a predicted score. |
| Media readiness panel | Practice preparation | Lists required audio/image downloads. `Start` stays unavailable until essentials are available; retry is explicit on failure. |
| Practice header | Player | Shows question position and `Save and leave`. It does not expose score, correctness, or answers. |
| Choice/boolean/yes-no input | Player | Exactly one answer selected; learner can change it until submission. Selection is announced and remains visible. |
| Short text input | Note-taking/cloze | Preserves entered text locally; normalized deterministic scoring occurs only at submission. |
| Audio player | Listening | Has accessible play/replay action. Playback events are stored. Template playback rules determine replay limits; seeking is not offered unless a template permits it. |
| Submit confirmation | Player | States answered/unanswered count. `Submit practice` is available only after an explicit confirmation; unanswered items remain permitted and are recorded as unanswered. |
| Answer-review row | Post-submission only | Shows prompt/media reference, learner response, approved answer, correct/incorrect/needs-teacher-review result, and approved explanation. |
| Evidence filter | Teacher surfaces | Filters paper, part, vocabulary, grammar, topic, time range, and practice set. Filters update summaries and drill-down together. |
| Status workflow control | Editor | Allows only `draft -> in_review -> approved -> published -> retired`; approval and publish require required validation fields and reviewer identity. |
| Deactivate-account dialog | Admin | Requires account identifier and consequence text. Soft-deletes the account, revokes active sessions, and prevents future login only after explicit confirmation; action is audit logged. |

## Task Engine Behavior

| Engine | Learner action | Pre-submission behavior | Post-submission review |
| --- | --- | --- | --- |
| `picture_true_false` | Choose true or false for a picture statement | Choice may change; no correctness response | Submitted choice, approved answer, explanation tied to picture/statement |
| `picture_yes_no` | Choose yes or no for a picture statement | Choice may change; no correctness response | Submitted choice, approved answer, explanation |
| `audio_picture_choice` | Replay approved audio and choose A/B/C picture | Audio policy enforced; selection may change | Submitted option, approved option, explanation |
| `audio_note_taking` | Replay approved audio and enter a name/number | Entry retained; no spelling correction or hint | Normalized result; show accepted answer; `needs teacher review` when policy requires |
| `word_bank_cloze` | Select/copy a word into each blank | Entries may change; no partial correctness | Completed text, approved mapping, explanation per blank or passage |

## State Patterns

| State | Surface | Treatment |
| --- | --- | --- |
| First learner visit | Learner home | Explain that practice answers appear after a completed set. Show assigned sets or a clear empty state. |
| No assigned practice | Learner home | `No practice set is ready yet.` Do not fabricate recommendations. |
| Draft available | Learner home | One `Resume` action with last saved time; `Start again` requires confirmation and preserves prior submitted attempts. |
| Preload in progress | Preparation | Show each essential asset as preparing; do not begin with absent media. |
| Preload failure | Preparation | Identify failed asset type, offer retry, and provide `Leave` without losing home state. |
| Offline during practice | Player | Retain responses locally and show a persistent plain-language offline state. Submission waits until a server connection is available unless a later product decision adds queued submission. |
| Save/recovery error | Player | Keep the visible answer; show retry state. Never claim it is saved if it is not. |
| Unanswered questions | Submit confirmation | State count and provide `Review questions` or `Submit anyway`; no forced answer. |
| Scoring in progress | Result transition | Show a brief non-blocking completion state. Do not expose an incomplete score. |
| Empty teacher evidence | Dashboard | `No completed practice yet for this selection.` Offer filters reset; do not infer a learning level. |
| `not assessed yet` | Teacher/learner result | State that there is insufficient completed evidence, not a deficiency. |
| Item needs teacher review | Result and dashboard | Mark as `Needs teacher review`; exclude it from automatic correct-rate calculations until resolved. |
| Permission denied | All protected routes | Redirect to the role's home with `You do not have access to that page.` |
| Retired content in old result | Review | Preserve completed attempt and original item version for teacher review; never re-score it against a replacement. |
| Deactivated account | Sign in/admin account detail | Reject sign-in with a generic failure. Admin sees that the account is deactivated and can review its audit history; P0 does not purge practice or diagnostic records automatically. |

## Interaction Primitives

- Tap/click to choose, play audio, continue, or open evidence. Keyboard users can reach and activate every control.
- `Back` in the player opens `Save and leave`; it does not discard a draft silently.
- The bottom action area remains reachable above the mobile browser chrome and software keyboard.
- The player avoids drag, hover-only controls, timed disappearance, forced auto-advance, and per-question correctness animations.
- Audio requires an explicit learner action to play; autoplay is not relied on.
- Teacher tables provide sort/filter controls with a card layout fallback. Rows remain selectable with keyboard and touch.
- Admin account deactivation is always a named, explicit action; no swipe-to-delete for accounts.

## Accessibility Floor

- Meet WCAG 2.2 AA. Contrast decisions follow `DESIGN.md`; all state color has visible text and programmatic state.
- Learner controls have minimum 48 by 48 CSS pixel targets and generous spacing. Picture options use labels such as `Picture A` rather than position-only instructions.
- Keyboard order follows the instructional reading order. Focus is visible, never trapped outside an open dialog, and returns to its trigger when closed.
- Screen readers announce question number, task instruction, selected answer, audio state, required input constraints, save status, and result status.
- Provide alternative text for teacher/admin review. Do not expose learner-facing alt text, transcripts, or labels that reveal an answer; offer an equivalent approved accessible alternative task where media is essential.
- Short answer fields state expected input, for example `Write one number` or `Write one word`; errors after submission explain the accepted answer without ridicule.
- Respect reduced motion and user zoom. No critical task depends on color perception, fine pointer precision, or audio alone without an approved equivalent accommodation.

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
- Only admin-created accounts can sign in. Diagnostic accounts are supervised, not a public sign-up route.

## Key Flows

### Flow 1 - Complete a practice set (Linh, 7, on her mother's phone after class)

1. Linh signs in with the account created by the centre.
2. Learner home shows an assigned `Listening Part 3: Animals` set, marked `About 6 minutes`.
3. She chooses `Start`. The preparation surface confirms that all three audio clips and pictures are ready.
4. The player presents one question at a time. Linh taps replay, then chooses a picture. She changes one earlier answer without seeing whether either choice is right.
5. She reaches the end. The confirmation says `You answered 5 of 5 questions. When you submit, you can check your answers.`
6. **Climax:** Linh taps `Submit practice`; the result summary changes the unknown attempt into a calm review invitation, with `Check my answers` available only now.
7. She opens answer review and sees her own choice beside the approved answer and a brief explanation. The completed evidence is available to her teacher.

Failure: an audio asset fails before start -> preparation names the problem and offers retry; Linh cannot start a set with missing essential audio.

### Flow 2 - Prepare an offline intervention (Mai, Starters teacher, 20 minutes before class)

1. Mai signs in on her laptop and opens her cohort dashboard.
2. She filters to completed practice from the last seven days and sees `Listening Part 2` as `needs practice` for several learners.
3. She filters the target to `numbers` and opens Linh's evidence detail.
4. The detail shows submitted name/number responses, attempt times, audio replay events, and any item marked `needs teacher review`.
5. **Climax:** Mai identifies a concrete offline activity: number dictation with extra support for two learners, instead of rechecking every home worksheet manually.
6. She assigns an approved follow-up set to the cohort. It appears on learner home; no live monitoring is expected.

Failure: no completed data matches the filter -> dashboard says there is not enough completed evidence and allows Mai to reset filters rather than implying a weakness.

### Flow 3 - Publish a safe practice set (An, admin/content editor, on desktop)

1. An opens a draft question in the content library.
2. The editor shows its required task metadata, answer policy, target vocabulary/grammar, original media, and validation flags.
3. An fixes missing tags and sends the item to academic review. The reviewer approves it.
4. An uses the phone-width preview to verify that image regions, audio controls, and answer options are usable.
5. An publishes the question, composes an approved-only practice set, and assigns it to Mai's cohort.
6. **Climax:** The set is available to learners with all required media and deterministic answer policy attached; the teacher receives evidence that can be used offline.

Failure: validator finds vocabulary outside the allowed Starters set or missing media -> publish remains unavailable and the editor identifies the field needing review.

### Flow 4 - Supervised diagnostic and deletion (Quang, centre admin, with a prospective learner)

1. Quang creates a temporary learner account and assigns an approved diagnostic practice set.
2. The learner completes it under supervision and receives post-submission practice feedback.
3. Quang or a teacher reviews implemented-part evidence to support a placement conversation, without presenting an official result.
4. **Climax:** If the family does not continue, Quang opens the account record, confirms the named deactivation action, and immediately prevents future sign-in.

Failure: Quang attempts deactivation accidentally -> the confirmation states the learner name and access consequence; cancel returns to the account unchanged.
