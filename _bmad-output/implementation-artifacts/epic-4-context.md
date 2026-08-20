# Epic 4 Context: Teacher Evidence And Learner Guidance

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Enable teachers to inspect centre-wide submitted practice evidence, identify specific learner gaps, and drill into the immutable responses behind them. Academic leads and admins can resolve controlled responses that need human judgement, allowing current staff evidence and learner recommendations to reflect a justified effective outcome without changing the original submission, automatic score, or learner-visible result.

## Stories

- Story 4.1: View Centre-Wide Evidence And Actionable Gaps
- Story 4.2: Filter And Drill Down Into Learner Evidence
- Story 4.3: Resolve Uncertain Item Outcomes

## Requirements & Constraints

- Every signed-in teacher may read completed evidence for every learner; there is no cohort, class, or teacher-assignment scope. Teachers remain read-only for content and evidence. Only `academic_lead` and admin may resolve an outcome marked `needs_teacher_review`.
- Provide evidence filtering by learner, paper, part, vocabulary, grammar, spelling, names, numbers, colours, positions, topic, and practice set. Summary and learner-detail views must use the same semantics and allow drill-down to snapshot-based submitted responses, automatic/effective outcomes, timing, and playback events.
- Derive evidence states only from the latest submitted attempt of each practice set, for the selected paper/part and language target, within the fixed versioned 30-day window. Do not offer a teacher-selectable time range. Drill-down may show retained matching submissions outside the window without recalculating the state.
- State is `not assessed yet` with fewer than three assessable outcomes or when all matching outcomes are unresolved; it is `needs practice` below 60% correct, `building` from 60% to under 80%, and `secure` at 80% or above. Exclude unresolved `needs_teacher_review` outcomes from automatic correctness aggregates and never infer a weakness from no matching evidence.
- Present actionable guidance with the evidence state, paper/part, and relevant language target. Use only the product labels `secure`, `building`, `needs practice`, and `not assessed yet`; do not present official results, pass/fail language, or AI lesson recommendations.
- Audit every staff evidence read and mutation with actor, opaque target ID, time, and outcome. Preserve privacy: learners can access only their own records, and logs/audit data must not include learner responses, answer keys, signed URLs, raw audio, passwords, or session identifiers.
- A resolution must retain the automatic outcome, resolver, timestamp, and reason while adding immutable versioned effective-outcome history. A stale correction must preserve the prior resolution and return a stable conflict.

## Technical Decisions

- Implement evidence in the modular-monolith `evidence` feature. Routes and UI call application use-cases; cross-feature reads use typed query/use-case contracts rather than direct access to practice or scoring persistence.
- Evidence facts derive exclusively from immutable item snapshots and include learner, paper, part, language-target dimensions, topic, practice set, submitted time, automatic outcome, effective outcome, and effective-resolution version where applicable. Editable content must never alter evidence.
- The server authorises actor role and resource scope at every use-case boundary. Validate external inputs with shared Zod schemas. Expose opaque UUIDv7 IDs and use stable expected-failure responses shaped as `{ error: { code, message } }`.
- Deterministic scoring owns automatic outcomes. `effectiveOutcome` is the automatic outcome unless an immutable teacher resolution exists. Resolution requires the current resolution revision; a concurrent stale update returns `TEACHER_RESOLUTION_CONFLICT`.
- Resolution correction appends a new immutable version in a single transaction, then rebuilds affected item evidence, aggregates, and recommendations using that version. It must not alter automatic outcomes, submitted attempts, snapshots, learner-visible results, scores, or audit history.
- Persist timestamps in UTC and keep lifecycle/version state explicit in PostgreSQL. A use-case owns its transaction boundary; repositories do not start nested transactions. Structured logs use request ID, actor opaque ID, feature/action, outcome, and error code while omitting sensitive content.

## UX & Interaction Patterns

- Provide a teacher evidence dashboard and learner evidence detail. On desktop, allow summary and drill-down side by side; on tablet and narrow screens, use responsive cards or labelled rows instead of mandatory horizontal scrolling. Tables, filters, and drill-down rows must remain keyboard and touch operable.
- Evidence filters update summaries and drill-down together. The empty state says `No completed practice yet for this selection.` and offers filter reset without suggesting a learning deficiency. Explain `not assessed yet` as insufficient completed evidence.
- Teachers can inspect submitted controlled responses, attempt times, playback events, and items needing teacher review. Mark unresolved items as `Needs teacher review` and exclude them from automatic rate calculations.
- If a competing resolution is saved first, retain the existing resolution and offer a refresh/retry path. Keep state text visible alongside colour, maintain visible focus, and meet WCAG 2.2 AA with at least 48 by 48 CSS-pixel touch targets.
- Use concise, neutral practice language such as `Needs practice: numbers in Listening Part 2.` Never use shame, rankings, certificates, or official-result wording.

## Cross-Story Dependencies

- Stories 4.1 and 4.2 consume the immutable submitted responses, automatic outcomes, timing, playback events, answer-policy versions, and curriculum tags created by Epic 3 finalisation against Epic 2 published snapshots.
- Story 4.1 establishes centre-wide projections and the fixed evidence-state rule that Story 4.2 must apply consistently in filtering and drill-down.
- Story 4.3 updates the effective-outcome version used by evidence aggregates and Epic 3 recommendations, but must preserve the learner's submitted result and all automatic evidence history.
- Account roles, server-side staff authorisation, and evidence-read audit infrastructure from Epic 1 are prerequisites for all Epic 4 stories.
