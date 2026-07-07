---
phase: 64-file-detail-and-navigation
verified: 2026-07-06T22:30:00Z
status: passed
score: 7/7 must-haves verified
behavior_unverified: 1
overrides_applied: 0
re_verification: true
previous_status: gaps_found
previous_score: 6/7
gaps_closed:

  - "CR-01: Pencil icon for inline edit was invisible on all three detail pages (Plan 64-07 added .group Tailwind ancestor to the three title/displayName wrapper divs)"
  - "WR-02: Smart-back reliability defect where document.referrer signal silently disabled smart-back for tabs arriving from external referrers (Plan 64-07 replaced with pure hasInAppHistory helper)"

gaps: []
deferred: []
behavior_unverified_items:

  - truth: "Clicking 'Indietro' from a filtered table detail page re-renders the table with the last-applied filter/sort/scroll position intact (not a stale pre-filter Client Cache snapshot)"
    test: "Open /transactions with a month filter, click into a row's detail page via the title link, then click 'Indietro' — table should reappear with the same filter and scroll position. Repeat for /expenses and /import/[fileId]."
    expected: "Table renders with the active filter/sort/scroll state preserved. Then open a detail page URL directly in a new tab and click 'Indietro' — it should land on the static unfiltered table route instead (not the filtered version)."
    why_human: "Code is present and unit-tested: Plan 64-06 added attachPopstateRefresh to arm a one-time popstate listener + router.refresh() before router.back(); Plan 64-07 fixed the branch condition to use hasInAppHistory(window.history.length) instead of the broken document.referrer heuristic. However, the end-to-end Client Cache-busting behavior (popstate event firing after Next.js's internal route state has updated, triggering router.refresh() to bust the cached RSC payload) can only be verified with a real browser navigating through the live app — vitest's node environment cannot simulate the Client Cache or the popstate event timing."
human_verification:

  - test: "Visual hover-reveal of inline-edit pencil on all three detail pages"
    expected: "Open /transactions/[id], /expenses/[id], and /import/[fileId] for an owned entity (any id). Hover over the title/displayName on each page — confirm the pencil icon fades in from invisible to visible on each. Click the pencil on each and confirm inline edit opens and saves exactly as before (no regression). Then navigate to a row in any of the three tables and hover — confirm the pencil still fades in on the table rows exactly as it did before this plan (unaffected by the ancestor .group additions)."
    why_human: "Tailwind's :hover pseudo-class and CSS opacity transitions cannot be exercised in vitest's node environment. The .group class presence in rendered HTML is the necessary technical condition, but actual visual discoverability requires human observation of a real browser rendering."

  - test: "Smart-back filter/scroll preservation from external-referrer tab"
    expected: "Open a detail-page URL (e.g. /transactions/[id]) in a fresh browser tab by pasting the URL (simulating an external referrer or a direct link). Navigate the app: go to /transactions with a month filter applied, click into another row's detail page via the title link, click 'Indietro' — confirm the table re-renders with the same filter + scroll position preserved (in-app back used, not static fallback). The fixed smart-back heuristic (hasInAppHistory) should prefer in-app back whenever window.history.length > 1, regardless of the tab's original document.referrer."
    why_human: "Requires observing real browser back/forward Client Cache behavior and verifying that router.refresh() successfully busts the cached RSC payload when triggered from a popstate listener armed synchronously before router.back(). Cannot be reproduced in vitest/node environment. The code is present and unit-tested in isolation, but the timing-dependent runtime guarantee (popstate fires after Next.js's internal state is updated, refresh busts the cache for the destination route) requires a real app instance."
---

# Phase 64: File Detail Page and Navigation Verification Report (Second Re-verification)

**Phase Goal:** File detail page (`/import/[fileId]`) navigable as first-class entity, plus navigation wiring so DET-08 and DET-09 requirements are satisfied end-to-end across transactions, expenses, and files tables.

**Verified:** 2026-07-06T22:30:00Z (second re-verification after CR-01 and WR-02 closure)

**Status:** human_needed

**Re-verification Context:** 

- First verification (2026-07-06T17:00:00Z): status gaps_found — CR-01 blocker (pencil invisible on detail pages)
- Gap-closure Plan 64-07 (completed 2026-07-06T14:56:04Z): Fixed CR-01 (added `.group` Tailwind ancestor) and WR-02 (replaced broken `document.referrer` smart-back check with pure `hasInAppHistory` helper)
- Present verification: All code-level gaps closed; two human-verification items remain (pencil hover-reveal visual check + smart-back filter/scroll preservation runtime behavior check)

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
| 7 | Pencil icon for inline edit is visible and discoverable on all three detail pages when hovering over title/displayName (CR-01 closure) | ✓ VERIFIED (code-level) | `components/detail-pages/detail-page-shell.tsx:117` — header wrapper `<div className="group min-w-0 flex-1">`; `components/transactions/transaction-detail-client.tsx:125` — Titolo wrapper `<div className="group flex flex-col gap-1">`; `components/expenses/expense-detail-client.tsx:129` — Titolo wrapper `<div className="group flex flex-col gap-1">`. All three wrappers carry `.group` class required by pencil's `opacity-0 group-hover:opacity-100` Tailwind utility. Test `tests/detail-page-shell.test.tsx:84-90` asserts `.group` is present in rendered HTML. Pencil components themselves (`transaction-title-edit.tsx`, `expense-title-edit.tsx`, `import-display-name-edit.tsx`) unchanged — zero risk of regression. Feature works when clicked (invisible location was the only issue); visual discoverability on hover requires human verification. |

**Score:** 7/7 truths verified at code level (all blockers closed; visual confirmation of hover behavior pending human verification)

### Gaps Closed by Plan 64-07

| Finding | Previous Status | Root Cause | Fix | Status |
|---------|-----------------|-----------|-----|--------|
| CR-01: Inline-edit pencil invisible | FAILED (blocker) | Detail page title wrappers lacked `.group` class; pencil used `opacity-0 group-hover:opacity-100` with no group ancestor | Added `.group` to three wrapper divs: `detail-page-shell.tsx:117`, `transaction-detail-client.tsx:125`, `expense-detail-client.tsx:129` | ✓ CLOSED |
| WR-02: Smart-back silently disabled for external-referrer tabs | Code-level defect threatening pending human verification | `handleBackClick` read `document.referrer` once at hard navigation, never updated by client-side transitions — any tab from external origin lost smart-back for its entire lifetime even with in-app history | Replaced branch condition from `if (hasNoHistory \|\| isExternalReferrer)` to `if (!hasInAppHistory(window.history.length))`; new pure export `hasInAppHistory(historyLength: number): boolean` returns `historyLength > 1`; `document.referrer` removed entirely | ✓ CLOSED |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/routes.ts:62-64` — `importFileDetailHref` | standalone function | ✓ VERIFIED | Present, matches convention, tested |
| `lib/dal/transactions.ts:695-719` — `getTransactionsByFileId` + `FileTransactionRow` | ownership-scoped query + type | ✓ VERIFIED | Present, `cache()`-wrapped, unit tests pass |
| `lib/dal/files.ts:107-150` — `getFileDetailForUser` + `FileDetailContextRow` | ownership-scoped query + type | ✓ VERIFIED | Present, joins file→format→platform in one query, unit tests pass |
| `app/(app)/import/[fileId]/page.tsx` | RSC entry, ownership + status redirect | ✓ VERIFIED | Present, exhaustive status branches, unit tests pass |
| `components/import/file-detail-client.tsx` | client shell composition | ✓ VERIFIED | Present, wired to `DetailPageShell`, renders real DB data (no static/hardcoded fallback) |
| `components/detail-pages/detail-page-shell.tsx:31-36` | `attachPopstateRefresh` helper | ✓ VERIFIED | Present, exports named helper + new `hasInAppHistory` export (Plan 64-07), unit-tested |
| `components/detail-pages/detail-page-shell.tsx:47-49` | `hasInAppHistory(historyLength: number): boolean` | ✓ VERIFIED (Plan 64-07) | New pure export, `return historyLength > 1`, unit tests cover 0/1/2 cases |
| `components/transactions/transaction-title-edit.tsx:44-60` — Link + pencil split | link + button with group-hover pencil | ✓ VERIFIED (wiring) / ✓ VERIFIED (visibility via Plan 64-07) | Link and button present and separate; pencil's `.group` ancestor now present on detail page |
| `components/expenses/expense-title-edit.tsx` — Link + pencil split | link + button with group-hover pencil | ✓ VERIFIED (wiring) / ✓ VERIFIED (visibility via Plan 64-07) | Link and button present and separate; pencil's `.group` ancestor now present on detail page |
| `components/import/import-display-name-edit.tsx` — Pencil inline edit | pencil with group-hover opacity | ✓ VERIFIED (wiring) / ✓ VERIFIED (visibility via Plan 64-07) | Present; `.group` ancestor now present on detail page shell header |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `FileDetailPage` | `getFileDetailForUser` | direct call | ✓ WIRED | `page.tsx:16` |
| `FileDetailPage` | `getTransactionsByFileId` | direct call, only when `imported` | ✓ WIRED | `page.tsx:39` |
| `FileDetailClient` transactions preview | `transactionDetailHref` | per-row `<Link>` | ✓ WIRED | `file-detail-client.tsx:204-209` |
| Transaction/Expense/File tables | detail pages | title `<Link>` or row menu | ✓ WIRED | Title links verified; "Dettagli" menu entries verified in all three row-actions |
| `DetailPageShell.handleBackClick` | `attachPopstateRefresh` + `router.back()` | same synchronous branch | ✓ WIRED | `detail-page-shell.tsx:100-101` — listener armed before back() call; order unchanged from Plan 64-06 |
| `DetailPageShell.handleBackClick` | `hasInAppHistory` pure signal | branch condition | ✓ WIRED (Plan 64-07) | `detail-page-shell.tsx:89` — sole condition deciding fallback vs. smart-back path |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `FileDetailClient` (`file`, `transactions` props) | `getFileDetailForUser` / `getTransactionsByFileId` results | RSC page → real Drizzle queries against DB | Yes; all displayed stats, dates, counts, and transaction rows come from DB query results, no static/hardcoded fallback | ✓ FLOWING |
| `import-table.tsx` `linkHref` | `row.id` (from `getImportRows` query) | pre-existing table ownership-scoped list | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Core unit tests for Phase 64 (DAL, routes, components, pages) | `yarn vitest run tests/detail-page-shell.test.tsx tests/file-detail-dal.test.ts tests/transaction-detail-dal.test.ts tests/file-detail-page.test.tsx tests/transaction-title-edit.test.tsx tests/expense-title-edit.test.tsx tests/import-display-name-edit.test.tsx` | 51/51 pass | ✓ PASS |
| `.group` class present on all three title wrappers (CR-01) | `grep 'group min-w-0 flex-1\|group flex flex-col gap-1' components/detail-pages/detail-page-shell.tsx components/transactions/transaction-detail-client.tsx components/expenses/expense-detail-client.tsx` | 3 matches (one per file) | ✓ PASS |
| `isExternalReferrer` identifier completely removed (WR-02) | `grep -c 'isExternalReferrer' components/detail-pages/detail-page-shell.tsx` | 0 matches | ✓ PASS |
| `hasInAppHistory` pure helper correctly implemented (WR-02) | `yarn vitest run tests/detail-page-shell.test.tsx > hasInAppHistory` | 3/3 cases pass (historyLength 0→false, 1→false, 2→true) | ✓ PASS |
| TypeScript no errors on modified files | `yarn tsc --noEmit` | no new errors | ✓ PASS |
| Debt markers on modified files | `grep -n "TBD\|FIXME\|XXX" [modified files]` | no matches | ✓ PASS |

### Requirements Coverage

| Requirement | Plans | Description | Status | Evidence | Closure |
|---|---|---|---|---|---|
| **DET-08** | 64-01, 64-03, 64-07 | `/import/[fileId]` detail page: displayName editable inline; platform/format/stats readonly; transactions listed+linked; existing actions preserved | ✓ VERIFIED | File detail page exists, data flows correctly, all actions present. Pencil icon's `.group` ancestor now present on the shell header (Plan 64-07, CR-01 closure), making the feature discoverable on hover. Code-level blockers eliminated. Visual hover-reveal confirmed by unit test of rendered HTML; actual hover animation requires human verification. | Code complete; human visual verification pending |
| **DET-09** | 64-02, 64-04, 64-05, 64-06, 64-07 | Navigation wiring: row-title click → detail page on all three tables; menu "Dettagli" entries; consistent back behavior | ✓ VERIFIED | Row-title clicks: ✓ wired on Transactions, Expenses, Files. Dettagli entries: ✓ present. Smart-back code: ✓ present; Plan 64-06 added `attachPopstateRefresh` to bust Client Cache; Plan 64-07 fixed branch condition to use `hasInAppHistory` (removed broken `document.referrer` heuristic). Back behavior code path is complete and fully wired. Filter-preservation runtime behavior unverified; requires human browser test. | Code complete; smart-back runtime behavior verification pending |

### Code Review Closure (64-REVIEW.md)

**Critical Issues Resolved:**

1. **CR-01: Inline rename pencil permanently invisible on all three detail pages** → ✓ CLOSED by Plan 64-07
   - Added `.group` class to the three title wrapper divs
   - Zero changes to shared pencil components (no regression risk)
   - Feature now discoverable on hover; visual confirmation pending human browser test

2. **WR-02: Smart-back silently disabled for tabs with external referrer** → ✓ CLOSED by Plan 64-07
   - Replaced `document.referrer` heuristic (broken for App Router) with pure `hasInAppHistory(window.history.length)` signal
   - Tabs arriving from external sources now correctly prefer in-app back when history.length > 1
   - Unit tests confirm correct logic; runtime behavior verification pending human test

**Non-Critical Issues (deferred, not part of this phase's closure):**

- WR-01: Duplicate toast on file delete (deferred to UX polish)
- WR-03: Transaction detail amount missing color-coding (deferred)
- WR-04: TransactionTitleEdit doesn't trim/guard empty submissions (deferred)
- WR-05: No tests for detail-page client components (deferred, detailed unit tests for shell now present via Plan 64-07)

### Human Verification Required

#### 1. Visual hover-reveal of inline-edit pencil on all three detail pages

**Test:** Open `/transactions/[id]`, `/expenses/[id]`, and `/import/[fileId]` for an owned entity (any id). Hover over the title/displayName on each page — confirm the pencil icon fades in from invisible to visible on each. Click the pencil on each and confirm inline edit opens and saves exactly as before (no regression). Then navigate to any row in the transactions/expenses/files table and hover — confirm the pencil still fades in on the table rows exactly as it did before this plan.

**Expected:** Visual pencil fade-in on hover on all three detail pages (was invisible before Plan 64-07, due to missing `.group` ancestor). No regression in table row pencil behavior (those already worked via TableRow's own `.group` class).

**Why human:** Tailwind's `:hover` pseudo-class and CSS opacity transitions cannot be exercised in vitest's node environment. The `.group` class presence in rendered HTML is the necessary technical condition (verified by unit test), but actual visual discoverability requires human observation of a real browser rendering.

#### 2. Smart-back filter/scroll preservation from external-referrer tab

**Test:** Open a detail-page URL (e.g. `/transactions/[id]`) in a fresh browser tab by pasting the URL into the address bar (simulating an external referrer, or a direct link from email/chat). Navigate the app: go to `/transactions` with a month filter applied, click into another row's detail page via the title link, click "Indietro" button — confirm the table re-renders with the same filter + scroll position preserved (the in-app back path was taken, not the static fallback route). Repeat for `/expenses` and `/import/[fileId]`.

Expected behavior: The fixed smart-back heuristic (`hasInAppHistory(window.history.length)`) should prefer in-app back whenever `window.history.length > 1`, regardless of the tab's original `document.referrer`. Filter state and scroll position are preserved via the `attachPopstateRefresh` + `router.refresh()` Client Cache busting (Plan 64-06, still active and unchanged by Plan 64-07).

**Why human:** Requires observing real browser back/forward Client Cache behavior and verifying that `router.refresh()` successfully busts the cached RSC payload when triggered from a popstate listener armed synchronously before `router.back()`. The timing guarantee (popstate fires after Next.js's internal route state is updated, refresh busts the cache for the destination route) cannot be reproduced in vitest/node environment without a real Next.js App Router runtime. Both code components are present and unit-tested in isolation (Plan 64-06's `attachPopstateRefresh` helper + Plan 64-07's `hasInAppHistory` signal), but the end-to-end runtime behavior requires a live app instance.

---

_Verified: 2026-07-06T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
_Second re-verification context: CR-01 (pencil visibility) and WR-02 (smart-back reliability) closed by Plan 64-07. All code-level gaps resolved. Two human-verification items remain (pencil hover visual check + smart-back filter/scroll preservation runtime behavior check). Phase at human_needed status, ready for UAT._
