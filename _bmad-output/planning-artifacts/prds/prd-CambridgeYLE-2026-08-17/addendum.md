# CambridgeYLE P0 PRD Addendum

## Technical Delivery Constraints

The P0 architecture is a modular monolith with ports and adapters in a single Next.js deployment. It uses PostgreSQL as the system of record, private S3-compatible object storage for media, and browser storage only for PWA shell/assets and recoverable open-attempt drafts.

The expected feature boundaries are identity, cohorts, curriculum, content, practice, scoring, evidence, diagnostics, shared contracts, infrastructure, and PWA. UI routes and transport call application use-cases; feature cross-reads use typed feature query/use-case contracts rather than direct database table access.

External input is validated at the boundary. Mutations authorize actor and resource scope, invoke one application use-case, and audit designated actions. Database changes ship as reviewed ordered migrations.

## Integrity Rules

- The server, not the browser, creates/finalizes attempts, scores responses, projects evidence, and releases answer review after submission.
- Submission runs in one transaction using an idempotency key. Repeating the same key returns the saved result; post-submit writes are rejected.
- Published practice sets contain immutable item snapshots. Snapshot media is write-once and retained while referenced by a publication or attempt.
- Deterministic scoring consumes only the snapshot answer policy, including normalization, accepted answers, and uncertainty behavior.
- Application browser caches exclude answer-review, result, and teacher-evidence data. IndexedDB stores only local open-attempt drafts.
- Deactivation revokes sessions and blocks access while retaining records in P0. Audit records hold actor, action, opaque target ID, and timestamp, not learner answer content.

## Source Artifacts

- `../../../specs/spec-cambridgeyle-p0/SPEC.md` is the current canonical build contract.
- `../../architecture/architecture-CambridgeYLE-2026-08-17/ARCHITECTURE-SPINE.md` defines architecture invariants and implementation stack.
- `../../ux-designs/ux-CambridgeYLE-2026-08-17/EXPERIENCE.md` and `DESIGN.md` define user behavior and visual direction.
- `../../../../docs/starters-curriculum-and-assessment-blueprint.md` defines assessment/content constraints.
- `../../epics.md` decomposes the current P0 scope into build stories.
