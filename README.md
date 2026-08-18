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

Bộ tài liệu **đã implementation-ready cho core P0**, nhưng chưa AI-enabled, public-claim-ready, pilot-ready hoặc production-ready. PRD Decision Register là danh sách duy nhất của các quyết định mở. Các blocking gate hiện tại:

- `GATE-ACADEMIC-SOURCES` trước mọi public curriculum/alignment claim dựa trên imported references.
- `GATE-PUBLIC-WORDING` trước mọi public-facing claim.
- `GATE-AI-DRAFT-PROVIDER` trước khi bật AI tạo content draft.
- `GATE-DEPLOYMENT` trước production launch.

Không artifact nào được tự đóng các gate này. `GATE-CONTENT-PLAN`, `GATE-DATA-GOVERNANCE` và `GATE-PRODUCT-ASSUMPTIONS` đã đóng: teacher-facing curriculum/assessment guidance là nguồn tạo/review content, mỗi set được `academic_lead`/`admin` phê duyệt riêng, P0 không xử lý yêu cầu xóa dữ liệu, và browser matrix đã được chấp thuận. P0 bảo toàn deactivation-with-retention, immutable publication/attempt snapshots, server-authoritative deterministic scoring, post-submit-only review, WCAG 2.2 AA và British English trong technical artefacts.

## Imported references

Ba file `docs/cambridge-young-learners-{handbook,wordlist,wordlist-2025}.md` là evidence read-only. Edition 2025 là current working curriculum reference; edition 2018 chỉ là historical reference. Không file nào là learner-facing content và mọi citation/discrepancy chưa xác minh phải đi qua `GATE-ACADEMIC-SOURCES`.
