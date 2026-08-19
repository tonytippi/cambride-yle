---
title: 'Story 1.3: Deactivate A Centre Account'
type: 'feature'
created: '2026-08-19'
status: 'done'
baseline_commit: '2ec742e612b7455f08860af66b5e9e0d79e97110'
review_loop_iteration: 0
context:
  - '_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Vấn đề:** Admin chưa thể thu hồi rõ ràng quyền truy cập của một tài khoản đã rời hoặc không còn cần thiết. Việc này phải chặn toàn bộ phiên và lần đăng nhập sau mà không xoá hồ sơ hay evidence của pilot.

**Cách tiếp cận:** Bổ sung account detail quản trị với xác nhận mang tính danh định và một use-case server-authoritative thực hiện deactivation, thu hồi toàn bộ session cùng audit event trong một transaction. Giao diện phải cho thấy trạng thái và lịch sử sau khi xử lý.

## Ranh giới & Ràng buộc

**Luôn:** Chỉ admin đã xác thực mới được yêu cầu deactivation; xác nhận phải khớp account identifier hiển thị. Transaction phải đặt `status=deactivated`, `deactivated_at` UTC và `deactivated_by`, revoke mọi session chưa revoke của target, rồi ghi audit với opaque actor/target IDs và không có learner response, credentials hay session identifier. Nếu deactivation hoặc role mutation sẽ xoá admin active cuối cùng, trả stable code `LAST_ACTIVE_ADMIN` mà không thay đổi state, revoke session hoặc ghi audit deactivation. Giữ mọi account, OIDC identity, practice/first-practice record, snapshot, score và audit record; bảo đảm keyboard access, focus rõ, target 48px, responsive layout và British English copy.

**Hỏi trước:** Thay đổi semantics role mutation ngoài guard dùng chung, reactivation, retention/purge policy, additional account profile fields, hoặc một account-management surface rộng hơn deactivation/detail tối thiểu.

**Không bao giờ:** Không thêm account deletion, irreversible purge, automatic expiry, self-service deactivation, public registration, hay client-side-only authorisation. Không tiết lộ deactivated status cho sign-in; local và Google sign-in phải giữ generic failure hiện có. Không revoke bất cứ session nào khi `LAST_ACTIVE_ADMIN` xảy ra.

## Ma trận I/O & Edge Case

| Tình huống | Input / State | Output / Behaviour | Xử lý lỗi |
| --- | --- | --- | --- |
| Deactivate hợp lệ | Admin xác thực, target active, confirmation khớp identifier | Target deactivated, toàn bộ active sessions revoked, một audit event được ghi | Refresh account detail với status và history |
| Admin active cuối | Target là admin active duy nhất | Không mutation, revoke hay audit deactivation | Trả `LAST_ACTIVE_ADMIN`; UI giải thích cần một admin active khác |
| Xác nhận sai hoặc target stale | Identifier thiếu/sai, target không active hoặc không tồn tại | Không mutation | Boundary validation hoặc stable expected error, không leak qua sign-in |
| Concurrent admin changes | Deactivation/role mutation đồng thời trên active admins | Transaction bảo toàn ít nhất một active admin | Một request thất bại ổn định, không partial update |
| Session cũ | Target đã deactivated có cookie/session trước đó | Session không còn authorise và được cleanup theo flow hiện có | Redirect sign-in, no-store cookie cleanup |

</frozen-after-approval>

## Code Map

- `db/schema/identity.ts:4-43` -- tái dùng `accountStatus`, lifecycle fields, `sessions.revokedAt` và minimal audit event shape; chỉ thêm migration nếu locking/constraint cần được schema hoá, không sửa migration đã áp dụng.
- `src/features/identity/application/auth.ts:9-35` -- mẫu `IdentityError`, `authorise()` và transaction-owned `createCentreAccount()`; đặt use-case deactivation/last-admin guard tại đây hoặc module application kề cận.
- `src/features/identity/infrastructure/repositories.ts:13-41` -- mở rộng port/repository để load account detail/history, lock active-admin set, update lifecycle và revoke-all active sessions trong transaction; giữ `getActorBySessionToken()` filter active như defence in depth.
- `src/app/admin/page.tsx:1-5`, `src/app/admin/actions.ts:1-11` -- protected admin route và server-action/Zod/revalidation pattern cho list/detail/deactivation action.
- `src/features/identity/ui/create-account-form.tsx:1-6`, `src/features/identity/ui/session.ts:8-11` -- pattern client form `useActionState`, session cleanup và accessible controls để tái dùng cho named danger confirmation.
- `src/app/api/auth/session-expired/route.ts:5-12`, `src/features/identity/application/auth.ts:13-19,23-35` -- hành vi có sẵn phải vẫn từ chối session, local sign-in và Google sign-in của account deactivated.
- `tests/integration/identity-behaviour.test.ts:1-139`, `tests/integration/protected-routing.test.ts:1-26`, `tests/e2e/foundation.spec.ts:1-29` -- conventions Vitest mocks/direct route và Playwright accessible responsive flows cần mở rộng.

## Tasks & Acceptance

**Thực thi:**
- [x] `src/features/identity/{domain,application,infrastructure}/**` -- thêm contracts, repository operations và transaction `deactivateCentreAccount`; lock/guard active admin, update lifecycle, revoke mọi session chưa revoked và audit atomically.
- [x] `src/app/admin/**`, `src/features/identity/ui/**` -- thêm account list/detail tối thiểu, status/audit history và danger confirmation cần identifier trước server action; hiển thị `LAST_ACTIVE_ADMIN` rõ ràng.
- [x] `db/schema/identity.ts`, `db/migrations/0003_*`, `db/migrations/meta/_journal.json` -- chỉ khi implementation cần database primitive để thực thi locking/concurrency invariant; bổ sung migration ordered, không sửa baseline/migration cũ.
- [x] `tests/integration/**`, `tests/unit/**` -- chứng minh happy path tại use-case transaction boundary, non-admin denial, named confirmation (kể cả whitespace), final-admin guard, server-action revalidation và local sign-in race denial. Chưa có database integration fixture hoặc E2E deactivation/detail-dialog chuyên biệt.

**Acceptance Criteria:**
- Given active account detail, when admin confirms đúng named deactivation, then server atomically sets deactivation metadata, revokes all active sessions, blocks authentication/authorisation, and records a response-safe audit event.
- Given deactivated target, when admin reopens its detail, then UI shows deactivated status and audit history while retained practice/first-practice records are neither deleted nor expired.
- Given deactivation or role mutation would leave no active admin, when requested, then server returns `LAST_ACTIVE_ADMIN` with no account/session/audit deactivation change.
- Given a non-admin or invalid confirmation, when calling the action directly, then server rejects it and does not mutate the target.

## Design Notes

Guard admin cuối ở database transaction boundary, không phải qua count từ UI hay một read ngoài transaction. Revocation và lifecycle update phải là all-or-nothing, còn `getActorBySessionToken()` tiếp tục kiểm tra active status như lớp bảo vệ ngay cả khi cookie cũ được gửi trong thời điểm chuyển tiếp.

## Verification

**Commands:**
- `npm run lint` -- expected: lint passes.
- `npm run typecheck` -- expected: identity, route và UI contracts typecheck.
- `npm test` -- expected: use-case deactivation guard, confirmation validation, action revalidation và auth regression pass; database integration không được cấu hình trong test suite hiện tại.
- `npm run test:e2e` -- expected: foundation responsive/security flows pass; không bao gồm deactivation/detail-dialog chuyên biệt.
- `npm run db:migrate` -- expected: any new reviewed migration applies in order.
- `npm run build` -- expected: production build succeeds.

## Suggested Review Order

**Deactivation Transaction**

- Locks target before exact confirmation and protects the final active admin invariant.
  [`repositories.ts:54`](../../src/features/identity/infrastructure/repositories.ts#L54)

- Maps transaction outcomes to stable, server-authoritative domain errors.
  [`auth.ts:24`](../../src/features/identity/application/auth.ts#L24)

- Refuses session creation once an account is no longer active.
  [`repositories.ts:18`](../../src/features/identity/infrastructure/repositories.ts#L18)

**Admin Experience**

- Validates route input and presents status, retention statement, and audit history.
  [`page.tsx:7`](../../src/app/admin/accounts/[accountId]/page.tsx#L7)

- Requires exact named confirmation in an accessible, focused native dialog.
  [`deactivate-account-form.tsx:8`](../../src/features/identity/ui/deactivate-account-form.tsx#L8)

- Revalidates account list and detail after the successful server action.
  [`actions.ts:12`](../../src/app/admin/actions.ts#L12)

**Verification**

- Covers use-case authorisation, confirmation validation, and stable transaction error mapping.
  [`deactivate-centre-account.test.ts:19`](../../tests/unit/deactivate-centre-account.test.ts#L19)

- Covers server-action revalidation and boundary rejection of whitespace confirmation.
  [`admin-deactivation-action.test.ts:14`](../../tests/unit/admin-deactivation-action.test.ts#L14)

- Covers local sign-in denial when deactivation wins the session-creation race.
  [`identity-behaviour.test.ts:74`](../../tests/integration/identity-behaviour.test.ts#L74)
