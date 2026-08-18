<!-- bmad:context -->
<!-- Verified 2026-08-18 against 2634b8f2fd28a7b3a965cd567a7b543c3c9ed7a9. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## CambridgeYLE

CambridgeYLE la responsive web/PWA P0 cho learner Pre A1 Starters luyen tap ngan va cho giao vien xem bang chung theo tung cau hoi. P0 chi co nam engine: `picture_true_false`, `picture_yes_no`, `audio_picture_choice`, `audio_note_taking`, va `word_bank_cloze`. `README.md` la ban do tham quyen; tai lieu lap ke hoach va implementation contract o `_bmad-output/`, curriculum evidence o `docs/`.

## Policy

- Giai quyet moi xung dot tai lieu theo thu bac trong `README.md`; khong dung historical brief hoac PRD addendum de tao yeu cau moi.
- Khong tu dong `GATE-ACADEMIC-SOURCES`, `GATE-PUBLIC-WORDING`, `GATE-AI-DRAFT-PROVIDER`, hoac `GATE-DEPLOYMENT`; PRD Decision Register la nguon duy nhat cua cac gate va quyet dinh mo.
- Khong sua, doi ten hay xoa `docs/cambridge-young-learners-{handbook,wordlist,wordlist-2025}.md`; chung la imported evidence chi doc. Cap nhat `docs/source-manifest.md` chi sau byte-level comparison va academic review.
- Dung noi dung, media va feedback nguyen goc, duoc cap phep hoac tao rieng cho san pham; khong sao chep, xuat ban hay phong theo protected Cambridge test content.
- Khong tao public curriculum/alignment claim khi `GATE-ACADEMIC-SOURCES` va `GATE-PUBLIC-WORDING` con mo.

## Where things are

- Pham vi, yeu cau va gate: `_bmad-output/planning-artifacts/prds/prd-CambridgeYLE-2026-08-17/prd.md`
- Implementation kernel: `_bmad-output/specs/spec-cambridgeyle-p0/SPEC.md`; kien truc: `_bmad-output/planning-artifacts/architecture/architecture-CambridgeYLE-2026-08-17/ARCHITECTURE-SPINE.md`
- Hanh vi va visual rules: `_bmad-output/planning-artifacts/ux-designs/ux-CambridgeYLE-2026-08-17/{EXPERIENCE,DESIGN}.md`
- Curriculum, assessment va content policy: `docs/starters-curriculum-and-assessment-blueprint.md`; provenance imported evidence: `docs/source-manifest.md`

## Conventions that differ from defaults

- Giu P0 trong dung nam engine da chot; khong them speaking, full mock, public self-registration, parent account, payment, checkout hay admissions flow.
- Khong hien thi correctness, dap an hoac feedback truoc khi learner submit toan bo practice set; diem Listening va Reading/Writing phai deterministic, server-authoritative.
- Khong sua publication hoac attempt da co: published content va attempt evidence dung immutable snapshot; revision phai tao version moi.
- Tai khoan bi xoa theo nghia deactivation: revoke session va chan dang nhap, nhung giu record; khong tu dong purge hoac expiry.
- Dung British English trong technical artefacts va product copy; duy tri WCAG 2.2 AA.

<!-- /bmad:context -->
