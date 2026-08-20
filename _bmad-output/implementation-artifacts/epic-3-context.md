# Epic 3 Context: Learner-Selected Practice And Answer Review

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Enable signed-in learners to independently choose or resume short, published practice sets, confirm essential media is ready, complete any of the five P0 task engines, and submit once for reliable post-submission review. The flow must preserve learner choice, prevent premature feedback and answer loss, and create the immutable, server-authoritative evidence that later recommendation and teacher guidance depend on.

## Stories

- Story 3.1: Choose Or Resume Practice
- Story 3.2: Prepare Essential Media And Safe PWA Storage
- Story 3.3: Complete The Five P0 Task Engines
- Story 3.4: Recover Open Attempts During Connectivity Loss
- Story 3.5: Submit, Score And Review A Practice Set

## Requirements & Constraints

- Learners may access only their own published choices, open attempts, drafts, and submitted results. They can browse by topic or task type and see each set's title, paper/part, estimated duration, and the appropriate Start, Resume, or Review action.
- Recommendations use only the learner's own latest submitted attempt for each set within the fixed 30-day evidence window. Rank eligible published sets for `needs practice`, then `building`, then other content; record the recommendation version and shown set IDs. Explain the relevant practice area without an official-result claim, and never make a recommendation mandatory or create an assignment.
- Only published immutable set snapshots are selectable. Retired source content must not affect active or completed attempts or their reviews.
- Verify every essential authorised media asset before an attempt begins. Show readiness by asset type; failures identify the failed asset and offer retry or leave. Do not create an attempt until the server atomically rechecks learner authorisation, snapshot state, and essential-media availability.
- Support exactly `picture_true_false`, `picture_yes_no`, `audio_picture_choice`, `audio_note_taking`, and `word_bank_cloze`. Open responses remain editable; audio replay is unlimited, playback events are retained, and seeking is unavailable unless the template permits it.
- Never expose correctness, answers, explanations, predicted scores, or score-like UI before final submission. Submission confirmation states answered and unanswered counts, permits unanswered items, and offers review questions or explicit submission.
- Finalise and score on the server in one atomic, idempotent transaction. Persist immutable final responses, automatic outcomes, timing, retry/playback events, answer-policy version, and snapshot curriculum tags. Automatic outcomes are limited to `correct`, `incorrect`, `unanswered`, and `needs_teacher_review`.
- Answer review is available only after submission and uses the submitted snapshot to show the learner response, approved answer, approved explanation, and product-owned evidence labels. Do not use pass/fail, official-result, certificate, ranking, or competitive language.
- Mobile-first learner practice must meet WCAG 2.2 AA: 48 by 48 CSS-pixel controls, keyboard operation in instruction order, visible and announced state, non-positional picture labels, and no reliance on colour or fine pointer use. A media-dependent set remains unavailable when essential media cannot be used.

## Technical Decisions

- Keep practice logic in the modular-monolith practice feature. Routes and UI call application use-cases; cross-feature reads use typed query/use-case contracts rather than direct persistence access. Validate external input at the boundary with shared schemas.
- The browser may render snapshots, preload/play authorised media, collect answers and playback events, and retain a recoverable local draft. The server remains authoritative for authorisation, attempt creation and writes, finalisation, scoring, evidence projection, and releasing review data after submission.
- An attempt references one published set version and its immutable item snapshots. Use snapshot content, media versions/hashes, feedback, accessibility metadata, tags, and versioned answer policy for active/completed attempts; never query editable source records for attempt content or scoring.
- Every attempt write requires the authenticated account, attempt ID, expected monotonic revision, and an open attempt. Return stable `ATTEMPT_REVISION_CONFLICT` for stale concurrent writes, `ATTEMPT_SCOPE_MISMATCH` for account/set key mismatch, and `ATTEMPT_FINALISED` for post-submit writes or a different finalisation key. Return authoritative server state for reload rather than silently merging.
- `submitAttempt` reconciles the current client draft, locks and closes the open write set, validates its snapshot, persists responses/events, scores against the machine-readable versioned policy, projects evidence, and marks submission in a PostgreSQL transaction. Repeating the same idempotency key returns the saved result.
- Use private object storage with server-issued short-lived authorised URLs for published snapshot media. Namespace cache and IndexedDB keys by authenticated account plus attempt and set-version IDs. Reject, never adopt, mismatched keys.
- Service-worker storage is limited to static shell assets and authorised set assets. Never cache API, HTML/document, signed-URL, result, answer-review, or teacher-evidence responses. IndexedDB is only for open-attempt drafts. On account switch, sign-out, or deactivation, purge only the prior account namespace.

## UX & Interaction Patterns

- Use a calm, child-friendly, single-column practice flow: one task and response action at a time, media before the response, concise literal instructions, text progress, and a reachable mobile-safe bottom action area. Do not use game-like rewards, auto-advance, drag, hover-only controls, or autoplay.
- Learner home provides topic/task-type choices, a clear no-recommendation state, and one Resume action with last saved time. Starting again requires confirmation and retains submitted attempts.
- Preparation visibly lists each essential asset. Do not enable start while media is absent. If the snapshot, authorisation, or media changes after preloading, keep the set unavailable and offer retry or another ready set.
- Provide persistent plain-language offline status during an open attempt. Keep a verified local draft where available; if storage is unavailable or saving fails, retain visible input, offer retry, and do not claim the work is saved. Offline submission keeps the attempt open, requires reconnection, queues nothing, and shows no partial result.
- On a stale draft, preserve visible unsent input separately without merging or overwriting server data; offer Reload latest or Leave. A media URL expiring mid-attempt pauses only that media, preserves the draft, and retries after reconnect/authentication without counting a failed refresh as a replay.
- The player exposes Save and leave and requires explicit audio play. Pre-submission controls show selection and save state accessibly but no correctness. Post-submission review may use correctness comparison styling and must retain its original snapshot even if the source is retired.

## Cross-Story Dependencies

- Stories 3.1-3.5 require published, media-authorised immutable practice-set snapshots from Epic 2; content readiness and publication determine what can be selected.
- Story 3.2 establishes the asset-readiness, cache, and attempt-start boundary used by Stories 3.3-3.5.
- Story 3.3's versioned response and playback writes feed Story 3.4 recovery and Story 3.5 finalisation.
- Story 3.5 produces immutable evidence and recommendation inputs consumed by Epic 4; later teacher resolutions may update aggregate/recommendation projections without changing learner-visible submitted results.
- Epic 5 reuses this standard learner selection, preparation, attempt, and review flow for supervised first practice; it introduces no diagnostic variant.
