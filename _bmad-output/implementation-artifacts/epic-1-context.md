# Epic 1 Context: Centre-Managed Accounts And Access

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Establish the secure, deployable application and centre-managed identity foundation so authorised users can sign in to the correct role-specific experience, learners are confined to their own records, and administrators can safely manage access. This protects child data, enables all later product capabilities to rely on server-enforced authorisation, and preserves operational records when access ends.

## Stories

- Story 1.1: Establish The Application Foundation
- Story 1.2: Admin-Created Accounts And Secure Sign-In
- Story 1.3: Deactivate A Centre Account

## Requirements & Constraints

- Use a responsive Next.js/TypeScript application with startup-validated server configuration, a health endpoint, HTTPS-ready security headers, PostgreSQL, reviewed ordered Drizzle migrations, and structured logs that omit secrets and learner responses.
- Only administrators create and provision `learner`, `teacher`, `academic_lead`, and `admin` accounts; self-registration is out of scope.
- Authenticate local credentials using Argon2id password hashes and opaque server-side sessions in Secure, HttpOnly, SameSite=Lax cookies. Unknown, invalid, and deactivated credentials must receive the same generic failure; throttle sign-in attempts.
- Enforce authorisation server-side for every read and mutation. Navigation or hidden UI must never grant access. Learners access only their own choices, attempts, and results. Staff have centre-wide detailed evidence access; teachers are read-only for published content and evidence, academic leads manage content, and admins hold all P0 permissions and manage roles. There is no cohort, class, or teacher-assignment scope.
- Audit account changes, deactivation, staff evidence reads, and staff mutations. Audit and application logs must use opaque target/actor identifiers where applicable and never contain passwords, session identifiers, learner responses, answer keys, signed URLs, or raw audio.
- Account role mutation and deactivation are admin-only transactions. They must leave at least one active admin: return stable `LAST_ACTIVE_ADMIN` without changing state or revoking sessions if the requested change would remove the final active admin.
- Named, explicitly confirmed deactivation sets `deactivated_at` and `deactivated_by`, revokes active sessions, and blocks future authentication and authorisation. Practice and first-practice records are retained indefinitely; P0 does not delete, purge, or automatically expire accounts or their records. Submitted attempts, snapshots, scores, and audit records remain immutable.
- Collect only the account profile data needed for centre operations. No speaking recordings or parent/guardian-confirmation workflow are in P0.
- Meet WCAG 2.2 AA and use British English in technical artefacts and product copy.

## Technical Decisions

- Build as a Next.js modular monolith with ports and adapters. Place identity capability code under `src/features/identity/{domain,application,infrastructure,ui}`; routes and UI invoke application use-cases rather than embedding business rules. Use typed source-feature query/use-case contracts for cross-feature access.
- Each use-case owns its transaction boundary; repositories do not start nested transactions. Validate external input at route/action boundaries with shared Zod schemas.
- Use PostgreSQL as the authoritative store. Persist UTC `timestamptz`; use explicit database enums or check constraints for lifecycle state. Expose opaque UUIDv7 identifiers outside the database. TypeScript uses `camelCase`, database fields use `snake_case`.
- Route handlers return `{ data }` on success and `{ error: { code, message } }` for expected failure. Use stable machine codes and do not disclose account existence through authentication responses.
- Structured logs include request ID, actor opaque ID, feature/action, outcome, and error code. Environment variables are parsed at startup and secret configuration remains server-only.

## UX & Interaction Patterns

- Provide a sign-in surface for centre-created accounts and route each authenticated user to their role-appropriate home. On protected-route denial, redirect to that role's home and state: `You do not have access to that page.`
- Use a labelled left rail for teacher, academic lead, and admin navigation on desktop, changing to a labelled menu sheet on narrow screens. Show only role-permitted surfaces; do not stack dialogs.
- The admin account interface supports account creation, role/status management, and deactivation. Deactivation is never a swipe or delete action: its danger-styled dialog requires the account identifier and clear text that sign-in stops while P0 records are retained.
- When the final active admin cannot be deactivated or demoted, leave the account unchanged and explain that another admin must first be active. For a deactivated account, sign-in shows only the generic failure while the admin detail shows deactivated status and audit history.
- Preserve visible focus, keyboard access, text alongside state colour, and minimum 48 by 48 CSS-pixel touch targets. Admin surfaces use responsive content frames and convert key tables into labelled rows or cards on narrow screens.

## Cross-Story Dependencies

- Story 1.1 supplies the runtime, schema migration, logging, security-header, and design-token foundation required by Stories 1.2 and 1.3.
- Story 1.2 establishes authenticated actors, sessions, roles, and server-side authorisation consumed by all later epics.
- Story 1.3 provides the standard deactivation flow reused by supervised first practice and must coordinate with browser-side sign-out/deactivation cleanup implemented with learner PWA behaviour.
