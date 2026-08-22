---
title: 'Story 5.2: Xem bằng chứng thực hành đầu tiên và vô hiệu hoá quyền truy cập'
type: 'feature'
created: '2026-08-22'
status: 'done'
review_loop_iteration: 0
baseline_commit: '0e702a8fe515b5d28a299a8645cce2079e9f5993'
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-5-1-set-up-a-supervised-first-practice-session.md'
  - '{project-root}/_bmad-output/project-context.md'
warnings: []
deferred:
  - summary: >-
      Full Vitest suite has a pre-existing migration lifecycle-trigger failure unrelated to Story 5.2.
    evidence: |-
      `npm test` fails only at `tests/integration/migration-baseline.test.ts:336`: the test expects `CONTENT_DRAFT_HISTORY_IMMUTABLE`, but PostgreSQL reports `record "new" has no field "status"`. Story 5.2 changes only account-detail navigation and evidence/deactivation coverage; it does not touch migrations or content lifecycle triggers.
    location: >-
      tests/integration/migration-baseline.test.ts:336
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Centre staff cần xem bằng chứng của learner đã hoàn thành buổi thực hành đầu tiên theo cùng evidence surface hiện hữu, sau đó admin cần có đường dẫn rõ ràng để vô hiệu hoá quyền truy cập không còn cần thiết mà vẫn giữ bản ghi.

**Approach:** Tái sử dụng teacher evidence view, immutable submitted-evidence projection và deactivation transaction hiện có. Từ hồ sơ learner của admin, cung cấp liên kết đến evidence detail của chính learner đó; không tạo loại tài khoản, điểm số hay luồng placement riêng.

## Boundaries & Constraints

**Always:** Chỉ `teacher`, `academic_lead` và `admin` được đọc evidence qua `getCentreEvidence`, và mỗi lần đọc phải ghi audit metadata an toàn. Chỉ admin được vô hiệu hoá bằng xác nhận email có tên; transaction hiện có phải thu hồi sessions, chặn đăng nhập sau đó, bảo toàn record/snapshot/attempt/evidence và bảo vệ `LAST_ACTIVE_ADMIN`. Dùng neutral practice language, British English, controls keyboard-operable và không hiển thị learner responses trong audit log.

**Block If:** Dừng nếu thực hiện cần phân loại/persisted flag cho prospective learner, thay đổi submitted snapshot, scoring, evidence-state semantics, hoặc cần giữ evidence detail của learner sau khi tài khoản đã deactivated. Các thay đổi này chưa được intent chọn lựa.

**Never:** Không tạo first-practice template, assignment, score, placement algorithm, public acquisition flow, automatic expiry, deletion, purge, reactivation, hay API bypass authorisation. Không sửa imported curriculum evidence hoặc thay đổi immutable practice records.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Admin mở bằng chứng learner | Admin đã xác thực xem hồ sơ của account role `learner` | Có liên kết đến `/teacher?learner=<accountId>`; destination dùng cùng evidence view, server-side role/resource authorisation và audit như teacher flow | Learner không có submission hiển thị empty state trung tính, không suy luận level |
| Hồ sơ staff không phải learner | Admin xem teacher, academic lead hoặc admin account | Không hiển thị liên kết evidence dành cho learner | Không tạo request evidence không hợp lệ |
| Vô hiệu hoá sau khi xem | Admin xác nhận đúng email của learner active | Dùng transaction deactivation hiện có để revoke session, chặn future auth và giữ evidence/attempt records | Sai confirmation, inactive target hoặc final active admin giữ stable error và không đổi state/session |

</intent-contract>

## Code Map

- `src/app/admin/accounts/[accountId]/page.tsx:12-20` -- admin-only account detail; thêm active-learner-only navigation tới existing evidence detail, giữ current lifecycle/deactivation UI nguyên vẹn.
- `src/app/teacher/page.tsx:5-14` -- existing authorised teacher/admin/academic-lead entrypoint chuyển `learner` query thành `learnerId` và render shared dashboard; tái dùng, không tạo route mới.
- `src/features/evidence/application/get-centre-evidence.ts:16-34` -- server-authoritative evidence query validates filters, limits summary to 30 days, retains detail reads and audits `EVIDENCE_READ`; không thay đổi semantics trong story này.
- `src/features/evidence/ui/evidence-dashboard.tsx:10-23` -- existing shared evidence/empty-state presentation for the linked destination; read-only reuse point.
- `src/features/identity/application/auth.ts:24-35` -- admin-only deactivation application contract maps `LAST_ACTIVE_ADMIN`, `ACCOUNT_NOT_ACTIVE` and `CONFIRMATION_MISMATCH`; reuse without change unless tests expose regression.
- `src/features/identity/infrastructure/repositories.ts:56-68` -- one-transaction active-admin lock, lifecycle update, session revocation and minimal audit; read-only invariant.
- `src/features/identity/ui/deactivate-account-form.tsx:8-19` -- existing named destructive confirmation, retention wording and focus restoration; do not duplicate it.
- `src/app/admin/actions.ts:12-15` -- server action validates deactivation input and refreshes account surfaces; read-only action seam.
- `tests/integration/admin-account-evidence-link.test.ts:16-53` -- focused rendering coverage for the active learner account-detail evidence link; excludes deactivated learners and every staff role.
- `tests/e2e/teacher-evidence.spec.ts:64-163` and `tests/unit/deactivate-centre-account.test.ts:19-53` -- evidence and deactivation regression coverage includes submitted, retained, and neutral empty-evidence journeys.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/admin/accounts/[accountId]/page.tsx` -- render an active-learner-only `Review practice evidence` link to the existing filtered teacher evidence view -- provides a composable admin journey without creating a first-practice feature boundary.
- [x] `tests/integration/admin-account-evidence-link.test.ts` -- cover admin account detail rendering the link only for active learner accounts, excluding deactivated learners and all staff roles -- prevents invalid evidence navigation and unsupported account roles.
- [x] `tests/e2e/teacher-evidence.spec.ts` and focused identity/evidence tests -- cover the composed authorised review then named deactivation journey, including neutral empty evidence, audit-safe reuse, session revocation and retained record invariants through existing contracts -- verifies Story 5.2 without duplicating scoring/evidence logic.

**Acceptance Criteria:**
- Given an authorised teacher, `academic_lead` or admin and a prospective learner with a submitted set, when the staff member opens that learner's existing evidence view, then submitted immutable evidence is shown only for implemented parts through the same teacher evidence surface and no separate score or placement outcome is produced.
- Given an admin views a learner account record, when they select `Review practice evidence`, then they reach the existing filtered evidence view for that learner; a non-learner account record does not offer that link.
- Given an admin has reviewed a learner's evidence, when they explicitly confirm named deactivation, then existing server-side deactivation revokes sessions and denies later authentication while submitted first-practice records remain retained and audit metadata excludes learner response content.
- Given deactivation would leave no active admin, when it is requested from the account record, then `LAST_ACTIVE_ADMIN` leaves account state and sessions unchanged.

## Design Notes

The prospective learner remains an ordinary centre-created `learner`, as fixed by Story 5.1. The account detail is merely a navigational composition point: it links to the established evidence reader rather than marking attempts as first practice or recalculating evidence. This preserves authorisation, immutable evidence and audit ownership at their existing boundaries.

## Verification

**Commands:**
- `npx playwright test tests/e2e/teacher-evidence.spec.ts` -- expected: authorised evidence dashboard/detail behaviour and its audit-safe journey pass.
- `npx vitest run tests/integration/protected-routing.test.ts tests/unit/deactivate-centre-account.test.ts tests/unit/admin-deactivation-action.test.ts` -- expected: role/navigation and lifecycle invariants pass.
- `npm run typecheck` -- expected: TypeScript completes without errors.
- `npm run lint` -- expected: lint completes without errors.
- `npm test` -- expected: complete unit/integration suite passes.

## Suggested Review Order

**Admin Evidence Entry Point**

- Limits the reused evidence destination to ordinary learner account records.
  [`page.tsx:19`](../../src/app/admin/accounts/[accountId]/page.tsx#L19)

**Composed Lifecycle Journey**

- Exercises review, named deactivation, retention, audit safety, and session revocation end to end.
  [`teacher-evidence.spec.ts:116`](../../tests/e2e/teacher-evidence.spec.ts#L116)

**Navigation Regression Coverage**

- Confirms the learner-only link and leaves non-learner records without an evidence request.
  [`admin-account-evidence-link.test.ts:20`](../../tests/integration/admin-account-evidence-link.test.ts#L20)

## Review Triage Log

### 2026-08-22 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 4 (medium 1, low 3)
- defer: 1 (medium 1)
- reject: 11
- addressed_findings:
  - `[medium]` `[patch]` Restricted the evidence link to active learner accounts so a retained deactivated account cannot navigate to an invalid evidence filter.
  - `[low]` `[patch]` Covered every staff account role, as well as deactivated learners, in the account-detail link regression test.
  - `[low]` `[patch]` Corrected the spec's test references to the newly added registered integration test rather than unchanged protected-routing coverage.
  - `[low]` `[patch]` Added an end-to-end active learner with no submissions journey that verifies neutral empty evidence and the safe `NO_DATA` audit outcome.

## Auto Run Result

- Summary: Added an active-learner account-detail entry point to the existing teacher evidence view, then verified the existing named deactivation flow retains submitted records and revokes learner sessions.
- Files changed:
  - `src/app/admin/accounts/[accountId]/page.tsx` -- renders `Review practice evidence` only for active learner accounts.
  - `tests/integration/admin-account-evidence-link.test.ts` -- covers link visibility for active/deactivated learners and all staff roles.
  - `tests/e2e/teacher-evidence.spec.ts` -- covers review-to-deactivation retention/audit journey and neutral no-submission evidence journey.
  - `_bmad-output/implementation-artifacts/spec-5-2-review-first-practice-evidence-and-deactivate-access.md` -- records implementation, review and verification evidence.
- Review findings: 4 patches applied; 1 pre-existing migration test failure deferred; 11 findings rejected as already covered by existing contracts or outside the implemented composition boundary.
- Follow-up review recommendation: false. Patched findings: high 0, medium 1, low 3; score 4.
- Verification: targeted Vitest passed (4 files, 15 tests); Playwright evidence suite passed (4 tests); `npm run typecheck`, `npm run lint`, and `git diff --check` passed. `npm test` has one deferred pre-existing failure in `tests/integration/migration-baseline.test.ts:336`; 35 files and 210 tests passed.
- Residual risk: Full-suite migration lifecycle trigger failure remains to be repaired in a dedicated content/migration change; deactivated learner evidence is intentionally not reopened through this active-only entry point.
