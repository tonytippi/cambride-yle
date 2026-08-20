---
title: 'Story 3.2: Prepare Essential Media And Safe PWA Storage'
type: 'feature'
created: '2026-08-20'
status: 'done'
baseline_revision: 'dc573d6f2bd0a2baf7be8f83cdf4be6d0579ce55'
review_loop_iteration: 1
followup_review_recommended: true
context:
  - '_bmad-output/implementation-artifacts/epic-3-context.md'
warnings: []
deferred:
  - summary: >-
      Authorised media is written under a synthetic safe cache key but is not yet served from that cache when the short-lived capability URL is unavailable offline.
    evidence: |-
      Serving an account/attempt/set-version-scoped binary cache without adopting or retaining a signed capability URL requires the open-attempt draft and media-recovery surface planned in Story 3.4.
    location: >-
      public/service-worker.js:5-15
    severity: medium
  - summary: >-
      A server-side account deactivation cannot directly purge Cache Storage or local storage in an already-open browser session.
    evidence: |-
      Current cleanup awaits user-initiated sign-out. A later session/account lifecycle client surface must receive deactivation or switch state and invoke the existing account-scoped purge primitive.
    location: >-
      src/features/pwa/ui.tsx:10-15
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Link `Start` của Story 3.1 chưa có trang đích, không kiểm tra asset snapshot bắt buộc và không thể tạo attempt một cách nguyên tử. Ứng dụng cũng chưa có PWA/cache policy để bảo vệ dữ liệu learner và nội dung nhạy cảm.

**Approach:** Tạo preparation flow thuộc feature `practice` để cấp URL media đã được uỷ quyền, tải trước asset thiết yếu và chỉ khởi tạo open attempt sau kiểm tra nguyên tử phía server. Bổ sung PWA feature có allowlist nghiêm ngặt cho application shell và binary asset đã uỷ quyền, cùng lifecycle purge theo namespace tài khoản.

## Boundaries & Constraints

**Always:** Chỉ đọc `published` immutable practice-set/item/media snapshots, kiểm tra actor role `learner`, và không tạo attempt khi set retired, có open attempt, thiếu asset, asset không sẵn sàng hoặc uỷ quyền thất bại. Server kiểm tra lại snapshot, learner scope và mọi essential asset trong cùng transaction trước insert. Dùng Zod tại API boundary và `{ data }` hoặc `{ error: { code, message } }`. Mọi cache/draft key phải namespace bằng account, attempt và set-version opaque ID; không nhận key namespace sai. UI hiển thị tình trạng audio/image từng loại, `Retry`/`Leave`, Start bị disable đến khi đủ ready, target 48px, keyboard/announced states và British English. Cache chỉ binary asset media được cấp quyền và static application shell; không cache API, HTML/document, signed URL response, answer review, result, teacher evidence, response hoặc answer key.

**Block If:** Nền tảng hiện hữu không thể kiểm tra availability của binary private media hoặc cấp URL ngắn hạn mà không dùng preview URL/public URL làm capability.

**Never:** Đọc draft question/media để chuẩn bị, thay đổi snapshot đã publish, tiết lộ alt text/transcript/metadata có thể lộ đáp án, tạo alternate task khi media không dùng được, thêm engine ngoài năm P0, queue submission offline, hoặc biến PWA install thành điều kiện sử dụng browser.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Prepare ready set | Learner chọn published snapshot với image/audio thiết yếu khả dụng | Trang liệt kê trạng thái theo asset type, preload xong bật Start | Không tạo attempt trong preparation read |
| Media unavailable | Một asset hết hạn, lỗi tải hoặc unavailable | Start vẫn disable và asset lỗi có Retry/Leave | Không tuyên bố ready; retry lấy lại media authorisation/readiness |
| Atomic start | Learner bấm Start sau ready | Server revalidate set, scope và toàn bộ asset rồi tạo đúng một open attempt | Failure trả mã ổn định và không tạo usable attempt |
| Retired or duplicate start | Set bị retired lúc start hoặc learner đã có open attempt | Không tạo attempt mới | Trả authoritative resume/conflict state |
| Unsafe cache request | API/document/signed URL/result/evidence request | Không được Cache Storage xử lý/lưu | Chuyển thẳng network, không ghi sensitive payload |
| Account lifecycle | Sign-out, deactivation hoặc account switch | Chỉ purge cache/draft namespace của account rời đi | Không xoá namespace tài khoản khác; key mismatch bị bỏ qua |

</intent-contract>

## Code Map

- `db/schema/content.ts:219-311` -- nguồn read-only của published set, item và media snapshots bất biến; không dereference content draft.
- `db/schema/practice.ts:18-47` và `db/migrations/0017_learner_practice_selection.sql:5-53` -- attempt lifecycle hiện có và unique open attempt guard; mở rộng tối thiểu để start attempt có immutable version/revision metadata cần thiết.
- `src/features/practice/domain/contracts.ts` -- thêm preparation/start contracts, Zod input và mã lỗi typed bên cạnh learner-home contracts.
- `src/features/practice/infrastructure/repositories.ts` -- thay query card-only bằng practice-side snapshot/readiness query và transaction start có lock/revalidation; tiếp tục scope bằng learner ID.
- `src/features/practice/application/practice.ts` -- giữ route/UI chỉ gọi application boundary, authorise learner trước mọi query/start.
- `src/features/practice/ui/learner-home.tsx` -- action link hiện hữu tới `/learner/practice/${set.id}` là điểm vào preparation.
- `src/app/learner/practice/[setId]/page.tsx` và action/route cùng scope -- protected server entry và mutation endpoint cho preparation/start.
- `src/features/pwa/*`, `src/app/layout.tsx`, `next.config.ts` -- đăng ký optional service worker, static shell/cache allowlist, cache headers và client lifecycle purge; project hiện chưa có PWA implementation.
- `src/app/globals.css` -- tái dùng focus/action target/shell và thêm responsive preparation states.
- `tests/unit/practice-application.test.ts`, `tests/unit/pwa-cache-policy.test.ts`, `tests/integration/migration-baseline.test.ts` -- bảo vệ authorisation, atomicity, immutable source, failure/no-attempt và cache namespace/deny-list.

## Tasks & Acceptance

**Execution:**
- `db/schema/practice.ts`, migration mới và migration journal -- bổ sung attempt snapshot/version/revision fields và database constraints cần thiết cho safe start, không làm yếu immutable/open-attempt triggers; trigger phải giữ các fields snapshot bất biến.
- `src/features/practice/domain/contracts.ts`, `application/practice.ts`, `infrastructure/repositories.ts` -- triển khai snapshot preparation query, media gateway/readiness abstraction, URL authorised ngắn hạn và start transaction revalidate/insert; reject snapshot không có essential media, phân biệt input/authorisation/unavailability/retired/conflict, và trả state authoritative/resume target.
- `src/app/learner/practice/[setId]/page.tsx`, `src/app/learner/practice/[setId]/attempt/[attemptId]/page.tsx`, action/route, `src/features/practice/ui/preparation.tsx`, `src/app/globals.css` -- tạo protected preparation surface, preload per-asset type, retry/leave, robust network error recovery và only-ready Start dẫn tới open-attempt placeholder có tồn tại, không phải future route.
- `src/features/pwa/*`, `public/service-worker.js`, `src/app/layout.tsx`, `next.config.ts`, sign-out/deactivation lifecycle surfaces liên quan -- dùng một policy source/test fixture nhất quán, explicit cache allow/deny policy và purge namespace account/attempt/set-version chính xác khi account lifecycle thay đổi; cleanup sign-out phải hoàn tất trước navigation.
- `.env.example`, `tests/unit/practice-application.test.ts`, `tests/unit/pwa-cache-policy.test.ts`, `tests/integration/migration-baseline.test.ts` -- document required fail-closed media configuration; test toàn bộ matrix, transaction failure, concurrent/open state, immutable query provenance, trigger immutability, cache prohibition và scoped purge.

**Acceptance Criteria:**
- Given một learner chọn published immutable set chưa có attempt, when mở preparation, then essential authorised image/audio được xác minh và hiển thị theo loại trước khi Start khả dụng.
- Given readiness thay đổi hoặc một asset lỗi, when learner retry hoặc chọn leave, then không có open attempt được tạo và UI không xác nhận readiness sai.
- Given learner bắt đầu một ready set, when server xử lý start, then server atomically revalidates snapshot, authorisation và essential media before creating one open attempt; failure creates no usable attempt.
- Given browser cache hoạt động, when service worker nhận request, then chỉ static shell và authorised media binary đủ điều kiện được cache, never API/documents/signed URLs/results/reviews/evidence.
- Given account sign-out, deactivation hoặc switch, when browser lifecycle cleanup chạy, then chỉ asset/draft namespace thuộc account cũ bị purge và mismatched namespace không được adopt.

## Design Notes

Readiness phía browser là phản hồi UX, không phải authority để start. Browser reload preparation authorisation khi Retry; server transaction là ranh giới quyết định để tránh race giữa preload và retirement/object availability. Cache policy nên là pure, testable request classifier: default deny, explicit same-origin static shell allow, explicit authorised media binary allow, mọi URL/query response còn lại bypass.

## Spec Change Log

### 2026-08-20 -- Review repair
- Trigger: task cho phép điều hướng tới placeholder Story 3.3 nhưng acceptance yêu cầu bề mặt `Start` usable; review cũng cho thấy các invariants snapshot/cache chưa đủ cụ thể để ngăn implementation sai.
- Amendment: yêu cầu route open-attempt placeholder tồn tại, explicit empty-essential-media failure, immutable trigger fields, authoritative errors/resume, robust retry, unified runtime/test cache policy, complete sign-out cleanup và matrix-level tests.
- Avoids: successful start dẫn 404, snapshot/media thiếu được start, cache/runtime diverges khỏi test, và retained browser data sau sign-out.
- KEEP: giữ private fail-closed media gateway, immutable published-snapshot source, server transaction revalidation và default-deny cache design.

## Review Triage Log

### 2026-08-20 -- Review pass
- intent_gap: 0
- bad_spec: 1 (medium 1)
- patch: 0
- defer: 2 (medium 2)
- reject: 12
- addressed_findings:
  - `[medium] [bad_spec]` Làm rõ bề mặt attempt sau Start, invariants snapshot/cache và matrix verification trong Spec Change Log trước vòng implementation lại.

### 2026-08-20 -- Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3 (high 1, medium 2)
- defer: 2 (medium 2)
- reject: 0
- addressed_findings:
  - `[high] [patch]` Khoá hàng published practice set trước snapshot revalidation để retirement không thể commit giữa kiểm tra và insert attempt.
  - `[medium] [patch]` Bắt lỗi network/non-JSON của Start và luôn khôi phục control cùng thông báo retry được.
  - `[medium] [patch]` Khôi phục thứ tự rule security header để full test suite không regression.

## Auto Run Result

Status: done

Summary: Added a learner preparation flow that reads only immutable published snapshots, fails closed for unavailable essential media, creates or resumes an open attempt through server revalidation, and adds safe PWA cache controls.

Files changed:
- `db/schema/practice.ts`, `db/migrations/0018_practice_attempt_snapshot_metadata.sql`, migration journal -- immutable attempt snapshot/revision persistence and trigger protections.
- `src/features/practice/*`, `src/app/learner/practice/*`, `src/app/api/practice/*` -- preparation, authorised media proxy, atomic start/resume and open-attempt placeholder.
- `src/features/pwa/*`, `public/service-worker.js`, `public/pwa-cache-policy.js`, `src/app/layout.tsx`, `next.config.ts` -- optional worker registration, default-deny runtime cache policy and shell/media cache controls.
- `src/features/identity/ui/*`, role home surfaces -- await account-scoped client storage purge before voluntary sign-out navigation.
- `.env.example`, `tests/unit/practice-application.test.ts`, `tests/unit/pwa-cache-policy.test.ts`, `tests/integration/migration-baseline.test.ts` -- fail-closed media setup and coverage for the new contracts.

Review findings: 3 patches applied (high 1, medium 2); 2 medium items deferred; 12 findings rejected in the first pass after spec repair. Follow-up review recommendation: true (score 6; patched counts high 1, medium 2, low 0).

Verification:
- `npm test` -- passed, 145 tests.
- `npm run typecheck` -- passed.
- `npm run lint` -- passed.
- `npm run build` -- passed.
- `git diff --check` -- passed.

Residual risks: `MEDIA_BINARY_ORIGIN` and `MEDIA_SIGNING_SECRET` are required; absence intentionally leaves media unavailable. Deferred lifecycle/cache recovery work requires the account-session and open-attempt recovery surfaces planned for later stories.

## Verification

**Commands:**
- `npm test -- --run tests/unit/practice-application.test.ts tests/unit/pwa-cache-policy.test.ts tests/integration/migration-baseline.test.ts` -- expected: start/readiness/cache contracts pass.
- `npm run typecheck` -- expected: TypeScript has no errors.
- `npm run lint` -- expected: ESLint has no errors.
- `npm run build` -- expected: production build completes.
- `git diff --check` -- expected: no whitespace errors.
