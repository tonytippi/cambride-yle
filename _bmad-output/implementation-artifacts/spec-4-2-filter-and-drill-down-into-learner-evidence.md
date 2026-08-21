---
title: 'Story 4.2: Filter And Drill Down Into Learner Evidence'
type: 'feature'
created: '2026-08-21'
status: 'done'
baseline_revision: '597338d6731c4d0ee9b30f4b13825540e1f17c4e'
baseline_commit: '597338d6731c4d0ee9b30f4b13825540e1f17c4e'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-4-context.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 4.1 chỉ hiển thị tổng hợp centre hoặc learner theo một learner ID. Teacher chưa thể áp dụng các dimension evidence cần thiết hoặc đọc snapshot item-level để hiểu response, outcome, thời gian và playback trước khi hướng dẫn learner.

**Approach:** Mở rộng feature `evidence` bằng một filter contract chung và một practice-owned read contract cho submitted snapshots. Tính summary theo đúng cửa sổ 30 ngày cố định, nhưng lấy drill-down retained matching độc lập để lịch sử cũ không thay đổi evidence state.

## Boundaries & Constraints

**Always:** Chỉ active `teacher`, `academic_lead`, `admin` được đọc evidence toàn centre; authorise trước mọi read. Summary và detail dùng cùng semantics filter cho learner, paper, part, vocabulary, grammar, spelling, names, numbers, colours, positions, topic và practice set; không có time-range filter. Aggregate chỉ dùng latest submitted attempt của mỗi learner/practice set trong 30 ngày UTC và các threshold hiện có; unresolved `needs_teacher_review` không vào automatic rate. Drill-down chỉ dùng immutable submitted attempt/review snapshots, có thể gồm retained submissions ngoài cửa sổ và luôn hiển thị automatic/effective outcome, timing và playback. Audit mỗi evidence read chỉ chứa actor, opaque target ID khi có, UTC time và outcome; không ghi response, answer/media, URL ký, password hoặc session. UI keyboard/touch operable, focus-visible, control tối thiểu 48 CSS px và dùng wording trung tính/British English.

**Block If:** Snapshot submitted không có immutable dimension cần để thực hiện bất kỳ filter bắt buộc nào mà không join hoặc suy đoán từ content/curriculum hiện có.

**Never:** Không thêm cohort/class scope, teacher mutation, time-range picker, ranking, AI recommendation, public curriculum claim, official-result/pass-fail language; không sửa automatic outcome, attempt, submitted snapshot, learner-visible result hoặc audit history. Không triển khai teacher resolution mutation của Story 4.3.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Combined filters | Staff chọn các dimension hợp lệ | Summary và retained item detail cùng áp dụng giao intersection; summary dùng cửa sổ/latest rule | Không có lỗi |
| Retained history | Submission khớp filter ngoài 30 ngày | Item drill-down hiển thị snapshot; state không tính lại từ item đó | Không có lỗi |
| No matching evidence | Không có submitted item khớp | Hiện `not assessed yet`, empty text `No completed practice yet for this selection.` và reset filters; không suy luận weakness | Audit `NO_DATA` an toàn |
| Unresolved item | Snapshot outcome `needs_teacher_review` | Detail đánh dấu `Needs teacher review`; aggregate loại khỏi assessable rate | Không chia cho 0 |
| Invalid or unauthorised read | Filter/opaque detail ID sai, learner/inactive staff | Không truy vấn/không lộ data trước authorisation; trả stable input/access failure | Không audit payload nhạy cảm |

</intent-contract>

## Code Map

- `src/features/evidence/application/get-centre-evidence.ts:8-27` -- input Zod, 30-day aggregate, staff guard và audit hiện hữu; mở rộng thành filter semantics chung và truy vấn detail.
- `src/features/evidence/domain/evidence-state.ts:3-30` -- giữ nguyên deterministic outcomes/latest `(submittedAt, attemptId)` và thresholds cho summary.
- `src/features/evidence/infrastructure/repositories.ts:6-11` -- current fact reader; thay bằng implementation cho narrow practice-owned snapshot reader, không để application query content mutable.
- `src/features/practice/application/evidence-contract.ts:1-17` -- boundary typed giữa evidence và practice; thêm submitted filter/detail types và read operations.
- `src/features/practice/infrastructure/repositories.ts:199-268` -- submission transaction snapshot-hoá final timing, playback, review items/curriculum tags; mở rộng practice-owned repository contract để phục vụ staff snapshot reads.
- `db/schema/practice.ts:22-100` và `db/schema/evidence.ts:7-32` -- nguồn schema submitted attempts/review items/facts; migration chỉ được thêm khi immutable snapshot dimension/index còn thiếu.
- `db/migrations/0020_practice_attempt_submission_review.sql` và `db/migrations/0021_teacher_evidence_projection.sql` -- guards snapshot/fact/audit immutable cần giữ và mở rộng có kiểm soát cho audit drill target nếu cần.
- `src/app/api/evidence/route.ts:7-23`, `src/app/teacher/page.tsx:5-11` -- parse/preserve các filter hợp lệ, response no-store và server-side protected page.
- `src/features/evidence/ui/evidence-dashboard.tsx:5-10`, `src/app/globals.css` -- dashboard summary/detail hiện có; thêm labelled filters, reset, retained item drill-down responsive.
- `tests/unit/evidence-state.test.ts`, `tests/unit/evidence-application.test.ts`, `tests/integration/evidence-route.test.ts`, `tests/integration/evidence-projection.test.ts`, `tests/unit/teacher-evidence-page.test.ts`, `tests/e2e/teacher-evidence.spec.ts` -- mở rộng các convention evidence hiện hữu.

## Tasks & Acceptance

**Execution:**
- `src/features/practice/application/evidence-contract.ts`, `src/features/practice/infrastructure/repositories.ts` -- định nghĩa và triển khai typed submitted-evidence filter/detail reader trả duy nhất dimensions và review/timing/playback đã snapshot; effective outcome hiện bằng automatic outcome cho đến Story 4.3.
- `db/schema/evidence.ts`, `db/migrations/0022_teacher_evidence_filter_drilldown.sql` -- snapshot-hoá/index các dimension filter còn thiếu và mở rộng audit constraints an toàn cho target drill-down, chỉ khi contract không thể query immutable source hiệu quả mà không suy đoán.
- `src/features/evidence/application/get-centre-evidence.ts`, `src/features/evidence/infrastructure/repositories.ts` -- validate filter schema, authorise-before-read, áp dụng một predicate cho 30-day/latest summary và retained detail, audit success/no-data theo target opaque; dùng existing state domain không thay đổi semantics.
- `src/app/api/evidence/route.ts`, `src/app/teacher/page.tsx` -- chuyển query parameters qua contract chuẩn, giữ stable `{ data }` / `{ error }`, `no-store`, 400/403/503 an toàn và navigation drill-down.
- `src/features/evidence/ui/evidence-dashboard.tsx`, `src/app/globals.css` -- render accessible filter form, summary/update đồng bộ, item cards/rows cho response/outcome/timing/playback, marker unresolved, neutral no-data/not-assessed text và reset/filter links responsive.
- `tests/unit/evidence-application.test.ts`, `tests/unit/evidence-state.test.ts`, `tests/unit/teacher-evidence-page.test.ts`, `tests/integration/evidence-route.test.ts`, `tests/integration/evidence-projection.test.ts`, `tests/e2e/teacher-evidence.spec.ts` -- cover matrix, auth-before-read, immutable-only dimensions, audit safety, no-store/stable errors, retained detail outside window, keyboard/narrow screen flow.

**Acceptance Criteria:**
- Given authorised submitted evidence, when staff filter by any supported dimension or their combination, then centre summary, learner summary and direct item drill-down use the same intersection semantics and expose only matching submitted snapshots.
- Given matching summary data, when state is calculated, then it uses only latest submitted attempts per learner/practice set inside the fixed versioned 30-day UTC window and preserves `not assessed yet`, `needs practice`, `building` and `secure` thresholds while excluding unresolved outcomes.
- Given a matching submission retained outside the 30-day window, when staff open item drill-down, then its snapshot response, automatic/effective outcome, attempt timing and playback events are visible without altering the 30-day aggregate state.
- Given no matching assessable/completed data or only unresolved outcomes, when staff view the selection, then they see `not assessed yet` and neutral empty guidance without an inferred weakness or result/pass-fail language.
- Given a learner, invalid detail reference, expired session or inactive staff account, when page/API evidence is requested, then it returns stable failure before any evidence read/data exposure; every permitted centre, learner or drill-down read records only safe audit metadata.

## Design Notes

Filter values must describe submitted snapshot dimensions, not current editable curriculum/content. One normalised filter object drives both summary and retained detail; query execution may differ only at the fixed 30-day/latest boundary. This prevents a historical detail read from changing a current evidence state.

## Verification

**Commands:**
- `npm run lint` -- expected: no lint errors.
- `npm run typecheck` -- expected: no TypeScript errors.
- `npm test -- --run tests/unit/evidence-state.test.ts tests/unit/evidence-application.test.ts tests/unit/teacher-evidence-page.test.ts tests/integration/evidence-route.test.ts tests/integration/evidence-projection.test.ts` -- expected: filter, audit, snapshot and access suite passes.
- `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/cambridgeyle_e2e npm run test:e2e -- tests/e2e/teacher-evidence.spec.ts --reporter=list` -- expected: authenticated filtering/drill-down desktop and narrow viewport flow passes.
- `git diff --check` -- expected: no whitespace errors.
