---
title: 'Story 4.3 Remediation: Preserve Immutable Evidence During Resolution'
type: 'bugfix'
created: '2026-08-22'
status: 'done'
baseline_commit: 'a6b9a5ac87c6c24d273f7121532091ba00d380a6'
review_loop_iteration: 0
context:
  - '_bmad-output/implementation-artifacts/epic-4-context.md'
  - '_bmad-output/implementation-artifacts/epic-4-retro-08-21-2026.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `appendTeacherEvidenceResolution` append resolution rồi ghi đè `practice_attempt_evidence`. Trigger PostgreSQL cấm mọi `UPDATE` bảng snapshot này, làm transaction rollback cả resolution và audit, trả lỗi không mong đợi thay vì lưu quyết định. Browser hiện cũng chỉ refresh conflict mà không cho người dùng correction bằng revision mới.

**Approach:** Giữ submitted evidence, learner review và automatic outcome bất biến; append resolution cùng audit trong transaction và tính evidence/recommendation hiện hành từ resolution history khi đọc. Hoàn thiện UI correction conflict-safe và chứng minh hành vi qua repository transaction PostgreSQL thật và E2E cho academic lead/admin.

## Boundaries & Constraints

**Always:** Resolution chỉ dành cho active `academic_lead`/`admin`, chỉ trên submitted item có automatic `needs_teacher_review`, và dùng optimistic resolution revision. Một thành công phải append immutable version, ghi `EVIDENCE_RESOLUTION` audit an toàn trong cùng transaction, không được sửa attempt, `practice_attempt_evidence`, review snapshot, response, score, automatic outcome hay audit cũ. Current evidence state và learner recommendation-derived read model phải phản ánh effective outcome/revision mới nhất; unresolved tiếp tục bị loại khỏi assessable correctness. Stale phải trả `TEACHER_RESOLUTION_CONFLICT`, refresh dữ liệu hiện hành và cho phép correction retry với revision hiện hành.

**Ask First:** Dừng và hỏi nếu repository read model không thể tạo recommendation hiệu lực mà không thay đổi immutable submission, hoặc nếu migration/schema thay đổi là cần thiết.

**Never:** Không nới, xoá hoặc vô hiệu hoá immutable database trigger; không rewrite historical evidence/recommendation audit; không thêm quyền mutation cho teacher/learner, scope cohort, AI guidance, official-result wording hay thay đổi semantics latest-attempt/30-day của Epic 4.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Append resolution | Academic lead/admin gửi revision hiện hành cho uncertain submitted item | Một resolution version và success audit commit; read models phản ánh effective outcome/revision | Không mutate submitted evidence/review |
| Stale correction | Resolution khác đã commit sau khi form được tải | History hiện có giữ nguyên; trang refresh revision/effective outcome hiện hành và form correction dùng revision mới | `TEACHER_RESOLUTION_CONFLICT`, người dùng retry được |
| Learner review | Learner mở attempt sau staff resolution | Response, score, automatic outcome, answer và feedback đúng snapshot submitted | Không lộ resolution thành learner result |
| Invalid/forbidden | Teacher, learner, inactive actor, malformed input hoặc non-review item | Không append resolution/audit thành công và không đổi projections | Stable authorisation/input error trước repository write |

</frozen-after-approval>

## Code Map

- `src/features/practice/infrastructure/repositories.ts:51-58` -- `listRecentSubmittedEvidence` hiện đọc immutable label; thay bằng read-time effective evidence label để learner recommendation phản ánh resolution mà không ghi snapshot.
- `src/features/practice/infrastructure/repositories.ts:278-308` -- submitted evidence facts đã left join latest resolution; `appendTeacherEvidenceResolution` khoá item, kiểm revision, append resolution/audit nhưng hiện cập nhật sai `practiceAttemptEvidence`.
- `src/features/practice/application/practice.ts:34-47` -- consumer của recent submitted evidence cho learner recommendation; giữ interface và để repository cung cấp derived label.
- `src/features/evidence/domain/evidence-state.ts` -- shared effective-outcome state derivation phải tiếp tục là nguồn truth cho staff evidence.
- `src/features/evidence/ui/evidence-dashboard.tsx:21` -- form hiện chỉ render unresolved; render correction form cho academic lead/admin sau refresh, với resolution revision hiện tại.
- `src/features/evidence/ui/evidence-resolution-form.tsx:6-35` -- POST no-store và refresh conflict/success; giữ message an toàn, dùng revision props mới sau server refresh.
- `tests/integration/evidence-projection.test.ts:59-90` -- PostgreSQL fixture/rollback pattern; bổ sung test gọi repository thật thay vì direct insert.
- `tests/e2e/teacher-evidence.spec.ts:10-78` -- disposable migrated PostgreSQL fixture và cookie sessions; mở rộng actors/items để browser thực thi success và stale retry.
- `db/migrations/0017_learner_practice_selection.sql:47-53`, `db/migrations/0024_teacher_evidence_resolution.sql:12-27` -- read-only guards cần giữ nguyên; chỉ đọc làm contract, không sửa.

## Tasks & Acceptance

**Execution:**
- [x] `src/features/practice/infrastructure/repositories.ts` -- bỏ mọi update/rebuild `practice_attempt_evidence` khỏi resolution transaction; derive recommendation evidence label lúc đọc từ latest effective outcomes scoped to immutable submitted facts, rồi append success audit cùng resolution -- bảo toàn snapshot trong khi cập nhật derived current state.
- [x] `src/features/evidence/ui/evidence-dashboard.tsx`, `src/features/evidence/ui/evidence-resolution-form.tsx` -- cho academic lead/admin correction form khi item đã resolved, truyền current resolution revision và giữ accessible success/conflict refresh/retry flow -- biến stale conflict thành retry thực hiện được.
- [x] `tests/integration/evidence-projection.test.ts` -- seed PostgreSQL fixture và gọi `appendTeacherEvidenceResolution`; assert append/result/audit, unchanged submitted review and attempt-evidence label, effective staff state và recommendation-derived label; assert stale transaction không append thêm -- chứng minh real trigger không rollback mutation.
- [x] `tests/e2e/teacher-evidence.spec.ts` -- seed active academic lead/admin, separate uncertain submitted items và sessions; cover mỗi role resolve success, và two-session stale conflict followed by refreshed correction retry -- xác minh role-gated browser/API/PostgreSQL journey.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- mark hai Epic 4 retrospective action items done chỉ sau verification pass -- lưu trạng thái follow-through chính xác.

**Acceptance Criteria:**
- Given PostgreSQL immutability guards are installed, when a valid academic lead/admin resolution is submitted, then its resolution and safe success audit commit in one transaction while all submitted attempt evidence and review fields remain byte-for-byte unchanged.
- Given a resolution changes automatic `needs_teacher_review` to an effective assessable outcome, when staff evidence and learner recommendation-derived data are read, then both use the latest effective version without rewriting immutable snapshots.
- Given an academic lead or admin completes a browser resolution, when the page refreshes, then the rendered effective outcome and revision are authoritative and the action is no longer unresolved.
- Given another resolver wins a concurrent update, when the stale resolver submits then refreshes and retries, then the conflict preserves history and the retry appends the next resolution version using the refreshed revision.

## Design Notes

The immutable tables are historical evidence, not a cache to rebuild. Resolution history is the mutable-in-time, append-only source for current staff interpretation. Both staff aggregation and learner recommendation must therefore resolve the latest effective outcomes at read time; append transactions only write the resolution and its audit record.

## Verification

**Commands:**
- `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/cambridgeyle_test npm run db:migrate` -- expected: migration succeeds against dedicated test database.
- `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/cambridgeyle_test npm test -- --run tests/integration/evidence-projection.test.ts tests/unit/practice-application.test.ts tests/unit/evidence-application.test.ts tests/integration/evidence-route.test.ts` -- expected: repository transaction, derived read models and route rules pass.
- `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/cambridgeyle_e2e npm run test:e2e -- tests/e2e/teacher-evidence.spec.ts --reporter=list` -- expected: academic lead/admin success and stale refresh/retry journeys pass.
- `npm run lint && npm run typecheck && git diff --check` -- expected: static checks and whitespace check pass.

## Suggested Review Order

**Immutable Resolution Boundary**

- Resolution transaction appends only resolution history and safe audit data.
  [`repositories.ts:301`](../../src/features/practice/infrastructure/repositories.ts#L301)

- Recommendation evidence derives the latest effective outcome without rewriting submitted snapshots.
  [`repositories.ts:51`](../../src/features/practice/infrastructure/repositories.ts#L51)

**Conflict-Safe Correction UI**

- Eligible staff retain a correction path using the current server-rendered revision.
  [`evidence-dashboard.tsx:21`](../../src/features/evidence/ui/evidence-dashboard.tsx#L21)

- Corrections retain their existing effective outcome unless staff deliberately select another.
  [`evidence-resolution-form.tsx:6`](../../src/features/evidence/ui/evidence-resolution-form.tsx#L6)

**Database And Browser Proof**

- PostgreSQL transaction proves append, audit, immutable snapshots, stale rejection and latest recommendation label.
  [`evidence-projection.test.ts:91`](../../tests/integration/evidence-projection.test.ts#L91)

- Two authenticated staff sessions prove success, stale refresh and revision-aware retry in the browser.
  [`teacher-evidence.spec.ts:85`](../../tests/e2e/teacher-evidence.spec.ts#L85)

- Retrospective action items close only after remediation verification passes.
  [`sprint-status.yaml:73`](sprint-status.yaml#L73)
