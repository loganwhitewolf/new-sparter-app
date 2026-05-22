---
phase: 31-oauth-ui
plan: "01"
subsystem: auth-ui-tests
tags: [oauth, tests, vitest, playwright, tdd, wave-0]
dependency_graph:
  requires: []
  provides:
    - tests/oauth-ui.test.tsx (Vitest unit spec — RED gate for Plan 02)
    - tests/auth.spec.ts OAUTH stubs (Playwright traceability stubs for OAUTH-01..04)
  affects:
    - Plan 02 (uses yarn test tests/oauth-ui.test.tsx as task verify command)
tech_stack:
  added: []
  patterns:
    - Vitest + renderToStaticMarkup (same as deviation-badge.test.tsx pattern)
    - vi.mock hoisted before dynamic import (prevent real OAuth calls in tests)
    - Playwright test.fixme() stubs for manual-only real-provider e2e flows
key_files:
  created:
    - tests/oauth-ui.test.tsx
  modified:
    - tests/auth.spec.ts
decisions:
  - "Wave 0 test-first: unit spec written against component interface contract before component exists (TDD RED gate)"
  - "vi.mock auth-client hoisted to prevent real OAuth redirects in Vitest environment"
  - "OAUTH-01..04 are test.fixme stubs — real provider credentials required, no CI automation possible"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-21"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 31 Plan 01: Wave 0 Test Scaffolding Summary

**One-liner:** Vitest RED gate + Playwright fixme stubs for SocialProviderButtons, getOAuthErrorMessage, and OAUTH-01..04 real-provider flows.

## What Was Built

### Task 1 — tests/oauth-ui.test.tsx (commit 728d419)

Created a failing Vitest unit spec that encodes the full behavioral contract for two exports that Plan 02 will create:

- `SocialProviderButtons` — 4 assertions covering empty providers (renders nothing), Google-only, GitHub-only, and Google-before-GitHub order (D-03)
- `getOAuthErrorMessage` — 5 assertions covering null for undefined, null for empty string, OAuthCallbackError mapping, access_denied mapping, and generic fallback for unknown codes (D-08)

The spec uses `renderToStaticMarkup` from `react-dom/server` (same pattern as `deviation-badge.test.tsx`) and hoists a `vi.mock` for `@/lib/auth-client` before the dynamic import to prevent any real OAuth redirect calls during test execution (T-31-01-01 threat mitigation).

**RED state confirmed:** `yarn test tests/oauth-ui.test.tsx` exits non-zero with `Cannot find package '@/components/auth/social-provider-buttons'`.

### Task 2 — tests/auth.spec.ts (commit 0045566)

Appended a new `test.describe('Auth - OAUTH-01..04: Social providers', ...)` block at the end of the existing Playwright spec. Four `test.fixme()` stubs added:

- `OAUTH-01`: existing Google user signs in and lands on /dashboard
- `OAUTH-02`: new Google user auto-creates account on first login
- `OAUTH-03`: existing GitHub user signs in and lands on /dashboard
- `OAUTH-04`: new GitHub user auto-creates account on first login

All existing AUTH-01..03 describe blocks are untouched (additions only — zero deletions confirmed by `git diff`).

## Deviations from Plan

None — plan executed exactly as written.

The only operational note: the worktree had no `node_modules` (Yarn workspaces with `nodeLinker: node-modules` and a separate `.yarnrc.yml`). `yarn install` was run in the worktree before executing the test verify step. This is a standard worktree initialization step, not a plan deviation.

## Verification

- `yarn test tests/oauth-ui.test.tsx` exits non-zero (red — component does not exist): CONFIRMED
- `yarn playwright test tests/auth.spec.ts --list` enumerates 4 new OAUTH stubs: CONFIRMED (chromium lists OAUTH-01..04)
- `git diff --stat tests/auth.spec.ts` shows additions only (0 deletions): CONFIRMED

## Known Stubs

None — both files are test infrastructure only, not production UI. The Playwright stubs are intentional `test.fixme()` (require real OAuth provider credentials; resolved when manual e2e is run post-deploy).

## Threat Flags

None — plan writes only test files, no production runtime surface introduced.

## Self-Check: PASSED
