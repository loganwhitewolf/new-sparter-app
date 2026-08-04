---
phase: 260804-jog
plan: 01
subsystem: dashboard-navigation
tags: [transactions, dashboard, category-detail, navigation, back-link, open-redirect]
status: complete
dependency-graph:
  requires:
    - lib/validations/transactions.ts (parseTransactionFilters, pre-existing, untouched)
    - lib/dal/transactions.ts (subCategoryId/categorySlug scoping, pre-existing, untouched)
    - components/detail-pages/detail-page-shell.tsx (hasInAppHistory/attachPopstateRefresh, pre-existing, untouched)
  provides:
    - lib/utils/search-params.ts::parseTransactionsBackParam
    - components/transactions/transactions-back-link.tsx::TransactionsBackLink
    - lib/routes.ts::transactionsBySubcategoryHref
  affects:
    - app/(app)/transactions/page.tsx
    - app/(app)/dashboard/categories/[id]/page.tsx
    - components/dashboard/category-subcategory-breakdown.tsx
    - components/dashboard/category-top-transactions.tsx
tech-stack:
  added: []
  patterns:
    - "Total-function URL param validator (allowlist prefix), matching lib/utils/search-params.ts's existing convention"
    - "Client-side smart-back (router.back() when in-app history exists, else router.push to a validated fallback), duplicated locally from DetailPageShell rather than refactoring the shared shell"
key-files:
  created:
    - components/transactions/transactions-back-link.tsx
    - tests/transactions-back-link.test.tsx
  modified:
    - lib/utils/search-params.ts
    - app/(app)/transactions/page.tsx
    - lib/routes.ts
    - components/dashboard/category-subcategory-breakdown.tsx
    - app/(app)/dashboard/categories/[id]/page.tsx
    - components/dashboard/category-top-transactions.tsx
    - tests/table-search-params.test.ts
    - tests/category-subcategory-breakdown.test.tsx
    - tests/category-detail-components.test.tsx
decisions:
  - "D-01..D-06 locked in the plan itself (no separate CONTEXT.md for this quick task) — see PLAN.md objective section"
metrics:
  duration: "~5 min (task commits a5b8c028..36c88fab)"
  completed: 2026-08-04
actuals:
  tokens: 6186
  tasks: 4
  commits: 6
---

# Phase 260804-jog Plan 01: Clickable category drill-down navigation Summary

Two previously read-only surfaces on `/dashboard/categories/[id]` (the subcategory breakdown
table and the top-5 transactions list) now link into `/transactions` and `/transactions/[id]`
respectively, each with a working way back, gated by a hardened same-origin-only `?back=`
contract that can never resolve to an external host.

## What was built

**Task 1 — Validated back-navigation affordance on `/transactions` (NAV-03).**
`parseTransactionsBackParam` in `lib/utils/search-params.ts` only ever returns a value starting
with the literal `/dashboard/categories/` prefix — an absolute URL, a protocol-relative `//host`
string, or any foreign in-app path is dropped, never trusted. `TransactionsBackLink` (new client
component) renders a real `<a>` wired to the same smart-back algorithm `DetailPageShell` already
ships: `router.back()` when in-app history exists (preserving the origin category detail page's
own year/view state), falling back to `router.push(backHref)` for a fresh tab / directly-opened
link. `/transactions` renders this affordance only when a valid `?back=` is present; a normal
visit with no `back` param is unchanged.

**Task 2 — Subcategory rows navigate to the filtered transactions table (NAV-01/D-01).**
`transactionsBySubcategoryHref` in `lib/routes.ts` builds a `/transactions` href via
`URLSearchParams` carrying `subCategory` (id), `category` (parent slug), `months` (comma-joined
`YYYY-01`..`YYYY-12` for the year currently viewed), and `back` (the category detail page's own
href) — reusing the transactions page's pre-existing `subCategory`/`category`/`months` filter
contract verbatim, no parallel filtering logic. `CategorySubcategoryBreakdown` gates each row's
name behind this link only when both `categorySlug` and `backHref` props are supplied (including
`previous-only` rows, which correctly resolve to an empty result set); either prop missing falls
back to today's plain `<span>`. The category detail page threads `lens` through
`CategoryDetailContent` and computes `categoryDetailOwnHref` from `data.category` already in
scope, passing `categorySlug`/`backHref` into the breakdown component.

**Task 3 — Top-5 transaction cards navigate to their detail page (NAV-02/NAV-04).**
Each card in `CategoryTopTransactions` is now a real `<Link href={transactionDetailHref(id)}>`
wrapping the entire `<li>` content (rank badge, title, description, date, amount) — not just the
title. The empty-state branch is unchanged. NAV-04 was verified by inspection, not
re-implemented: `components/transactions/transaction-detail-client.tsx` already passes
`backHref={APP_ROUTES.transactions}` into `DetailPageShell`, and since a client-side `<Link>`
navigation pushes browser history, "Indietro" there already calls `router.back()` straight back
to the category detail page.

**Task 4 — Replace inline "nuova nel {year}" with a Badge + Tooltip (NAV-05, added mid-session).**
`presenceSuffix` now only handles the `previous-only` case (`— solo nel {year-1}`, untouched); a
new `isNewInYear` helper gates a `Tooltip`-wrapped `Badge` (`variant="secondary"`, matching this
codebase's own `TooltipProvider`/`Tooltip`/`TooltipTrigger`/`TooltipContent` usage pattern from
`components/transactions/transaction-table.tsx`) reading "nuova" for `current-only` rows, with
tooltip content "questa spesa compare per la prima volta nel {year}".

## Verification

- `node_modules/.bin/vitest run tests/table-search-params.test.ts tests/transactions-back-link.test.tsx tests/category-subcategory-breakdown.test.tsx tests/category-detail-components.test.tsx tests/detail-page-shell.test.tsx tests/category-ranking-list.test.tsx` — 6 files, 88 tests, all passing (the last two are read-only regression files, neither edited by this plan).
- `node_modules/.bin/tsc --noEmit` — clean.
- `yarn check:language` — clean (after one small fix, see Deviations).
- Manual smoke was done by code-path inspection (non-interactive executor, no browser): traced
  `transactionsBySubcategoryHref`'s output through `parseTransactionFilters` (subCategory/category/
  months keys already parsed, unchanged) and through `parseTransactionsBackParam` (prefix match
  confirmed); traced `transactionDetailHref` through to `/transactions/[id]`'s
  `transaction-detail-client.tsx` and `DetailPageShell`'s existing `backHref`/`hasInAppHistory`
  wiring (unmodified); confirmed via the new test suite that an invalid `back` (absolute URL,
  protocol-relative, foreign path) never renders the back affordance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking issue] Symlinked `node_modules` into the worktree**
- **Found during:** Task 1 verification setup
- **Issue:** The worktree had no `node_modules` (fresh worktree, no install step run), so
  `node_modules/.bin/vitest`/`tsc` were unavailable to run any `<verify>` block.
- **Fix:** Confirmed `package.json` is byte-identical between the worktree's base commit and the
  main repo's current `package.json`, then created `ln -s <main-repo>/node_modules node_modules`
  inside the worktree (a gitignored path, never committed).
- **Files modified:** none tracked (symlink is gitignored).
- **Commit:** n/a (not a tracked change).

**2. [Rule 1 - Bug] Test assertion mismatch from HTML attribute escaping**
- **Found during:** Task 2 verification
- **Issue:** New link-href assertions in `tests/category-subcategory-breakdown.test.tsx` compared
  against the raw `transactionsBySubcategoryHref(...)` string, but `renderToStaticMarkup`
  HTML-escapes `&` to `&amp;` in attribute values, causing two new tests to fail on a
  non-functional escaping mismatch.
- **Fix:** Escaped `&` in the expected string before the `toContain` assertion.
- **Files modified:** tests/category-subcategory-breakdown.test.tsx
- **Commit:** d8f1be23

**3. [Rule 1 - Bug] Test-file lint violation (`yarn check:language`)**
- **Found during:** post-Task-4 full verification pass
- **Issue:** A test comment referenced the fixture's Italian name ("Spesa quotidiana") inside
  single quotes rather than double quotes; `check-code-language.mjs` only strips double-quoted
  spans before its Italian-term heuristic runs, so the bare word "spesa" tripped the check.
  (This is a lint-only false positive, not a real domain-language violation — the Italian
  fixture name itself is legitimate product/domain data per CLAUDE.md's Language Convention.)
- **Fix:** Reworded the comment to reference the fixture by id (`fixture id 1`) instead of
  restating its Italian name.
- **Files modified:** tests/category-subcategory-breakdown.test.tsx
- **Commit:** 36c88fab

No architectural deviations (Rule 4) — the plan executed as designed.

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources were introduced.

## Self-Check: PASSED

Files verified to exist:
- FOUND: components/transactions/transactions-back-link.tsx
- FOUND: tests/transactions-back-link.test.tsx
- FOUND: lib/utils/search-params.ts (parseTransactionsBackParam present)
- FOUND: lib/routes.ts (transactionsBySubcategoryHref present)

Commits verified in git log:
- FOUND: a5b8c028 (Task 1)
- FOUND: d8f1be23 (Task 2)
- FOUND: 62f9b685 (Task 3)
- FOUND: e9ccde0b (Task 4)
- FOUND: 36c88fab (Task 4 lint fix)
