# Epic 3 Context: Learner-Selected Practice And Answer Review

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Enable learners to independently choose or resume a short published Starters practice set, confirm that required media is ready, complete one of the five supported task engines, and receive answer review only after an intentional, exactly-once submission. The experience must preserve learner choice, protect answer integrity, retain recoverable open work during connectivity loss, and create deterministic, immutable evidence for later recommendations and teacher review.

## Stories

- Story 3.1: Choose Or Resume Practice
- Story 3.2: Prepare Essential Media And Safe PWA Storage
- Story 3.3: Complete The Five P0 Task Engines
- Story 3.4: Recover Open Attempts During Connectivity Loss
- Story 3.5: Submit, Score And Review A Practice Set

## Requirements & Constraints

- Support only `picture_true_false`, `picture_yes_no`, `audio_picture_choice`, `audio_note_taking`, and `word_bank_cloze`. Practice sets are published, immutable, single-paper/part activities of 5-10 minutes with one or two primary objectives.
- Learners browse published sets by topic or task type and see title, paper/part, estimated duration, and the appropriate `Start`, `Resume`, or `Review` action. Retirement prevents future selection without changing active or completed attempts.
- Recommendations use only the learner's own evidence from the latest submitted attempt of each practice set in the prior 30 days. Rank matching `needs practice` content before `building`, then other eligible published content. Explain the practice area without an official-result claim, record the recommendation version and displayed set IDs, and never prevent manual selection.
- Verify every essential authorised image or audio asset before starting. Clearly show per-asset preparation, identify failure type, and offer retry or leave. Do not create an attempt until all essential assets are ready; revalidate the snapshot, learner authorisation, and asset availability atomically when starting.
- An open attempt permits answer changes and permitted audio replay. Persist responses and playback/retry events only while the attempt is open. Audio replay is unlimited; seeking is unavailable unless the task template explicitly permits it.
- Never expose correctness, approved answers, explanations, predicted scores, or score-like UI before final submission. Unanswered items remain allowed and must be recorded as unanswered.
- Submission confirmation shows answered and unanswered counts, with `Review questions` and explicit `Submit anyway` actions. Submission requires connectivity; offline submission retains the open draft, does not queue finalisation, and does not show a partial result.
- Score Listening and Reading/Writing items deterministically against the submitted snapshot's versioned answer policy. Automatic outcomes are only `correct`, `incorrect`, `unanswered`, and `needs_teacher_review`; uncertain short answers must not silently become correct.
- After submission, show only snapshot-based learner response, approved answer, explanation, and the product labels `secure`, `building`, `needs practice`, or `not assessed yet`. Use neutral practice language, never pass/fail, official-result, certificate, or Cambridge endorsement language.
- Meet WCAG 2.2 AA. Learner practice is mobile-first, one task at a time, keyboard-operable, with visible/announced state and 48 by 48 CSS-pixel minimum controls. Picture choices need non-positional accessible labels; controlled text fields state expected input. Essential-media tasks remain unavailable when media cannot be used; do not create an unsnapshotted substitute.
- Store only the minimum browser data needed for open-attempt recovery. Cache no API, HTML/document, signed-URL, result, answer-review, or teacher-evidence payload. Logs must not contain learner responses, answer keys, signed URLs, or raw audio.

## Technical Decisions

- Keep learner practice in the modular-monolith `practice` feature and PWA concerns in `pwa`. Routes and UI invoke application use-cases, never repositories or cross-feature tables directly; cross-feature reads use typed query/use-case contracts.
- The server is authoritative for authorisation, attempt lifecycle, finalisation, scoring, evidence projection, and release of answer-review data. The browser may render snapshot questions, preload/play media, collect responses/events, and persist a local draft.
- An attempt references exactly one published practice-set version and its immutable item snapshots. Editable content must never provide active/completed attempt content, media, feedback, tags, answer policy, or scoring data.
- Every response or playback write requires authenticated account ID, attempt ID, and expected monotonic revision while status is `open`. Return `ATTEMPT_REVISION_CONFLICT` for stale writes, `ATTEMPT_SCOPE_MISMATCH` for account/set key mismatches, and `ATTEMPT_FINALISED` for writes after submission or a different post-finalisation idempotency key. Return authoritative state so clients reload rather than silently merge.
- `startAttempt` atomically verifies learner scope, published snapshot state, and essential-media authorisation/availability before creating an open attempt. Failure creates no usable attempt.
- `submitAttempt` reconciles the final draft at the current revision, locks and closes the write set, validates its snapshot, persists final responses/events, scores, projects evidence, and marks the attempt submitted in one PostgreSQL transaction. Repeating the same idempotency key returns the saved result unchanged.
- The scoring module consumes only the snapshot's machine-readable, versioned answer policy and its normalisation/matching semantics. Evidence facts retain response outcomes, timing, replay/retry events, policy version, and curriculum dimensions needed by later evidence projections.
- Use private object storage for media binaries and PostgreSQL for media metadata, approval/version state, and associations. Issue short-lived authorised media URLs only for published snapshots. Namespace service-worker caches and IndexedDB keys by authenticated account plus attempt and set-version IDs; purge only that account's permitted assets and drafts on switch, sign-out, or deactivation. Never adopt a mismatched key.
- Use opaque UUIDv7 identifiers outside the database, UTC `timestamptz`, explicit lifecycle state constraints, Zod validation at request boundaries, and `{ data }` or `{ error: { code, message } }` response envelopes.

## UX & Interaction Patterns

- Learner home is home-first and presents topic/task-type choices, recommendations, resumable drafts, and completed results. With insufficient history, use a neutral empty recommendation state rather than inventing evidence claims.
- The preparation panel lists essential audio/image assets and disables `Start` until ready. If readiness changes during start revalidation, keep the set unavailable and offer retry or another ready set.
- The player has a question position and `Save and leave`, with no score display. Back opens save-and-leave rather than silently discarding work. Avoid drag, hover-only controls, forced auto-advance, timed disappearance, and correctness animations.
- Keep a persistent plain-language offline indicator during practice. Report recovery unavailable if storage is cleared or unavailable. On stale drafts, preserve visible unsent input separately and offer `Reload latest` or `Leave`; do not merge or overwrite. Media URL expiry mid-attempt preserves the draft and offers refresh/retry or save-and-leave.
- Use calm, short British-English microcopy. The mobile player is single-column with a fixed safe-area action area; desktop retains a focused maximum-width practice column. PWA installation is optional and must never block browser use.

## Cross-Story Dependencies

- Epic 3 consumes only published immutable practice-set, question, media, feedback, accessibility, provenance, and answer-policy snapshots from Epic 2. Its selection and start flows must honour content retirement and essential-media readiness.
- Story 3.1 supplies the selected set or recovered draft for preparation and player flows. Story 3.2 must complete before an attempt can be created for Stories 3.3-3.5.
- Stories 3.3 and 3.4 both operate on the same revisioned open attempt and account-namespaced local draft. Recovery rules must preserve server conflict semantics rather than overwrite another device/tab.
- Story 3.5 produces immutable item evidence and recommendation inputs used by Story 3.1 and Epic 4. Teacher resolutions may update staff-facing effective evidence and later recommendations, but cannot alter automatic outcomes, learner-visible submitted results, or submitted snapshots.
