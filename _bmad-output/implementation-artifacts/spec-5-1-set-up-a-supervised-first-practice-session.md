---
title: 'Story 5.1: Thiết lập buổi thực hành đầu tiên có giám sát'
type: 'feature'
created: '2026-08-22'
status: 'done'
review_loop_iteration: 0
baseline_commit: '8939e7347a79dd89bc33b88b627337738583c411'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Admin đã có thể tạo learner và learner đã có luồng thực hành chuẩn, nhưng hồ sơ admin chưa hiển thị ngày tạo tài khoản như yêu cầu cho học viên thực hành đầu tiên. Cần chứng minh hành trình có giám sát dùng đúng các luồng có sẵn mà không mở rộng quyền bắt đầu bài cho admin.

**Approach:** Giữ prospective learner là một tài khoản `learner` thông thường do admin tạo. Hiển thị ngày tạo cùng trạng thái active/deactivated trong danh sách và chi tiết tài khoản; learner đăng nhập bằng thông tin tạm thời rồi tự chọn published practice set, chuẩn bị media và bắt đầu attempt theo luồng hiện hành với admin hỗ trợ trực tiếp.

## Boundaries & Constraints

**Always:** Tái sử dụng tạo tài khoản, role enforcement, learner home, published-set selection, preparation và server-authoritative attempt start hiện có. Chỉ admin được tạo tài khoản; chỉ learner đã xác thực mới được bắt đầu attempt. Hiển thị ngày theo British English, trạng thái active/deactivated rõ ràng, giữ touch target và accessibility hiện có. Dùng ngôn ngữ thực hành trung tính; giữ immutable set snapshot, media readiness và server-side authorisation. Bổ sung unit/integration coverage cho dữ liệu ngày tạo và hành trình role-protected.

**Ask First:** Dừng và hỏi nếu cần một nhãn/trạng thái bền vững riêng cho “prospective learner”, nếu cần admin khởi tạo attempt thay learner, hoặc nếu việc triển khai đòi hỏi thay đổi schema, quyền, phiên đăng nhập hay audit contract không được nêu trong đặc tả này.

**Never:** Không thêm public sign-up, parent/admissions/payment flow, diagnostic template, placement algorithm, điểm/nhận xét riêng, account type mới, cờ prospective mới, hoặc route/API cho admin bắt đầu attempt thay learner. Không đưa nội dung đáp án/correctness trước submit, không thay đổi published snapshots hay cơ chế score/evidence.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tạo learner có giám sát | Admin hợp lệ gửi form hiện có với role `learner` | Tạo learner active bằng flow identity hiện có; danh sách và detail hiển thị ngày tạo cùng trạng thái | Schema/action hiện có trả validation hoặc authorisation error; không tạo tài khoản không hợp lệ |
| Learner mới bắt đầu thực hành | Learner active đăng nhập và chọn published set có essential media sẵn sàng | Thấy learner home, đi qua preparation, rồi API tạo/resume immutable attempt như learner thông thường | Set không published, media không sẵn sàng, actor sai role hoặc account deactivated vẫn bị từ chối bởi guard hiện có; không tạo usable attempt |
| Admin truy cập learner flow | Admin đã xác thực mở learner route hoặc gọi start API | Chuyển về admin home/nhận 403; không thể bắt đầu attempt cho learner | Không có on-behalf-of fallback, session handoff hoặc attempt mới |
| Hồ sơ deactivated | Tài khoản learner đã deactivated | Detail hiển thị ngày tạo và trạng thái deactivated; luồng sign-in/start vẫn bị chặn | Không thay đổi retained records hoặc lifecycle hiện có |

</frozen-after-approval>

## Code Map

- `db/schema/identity.ts` -- `accounts.createdAt` đã tồn tại, non-null; không cần migration.
- `src/features/identity/infrastructure/repositories.ts` -- thêm `createdAt` vào projection của `listCentreAccounts` và `getCentreAccountDetail`; giữ shape/audit/lifecycle hiện có.
- `src/features/identity/application/auth.ts` -- `createCentreAccount`, account query contracts và `roleHome`; tái sử dụng, không mở rộng quyền.
- `src/app/admin/page.tsx` -- admin-only account list; render ngày tạo và trạng thái cho learner/prospective learner thông qua dữ liệu hiện có.
- `src/app/admin/accounts/[accountId]/page.tsx` -- admin-only account detail; render creation date cùng active/deactivated status.
- `src/features/identity/ui/format-account-created-at.ts` -- shared British-English account creation-date formatter with a fixed timezone.
- `src/features/identity/ui/create-account-form.tsx` và `src/app/admin/actions.ts` -- flow tạo learner hiện hành, chỉ đọc để bảo đảm không thêm loại account.
- `src/app/learner/page.tsx`, `src/features/practice/application/practice.ts` -- learner-only published-set selection; không sửa semantic lựa chọn/recommendation.
- `src/app/learner/practice/[setId]/page.tsx`, `src/app/api/practice/start/route.ts` -- preparation/start boundary; giữ learner-only server authorisation.
- `tests/unit/admin-account-role-action.test.ts`, `tests/unit/practice-application.test.ts`, `tests/integration/protected-routing.test.ts` -- conventions cho account UI/query data và role-protected learner journey.

## Tasks & Acceptance

**Execution:**
- [x] `src/features/identity/infrastructure/repositories.ts` -- expose stored account `createdAt` from centre list/detail projections and preserve account lifecycle fields -- enables required account-record display without data-model changes.
- [x] `src/app/admin/page.tsx` -- display a localised British-English creation date and existing lifecycle status for each centre account -- lets an admin identify when an active learner account was provisioned.
- [x] `src/app/admin/accounts/[accountId]/page.tsx` -- display the same creation date and active/deactivated status in account detail -- makes the account record complete for supervised setup.
- [x] `tests/unit/identity-repository-locking.test.ts` or focused identity repository test -- assert account list/detail projection includes persisted creation date and lifecycle values -- protects the new data contract.
- [x] `tests/integration/protected-routing.test.ts` and/or `tests/unit/practice-application.test.ts` -- cover admin provisioning compatibility with ordinary learner role and preserve learner-only access to selection/start -- proves no admin on-behalf-of path was introduced.
- [x] `tests/unit/format-account-created-at.test.ts` -- cover British-English display formatting at the shared list/detail rendering seam -- prevents host timezone drift.

**Acceptance Criteria:**
- Given an authenticated admin, when they create a learner using the existing centre-account form, then the account remains an ordinary active `learner` with the current identity validation and audit behaviour.
- Given an admin views centre accounts or a learner account detail, when the account was created, then the UI shows its creation date and active/deactivated status without exposing credentials or learner response content.
- Given a newly created active learner signs in, when they choose a published set with ready essential media, then they use the existing learner selection, preparation and server-authoritative attempt-start flow unchanged.
- Given an admin attempts learner-only selection or attempt-start access, when server authorisation is evaluated, then access is denied or redirected to the admin home and no attempt is created for another learner.
- Given a learner account is deactivated, when its record is viewed or it attempts to use practice, then status is visible and existing sign-in/authorisation blocking remains in effect while retained records stay untouched.

## Design Notes

“Prospective learner” is an operational use of an ordinary centre-created learner account, not a persisted identity category. The requirement only needs creation date plus active/deactivated lifecycle visibility; introducing a classification would create unrequested state and future retention/authorisation semantics. Supervision is performed in person while the learner owns their own authenticated practice session.

## Verification

**Commands:**
- `npx vitest run tests/unit/identity-repository-locking.test.ts tests/unit/practice-application.test.ts tests/integration/protected-routing.test.ts` -- expected: all targeted account projection and authorisation tests pass.
- `npm run typecheck` -- expected: TypeScript completes without errors.
- `npm run lint` -- expected: lint completes without errors.
- `npm test` -- expected: complete unit/integration suite passes.

## Suggested Review Order

**Account Record Data**

- Exposes the stored creation timestamp without a schema migration.
  [`repositories.ts:45`](../../src/features/identity/infrastructure/repositories.ts#L45)

- Uses one stable British-English formatter across both account surfaces.
  [`format-account-created-at.ts:1`](../../src/features/identity/ui/format-account-created-at.ts#L1)

**Admin Surfaces**

- Displays creation date alongside the existing account lifecycle summary.
  [`page.tsx:8`](../../src/app/admin/page.tsx#L8)

- Keeps detail lifecycle controls intact while showing the same creation date.
  [`page.tsx:19`](../../src/app/admin/accounts/[accountId]/page.tsx#L19)

**Regression Coverage**

- Verifies repository projections preserve creation and lifecycle values.
  [`identity-repository-locking.test.ts:15`](../../tests/unit/identity-repository-locking.test.ts#L15)

- Prevents host-timezone drift in the shared date presentation.
  [`format-account-created-at.test.ts:4`](../../tests/unit/format-account-created-at.test.ts#L4)

- Preserves learner-only practice preparation and authoritative attempt start.
  [`practice-application.test.ts:63`](../../tests/unit/practice-application.test.ts#L63)

- Preserves server-side redirection from learner-only pages for admins.
  [`protected-routing.test.ts:33`](../../tests/integration/protected-routing.test.ts#L33)
