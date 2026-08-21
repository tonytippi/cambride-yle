---
title: 'Story 1.2: Manage Centre Accounts And Roles'
type: 'feature'
created: '2026-08-21'
status: 'done'
baseline_commit: 'ea7a0f0906c4bd2dda818711477c39eee6182948'
review_loop_iteration: 0
context:
  - '_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Vấn đề:** Admin đã có thể tạo, xem và deactivate account, nhưng không thể thay đổi role đã gán. Điều này không đáp ứng Story 1.2 và ngăn centre điều chỉnh quyền khi trách nhiệm của một người thay đổi.

**Cách tiếp cận:** Bổ sung một mutation server-authoritative để admin đổi role của account từ account detail, ghi audit, và bảo vệ giao dịch để không thao tác nào có thể hạ cấp active admin cuối cùng.

## Ranh giới & Ràng buộc

**Luôn:** Chỉ actor `admin` đã xác thực mới được gọi use case đổi role; validate `accountId` UUID và một trong bốn role hiện có tại server boundary. Use case sở hữu transaction và repository khoá toàn bộ active admin theo thứ tự xác định, sau đó khoá target, trước khi quyết định. Hạ cấp active admin cuối cùng sang role khác phải trả `LAST_ACTIVE_ADMIN` mà không cập nhật account, ghi audit, revoke hay thay đổi session. Đổi role hợp lệ của account active cập nhật role, ghi audit event chỉ với actor/target opaque IDs và để các session hiện có nguyên vẹn; quyền mới phải được đọc từ account ở request kế tiếp. `ADMIN_EMAILS` chỉ chọn role `admin` khi Google provisions account chưa tồn tại; Google sign-in của account đã tồn tại luôn giữ stored role, và chỉ một admin khác mới được nâng role account đó. UI account detail phải có label rõ, keyboard-operable, pending state, text error/success accessible và British English.

**Hỏi trước:** Thay đổi semantics `ADMIN_EMAILS` hoặc Google promotion, cho phép/reactivate account deactivated, thêm profile fields, reset password, thay đổi schema audit để lưu old/new role, hay đổi role theo bulk operation.

**Không bao giờ:** Không tin role hay actor từ browser; không đổi role account deactivated hoặc tạo public account-management route; không revoke session khi chỉ đổi role; không để `ADMIN_EMAILS` nâng role của account đã tồn tại; không sửa historic audit event, account records, attempt evidence hoặc dữ liệu imported curriculum; không thêm migration khi enum role, `accounts.role` và audit schema hiện hữu đã đủ.

## Ma trận I/O & Edge Case

| Tình huống | Input / State | Output / Behaviour | Xử lý lỗi |
|----------|---------------|--------------------|-----------|
| Đổi role hợp lệ | Admin xác thực, target account tồn tại, role mới hợp lệ | Role target được cập nhật, audit `ACCOUNT_ROLE_CHANGED` được thêm, list/detail phản ánh role mới | Session target không bị revoke |
| Hạ cấp admin cuối cùng | Target là active admin duy nhất, role mới không phải `admin` | Không thay đổi role, audit hoặc session | Trả stable `LAST_ACTIVE_ADMIN` với thông báo nêu cần có active admin khác |
| Account deactivated hoặc role không đổi | Target deactivated, hoặc role đã là role yêu cầu | Không cập nhật role/audit/session | Target deactivated trả lifecycle error; no-op thành công im lặng |
| Actor hoặc input không hợp lệ | Actor không phải admin, account ID sai, hoặc role ngoài enum | Không có read/mutation trái quyền hoặc write | Server action trả denial/validation; use case trả `FORBIDDEN` trước transaction |
| Concurrent admin mutation | Hai request cố hạ cấp/deactivate active admins | Chỉ các transition duy trì ít nhất một active admin được commit | Lock set cùng thứ tự; request vi phạm fail trước write |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/epics.md:53-65` -- intent và acceptance criteria chuẩn cho Story 1.2, bao gồm `LAST_ACTIVE_ADMIN` không đổi state/session.
- `_bmad-output/implementation-artifacts/epic-1-context.md:18-24,30-35,42-44` -- domain constraints: mutation admin-only, transaction lock active-admin set, audit, WCAG và copy.
- `src/features/identity/domain/contracts.ts:3-19` -- tái sử dụng `roles`/`Role`; thêm Zod input schema cho role mutation.
- `src/features/identity/application/auth.ts:9-37` -- tái sử dụng `authorise`, `IdentityError` và transaction/mapping-error của `deactivateCentreAccount`; thêm use case role change.
- `src/features/identity/infrastructure/repositories.ts:15-18,56-68` -- `getActorBySessionToken` đọc role hiện thời từng request; dùng cùng lock ordering và guard-before-write của `deactivateAccount` cho role mutation, không đụng `sessions`.
- `db/schema/identity.ts:4-45`, `db/migrations/0001_identity.sql:1-52` -- enum, account role, audit event và updated timestamp đã đủ; không migration.
- `src/app/admin/actions.ts:1-16` -- server action pattern: actor từ server, Zod parse, use case, rồi revalidate list/detail.
- `src/app/admin/accounts/[accountId]/page.tsx:10-17` -- admin-protected account detail là surface tối thiểu để render form đổi role và audit history.
- `src/features/identity/ui/deactivate-account-form.tsx:8-18` -- ví dụ `useActionState`, feedback accessible và pending UX; role form không cần confirmation dialog.
- `tests/unit/deactivate-centre-account.test.ts`, `tests/unit/identity-repository-locking.test.ts`, `tests/unit/admin-deactivation-action.test.ts` -- patterns mock transaction, lock ordering, expected error mapping và server action để mở rộng/tách test role management.
- `tests/integration/protected-routing.test.ts:1-26` -- bổ sung chứng minh role-management surface vẫn server-protected cho admin.

## Tasks & Acceptance

**Thực thi:**
- [x] `src/features/identity/domain/contracts.ts` -- thêm schema input `accountId`/`role` cho role change, tái dùng canonical role enum để action không nhận giá trị tuỳ ý.
- [x] `src/features/identity/infrastructure/repositories.ts` -- thêm repository mutation nhận transaction: lock active admins rồi target, chặn account deactivated và chỉ active admin cuối cùng bị downgrade, bỏ qua no-op, cập nhật role và append `ACCOUNT_ROLE_CHANGED` sau guard, không thay session.
- [x] `src/features/identity/application/auth.ts` -- thêm admin-authorised `changeCentreAccountRole` với một transaction và mapping stable `LAST_ACTIVE_ADMIN`/lifecycle errors sang `IdentityError`; Google sign-in chỉ dùng `ADMIN_EMAILS` khi provision account mới.
- [x] `src/app/admin/actions.ts` -- thêm server action lấy actor server-side, validate form input, gọi use case và revalidate `/admin` cùng account detail sau thành công.
- [x] `src/features/identity/ui/change-account-role-form.tsx` và `src/app/admin/accounts/[accountId]/page.tsx` -- thêm form role labelled, default role hiện tại, pending state, `role="alert"`/`role="status"`, và ghép vào protected detail view.
- [x] `tests/unit/*identity*role*.test.ts` hoặc test identity hiện hữu -- kiểm thử authorisation, validation, successful update/audit, no-op semantics, final-admin/lifecycle guard, không session operation khi fail và Google sign-in không đổi stored role account hiện hữu.
- [x] `tests/unit/*admin*role*.test.ts` và `tests/integration/protected-routing.test.ts` -- kiểm thử server action revalidation/error và routing không cấp surface cho role khác.

**Acceptance Criteria:**
- Given an authenticated admin views a centre account, when they choose any permitted role and submit, then the server stores that role, records an account-role audit event, and the account list/detail display the current role and status.
- Given an active admin account has a valid existing session, when its role changes successfully, then its next protected request uses the stored new role without a role-change session revocation.
- Given a request would change the only active admin to a non-admin role, when it is processed concurrently or alone, then it returns `LAST_ACTIVE_ADMIN` and leaves role, audit records and sessions unchanged.
- Given a learner, teacher, academic lead, anonymous requester, or malformed browser payload attempts role management, when the request is handled, then server-side authorisation/validation prevents the mutation and exposes no unauthorised account data.

## Design Notes

Use an inline form on the existing detail page, rather than a second admin route or a destructive confirmation dialog. Deactivation uniquely requires named confirmation; the Story 1.2 contract does not require it for role change. The existing per-request session lookup means an account's permissions naturally track its stored role without session rotation or revocation.

## Verification

**Commands:**
- `npm run lint` -- expected: lint passes for application and test files.
- `npm run typecheck` -- expected: role contracts, Server Action state and UI props typecheck.
- `npm test` -- expected: identity unit/integration tests prove authorisation, atomic final-admin protection, audit, action feedback and protected routing.
- `npm run build` -- expected: production build completes with the account detail role form.

## Suggested Review Order

**Role Authority**

- Preserve admin-managed stored roles across all existing Google identities.
  [`auth.ts:49`](../../src/features/identity/application/auth.ts#L49)

- Atomically protect active-admin continuity before any role write.
  [`repositories.ts:69`](../../src/features/identity/infrastructure/repositories.ts#L69)

**Server Boundary**

- Validate browser input and return stable expected failure codes.
  [`actions.ts:17`](../../src/app/admin/actions.ts#L17)

- Keep the role selector available only on active account details.
  [`page.tsx:18`](../../src/app/admin/accounts/[accountId]/page.tsx#L18)

**Verification**

- Cover Google provision semantics, role guards and routing boundaries.
  [`identity-behaviour.test.ts:93`](../../tests/integration/identity-behaviour.test.ts#L93)

- Verify lock ordering, no-op safety and unchanged-session behaviour.
  [`identity-repository-locking.test.ts:32`](../../tests/unit/identity-repository-locking.test.ts#L32)
