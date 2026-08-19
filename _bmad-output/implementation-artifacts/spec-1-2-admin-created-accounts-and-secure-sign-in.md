---
title: 'Story 1.2: Tài khoản, đăng nhập an toàn và Google Sign-In'
type: 'feature'
created: '2026-08-19'
status: 'done'
baseline_commit: '422af9aa3e3264a389a19b1520373695b0490b15'
review_loop_iteration: 0
context:
  - '_bmad-output/implementation-artifacts/epic-1-context.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-CambridgeYLE-2026-08-17/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Vấn đề:** Ứng dụng chưa có tài khoản, phiên, xác thực hay phân quyền, nên người dùng trung tâm không thể vào khu vực đúng vai trò. Người dùng yêu cầu thêm Google Sign-In: email khớp `ADMIN_EMAILS` phải là admin và email Google hợp lệ chưa tồn tại được tạo learner tự động.

**Cách tiếp cận:** Xây dựng identity capability server-authoritative hỗ trợ song song email/mật khẩu Argon2id và Google OAuth/OIDC. Tạo các phiên opaque phía server, trang đăng nhập, homes theo vai trò và giao diện admin tạo tài khoản; Google provisioning chỉ xảy ra trong callback đã xác minh, không có form tự đăng ký.

## Ranh giới & Ràng buộc

**Luôn:** Dùng PostgreSQL/Drizzle migration mới cho account, session, audit và throttling; lưu UTC `timestamptz`, UUIDv7 opaque, enum/check lifecycle rõ ràng; đặt feature tại `src/features/identity/{domain,application,infrastructure,ui}` và để route/UI gọi use-case. Email/mật khẩu dùng Argon2id; session chỉ lưu verifier/hash, cookie phải `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, không cache. Session hết hạn hoặc bị revoke phải xoá cookie và yêu cầu user sign in lại. Google callback chỉ chấp nhận issuer, audience, chữ ký, state/nonce và `email_verified` đã kiểm chứng; không tin email/role từ browser. Chuẩn hoá email trước khi so khớp `ADMIN_EMAILS`; email Google nằm trong danh sách được tạo/nâng thành `admin`, các email Google hợp lệ khác chỉ tạo learner nếu chưa có account. Google identity hợp lệ có canonical email trùng account hiện có được link vào account đó; Google subject đã link với account khác phải fail closed. Account deactivated không được đăng nhập bằng local password hoặc Google, và Google callback không được tự reactivate account. Không cho Google tự thay đổi một vai trò staff/admin đã được admin gán khác, trừ quy tắc `ADMIN_EMAILS` rõ ràng. Tất cả lỗi local unknown/sai/deactivated/throttled dùng một phản hồi chung; áp dụng Argon2 dummy verification khi không có account để tránh enumeration. Mỗi protected read/mutation nhận actor đã xác thực và tự authorise; route trái quyền chuyển về role home cùng thông báo `You do not have access to that page.` Audit mọi tạo/nâng account và thay đổi truy cập với opaque IDs, không chứa secrets, credentials, token hay cookie. Duy trì WCAG 2.2 AA, target 48px, focus hiện rõ và copy sản phẩm British English.

**Hỏi trước:** Thay đổi provider OAuth, danh sách Google domains được phép, semantics của `ADMIN_EMAILS`, profile fields ngoài email/display name, cơ chế reset mật khẩu, hoặc bất kỳ public sign-up flow nào.

**Không bao giờ:** Không thêm public registration page, social provider khác, password recovery, account deletion/deactivation UI (Story 1.3), cohort scope, role grant từ client, raw OAuth token trong database/log/browser storage, hay weakening cookie security cho production. Không mở account cho Google email chưa xác minh.

## Ma trận I/O & Edge Case

| Tình huống | Input / State | Output / Behaviour | Xử lý lỗi |
|----------|---------------|--------------------|-----------|
| Local sign-in hợp lệ | Account active, mật khẩu đúng | Tạo session opaque và điều hướng role home | Cookie an toàn, response no-store |
| Local failure | Email unknown, sai mật khẩu, deactivated, hoặc bị throttle | Cùng status/body/message chung | Dummy hash check; log chỉ code chung |
| Expired or revoked session | Session cookie không còn hợp lệ | Xoá cookie và điều hướng tới sign-in | Không trả dữ liệu protected |
| Google admin | Callback OIDC hợp lệ, verified email thuộc `ADMIN_EMAILS` | Tạo hoặc cập nhật account active thành admin, rồi tạo session | Reject callback/state/token không hợp lệ; không reactivate account deactivated |
| Google learner | Callback OIDC hợp lệ, verified email ngoài `ADMIN_EMAILS` | Link Google identity vào account có canonical email trùng; nếu chưa có account, tạo learner tối thiểu | Không tạo account nếu email không verified; reject Google subject đã link account khác |
| Protected route | Anonymous hoặc actor thiếu quyền | Anonymous tới sign-in; actor tới own role home với thông báo chuẩn | Không trả dữ liệu protected |

</frozen-after-approval>

## Code Map

- `src/shared/config/environment.ts:3-16`, `src/shared/config/server.ts:1-7`, `.env.example` -- mở rộng cấu hình server-only cho Google OIDC và `ADMIN_EMAILS`; lỗi validation chỉ nêu tên key. Cân nhắc startup/build boundary ở `next.config.ts:2-4`.
- `src/shared/http/response.ts:3-21`, `src/shared/logging/logger.ts:4-44` -- tái sử dụng response `{ data }`/`{ error }`, no-store, request ID và log allowlist; không thêm metadata xác thực.
- `src/infrastructure/database/client.ts:1-8`, `drizzle.config.ts:1-12`, `db/migrations/0000_initial_baseline.sql`, `db/migrations/meta/_journal.json` -- DB boundary và discipline; thêm schema và migration có số thứ tự mới, không sửa baseline.
- `src/features/identity/` -- capability mới: domain roles/actor/errors, Zod contracts, account/session/auth/throttle repositories, OIDC và password adapters, application use-cases cho sign-in, callback, create account, authorise/sign-out.
- `src/app/`, `src/app/page.tsx:1-12`, `src/app/globals.css:3-13` -- thay landing placeholder bằng sign-in và role homes/protected layouts theo token hiện có.
- `tests/unit/`, `tests/integration/health-route.test.ts:1-42`, `tests/e2e/foundation.spec.ts:3-27` -- theo Vitest direct-route mocks và Playwright real-browser conventions; bao phủ OIDC adapter bằng fixtures, không gọi Google thật.

## Tasks & Acceptance

**Thực thi:**
- [x] `package.json`, lockfile, `.env.example`, `src/shared/config/*` -- thêm Argon2/OIDC dependency và cấu hình server-only được validate cho client ID/secret/issuer/redirect URI/`ADMIN_EMAILS`.
- [x] `db/schema/identity.ts`, `db/migrations/0001_*`, migration journal -- tạo account, session, audit, OIDC identity và persistent throttle schema cùng constraints/indexes cần thiết.
- [x] `src/features/identity/{domain,application,infrastructure}/**` -- thực hiện local auth, verified Google callback/provisioning, session lookup/revocation, actor authorisation, throttling và audit qua use-case transactions.
- [x] `src/app/**`, `src/features/identity/ui/**` -- thêm accessible sign-in, Google start/callback, sign-out, role homes, account-creation admin surface và server-side protected routing.
- [x] `tests/unit/**`, `tests/integration/**`, `tests/e2e/**` -- kiểm thử matrix, cookie flags, role/routing, migration constraints, audit safety, generic local failures, throttle và responsive keyboard flow.

### Review Findings

- [x] [Review][Patch] Dùng signed one-time token để xoá cookie session invalid, tránh logout-CSRF [src/features/identity/ui/session.ts:10]
- [x] [Review][Patch] So sánh canonical email ở linked Google identity path [src/features/identity/application/auth.ts:26]
- [x] [Review][Patch] Canonicalise email trước khi tạo throttle key [src/features/identity/infrastructure/repositories.ts:11]
- [x] [Review][Patch] Đặt no-store headers cho session-expired response [src/app/api/auth/session-expired/route.ts:5]
- [x] [Review][Patch] Bổ sung use-case tests cho Google account deactivated và linked Google identity có email khác casing/whitespace [tests/integration/identity-behaviour.test.ts:82]
- [x] [Review][Patch] Bổ sung assertions cookie flags và no-store cho session-expired response [tests/integration/identity-behaviour.test.ts:112]
- [x] [Review][Patch] Kiểm thử migration canonical email bằng PostgreSQL thực tế, gồm backfill, unique constraint và canonical duplicates [tests/integration/migration-baseline.test.ts:5]
- [x] [Review][Defer] Throttle origin đang dùng request Host [src/app/sign-in/actions.ts:16] — deferred, pre-existing; cần thiết kế trusted client/IP throttle key ở deployment boundary.
- [x] [Review][Defer] Canonical email có thể stale nếu một capability tương lai cập nhật raw email trực tiếp [db/schema/identity.ts:9] — deferred, pre-existing; P0 hiện không có email-update flow, capability đó phải dùng một update path atomic.

**Acceptance Criteria:**
- Given admin tạo active account với password, when user local-signs in bằng credentials hợp lệ, then server tạo opaque secure cookie session và route role-specific home.
- Given callback Google được xác minh, when canonical email thuộc `ADMIN_EMAILS`, then account active nhận admin access; when email không thuộc danh sách và đã có account, then Google identity link vào account đó; when chưa có account, then chỉ learner account tối thiểu được tạo.
- Given callback không hợp lệ, email chưa verified, hoặc protected request không đủ quyền, when request được xử lý, then không provision/expose data và server áp dụng redirect/error chính xác.
- Given attacker thử credentials hay điều hướng trực tiếp, when account/role/session không hợp lệ, then generic failure/throttling hoặc server-side denial ngăn truy cập mà không leak account existence.

## Design Notes

Google provisioning là ngoại lệ có chủ đích từ user với “admin-created accounts”: nó không phải public form sign-up và chỉ nhận identity đã xác thực từ Google. Canonical verified email là khoá link Google identity với account hiện có; account source và linked Google subject vẫn độc lập với email. Identity collision, gồm Google subject đã link account khác, phải fail closed; không overwrite account silently.

## Verification

**Commands:**
- `npm run lint` -- expected: lint pass.
- `npm run typecheck` -- expected: server/client và identity contracts typecheck.
- `npm test` -- expected: unit/integration cover local + mocked OIDC, authorisation, cookie/session và schema.
- `npm run test:e2e` -- expected: keyboard accessible/responsive sign-in, generic failure và protected-route flows pass.
- `npm run db:migrate` -- expected: reviewed identity migration applies without schema push.
- `npm run build` -- expected: production build validates required non-secret config safely.

## Suggested Review Order

**Authentication Flow**

- Local credentials and Google identities converge on server-authoritative sessions.
  [`auth.ts:13`](../../src/features/identity/application/auth.ts#L13)

- Verified Google callback binds PKCE, state, nonce and secure redirects.
  [`route.ts:11`](../../src/app/api/auth/google/callback/route.ts#L11)

- Persistence stores only session verifiers and atomically records throttling.
  [`repositories.ts:12`](../../src/features/identity/infrastructure/repositories.ts#L12)

**Identity Data**

- Explicit role, lifecycle and identity constraints protect account state.
  [`identity.ts:4`](../../db/schema/identity.ts#L4)

- Reviewed migration creates immutable identity storage and lifecycle safeguards.
  [`0001_identity.sql:1`](../../db/migrations/0001_identity.sql#L1)

**Behavioural Proof**

- Matrix-driven mocked integration tests cover auth, OAuth, routing and sign-out.
  [`identity-behaviour.test.ts:49`](../../tests/integration/identity-behaviour.test.ts#L49)

- Protected layouts redirect anonymous and cross-role navigation server-side.
  [`protected-routing.test.ts:1`](../../tests/integration/protected-routing.test.ts#L1)
