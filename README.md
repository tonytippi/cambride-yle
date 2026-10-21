# CambridgeYLE

CambridgeYLE là ứng dụng web/PWA hỗ trợ `learner` Pre A1 Starters tự chọn luyện tập ngắn theo chủ đề/loại bài hoặc theo đề xuất từ lịch sử làm bài. Giáo viên dùng bằng chứng ở mức câu hỏi để hướng dẫn học sinh. P0 chỉ gồm năm engine: `picture_true_false`, `picture_yes_no`, `audio_picture_choice`, `audio_note_taking` và `word_bank_cloze`.

## Thứ bậc thẩm quyền

Khi tài liệu mâu thuẫn, dùng thứ tự sau. Mỗi quyết định chỉ có một chủ sở hữu quy phạm:

1. [PRD](_bmad-output/planning-artifacts/prds/prd-CambridgeYLE-2026-08-17/prd.md) sở hữu phạm vi sản phẩm, yêu cầu, decision register và release gates.
2. [SPEC](_bmad-output/specs/spec-cambridgeyle-p0/SPEC.md) là implementation kernel/index; chi tiết do các companion bên dưới sở hữu.
3. [Curriculum blueprint](docs/starters-curriculum-and-assessment-blueprint.md) sở hữu curriculum, assessment và content-policy contract. [Source manifest](docs/source-manifest.md) sở hữu provenance/checksum/trạng thái xác minh của imported references.
4. [Architecture spine](_bmad-output/planning-artifacts/architecture/architecture-CambridgeYLE-2026-08-17/ARCHITECTURE-SPINE.md) sở hữu technical invariants; [Experience spine](_bmad-output/planning-artifacts/ux-designs/ux-CambridgeYLE-2026-08-17/EXPERIENCE.md) sở hữu hành vi; [Design spine](_bmad-output/planning-artifacts/ux-designs/ux-CambridgeYLE-2026-08-17/DESIGN.md) sở hữu visual rules.
5. [Epics](_bmad-output/planning-artifacts/epics.md) chỉ phân rã và trace yêu cầu; không tạo requirement mới.

[Product brief](_bmad-output/planning-artifacts/brief-CambridgeYLE-2026-08-17/brief.md) và [PRD addendum](_bmad-output/planning-artifacts/prds/prd-CambridgeYLE-2026-08-17/addendum.md) là historical inputs đã bị thay thế, không có thẩm quyền quy phạm.

## Trạng thái sẵn sàng

Core P0 đã implement và chạy được nội bộ (Docker Compose, xem bên dưới); chưa public-claim-ready hay production-ready. PRD Decision Register là danh sách duy nhất của các quyết định mở:

- `GATE-ACADEMIC-SOURCES` trước mọi public curriculum/alignment claim dựa trên imported references (không chặn dùng nội bộ).
- `GATE-PUBLIC-WORDING` trước mọi public-facing claim (không chặn dùng nội bộ).
- `GATE-DEPLOYMENT` đã đóng cho giai đoạn test nội bộ; vẫn mở cho production launch.
- `GATE-AI-DRAFT-PROVIDER` đã đóng ngày 2026-10-20: hai gateway OpenAI-compatible được cấu hình phía server.

Không artifact nào được tự đóng các gate này. `GATE-CONTENT-PLAN`, `GATE-DATA-GOVERNANCE` và `GATE-PRODUCT-ASSUMPTIONS` đã đóng: teacher-facing curriculum/assessment guidance là nguồn tạo/review content, mỗi set được `academic_lead`/`admin` phê duyệt riêng, P0 không xử lý yêu cầu xóa dữ liệu, và browser matrix đã được chấp thuận. P0 bảo toàn deactivation-with-retention, immutable publication/attempt snapshots, server-authoritative deterministic scoring, post-submit-only review, WCAG 2.2 AA và British English trong technical artefacts.

## Chạy local để phát triển

`.env` trỏ tới một PostgreSQL local. `npm run dev` chạy ở `http://localhost:3001`.

- `npm run db:reset`: xoá toàn bộ dữ liệu, chạy lại mọi migration rồi seed tài khoản test (hỏi xác nhận bằng tên DB; `-- --yes` để bỏ qua, `-- --no-seed` để không seed).
- `npm run db:seed`: thêm tài khoản test nếu chưa có: `admin@`, `lead@`, `teacher@`, `learner1@`, `learner2@test.local`, mật khẩu `cambridge-local-test` (đổi bằng `SEED_PASSWORD`).

Hai script chỉ chạy khi host của `DATABASE_URL` là localhost và `NODE_ENV` khác `production`.

Learner đăng nhập ở `/sign-in` (chỉ mật khẩu). Staff đăng nhập ở `/staff/sign-in` bằng Google; ngoài production trang này có thêm form mật khẩu để dùng tài khoản seed.

## Chạy nội bộ bằng Docker Compose

`compose.yaml` chạy PostgreSQL 18, một bước migration chạy một lần, và app (Next.js standalone). App chỉ bind vào `127.0.0.1:${APP_PORT:-9100}`; Cloudflare tunnel trỏ vào cổng đó. Media nằm trong bucket R2 private, app đọc/ghi qua S3 API.

1. Tạo `.env.production` từ `.env.production.example` (không commit file này; `.env` chỉ dùng cho dev và test). Điền Google OAuth, `ADMIN_EMAILS` (danh sách email được quyền admin khi đăng nhập Google, cách nhau bởi dấu phẩy), `POSTGRES_PASSWORD` cùng `DATABASE_URL` dùng đúng mật khẩu đó, R2, `MEDIA_SIGNING_SECRET` (≥32 ký tự) và AI gateway nếu dùng (`AI_DRAFT_PROVIDER_GATE_CLOSED=true`). Không đặt `MEDIA_BINARY_ORIGIN` khi dùng R2.
2. `GOOGLE_OIDC_REDIRECT_URI` là `https://cambridge.passionedu.org/api/auth/google/callback`; thêm đúng URI này vào Authorized redirect URIs của Google OAuth client. Cloudflare tunnel trỏ `cambridge.passionedu.org` tới `http://127.0.0.1:9100`.
3. `docker compose up -d --build`. Kiểm tra: `curl http://127.0.0.1:9100/api/health`.
4. Vào `/staff/sign-in`, đăng nhập bằng Google với một email trong `ADMIN_EMAILS` để vào `/admin`. Admin tạo tài khoản learner (bắt buộc mật khẩu; learner đăng nhập ở `/sign-in`) và staff (đăng nhập bằng Google đúng email đã tạo; production không nhận mật khẩu staff). Google sign-in không tự tạo tài khoản cho email khác.

Cập nhật phiên bản: `git pull && docker compose up -d --build` (migration chạy trước khi app khởi động). Sau khi sửa `.env.production`, chạy lại `docker compose up -d` để app nhận cấu hình mới. Sao lưu DB: `docker compose exec -T db pg_dump -U cambridgeyle cambridgeyle > backup-$(date +%F).sql`; khôi phục bằng `psql` vào DB trống. Dữ liệu DB nằm trong volume `cambridgeyle_db-data`; `docker compose down -v` xoá volume này.

Smoke test toàn hệ thống (ghi dữ liệu "Smoke" vào DB và R2, gọi AI thật): `SMOKE_BASE_URL=http://127.0.0.1:9100 npx playwright test -c playwright.smoke.config.ts`.

## Imported references

Ba file `docs/cambridge-young-learners-{handbook,wordlist,wordlist-2025}.md` là evidence read-only. Edition 2025 là current working curriculum reference; edition 2018 chỉ là historical reference. Không file nào là learner-facing content và mọi citation/discrepancy chưa xác minh phải đi qua `GATE-ACADEMIC-SOURCES`.
