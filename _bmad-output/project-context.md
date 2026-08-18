# CambridgeYLE Project Context

**Status:** Implementation-ready for core P0 only; not AI-enabled, public-claim-ready, pilot-ready, or production-ready.
**Verified:** 2026-08-18 against `2634b8f2fd28a7b3a965cd567a7b543c3c9ed7a9`

## Authority

1. `README.md` defines the authority hierarchy.
2. The PRD owns scope, requirements, release gates, and the decision register.
3. The SPEC is the implementation kernel and index; read the named companion contract for domain detail.
4. The curriculum blueprint owns curriculum, assessment, and content-policy constraints.
5. The source manifest owns imported-reference provenance, checksums, and verification status.
6. Architecture, experience, and design spines own technical, behavioural, and visual invariants respectively.
7. Epics only decompose and trace requirements; they never create requirements.

## Core P0 Boundary

- Responsive web/PWA for learner-selected short Pre A1 Starters practice plus teacher evidence review.
- Implement exactly five self-directed engines: `picture_true_false`, `picture_yes_no`, `audio_picture_choice`, `audio_note_taking`, and `word_bank_cloze`.
- Keep speaking, full mock tests, public sign-up, parent accounts, payment, checkout, admissions flow, microservices, LMS/xAPI, and analytics warehouse out of P0.
- Feedback, answers, and correctness are post-submit only.
- Listening and Reading/Writing scoring is deterministic and server-authoritative.
- Published question, media, practice-set, and attempt records use immutable versioned snapshots.
- Account removal is explicit deactivation with session revocation and retained records; it is not automatic expiry or purge.
- Use product-owned evidence labels only: `secure`, `building`, `needs practice`, and `not assessed yet`.

## Content And Source Controls

- All learner-facing content and media must be original, licensed, or generated specifically for the product and teacher-approved.
- Never copy, publish, adapt, or expose protected Cambridge test text, images, audio, layouts, answer keys, or branded word lists.
- Treat the three `docs/cambridge-young-learners-*.md` files as read-only imported evidence.
- Use the 2025 word list as the current internal working reference; never use the 2018 list to fill a missing or discrepant 2025 reference.
- An `academic_lead` or `admin` approves content; AI can produce structured drafts only and cannot approve, publish, or determine answer correctness.
- Enforce content validation for curriculum level, task template limits, tags, answer policy, alternatives, required media, provenance, and accessibility.

## Gates

- Do not make public curriculum/alignment claims until `GATE-ACADEMIC-SOURCES` and `GATE-PUBLIC-WORDING` close.
- Do not enable AI draft generation until `GATE-AI-DRAFT-PROVIDER` closes.
- Do not ship to production until `GATE-DEPLOYMENT` closes.
- Do not close a gate from an implementation artifact; use the PRD Decision Register.

## Product Quality

- Use British English for technical artefacts and product copy.
- Meet WCAG 2.2 AA.
- Preload required audio, images, and scene metadata before an attempt begins; show a clear error/retry state instead of starting with missing media.
- Store item-level response evidence, not only totals.
- Avoid Cambridge-result language, certificates, shields, pass/fail wording, or any implication that the product is official Cambridge English.

## Primary Documents

| Need | Source |
| --- | --- |
| Scope, requirements, gates | `_bmad-output/planning-artifacts/prds/prd-CambridgeYLE-2026-08-17/prd.md` |
| Build kernel | `_bmad-output/specs/spec-cambridgeyle-p0/SPEC.md` |
| Technical invariants | `_bmad-output/planning-artifacts/architecture/architecture-CambridgeYLE-2026-08-17/ARCHITECTURE-SPINE.md` |
| UX behaviour | `_bmad-output/planning-artifacts/ux-designs/ux-CambridgeYLE-2026-08-17/EXPERIENCE.md` |
| Visual rules | `_bmad-output/planning-artifacts/ux-designs/ux-CambridgeYLE-2026-08-17/DESIGN.md` |
| Curriculum and assessment | `docs/starters-curriculum-and-assessment-blueprint.md` |
| Source provenance | `docs/source-manifest.md` |
| Requirement traceability | `_bmad-output/planning-artifacts/epics.md` |
