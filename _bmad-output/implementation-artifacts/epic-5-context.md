# Epic 5 Context: Supervised First Practice

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Enable centre staff to run a prospective learner's first supervised practice using the existing published self-directed practice journey, inspect the resulting implemented-part evidence, and remove future access when appropriate. This supports a placement conversation while preserving the P0 boundary: it is neither public acquisition nor a separate diagnostic or scoring product.

## Stories

- Story 5.1: Set Up A Supervised First Practice Session
- Story 5.2: Review First-Practice Evidence And Deactivate Access

## Requirements & Constraints

- Only an admin may provision the prospective learner account and initiate the supervised session. Accounts are centre-created; do not add self-registration, parent/guardian confirmation, public acquisition, admissions, payment, or checkout flows.
- Reuse the standard learner account, published-set selection, immutable snapshot, attempt, submission, result, and review flows. Do not create a dedicated first-practice or diagnostic template, assignment, score, or placement algorithm.
- The account record must show its creation date and active/deactivated status. Collect only the centre-approved minimum account profile.
- Authorised staff may inspect submitted first-practice evidence through the normal teacher evidence surfaces, limited to implemented parts. Staff evidence reads must be audit logged; learner accounts remain limited to their own records.
- Use neutral practice language throughout. Results and evidence support a placement conversation but must never be presented as official exam results or use pass/fail, certificate, or official-score language.
- Account deactivation is an admin-only named, explicit confirmation. It revokes active sessions and blocks later authentication and authorisation, while retaining practice and first-practice records indefinitely. Do not implement automatic expiry, deletion, purge, or mutation of submitted attempts, snapshots, scores, or audit history.
- A request that would deactivate the final active admin must fail with `LAST_ACTIVE_ADMIN`, leaving account state and sessions unchanged. Audit events for deactivation and staff evidence access must exclude learner response content.

## Technical Decisions

- Implement the capability at the existing `first-practice` boundary, composing typed use-case/query contracts from `identity`, `practice`, and `evidence` rather than reading another feature's database tables directly.
- Every route or action must validate external input, authenticate the actor, and authorise role and resource scope server-side. UI visibility alone is not authorisation.
- A supervised learner starts only from a published set version. Attempt creation revalidates learner authorisation, snapshot state, and essential media availability atomically; the server owns attempt creation, finalisation, scoring, evidence projection, and answer-review release.
- Submitted evidence must continue to derive from immutable item snapshots. Evidence states use the fixed 30-day, latest-submitted-attempt rule and exclude unresolved outcomes; staff drill-down may show retained matching submissions outside that window without recalculating the state.
- Deactivation is one server transaction: lock the active-admin set, enforce the final-admin guard, record `deactivated_at` and `deactivated_by`, revoke sessions, and write minimal audit metadata with actor, action, opaque target ID, and timestamp.
- Purge only the deactivated account's authorised media and local draft namespace on account transition. Do not cache API, HTML/document, result, answer-review, evidence, or signed-URL responses.

## UX & Interaction Patterns

- Provide first-practice setup in admin navigation. Teacher/admin navigation uses a labelled desktop rail and labelled narrow-screen menu; show surfaces only to permitted roles and do not stack dialogs.
- The admin helps the prospective learner choose an existing published practice set, then the learner completes the familiar focused practice flow.
- Present resulting evidence in the ordinary teacher dashboard/detail experience. Empty evidence must say that no completed practice exists rather than inferring a learning level.
- The deactivation dialog must identify the account by name, explain that sign-in will stop and P0 records remain retained, require explicit named confirmation, and use destructive styling. It must not imply deletion and must never appear in learner flows.
- Preserve responsive and accessible interaction standards: keyboard-operable controls, touch targets of at least 48 by 48 CSS pixels, clear focus, and a mobile-appropriate navigation/menu treatment.

## Cross-Story Dependencies

- Story 5.1 depends on centre-managed account creation and role enforcement, published practice-set availability, and the learner preparation, attempt, submit, and review journey.
- Story 5.2 depends on submitted evidence projection and teacher evidence access from Epic 4, plus the shared account-deactivation transaction and session revocation from Epic 1.
