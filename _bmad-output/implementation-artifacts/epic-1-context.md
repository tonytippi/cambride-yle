# Epic 1 Context: Centre-Managed Accounts And Access

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Establish the secure, centre-managed identity foundation for P0: an operator can initialise the first admin only in local or staging, admins can provision and manage authorised roles, and each user can sign in to only the capabilities and records permitted to them. Deactivation must reliably end access without losing retained practice evidence, so subsequent learner practice, content, teacher evidence, and supervised first-practice work can safely build on the same account lifecycle.

## Stories

- Story 1.1: Establish The Application Foundation
- Story 1.2: Manage Centre Accounts And Roles
- Story 1.3: Admin-Created Accounts And Secure Sign-In
- Story 1.4: Deactivate A Centre Account

## Requirements & Constraints

- Support only centre-admin-created `learner`, `teacher`, `academic_lead`, and `admin` accounts; P0 has no self-registration, parent account, cohort/class, teacher-assignment, or public setup flow.
- Initialise the first active admin through an operator-only local/staging bootstrap driven by server configuration validated at startup. Disable it permanently once any account exists.
- Let admins view account role and activation status, create accounts, provision sign-in access, and change roles. Do not permit a role mutation or deactivation that would leave no active admin; return stable `LAST_ACTIVE_ADMIN` with no state or session change.
- Enforce permissions on the server. Learners may access only their own practice choices, attempts, and results. Teachers may read published content and centre-wide detailed learner evidence but cannot modify content. `academic_lead` has content-authoring and publication capabilities; admins have all P0 permissions and manage roles.
- Authenticate active accounts with Argon2id password hashes, opaque Secure HttpOnly SameSite=Lax sessions, generic indistinguishable failures for invalid, unknown, and deactivated credentials, and throttled login attempts. Protected access must not be granted by browser navigation alone.
- On named, explicit admin confirmation, deactivate by recording `deactivated_at` and `deactivated_by`, revoking active sessions, and blocking future authentication and authorisation. Retain practice and first-practice records indefinitely; do not implement account deletion, expiry, purge, or irreversible removal.
- Audit account mutations, deactivation, and every staff evidence read or mutation. Audit and structured logs must exclude passwords, session identifiers, learner responses, answer keys, signed media URLs, and raw audio; deactivation audit data contains actor, action, target opaque ID, and time only.
- Use minimum account profile data needed for centre operation. Submitted attempts, snapshots, scores, and audit records are not altered by correction handling.
- Provide responsive staff administration that is usable on tablets and efficient on desktop, with WCAG 2.2 AA focus, keyboard, contrast, and non-colour state requirements. Production requires HTTPS; deployment specifics remain gated separately.

## Technical Decisions

- Build as a Next.js App Router TypeScript modular monolith. Place account, session, and actor-authorisation work in `identity`; UI routes and transport invoke application use-cases, not persistence directly. Cross-feature reads use typed source-feature query/use-case contracts.
- Every use-case receives an authenticated actor and authorises both role and resource scope before any read or mutation. All mutation handlers authenticate, authorise, validate external input with shared Zod schemas, invoke one use-case, and audit the change.
- Use PostgreSQL as the system of record. Ship schema changes as reviewed, ordered Drizzle migrations before rollout; persist UTC `timestamptz`, use explicit database state constraints, and expose opaque UUIDv7 IDs rather than database identifiers.
- Treat role mutation and deactivation as admin-only transactions that lock the active-admin set. A use-case owns its transaction boundary; repositories do not open nested transactions.
- Return `{ data }` for success and `{ error: { code, message } }` for expected failures. Preserve stable machine codes and never reveal account existence through authentication errors.
- Use structured logs with request ID, actor opaque ID, feature/action, outcome, and error code. Validate environment configuration at startup; keep secrets server-only.
- The foundation includes a health endpoint, HTTPS-ready security headers, separate local/staging/production databases, secrets, and cache names. Production rollout requires migrations first, health checks, and structured error monitoring; concrete deployment choices await the deployment gate.

## UX & Interaction Patterns

- Show a role-appropriate home after sign-in. Use a simple learner header; staff surfaces use labelled desktop left-rail navigation and a labelled narrow-screen menu. Do not expose surfaces outside the current role.
- On a protected-route denial, redirect to the user's role home and state: `You do not have access to that page.` Keep dialogs non-stacked.
- Account administration presents current role and status. Deactivated-account sign-in receives a generic failure, while the admin account detail shows deactivated status and audit history.
- The deactivation dialog is a staff-only destructive action: show the named account and clear consequences that sign-in stops while P0 records are retained, require explicit named confirmation, and never describe it as deletion or purge. If it is the final active admin, explain that another admin must first be active and leave the account unchanged.
- Use calm, literal British English with no official-result, punitive, or game-like language. Staff layouts use responsive frames and convert important narrow table views to labelled rows or cards; all controls have visible focus, keyboard operation, text-labelled state, and at least 48 by 48 CSS-pixel touch targets.

## Cross-Story Dependencies

- Story 1.1 provides the application, configuration, database migration, audit, and responsive design substrate needed by Stories 1.2-1.4.
- Story 1.2 establishes account roles and active-admin protection used by sign-in and deactivation in Stories 1.3-1.4.
- Story 1.3 establishes authenticated actors and sessions that every protected capability in later epics must use; Story 1.4 revokes those sessions and preserves the retained account evidence that later teacher-evidence and first-practice flows consume.
