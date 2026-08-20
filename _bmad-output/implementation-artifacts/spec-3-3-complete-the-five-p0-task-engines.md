---
title: 'Story 3.3: Complete The Five P0 Task Engines'
type: 'feature'
created: '2026-08-20'
status: 'done'
baseline_revision: '6109c351bedfd139a86c4469fd09aae5bb25ab80'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '_bmad-output/implementation-artifacts/epic-3-context.md'
warnings: []
deferred:
  - summary: >-
      Player interaction and accessible-layout assertions are not automated because the current Vitest setup has no DOM renderer or component-test convention.
    evidence: |-
      The existing unit suite runs in a non-DOM environment, so rendered keyboard, 48px target, no-correctness and replay-control behaviour cannot execute without adding a test harness.
    location: >-
      vitest.config.ts
    severity: medium
  - summary: >-
      Attempt route transport contracts have no direct route-handler tests.
    evidence: |-
      Current practice tests mock the application boundary and do not invoke the new protected attempt route handlers or assert their no-store response headers.
    location: >-
      src/app/api/practice/attempt/
    severity: medium
  - summary: >-
      Migration 0019 guards are structurally inspected but not executed against PostgreSQL in an isolated attempt fixture.
    evidence: |-
      The integration suite asserts the migration journal and SQL guard text; direct database trigger execution for response/playback writes remains uncovered.
    location: >-
      tests/integration/migration-baseline.test.ts
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Story 3.2 can prepare and atomically create an open attempt, but its attempt route is a placeholder. Learners cannot yet answer P0 task items or replay required audio while retaining server-authoritative, revisioned evidence.

**Approach:** Replace the placeholder with a learner-safe player for exactly the five P0 engines. Add immutable-snapshot reads and open-attempt-only response/playback persistence, then expose them through protected no-store routes without revealing answers, feedback, scoring or correctness.

## Boundaries & Constraints

**Always:** Read item and media data only from the attempt's published immutable set-version snapshot; authorise learner scope before every read/write; validate input with Zod; require the current expected revision for response and playback writes; return `{ data }` or `{ error: { code, message } }`; and return authoritative state with stable scope, lifecycle and revision errors. Render one mobile-first task at a time, keep all targets keyboard-operable and at least 48 by 48 CSS pixels, give picture choices non-positional accessible labels, state controlled text input expectations, and allow word-bank changes until submission. Replay is unlimited while open; seeking is unavailable unless the snapshot explicitly permits it.

**Block If:** Published snapshot fields cannot provide learner-safe option labels for picture choices without exposing answer material.

**Never:** Add an engine outside `picture_true_false`, `picture_yes_no`, `audio_picture_choice`, `audio_note_taking`, and `word_bank_cloze`; read live drafts; expose answer policy, feedback, approved answers, outcomes, score-like UI or correctness before submission; call scoring; queue offline finalisation; retain signed media URLs, raw audio or answer material in logs; or merge stale writes client-side.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Load player | Learner owns an open attempt | Ordered immutable, allow-listed learner task snapshots render one at a time | Missing/scope-mismatched/finalised attempt returns stable error without task data |
| Save answer | Valid item response with current revision while open | Server upserts response, advances revision and returns authoritative revision | Stale revision returns `ATTEMPT_REVISION_CONFLICT`; wrong attempt/set/item returns `ATTEMPT_SCOPE_MISMATCH` |
| Change or clear answer | Existing response on an open attempt | Learner can replace or clear it without feedback | Submitted attempt rejects write with `ATTEMPT_FINALISED` |
| Replay audio | Required audio on an open attempt | Each replay can be played and its event retained; no replay quota | Invalid media/item or stale revision returns a stable error; no native seek control by default |
| Render engines | Snapshot contains any supported engine | Correct semantic controls, labels and editable input render with no correctness state | Unknown or malformed item is rejected server-side rather than rendered |

</intent-contract>

## Code Map

- `db/schema/content.ts:270-317` -- immutable `practiceSetItems` and `practiceSetItemMedia` snapshot source; player must allow-list learner-safe fields because it also contains answer policy and feedback.
- `db/schema/practice.ts:18-47` and `db/migrations/0018_practice_attempt_snapshot_metadata.sql` -- attempt status, snapshot identity and monotonic revision protections to extend for open writes.
- `src/features/practice/domain/contracts.ts` -- current preparation/start contracts and typed error envelope conventions; add player and mutation contracts beside them.
- `src/features/practice/application/practice.ts` -- learner-only application boundary and `getOpenPracticeAttempt` scope guard to reuse.
- `src/features/practice/infrastructure/repositories.ts` -- atomic published-start and immutable attempt lookup; add snapshot query and revisioned persistence here, not in routes/UI.
- `src/features/practice/infrastructure/media-gateway.ts` and `src/app/api/practice/media/route.ts` -- authorised media delivery reuse point; never expose an object URL or secret capability in player state.
- `src/app/learner/practice/[setId]/attempt/[attemptId]/page.tsx` -- current protected placeholder to replace with the player surface.
- `src/app/globals.css` -- focus/action baseline; add focused practice-player target sizing and responsive layout styles.
- `tests/unit/practice-application.test.ts` and `tests/integration/migration-baseline.test.ts` -- existing practice and migration verification homes.

## Tasks & Acceptance

**Execution:**
- `db/schema/practice.ts`, new migration and migration journal -- persist one editable response per attempt item and append-only playback events; guard item/media snapshot membership and reject all writes after finalisation.
- `src/features/practice/domain/contracts.ts`, `application/practice.ts`, `infrastructure/repositories.ts` -- add allow-listed player DTOs, Zod mutation inputs, learner-only use cases and conditional revisioned writes with authoritative errors.
- `src/app/api/practice/attempt/[attemptId]/route.ts`, response/playback route handlers -- expose protected no-store read/write boundaries that call application use cases only.
- `src/features/practice/ui/practice-player.tsx`, `src/app/learner/practice/[setId]/attempt/[attemptId]/page.tsx`, `src/app/globals.css` -- render exactly five accessible engines, editable answer controls and custom replay-only audio controls without correctness UI.
- `tests/unit/practice-application.test.ts`, player UI tests and `tests/integration/migration-baseline.test.ts` -- cover the matrix, secret-free DTO, engine semantics, lifecycle/scope/revision guards and migration constraints.

**Acceptance Criteria:**
- Given an open prepared attempt containing P0 task items, when a learner selects, changes or enters an answer and replays allowed audio, then the server persists response and playback evidence only while the attempt is open, every control is keyboard-operable with 48 by 48 CSS-pixel minimum targets, and no correctness indication is shown.
- Given a controlled text or word-bank task, when the learner interacts before submission, then the expected input is stated, the word-bank selection remains editable and neither interaction exposes answer correctness.
- Given a picture or audio task, when the learner operates it, then picture choices have non-positional accessible labels, replay has no quota, and seeking is absent unless the immutable snapshot explicitly permits it.

## Design Notes

The player DTO is a deliberate allow-list boundary. Snapshot tables contain post-submit fields, so a direct row-shaped API would make a later UI defect capable of leaking answer material before the server finalises the attempt. Optimistic writes return authoritative revision state; Story 3.4 may retain local drafts but must reload rather than merge a stale write.

## Review Triage Log

### 2026-08-20 -- Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 14 (high 3, medium 9, low 2)
- defer: 3 (medium 3)
- reject: 5
- addressed_findings:
  - `[high] [patch]` Render authorised image stimuli and make audio-picture labels/selection non-positional and single-path; avoid saving image IDs for unrelated engines.
  - `[high] [patch]` Validate engine-specific response values and audio-only playback against the immutable snapshot in repository and database guards.
  - `[high] [patch]` Serialise player mutations, handle non-JSON/network failures, and reload authoritative state on revision conflict.
  - `[medium] [patch]` Use a per-media audio ref, record replay before playback, and protect response deletion after finalisation.
  - `[medium] [patch]` Align Drizzle foreign-key declarations with the migration and return non-disclosing scoped 404 route responses.
  - `[medium] [patch]` Add migration-journal and structural trigger assertions for migration 0019.

## Auto Run Result

Status: done

Summary: Replaced the prepared-attempt placeholder with a learner-safe, mobile-first player for all five P0 engines. The player reads only immutable published snapshots, persists revisioned answers and replay events while an attempt is open, and never receives or renders correctness, answer policy, feedback or scoring data.

Files changed:
- `db/schema/practice.ts`, `db/migrations/0019_practice_attempt_responses_and_playback.sql`, `db/migrations/meta/_journal.json` -- response and playback persistence with snapshot, lifecycle and audio-only guards.
- `src/features/practice/domain/contracts.ts`, `application/practice.ts`, `infrastructure/repositories.ts` -- allow-listed player contracts, learner-authorised reads and engine-specific revisioned writes.
- `src/app/api/practice/attempt/*`, `src/app/api/practice/media/route.ts` -- protected no-store player, response, playback and attempt-scoped media boundaries.
- `src/features/practice/ui/practice-player.tsx`, `src/app/learner/practice/[setId]/attempt/[attemptId]/page.tsx`, `src/app/globals.css` -- accessible five-engine learner player, custom replay controls and responsive action layout.
- `tests/unit/practice-application.test.ts`, `tests/integration/migration-baseline.test.ts` -- practice application and migration-structure coverage.

Review findings: 14 patches applied (high 3, medium 9, low 2); 3 medium items deferred; 5 findings rejected. Follow-up review recommendation: true (patched counts high 3, medium 9, low 2; score 29).

Verification:
- `npm test` -- passed, 26 files and 147 tests.
- `npm run typecheck` -- passed.
- `npm run lint` -- passed.
- `npm run build` -- passed.
- `git diff --check` -- passed.

Residual risks: Browser interaction/accessible-layout coverage, route transport coverage and direct PostgreSQL trigger execution remain deferred because the current test harness does not provide a DOM/component or route-handler convention and migration tests structurally inspect SQL.

## Verification

**Commands:**
- `npm test` -- expected: practice, player and migration tests pass.
- `npm run typecheck` -- expected: TypeScript has no errors.
- `npm run lint` -- expected: ESLint has no errors.
- `npm run build` -- expected: production build completes.
- `git diff --check` -- expected: no whitespace errors.
