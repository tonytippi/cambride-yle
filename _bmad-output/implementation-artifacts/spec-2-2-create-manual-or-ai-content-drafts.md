---
title: 'Story 2.2: Create Manual Or AI Content Drafts'
type: 'feature'
created: '2026-08-19'
status: 'done'
baseline_commit: 'f9c1653'
review_loop_iteration: 0
context:
  - 'docs/starters-curriculum-and-assessment-blueprint.md'
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Sau Story 2.1, staff co the quan ly curriculum va answer policy nhung chua co noi de tao question/media dau vao cho academic review. Vi the content khong the mang du metadata, lien ket curriculum va provenance can thiet de di qua cac story review va publication sau nay.

**Approach:** Tao content feature server-authoritative cho `academic_lead` va admin de lap manual question/media draft, hoac yeu cau, sua va rerun AI text/image draft khi provider gate da dong. Tat ca ket qua chi la version `draft`, luu immutable provenance va audit an toan; AI gate dang mo phai chan moi AI request ma khong tu dong dong gate.

## Boundaries & Constraints

**Always:** Ho tro dung nam P0 engine; chi `academic_lead`/admin duoc mutate; question draft luu `starters`, paper/part, engine, prompt/options, answer-policy version, mot primary target, supporting target/topic IDs, duration, accessibility metadata va provenance; media draft luu metadata/accessibility/provenance tuong duong. Moi AI result luu gateway kind, endpoint/model, immutable prompt/reference provenance, SHA-256 output hash va `generated` origin; text gateway nhan `text,image -> text`, image gateway nhan `text,image -> image`, khoa rieng server-only. Payload chi chua guidance, metadata, staff prompt, permitted reference va draft; khong bao gio gui/ghi log learner, account, attempt, response, evidence, answer key, secret, signed URL hay raw media. Loi du kien co `{ error: { code, message } }`, audit dung opaque IDs, British English va WCAG 2.2 AA.

**Ask First:** Dong `GATE-AI-DRAFT-PROVIDER`, cau hinh provider/credential that, thay doi AI payload allowlist, them object storage/upload binary, hoac thay doi taxonomy/answer-policy va five-engine boundary.

**Never:** Khong implement validation/review/approval/full phone-preview enforcement, publish/retire/practice set, upload malware scan, learner surface, scoring hay public curriculum claim. Khong cho AI, manual draft hay rerun bo qua `draft`; khong sua draft/provenance da luu tai cho, va khong de AI tu quyet dinh answer correctness.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Manual draft | Staff duoc phep gui metadata hop dong va controlled references | Tao question hoac media version moi o `draft`, provenance `manual`, audit mutation an toan | Reference/metadata khong hop le tra named findings, khong persist partial record |
| AI gate open | Staff request text/image khi gate van open | Khong goi gateway va khong tao generated draft | `AI_DRAFT_PROVIDER_GATE_OPEN` on dinh, audit request outcome khong chua payload |
| AI draft | Gate dong, cau hinh gateway hop le, payload allowlisted | Goi dung gateway; tao version draft moi co generated provenance, gateway/model, prompt/reference provenance va output hash | Provider/cau hinh fail tra code on dinh, khong persist result mot phan |
| Edit/rerun | Staff sua structured text draft hoac rerun text/image | Tao draft version moi co lien ket lineage; version cu va provenance bat bien | Actor khong duoc phep tra `FORBIDDEN`; unknown/stale source tra stable not-found/conflict |
| Image preview | Image draft ton tai | Staff thay duoc preview container phone-width va metadata AI ro rang | Preview khong la approval va khong thay validation Story 2.3 |

</frozen-after-approval>

## Code Map

- `db/schema/curriculum.ts:17-194` -- tai su dung enums `starters`, paper, engine, controlled targets/guidance/policy versions va curriculum audit pattern; them content schema tach biet, khong lam yeu foreign key content vao audit account-only cu.
- `db/schema/index.ts:1-2`, `db/migrations/meta/_journal.json`, `db/migrations/0007_answer_policy_guidance_reference.sql` -- export schema moi va sinh migration Drizzle co thu tu sau 0007.
- `src/features/curriculum/domain/contracts.ts:3-27`, `src/features/curriculum/application/curriculum.ts:7-26` -- tai su dung canonical contracts, controlled-reference checks, `authorise`, transaction ownership va named findings.
- `src/features/identity/application/auth.ts:9-12`, `src/features/identity/ui/session.ts:10-11` -- staff role boundary va protected workspace pattern.
- `src/shared/config/environment.ts:3-21`, `src/shared/config/server.ts:1-7`, `.env.example:1-11` -- mo rong server-only config cho hai gateway, khong expose key sang client.
- `src/app/academic-lead/page.tsx:1-5`, `src/app/academic-lead/actions.ts:13-138`, `src/features/curriculum/ui/catalogue-forms.tsx:1-299` -- ghep draft library/editor vao workspace, dung Zod action, `useActionState`, status accessible va revalidation.
- `src/app/globals.css:3-20` -- giu focus, 48px control va responsive layout; them phone-width image preview phu hop staff surface.
- `tests/unit/curriculum-application.test.ts:61-301`, `tests/unit/curriculum-actions.test.ts:1-11`, `tests/unit/server-config.test.ts:4-18`, `tests/integration/migration-baseline.test.ts:5-37` -- mau test authorisation, transaction, action result, config khong lo secret va migration baseline.

## Tasks & Acceptance

**Execution:**
- [x] `db/schema/content.ts`, `db/schema/index.ts`, `db/migrations/`, `db/migrations/meta/_journal.json` -- them immutable versioned question/media draft, provenance, AI generation/lineage va audit persistence; rang buoc lifecycle chi `draft`, controlled references va append-only fields.
- [x] `src/features/content/domain/contracts.ts`, `src/features/content/domain/provenance.ts` -- dinh nghia Zod contract, five-engine metadata, safe AI request allowlist, immutable provenance, output hashing va stable content errors.
- [x] `src/features/content/application/content.ts`, `src/features/content/infrastructure/repositories.ts`, `src/features/content/infrastructure/gateways.ts` -- thuc thi authorised transactional manual/create-edit-rerun use cases, gate check, separate configured gateway adapters, failure mapping va audit khong nhay cam.
- [x] `src/shared/config/environment.ts`, `src/shared/config/server.ts`, `.env.example` -- khai bao validation server-only cho text/image endpoint, model va API key; khong yeu cau gia tri khi gate dang mo.
- [x] `src/app/academic-lead/page.tsx`, `src/app/academic-lead/actions.ts`, `src/features/content/ui/*`, `src/app/globals.css` -- them content library/editor accessible cho manual va AI draft, hien AI provenance/hash va image preview phone-width; action chi goi one use case.
- [x] `tests/unit/content-*.test.ts`, `tests/integration/content-*.test.ts`, `tests/unit/server-config.test.ts`, `tests/integration/migration-baseline.test.ts` -- cover matrix, roles, gate, payload exclusion, independent gateway credentials, hashes/provenance/lineage immutability, audit safety, UI action va database constraints.

**Acceptance Criteria:**
- Given authenticated `academic_lead` or admin, when they create manual question/media content with valid controlled references, then a complete, auditable `draft` version is stored with required metadata and immutable provenance.
- Given the AI provider gate is open, when permitted staff attempts a text or image request/rerun, then the system returns a stable blocking failure and invokes neither gateway nor creates generated content.
- Given the gate is closed and the selected gateway succeeds, when staff requests or reruns structured text/image, then the correct separately configured server-only gateway is called and a new generated `draft` records gateway/model, input provenance and output hash.
- Given an existing draft, when staff edits or reruns it, then a new draft preserves prior draft and provenance history; no workflow can publish it in this story.
- Given a teacher or learner calls any content mutation, when it reaches the application boundary, then it returns `FORBIDDEN` with no content or audit mutation.

## Design Notes

Dung version record moi cho manual edit va AI rerun thay vi update in place. Day la cach bao toan evidence cho Story 2.3 review va Story 2.4 snapshot, trong khi `sourceVersionId` cung cap lineage ma khong lam content cu thay doi.

## Verification

**Commands:**
- `npm run db:generate` -- expected: migration chi phan anh content-draft schema.
- `npm run db:migrate` -- expected: migration chay thanh cong voi PostgreSQL duoc cau hinh.
- `npm run lint` -- expected: khong co ESLint error.
- `npm run typecheck` -- expected: TypeScript thanh cong.
- `npm test` -- expected: unit/integration tests, bao gom gate va provenance, pass.
- `npm run test:e2e` -- expected: protected staff draft workspace va role/gate flows pass.

## Suggested Review Order

**Draft Boundaries**

- Authorised use cases enforce draft-only lifecycle, controlled references and AI gate boundaries.
  [`content.ts:15`](../../src/features/content/application/content.ts#L15)

- AI requests validate before transmission and atomically retain generated provenance and audit evidence.
  [`content.ts:20`](../../src/features/content/application/content.ts#L20)

- Separate gateways use server-only credentials, timeouts and stable provider failures.
  [`gateways.ts:8`](../../src/features/content/infrastructure/gateways.ts#L8)

**Immutable Evidence**

- Schema captures version lineage, draft provenance, generation metadata and safe audit records.
  [`content.ts:6`](../../db/schema/content.ts#L6)

- Migration protects question, media, generation and audit history from mutation.
  [`0008_content_drafts.sql:6`](../../db/migrations/0008_content_drafts.sql#L6)

**Staff Workspace**

- Existing curriculum maintenance remains available beside the content-draft library and previews.
  [`page.tsx:1`](../../src/app/academic-lead/page.tsx#L1)

- Actions parse staff input, preserve named findings and call one authorised use case each.
  [`actions.ts:235`](../../src/app/academic-lead/actions.ts#L235)

**Verification**

- Tests cover authorisation, gate behaviour, controlled references, lineage and generated provenance.
  [`content-application.test.ts:1`](../../tests/unit/content-application.test.ts#L1)

- Gateway tests verify independent credentials and safe request payload boundaries.
  [`content-gateways.test.ts:1`](../../tests/unit/content-gateways.test.ts#L1)
