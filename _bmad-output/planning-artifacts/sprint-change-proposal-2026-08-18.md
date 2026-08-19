# Sprint Change Proposal: Verified P0 Toolchain Baseline

**Date:** 2026-08-18

## 1. Issue Summary

Story 1.1 implementation exposed an architecture-stack conflict. The architecture specified TypeScript 7.0.2 and Tailwind CSS 4.3.3, but TypeScript 7.0.2 caused the selected Next.js ESLint toolchain to fail with `typescript-eslint does not support TS 7.0`; Tailwind 4 requires a separate configuration migration. The reviewed, working P0 implementation uses TypeScript 5.9.3 and Tailwind CSS 3.4.17.

## 2. Impact Analysis

- **Epic impact:** Epic 1 scope, story order and acceptance criteria remain unchanged. Story 1.1 can complete once the technical contract reflects the verified baseline.
- **Future-story impact:** Stories 1.2 onward retain the same Next.js/TypeScript modular-monolith foundation. No new story or epic is required.
- **PRD impact:** None. Product scope, functional requirements, non-functional requirements and decision gates are unaffected.
- **Architecture impact:** Update the Stack table and record the compatibility rule for future TypeScript/Tailwind upgrades.
- **UX impact:** None. Design tokens, responsive behaviour and WCAG requirements are unchanged.
- **Technical evidence:** `lint`, `typecheck`, unit/integration tests, browser tests and Drizzle migration passed with the verified baseline. TypeScript 7.0.2 failed lint due to unsupported `typescript-eslint` compatibility.

## 3. Recommended Approach

**Direct adjustment, minor scope.** Amend the architecture contract to match the verified P0 toolchain, then close Story 1.1 and its final review finding.

This avoids an unnecessary rollback or MVP replan. It keeps the approved product, architecture pattern, database boundary and P0 scope intact. The change has low effort and low delivery risk.

## 4. Detailed Change Proposals

### Architecture

**File:** `_bmad-output/planning-artifacts/architecture/architecture-CambridgeYLE-2026-08-17/ARCHITECTURE-SPINE.md`

```diff
- | TypeScript | 7.0.2 |
+ | TypeScript | 5.9.3 |
...
- | Tailwind CSS | 4.3.3 |
+ | Tailwind CSS | 3.4.17 |
```

Add a compatibility rule: TypeScript 5.9.3 and Tailwind CSS 3.4.17 are the P0 baseline. Upgrade either only through a reviewed compatibility change that includes configuration migration where needed and proves lint, typecheck, unit/integration tests, production build and browser tests. TypeScript 7.0.2 remains deferred because the selected Next.js ESLint toolchain does not support it.

### Story And Sprint Tracking

**Files:**

- `_bmad-output/implementation-artifacts/spec-1-1-establish-the-application-foundation.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

Close the final dependency-stack review finding, set Story 1.1 to `done`, and update its sprint status to `done`. Epic 1 remains `in-progress`; Story 1.2 remains `backlog`.

## 5. Implementation Handoff

**Classification:** Minor

**Recipient:** Developer

**Responsibilities:** Apply the three approved document/tracking changes, run the foundation verification suite, and commit the correction.

**Success criteria:**

- Architecture declares the tested P0 TypeScript/Tailwind baseline and future-upgrade verification rule.
- Story 1.1 has no remaining review action items and is marked `done`.
- Sprint tracking records Story 1.1 as `done` without changing Epic 1 or Story 1.2 status.
- `lint`, `typecheck`, tests, browser tests and migrations pass.

**Approved:** 2026-08-18 by project owner.
