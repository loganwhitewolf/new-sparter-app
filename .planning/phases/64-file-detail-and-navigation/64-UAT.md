---
status: diagnosed
phase: 64-file-detail-and-navigation
source: [64-VERIFICATION.md]
started: 2026-07-06T15:10:00Z
updated: 2026-07-06T15:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Smart-back navigation (history-preserving + static fallback)
expected: Open a transaction row from the /transactions table with an active filter (e.g. a month filter), click into its detail page, then click "Indietro" — confirm the table re-appears with the same filter/scroll position still applied. Then open the same detail page URL directly by pasting it in a new tab and click "Indietro" — confirm it lands on the static /transactions route (no filter, top of list) instead of leaving a blank history or navigating away from the app. Repeat for /expenses/[id] and /import/[fileId].
result: issue
reported: "quando torno indietro da una pagina di dettaglio non si mantiene il filtro precedente"
severity: major

## Summary

total: 1
passed: 0
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "History-based back (filters/sort/scroll preserved) when arriving from the entity's own table"
  status: failed
  reason: "User reported: quando torno indietro da una pagina di dettaglio non si mantiene il filtro precedente"
  severity: major
  test: 1
  root_cause: "Next.js 16 App Router's back/forward Client Cache reuses the table page's previously-rendered RSC payload on router.back(), independent of staleTimes.dynamic. The transactions/expenses/import tables write filter/sort state via router.replace() (use-table-url.ts), which updates the current history entry in place. DetailPageShell's smart-back handler (Plan 64-05) correctly calls router.back() for in-app navigation, but Next intercepts that with cache-reuse instead of a fresh dynamic fetch, so the table can render a stale pre-filter snapshot instead of the last-replaced filtered URL."
  artifacts:
    - path: "components/data-table/use-table-url.ts"
      issue: "Filter/sort writes always use router.replace(), the trigger condition for the stale-cache-on-back scenario"
    - path: "components/detail-pages/detail-page-shell.tsx"
      issue: "handleBackClick correctly invokes router.back() — not the defect itself, but the call site whose result surfaces the caching gap"
    - path: "app/(app)/transactions/page.tsx"
      issue: "Dynamic Server Component reading searchParams, subject to Next's back/forward cache-reuse (same pattern applies to /expenses, /import)"
  missing:
    - "A mechanism to force a fresh render when landing back on a filtered table via history, without reverting to push()-per-filter-change (which would spam history)"
    - "Suggested directions: pair router.back() with a timed router.refresh() (e.g. via a popstate listener) to bust the Client Cache for the restored route; or evaluate switching filter writes to occasionally push() so the pre-detail-page history entry holds the exact filtered snapshot"
    - "Live-browser verification — project's vitest runs in node (no jsdom), diagnosis did not execute a real browser repro"
  debug_session: ".planning/debug/64-smart-back-filter-loss.md"
