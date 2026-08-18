---
title: 'Story 1.1: Establish The Application Foundation'
type: 'feature'
created: '2026-08-18'
status: 'done'
baseline_commit: '651018014928737d70b8b1c666d7ad0f632897ec'
review_loop_iteration: 0
context:
  - '_bmad-output/implementation-artifacts/epic-1-context.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-CambridgeYLE-2026-08-17/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The repository contains the approved P0 planning suite but no runnable application, data-access boundary, operational health check, or test harness. Later account, content, practice, and evidence stories need a secure, accessible, deployable foundation rather than independent setup choices.

**Approach:** Create the prescribed Next.js/TypeScript modular-monolith baseline with validated server configuration, PostgreSQL/Drizzle migration discipline, safe observability, health and security endpoints, and the responsive visual-token base. Add focused automated checks that prove these foundations without introducing account or product workflows.

## Boundaries & Constraints

**Always:** Use the approved Node 24, Next.js App Router, React, TypeScript, Tailwind, PostgreSQL, Drizzle, Zod, Vitest, and Playwright stack; structure product code under the architecture seed; validate server environment at startup; return health data without secrets; set HTTPS-ready security headers; use ordered reviewed migrations; retain British English in product-facing and technical strings; apply DESIGN.md tokens, visible `#8A5200` focus treatment, responsive 16px/32px gutters, and 48px minimum interactive targets. Structured logs must contain request ID, actor opaque ID where available, feature/action, outcome, and error code, while never serialising passwords, session IDs, learner responses, answer keys, signed URLs, raw audio, or environment secrets.

**Ask First:** Halt before changing the approved runtime stack, enabling a cloud provider or production deployment, adding secret values, enabling AI gateways, or adding a public route other than the non-sensitive health check.

**Never:** Implement authentication, accounts, sessions, self-registration, content authoring, PWA caching, learner attempts, or deployment-provider selection. Do not use schema push/synchronisation in place of reviewed Drizzle migrations, expose configuration/secrets through browser code or health responses, or claim production readiness.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Healthy runtime | Required server configuration is present and database is reachable | `GET /api/health` returns a stable JSON `{ data }` health response with no secret fields | Returns a non-cacheable 503 `{ error: { code, message } }` if dependency health fails |
| Invalid startup configuration | Required environment variable is missing or malformed | Server configuration fails validation before application services use it | Error identifies configuration keys only; never emits supplied secret values |
| Sensitive log input | Log metadata contains protected field names or nested protected values | Structured event retains safe operational fields and redacts protected values | Logger must not throw while redacting malformed metadata |
| Database evolution | Initial schema is changed after baseline | Changes are represented by a new ordered Drizzle SQL migration | CI/local migration command detects configuration or database failure rather than silently synchronising |

</frozen-after-approval>

## Code Map

- `_bmad-output/implementation-artifacts/epic-1-context.md` -- compiled Epic 1 constraints; Story 1.1 is the dependency foundation for Stories 1.2 and 1.3.
- `_bmad-output/planning-artifacts/architecture/architecture-CambridgeYLE-2026-08-17/ARCHITECTURE-SPINE.md:49-53,97-101,127-182` -- mandatory modular-monolith layout, Zod boundary/configuration, logging convention, stack, and structural seed.
- `_bmad-output/planning-artifacts/ux-designs/ux-CambridgeYLE-2026-08-17/DESIGN.md:9-84,108-112` -- canonical colour, typography, spacing, responsive-gutter, focus, radius, and target-size tokens.
- `package.json` -- new root product manifest and reproducible development, test, lint, build, database migration, and browser-test scripts; `.opencode/package.json` is tooling only and must not be used.
- `src/app/`, `src/shared/`, `src/infrastructure/`, `src/features/`, `db/`, `tests/` -- new architecture-seed directories; no existing product implementation is present.
- `_bmad-output/implementation-artifacts/sprint-status.yaml:39-43` -- Story key `1-1-establish-the-application-foundation` currently backlog; workflow must sync it without changing unrelated statuses.

## Tasks & Acceptance

**Execution:**
- [x] `package.json`, lockfile, `tsconfig.json`, `next.config.*`, Tailwind/PostCSS configuration, `.env.example`, and project ignore files -- establish a pinned, reproducible Next.js TypeScript toolchain with explicit local commands and a server-only configuration contract.
- [x] `src/shared/config/server.ts`, `src/shared/logging/logger.ts`, `src/shared/http/*` -- implement eager Zod configuration validation, safe structured logging/redaction, common response/error helpers, request IDs, no-store responses, and security-header policy.
- [x] `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css` -- provide the responsive, accessible application shell using the approved visual tokens and visible keyboard focus baseline.
- [x] `src/app/api/health/route.ts` and infrastructure database health adapter -- expose a minimal dependency-aware health endpoint through the common response contract without exposing internals or credentials.
- [x] `db/schema/*`, `db/migrations/*`, `drizzle.config.*`, `src/infrastructure/database/*` -- define an initial PostgreSQL baseline, typed Drizzle connection boundary, and committed ordered migration workflow; include no identity/product tables beyond what is indispensable for an empty baseline.
- [x] `tests/unit/*`, `tests/integration/*`, `tests/e2e/*`, Vitest/Playwright configuration -- verify configuration validation, redaction, headers/health response, migration path, and keyboard focus/responsive shell baseline.

**Acceptance Criteria:**
- Given a new local or staging environment with valid configuration, when the application starts, then it runs as the prescribed Next.js/TypeScript modular monolith with a health endpoint and HTTPS-ready security headers.
- Given application configuration is absent, malformed, or includes secret values, when the server starts or logs validation failure, then startup fails safely and neither output nor structured logs reveal secret values.
- Given the health route is requested, when the database is available, then it returns the documented success envelope and security/no-store headers; when the dependency is unavailable, it returns a stable error envelope without stack traces or credentials.
- Given a schema baseline or later schema change, when migrations run, then Drizzle applies committed ordered SQL migrations rather than schema push and application code accesses PostgreSQL through the typed infrastructure boundary.
- Given keyboard navigation through the base page, when focus reaches an interactive control on mobile or desktop widths, then the focus indicator is visible with the DESIGN focus token and controls meet the 48px minimum target where interactive.
- Given operational events include protected data, when they are logged, then redaction prevents protected values from reaching output while safe request, actor, feature/action, outcome, and error-code fields remain queryable.

## Design Notes

The foundation must create stable seams, not pre-implement later domains. Keep the root screen intentionally minimal: it demonstrates the visual system and accessible focus treatment while authentication owns the actual entry screen in Story 1.2. Treat the health route as an operational interface, not a public product API: it has no account, curriculum, or deployment information.

## Verification

**Commands:**
- `npm run lint` -- expected: static checks pass without warnings treated as errors.
- `npm run typecheck` -- expected: TypeScript validates the application and test boundaries.
- `npm test` -- expected: unit and integration checks pass, including configuration, redaction, health, and headers.
- `npm run test:e2e` -- expected: browser checks confirm accessible visible focus and responsive base shell.
- `npm run db:migrate` -- expected: applies committed Drizzle migrations to the configured disposable/local PostgreSQL database; no schema-push command is used.
- `npm run build` -- expected: production build completes with configuration documented for build-time validation.

## Suggested Review Order

**Runtime Boundary**

- Validate server configuration once, with safe errors that omit secret values.
  [`environment.ts:3`](../../src/shared/config/environment.ts#L3)

- Keep browser code from importing parsed server configuration.
  [`server.ts:1`](../../src/shared/config/server.ts#L1)

**Operational Safety**

- Redact protected metadata while retaining structured operational fields.
  [`logger.ts:4`](../../src/shared/logging/logger.ts#L4)

- Return health state safely and record dependency outcomes.
  [`route.ts:5`](../../src/app/api/health/route.ts#L5)

- Apply HTTPS-ready headers and permit the isolated development test origin.
  [`next.config.ts:3`](../../next.config.ts#L3)

**Browser Verification**

- Run this application on an isolated port with an explicit Chrome executable.
  [`playwright.config.ts:3`](../../playwright.config.ts#L3)

- Verify responsive gutters and keyboard focus in the real browser.
  [`foundation.spec.ts:3`](../../tests/e2e/foundation.spec.ts#L3)

### Review Findings

- [x] [Review][Patch] Fail server configuration during application startup [next.config.ts:4] — resolved by parsing the server configuration while Next loads its configuration; an invalid `DATABASE_URL` now stops `next start` before the server is usable.
- [x] [Review][Patch] Prevent sensitive values from escaping generic log metadata [src/shared/logging/logger.ts:36] — resolved by emitting only the defined operational fields and omitting arbitrary metadata from application logs.
- [x] [Review][Patch] Cancel or isolate timed-out database health work [src/infrastructure/database/health.ts:5] — resolved by using and force-closing a dedicated one-connection client for each probe, so a stalled health query cannot occupy the application pool.
- [x] [Review][Patch] Exercise the real operational boundaries in automated tests [tests/e2e/foundation.spec.ts:17] — resolved with browser assertions against served security headers and an actual `npm run db:migrate` verification against the configured local PostgreSQL database.
- [x] [Review][Patch] Align declared dependencies with the approved architecture stack [package.json:21] — resolved by the approved architecture correction: TypeScript 5.9.3 and Tailwind CSS 3.4.17 are the verified P0 baseline; other compatible dependencies remain at the approved versions.
