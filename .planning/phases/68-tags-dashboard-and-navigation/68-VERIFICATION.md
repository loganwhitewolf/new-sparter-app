---
phase: 68-tags-dashboard-and-navigation
verified: 2026-07-21T15:00:00Z
status: passed
score: 37/37 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification: resolved — user confirmed the wide-date-range caption renders on one line (2026-07-21); see 68-UAT.md
---

# Phase 68: Tags Dashboard and Navigation Verification Report

**Phase Goal:** A user can see the whole dashboard narrowed to a single tag's context, review a
dedicated section listing every tag's own independent total, and jump directly from a dashboard
savings/deviations row into the correspondingly filtered transaction list — closing the loop
between "look at the numbers" and "see the transactions behind them."
**Verified:** 2026-07-21
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can apply a tag filter globally on the dashboard alongside month/year; every existing widget narrows to tagged transactions only, and totals still reconcile | ✓ VERIFIED | `lib/dal/dashboard.ts` (5 functions), `lib/dal/overview.ts` (3 functions) all thread `tagId?: number` via `tagScopedTransactions()`; wired at `app/(app)/dashboard/overview/page.tsx`, `.../categories/page.tsx`, `.../categories/[id]/page.tsx` via `resolveOwnedTagId`; `TagFilterSelect` renders in all 3 pages |
| 2 | User can open a Tag section listing every tag with its own independent per-tag total (no expectation of summing) and an archive action; archived tags remain visible and interrogable | ✓ VERIFIED | `getTagTotals` (`lib/dal/tags.ts:205-252`) is `FROM tag LEFT JOIN ...` (zero-safe), all-time (no date param), applies dashboard exclusions via `FILTER (WHERE ...)`; `app/(app)/dashboard/tags/page.tsx` + `TagRankingList` render every tag incl. archived (badge, never hidden), `ArchiveTagDialog` reused verbatim |
| 3 | With a month selected on the dashboard's savings/deviations view, clicking a row navigates to the transactions section pre-filtered to that month and the row's category context | ✓ VERIFIED | `components/dashboard/overview/overview-movers-panel.tsx:63-72` wraps each row in a `<Link href="/transactions?months={year}-{MM}&category={categorySlug}">` built from `MonthOverMonthChange.categorySlug` (added in `lib/dal/overview.ts`), never the numeric `categoryId` |

### Observable Truths (Plan-Level Detail)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 4 | `tagScopedTransactions` uses EXISTS, never a JOIN, against `transaction_tag` | ✓ VERIFIED | `lib/dal/transaction-tags-sql.ts:24-32` — `sql\`EXISTS (SELECT 1 FROM transaction_tag tt ...)\`` |
| 5 | `resolveOwnedTagId` is fail-closed IDOR foundation | ✓ VERIFIED | `lib/dal/tags.ts:135-143` — returns `undefined` on ownership miss, never throws |
| 6 | `/transactions?tag={tagId}` filter contract exists and narrows | ✓ VERIFIED | `lib/validations/transactions.ts:217-221,238`, `lib/dal/transactions.ts:338-339` |
| 7 | 5 `dashboard.ts` exports (`getUncategorizedCount`, `getOverviewAmountTotals`, `getCategoryRanking`, `getCategoryDeviations`, `getCategoryDetail`) accept trailing optional `tagId`, additive | ✓ VERIFIED | grep confirms all 5 signatures + `tagScopedTransactions(...)` in each WHERE (lines 448, 497, 1083, 1145, 1182, 1318, 1362, 1406) |
| 8 | `getCategoryDetail` narrows all 3 internal queries (trend/subcategory/top-tx), not the metadata lookup | ✓ VERIFIED | 3 `tagScopedTransactions(tagId)` occurrences at lines 1318/1362/1406, metadata query untouched |
| 9 | `getOverview`/`getOverviewChart`/`getMonthOverMonthCategoryChanges` thread tagId | ✓ VERIFIED | `lib/dal/overview.ts:115,136-139,256,291,338,374,479,534` |
| 10 | `MonthOverMonthChange.categorySlug` added, non-null for in/out-grain, null for allocation | ✓ VERIFIED | `lib/dal/overview.ts:32,310,346,385,393,424,447` |
| 11 | `fetchMovers` forwards defensively-validated tagId (Pitfall 4) | ✓ VERIFIED | `lib/actions/overview.ts:20-53` — `safeTagId` guard, forwarded as 5th arg |
| 12 | `getTagTotals` never drops a zero-transaction or fully-excluded tag | ✓ VERIFIED | `FROM tag` root + LEFT JOINs + `FILTER (WHERE ...)` in aggregates, not outer WHERE (`lib/dal/tags.ts:218-249`) |
| 13 | Tag-section per-tag total is all-time, independent of dashboard preset/year (LOCKED DECISION 1) | ✓ VERIFIED | `getTagTotals(userId)` takes no date param; `app/(app)/dashboard/tags/page.tsx` reads no searchParams |
| 14 | Tag total applies same exclusions as dashboard totals (LOCKED DECISION 2) | ✓ VERIFIED | Shared `tagTotalExclusion` fragment reuses `DASHBOARD_TOTAL_EXPENSE_STATUSES`, `ne(direction.code,'transfer')`, `isNotSecondary()` |
| 15 | `archiveTagAction` revalidates `/dashboard/tags` too (Pitfall 3 fix) | ✓ VERIFIED | `lib/actions/tags.ts:106-107` — two `revalidatePath` calls |
| 16 | `TagFilterSelect` renders even with zero tags (never hidden) | ✓ VERIFIED | `components/dashboard/tag-filter-select.tsx:55-77` — sentinel-only render path |
| 17 | Archived tags listed inline with badge, never hidden/disabled | ✓ VERIFIED | Same file, lines 69-73; also `TagRankingList` lines 81-85 |
| 18 | Tag filter `?tag=` carried across tab switches | ✓ VERIFIED | `components/dashboard/dashboard-tab-nav.tsx:22,36-38` |
| 19 | Category-list ↔ category-detail navigation preserves `?tag=` | ✓ VERIFIED | `lib/routes.ts` `DashboardCategoryFilters.tag`, both href builders set it; `category-ranking-list.tsx:109-113`; detail page `backHref` (line 162-167) |
| 20 | Foreign/malformed `tagId` silently ignored on all 3 dashboard RSC pages | ✓ VERIFIED | `resolveOwnedTagId(userId, parseTagIdParam(...))` called in overview/categories/categories/[id] pages before any DAL call |
| 21 | Tag-filtered zero-match-in-period empty state copy | ✓ VERIFIED | `components/dashboard/overview/overview-empty-state.tsx:25-33` + `category-ranking-list.tsx:93` — exact locked copy |
| 22 | Movers rows: 3 category-keyed columns clickable by slug, Accantonamenti column stays plain | ✓ VERIFIED | `overview-movers-panel.tsx:63-84` (Link) vs `172-194` (plain `<li>`, untouched) |
| 23 | Null `categorySlug` row renders plain, non-linked, unchanged | ✓ VERIFIED | `overview-movers-panel.tsx:74-81` defensive fallback branch |
| 24 | Tag section: empty/loading/populated/partial/zero-one-many/overflow states | ✓ VERIFIED | `tag-ranking-list.tsx` (empty box, truncate+title, grid no-cap, captionText null-safe), `tag-ranking-skeleton.tsx` (5-card pulse grid) |
| 25 | Tag-section card clickable → `/transactions?tag={tagId}` | ✓ VERIFIED | `tag-ranking-list.tsx:73-80` |
| 26 | Archivia action reuses `ArchiveTagDialog` verbatim | ✓ VERIFIED | `tag-ranking-list.tsx:99-111` imports from `components/tags/tag-mutation-dialogs.tsx`, unmodified |
| 27 | `getTagTotals`/`getTags` fetch-failure surfaces locked error copy (backstop) | ✓ VERIFIED (code evidence) | `app/(app)/dashboard/tags/page.tsx:18-32` try/catch renders exact copy "Non è stato possibile caricare i tag. Ricarica la pagina." |
| 28 | Tag-section caption with a very wide date range fits on one line without an explicit line-clamp (backstop) | ⚠️ UNCERTAIN | No `line-clamp`/`truncate` class on the caption `<p>` (`tag-ranking-list.tsx:87`) — a purely visual/rendering assertion at real widths; code inspection cannot confirm text never wraps. Routed to human verification. |

**Score:** 36/37 truths verified (1 routed to human verification as a visual backstop item; 0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/dal/transaction-tags-sql.ts` | `tagScopedTransactions()` EXISTS predicate | ✓ VERIFIED | New file, matches spec exactly |
| `lib/routes.ts` (`APP_ROUTES.dashboardTags`) | `/dashboard/tags` constant | ✓ VERIFIED | Present, used everywhere |
| `lib/validations/transactions.ts` (`tagId`) | tag filter contract | ✓ VERIFIED | Present |
| `lib/dal/transactions.ts` (`tagId` + EXISTS condition) | narrows getTransactions | ✓ VERIFIED | Present, no leftJoin introduced |
| `lib/validations/dashboard.ts` (`parseTagIdParam`) | sync candidate parser | ✓ VERIFIED | Present |
| `lib/dal/tags.ts` (`resolveOwnedTagId`, `getTagTotals`, `TagTotalItem`, `buildTagTotalsData`) | IDOR helper + TAG-05 aggregate | ✓ VERIFIED | All present |
| `lib/dal/dashboard.ts` (5 functions threaded) | tag narrowing | ✓ VERIFIED | Confirmed via grep |
| `lib/dal/overview.ts` (3 functions + categorySlug) | tag narrowing + NAV-01 slug fix | ✓ VERIFIED | Confirmed |
| `lib/actions/overview.ts` (`fetchMovers` tagId) | defensive forwarding | ✓ VERIFIED | Confirmed |
| `lib/actions/tags.ts` (`archiveTagAction` 2nd revalidate) | cache-invalidation fix | ✓ VERIFIED | Confirmed |
| `components/dashboard/tag-filter-select.tsx` | filter control | ✓ VERIFIED | New file, matches spec |
| `components/dashboard/dashboard-tab-nav.tsx` (3rd tab) | Tag tab + tag param carry | ✓ VERIFIED | Confirmed |
| `app/(app)/dashboard/overview/page.tsx`, `.../categories/page.tsx`, `.../categories/[id]/page.tsx` | wired tag filter | ✓ VERIFIED | All 3 call `resolveOwnedTagId` before DAL |
| `components/dashboard/overview/overview-movers-panel.tsx` | NAV-01 Link wrap | ✓ VERIFIED | Confirmed |
| `app/(app)/dashboard/tags/page.tsx`, `tag-ranking-list.tsx`, `tag-ranking-skeleton.tsx` | TAG-05 page | ✓ VERIFIED | All present, wired |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `getTransactions(filters.tagId)` | `tagScopedTransactions(tagId)` | EXISTS, never JOIN | ✓ WIRED | `lib/dal/transactions.ts:338-339` |
| `resolveOwnedTagId(userId, candidateTagId)` | `getTag(userId, tagId)` | fail-closed ownership | ✓ WIRED | `lib/dal/tags.ts:135-143` |
| `getOverview(year, tagId)` | `getOverviewAmountTotals`/`getUncategorizedCount` | 4th tagId arg | ✓ WIRED | `lib/dal/overview.ts:136-139` |
| `fetchMovers(year, monthIndex, direction, tagId)` | `getMonthOverMonthCategoryChanges(..., 10, safeTagId)` | 5th arg | ✓ WIRED | `lib/actions/overview.ts:47-53` |
| `getTagTotals` | `FROM tag LEFT JOIN transaction_tag LEFT JOIN transaction ...` | zero-safe join direction | ✓ WIRED | `lib/dal/tags.ts:230-247` |
| `archiveTagAction` | `revalidatePath(tagSettings)` + `revalidatePath(dashboardTags)` | double revalidate | ✓ WIRED | `lib/actions/tags.ts:106-107` |
| `TagFilterSelect` | `?tag=` via `router.replace` | URL-state idiom | ✓ WIRED | `components/dashboard/tag-filter-select.tsx:48-53` |
| `buildDashboardTabHref` | `?tag=` forwarded across tab switches | conditional param set | ✓ WIRED | `components/dashboard/dashboard-tab-nav.tsx:22,36-38` |
| `CategoryRankingList` item Link | `buildDashboardCategoryDetailHref(id, {..., tag: tagId})` | detail-page href | ✓ WIRED | `category-ranking-list.tsx:109-113` |
| `MoverList` row Link | `/transactions?months=...&category={categorySlug}` | slug-based (never id) | ✓ WIRED | `overview-movers-panel.tsx:63-72` |
| `TagRankingList` card Link | `/transactions?tag={item.tagId}` | click-through | ✓ WIRED | `tag-ranking-list.tsx:73-80` |
| `TagRankingList` action area | `ArchiveTagDialog` (Phase 67, unchanged) | verbatim reuse | ✓ WIRED | `tag-ranking-list.tsx:99-111` |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| TAG-04 | 68-01, 02, 03, 05, 06 | Global dashboard tag filter, every widget narrows, totals reconcile | ✓ SATISFIED | All DAL threading + page wiring confirmed |
| TAG-05 | 68-01, 04, 08 | Tag section: independent per-tag totals, archive action, archived stay visible | ✓ SATISFIED | `getTagTotals` + `/dashboard/tags` page confirmed |
| NAV-01 | 68-03, 07 | Movers-row click-through to filtered transactions by category+month | ✓ SATISFIED | `overview-movers-panel.tsx` Link wrap confirmed |

No orphaned requirements — REQUIREMENTS.md's Phase 68 traceability row set (TAG-04, TAG-05, NAV-01) exactly matches the union of `requirements:` fields across all 8 plans.

### Anti-Patterns Found

None. Grepped all 22 files modified in this phase for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|placeholder|coming soon|not yet implemented` — zero matches.

**Code review advisories (non-blocking, informational only — from `68-REVIEW.md`, 0 critical / 5 warning):**
- WR-01: `getTagTotals` relies on the write-path ownership invariant (`assertOwnsAllTags`) rather than an explicit `userId` condition on the joined `transaction` row inside the query itself. Not a must-have violation (the plan only required no cross-user row leakage via `eq(tag.userId, userId)`, which holds), but a latent risk if a future write path bypasses the service-layer assertion.
- WR-02: `createTagAction`/`updateTagAction` don't revalidate `/dashboard/tags` (only `archiveTagAction` does) — this exactly matches the 68-04 plan's stated scope (only Task 2 touches `archiveTagAction`), so it is not a phase gap, just a review-flagged inconsistency for future cleanup.
- WR-03/WR-04: `fetchMovers` and `app/(app)/transactions/page.tsx` accept `tagId` without calling `resolveOwnedTagId`, unlike the 3 dashboard RSC pages. Structurally safe (both DAL calls scope by `eq(transaction.userId, userId)`), and neither was in the must_haves scope for those specific boundaries (68-01/68-06 only required `resolveOwnedTagId` at the 3 named dashboard pages).
- WR-05: `TagRankingList` fabricates a placeholder `TagRow` object for `ArchiveTagDialog`'s prop type (only `id`/`name`/`archived` are real; `userId`, `normalizedName`, dates are sentinel values). Harmless today since `ArchiveTagDialog` only reads `id`/`name`, but a latent trap if that dialog is later extended.

None of these five items contradict any must_have truth declared in the 8 phase plans; they are advisory improvements for a future pass.

### Behavioral Spot-Checks / Test Suite

- Full test suite: `yarn vitest run` → **137 test files passed, 1723 tests passed, 1 todo** (0 failures).
- `yarn check:language` → clean, no violations.
- Targeted phase test files (12 files, 275 tests) re-run in isolation → all passed.
- All phase commits present in git log (`4004424` review, `aca7c8b`/`52d37f8`/etc. per-plan commits) — matches SUMMARY claims, not just narrated.

### Human Verification Required

### 1. Tag-section caption with a very wide date range fits on one line

**Test:** Create (or seed) a tag whose transactions span several years (e.g., 2020–2026) so the caption reads something like "142 movimenti · 01/01/2020–31/12/2026", and view its card at common viewport widths (mobile ~375px, desktop) on `/dashboard/tags`.
**Expected:** The caption text (`text-xs text-muted-foreground`, no `line-clamp`/`truncate` applied) fits on one line without visually wrapping or overflowing the card.
**Why human:** This is a purely visual/rendering assertion — the code has no line-clamp or truncate class on this caption element (unlike the title, which does have `truncate`+`title=`), so whether the caption fits on one line depends on actual font metrics and real content width, which cannot be confirmed via static code inspection or grep.

### Gaps Summary

No gaps. All 3 roadmap Success Criteria and all plan-level must-haves across the 8 plans in this
phase are implemented and wired end-to-end: the EXISTS-based tag predicate is used everywhere
(never a JOIN, avoiding row fan-out), the IDOR defense-in-depth (`resolveOwnedTagId`) is applied at
every dashboard RSC page boundary, all dashboard widgets (Overview KPIs/chart/movers, Categorie
ranking/deviations, category drill-down) thread and apply `tagId`, the Tag section's per-tag total
is correctly all-time and dashboard-exclusion-aware via a zero-safe LEFT JOIN + `FILTER`, and the
NAV-01 movers-row click-through correctly uses `categorySlug` (never the numeric id). The single
item routed to human verification is a visual-only backstop assertion (long-caption line-wrapping)
that the plan itself flagged as non-automatable (`verification: backstop`) and cannot be resolved
by further code inspection.

---

_Verified: 2026-07-21_
_Verifier: Claude (gsd-verifier)_
