# Epic 2 Context: Safe Starters Practice Content

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Enable `academic_lead` and admin users to create, validate, review, phone-preview, approve, publish, retire, and assess the readiness of original, licensed, or approved generated Starters practice content. The workflow protects learners and the integrity of later scoring and evidence by requiring human-controlled, auditable, versioned content and media publication that produces immutable practice-set snapshots.

## Stories

- Story 2.1: Maintain Curriculum Targets And Answer Policies
- Story 2.2: Create Manual Or AI Content Drafts
- Story 2.3: Validate, Review And Phone-Preview Content
- Story 2.4: Publish Immutable Practice Sets
- Story 2.5: Verify Pilot Content Readiness

## Requirements & Constraints

- P0 content is Starters-only and supports exactly `picture_true_false`, `picture_yes_no`, `audio_picture_choice`, `audio_note_taking`, and `word_bank_cloze`; do not add other engines, speaking, a full mock, or protected assessment material.
- Only `academic_lead` and admin may author, validate, review, approve, publish, retire, compose, or request AI drafts. Teachers may read published content but cannot change it. Audit every content-status mutation, AI-draft request, review/approval, publication, and permitted exception without recording secrets, learner responses, answer keys, signed URLs, or raw audio.
- Maintain teacher-facing curriculum and assessment guidance with canonical, level-aware targets, topics, vocabulary/grammar controls, task formats, and versioned machine-readable answer policies. Policies must define normalisation and accepted-match semantics and include conformance vectors for every P0 engine input kind.
- Each draft must retain level, paper/part, task type, prompt/options, answer policy, primary objective, supporting curriculum tags, estimated duration, accessibility metadata, and immutable provenance. Content and media must be original, licensed, or approved generated; never copy or imitate protected Cambridge test text, images, scripts, audio, layouts, or answer keys.
- Validation before review or publication must emit named, publication-blocking findings for missing tags, answer keys/alternatives, required media, approved names/numbers, task-template limits, out-of-level vocabulary/grammar, provenance, sanitisation, upload safety, and accessibility. Staff rich text is sanitised; uploads require allowlisted type, size, integrity, and malicious-content checks.
- AI draft actions remain disabled until `GATE-AI-DRAFT-PROVIDER` is closed. The text gateway accepts text/image input and returns text; the image gateway accepts text/image input and returns an image. Send only approved guidance, content metadata, staff prompts, permitted reference images, and the draft under review, never learner or evidence data. Generated output remains a draft and always requires human review, approval, and publication.
- Public curriculum or alignment claims remain blocked by `GATE-ACADEMIC-SOURCES` and `GATE-PUBLIC-WORDING`. The closed content-plan decision requires individual academic-lead/admin approval, not a fixed item quota or self-approval exception.
- A publishable set is 5-10 minutes, contains one paper/part and one or two distinct primary objectives, and uses only published question/media versions. Essential media must be approved, authorised, and available before learner selection.
- The readiness view must report coverage by engine, paper/part, topic, vocabulary/grammar target, essential media, and duration; it must prove or flag whether varied 5-10 minute sets can be composed for each published topic/task-type choice, listing concrete gaps rather than inferring readiness from item totals.

## Technical Decisions

- Use separate explicit versioned lifecycles for question, media, and practice-set versions: `draft -> in_review -> approved -> published -> retired`. Rejection records actor, reason, and time, then creates a new editable draft version. Revisions never mutate published versions.
- Publication is a transactional use case: reject non-approved references, accept only published question/media versions, and atomically materialise immutable set-item snapshots. Snapshots contain rendered prompt/options, versioned answer policy, feedback, tags, role-scoped accessibility metadata, provenance, and write-once media object version/content hash. Retiring content prevents new publication/selection but preserves referenced active and completed attempts unchanged.
- PostgreSQL is authoritative for curriculum, content, media metadata, approval/version state, associations, provenance, and snapshots. Store media binaries in private S3-compatible object storage; issue short-lived authorised URLs only for published snapshots. Retain snapshot media while referenced by a publication or attempt.
- Apply shared Zod validation at every route/action boundary, authenticate and authorise each use case at the server boundary, and use reviewed ordered Drizzle migrations. Use an application use case as the transaction boundary; repositories do not create nested transactions.
- Persist lifecycle state as database enums or constraints and timestamps in UTC. TypeScript uses `camelCase`, database fields use `snake_case`, feature directories are singular kebab-case, and externally exposed IDs are opaque UUIDv7 values. Expected API failures use stable machine codes with `{ error: { code, message } }`.
- Use separate server-only configuration and API keys for the text and image gateways. Record gateway kind, endpoint identifier, model, input-prompt/reference provenance, output hash, and generated origin for every AI draft; explicitly handle either gateway failure.
- Never expose learner-facing accessibility text, transcripts, or labels that reveal an answer. There is no alternate accessible task variant: content requiring unusable essential media remains unavailable.

## UX & Interaction Patterns

- Provide a content library, question editor/review surface, and practice-set composer. Academic leads and admins can search and manage content; teachers see only published questions and sets.
- The editor presents required task metadata, answer policy, curriculum targets, media, provenance, accessibility information, and named validation findings. AI-created records visibly remain drafts and show gateway kind, model, prompt/reference provenance, and output hash.
- Present separate workflow controls for question, media, and set versions. Prevent transition when validation is blocking; make rejection history and the new draft version clear. Do not allow AI output to bypass validation, academic approval, or publication.
- Require a phone-width editor preview before image draft approval/publication. At desktop widths the editor includes a phone-width mode; verify image regions, audio controls, and answer options are usable on a phone.
- Editor/admin surfaces must work on tablets and be efficient on desktop; narrow views use card/list detail rather than mandatory horizontal scrolling. Meet WCAG 2.2 AA: visible text with status colour, keyboard-operable controls, visible focus, and at least 48 by 48 CSS-pixel touch targets.

## Cross-Story Dependencies

- Story 2.1 supplies the canonical curriculum target records, answer-policy semantics, and validation inputs consumed by draft creation, review, publication, deterministic scoring, and later evidence.
- Story 2.2 creates the versioned question/media drafts and provenance reviewed by Story 2.3. AI draft actions depend on closure of `GATE-AI-DRAFT-PROVIDER` and the separately configured server-only gateways.
- Story 2.3 must establish valid approved question/media versions, including phone-width image preview, before Story 2.4 can publish a set.
- Story 2.4 supplies immutable published set snapshots and essential media references for Epic 3 learner selection and preparation; retirement must not change Epic 3 attempts or Epic 4 evidence.
- Story 2.5 reads approved and published content, curriculum targets, media status, and composition rules established by Stories 2.1-2.4.
