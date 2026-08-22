---
title: 'Implement Independent Practice-Set Lifecycle'
type: 'feature'
created: '2026-08-22'
status: 'done'
review_loop_iteration: 0
baseline_commit: '027875c'
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
  - '_bmad-output/implementation-artifacts/epic-2-retro-08-22-2026.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Practice set hiện được tạo trực tiếp ở trạng thái `published`, không có composition draft, review/approval evidence hay state transition độc lập. Điều này cho phép learner nhìn thấy set trước khi workflow do staff kiểm soát hoàn tất và không đáp ứng lifecycle đã công bố cho Epic 2.

**Approach:** Cài lifecycle độc lập `draft -> in_review -> approved -> published -> retired` cho practice set. Giữ composition editable tách biệt khỏi published snapshot; chỉ transaction publish mới kiểm tra lại references rồi materialise snapshots bất biến, với audit và review evidence đầy đủ.

## Boundaries & Constraints

**Always:** Chỉ `academic_lead` và `admin` được mutation; chỉ published set được learner list/start; tất cả transition, review/approval và retirement phải có append-only audit evidence không chứa secrets, answer keys, learner response hay signed URL. Published set và snapshot item/media không được sửa, còn retirement chỉ chặn selection mới và không đổi attempt/evidence đã có. Reuse validation hiện tại cho references published, cùng paper/part, 300-600 giây, 1-2 primary objectives, media, labels, guidance và provenance; publish phải revalidate dưới lock trong một transaction, không có partial rows. Giữ đúng năm P0 engines, scoring server-authoritative, British English và WCAG 2.2 AA.

**Ask First:** Thay đổi semantics learner start/submission, backfill hoặc mutate published snapshots hiện có, tự động retire/migrate set đang published, cho phép self-approval, hay bổ sung accessible task variant.

**Never:** Không sửa migration đã shipped; không dùng immutable `practice_set_items` hoặc `practice_set_item_media` làm vùng draft editable; không thêm AI provider, binary storage, public curriculum claims, engine mới hay broad application/repository refactor. Không implement readiness regrouping hay end-to-end publication-to-learner coverage đã được deferred.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy lifecycle | Staff tạo draft hợp lệ, submit review, approve và publish | Set chuyển tuần tự tới `published`; snapshot item/media được materialise một lần, audit và review evidence được ghi | Transaction rollback toàn bộ nếu validation/reference fail |
| Premature transition | Publish draft/in-review, approve draft, review approved hoặc retire non-published set | Không có mutation hoặc snapshot mới | Stable lifecycle error; DB cũng từ chối direct SQL transition sai |
| Invalid review/publication | Composition có reference/media/duration/objective không hợp lệ hoặc source thay đổi sau approval | Named blocking findings, set giữ state trước đó | Không có partial audit, status hay snapshots |
| Immutable/retired evidence | Direct update/delete review/audit/snapshot hoặc retire published set với attempt hiện hữu | DB từ chối mutation; set biến mất khỏi selection mới nhưng attempt đã có vẫn dùng snapshot cũ | Immutable error; learner start mới vẫn unavailable |

</frozen-after-approval>

## Code Map

- `db/schema/content.ts:220-312` -- practice-set enum/default, aggregate, immutable snapshot và audit schema; mở rộng lifecycle và thêm draft composition/review evidence, không đổi snapshot contract.
- `db/migrations/0014_publish_immutable_practice_sets.sql`, `0015_publish_immutable_practice_set_schema.sql`, `0025_practice_set_composition_trigger_fix.sql` -- read-only tiền lệ enum/trigger; thêm forward migrations theo journal, tách enum values khỏi việc dùng chúng trong default/trigger.
- `db/migrations/meta/_journal.json` -- đăng ký migration mới theo thứ tự Drizzle.
- `src/features/content/domain/contracts.ts:100-104` -- mở rộng input schemas cho create draft và lifecycle action; từ chối unknown/duplicate composition input.
- `src/features/content/application/content.ts:634-735,737-901` -- reuse lifecycle/authorisation pattern và tách `publishPracticeSet()` hiện tại thành create, review, approve, publish, retire server-authoritative use cases.
- `src/features/content/infrastructure/repositories.ts:103-134,412-420,459-570` -- staff read model, append-only audit và current direct-publication repository boundary; tạo/lock draft composition, review record, guarded transitions và materialiser publication.
- `src/app/academic-lead/actions.ts:264-265`, `src/app/academic-lead/page.tsx:197-223`, `src/features/content/ui/draft-forms.tsx:455-508` -- thay published-first composer bằng status-aware draft workflow, named findings và evidence/history accessible.
- `src/features/practice/infrastructure/repositories.ts:29-124` -- learner list/start chỉ accept `published` và lock với retire; giữ behaviour và immutable attempt reads.
- `tests/unit/content-{application,contracts,actions,ui}.test.ts`, `tests/integration/{migration-baseline,published-practice-snapshot}.test.ts` -- conventions cho lifecycle, migration guards, UI actions và database-backed snapshot path.

## Tasks & Acceptance

**Execution:**
- [x] `db/schema/content.ts`, new ordered `db/migrations/0027_*.sql` and `0028_*.sql`, `db/migrations/meta/_journal.json` -- introduce draft/review/approval statuses, draft-composition and immutable practice-set review evidence, plus DB guards for legal transitions, mutable-draft-only composition and immutable published/audit/review records; retain existing records and snapshots.
- [x] `src/features/content/domain/contracts.ts`, `src/features/content/application/content.ts`, `src/features/content/infrastructure/repositories.ts` -- replace direct publication with staff-authorised create-draft, submit-review, approve, publish and retire use cases; lock and revalidate before atomic snapshot materialisation, emitting named findings and stable errors without nested transactions.
- [x] `src/app/academic-lead/actions.ts`, `src/app/academic-lead/page.tsx`, `src/features/content/ui/draft-forms.tsx` -- expose staff workflow controls only for legal state transitions, clear text status, findings, review/audit history and a non-editable published/retired composition view.
- [x] `tests/unit/content-application.test.ts`, `tests/unit/content-contracts.test.ts`, `tests/unit/content-actions.test.ts`, `tests/unit/content-ui.test.ts` -- cover authorised lifecycle success, premature transition denial, invalid composition findings, revalidation before publish and state-specific controls.
- [x] `tests/integration/migration-baseline.test.ts`, `tests/integration/published-practice-snapshot.test.ts` and affected E2E migration list -- prove migrated PostgreSQL transition/immutability guards and production-path draft-to-publish snapshot creation while retaining learner visibility/start and pre-existing-attempt behaviour after retirement.

**Acceptance Criteria:**
- Given an academic lead or admin creates a valid practice-set composition, when it is submitted, approved and published, then the set follows `draft -> in_review -> approved -> published`, stores immutable review/audit evidence and materialises snapshots only at publish.
- Given a staff member attempts an illegal lifecycle transition or a teacher/learner attempts any lifecycle mutation, when the request or direct database update is processed, then it is rejected with no status, composition, snapshot or audit partial write.
- Given an approved set becomes invalid before publication, when staff publish it, then locked revalidation returns named blocking findings and it remains approved without snapshots.
- Given a published set is retired, when learners browse/start afterwards, then it is unavailable for new selection; attempts created before retirement continue to read, save, submit and review their immutable snapshot evidence.

## Design Notes

Draft composition stores source-version references only. Prompt/options, scoring-ready answer policy, feedback, tags, accessibility, provenance and media hashes are copied only in the `approved -> published` transaction. A rejected/revised workflow, if exposed, must create a new draft aggregate rather than reopening or changing the reviewed/published aggregate.

## Verification

**Commands:**
- `npm run db:migrate` -- expected: new forward migrations apply to the configured PostgreSQL database.
- `npm run lint` -- expected: no ESLint errors.
- `npm run typecheck` -- expected: TypeScript completes without errors.
- `npm test` -- expected: unit and migrated-database lifecycle, validation and immutable snapshot coverage pass.
- `npm run test:e2e` -- expected: disposable schema applies the complete migration sequence and staff/learner browser flows pass.

## Suggested Review Order

**Lifecycle Boundary**

- Staff mutations follow the sole authoritative lifecycle and validate again before publication.
  [`content.ts:737`](../../src/features/content/application/content.ts#L737)

- Database guards permit only draft creation and status-only evidence-backed transitions.
  [`0029_practice_set_lifecycle_hardening.sql:1`](../../db/migrations/0029_practice_set_lifecycle_hardening.sql#L1)

- Publication capability permits immutable snapshots only within the guarded transaction.
  [`repositories.ts:436`](../../src/features/content/infrastructure/repositories.ts#L436)

**Staff Workflow**

- The staff surface creates drafts and exposes only the legal next transition.
  [`page.tsx:201`](../../src/app/academic-lead/page.tsx#L201)

**Regression Evidence**

- Database-backed coverage proves publication scoring, failed publication rollback and retirement preservation.
  [`published-practice-snapshot.test.ts:27`](../../tests/integration/published-practice-snapshot.test.ts#L27)
