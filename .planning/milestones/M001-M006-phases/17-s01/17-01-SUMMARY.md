---
phase: "17"
plan: "01"
---

# T01: Added red Vitest coverage for category-related action revalidation and Playwright coverage proving `/categories` nav links still exist.

**Added red Vitest coverage for category-related action revalidation and Playwright coverage proving `/categories` nav links still exist.**

## What Happened

Created `tests/categorization-revalidation-actions.test.ts` with hoisted Vitest mocks around `next/cache`, session auth, expense/transaction/pattern DALs and services, Drizzle helpers, and lightweight DB transaction chains. The tests define the exact required category revalidation route set (`/expenses`, `/transactions`, `/dashboard`, `/settings/patterns`, `/settings/categories`) and assert success paths across expense, transaction, and pattern Server Actions using order-independent deduped route comparisons. Negative validation and DAL/service failure paths assert safe Italian errors and no `revalidatePath` calls, and the success tests include tampered `userId` form fields to prove mutations use the `verifySession()` user id. Extended `tests/layout.spec.ts` with desktop sidebar and mobile bottom-nav checks that no link with `href="/categories"` is present while preserving the existing staging header setup.

## Verification

Ran the focused Vitest command from the task plan; it failed as expected before T02 with 9 red success-path assertions showing currently missing all-route revalidation and 6 green negative/security-path assertions. Ran the focused Playwright command from the task plan; it failed as expected before T02 because the desktop sidebar and mobile bottom nav each still expose one `/categories` link.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest run tests/categorization-revalidation-actions.test.ts --reporter=verbose` | 1 | ✅ expected red: 9 missing exact route-set failures, 6 negative/security tests passed | 764ms |
| 2 | `yarn playwright test tests/layout.spec.ts --grep "categories|/categories" --reporter=list` | 1 | ✅ expected red: desktop sidebar and mobile bottom nav still contain /categories links | 13258ms |

## Deviations

None.

## Known Issues

The newly added tests are intentionally failing until T02 implements shared category revalidation and removes the dead `/categories` navigation items.

## Files Created/Modified

- `tests/categorization-revalidation-actions.test.ts`
- `tests/layout.spec.ts`
