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

## Chạy nội bộ bằng Docker Compose

`compose.yaml` chạy PostgreSQL 18, một bước migration chạy một lần, và app (Next.js standalone). App chỉ bind vào `127.0.0.1:${APP_PORT:-3000}`; Cloudflare tunnel trỏ vào cổng đó. Media nằm trong bucket R2 private, app đọc/ghi qua S3 API.

1. Điền `.env` theo `.env.example`: Google OAuth, `ADMIN_EMAILS`, R2 (`R2_ACCESS_ENDPOINT`, `R2_ACCESS_KEY`, `R2_ACCESS_SECRET`, `BUCKET`), `MEDIA_SIGNING_SECRET` (≥32 ký tự), `POSTGRES_PASSWORD`, và AI gateway nếu dùng (`AI_DRAFT_PROVIDER_GATE_CLOSED=true`). Không đặt `MEDIA_BINARY_ORIGIN` khi dùng R2.
2. Đặt `APP_ORIGIN` là origin HTTPS public của tunnel, ví dụ `https://yle.example.org`, và thêm `<APP_ORIGIN>/api/auth/google/callback` vào Authorized redirect URIs của Google OAuth client.
3. `docker compose up -d --build`. Kiểm tra: `curl http://127.0.0.1:3000/api/health`.
4. Đăng nhập bằng Google với một email trong `ADMIN_EMAILS` để vào `/admin`; admin tạo tài khoản learner (mật khẩu) và staff.

Cập nhật phiên bản: `git pull && docker compose up -d --build` (migration chạy trước khi app khởi động). Sao lưu DB: `docker compose exec -T db pg_dump -U cambridgeyle cambridgeyle > backup-$(date +%F).sql`; khôi phục bằng `psql` vào DB trống. Dữ liệu DB nằm trong volume `cambridgeyle_db-data`; `docker compose down -v` xoá volume này.

Smoke test toàn hệ thống (ghi dữ liệu "Smoke" vào DB và R2, gọi AI thật): `SMOKE_BASE_URL=http://127.0.0.1:3000 npx playwright test -c playwright.smoke.config.ts`.

## Imported references

Ba file `docs/cambridge-young-learners-{handbook,wordlist,wordlist-2025}.md` là evidence read-only. Edition 2025 là current working curriculum reference; edition 2018 chỉ là historical reference. Không file nào là learner-facing content và mọi citation/discrepancy chưa xác minh phải đi qua `GATE-ACADEMIC-SOURCES`.
