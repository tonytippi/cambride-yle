# Epic 2 Context: Safe Starters Practice Content

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Enable `academic_lead` users and admins to turn original, licensed, or approved generated Starters material into safe, auditable learner practice without letting unsuitable or unreviewed content reach learners. The epic establishes controlled curriculum targets and answer policies, a reviewable draft workflow, immutable publication snapshots, and readiness evidence so later learner practice and teacher evidence always operate from stable, valid content.

## Stories

- Story 2.1: Maintain Curriculum Targets And Answer Policies
- Story 2.2: Create Manual Or AI Content Drafts
- Story 2.3: Validate, Review And Phone-Preview Content
- Story 2.4: Publish Immutable Practice Sets
- Story 2.5: Verify Pilot Content Readiness

## Requirements & Constraints

- Support Starters only and exactly five P0 engines: `picture_true_false`, `picture_yes_no`, `audio_picture_choice`, `audio_note_taking`, and `word_bank_cloze`. Do not add Movers, Flyers, speaking, full mocks, or unreviewed generated publication.
- Provide teacher-facing curriculum and assessment guidance for content creation and review. Store canonical, level-aware target identifiers and versioned, machine-readable answer policies with explicit normalisation and matching semantics. Guidance must cover paper/part, engine, topic, vocabulary, grammar, and task format.
- Validate controlled vocabulary and grammar, approved names and numbers, and task-template limits. Maintain policy conformance vectors for every input kind used by the five engines so scoring can be consistent and deterministic.
- Questions and media require level, paper, part, task type, prompt/options, answer policy, one primary learning-objective identifier, supporting curriculum tags, estimated duration, accessibility metadata, and immutable provenance before publication. Content and media must be original, licensed, or approved generated material; never reproduce protected assessment content, media, layouts, or answer keys.
- Only `academic_lead` and `admin` may author, edit, validate, request or rerun drafts, approve, publish, retire, compose sets, or run readiness. Teachers may read published content only. Audit every content-status mutation, AI-draft request, publication, and review/approval mutation without recording answer keys or other sensitive payloads in logs.
- AI generation is disabled until `GATE-AI-DRAFT-PROVIDER` is closed. The configured OpenAI-compatible text gateway accepts text/image input and returns text; the separate image gateway accepts text/image input and returns an image. Each uses its own server-only key. Requests may contain only curriculum guidance, content metadata, authorised staff prompts, permitted reference images, and the draft under review, never learner identity, account, attempt, response, or evidence data.
- Every AI result remains a draft and records gateway kind, endpoint/model, input-prompt/reference provenance, output hash, and generated origin. Human content and academic review, approval, phone-width preview, and manual publication remain mandatory.
- Before review or publication, produce named, publication-blocking findings for missing required tags, answer keys or alternatives, required/approved media, curriculum limits, provenance, sanitisation, upload safety, and accessibility. Sanitise staff text. Require allowlisted upload type and size plus integrity and malicious-content checks.
- Question versions, media versions, and practice-set versions have independent lifecycle transitions: `draft -> in_review -> approved -> published -> retired`; rejection from review records actor, reason, and time, then creates a new editable draft version. Published versions are never edited in place.
- A practice set may contain only published question and media versions, must be 5-10 minutes, cover one paper/part, and contain one or two distinct primary learning objectives. Essential media must be authorised and available before a media-dependent published set is selectable.
- Publication atomically creates immutable snapshots of rendered content, answer policy, tags, feedback, accessibility metadata, provenance, and write-once media object version/content hash. Retirement blocks future selection/publication but never changes active or completed attempts or their snapshots.
- Readiness must report coverage by all five engines, paper/part, topic, vocabulary/grammar target, approved essential media, and duration. It must demonstrate or flag whether varied 5-10 minute sets can be composed for each published topic/task-type choice, list concrete gaps, and never infer readiness from item count or require a fixed inventory.
- Meet WCAG 2.2 AA, use British English, and ensure editor/admin surfaces work on tablet and desktop. Preserve accessibility metadata for staff review but never expose learner-facing labels, transcripts, or alternative text that reveal answers. No alternate accessible task variant is in scope when essential media cannot be used.

## Technical Decisions

- Implement curriculum and content as separate feature modules in the Next.js/TypeScript modular monolith, with application use-cases owning transactions. Route/action boundaries authenticate and authorise actors, parse shared Zod contracts, and invoke one use-case; repository adapters do not create nested transactions.
- PostgreSQL is authoritative for target policies, versioned content state, provenance, media metadata, publication snapshots, and associations. Use reviewed ordered Drizzle migrations, UTC `timestamptz`, explicit database lifecycle enums or check constraints, opaque UUIDv7 identifiers externally, `camelCase` TypeScript, and `snake_case` database fields.
- Persist answer-policy semantics in the snapshot consumed by the server scorer, including Unicode normalisation, case/locale, whitespace/punctuation, numbers, and accepted-answer matching. Snapshot records, not editable source records, supply content and scoring input to active or completed attempts.
- Store binary media privately in S3-compatible object storage; PostgreSQL owns its metadata, approval/version state, and associations. Media URLs are short-lived and authorised only for a published snapshot. Snapshot media objects are write-once and retained while referenced by a publication or attempt.
- Make publication a transactional boundary: reject non-approved dependencies, materialise all item snapshots and immutable media references atomically, and preserve provenance and safety-review outcomes with the version/review record.
- Return expected failures as `{ error: { code, message } }` with stable machine codes. Emit structured audit/log context using opaque actor and target identifiers; exclude secrets, sessions, learner responses, answer keys, signed URLs, and raw audio.

## UX & Interaction Patterns

- Provide a desktop-efficient content library, question editor/review surface, and practice-set composer in the staff navigation. At narrow widths, convert important tables to labelled rows or cards; maintain visible focus, keyboard access, text with status colour, and 48 by 48 CSS-pixel touch targets.
- Make required task metadata, answer policy, target vocabulary/grammar, media, provenance, and validation findings visible in the editor. Identify the specific field or asset that blocks review or publication rather than presenting a generic failure.
- Present separate visual workflow controls for question, media, and set versions. AI-originated drafts are visibly marked as drafts and display gateway kind, model, prompt/reference provenance, and output hash. Rejection preserves its recorded history; revision creates a new draft rather than changing a publication.
- Include phone-width preview before approval/publication, especially for image drafts. The preview must let staff verify image regions, audio controls, and answer options are usable at phone width.
- Keep content language neutral and non-official. Use original accessible learning media and calm product language; avoid reproducing protected assessment presentation or implying Cambridge endorsement.

## Cross-Story Dependencies

- Story 2.1 establishes the controlled targets, validation rules, and answer-policy semantics needed by drafting, validation, publication, scoring, and readiness.
- Story 2.2 creates the versioned question and media inputs that Story 2.3 validates and approves; AI actions depend on the separately closed provider gate and server-only gateway configuration.
- Story 2.3 supplies the blocking validation, review history, approval state, sanitisation, upload-safety outcomes, and phone preview required before Story 2.4 can publish.
- Story 2.4 creates the immutable published snapshots and authorised media references consumed by Epic 3 attempt preparation, player, deterministic scoring, answer review, and later teacher evidence. Its retirement semantics must preserve those downstream records.
- Story 2.5 reads the approved/published catalogue and composition rules from the prior stories to report readiness. `GATE-ACADEMIC-SOURCES` and `GATE-PUBLIC-WORDING` remain open for their stated external approval purposes; do not create public curriculum or alignment claims while they remain open.
