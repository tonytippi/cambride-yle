---
title: 'Story 4.3: Resolve Uncertain Item Outcomes'
type: 'feature'
created: '2026-08-21'
status: 'done'
baseline_revision: '88fbe53eb659e95d86b992dd00f7cc3450c87355'
baseline_commit: '88fbe53eb659e95d86b992dd00f7cc3450c87355'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '_bmad-output/implementation-artifacts/epic-4-context.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Một controlled response có `needs_teacher_review` hiện không thể được academic lead hoặc admin quyết định lại. Vì vậy evidence state và guidance không thể phản ánh quyết định dạy học đã có căn cứ, dù automatic result và learner review phải luôn được giữ nguyên.

**Approach:** Bổ sung lịch sử resolution append-only, versioned cho submitted evidence item; expose effective outcome qua evidence read model; và cung cấp mutation phân quyền, conflict-safe để tái dựng derived evidence/recommendation mà không thay đổi immutable submission.

## Boundaries & Constraints

**Always:** Chỉ active `academic_lead` và `admin` được resolve sau authorisation; `teacher` chỉ đọc. Chỉ submitted item có automatic outcome `needs_teacher_review` được resolve thành effective `correct`, `incorrect`, hoặc `unanswered`. Mỗi write kiểm current resolution revision trong một transaction, append version mới cùng resolver, UTC time và reason, và trả `TEACHER_RESOLUTION_CONFLICT` khi stale. Automatic outcome, score, submitted attempt/review snapshot, learner-visible review/result, evidence-fact history và audit history không được sửa. Evidence state, aggregate và current recommendation-derived read model dùng effective outcome/version; unresolved vẫn bị loại khỏi rate. Read/mutation audit chỉ giữ actor, opaque target, time và safe outcome.

**Block If:** Schema submitted snapshot không cho phép liên kết resolution với đúng immutable review item/evidence fact, hoặc thực hiện rebuild current evidence/recommendation mà không sửa lịch sử immutable.

**Never:** Không thêm teacher mutation, cohort/class scope, time-range picker, ranking, AI recommendation, public curriculum claim, official-result/pass-fail wording, hay thay đổi Story 4.2 filter/latest-attempt/30-day semantics. Không ghi response, answer key, media, signed URL, raw audio, password hoặc session identifier vào audit/log/error.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First resolution | Academic lead/admin submits valid unresolved review item, outcome, reason, revision `0` | One immutable version is appended; effective outcome/version, aggregates and current guidance refresh | No error expected |
| Correction | Existing resolution and current revision supplied | A new immutable version preserves prior decision and becomes effective | No error expected |
| Stale correction | Existing resolution revision differs from supplied revision | Prior effective resolution remains unchanged | Stable `TEACHER_RESOLUTION_CONFLICT` response and refresh/retry path |
| Forbidden or invalid request | Teacher/learner/inactive actor, malformed input, non-review item or automatic outcome not `needs_teacher_review` | No evidence mutation or sensitive disclosure | Stable access/input failure before repository write |
| Unresolved aggregate | No resolution exists | Item stays visibly `Needs teacher review` and is excluded from assessable rate | No division by zero or inferred weakness |

</intent-contract>

## Code Map

- `db/schema/evidence.ts:7-34` -- immutable submitted facts and outcome enum; add resolution history relation/version constraints without making facts mutable.
- `db/schema/identity.ts:37-45`, `src/features/identity/infrastructure/repositories.ts:77-79` -- evidence-read-only audit schema/writer that must safely support resolution mutation audit.
- `db/migrations/0020_practice_attempt_submission_review.sql:27-41`, `db/migrations/0021_teacher_evidence_projection.sql:25-54`, `db/migrations/0022_teacher_evidence_filter_drilldown.sql:3-20` -- existing immutability/projection guards to preserve and extend with append-only resolution guards.
- `src/features/practice/application/evidence-contract.ts:1-22` -- typed cross-feature submitted evidence reader; extend facts/details with effective outcome and resolution version, plus narrow rebuild contract where required.
- `src/features/practice/infrastructure/repositories.ts:49-60,188-188,206-266,276-286,288-295` -- submission projections, current learner recommendation source, staff reads and learner immutable review; implement effective join and transaction-owned derived rebuild while retaining learner automatic review.
- `src/features/evidence/domain/evidence-state.ts:3-30` -- deterministic state/latest rule; calculate assessable correctness from effective, not automatic, outcomes.
- `src/features/evidence/application/get-centre-evidence.ts:9-34` -- existing authorise-before-read/filter/audit semantics to retain; add dedicated resolution input/use case rather than letting read flow mutate.
- `src/app/api/evidence/route.ts:7-24`, `src/features/evidence/ui/evidence-dashboard.tsx:9-22`, `src/app/teacher/page.tsx:5-13` -- current GET-only protected evidence transport and dashboard; add role-gated resolution control, safe mutation response and stale refresh/retry behaviour.
- `tests/unit/evidence-state.test.ts`, `tests/unit/evidence-application.test.ts`, `tests/unit/practice-application.test.ts`, `tests/integration/evidence-route.test.ts`, `tests/integration/evidence-projection.test.ts`, `tests/unit/teacher-evidence-page.test.ts`, `tests/e2e/teacher-evidence.spec.ts` -- existing evidence conventions and required regression coverage.

## Tasks & Acceptance

**Execution:**
- `db/schema/evidence.ts`, `db/schema/identity.ts`, `db/migrations/0023_teacher_evidence_resolution.sql` -- model append-only resolution versions scoped to immutable submitted evidence, validate resolvable automatic outcome/effective values and revision uniqueness, add indexes/foreign keys and database guards that reject UPDATE/DELETE; extend safe audit constraints without invalidating existing records.
- `src/features/practice/application/evidence-contract.ts`, `src/features/practice/infrastructure/repositories.ts` -- return effective outcome and current resolution version from immutable resolution history; implement a transaction-owned append-and-rebuild operation that updates only derived item evidence/aggregate/current recommendation projection while preserving submitted facts, snapshots and prior recommendation audits.
- `src/features/evidence/domain/evidence-state.ts`, `src/features/evidence/application/get-centre-evidence.ts`, `src/features/evidence/infrastructure/repositories.ts` -- calculate states from effective outcomes, validate resolution input with Zod, authorise academic lead/admin before target access, map stale revision to stable conflict, record safe mutation audit and structured outcome-only logging.
- `src/app/api/evidence/route.ts`, `src/app/teacher/page.tsx`, `src/features/evidence/ui/evidence-dashboard.tsx`, `src/app/globals.css` -- add no-store mutation transport with stable envelopes, role-gated accessible resolution form (outcome, reason, revision), success refresh, and conflict refresh/retry; retain neutral labels and 48px keyboard/touch controls.
- `tests/unit/evidence-state.test.ts`, `tests/unit/evidence-application.test.ts`, `tests/unit/practice-application.test.ts`, `tests/integration/evidence-route.test.ts`, `tests/integration/evidence-projection.test.ts`, `tests/unit/teacher-evidence-page.test.ts`, `tests/e2e/teacher-evidence.spec.ts` -- cover every matrix scenario, append-only database guards, auth-before-access, audit safety, effective state/current guidance rebuild, automatic learner review preservation, route envelopes/no-store and responsive conflict flow.

**Acceptance Criteria:**
- Given an item marked `needs_teacher_review`, when an authenticated academic lead or admin submits a valid current resolution, then the system appends an immutable effective-outcome version with reason, resolver and UTC timestamp in one transaction while retaining the automatic outcome and all submitted learner records.
- Given a stale resolution revision, when a correction is attempted after another resolution commits, then the original effective resolution and its history remain intact and the caller receives `TEACHER_RESOLUTION_CONFLICT` with a refresh/retry path.
- Given staff view evidence after a resolution, when summary, detail or learner recommendation-derived guidance is read, then current projections identify the effective-resolution version and calculate assessable state from effective outcomes while unresolved outcomes remain excluded under the existing fixed 30-day/latest-attempt rule.
- Given a teacher, learner, inactive account, malformed request, non-submitted item or item without automatic `needs_teacher_review`, when resolution is requested, then it is rejected before mutation without exposing sensitive evidence or changing any projection.
- Given a learner opens their submitted result, when a staff resolution exists, then response, score, automatic outcome, approved answer and feedback remain exactly the immutable submitted review.

## Design Notes

The resolution is a separate immutable history because submitted evidence facts and review items already have database-level mutation guards. The current effective outcome is the newest version for the matching immutable review-item/fact scope; a correction appends rather than overwrites. This lets staff guidance change without rewriting the learner's historical result.

## Review Triage Log

### 2026-08-21 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 6 (high 3, medium 3, low 0)
- defer: 0
- reject: 10
- addressed_findings:
  - `[high]` `[patch]` Resolution insert now requires an immutable submitted-evidence-fact scope, preventing orphan resolutions that evidence reads cannot project.
  - `[high]` `[patch]` Resolution success audit now writes within the mutation transaction, and action-scoped audit validation preserves account-target integrity for existing audit events.
  - `[high]` `[patch]` Database-backed tests now cover persisted effective outcome/revision, append-only history, stale collision, invalid scope and immutable learner review fields.
  - `[medium]` `[patch]` Resolved details no longer show the unresolved marker or resolution form.
  - `[medium]` `[patch]` Resolution form now recovers from network/non-JSON failures and refreshes only after success or stale conflict.
  - `[medium]` `[patch]` Application test expectations now reflect transactional success audit ownership.

## Auto Run Result

Story 4.3 implemented immutable, append-only staff resolutions for submitted uncertain item outcomes. Active `academic_lead` and admin users can append a conflict-safe effective outcome with a reason; staff evidence reads use that effective outcome while the learner's submitted review remains automatic and unchanged.

Files changed:
- `db/schema/evidence.ts`, `db/schema/identity.ts`, `db/migrations/0024_teacher_evidence_resolution.sql`, `db/migrations/meta/_journal.json` — resolution persistence, audit support and migration registration.
- `src/features/evidence/application/get-centre-evidence.ts`, `src/features/evidence/domain/evidence-state.ts`, `src/features/evidence/infrastructure/repositories.ts` — authorised mutation, effective evidence state and transactional persistence boundary.
- `src/features/practice/application/evidence-contract.ts`, `src/features/practice/infrastructure/repositories.ts` — effective outcome/revision reads and rebuilt derived attempt evidence.
- `src/app/api/evidence/route.ts`, `src/app/teacher/page.tsx`, `src/features/evidence/ui/evidence-dashboard.tsx`, `src/features/evidence/ui/evidence-resolution-form.tsx`, `src/app/globals.css` — no-store resolution API and accessible role-gated staff controls.
- `tests/unit/evidence-state.test.ts`, `tests/unit/evidence-application.test.ts`, `tests/integration/evidence-route.test.ts`, `tests/integration/evidence-projection.test.ts`, `tests/integration/migration-baseline.test.ts`, `tests/e2e/teacher-evidence.spec.ts` — effective outcomes, conflict, immutability, route and migration coverage.

Review findings: 6 patches applied (3 high, 3 medium), 0 deferred, 10 rejected. Follow-up review is recommended: `true` (3 high patched findings; score 9).

Verification passed: `npm run lint`; `npm run typecheck`; targeted Vitest suite (6 files, 46 tests); teacher evidence Playwright suite (1 test); and `git diff --check`.

Residual risk: the existing teacher-evidence Playwright fixture verifies the current responsive read flow and migration application, but does not yet execute the new resolution form's complete browser journey.

## Verification

**Commands:**
- `npm run lint` -- expected: no lint errors.
- `npm run typecheck` -- expected: no TypeScript errors.
- `npm test -- --run tests/unit/evidence-state.test.ts tests/unit/evidence-application.test.ts tests/unit/practice-application.test.ts tests/unit/teacher-evidence-page.test.ts tests/integration/evidence-route.test.ts tests/integration/evidence-projection.test.ts` -- expected: resolution, effective-state, immutability, authorisation, audit and route suites pass.
- `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/cambridgeyle_e2e npm run test:e2e -- tests/e2e/teacher-evidence.spec.ts --reporter=list` -- expected: authorised resolution and stale responsive flow pass.
- `git diff --check` -- expected: no whitespace errors.
