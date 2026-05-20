---
phase: "17"
plan: "02"
---

# T02: Centralized category-surface cache invalidation in a server-only helper and removed the stale `/categories` navigation entry from desktop and mobile shells.

**Centralized category-surface cache invalidation in a server-only helper and removed the stale `/categories` navigation entry from desktop and mobile shells.**

## What Happened

Added `APP_ROUTES.categorySettings` and a new server-only `revalidateCategorizationSurfaces()` helper that owns the five-route categorization cache contract. Replaced successful-path `revalidatePath` calls in expense, transaction, and pattern Server Actions with the shared helper while preserving validation/auth/not-found/caught-error early returns before revalidation. Removed the dead Categories item from the sidebar and bottom nav, including the now-unused tag/badge/count code. Updated pattern action tests so existing unit coverage also asserts the exact all-route revalidation contract.

## Verification

Ran the required focused Vitest suite for categorization and pattern actions; all 37 tests passed, including success-route and negative no-revalidation paths. Ran the required Playwright layout grep for categories navigation; both desktop sidebar and mobile bottom-nav absence checks passed. Ran the project language convention check; it passed. Also ran a source scan confirming literal `/categories` remains only in absence tests and touched action files call `revalidatePath` only via `lib/actions/revalidation.ts`.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest run tests/categorization-revalidation-actions.test.ts tests/pattern-actions.test.ts --reporter=verbose` | 0 | ✅ pass — 2 files, 37 tests passed | 860ms |
| 2 | `yarn playwright test tests/layout.spec.ts --grep "categories|/categories" --reporter=list` | 0 | ✅ pass — 2 Chromium tests passed | 2555ms |
| 3 | `yarn check:language` | 0 | ✅ pass — English code convention check passed | 720ms |
| 4 | `rg "'/categories'|\"/categories\"" lib components tests -n; rg "revalidatePath\(" lib/actions/expenses.ts lib/actions/transactions.ts lib/actions/patterns.ts lib/actions/revalidation.ts -n; rg "revalidateCategorizationSurfaces\(" lib/actions/expenses.ts lib/actions/transactions.ts lib/actions/patterns.ts lib/actions/revalidation.ts -n` | 0 | ✅ pass — `/categories` remains only in absence tests; helper owns touched revalidatePath calls | 52ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `lib/actions/revalidation.ts`
- `lib/routes.ts`
- `lib/actions/expenses.ts`
- `lib/actions/transactions.ts`
- `lib/actions/patterns.ts`
- `components/layout/sidebar.tsx`
- `components/layout/bottom-nav.tsx`
- `tests/pattern-actions.test.ts`
