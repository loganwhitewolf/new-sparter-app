---
phase: 64-file-detail-and-navigation
verified: 2026-07-06T17:00:00Z
status: gaps_found
score: 6/7 must-haves verified
behavior_unverified: 1
overrides_applied: 0
re_verification: true
previous_status: human_needed
previous_score: 6/7
gaps_closed:
  - "Smart-back Client Cache reuse defect (Plan 64-06): attachPopstateRefresh helper + router.refresh() busts Next.js's back/forward cache, restoring filtered-table state on Indietro"
gaps:
  - truth: "Pencil icon for inline edit is visible and discoverable on all three detail pages when hovering over the title/displayName (DET-08 promise: 'displayName editable inline')"
    status: failed
    reason: "CR-01 blocker from code review: All three inline editors (TransactionTitleEdit, ExpenseTitleEdit, ImportDisplayNameEdit) render pencil with opacity-0 group-hover:opacity-100, but the detail pages never wrap the title in an ancestor with Tailwind .group class. On tables, the TableRow itself has .group class so hover works; on detail pages, there is no .group ancestor — pencil opacity is frozen at 0. The feature works if clicked at the exact invisible location, but is undiscoverable in normal use."
    artifacts:
      - path: "components/transactions/transaction-title-edit.tsx:59"
        issue: "Pencil uses group-hover:opacity-100, but parent wrapping at line 44 is <div className=\"flex min-w-0 items-center gap-1\"> (no group class)"
      - path: "components/expenses/expense-title-edit.tsx"
        issue: "Same pattern: pencil uses group-hover:opacity-100 without group ancestor"
      - path: "components/import/import-display-name-edit.tsx"
        issue: "Same pattern: pencil uses group-hover:opacity-100 without group ancestor"
      - path: "components/detail-pages/detail-page-shell.tsx:111"
        issue: "Header wrapper <div className=\"min-w-0 flex-1\"> (no group class) — where title/displayName is rendered"
    missing:
      - "Add .group class to the appropriate ancestor wrapper on each detail page: expense-detail-client.tsx's datiCard outer div, transaction-detail-client.tsx's datiCard outer div, detail-page-shell.tsx's header title div"
      - "OR: Switch detail pages from opacity-0/group-hover pattern to always-visible-at-reduced-opacity + :hover for full opacity (removes group dependency and fixes keyboard-only user gap)"
deferred: []
behavior_unverified_items:
  - truth: "Clicking 'Indietro' from a filtered table detail page re-renders the table with the last-applied filter/sort/scroll position intact (not a stale pre-filter Client Cache snapshot)"
    test: "Open /transactions with a month filter, click into a row's detail page via the title link, then click 'Indietro' — table should reappear with the same filter and scroll position. Repeat for /expenses and /import/[fileId]."
    expected: "Table renders with the active filter/sort/scroll state preserved. Then open a detail page URL directly in a new tab and click 'Indietro' — it should land on the static unfiltered table route instead (not the filtered version)."
    why_human: "Gap-closure plan 64-06 added attachPopstateRefresh to arm a one-time popstate listener + router.refresh() before router.back(), which should bust Next.js's documented back/forward Client Cache and restore the destination route's RSC payload fresh. This is a runtime behavioral guarantee that can only be verified with a real browser navigating through the app — vitest's node environment cannot simulate the Client Cache or the popstate event. The code is present and unit-tested (attachPopstateRefresh helper passes), but the actual end-to-end cache-busting behavior is unverified."
human_verification:
  - test: "Smart-back filter/scroll preservation across all three detail pages"
    expected: "Open /transactions with an active month filter, click into a transaction row's detail page via title link, click 'Indietro' — confirm table re-renders with the same filter + scroll position. Repeat for /expenses (any filter) and /import/[fileId] (open a file's detail from the Files table with an active filter, click Indietro). Then, for each detail page, open the URL directly in a new tab by pasting it and click 'Indietro' — confirm it lands on the unfiltered static route (the fallback behavior for fresh-tab/no-history cases, unchanged by Plan 64-06)."
    why_human: "Requires observing real browser back/forward Client Cache behavior and verifying that router.refresh() successfully busts the cached RSC payload when triggered from a popstate listener armed synchronously before router.back(). Cannot be reproduced in vitest/node environment without a real Next.js App Router runtime."
---

# Phase 64: File Detail Page and Navigation Verification Report (Re-verification)

**Phase Goal:** File detail page (`/import/[fileId]`) navigable as first-class entity, plus navigation wiring so DET-08 and DET-09 requirements are satisfied end-to-end across transactions, expenses, and files tables.

**Verified:** 2026-07-06T17:00:00Z (re-verification after gap closure)

**Status:** gaps_found

**Re-verification:** Yes — previous status was human_needed (6/7 truths verified, 1 behavior-unverified). Gap closure plan 64-06 (smart-back Client Cache fix) completed 2026-07-06. Code review 64-REVIEW.md (2026-07-06T13:51:46Z) identified CR-01 blocker after all 6 plans completed.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Route helper `importFileDetailHref(fileId)` exists, matching `transactionDetailHref`/`expenseDetailHref` standalone-function convention | ✓ VERIFIED | `lib/routes.ts:62-64` — `export function importFileDetailHref(fileId: string): string { return \`${APP_ROUTES.import}/${encodeURIComponent(fileId)}\` }` |
| 2 | `getTransactionsByFileId` returns ownership-scoped, capped (default 10), date-ordered list of a file's transactions | ✓ VERIFIED | `lib/dal/transactions.ts:695-719` — `where(and(eq(transaction.fileId, fileId), eq(transaction.userId, userId)))`, `orderBy(desc(...))`, `limit(limit ?? 10)` |
| 3 | `getFileDetailForUser` returns file row + platform name in one round-trip, ownership-scoped | ✓ VERIFIED | `lib/dal/files.ts:107-150` — selects all `FileRow` columns + `platform.name`, `where(and(eq(file.id, fileId), eq(file.userId, userId)))` |
| 4 | In Transactions/Expenses/Files tables, title text is a real link to the row's detail page; pencil remains sole edit trigger | ✓ VERIFIED | `components/transactions/transaction-title-edit.tsx:45-60` + `components/expenses/expense-title-edit.tsx:37-52` — `<Link href={...}>` wraps title; separate `<button type="button">` wraps Pencil icon; `/import` table uses `importFileDetailHref` for imported files |
| 5 | Visiting `/import/{fileId}` for owned imported file shows editable displayName, readonly platform/format/stats, linked transactions preview; non-owned/non-existent → 404; mid-workflow → redirect; existing actions (download/suggestions/delete) reachable | ✓ VERIFIED | `app/(app)/import/[fileId]/page.tsx` (ownership + status checks, renders `FileDetailClient` only when `imported`) + `components/import/file-detail-client.tsx` (real DB-sourced data, all actions present) |
| 6 | Import table file name is a link to `/import/[fileId]` for imported files; row menu "Dettagli" entry exists; every `?fileId=` cross-ref repointed to `importFileDetailHref` | ✓ VERIFIED | `components/import/import-table.tsx:351-353` (`linkHref={row.status === 'imported' ? importFileDetailHref(row.id) : undefined}`); `components/import/import-row-actions.tsx:148-153` (Dettagli entry); `grep -rn '?fileId=' app/ components/` → zero matches |
| 7 | Pencil icon for inline edit is visible and discoverable on all three detail pages when hovering over title/displayName | ✗ FAILED | `components/detail-pages/detail-page-shell.tsx:111` wraps title in `<div className="min-w-0 flex-1">` (no `.group` class). Pencil icon uses `opacity-0 group-hover:opacity-100` (verified in all three title-edit components), but group ancestor is missing on detail pages. Feature works if clicked at invisible location, but is undiscoverable. This breaks DET-08's promise "displayName editable inline". |

**Score:** 6/7 truths verified (1 FAILED blocker — CR-01 invisible pencil icon makes inline edit undiscoverable)

### Truths Closed by Gap-Closure Plan 64-06

| Previous Finding | Status | Fix | Evidence |
|---|---|---|---|
| Smart-back Client Cache reuse (filters lost on Indietro) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED → ⚠️ PRESENT_BEHAVIOR_UNVERIFIED (gap-closure code present, runtime behavior unverified) | `attachPopstateRefresh` helper + `router.refresh()` (Plan 64-06) — arms one-time popstate listener before router.back(), busting Next.js's documented back/forward Client Cache | `components/detail-pages/detail-page-shell.tsx:31-36` (helper), `handleBackClick` lines 94-95 (wiring); test `tests/detail-page-shell.test.tsx > attachPopstateRefresh` passes |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/routes.ts:62-64` — `importFileDetailHref` | standalone function | ✓ VERIFIED | Present, matches convention, tested |
| `lib/dal/transactions.ts:695-719` — `getTransactionsByFileId` + `FileTransactionRow` | ownership-scoped query + type | ✓ VERIFIED | Present, `cache()`-wrapped, 5 unit tests pass |
| `lib/dal/files.ts:107-150` — `getFileDetailForUser` + `FileDetailContextRow` | ownership-scoped query + type | ✓ VERIFIED | Present, joins file→format→platform in one query, 5 unit tests pass |
| `app/(app)/import/[fileId]/page.tsx` | RSC entry, ownership + status redirect | ✓ VERIFIED | Present, exhaustive 7-status branch, 10 unit tests pass |
| `components/import/file-detail-client.tsx` | client shell composition | ✓ VERIFIED | Present, wired to `DetailPageShell`, renders real DB data (no static/hardcoded fallback) |
| `components/detail-pages/detail-page-shell.tsx:31-36` | `attachPopstateRefresh` helper | ✓ VERIFIED | Present, exports named helper, unit-testable with plain mock, 1 dedicated test |
| `components/transactions/transaction-title-edit.tsx:44-60` — Link + pencil split | link + button | ✓ VERIFIED (structure) / ✗ FAILED (visibility) | Link and button are present and separate (per plan 64-02), but pencil's opacity is frozen at 0 because ancestor lacks `.group` class |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `FileDetailPage` | `getFileDetailForUser` | direct call | ✓ WIRED | `page.tsx:16` |
| `FileDetailPage` | `getTransactionsByFileId` | direct call, only when `imported` | ✓ WIRED | `page.tsx:39` |
| `FileDetailClient` transactions preview | `transactionDetailHref` | per-row `<Link>` | ✓ WIRED | `file-detail-client.tsx:204-209` |
| Transaction/Expense/File tables | detail pages | title `<Link>` or row menu | ✓ WIRED | Title links verified; "Dettagli" menu entries verified in all three row-actions |
| `DetailPageShell.handleBackClick` | `attachPopstateRefresh` + `router.back()` | same synchronous branch | ✓ WIRED | `detail-page-shell.tsx:94-95` — listener armed before back() call |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `FileDetailClient` (`file`, `transactions` props) | `getFileDetailForUser` / `getTransactionsByFileId` results | RSC page → real Drizzle queries against DB | Yes; all displayed stats, dates, counts, and transaction rows come from DB query results, no static/hardcoded fallback | ✓ FLOWING |
| `import-table.tsx` `linkHref` | `row.id` (from `getImportRows` query) | pre-existing table ownership-scoped list | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Core unit tests for Phase 64 (DAL, routes, components, pages) | `yarn vitest run tests/detail-page-shell.test.tsx tests/file-detail-dal.test.ts tests/transaction-detail-dal.test.ts tests/file-detail-page.test.tsx tests/transaction-title-edit.test.tsx tests/expense-title-edit.test.tsx tests/import-display-name-edit.test.tsx tests/import-table-actions.test.tsx tests/transaction-table-menu.test.tsx tests/expense-table-menu.test.tsx` | 82/83 pass; 1 pre-existing failure (import-table-actions Rivedi suggerimenti test, pre-existing since Phase 54) | ✓ PASS (with known pre-existing, unrelated failure) |
| `importFileDetailHref` encodes special characters | `grep -n "encodeURIComponent" lib/routes.ts:62-64` | Present at line 63 | ✓ PASS |
| No legacy `?fileId=` patterns remain | `grep -rn '?fileId=' app/ components/` | zero matches across all app/component code | ✓ PASS |
| TypeScript no errors on phase files | `yarn tsc --noEmit` (scoped to phase-64 files) | no new errors in files modified by Phase 64 | ✓ PASS |
| Debt markers on phase files | `grep -n "TBD\|FIXME\|XXX" [phase-64 files]` | no matches | ✓ PASS |

### Requirements Coverage

| Requirement | Plans | Description | Status | Evidence | Issues |
|---|---|---|---|---|---|
| **DET-08** | 64-01, 64-03 | `/import/[fileId]` detail page: displayName editable inline; platform/format/stats readonly; transactions listed+linked; existing actions preserved | ✗ FAILED | File detail page exists, data flows correctly, all actions present — BUT displayName edit affordance (pencil icon) is invisible due to CR-01 `.group` class missing. User cannot discover the feature. Technically deliverable fails on "editable inline" = undiscoverable. | CR-01: Pencil icon frozen at opacity-0 (no group ancestor) |
| **DET-09** | 64-02, 64-04, 64-05, 64-06 | Navigation wiring: row-title click → detail page on all three tables; menu "Dettagli" entries; consistent back behavior | ⚠️ PARTIAL | Row-title clicks: ✓ wired on Transactions, Expenses, Files. Dettagli entries: ✓ present. Smart-back code: ✓ present + gap-closure added refresh, but runtime behavior unverified (behavior-unverified item). Back behavior code path is complete; filter-preservation behavior unverified pending human browser test. | Smart-back filter/scroll preservation behavior not tested in vitest; requires real browser |

### Code Review Findings (64-REVIEW.md, 2026-07-06T13:51:46Z)

**Critical Issue Present:**

1. **CR-01: Inline rename pencil permanently invisible on all three detail pages** (BLOCKER)
   - **Root cause:** Pencil icon uses `opacity-0 transition-opacity group-hover:opacity-100` but detail page title wrappers lack `.group` class
   - **Impact:** DET-08 deliverable (inline editable displayName/title) is undiscoverable — user must click exactly the invisible icon location by chance
   - **Files affected:** `components/transactions/transaction-title-edit.tsx:59`, `components/expenses/expense-title-edit.tsx`, `components/import/import-display-name-edit.tsx`, `components/detail-pages/detail-page-shell.tsx:111`
   - **Fix:** Add `.group` class to title wrapper on each detail page, OR switch to always-visible-at-reduced-opacity pattern
   - **Status:** NOT FIXED in current codebase

**Warning Issues Present (documented for completeness, not blockers for this verification):**

2. WR-01: Duplicate toast on file delete
3. WR-02: Smart-back referrer check broken for SPA (external-entry lifetime bug)
4. WR-03: Transaction detail amount missing color-coding
5. WR-04: TransactionTitleEdit doesn't trim/guard empty submissions
6. WR-05: No tests for detail-page client components or smart-back click handler

(Full details in `.planning/phases/64-file-detail-and-navigation/64-REVIEW.md`)

### Human Verification Required

#### 1. Smart-back filter/scroll preservation (behavior-unverified, gap-closure execution)

**Test:** Open /transactions with an active month filter (e.g. "Maggio" or similar), click into a transaction row's detail page via the title link, then click the "Indietro" button. Confirm the table re-renders with the same filter + scroll position. Repeat for /expenses (apply any filter, click row → click Indietro). Repeat for /import/[fileId] (open a file's detail from the Files table with an active table filter, click Indietro).

Then, for each detail page separately, open the URL directly by pasting it into the address bar and click "Indietro" — confirm it lands on the unfiltered static route (e.g. /transactions, not /transactions?month=5) — this tests the fallback path is unchanged by Plan 64-06.

**Expected:** History-preserving back when arriving from a filtered table (gap-closure fix should restore filters/scroll via router.refresh() busting the Client Cache). Static-route fallback when opened directly (unchanged Plan 64-05 behavior).

**Why human:** Requires observing real browser back/forward Client Cache behavior and Next.js App Router's popstate event semantics — vitest's node environment cannot simulate either. The code for `attachPopstateRefresh` is unit-tested in isolation, but the end-to-end cache-busting behavior can only be verified by navigating the live app.

**Status:** ⚠️ BEHAVIOR-UNVERIFIED (code present, behavior unexercised)

### Gaps Summary

**Blocking Gap (CR-01):**
- **Truth 7 Failed:** Pencil icon for inline edit is invisible on all three detail pages
- **Root Cause:** Detail page title wrappers lack `.group` class required by `group-hover:opacity-100` utility on the pencil icon
- **Impact:** DET-08 deliverable (displayName editable inline) is undiscoverable in normal use, violating the core requirement
- **Closure:** Add `.group` class to the immediate wrapper of each title-edit component on the three detail pages (3 files, 1-2 lines per file), OR switch detail pages to always-visible-at-reduced-opacity pencil pattern (removes group dependency)

**Behavior-Unverified Items (from gap closure):**
- Smart-back filter/scroll preservation behavior (code present + tested in isolation; runtime behavior unverified without real browser)

---

_Verified: 2026-07-06T17:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification context: Gap closure 64-06 completed; Code review 64-REVIEW.md identified CR-01 blocker. Present VERIFICATION replaces and supersedes 2026-07-06T15:00:00Z version._
