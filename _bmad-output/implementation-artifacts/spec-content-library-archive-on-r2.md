---
title: 'Content Library Archive On R2'
type: 'feature'
created: '2026-10-21'
status: 'done'
review_loop_iteration: 0
baseline_commit: '958cb95'
context:
  - '_bmad-output/planning-artifacts/architecture/architecture-CambridgeYLE-2026-08-17/ARCHITECTURE-SPINE.md'
  - '_bmad-output/implementation-artifacts/spec-2-6-practice-set-lifecycle.md'
  - '_bmad-output/implementation-artifacts/spec-2-5-versioned-question-media-associations.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Toàn bộ nội dung bài học (curriculum target, guidance, answer policy, question/media version, practice set) và trạng thái duyệt chỉ nằm trong PostgreSQL. Reset database (chỉ xảy ra ở môi trường dev, không ở production) làm mất hết nội dung; media binary còn trên R2 nhưng không còn bản ghi nào trỏ tới. Không có cách mang nội dung giữa các môi trường.

**Approach:** Thêm một **content library** trên R2: mỗi version nội dung là một file JSON, mang theo `status` hiện tại và người duyệt (email). App tự đẩy lên kho sau mỗi thay đổi nội dung/trạng thái, có nút đẩy lại toàn bộ. Staff mở màn hình kho, chọn bài (hoặc tất cả) để tải về; bài đã `approved`/`published` về DB vẫn giữ trạng thái đó bằng cách phát lại đúng các bước chuyển trạng thái qua trigger hiện có. PostgreSQL vẫn là nguồn sự thật lúc chạy; kho chỉ là nơi lưu trữ và trao đổi.

## Boundaries & Constraints

**Always:**
- PostgreSQL là nơi duy nhất app đọc khi chạy (learner, staff, scoring). Kho không bao giờ được đọc trong luồng learner.
- Giữ nguyên UUID gốc của question/media version và practice set khi import; curriculum map theo khoá tự nhiên (xem Design Notes).
- Import phát lại transition `draft → in_review → approved → published → retired` qua các trigger hiện có; không sửa, tắt hay bypass trigger/migration đã shipped.
- Publish practice set khi import dùng lại đúng logic validation/snapshot của `publishPracticeSet`; snapshot mới được tạo trong DB, **không** tạo thêm version trên kho.
- Version nội dung bất biến: chỉ sửa nội dung mới tạo file mới; đổi trạng thái chỉ cập nhật trường `status` (và người/thời điểm duyệt) trong file của version đó.
- Actor map theo canonical email; không tìm thấy thì dùng người đang import.
- Bỏ luật practice set phải do người khác duyệt (quyết định của user ngày 2026-10-21): người submit được tự approve. Thay đổi bằng migration mới định nghĩa lại `protect_practice_set`, bỏ check ở `approvePracticeSet`, và ghi quyết định vào hàng `GATE-CONTENT-PLAN` của PRD Decision Register.
- Reset chỉ xảy ra ở dev nên import ưu tiên đơn giản: không kiểm tra xung đột chặt, bản trong DB luôn thắng khi trùng.
- Bản ghi bằng chứng do import tạo ra (validation, review, phone preview, audit) được gắn nhãn `Imported from content library`.
- Đẩy lên kho chạy sau khi transaction commit; lỗi kho không làm hỏng thao tác của staff (chỉ log và có thể đẩy lại).
- Chỉ `academic_lead` và `admin` được xem kho, đẩy toàn bộ và import. Product copy bằng British English, WCAG 2.2 AA, Zod tại boundary, lỗi dạng `{ error: { code, message } }`.

**Ask First:** Đưa attempt/kết quả/evidence của learner vào kho; xoá file khỏi kho; import ghi đè một version đã tồn tại trong DB; đổi định dạng `schemaVersion`.

**Never:** Không lưu answer review, response, evidence, dữ liệu learner, session hay secret trong kho. Không dùng kho làm public URL. Không đóng hay thay đổi `GATE-*`. Không thêm engine ngoài năm P0. Không coi kho là thay thế cho backup PostgreSQL.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tạo/sửa nội dung | Staff tạo hoặc revise question/media/curriculum | File JSON version mới được ghi lên kho sau commit | Kho lỗi: thao tác vẫn thành công, ghi log `CONTENT_LIBRARY_PUSH_FAILED` |
| Đổi trạng thái | Submit/approve/publish/retire question, media hoặc set | File của version đó được ghi lại với `status`, người duyệt, thời điểm mới | Như trên |
| Đẩy toàn bộ | Staff bấm "Push all to library" | Mọi curriculum, question, media version, practice set và media binary còn thiếu được ghi lên kho; chạy lại không tạo trùng | Trả số file đã ghi/bỏ qua/lỗi |
| Import set đã publish | Kho có set `published`; DB trống sau reset | Curriculum, media (kèm binary), question, set được tạo; set và thành phần ở `published`; learner chọn được set | Một set lỗi thì rollback toàn bộ set đó, các set khác vẫn import |
| Import nội dung approved | Question/media `approved` | Về DB ở `approved`; staff vẫn revise được (tạo version draft mới) | — |
| Import draft / in_review | Version chưa approved | Về DB ở `draft` | — |
| Import retired | Version/set `retired` | Phát lại tới `published` rồi `retired` | — |
| Người duyệt không còn | Email người duyệt không có trong DB | Người import đứng tên duyệt; email gốc vẫn còn trong file kho | — |
| Đã có trong DB | Version cùng UUID đã tồn tại | Bỏ qua, báo `already present` | Không ghi đè |
| Curriculum trùng khoá | Target/guidance/policy version cùng khoá tự nhiên đã có ID khác | Dùng bản trong DB và remap tham chiếu | Nội dung khác kho: chỉ báo cảnh báo trong kết quả import |
| Tự duyệt set | Cùng một staff submit rồi approve practice set | Approve thành công | — |
| Thiếu binary | File media trên kho không có object binary | Media và các item phụ thuộc không import | `CONTENT_LIBRARY_MEDIA_MISSING` |
| Publish lại thất bại | Validation khi publish set báo finding (vd. guidance local khác) | Set không được tạo | Trả findings của `publishPracticeSet` |
| Kho chưa cấu hình | Không có R2 ghi được (vd. `MEDIA_BINARY_ORIGIN` read-only) | Màn hình kho báo chưa cấu hình; thao tác nội dung bình thường | `CONTENT_LIBRARY_NOT_CONFIGURED` |

</frozen-after-approval>

## Code Map

- `src/infrastructure/storage/object-store.ts` -- adapter R2 hiện chỉ có put/head/get trên một bucket; cần thêm `listObjects(prefix)` (ListObjectsV2) và chọn bucket.
- `src/shared/config/server.ts`, `.env.example` -- thêm `CONTENT_LIBRARY_BUCKET` tuỳ chọn (mặc định = `BUCKET`).
- `db/schema/content.ts`, `db/schema/curriculum.ts` -- các bảng được export/import; UUID sinh phía app nên giữ được ID gốc.
- `db/migrations/0015_publish_immutable_practice_set_schema.sql:27-44` -- `enforce_content_status_transition`: approved cần validation + review `submitted`/`approved` + phone preview cho ảnh.
- `db/migrations/0029_practice_set_lifecycle_hardening.sql` -- `protect_practice_set`: set chỉ insert ở `draft`, approved cần submitter ≠ approver (sẽ bỏ), publish cần `app.practice_set_publication_id`.
- `src/features/content/application/practice-sets.ts:59`, `repositories.ts:hasPracticeSetReviewByActor`, `tests/unit/content-application.test.ts:994` -- check `PRACTICE_SET_SELF_APPROVAL_FORBIDDEN` cần bỏ.
- `_bmad-output/planning-artifacts/prds/prd-CambridgeYLE-2026-08-17/prd.md:207` -- hàng `GATE-CONTENT-PLAN` đang ghi "no self-approval exception".
- `db/migrations/0016_question_version_media.sql` -- association chỉ insert khi question còn `draft`.
- `src/features/content/application/{drafts,ai-drafts,review,publication,practice-sets}.ts`, `src/features/curriculum/application/curriculum.ts` -- các use case cần gọi đẩy lên kho sau commit.
- `src/features/content/application/practice-sets.ts:publishPracticeSet` -- tách phần thân chạy trong `tx` để import dùng lại.
- `src/features/content/infrastructure/repositories.ts` -- `createQuestion`, `createMedia`, `recordValidation`, `recordReview`, `recordPhonePreview`, `updateStatus`, `createPracticeSetDraft`, `recordPracticeSetReview`, `updatePracticeSetStatus`, `beginPracticeSetPublication`, `createPublishedPracticeSet`.
- `src/app/(staff)/academic-lead/` -- nơi thêm trang `archive` và server actions; `src/features/content/ui/staff-nav.tsx` thêm mục điều hướng.
- `tests/integration/staff-publication-to-learner.test.ts` -- mẫu test DB-backed với object store được mock.

## Tasks & Acceptance

**Execution:**
- `db/migrations/0033_allow_practice_set_self_approval.sql`, `db/migrations/meta/_journal.json` -- định nghĩa lại `protect_practice_set`: `in_review → approved` chỉ cần có review `approved`, mọi nhánh khác giữ nguyên như 0029.
- `src/features/content/application/practice-sets.ts`, `src/features/content/infrastructure/repositories.ts`, `tests/unit/content-application.test.ts`, `scripts/db-seed.ts` -- bỏ check tự duyệt và `hasPracticeSetReviewByActor`; đổi test thành "người submit tự approve được"; sửa comment seed.
- `_bmad-output/planning-artifacts/prds/prd-CambridgeYLE-2026-08-17/prd.md` -- ghi vào hàng `GATE-CONTENT-PLAN`: user quyết định 2026-10-21 cho phép staff tự approve practice set mình đã submit.
- `src/infrastructure/storage/object-store.ts`, `src/shared/config/server.ts`, `.env.example` -- thêm bucket tuỳ chọn cho kho, `listObjects(prefix)` có phân trang, và `copyObject`/đọc-ghi giữa bucket media và bucket kho.
- `src/features/content-library/domain/records.ts` -- Zod schema `schemaVersion: 1` cho từng loại record (target, guidance, policy kèm versions và vectors, question version, media version, practice set); hàm thuần serialise/parse, merge khi push và quy tắc trạng thái khi import.
- `src/features/content-library/infrastructure/library-store.ts` -- đọc/ghi/liệt kê dưới prefix `content-library/v1/`; ghi file chỉ khi nội dung hoặc trạng thái đổi.
- `src/features/content-library/application/sync.ts` -- `pushToLibrary()` đọc bản ghi từ DB, merge với file đang có (trạng thái không lùi), chỉ ghi file đổi và copy binary media vào `content-library/v1/media-files/<sha256>` nếu thiếu; `pushAllToLibrary(actor)`; `scheduleLibraryPush()` chạy push bằng `after()` sau mọi server action content/curriculum thành công; lỗi chỉ log.
- `src/features/content/application/practice-sets.ts` -- tách `publishPracticeSetInTransaction(tx, actorId, setId)`; `publishPracticeSet` gọi lại hàm này, hành vi không đổi.
- `src/features/content-library/application/import.ts` -- `listLibrary(actor)` (set + item lẻ, cờ đã có trong DB); `importFromLibrary(actor, { practiceSetIds?, all? })`: mỗi set một transaction; giải quyết curriculum theo khoá tự nhiên; copy binary về `media/<sha256>` nếu thiếu; insert version ở `draft` với UUID gốc, association, rồi phát lại transition tới trạng thái của kho; trả báo cáo theo từng item (imported, already present, warning, failed).
- `src/app/(staff)/academic-lead/archive/page.tsx`, actions cùng thư mục, `src/features/content-library/ui/*`, `staff-nav.tsx` -- trang "Content archive" (tên "Content library" đã dùng cho trang nội dung hiện có): danh sách set (title, paper/part, status trên kho, đã có trong DB hay chưa), checkbox, "Import selected", "Import all", "Push all to library", báo cáo kết quả có thông báo cho screen reader.
- `_bmad-output/planning-artifacts/architecture/architecture-CambridgeYLE-2026-08-17/ARCHITECTURE-SPINE.md` -- thêm quyết định kiến trúc "Content library archive": kho là bản lưu trữ/trao đổi, PostgreSQL vẫn là nguồn sự thật, import đi qua transition guards.
- `tests/unit/content-library-records.test.ts`, `tests/integration/content-library-round-trip.test.ts` -- test serialise/parse/hash và round trip DB-backed với store trong bộ nhớ.

**Acceptance Criteria:**
- Given một set đã publish cùng question/media/curriculum của nó đã được đẩy lên kho, when xoá dữ liệu content/curriculum trong DB rồi import set đó, then set, question và media ở `published` với UUID gốc, learner thấy và bắt đầu được set, media binary đọc được.
- Given một question `approved` trên kho có người duyệt không còn trong DB, when import, then question ở `approved`, review record `approved` đứng tên người import, và staff revise được thành version draft mới.
- Given kho có version `draft` hoặc `in_review`, when import, then version đó ở `draft`.
- Given staff approve hoặc publish một item, when transaction commit, then file kho của version đó có `status` mới mà không sinh file version mới; publish set không sinh version mới.
- Given R2 lỗi khi đẩy, when staff thao tác nội dung, then thao tác vẫn thành công và "Push all to library" sau đó ghi bù đủ.
- Given import cùng một set hai lần, when lần hai chạy, then không tạo bản ghi trùng và báo `already present`.
- Given answer policy cùng `canonicalId`/version trong DB khác nội dung với kho, when import, then dùng bản trong DB và kết quả import có cảnh báo.
- Given một staff đã submit practice set, when chính người đó approve, then set chuyển sang `approved`.
- Given learner hoặc teacher, when gọi trang hoặc action của kho, then bị từ chối.

## Design Notes

**Bố cục kho** (bucket `CONTENT_LIBRARY_BUCKET`, mặc định `BUCKET`):
```
content-library/v1/curriculum/targets/<targetId>.json
content-library/v1/curriculum/guidance/<guidanceId>.json
content-library/v1/curriculum/policies/<policyId>.json         # mọi version + conformance vectors
content-library/v1/questions/<questionVersionId>.json
content-library/v1/media/<mediaVersionId>.json
content-library/v1/media-files/<sha256>                        # binary, bất biến
content-library/v1/practice-sets/<practiceSetId>.json          # composition: questionVersionId + position
```
Kho dùng chung cho mọi môi trường để chuyển nội dung local → staging → production. Liệt kê bằng ListObjectsV2 theo prefix; quy mô P0 nhỏ nên không cần file index.

**Nội dung một record version:** `schemaVersion`, `id`, các trường nội dung như bảng DB (kèm `sourceVersionId`, provenance, accessibility, evidence dimensions, curriculum tham chiếu bằng UUID; import đọc file curriculum để map sang khoá tự nhiên), `status`, `createdBy`/`submittedBy`/`approvedBy` (email), `approvedAt`, `updatedAt`. Không lưu lịch sử review hay audit đầy đủ.

**Khoá tự nhiên của curriculum:** target theo `canonicalId`; guidance theo `(paper, part, engine, topic, taskFormat)`; answer policy theo `canonicalId`, version theo `(canonicalId, version)` ; đã có thì dùng bản DB. Chưa có trong DB thì insert với UUID gốc (policy version giữ số version và `currentVersionId` = version lớn nhất).

**Phát lại transition cho question/media** (một transaction, ID mới cho mọi bản ghi bằng chứng): insert `draft` → associations (question) → `content_validation_results` với findings `[]` → review `submitted` → `in_review` → phone preview 375px (ảnh) → review `approved` → `approved` → `published` → `retired`, dừng ở trạng thái của kho. Media được xử lý trước question phụ thuộc.

**Practice set:** insert `draft` với UUID gốc + composition → review `submitted` → `in_review` → review `approved` → `approved` (cả hai review đứng tên người duyệt map theo email, không có thì người import; hợp lệ vì đã bỏ luật tự duyệt) → nếu kho ghi `published`/`retired`: `publishPracticeSetInTransaction` → (`retirePracticeSet`).

**Không phải backup:** attempt, kết quả và evidence của learner không nằm trong kho; backup PostgreSQL vẫn thuộc `GATE-DEPLOYMENT`.

## Verification

**Commands:**
- `npm run lint` -- expected: không có lỗi ESLint.
- `npm run typecheck` -- expected: TypeScript không lỗi.
- `npm test` -- expected: unit test record và integration round trip DB-backed đều pass, các test content/practice hiện có không đổi.
- `npm run test:e2e` -- expected: các luồng staff/learner hiện có vẫn pass.

**Manual checks:**
- Local với R2 thật: publish một set → `npm run db:reset` (drop, migrate và seed) → đăng nhập academic lead → "Content library" → import set → learner làm được bài, ảnh/âm thanh hiển thị.
