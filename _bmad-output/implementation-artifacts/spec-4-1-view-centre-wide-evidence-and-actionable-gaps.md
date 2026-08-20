---
title: 'Story 4.1: View Centre-Wide Evidence And Actionable Gaps'
type: 'feature'
created: '2026-08-20'
status: 'done'
baseline_revision: '4f6c47b2af9850eaa0b287ebb24c1488f994933a'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-4-context.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Teacher hiện không có màn hình hay dữ liệu evidence có thẩm quyền để xem thực hành đã nộp của toàn centre và hướng dẫn bước tiếp theo cho learner. Các projection hiện có chỉ là nhãn tổng hợp theo attempt/area, không đủ để áp dụng quy tắc evidence 30 ngày theo snapshot submitted.

**Approach:** Tạo feature `evidence` đọc qua hợp đồng typed của practice snapshots, lập projection/fact bất biến có thể truy vấn hiệu quả, rồi hiển thị dashboard và learner-detail entry cho staff được cấp quyền. Mọi lần staff đọc evidence đều được audit an toàn; trạng thái được tính deterministic theo luật phiên bản 30 ngày.

## Boundaries & Constraints

**Always:** Chỉ `teacher`, `academic_lead`, `admin` đang hoạt động được xem dữ liệu toàn centre; teacher chỉ đọc. Dùng latest submitted attempt của từng practice set trong 30 ngày UTC cố định; chỉ tính `correct`, `incorrect`, `unanswered`, loại `needs_teacher_review` chưa được resolve. Ít hơn 3 outcomes assessable là `not assessed yet`; dưới 60% là `needs practice`; 60 đến dưới 80% là `building`; từ 80% là `secure`. Evidence phải xuất phát duy nhất từ submitted immutable review snapshots, với paper/part/language target; không đọc content có thể sửa. Audit lưu actor, opaque target ID, time, outcome nhưng không có learner response, answer key, signed URL, media, password hay session ID. API dùng `{ data }` hoặc `{ error: { code, message } }`, Zod validation, `no-store`, và structured log đã redaction.

**Block If:** Schema snapshot không cung cấp đủ paper/part/language-target và outcome để tạo evidence fact mà không suy đoán mapping; hoặc chính sách data governance chưa được thể hiện bằng cơ chế access/retention có thể enforce trong application.

**Never:** Không thêm cohort/class scope, time-range filter, ranking, AI recommendation, official-result/pass-fail wording, thay đổi score/attempt/learner-visible result, hay khả năng teacher sửa content/evidence. Không triển khai full filtering/item drill-down của Story 4.2 hoặc resolution mutation của Story 4.3.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Staff dashboard | Teacher active, submitted snapshots trong 30 ngày | Summary centre-wide và learner evidence rows có state/actionable gap theo paper/part/target; mở learner detail entry | Audit read thành công với opaque target ID và outcome; response `no-store` |
| Insufficient evidence | Fewer than 3 assessable outcomes, hoặc toàn `needs_teacher_review` | Hiện `not assessed yet`, không gọi đó là weakness | Không chia cho 0, không suy luận gap |
| Latest-set rule | Nhiều submitted attempts cho cùng practice set | Chỉ attempt submitted mới nhất trong cửa sổ 30 ngày ảnh hưởng state | Attempt cũ không xuất hiện trong aggregate |
| Unauthorised read | Learner, session hết hạn hoặc staff inactive gọi page/API | Không trả evidence hay learner data | Stable authorisation failure; không đọc projection trước guard |
| No completed evidence | Không có evidence khớp lựa chọn mặc định | Empty state `No completed practice yet for this selection.` và reset filter nếu có | Audit outcome phản ánh read không có dữ liệu, không ghi payload nhạy cảm |

</intent-contract>

## Code Map

- `db/schema/practice.ts` -- nguồn attempt submitted, immutable review snapshot, playback và projection cũ; mở rộng typed contract thay vì để evidence import persistence trực tiếp.
- `db/schema/identity.ts` -- roles/account activity và `auditEvents`; mở rộng audit evidence-read với actor, target opaque ID, time, outcome an toàn.
- `db/schema/content.ts` -- `practiceSets` giữ paper, part, title và primary target IDs; là dimension được snapshot hoá khi finalise.
- `db/schema/curriculum.ts` -- canonical language-target/category records cần cho fact và presentation, không suy đoán tag từ editable content.
- `db/migrations/0017_learner_practice_selection.sql` through `0020_practice_attempt_submission_review.sql` -- guards immutable/lifecycle cần được giữ; migration mới nối tiếp để tạo fact/index/audit cần thiết.
- `src/features/practice/infrastructure/repositories.ts:197-230` -- `submitPracticeAttempt` transaction tạo final snapshot; điểm mở rộng contract/fact projection bảo đảm evidence không lệch submission.
- `src/features/identity/application/auth.ts` -- `authorise` và `roleHome`; tái dùng guard staff server-side.
- `src/features/identity/ui/session.ts` -- `requireRole` cho protected App Router pages.
- `src/features/identity/infrastructure/repositories.ts:42-65` -- mẫu ghi audit hiện hữu cần được tổng quát hoá mà không ghi sensitive payload.
- `src/shared/http/response.ts` -- response API nhất quán `{ data }` / stable error.
- `src/shared/logging/logger.ts` -- structured logging redacted cho evidence read.
- `src/app/academic-lead/page.tsx` và `src/app/api/practice/attempt/[attemptId]/submit/route.ts` -- mẫu protected page/API use-case.
- `src/app/globals.css` -- responsive, focus-visible và target controls tối thiểu 48 CSS px.
- `tests/unit/practice-application.test.ts`, `tests/integration/protected-routing.test.ts`, `tests/e2e/foundation.spec.ts` -- conventions unit, protected route và responsive/accessibility test.

## Tasks & Acceptance

**Execution:**
- `db/schema/evidence.ts`, `db/schema/index.ts`, `db/migrations/0021_teacher_evidence_projection.sql` -- thêm immutable submitted evidence facts/dimensions, audit outcome support và indexes cho latest-per-set/30-day read; preserve DB guards của attempt/review snapshots.
- `src/features/practice/application/evidence-contract.ts` and `src/features/practice/infrastructure/repositories.ts` -- xuất typed read/projection contract từ practice; populate snapshot-derived facts atomically khi submit, không để evidence truy cập practice tables trực tiếp.
- `src/features/evidence/domain/evidence-state.ts`, `src/features/evidence/application/get-centre-evidence.ts`, `src/features/evidence/infrastructure/repositories.ts` -- implement deterministic latest-submitted 30-day aggregate, actionable gap data, staff guard-before-read và safe audit write.
- `src/app/teacher/page.tsx`, `src/app/api/evidence/route.ts`, `src/features/evidence/ui/evidence-dashboard.tsx` -- thêm dashboard protected server-side và API/read flow; desktop summary/detail, narrow cards, semantic labels, empty state, keyboard/touch accessibility.
- `tests/unit/evidence-state.test.ts`, `tests/unit/evidence-application.test.ts`, `tests/integration/evidence-projection.test.ts`, `tests/integration/protected-routing.test.ts`, `tests/e2e/teacher-evidence.spec.ts` -- cover matrix, immutable/projection/audit safety, authorisation-before-read và responsive/focus interaction.

**Acceptance Criteria:**
- Given data-governance policy is enforceable and submitted attempts exist, when an active teacher opens `/teacher`, then they see centre-wide evidence and can open any learner's evidence detail entry; each read is audit logged with actor, opaque target ID, UTC time and outcome, while teacher receives no mutation control.
- Given submitted evidence for a paper/part and language target, when the dashboard aggregates it, then it uses only the latest submitted attempt for every practice set in the fixed 30-day window and displays exactly the specified four state thresholds, excluding unresolved outcomes.
- Given fewer than three assessable outcomes, no matching completed evidence, or only unresolved outcomes, when staff view the selection, then it presents `not assessed yet` or the specified neutral empty state without inferring weakness or showing result/pass-fail wording.
- Given a learner, inactive staff account or expired session requests evidence, when the protected route or API is invoked, then it returns a stable access failure before any data query/audit payload exposure.
- Given a submitted snapshot or its automatic outcome, when evidence facts and aggregates are generated, then later content edits and dashboard reads cannot change the attempt, automatic outcome, score, learner result, snapshot, or retained audit history.

## Design Notes

Evidence facts are written at submission because dimensions are needed for reliable, indexed aggregation and must remain tied to immutable versions. The evidence feature consumes a narrow practice-owned contract; this prevents cross-feature table coupling while allowing Story 4.3 to introduce effective outcomes later.

The default dashboard is intentionally a read-only summary plus a learner-detail entry, not Story 4.2's filter and item-level drill-down surface. Its evidence rule is an application/domain pure function so learner recommendations and future filters can reuse precisely the same semantics.

## Verification

**Commands:**
- `npm run lint` -- expected: lint completes with no errors.
- `npm run typecheck` -- expected: TypeScript completes with no errors.
- `npm test -- --run tests/unit/evidence-state.test.ts tests/unit/evidence-application.test.ts tests/integration/evidence-projection.test.ts tests/integration/protected-routing.test.ts` -- expected: all evidence and access/audit cases pass.
- `npm run test:e2e -- tests/e2e/teacher-evidence.spec.ts` -- expected: teacher dashboard works at desktop/narrow viewports with keyboard focus and no learner access.

## Repair Record

- Backfill chi doc `submitted_presentation` va `curriculum_tags.evidenceTargets` da nam trong immutable review snapshot. Snapshot cu thieu tuple target ID/label bi bo qua, khong join curriculum hien tai hay suy doan dimension.
- Submission moi snapshot hoa `evidenceTargets`; fact duoc rang buoc bang composite foreign key voi attempt/review item, va audit `EVIDENCE_READ` phan biet `CENTRE_WIDE` voi `LEARNER_DETAIL`.
- Latest attempt dung thu tu `(submittedAt, attemptId)`; UI co actionable text deterministic cho ca bon state. Learner query khong hop le tra ve failure on dinh, loi availability bat ngo tra `503`, va empty/detail view deu co navigation ve centre.
- Da verify: `npm run lint`, `npm run typecheck`, targeted Vitest evidence/access/route suite, va `npm run test:e2e -- tests/e2e/teacher-evidence.spec.ts`.

## Review Triage Log

### 2026-08-20 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 8 (high 4, medium 4, low 0)
- defer: 0
- reject: 0
- addressed_findings:
  - `[high] [patch]` Bound immutable evidence facts to submitted snapshot paper, part, outcome and target ID/label dimensions; enforce valid `EVIDENCE_READ` actor/scope/target audit shapes.
  - `[high] [patch]` Corrected published target extraction and added submitted fact creation regression coverage.
  - `[high] [patch]` Replaced placeholder browser checks with an authenticated, seeded teacher dashboard/detail E2E flow on a dedicated `_e2e` database.
  - `[high] [patch]` Stabilised E2E fixture setup and JSONB snapshot fixtures so production guards are exercised without shared-schema interference.
  - `[medium] [patch]` Applied deterministic `(submittedAt, attemptId)` latest-attempt ordering and snapshot-only historical backfill.
  - `[medium] [patch]` Added deterministic actionable text for each evidence state.
  - `[medium] [patch]` Returned stable invalid learner-detail input and availability failures without unsafe audit writes.
  - `[medium] [patch]` Added centre/detail audit scope and navigation for empty and learner-detail views.

## Auto Run Result

Status: done

Summary: Added centre-wide staff evidence dashboard and learner detail backed by immutable, snapshot-derived evidence facts, deterministic 30-day states, actionable guidance and auditable reads.

Files changed: Database migration/schema now create immutable submitted evidence facts, guarded historical backfill and constrained evidence-read audits. Practice finalisation writes target dimensions and facts atomically. The evidence feature, protected page/API and responsive UI expose read-only staff evidence. Unit, integration and authenticated E2E tests cover state rules, guards, routes and the dashboard/detail journey.

Review findings: 8 patches applied, 0 deferred, 0 rejected. Follow-up review recommendation: true; patched severity score is 16 (high 4, medium 4, low 0).

Verification: `npm run lint` passed; `npm run typecheck` passed; targeted Vitest suite passed (7 files, 34 tests); `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/cambridgeyle_e2e npm run test:e2e -- tests/e2e/teacher-evidence.spec.ts --reporter=list` passed (1 test); `git diff --check` passed.

Residual risks: The E2E fixture intentionally resets only a dedicated database whose name ends with `_e2e`; it must never be pointed at a shared database. Historical attempts without explicit immutable target ID/label tuples remain intentionally absent from evidence facts rather than being inferred.
