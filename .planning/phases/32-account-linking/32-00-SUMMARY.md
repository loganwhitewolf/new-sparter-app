---
phase: 32
plan: "00"
subsystem: testing
tags: [auth, oauth, testing, wave-0, vitest, playwright]
dependency_graph:
  requires: []
  provides:
    - "tests/connected-accounts-card.test.tsx (Wave 0 RED unit specs)"
    - "tests/account-linking.spec.ts (Wave 0 E2E navigation + fixme stubs)"
    - "tests/profile.spec.ts updated to /settings/profile routes"
  affects:
    - "Plan 01: /profile redirect must pass PROF-06 and LINK-04 /profile->settings/profile"
    - "Plan 02: ConnectedAccountsCard must satisfy unit tests in connected-accounts-card.test.tsx"
tech_stack:
  added: []
  patterns:
    - "renderToStaticMarkup unit testing (oauth-ui.test.tsx pattern)"
    - "test.fixme() stubs for live OAuth flows (auth.spec.ts pattern)"
    - "staging-key helper in Playwright specs (profile.spec.ts pattern)"
key_files:
  created:
    - tests/connected-accounts-card.test.tsx
    - tests/account-linking.spec.ts
  modified:
    - tests/profile.spec.ts
decisions:
  - "Wave 0 unit test will FAIL with Cannot find module until Plan 02 creates ConnectedAccountsCard — correct RED behavior"
  - "PROF-06 retains page.goto('/profile') to test compat redirect shim from Plan 01"
  - "PROF-04 assertion updated to /settings/profile per D-05 decision"
metrics:
  duration: "~3 minutes"
  completed_date: "2026-05-22"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 1
---

# Phase 32 Plan 00: Wave 0 Test Scaffolding Summary

**One-liner:** Wave 0 test stubs for ConnectedAccountsCard unit tests and account-linking E2E specs using renderToStaticMarkup and Playwright fixme patterns, plus profile.spec.ts retargeted to /settings/profile.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create tests/connected-accounts-card.test.tsx | dced606 | tests/connected-accounts-card.test.tsx |
| 2 | Create tests/account-linking.spec.ts | 7b6bfa1 | tests/account-linking.spec.ts |
| 3 | Retarget tests/profile.spec.ts to /settings/profile | 6732e26 | tests/profile.spec.ts |

## What Was Built

Three test files provide Wave 0 coverage for Phase 32:

1. **`tests/connected-accounts-card.test.tsx`** — Vitest unit specs using `renderToStaticMarkup` (same pattern as `oauth-ui.test.tsx`). Covers LINK-04 rendering (empty state, Google row, GitHub row, order) and LINK-04 initial state (Non collegato, D-12 email mismatch error, unknown error fallback). LINK-03 unlink guard has a placeholder test; richer behavior tests can be added in Plan 02 with `@testing-library/react`. Currently in RED state (correct Wave 0 behavior: `Cannot find module '@/components/profile/connected-accounts-card'`).

2. **`tests/account-linking.spec.ts`** — Playwright E2E spec with 12 tests. 4 automated navigation tests (LINK-04: settings hub render, hub links, `/settings/profile` card, `/profile` redirect). 8 fixme stubs for live OAuth operations (LINK-01 Google link, LINK-02 GitHub link + email mismatch, LINK-03 unlink + last-method guard). Uses staging-key helper pattern from profile.spec.ts.

3. **`tests/profile.spec.ts`** (updated) — 3 targeted edits: `openProfile()` helper and PROF-01 status test now navigate to `/settings/profile`; PROF-04 topbar assertion updated from `/\/profile/` to `/\/settings\/profile/`. PROF-06 unauthenticated redirect retains `page.goto('/profile')` to verify the compatibility shim added in Plan 01.

## Verification

- `yarn test tests/connected-accounts-card.test.tsx` — exits non-zero with `Cannot find package` only (correct Wave 0 RED; no syntax errors)
- `yarn playwright test --list tests/account-linking.spec.ts tests/profile.spec.ts` — 23 tests listed, 0 parse errors
- All 3 `must_haves.truths` satisfied

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None that block plan goal. The unit test file is intentionally in RED state until Plan 02 creates `components/profile/connected-accounts-card.tsx`. This is documented Wave 0 behavior per VALIDATION.md.

## Self-Check: PASSED

- `tests/connected-accounts-card.test.tsx` — FOUND
- `tests/account-linking.spec.ts` — FOUND
- `tests/profile.spec.ts` — MODIFIED (verified goto count: 2x /settings/profile, 1x /profile)
- Commits dced606, 7b6bfa1, 6732e26 — all in git log
