---
title: 'Story 3.4: Recover Open Attempts During Connectivity Loss'
type: 'feature'
created: '2026-08-20'
status: 'done'
baseline_revision: 'ba9b10dce1d173a9f5c6bf1d623f573d022b8996'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '_bmad-output/implementation-artifacts/epic-3-context.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Practice player only retains input in React state and reloads immediately on a revision conflict. Learners therefore cannot tell whether offline work is recoverable, and can lose visible unsent input when connectivity or local storage fails.

**Approach:** Add account- and attempt-version-scoped IndexedDB drafts plus an explicit recovery state around the existing server-authoritative player. Reuse the safe authorised-media cache for an exact scoped offline fallback and extend account-scoped browser-storage cleanup without storing sensitive response payloads outside the permitted open draft.

## Boundaries & Constraints

**Always:** Treat the authenticated server account, open attempt, immutable set version and server revision as authoritative. Namespace every draft/cache operation with account ID, attempt ID and set-version ID; reject and never adopt a mismatch. Store only open-attempt response values, revision and minimal recovery metadata in IndexedDB, never answers, outcomes, feedback, scores, API payloads, signed URLs or media binaries. Preserve visible unsent input when storage, network or stale-revision errors occur; present explicit `Reload latest` or `Leave` rather than automatically merging or overwriting. Keep an announced persistent offline state, British-English copy, accessible controls and no pre-submit correctness. Permit only the existing five P0 engines. Cache fallback may return only an already-authorised binary under the matching account-scoped synthetic media key; all API, HTML/document, signed-URL, result, answer-review and evidence responses remain uncached. Purge only the departing account namespace on voluntary sign-out, account mismatch/session invalidation or a later account session.

**Block If:** The existing protected player route cannot provide the authenticated opaque account ID to its client surface without exposing a different account identity, or authorised media cache requests cannot be matched to an account-scoped synthetic key without caching capability URLs.

**Never:** Add server persistence or migrations for browser drafts; queue submission, finalisation or background response merging; adopt/rebind a draft to another account, attempt or set version; change attempt snapshot immutability or revision guards; create a partial result; cache sensitive API/HTML/review/evidence payloads; count a failed or refreshed media request as audio replay; or expose answers, feedback, outcomes or score-like state.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Offline response | Open owned attempt loses network after a visible input change | Player remains visibly offline and persists the namespaced local draft when IndexedDB works | Server save is not claimed; retry is explicit or revision-aware after reconnect |
| Storage unavailable | IndexedDB is unavailable, cleared, quota-limited or draft write fails | Visible input remains and player states recovery is unavailable or unsaved with `Retry` | Do not claim draft recovery or discard the visible value |
| Stale or mismatched draft | Local draft revision differs from server, or account/attempt/set-version key differs | Server state stays separate; UI offers `Reload latest` and `Leave` | Never auto-merge, overwrite or reattach; discard only through the selected safe action |
| Offline media | Authorised media request fails while offline and matching scoped cached binary exists | Affected media may use that binary while the local draft remains intact | Missing/mismatched cache pauses only that media and offers reconnect/retry without a replay event |
| Account lifecycle | Voluntary sign-out or player detects session/account mismatch | Only the old account cache and IndexedDB namespace are purged before continuing | Other account namespaces and mismatched records remain untouched |
| Offline submission | Submission is attempted while offline | Open draft remains local and server attempt remains open; learner is told to reconnect | No finalisation request queue, partial score or result is created |

</intent-contract>

## Code Map

- `src/features/practice/ui/practice-player.tsx` -- current React-only player state, serialised response/playback requests and automatic conflict reload; replace with explicit local-draft/recovery behaviour.
- `src/app/learner/practice/[setId]/attempt/[attemptId]/page.tsx` -- protected server entry that loads authoritative player state; pass the authenticated learner's opaque account ID into the client player.
- `src/features/practice/domain/contracts.ts` -- current open-player DTOs and stable error envelopes; add client-safe draft/recovery contracts without server answer material.
- `src/features/pwa/cache-policy.ts` -- canonical account namespace and draft-key helpers (`cacheNamespace`, `namespacedDraftKey`, `isNamespacedKey`) to reuse rather than duplicate key rules.
- `src/features/pwa/ui.tsx` -- `purgeAccountStorage(accountId)` currently clears Cache Storage/localStorage; extend it through the IndexedDB adapter only for the supplied account.
- `src/features/identity/ui/sign-out-button.tsx` -- already awaits account-scoped purge before sign-out; retain ordering while including IndexedDB drafts.
- `public/service-worker.js` and `public/pwa-cache-policy.js` -- authorised media is currently written under a synthetic key but not read on network failure; implement matching fail-closed fallback without broadening cache eligibility.
- `src/app/api/practice/attempt/[attemptId]/response/route.ts`, `playback/route.ts` -- existing no-store transport exposes `ATTEMPT_REVISION_CONFLICT`, `ATTEMPT_SCOPE_MISMATCH` and `ATTEMPT_FINALISED`; preserve their authority.
- `src/features/practice/infrastructure/repositories.ts:81-172` -- immutable attempt lookup/start and revisioned response/playback writes are server authority and must not be weakened.
- `tests/unit/pwa-cache-policy.test.ts`, `tests/unit/practice-application.test.ts`, `tests/integration/migration-baseline.test.ts` -- existing Node/Vitest test homes; add pure recovery/storage and worker-policy contracts without requiring a new DOM test framework.
- `src/app/globals.css` -- extend existing player/mobile-safe action styles with accessible offline, save and stale-recovery presentation.

## Tasks & Acceptance

**Execution:**
- [x] `src/features/pwa/open-attempt-drafts.ts`, `src/features/pwa/cache-policy.ts`, `src/features/pwa/ui.tsx` -- implement a small injectable IndexedDB open-draft adapter with validate/read/write/delete and account-only purge operations, reuse canonical namespace helpers, surface storage failures, and extend existing lifecycle purge without exposing a cross-account enumeration API.
- [x] `src/features/practice/domain/contracts.ts`, `src/features/practice/ui/practice-player.tsx`, `src/app/learner/practice/[setId]/attempt/[attemptId]/page.tsx`, `src/app/globals.css` -- provide trusted account identity, hydrate/persist only matching open drafts, retain visible input before server acknowledgement, show offline/recovery state, preserve stale input separately, and make reload/leave explicit while retaining current revisioned request serialisation and no-correctness UI.
- [x] `public/service-worker.js`, `public/pwa-cache-policy.js`, `src/features/pwa/cache-policy.ts` -- align runtime and tested policy for exact authorised-media synthetic-key fallback on network failure, with matching account/key validation and default-deny treatment of all other requests.
- [x] `src/features/pwa/open-attempt-drafts.ts` and `src/features/practice/ui/practice-player.tsx` -- make the recovery model explicitly draft-only: expose online/recovery state for the player, retain drafts while offline, and provide no submission/finalisation queue or partial-result path; Story 3.5 must consume that state at its submit surface without changing this contract.
- [x] `tests/unit/pwa-cache-policy.test.ts`, `tests/unit/practice-application.test.ts`, and focused pure recovery tests -- cover namespace validation, own-account-only purge, unavailable storage, stale/mismatched drafts, persistent offline state decisions, safe media fallback, forbidden cache classes, and no offline finalisation/automatic merge.

**Acceptance Criteria:**
- Given an open learner attempt, when connectivity is lost during practice, then the player visibly and accessibly reports offline status and retains a verified IndexedDB draft scoped to the signed-in account, attempt and immutable set version where storage is available.
- Given local storage is unavailable, cleared or cannot save, when the learner changes an answer, then their visible input is retained, recovery is honestly reported unavailable or unsaved, and they can retry without a false saved claim.
- Given a local draft has a stale revision or any namespace identity mismatch, when the player loads or receives an authoritative conflict, then it neither merges, overwrites nor reattaches data and offers only explicit `Reload latest` or `Leave` recovery choices while preserving unsent input until that choice.
- Given an authorised media request fails during an open attempt, when an exact matching account-scoped cached binary exists, then only that binary may be used; otherwise only the affected media pauses with retry/reconnect guidance and no playback event is recorded for the failed refresh.
- Given the learner signs out or a protected player detects a changed/invalid account session, when cleanup runs, then it removes only that account's Cache Storage and IndexedDB draft namespace before proceeding, never adopting or deleting another account's data.
- Given a learner attempts final submission while offline, when the submit boundary is reached, then the attempt remains open with its local draft retained, the UI requires reconnection, and no finalisation request is queued or partial result shown.

## Design Notes

The local draft is a recovery aid, not a second source of truth. A draft that cannot prove the exact account, attempt, set version and revision relationship is unsafe to apply. Keep the authoritative player state and visible unsent state separate so a concurrent device/tab write produces an explicit learner decision rather than a silent overwrite.

The service worker can only retrieve a cache entry using the synthetic key established after a successful authorised response. It must not use an arbitrary API request URL as a cache key or widen the policy to JSON/API responses.

## Verification

**Commands:**
- `npm test -- --run tests/unit/pwa-cache-policy.test.ts tests/unit/practice-application.test.ts` -- expected: draft namespace, purge, recovery-decision, media-cache and practice authority contracts pass.
- `npm test` -- expected: full Vitest suite passes without cache/security regressions.
- `npm run typecheck` -- expected: TypeScript has no errors.
- `npm run lint` -- expected: ESLint has no errors.
- `npm run build` -- expected: production build completes.
- `git diff --check` -- expected: no whitespace errors.

## Browser Runtime Gap

Pure contracts cover draft validation, hydration ordering and exact cache-key decisions. This repository has no browser IndexedDB or service-worker runtime harness, so account lifecycle messages, Cache Storage lookup and actual offline media playback remain a manual browser/PWA verification gap; they are not claimed as automated coverage.

## Review Triage Log

### 2026-08-20 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 20 (high 9, medium 8, low 3)
- defer: 0
- reject: 4
- addressed_findings:
  - `[high] [patch]` Serialised local draft and server mutation flows, preventing late hydration, older IndexedDB writes, and replay completions from overwriting visible newer answers.
  - `[high] [patch]` Rejected and removed corrupt or cross-identity drafts rather than exposing their responses; added exact account, attempt, set-version, revision and shape tests.
  - `[high] [patch]` Bound authorised media cache admission and server media reads to the immutable attempt set version and exact snapshot media key; fallback now requires the active client account and exact synthetic key.
  - `[high] [patch]` Made online playback evidence contingent on successful audio playback, allowed cached offline playback without fabricating server evidence, and retained drafts for attempt lifecycle/scope errors.
  - `[high] [patch]` Made authorised-media cache writes best-effort so cache quota failures cannot hide a successful online media response.
  - `[medium] [patch]` Distinguished malformed/server responses from connectivity failure, made stale leave wait for deletion, and made normal save-and-leave wait for the latest local draft write.
  - `[medium] [patch]` Kept cache policy default-deny and documented the remaining browser-only IndexedDB/service-worker runtime verification gap.

## Auto Run Result

Status: done

Summary: Added honest open-attempt recovery with account/attempt/version-scoped IndexedDB drafts, persistent accessible offline and stale-recovery states, serialised revision-aware writes, safe leave behaviour, and exact scoped authorised-media cache fallback.

Files changed:
- `src/features/pwa/open-attempt-drafts.ts`, `src/features/pwa/cache-policy.ts`, `src/features/pwa/ui.tsx` -- validated open-draft storage, account-only cleanup and cache-key policy.
- `src/features/practice/ui/practice-player.tsx`, `src/features/practice/domain/contracts.ts`, `src/app/learner/practice/[setId]/attempt/[attemptId]/page.tsx` -- trusted account scope, draft recovery, offline/status behaviour and revision-safe response/playback interaction.
- `src/app/api/practice/media/route.ts`, `src/features/practice/application/practice.ts`, `src/features/practice/infrastructure/repositories.ts`, `public/service-worker.js`, `public/pwa-cache-policy.js` -- immutable server media scope verification and fail-closed, exact-key authorised cache fallback.
- `tests/unit/pwa-cache-policy.test.ts` -- recovery identity, cache scope/key and worker-policy contracts.
- `_bmad-output/implementation-artifacts/sprint-status.yaml`, `epic-3-context.md` and this specification -- workflow tracking and implementation record.

Review findings: 20 patches applied (high 9, medium 8, low 3); 0 items deferred; 4 findings rejected. Follow-up review recommendation: true (score 27; high findings were fixed in this pass).

Verification:
- `npm test -- --run tests/unit/pwa-cache-policy.test.ts tests/unit/practice-application.test.ts` -- passed, 17 tests.
- `npm test` -- passed, 26 test files and 149 tests.
- `npm run typecheck` -- passed.
- `npm run lint` -- passed.
- `npm run build` -- passed.
- `git diff --check` -- passed.

Residual risks: The repository has no browser harness for real IndexedDB failures, service-worker client messages and Cache Storage fallback, or cached audio playback. Those runtime paths require manual browser/PWA verification; no automated runtime coverage is claimed.
