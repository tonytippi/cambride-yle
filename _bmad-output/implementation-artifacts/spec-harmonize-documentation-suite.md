---
title: 'Thống nhất bộ tài liệu CambridgeYLE trước triển khai'
type: 'chore'
created: '2026-08-18'
status: 'in-review'
review_loop_iteration: 0
baseline_commit: '40cf82f021f8d583d738d764de2ef8c9d1dc9955'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Bộ tài liệu hiện có nhiều nguồn thẩm quyền cạnh tranh, trạng thái “final” không phản ánh các gate còn mở, một số contract bị mất khi chuyển từ PRD sang SPEC/Epics, và UX/architecture chưa thống nhất các lifecycle quan trọng. Wordlist 2025 mới được thêm nhưng chưa có manifest hoặc academic verification để trở thành machine source.

**Approach:** Thiết lập một authority hierarchy và decision register duy nhất; cập nhật mọi artifact do dự án sở hữu để tham chiếu đúng contract; lấy edition 2025 làm curriculum reference hiện hành nhưng giữ nguyên byte các source export và ghi provenance/verification trong source manifest.

## Boundaries & Constraints

**Always:** Giữ đúng năm P0 engines; dùng nhất quán `learner`, `assigned practice`, `evidence states`, `deactivate account` và `publication`; bảo toàn deactivation-with-retention, immutable snapshots, server-authoritative scoring, post-submit-only review, WCAG 2.2 AA và British English trong technical artifacts. Mọi quyết định chưa được chủ sở hữu duyệt phải là named gate có owner/status, không được suy đoán.

**Ask First:** Trước khi sửa byte, đổi tên hoặc xóa ba imported references; trước khi tự chốt evidence thresholds, retention/legal wording, data residency, RPO/RTO, historical teacher access hoặc provider/budget.

**Never:** Không thêm feature ngoài P0; không biến wordlist Markdown thành learner-facing content; không dùng wordlist 2018 để âm thầm vá lỗ hổng 2025; không tuyên bố suite implementation-ready khi blocking gates chưa đóng; không thêm public signup, purge, speaking recording, queued offline submit, AI scoring hoặc AI self-publication.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Nguồn curriculum | Wordlist 2025 mới, 2018 cũ | 2025 là current working reference; 2018 là historical; cả hai giữ nguyên byte | Discrepancy/citation gap thành manifest finding và academic gate |
| Contract chưa chốt | Threshold, privacy hoặc deployment decision còn mở | PRD decision register sở hữu ID, owner, gate và affected artifacts | Không sao chép danh sách open decision sang nhiều file |
| PWA cạnh tranh | Multi-tab/device, stale draft, account switch | Contract nêu revision, conflict, cache isolation và submit reconciliation | Stale write/key mismatch trả stable conflict |
| Nội dung đổi trạng thái | Reject, revise, retire question/media/set | Ba state machine riêng có rejection, versioning và grandfathering | Published snapshot không thay đổi |

</frozen-after-approval>

## Code Map

- `README.md` — human entry point, authority map, readiness gates và canonical links.
- `docs/source-manifest.md` — provenance, checksum, authority rank và verification của imported references.
- `docs/cambridge-young-learners-{handbook,wordlist,wordlist-2025}.md` — read-only evidence; không sửa byte.
- `docs/starters-curriculum-and-assessment-blueprint.md` — curriculum authority; edition 2025, P0/P1 split và academic gates.
- `_bmad-output/planning-artifacts/brief-CambridgeYLE-2026-08-17/brief.md` — historical input; đánh dấu superseded và bỏ capability stale.
- `_bmad-output/planning-artifacts/prds/prd-CambridgeYLE-2026-08-17/{prd,addendum}.md` — product authority/decision register; addendum superseded.
- `_bmad-output/specs/spec-cambridgeyle-p0/SPEC.md` — implementation kernel; sửa companion path và bảo toàn PRD gates/dimensions.
- `_bmad-output/planning-artifacts/architecture/architecture-CambridgeYLE-2026-08-17/ARCHITECTURE-SPINE.md` — attempt, assignment, authorization, content và deployment invariants.
- `_bmad-output/planning-artifacts/ux-designs/ux-CambridgeYLE-2026-08-17/{DESIGN,EXPERIENCE}.md` — visual/behavior ownership, deactivation, accessibility và PWA states.
- `_bmad-output/planning-artifacts/epics.md` — traceability matrix và acceptance coverage, không là requirement source thứ hai.

## Tasks & Acceptance

**Execution:**
- [x] `README.md`, `docs/source-manifest.md`, `docs/starters-curriculum-and-assessment-blueprint.md` — thiết lập navigation, provenance và curriculum authority 2025.
- [x] `brief.md`, `prd.md`, `addendum.md`, `SPEC.md` — thống nhất status, authority hierarchy, decision register, metrics và traceability.
- [x] `ARCHITECTURE-SPINE.md`, `DESIGN.md`, `EXPERIENCE.md` — đóng các contract đã xác định nhưng không tự chốt named gates.
- [x] `epics.md` — đồng bộ stories/AC và thay inventory lặp bằng traceability.
- [x] Toàn suite — sửa links, thuật ngữ và prose drift; xác minh imported-reference checksums không đổi.

**Acceptance Criteria:**
- Given một stakeholder mở README, when theo authority map, then mỗi decision chỉ có một normative owner và mọi link tồn tại.
- Given P0 scope, when so sánh blueprint, PRD, SPEC, UX, architecture và epics, then cả sáu thống nhất năm engines, assigned practice, deactivation-with-retention và evidence-state vocabulary.
- Given wordlist 2025, when kiểm tra manifest, then edition/provenance/checksum/verification status rõ ràng và ba imported files không đổi byte.
- Given một requirement PRD, when lần theo traceability, then tìm được SPEC/domain contract/story/release gate tương ứng mà không mất evidence dimensions.
- Given các decision chưa duyệt, when đọc suite, then chúng xuất hiện dưới named gate và không artifact nào tự nhận implementation-ready.

## Spec Change Log

- 2026-08-18: Harmonised the documentation suite; established authority/gates and the 2025 source manifest, closed specified architecture/UX lifecycle contracts, replaced duplicated epic inventory with traceability, and verified paths/checksums/edge-case coverage.

## Design Notes

PRD sở hữu product decisions và release gates; SPEC là implementation index/kernel; các domain spine sở hữu chi tiết; Epics chỉ phân rã và trace. Imported references là evidence, không phải editable product contract.

## Verification

**Commands:**
- `sha256sum docs/cambridge-young-learners-{handbook,wordlist,wordlist-2025}.md` — expected: khớp checksum được ghi trong manifest.
- `rg -n "recommended practice|soft-delete|delete account|status: final|final-validation-passed|../../docs/starters" README.md docs _bmad-output` — expected: không còn drift ngoài historical/source context được ghi chú.
- Kiểm tra mọi relative Markdown/frontmatter path bằng filesystem — expected: tất cả target tồn tại.
