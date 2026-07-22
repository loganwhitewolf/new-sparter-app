# Phase 68: tags-dashboard-and-navigation - Research

**Researched:** 2026-07-21
**Domain:** Internal integration — threading a global filter predicate through an existing Drizzle/Next.js dashboard aggregation layer, plus a new read-time-total list view and cross-page navigation links. No new external library/framework surface.
**Confidence:** HIGH

## Summary

This phase has zero external-library risk — it is 100% internal wiring on top of code shipped in Phases 42-67. All three requirements (TAG-04, TAG-05, NAV-01) are solved by the same one recurring technique already used twice in this codebase (`isNotSecondary()` / `effectiveAmount()` in `lib/dal/transaction-pairs-sql.ts`): a **composable WHERE-EXISTS predicate function**, threaded as an optional parameter through the relevant DAL query, never a JOIN. This matters because `transaction_tag` is a genuine N:M table (a transaction may carry 2+ tags) — a naive `leftJoin(transactionTag, eq(transactionTag.transactionId, transaction.id))` would silently duplicate rows for any multi-tag transaction, corrupting every dashboard total and the paginated transactions list whenever a transaction carries more than one tag. An `EXISTS` subquery scoped to a single `tagId` never fans out, regardless of how many tags a transaction has.

There is **no single JOIN seam** to patch for TAG-04 — this codebase's dashboard DAL (`lib/dal/dashboard.ts`, `lib/dal/overview.ts`) does not have one shared query builder; every exported function (`getOverviewAmountTotals`, `getUncategorizedCount`, `getCategoryRanking`, `getCategoryDeviations`, `getOverviewChart`, `getMonthOverMonthCategoryChanges`) independently constructs its own `FROM transaction ... JOIN ...` chain and its own `and(...)` WHERE clause. TAG-04's real cost is not "one query" but **threading one new optional `tagId` parameter through ~6 already-existing exported DAL functions across two files**, plus the two React Server Component pages that call them (Overview tab, Categories tab) and the one client action (`fetchMovers`) that re-fetches movers on month click.

TAG-05 is additive and low-risk: `tag.archived` already exists on the schema (Phase 67, migration already applied) — **no migration needed**. The archive action (`archiveTag` / `archiveTagAction` / `ArchiveTagDialog`) already exists and is directly reusable; the only wiring gap is that `archiveTagAction` currently calls `revalidatePath(APP_ROUTES.tagSettings)` only, so the new dashboard Tag-section route needs its own revalidate call added.

NAV-01 surfaces one real mismatch worth flagging before planning: the transactions page's existing `category` filter param is validated and applied by **slug** (`categorySlug`, matched against `category.slug`), but `MonthOverMonthChange` (the movers-row data type) only carries a numeric `categoryId` + display `name` — no slug. The cheapest fix is adding `category.slug` to the two `getMonthOverMonthCategoryChanges` category-grain SELECTs (trivial, category is already joined) rather than inventing a new numeric `categoryId` transactions filter.

**Primary recommendation:** Add a single reusable `tagScopedTransactions(tagId?: number)` EXISTS-predicate helper (co-located with `isNotSecondary()`/`effectiveAmount()` in `lib/dal/transaction-pairs-sql.ts`, or a small sibling file), thread `tagId` as an optional parameter through the ~6 dashboard/overview DAL functions and the `fetchMovers` action, add `category.slug` to `MonthOverMonthChange`, add a `tag` searchParam to the transactions filter contract using the identical EXISTS predicate, and build TAG-05 as a new read-time aggregate query mirroring `getCategoryRanking`'s `LEFT JOIN ... COALESCE(0)` shape — reusing Phase 67's `archived` column and archive action verbatim.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TAG-04 | User can filter the dashboard globally by tag (like month/year): all existing widgets narrow to tagged transactions, sums always reconcile | Pattern 1 (`tagScopedTransactions` EXISTS predicate) + the full list of DAL functions requiring `tagId` threading in Recommended Project Structure/Architectural Responsibility Map; Pitfall 1 (fan-out risk) and Pitfall 4 (client re-fetch path) cover the two ways "narrows correctly" can silently break |
| TAG-05 | User can view the Tag section: every tag with its own independent per-tag total (no sum expectation), with archive action; archived tags stay interrogable | Pattern 2 (`getTagTotals` read-time zero-safe aggregate) + Don't Hand-Roll row (reuse `archiveTag`/`archiveTagAction`/`ArchiveTagDialog` verbatim, no migration needed — `tag.archived` already exists) + Pitfall 3 (revalidatePath gap) + Open Question 1 (total-scope ambiguity, flagged not guessed) |
| NAV-01 | From the dashboard with a month selected, each row of the savings/deviations view links to the transactions section with filters pre-applied matching the dashboard's current settings (month + row category context) | Pitfall 2 (slug-vs-id mismatch, the one real gotcha) + Code Examples (existing `MoverList`/`buildDashboardTabHref` shapes to extend) — confirms `months` + `category` searchParams are already fully supported by `parseTransactionFilters`/`getTransactions`, so no DAL-side work beyond selecting `category.slug` |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Global tag filter narrowing (TAG-04) | API/Backend (DAL query predicates) | Frontend Server (RSC pages read `?tag=`, pass to DAL) | The filter is a WHERE-clause concern; the RSC pages are pure plumbing (parse searchParam → pass to DAL call), no business logic in the browser tier |
| Tag filter Select control | Browser/Client | — | `'use client'` Select component reading/writing `?tag=` via `useSearchParams`/`router.replace`, exact pattern as existing `DashboardFilters`/`OverviewHeader` |
| Tag section per-tag totals (TAG-05) | API/Backend (DAL aggregate query) | Frontend Server (RSC page renders the list) | Read-time aggregate SUM/COUNT/MIN/MAX per tag — pure backend computation, mirrors `getCategoryRanking` |
| Tag archive action (TAG-05) | API/Backend (existing service/action) | — | Already fully built in Phase 67 (`archiveTag` service, `archiveTagAction`, `ArchiveTagDialog`) — this phase only adds a second `revalidatePath` call and a new render site |
| Movers-row → transactions click-through (NAV-01) | Browser/Client (href construction) | API/Backend (transactions DAL must already support `months` + `category` params — it does) | Pure `<Link href=...>` wiring in an existing client component (`MoverList`); no new backend logic beyond the `category.slug` SELECT addition |
| Tag-section card → transactions click-through | Browser/Client (href construction) | API/Backend (new `tag` filter param + EXISTS predicate) | Card `<Link href="/transactions?tag={id}">`; backend needs the new `tag` searchParam wired into `getTransactions` |

## Standard Stack

No new packages. This phase is 100% additive code on the existing verified stack:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.2 [VERIFIED: package.json] | SQL query builder, `sql\`EXISTS(...)\`` fragments | Already the sole DB layer; `isNotSecondary()` in `lib/dal/transaction-pairs-sql.ts` is the direct precedent for the new tag predicate |
| decimal.js | ^10.6.0 [VERIFIED: package.json] | Money arithmetic for per-tag totals | Project-wide hard rule (CLAUDE.md); `toDecimal`/`toFixed(2)` used identically to `buildCategoryRankingData` |
| zod | ^4.4.2 [VERIFIED: package.json] | Validating the new `tag` transactions searchParam and any new dashboard-filter searchParam | Matches existing `lib/validations/transactions.ts` / `lib/validations/dashboard.ts` conventions |
| next | 16.2.4 [VERIFIED: package.json] | App Router RSC pages, Server Actions | No API changes required for this phase — reuses `useSearchParams`/`router.replace`/`revalidatePath` exactly as existing dashboard/tag code does |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `EXISTS` subquery predicate for tag scoping | `LEFT/INNER JOIN transactionTag` filtered by a fixed `tagId` | A join filtered by one fixed `tagId` is *also* safe (unique `(tagId, transactionId)` constraint means at most 1 matching row), but an `EXISTS` predicate is strictly safer against future refactors that might drop the `tagId` filter accidentally, requires no `GROUP BY` column changes in aggregate queries, and matches the codebase's existing `isNotSecondary()` idiom exactly — prefer `EXISTS` everywhere. |
| Adding `category.slug` to `MonthOverMonthChange` | Adding a new numeric `categoryId` filter param to the transactions contract, parallel to `subCategoryId` | Duplicating the numeric-ID filter path is more invasive (new validation, new DAL condition, new UI wiring) for a problem the existing slug-based `category` param already solves once `category.slug` is selected — reject unless product later needs ID-based filtering for a reason unrelated to this phase. |

**Installation:** none — no `npm install` required for this phase.

**Version verification:** Confirmed directly from `package.json` (`drizzle-orm ^0.45.2`, `decimal.js ^10.6.0`, `zod ^4.4.2`, `next 16.2.4`, `vitest ^4.1.5`) — no registry lookup needed since no new packages are introduced.

## Package Legitimacy Audit

Not applicable — this phase introduces no new npm packages. No `Package Legitimacy Gate` run required.

**Packages removed due to [SLOP] verdict:** none — no new packages proposed.
**Packages flagged as suspicious [SUS]:** none — no new packages proposed.

## Architecture Patterns

### System Architecture Diagram

```
                     ?tag=<id>&preset=...&year=...
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                            │
 /dashboard/overview                      /dashboard/categories
 (page.tsx, RSC)                          (page.tsx, RSC)
        │                                            │
        │ parses year + tag                          │ parseDashboardFilters + tag
        ▼                                            ▼
 getOverview(year, tagId) ──┐              getCategoryRanking(filters, tagId)
 getOverviewChart(year,tagId)              getCategoryDeviations(input, tagId)
 getMonthOverMonthCategoryChanges(          (lib/dal/dashboard.ts)
   year, month, dir, tagId)                       │
 (lib/dal/overview.ts)                             │
        │                                          │
        ▼                                          ▼
   shared predicate: dateScopedTransactions() + expenseStatusIncludedInDashboardTotals()
                    + isNotSecondary() + tagScopedTransactions(tagId)   ◄── NEW, single helper
        │                                          │
        ▼                                          ▼
                     PostgreSQL: transaction ⋈ expense ⋈ subCategory ⋈ category ⋈ nature ⋈ direction
                     (+ EXISTS subquery against transaction_tag when tagId is set)

──────────────────────────────────────────────────────────────────────────────────

  Tag section (new tab, /dashboard/tags)                Movers row click (NAV-01)
        │                                                        │
        ▼                                                        ▼
  getTagTotals(userId)  ── NEW DAL fn                    <Link href="/transactions
   LEFT JOIN transaction_tag + transaction                  ?months={y}-{m}&category={slug}">
   COALESCE(0), GROUP BY tag.id                                   │
        │                                                        ▼
        ▼                                            /transactions (existing page, existing
  Tag-section card <Link href="/transactions           parseTransactionFilters + getTransactions)
   ?tag={tagId}">  ── uses NEW `tag` searchParam              │
        │                                                     ▼
        └──────────────────────────────────────────►  conditions.push(tagScopedTransactions(tagId))
                                                        (same EXISTS helper, reused a 3rd time)
```

### Recommended Project Structure

No new top-level folders. Additions land inside existing directories:

```
lib/
├── dal/
│   ├── dashboard.ts          # MODIFY: thread tagId through getOverviewAmountTotals,
│   │                         #   getUncategorizedCount, getCategoryRanking, getCategoryDeviations
│   ├── overview.ts           # MODIFY: thread tagId through getOverview, getOverviewChart,
│   │                         #   getMonthOverMonthCategoryChanges; add category.slug to select
│   ├── transaction-pairs-sql.ts  # MODIFY (or new sibling file): add tagScopedTransactions(tagId)
│   ├── tags.ts                # MODIFY: add getTagTotals(userId) for TAG-05
│   └── transactions.ts        # MODIFY: add tagId to TransactionFilters + getTransactions WHERE
├── validations/
│   ├── dashboard.ts           # MODIFY: add tag searchParam parsing shared by both dashboard tabs
│   └── transactions.ts        # MODIFY: add `tag` to ParsedTransactionFilters + parse function
└── actions/
    └── overview.ts             # MODIFY: fetchMovers accepts + forwards tagId

app/(app)/dashboard/
├── overview/page.tsx           # MODIFY: read ?tag=, pass to getOverview/getOverviewChart/movers
├── categories/page.tsx         # MODIFY: read ?tag=, pass to getCategoryRanking/getCategoryDeviations
└── tags/                       # NEW route (TAG-05) — page.tsx (RSC), mirrors categories/page.tsx shape

components/dashboard/
├── dashboard-tab-nav.tsx        # MODIFY: add third "Tag" tab; buildDashboardTabHref carries `tag`
├── tag-filter-select.tsx        # NEW: shared client Select, used by both Overview and Categories tabs
├── overview/overview-movers-panel.tsx   # MODIFY: wrap MoverList <li> rows in <Link>
└── tag-ranking-list.tsx         # NEW: TAG-05 card list, mirrors category-ranking-list.tsx shell
```

### Pattern 1: WHERE-EXISTS predicate for N:M tag scoping (never a JOIN)

**What:** A tiny function returning a raw SQL `EXISTS(...)` fragment, added to the `and(...)` conditions array only when a filter value is present — exactly the existing `isNotSecondary()` idiom.

**When to use:** Any query that must narrow to "transactions carrying tag X" without risking row duplication, whether the query is a paginated list (`getTransactions`) or an aggregate (`getOverviewAmountTotals`, `getCategoryRanking`, etc).

**Example:**
```typescript
// Source: existing precedent, lib/dal/transaction-pairs-sql.ts (isNotSecondary/effectiveAmount)
// New sibling helper — same shape, same file or lib/dal/transaction-tags-sql.ts
export function tagScopedTransactions(tagId?: number) {
  if (!tagId) return undefined // caller's and(...) already drops `undefined` conditions
  return sql`EXISTS (
    SELECT 1 FROM transaction_tag tt
    WHERE tt.transaction_id = ${transactionTable.id}
      AND tt.tag_id = ${tagId}
  )`
}

// Usage inside any existing WHERE builder (matches dateScopedTransactions/isNotSecondary call sites):
.where(
  and(
    dateScopedTransactions(userId, from, to),
    expenseStatusIncludedInDashboardTotals(),
    isNotSecondary(),
    tagScopedTransactions(tagId),   // <- new, no-op when tagId is undefined
  )
)
```
Verified via direct read of `lib/dal/transaction-pairs-sql.ts` (existing `isNotSecondary()`/`effectiveAmount()` functions) and `lib/dal/dashboard.ts` (every exported function's `and(...)` call site). `[VERIFIED: codebase]`

### Pattern 2: Read-time zero-safe aggregate list (TAG-05 mirrors GRP-03/getCategoryRanking)

**What:** `LEFT JOIN` from the owning entity (here: `tag`, not `transaction`) so entities with **zero** matching child rows still appear with a `COALESCE(0)` total — the same pattern Expense Group totals (GRP-03) and `getCategoryRanking` already use.

**Example:**
```typescript
// Source: pattern derived from lib/dal/dashboard.ts's getCategoryRanking (verified read)
export async function getTagTotals(userId: string): Promise<TagTotalItem[]> {
  const rows = await db
    .select({
      tagId: tag.id,
      tagName: tag.name,
      archived: tag.archived,
      count: countDistinct(transactionTable.id),
      minDate: sql<string | null>`MIN(${transactionTable.occurredAt})`,
      maxDate: sql<string | null>`MAX(${transactionTable.occurredAt})`,
      // No status/direction/pair filtering here per the design note "tag = filter, never
      // breakdown" — an OPEN QUESTION below covers whether transfer-direction and paired
      // transactions should be excluded/netted the same way dashboard totals are.
      total: sql<string>`coalesce(sum(${transactionTable.amount}::numeric), 0)::text`,
    })
    .from(tag)
    .leftJoin(transactionTag, eq(transactionTag.tagId, tag.id))
    .leftJoin(transactionTable, eq(transactionTag.transactionId, transactionTable.id))
    .where(eq(tag.userId, userId))
    .groupBy(tag.id, tag.name, tag.archived)
  // sort by ABS(total) desc, per UI-SPEC's "Sort: by absolute total descending (default)"
}
```

### Anti-Patterns to Avoid

- **Unconditional `leftJoin(transactionTag, eq(transactionTag.transactionId, transaction.id))` in `getTransactions` or any dashboard aggregate:** fans out one row per tag on any multi-tag transaction, silently duplicating amounts in every SUM/COUNT downstream. Always use the `EXISTS` predicate (Pattern 1) for filtering; only use a `LEFT JOIN` when you actually need `tag.*` columns in the SELECT (TAG-05's own query, where the join direction is `FROM tag LEFT JOIN transactionTag` — never `FROM transaction JOIN transactionTag`).
- **Filtering `category` by numeric ID instead of slug in the transactions contract:** the existing `category` searchParam is validated against `CATEGORY_SLUG_RE` and matched via `eq(category.slug, filters.categorySlug)` — passing a numeric id here silently matches nothing (regex rejects digits-only unless it happens to look like a slug). NAV-01 must select `category.slug` in `getMonthOverMonthCategoryChanges` and build the href with the slug, not `m.categoryId`.
- **Threading `tagId` only into the Overview tab and forgetting the Categories tab (or vice-versa):** TAG-04's acceptance criterion is explicitly "EVERY existing widget narrows" — both dashboard sub-routes must read and forward `?tag=`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tag CRUD / archive lifecycle | A new archive mutation or dialog | `archiveTag` (lib/services/tag-operations.ts), `archiveTagAction` (lib/actions/tags.ts), `ArchiveTagDialog` (components/tags/tag-mutation-dialogs.tsx) | Already shipped and tested in Phase 67; TAG-05 only needs a second `revalidatePath` call added for the new render location, not a new archive code path |
| Refund/pair-aware amount netting | A new "net amount" calculation for tag totals | `effectiveAmount()` / `isNotSecondary()` (lib/dal/transaction-pairs-sql.ts) — IF the plan decides tag totals should net pairs the same way dashboard totals do (see Open Questions) | These two functions must always be used together (per their own doc comments) — a new hand-rolled netting calc would silently diverge on refund-pair edge cases already solved here |
| Money formatting/arithmetic for per-tag totals | Native `+`/`-`/toFixed on strings | `Decimal.js` via `@/lib/utils/decimal` (`toDecimal`, `toFixed(2)`) | Project-wide hard rule (CLAUDE.md); `DECIMAL` columns are strings from Drizzle |
| URL/searchParam state for the tag filter | A new client-side state store (Context, Zustand, etc.) | `useSearchParams` + `router.replace` (existing `DashboardFilters`/`OverviewHeader` pattern) | Every other dashboard filter (preset, type, sort, year) already uses this exact idiom; a new state mechanism would be an unjustified fork |

**Key insight:** Nearly everything TAG-04/TAG-05/NAV-01 need already exists as a reusable primitive somewhere in Phases 42-67 (deviation ranking, expense-group read-time totals, transaction pairing predicates, tag CRUD/archive). This phase's actual net-new code is small: one predicate helper, one aggregate query, one searchParam, and several thin parameter-threading edits.

## Common Pitfalls

### Pitfall 1: Row fan-out from joining `transaction_tag` without pinning `tagId`
**What goes wrong:** Any dashboard total or the transactions list silently doubles/triples amounts for transactions that carry 2+ tags.
**Why it happens:** `transaction_tag` is a genuine N:M table (Phase 67: "a transaction may carry N tags"); a plain `LEFT JOIN` on `transactionId` alone returns one row per tag.
**How to avoid:** Use the `EXISTS` predicate (Pattern 1) for every filtering use of `transaction_tag`; only join `FROM tag` (not `FROM transaction`) when the query genuinely needs one row per tag (TAG-05's own aggregate).
**Warning signs:** Dashboard totals reconcile incorrectly only for users who have multi-tagged transactions — easy to miss in manual testing with single-tag test data.

### Pitfall 2: Category filter by ID where the contract expects a slug
**What goes wrong:** NAV-01's href `?category={m.categoryId}` (a number) silently fails to filter anything, because `parseTransactionFilters` validates `category` against `CATEGORY_SLUG_RE` and the DAL matches `category.slug`.
**Why it happens:** `MonthOverMonthChange` (movers data) only carries `categoryId`/`name`; the developer's first instinct is to pass the id straight through since that's what's in hand.
**How to avoid:** Add `category.slug` to the two category-grain SELECTs in `getMonthOverMonthCategoryChanges` (in/out grain only — allocation grain groups by nature, out of NAV-01 scope) and to the `MonthOverMonthChange` type; build the href with the slug.
**Warning signs:** Clicking a movers row navigates but the transactions list shows unfiltered results (no error, just silently wrong).

### Pitfall 3: `archiveTagAction`'s single hardcoded `revalidatePath`
**What goes wrong:** Archiving a tag from the new dashboard Tag section leaves the dashboard's own cached RSC tree stale (shows the tag as still active) even though `/settings/tags` correctly revalidates.
**Why it happens:** `archiveTagAction` (lib/actions/tags.ts) calls `revalidatePath(APP_ROUTES.tagSettings)` only — it has no knowledge of the new dashboard route.
**How to avoid:** Add a second `revalidatePath(APP_ROUTES.dashboardTags)` (or the chosen route constant) call inside `archiveTagAction` — cheap, safe, matches the multi-revalidate pattern already used elsewhere in this codebase when one action affects multiple routes.
**Warning signs:** UAT step "archive a tag from the dashboard Tag section, confirm it still shows Archiviato badge without a manual refresh" fails.

### Pitfall 4: Forgetting to thread `tagId` through the client-side `fetchMovers` re-fetch path
**What goes wrong:** Initial page load correctly narrows the movers panel to the tag filter (server-fetched), but clicking a different month bar re-fetches movers via the `fetchMovers` Server Action and silently drops the tag filter, because `OverviewMoversSection`'s `handleMonthSelect` only calls `fetchMovers(year, monthIndex, direction)` with no tag parameter.
**Why it happens:** The interactive month-selection re-fetch is a separate code path (`lib/actions/overview.ts`) from the initial RSC data fetch (`app/(app)/dashboard/overview/page.tsx`) — easy to update one and miss the other.
**How to avoid:** Thread `tagId` through `OverviewMoversSection`'s props, its `handleMonthSelect` closure, and the `fetchMovers` action signature (with the same closed-enum-style validation `fetchMovers` already applies to `year`/`monthIndex`/`direction`).
**Warning signs:** Switching the month after a tag filter is active makes the movers panel "un-narrow" back to all transactions — a subtle, easy-to-miss regression in manual testing.

### Pitfall 5: Tag totals scope ambiguity (all-time vs. reconciliation with dashboard exclusions)
**What goes wrong:** Two reasonable implementations of `getTagTotals` diverge: (a) a raw `SUM(transaction.amount)` over every transaction carrying the tag regardless of category status/direction, vs. (b) the same exclusions the rest of the dashboard applies (`expenseStatusIncludedInDashboardTotals()`, `direction.code != 'transfer'`, `effectiveAmount()`/`isNotSecondary()` pair-netting). The UI-SPEC locks *scope* (all-time, not period-scoped) but does not lock *which transactions count* toward the total.
**Why it happens:** A tag can be assigned to any transaction, including uncategorized ones and transfers (TAG-02 has no restriction), so "the tag's own total" is philosophically different from "the dashboard's uscite/entrate total."
**How to avoid:** This is a genuine open question — see below. Recommend surfacing it in `/gsd-discuss-phase` or the plan's assumptions before implementation, not guessing silently.
**Warning signs:** A user tags a still-uncategorized transaction and is confused whether it's included in the tag's total.

## Code Examples

### Existing composable-predicate idiom (the direct precedent for the new tag predicate)
```typescript
// Source: lib/dal/transaction-pairs-sql.ts (verified read, this repo)
export function isNotSecondary() {
  return sql`NOT EXISTS (
    SELECT 1 FROM transaction_pair tp
    WHERE tp.transaction_b_id = ${transactionTable.id}
  )`
}
```

### Existing zero-safe read-time aggregate idiom (the direct precedent for getTagTotals)
```typescript
// Source: lib/dal/dashboard.ts getCategoryRanking (verified read, this repo) — abbreviated
rows = await db
  .select({
    categoryId: category.id,
    amount: sql<string>`coalesce(abs(sum(${effectiveAmount()})), 0)::text`,
  })
  .from(transactionTable)
  .innerJoin(expense, eq(transactionTable.expenseId, expense.id))
  // ...
  .groupBy(category.id, monthSql, direction.code)
  .orderBy(desc(sql`coalesce(abs(sum(${effectiveAmount()})), 0)`), category.id, monthSql)
```

### Existing tab-nav searchParam-carrying idiom (extend for `tag`)
```typescript
// Source: components/dashboard/dashboard-tab-nav.tsx (verified read, this repo)
export function buildDashboardTabHref(
  href: string,
  searchParams: Pick<URLSearchParams, 'get'>
) {
  const params = new URLSearchParams()
  const preset = searchParams.get('preset')
  const type = searchParams.get('type')
  const sort = searchParams.get('sort')
  // ADD: const tag = searchParams.get('tag'); if (tag) params.set('tag', tag)
  if (preset) params.set('preset', preset)
  if (type) params.set('type', type)
  if (sort) params.set('sort', sort)
  const search = params.toString()
  return href + (search ? `?${search}` : '')
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Dashboard had only month/year + type/preset filters | Adds a third orthogonal filter axis (tag) | Phase 68 | Every dashboard aggregate DAL function gains one more optional parameter — the pattern (optional param, EXISTS predicate) is additive, no breaking signature changes needed if the new param is placed last with a default |

**Deprecated/outdated:** none — this phase does not remove or replace any existing dashboard behavior.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Tag-section per-tag total (TAG-05) should apply the same exclusions as the rest of the dashboard (`expenseStatusIncludedInDashboardTotals()`, exclude `transfer` direction, apply `effectiveAmount()`/`isNotSecondary()` pair-netting) rather than a raw unfiltered SUM of every transaction carrying the tag. `[ASSUMED]` | Common Pitfalls (Pitfall 5), Pattern 2 | If wrong, the per-tag total either double-counts refund pairs or includes noise (transfers) that the rest of the app deliberately hides — visible discrepancy between a tag's total and what a user expects from "the transactions behind this tag" |
| A2 | The `/dashboard/tags` route path is the correct location for the new Tag section (UI-SPEC itself flags this as "a default assumption — no explicit route was locked upstream"). `[ASSUMED]` | Recommended Project Structure | Low risk — a route rename before ship is a cheap, mechanical change (one route constant + one folder rename), no data model impact |
| A3 | The category-detail drill-down sub-route (`/dashboard/categories/[id]`, `getCategoryDetail`) is NOT required to honor the tag filter, since neither REQUIREMENTS.md nor the UI-SPEC explicitly names it among "every existing widget." `[ASSUMED]` | Architectural Responsibility Map, Common Pitfalls | If TAG-04's acceptance bar is read to include the drill-down page, an extra DAL function (`getCategoryDetail`) and its 3 sub-queries need the same `tagId` threading — moderate additional scope, should be confirmed in discuss-phase or the plan itself before being silently descoped |
| A4 | The transactions page needs no new visible "active tag filter" chip/control in `TransactionsToolbar` for the `?tag=` click-through — following the existing silent `importId` filter precedent (clicking a file name narrows the list with no dedicated toolbar UI). `[ASSUMED]` | Common Pitfalls, Don't Hand-Roll | Low-to-moderate UX risk: a user landing on a tag-filtered transactions list with no visual indicator of *why* the list is narrowed may be confused; acceptable given the existing precedent, but worth a product call |

**If this table is empty:** N/A — see rows above; all four should be confirmed or explicitly accepted before/while planning.

## Open Questions

> **RESOLVED by user (2026-07-21) — planner MUST treat these as locked, not open:**
> 1. **Per-tag total base → SAME EXCLUSIONS AS THE DASHBOARD.** The Tag-section per-tag total applies the same pair-netting + secondary/refund-leg exclusion + pending exclusion + direction semantics as every other dashboard total (reuse `isNotSecondary()`/`effectiveAmount()` and the netting-aware JOIN chain). The number MUST match what the user sees filtering transactions by that tag. NOT a raw two-table SUM.
> 2. **Category drill-down (`getCategoryDetail`) IS in TAG-04 scope.** The `?tag=` filter must narrow the category drill-down sub-route too — "every widget narrows" is taken literally; no dashboard surface escapes the tag filter. Thread `tagId` into `getCategoryDetail` as well.
> 3. **Helper location → new sibling `lib/dal/transaction-tags-sql.ts`** (planner takes the researcher's recommendation below).
>
> The original analysis is retained below for context.

1. **Does the Tag-section per-tag total (TAG-05) apply the same status/direction/pair-netting exclusions as the rest of the dashboard, or is it a raw SUM of every transaction carrying the tag?**
   - What we know: UI-SPEC locks the total as *all-time* and *sign-colored* (can be net positive or negative), matching the netting-aware pattern used elsewhere. REQUIREMENTS.md only says "independent per-tag total (no sum expectation)."
   - What's unclear: Whether an uncategorized or transfer-direction transaction that happens to carry a tag should count toward that tag's total.
   - Recommendation: Default to A1 (apply the same exclusions dashboard totals use) since a tag is fundamentally a lens over "real" spending/income the same way the rest of the app defines it, but confirm before/at plan time — this changes the query's JOIN chain (adds expense/subCategory/nature/direction joins) vs. a much simpler two-table query.

2. **Should `getCategoryDetail` (category drill-down page) also honor the `?tag=` filter?**
   - What we know: Not named explicitly in REQUIREMENTS.md or UI-SPEC's "Design Contract Details."
   - What's unclear: Whether "EVERY existing widget narrows" (TAG-04's literal wording) extends past the two dashboard tabs into their drill-down sub-route.
   - Recommendation: Descope explicitly in the plan (A3) unless discuss-phase/user says otherwise — smallest correct interpretation of the locked UI-SPEC scope, with a clear one-line note in the plan so it's a deliberate choice, not an oversight.

3. **Where does the reusable `tagScopedTransactions()` predicate helper live?**
   - What we know: `isNotSecondary()`/`effectiveAmount()` (its direct precedent) live in `lib/dal/transaction-pairs-sql.ts`, a file dedicated to transaction-pairing SQL fragments — not a natural home for a tag-scoping predicate.
   - What's unclear: Whether to add it there anyway (co-locate all "composable WHERE predicate" helpers in one file) or create a new `lib/dal/transaction-tags-sql.ts` sibling.
   - Recommendation: New sibling file (`lib/dal/transaction-tags-sql.ts`) — keeps `transaction-pairs-sql.ts` scoped to pairing concerns only, mirrors the existing `transaction-tags.ts` DAL file naming already established in Phase 67.

## Environment Availability

Skipped — this phase has no new external tool/service/runtime dependencies. All required infrastructure (PostgreSQL via Drizzle, Next.js 16 App Router, existing `tag`/`transaction_tag` schema) is already live and verified working (Phase 67 shipped and is in `verifying` status per STATE.md).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.5 [VERIFIED: package.json] |
| Config file | `vitest` run via `"test": "vitest run"` in package.json (no separate vitest.config visible at repo root scan — uses default/co-located config) |
| Quick run command | `yarn vitest run tests/<file>.test.ts` |
| Full suite command | `yarn test` (→ `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TAG-04 | `tagScopedTransactions(tagId)` returns `undefined` when no tagId, an EXISTS fragment otherwise | unit | `yarn vitest run tests/dashboard-dal.test.ts` (extend existing file) | ✅ existing file, extend |
| TAG-04 | `getOverviewAmountTotals`/`getCategoryRanking`/etc. narrow correctly when `tagId` set, unchanged when absent | unit | `yarn vitest run tests/dashboard-dal.test.ts tests/overview-dal.test.ts` | ✅ existing files, extend |
| TAG-05 | `getTagTotals` returns zero-total rows for tags with no transactions (LEFT JOIN + COALESCE(0)) | unit | `yarn vitest run tests/tags-dal.test.ts` (extend) | ✅ existing file, extend |
| TAG-05 | Archive action revalidates the new dashboard route | unit/integration | `yarn vitest run tests/tag-actions.test.ts` (extend) | ✅ existing file, extend |
| NAV-01 | Movers row builds correct `/transactions?months=...&category=<slug>` href | unit | `yarn vitest run tests/overview-movers.test.tsx` (extend) | ✅ existing file, extend |
| tag click-through | `parseTransactionFilters` accepts and validates `?tag=` as a positive integer | unit | `yarn vitest run lib/validations/__tests__/transactions.test.ts` | ✅ existing file, extend |
| tag click-through | `getTransactions` narrows correctly via EXISTS predicate, never duplicates multi-tag rows | unit | new test in a transactions-DAL test file (verify no existing `tests/transactions-dal.test.ts` — check at plan time) | ⚠️ verify at Wave 0 |

### Sampling Rate
- **Per task commit:** targeted `yarn vitest run <touched test file>`
- **Per wave merge:** `yarn test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- Confirm whether a dedicated `tests/transactions-dal.test.ts` exists for `getTransactions` — repo scan found DAL tests for dashboard/overview/tags/transaction-tags but the plan must verify the transactions DAL's own test file name/location before adding the tag-filter test case.
- No new framework/config install needed — Vitest is already fully configured and used identically for DAL-mock-style tests across dashboard.ts/overview.ts/tags.ts.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Unaffected — reuses existing `verifySession()` on every touched DAL/action entry point |
| V3 Session Management | no | Unaffected |
| V4 Access Control (IDOR) | yes | `tagId`/`categorySlug`/`month` are user-controlled URL params on every touched surface; ownership is enforced transitively (see below), not via a new explicit check per param |
| V5 Input Validation | yes | New `tag` searchParam must be validated as a positive integer (zod/manual parse, mirroring `subCategoryId`'s existing `Number.isInteger(...) && > 0` pattern) before reaching any DAL query |
| V6 Cryptography | no | Not touched |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR via `?tag={otherUsersTagId}` on the dashboard filter or transactions click-through | Tampering / Information Disclosure | Ownership is enforced **transitively**: the `EXISTS` predicate only matches `transaction_tag` rows, and every transaction row involved is already scoped by `eq(transaction.userId, userId)` in the same WHERE clause. A `tagId` belonging to another user simply matches zero rows (no data leak), because `bulkAssignTags`/`bulkInsertTransactionTags` (Phase 67) enforce dual tag+transaction ownership at *write* time, so no `transaction_tag` row can ever link another user's `tagId` to this user's transactions. `[VERIFIED: codebase — lib/dal/transaction-tags.ts, lib/services/tag-assignment.ts write-path]`. Recommend an explicit `getTag(userId, tagId)` existence check at the page/action boundary as cheap defense-in-depth (fail closed / ignore the param on a miss) rather than relying solely on the transitive argument. |
| SQL injection via raw `sql\`...\`` EXISTS fragment | Tampering | Use Drizzle's tagged-template parameter interpolation (`${tagId}`) exactly as `isNotSecondary()`/`effectiveAmount()` already do — never string-concatenate the value into the fragment. |
| Unvalidated `category` slug / `months` array reaching the transactions DAL from a movers-row-built href | Tampering | Already mitigated by existing `parseTransactionFilters` regex/format validation (`CATEGORY_SLUG_RE`, `parseMonths`) — the new href construction only needs to produce values that already pass this existing validation, no new validation code required on the read side. |

## Sources

### Primary (HIGH confidence — direct codebase reads, this session)
- `lib/dal/dashboard.ts`, `lib/dal/overview.ts`, `lib/dal/transactions.ts`, `lib/dal/tags.ts`, `lib/dal/transaction-tags.ts`, `lib/dal/transaction-pairs-sql.ts` — full reads, this session
- `lib/validations/transactions.ts`, `lib/validations/dashboard.ts` — full reads, this session
- `lib/actions/tags.ts`, `lib/actions/overview.ts`, `lib/services/tag-operations.ts` — full reads, this session
- `components/dashboard/dashboard-tab-nav.tsx`, `components/dashboard/dashboard-filters.tsx`, `components/dashboard/overview/overview-movers-panel.tsx`, `components/dashboard/overview/overview-movers-section.tsx`, `components/dashboard/overview/overview-header.tsx`, `components/dashboard/category-ranking-list.tsx`, `components/dashboard/category-ranking-skeleton.tsx`, `components/dashboard/category-detail-empty-state.tsx`, `components/tags/tag-mutation-dialogs.tsx` — full reads, this session
- `app/(app)/dashboard/overview/page.tsx`, `app/(app)/dashboard/categories/page.tsx`, `app/(app)/dashboard/categories/[id]/page.tsx`, `app/(app)/dashboard/layout.tsx`, `app/(app)/transactions/page.tsx`, `app/(app)/settings/tags/page.tsx` — full/partial reads, this session
- `lib/db/schema.ts` (tag + transactionTag table definitions) — grep-confirmed, this session
- `.planning/phases/67-tags-foundation-and-assignment/` SUMMARY files — referenced by directory listing (schema/DAL facts cross-checked directly against the shipped code, not solely the summaries)
- `package.json` — version verification for drizzle-orm, decimal.js, zod, next, vitest

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/phases/68-tags-dashboard-and-navigation/68-UI-SPEC.md`, `CONTEXT.md` — locked project decisions, read this session

### Tertiary (LOW confidence)
- None — this phase required no external web research; all findings are direct, verified reads of this repository's own code.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, versions read directly from package.json
- Architecture: HIGH — every claim about existing query shapes, joins, and predicates is a direct file read, not an inference
- Pitfalls: HIGH — each pitfall is derived from a concrete, verified code shape (e.g., the slug/id mismatch is a direct comparison of two real files)

**Research date:** 2026-07-21
**Valid until:** 30 days (stable internal codebase, no fast-moving external dependency)
