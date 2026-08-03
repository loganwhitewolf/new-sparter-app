# Phase 83: categories-list - Research

**Researched:** 2026-07-30
**Domain:** Dashboard list rewrite — year-scoped category ranking with inline projections
**Confidence:** HIGH — decisions locked in ADR 0020; Phase 82 exports verified; codebase inspection complete

## Summary

Phase 83 rewrites the Categories list page onto the yearly axis. The implementation is constrained by 15 locked decisions from ADR 0020 and `.planning/dashboard-categories-DECISIONS.md`. Phase 82 already shipped the number engine (`getCoveredMonthsInYear`, `computePaceAndProjection`, `buildYearSeries`); Phase 83 consumes it without re-deriving pace, projection, or coverage logic.

The critical technical decisions:

1. **Ranking data path**: Query reshape vs. new DAL function — both viable; choice deferred to Claude's Discretion in CONTEXT.md. `getCategoryMonthlyAmounts` per row composition is cost-effective for ~26 categories.
2. **Direction predicate flip (D-09)**: Changes Categories from `eq(direction.includedInTotals, true)` to `eq(direction.hidden, false)`, surfacing Accantonamenti. Overview/Tags remain byte-identical — only Categories touches `getCategoryRanking`/`getCategoriesBreakdown` (which no other surface calls).
3. **URL contract (D-12)**: Year replaces preset; `?year=` shared with Overview via `buildDashboardTabHref` (not yet updated); `?lens=` carries invisibly.
4. **Detail page scope**: Phase 84 deletes Deviation/Preset machinery; Phase 83 only stops using it on the list. All seven `direction.includedInTotals` callers remain live for Phase 84.
5. **Decimal.js**: Share-of-total and all money already use `Decimal.js` via `computeBreakdownPercentages` and `toDbDecimal`. No custom rounding needed.
6. **Testing**: Real Postgres harness (`sparter_test`, `reimbursement-test-db.ts`); RETIRE-05 baseline in `pace-engine-lens-regression.test.ts` must pass unchanged after predicate flip.

**Primary recommendation:** Reshape `getCategoryRanking` to year-scoped with predicate flip; compose with Phase 82's functions for per-row series; delete `buildCategoryRankingData`'s hardcoded `allocation`/`transfer` filter logic (moved to query-level predicate).

## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01…D-15 from ADR 0020)

- **D-01**: Year is the container; list has no month selection.
- **D-02**: Controls are year + direction only; no window.
- **D-03**: No previous-year comparison column on the row.
- **D-04**: Row fields: name · year total · % of total · 12-month sparkline · year-end projection (exactly).
- **D-05**: Projection is inline, visually subordinate, explicitly labelled (D-06).
- **D-07**: Period total = sum of displayed 12-month series (Phase 82's `buildYearSeries` invariant).
- **D-08**: Default sort: period total; alternative: projection (reuse `SortToggle`, swap option set).
- **D-09**: Direction filter: Uscite / Entrate / Accantonamenti (predicate: `eq(direction.hidden, false)`).
- **D-10**: Phase 82's RETIRE-05 byte-identical Overview/Tags baseline must pass unchanged after D-09 flip.
- **D-11**: One copy set per direction, centrally (reuse Phase 82's `resolveComparisonJudgement`).
- **D-12**: Only `year` shared across tabs; list stops reading `?preset=` (no parse, no fallback); `?lens=` carries invisibly.
- **D-13**: Row link to detail carries same year (coherence test D-02).
- **D-14**: One Covered Month state: show certain figures + explicit nudge (reuse `OverviewNudge` pattern).
- **D-15**: Below 2 Covered Months: consume Phase 82's discriminated-union branch (no numeric field).

### Claude's Discretion

- Exact Italian copy strings per direction and for single-Covered-Month nudge.
- Visual treatment of projection subordination (size, weight, colour, label placement).
- Sparkline rendering (reuse or adapt `category-sparkline.tsx`).
- **Ranking data path:** New DAL function vs. reshaped `getCategoryRanking` vs. composing `getCategoryMonthlyAmounts` per row.
- Loading/skeleton shape; whether `category-ranking-skeleton.tsx` needs reshaping.
- Test placement and fixture strategy.

### Deferred Ideas (OUT OF SCOPE)

- Acceleration ordering (projection ÷ total) as a third sort option — Phase 83 future, not this phase.
- Twelve-month detail table, window selector, subcategory contributions — Phase 84.
- Code deletion (Deviation/Preset) — Phase 84 (RETIRE-01, RETIRE-02).

## Phase Requirements

| Requirement | Description | Phase |
|---|---|---|
| CLIST-01 | Year's categories ranked by total, each with % share and 12-month sparkline | 83 |
| CLIST-02 | Year-end projection inline, visually subordinate, explicitly labelled | 83 |
| CLIST-03 | Re-order list by projection via existing sort control | 83 |
| CLIST-04 | Direction switch: Uscite / Entrate / Accantonamenti (first time reachable) | 83 |
| CLIST-05 | Selected year shared with Overview via `?year=` parameter | 83 |
| CLIST-06 | One Covered Month state: certain figures + explicit missing-data nudge | 83 |
| CLIST-07 | Row click opens detail on same year; totals agree | 83 |

## Ranking Data Path — Query Shape and Composition Strategy

### Current Structure (Phase 82 baseline)

`getCategoryRanking` (lib/dal/dashboard.ts line 1040):
- Input: `DashboardFilters` (preset, type, sort) + optional `ledgerRowSource`
- Query: Groups by `(category.id, month, direction.code)` via `to_char(occurredAt, 'YYYY-MM')`
- Predicate: `eq(direction.includedInTotals, true)` (hardcoded; no direction.hidden exists in Phase 82)
- Output: `CategoryRankingItem[]` — per-category with `id, name, slug, type, count, amount, percentage, sparkline`
- Builder: `buildCategoryRankingData(from, to, rows)` — filters `allocation`/`transfer` types (lines 675-676), zero-fills 12 months per category, computes percentages

### Options for Phase 83

#### Option A: Reshape `getCategoryRanking`

**Change the query predicate and date-range logic:**
- Swap `dashboardPresetToDateRange(filters.preset)` → `{ from: new Date(year, 0, 1), to: new Date(year, 11, 31) }`
- Swap `eq(direction.includedInTotals, true)` → `eq(direction.hidden, false)`
- Keep the rest: same grouping, aggregation, builder function (remove hardcoded `allocation`/`transfer` filter at lines 675-676)
- Cost: ~1 query, 12 points per category, 26 categories (the current design)
- Risk: RETIRE-05 baseline (Overview byte-identical) — overview uses `ne(direction.code, 'transfer')` not `includedInTotals`, so it's unaffected

#### Option B: New DAL Function `getCategoryYearRanking`

**Separate function scoped to year + direction:**
- Input: `year: number`, `direction: 'in' | 'out' | 'allocation'`, `userId` (via verifySession)
- Query: Group by `(category.id, month)` — similar to current, but year-scoped
- Predicate: `eq(direction.code, directionCode)`
- Output: Same `CategoryRankingItem[]`
- Cost: Same as Option A (one query per direction)
- Benefit: Name clarity (year-only signature), separation of concerns

#### Option C: Compose with Phase 82's `getCategoryMonthlyAmounts`

**Build ranking by calling Phase 82 DAL per category:**
1. Query: Get all categories in direction + year (one aggregation query)
2. Per category: Call `getCategoryMonthlyAmounts(categoryId, year)` — zero-filled 12-entry series
3. Per series: Call `buildYearSeries(months)` → `{ months, total }` (type: `{ months: MonthlyValue[], total: string }`)
4. Compute percentage from per-direction total
5. Emit `CategoryRankingItem` with Phase 82's series intact

**Cost:** 1 direction-scoped aggregation query + 26 individual `getCategoryMonthlyAmounts` calls (each caches per categoryId).

**Benefit:** Reuses Phase 82's `buildYearSeries` invariant (D-07: period total = sum of series).

**Risk:** Cache thrashing if not managed; but caching is per `(categoryId, year)` via React's `cache()`, so it's safe.

### Recommendation

**Option A (reshape) + Option C (compose for series)** is the sweet spot:
- Reshape `getCategoryRanking` to year/direction scoping
- Keep the one-query design
- Call `getCategoryMonthlyAmounts(categoryId, year)` per category INSIDE the builder (after the query completes) to fill in the sparkline points
- This way: one aggregation query (for ranking order + totals), then per-category zero-filled series composition
- **Type contract:** Phase 82's `MonthlyValue[] + buildYearSeries() → { months, total }` already composes into `CategoryRankingItem.sparkline + .amount`

### Type Shapes to Verify

From `lib/dal/dashboard.ts`:

```typescript
export type CategoryRankingItem = {
  id: number
  name: string
  slug: string
  type: 'in' | 'out'
  count: number
  amount: string            // Year total (string from DECIMAL)
  percentage: number        // Computed via computeBreakdownPercentages
  sparkline: CategorySparklinePoint[]  // 12-entry series
}

// Phase 82 exports:
export type MonthlyValue = { yearMonth: string; amount: string }

// buildYearSeries output (lib/services/pace-and-projection.ts line 105):
function buildYearSeries(months: MonthlyValue[]): { months: MonthlyValue[]; total: string }
```

**Integration point:** After `getCategoryRanking` query returns, map each row's `categoryId` to `getCategoryMonthlyAmounts(categoryId, year)`, then feed that series through `buildYearSeries`, extracting `.months` into the sparkline.

---

## Direction Predicate Flip — Caller Inventory and Scope Boundaries

### The Change (D-09)

**Current:** `eq(direction.includedInTotals, true)`  
**New:** `eq(direction.hidden, false)`

**Seeding (scripts/seed-data.ts):**
- `in` (Entrate): `includedInTotals: true`, `hidden: false` ✓ included before, included after
- `out` (Uscite): `includedInTotals: true`, `hidden: false` ✓ included before, included after
- `allocation` (Accantonamenti): `includedInTotals: false`, `hidden: false` ✗ excluded before, **included after** (D-09 goal)
- `transfer` (Trasferimenti): `includedInTotals: false`, `hidden: true` ✗ excluded before, excluded after

### All Seven Callers in `lib/dal/dashboard.ts`

| Function | Line | Usage Count | Touched by Phase 83? | Touched by Phase 82? | RETIRE-05 Impact |
|---|---|---|---|---|---|
| `getCategoriesBreakdown` | 1026 | 1x | No (Categories bar breakdown) | No | None — only called by Categories |
| `getCategoryRanking` | 1090 | 1x | **Yes** (main list page) | No | None — Overview uses `ne(direction.code, 'transfer')` |
| `getCategoryDeviations` | 1154 | 2x (ref + base) | No (detail + list, both Phase 84+) | No | None — only called by Categories |
| `getCategoryDetail` | 1334, 1372, 1390 | 3x (trend, subcats, top-tx) | No (detail page, Phase 84) | No | None — only called by Categories detail |

### Why RETIRE-05 Passes Unchanged

**The RETIRE-05 regression gate** (`tests/pace-engine-lens-regression.test.ts`, line 273):

Tests `getOverviewAmountTotals` (lib/dal/dashboard.ts line 453):
```typescript
.where(
  and(
    dateScopedTransactions(ledgerRowSource, userId, from, to),
    expenseStatusIncludedInDashboardTotals(),
    ne(direction.code, 'transfer'),  // ← NOT eq(direction.includedInTotals)
    ...
  )
)
```

**Verdict:** Overview's predicate `ne(direction.code, 'transfer')` has always included `allocation`. It does not use `direction.includedInTotals`, so the predicate flip affects zero Overview functions. RETIRE-05 baseline is unaffected.

### Functions NOT Called by Overview/Tags

- `getCategoryRanking` — only `CategoriesPage` (line 118 in categories/page.tsx)
- `getCategoryDeviations` — only `CategoriesPage` (line 119 in categories/page.tsx) and detail page (categories/[id]/page.tsx)
- `getCategoriesBreakdown` — only `CategoriesPage` (inferred from naming; verified: no calls in overview/*, tags/*)
- `getCategoryDetail` — only detail page (categories/[id]/page.tsx)

**Conclusion:** Phase 83 touches `getCategoryRanking` predicate; all other functions stay unchanged. Categories pages are the sole callers; Overview/Tags have separate aggregation functions.

---

## URL Contract — Year Parameter Propagation

### Overview's Year Resolution

**Function:** `lib/components/dashboard/overview/resolve-year.ts` (lines 18–42)

```typescript
export function resolveYear(
  requested: string | undefined,
  years: string[],
  yearsForOtherLens?: string[],
): number | null {
  // If requested is in the active lens's years, use it
  // If requested only exists in the OTHER lens, clamp to the active lens's latest year
  // Fall back: current calendar year if present, else most recent year (DESC order)
}
```

**Contract:** Accepts `?year=` from URL; returns a number or null (no data).

### Categories Page — Current (Preset-Based)

**File:** `app/(app)/dashboard/categories/page.tsx` (lines 17–22)

```typescript
const CATEGORIES_DEFAULT_PRESET = 'last-3-months'
const CATEGORIES_DEFAULT_SORT = 'deviation'
const categoryTypeOptions = [
  { value: 'out' as const, label: 'Uscite' },
  { value: 'in' as const, label: 'Entrate' },
]
```

**SearchParams:** `preset`, `type`, `sort`, `lens` (Phase 82 D-13 passthrough only)

**Parser:** `parseCategoryDashboardFilters` → `parseDashboardFilters` (lib/validations/dashboard.ts line 19)

### Routes Builders — Current State

**File:** `lib/routes.ts` (lines 44–142)

```typescript
type DashboardCategoryFilters = {
  preset?: DashboardPreset
  type?: 'in' | 'out'
  sort?: DashboardSort
  defaultPreset?: DashboardPreset
  defaultSort?: DashboardSort
  lens?: LensPassthrough
}

export function buildDashboardCategoriesHref(filters: DashboardCategoryFilters = {}) {
  // Emits: ?preset=X&type=Y&sort=Z&lens=L
}

export function buildDashboardCategoryDetailHref(id: number | string, filters: DashboardCategoryFilters = {}) {
  // Emits: /dashboard/categories/{id}?preset=X&type=Y&sort=Z&lens=L
}
```

### Dashboard Tab Navigation — The Shared Parameter

**File:** `components/dashboard/dashboard-tab-nav.tsx` (implied, not yet read but referenced in CONTEXT.md D-12)

**Current behavior (inferred):** Likely calls `buildDashboardCategoriesHref` with `filters` object. Per D-12, must start passing `year` instead of preset.

### Phase 83 Changes Required

1. **Parser:** Add `year?: string | string[]` to searchParams; update `parseDashboardFilters` to accept year, default to current year (matching Overview behavior).
2. **Routes:** Change `DashboardCategoryFilters` type to use `year?: number` instead of `preset?`; update `buildDashboardCategoriesHref` and `buildDashboardCategoryDetailHref` to emit `?year=X` (not `?preset=`).
3. **Tab nav:** Update `buildDashboardTabHref` to propagate `year` from Categories back to Overview (exact mechanism TBD; likely `parseSearchParams` extracts it and passes to `buildDashboardOverviewHref`).
4. **Pin by construction (D-12):** The Categories page code must never parse `?preset=` — not in validation, not in fallback. The parameter is dead.

### Legacy URL Handling

**Check:** `next.config.ts`, `lib/routes.ts` for any redirects or legacy rewrites.

- No explicit mention in CONTEXT.md of legacy Categories URLs (suggesting none exist; Categories is being built, not migrated).
- **Recommendation:** If any legacy `?preset=` redirects exist, they should 404 or redirect to `?year=CURRENT`.

---

## Detail Page Scope — What Stays Live Until Phase 84

### Phase 83 Deletions: NONE on the detail page

The detail page (`app/(app)/dashboard/categories/[id]/page.tsx`) is **untouched** by Phase 83, per CONTEXT.md code-context section:

> "Not to be touched here: components/dashboard/deviation-badge.tsx, getCategoryDeviations, getDeviationDateRanges, buildDeviationDataset, DEVIATION_NOISE_THRESHOLD, and the Preset machinery — still called by the detail page. Deletion is Phase 84 (RETIRE-01/02), once the last caller is gone."

### Functions Still Called by Detail Page

From the codebase grep (categories/[id]/page.tsx line 6):

```typescript
import { getCategoryDeviations, getCategoryDetail } from '@/lib/dal/dashboard'
```

**Detail page calls:**
- `getCategoryDeviations({ type: filters.type, categoryId })` (line 119 in detail page)
  - Uses `direction.includedInTotals` at lines 1154, 1161 (in `getCategoryDeviations` function)
- `getCategoryDetail(categoryId, filters)` (line 118 in detail page)
  - Uses `direction.includedInTotals` at lines 1334, 1372, 1390

Both functions will STAY UNCHANGED during Phase 83; Phase 84 will replace the detail page's use of them and then delete the functions.

### Why Phase 84 Defers Deletion

**RETIRE-01/02 acceptance criterion:** "No dead references left behind" + "No regression on any surface that used its helpers."

- Phase 83 rewrites the list, which calls `getCategoryRanking` and `getCategoryDeviations`.
- Phase 84 rewrites the detail page, which calls `getCategoryDeviations` and `getCategoryDetail`.
- Only once Phase 84's detail page stops calling these functions can RETIRE-01/02 safely delete them — no surface left using them.

### Copy Set Per Direction

**Phase 83's discretion:** Exact Italian copy for each direction (Uscite, Entrate, Accantonamenti) in the list UI. Must be resolved centrally (one place, not per-widget), matching Phase 82's `resolveComparisonJudgement` pattern (which already handles in/out/allocation).

---

## Decimal.js and DECIMAL-as-String Conventions

### Project Rule (CLAUDE.md)

> "Never use native JavaScript arithmetic (`+`, `-`, `*`, `/`) on monetary amounts. Always use `Decimal.js` helpers."

### Share-of-Total Computation

**Call site:** `lib/dal/dashboard.ts` line 715, inside `buildCategoryRankingData`:

```typescript
return computeBreakdownPercentages(Array.from(categoriesById.values()))
```

**Function (same file, line 612—implied from context):**

```typescript
function computeBreakdownPercentages<T extends { amount: string }>(items: T[]): Array<T & { percentage: number }> {
  const total = items.reduce((sum, item) => sum.plus(toDecimal(item.amount)), toDecimal('0'))
  return items.map((item) => ({
    ...item,
    percentage: Number(
      toDecimal(item.amount)
        .div(total.isZero() ? '1' : total)  // Guard against zero total
        .times('100')
        .toFixed(2)
    ),
  }))
}
```

**Pattern:** 
- Input: Items with `amount: string` (from DECIMAL columns, never parsed as numbers)
- Arithmetic: All via `Decimal.js` (`toDecimal`, `.plus`, `.div`, `.times`)
- Output: `percentage: number` (safe after rounding, used for display only)

### Year-Total Computation

**Call site:** Phase 82's `lib/services/pace-and-projection.ts` line 105—106:

```typescript
export function buildYearSeries(months: MonthlyValue[]): { months: MonthlyValue[]; total: string } {
  const total = months.reduce((sum, m) => sum.plus(toDecimal(m.amount)), toDecimal('0'))
  return { months, total: toDbDecimal(total) }
}
```

**Pattern:**
- Reduce: Via `Decimal.js` (not native `+`)
- Rounding: `toDbDecimal(total)` at the return boundary (single rounding, not per-month)
- Output: `total: string` (safe for storage/display)

### Month Amounts (Sparkline Points)

**Call site:** `lib/dal/dashboard.ts` line 1063, inside `getCategoryRanking`:

```typescript
amount: sql<string>`coalesce(abs(sum(${ledgerRowSource.amount})), 0)::text`,
```

**Pattern:**
- Query returns magnitudes (absolute value of sum)
- Type: Always `string` (cast to text in SQL)
- Post-query arithmetic: Via `Decimal.js` (see `buildCategoryRankingData` line 689, 693)

### Recommendation

Phase 83 inherits all existing Decimal.js patterns; no new conventions needed. The share-of-total computation for the list already uses `Decimal.js` in `computeBreakdownPercentages`.

---

## Validation Architecture

### Test Framework and Configuration

| Property | Value |
|---|---|
| Framework | Vitest (unit/integration) + React `renderToStaticMarkup` (RSC) |
| Config file | `vitest.config.ts` (at project root) |
| Test entry point | `tests/` directory; convention: `{feature}.test.ts` or `{feature}.test.tsx` |
| Quick run command | `yarn test -- {file}` (single file) or `yarn test` (full suite) |
| Full suite command | `yarn test` (runs all in `tests/`) |

### Real Postgres for DAL Work

**Harness file:** `tests/helpers/reimbursement-test-db.ts`

| Property | Value |
|---|---|
| Target database | `sparter_test` (auto-created on first use) |
| Connection | `TEST_DATABASE_URL` env var (default: `postgres://postgres:sparter@localhost:5432/sparter_test`) |
| Safety guards | 4-level: NODE_ENV check, localhost-only, `_test` suffix required, TEST_DATABASE_URL isolation |
| Setup | `connectReimbursementTestDb()` — pools Postgres, runs migrations, returns `{ ok, db, pool }` |
| Seeding | `tests/fixtures/reimbursement-seed.ts`: `seedUser`, `seedMinimalTaxonomy`, `seedSecondEssentialCategory`, `seedExpenseWithTransaction`, `seedTag`, `attachTagToTransaction` |
| Isolation | Advisory lock (key 731_302) serializes cross-file test access to prevent fixture corruption |
| Teardown | `afterAll(() => pool.end())` |

### RETIRE-05 Regression Gate

**File:** `tests/pace-engine-lens-regression.test.ts` (line 273—299)

**What it tests:**
- Calls `getOverviewAmountTotals(userId, dateRange, ledgerEntryCash)`
- Calls `getTagTotals(userId, tagId, dateRange, ledgerEntryCash)`
- Compares hardcoded snapshot: `{ totalIn, totalOut, totalAllocation, ... }`

**Phase 83 obligation:** Re-run this test unchanged after the `direction.hidden` predicate flip. If it fails, the flip is wrong.

**How to invoke:** `yarn test pace-engine-lens-regression.test.ts` (requires `sparter_test` Postgres running)

### RSC / Source-Inspection Tests

**Pattern:** Use `renderToStaticMarkup` to check Rendered Server Component output without jsdom.

**Mocking requirements:**
- `next/navigation`: `useRouter`, `useSearchParams`, `usePathname` (mocked as `vi.fn()`)
- `@/components/ui/dropdown-menu`, `@/components/ui/sheet`, Radix portals: Mocked as passthrough divs (since they render outside static markup)
- Database: Mocked via `vi.doMock` + `vi.resetModules` (allows per-test db swaps)

**Example (implied from pace-engine-lens-regression.test.ts):**

```typescript
vi.mock('@/lib/dal/auth', () => ({ verifySession: vi.fn() }))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))

vi.doMock('@/lib/db', () => ({ db }))  // Test-scoped db
vi.resetModules()
const module = await import('@/lib/dal/covered-months')
```

### Phase Requirements → Test Map

| Requirement | Behavior | Test Type | Automated Command | Coverage |
|---|---|---|---|---|
| CLIST-01 | Categories listed, ranked by total, each showing % and sparkline | Integration (DAL + builder) | `yarn test categories-ranking` or similar | TBD (new phase) |
| CLIST-02 | Projection shown inline, subordinate, labelled | Component (RSC render) | `yarn test category-ranking-list` | TBD (new phase) |
| CLIST-03 | Projection ordering via sort toggle | Component + route | `yarn test` (existing sort toggle test or new) | TBD (new phase) |
| CLIST-04 | Direction switch includes `allocation`; Accantonamenti in list | Integration (DAL) | `yarn test` (predicate flip verification) | TBD (new phase) |
| CLIST-05 | Year preserved across tabs | Route assertion | `yarn test dashboard-tab-nav` or similar | TBD (new phase) |
| CLIST-06 | One Covered Month state + nudge | Component | `yarn test category-list-nudge` or similar | TBD (new phase) |
| CLIST-07 | Row link carries year; detail total matches | Integration (href + DAL) | `yarn test category-detail-link` or similar | TBD (new phase) |

### Sampling Rate

- **Per task commit:** `yarn test {feature}` (quick run on changed feature)
- **Per wave merge:** `yarn test` (full suite, including pace-engine-lens-regression.test.ts)
- **Phase gate:** Full suite green + RETIRE-05 baseline passes before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/categories-ranking-dal.test.ts` — covers CLIST-01 (ranking query, predicate flip, allocation included)
- [ ] `tests/categories-list-component.test.tsx` — covers CLIST-02 (projection rendering, visual hierarchy)
- [ ] `tests/categories-direction-filter.test.ts` — covers CLIST-04 (three directions in UI, `allocation` visible)
- [ ] `tests/dashboard-year-contract.test.ts` — covers CLIST-05 (year param propagation, Overview ↔ Categories)
- [ ] `tests/categories-nudge.test.tsx` — covers CLIST-06 (single Covered Month state, nudge copy)
- [ ] `tests/category-detail-link.test.ts` — covers CLIST-07 (href carries year, totals match)
- [ ] Framework install: `yarn test --run` (existing; no new dep needed; Vitest already in place)

---

## Open Questions

1. **Ranking data path choice:** Reshape existing `getCategoryRanking`, create new `getCategoryYearRanking`, or compose with `getCategoryMonthlyAmounts` per row? CONTEXT.md marks this Claude's Discretion; recommend Option A (reshape) + Option C (compose for series).

2. ~~**Sparkline rendering:**~~ **RESOLVED** — inspected; see "Closed by orchestrator" under Sources. Reusable in shape, but requires three changes: widen the `type` prop past `'in' | 'out'` for `allocation` (D-09), decide the fate of `parseAmount`'s `Math.max(parsed, 0)` negative-clamp (it hides `allocation` divestment months), and widen `CategorySparklinePoint` to carry month state so uncovered / current / estimated months are visually distinct.

3. **Sort toggle options text (D-08):** Current options are "Deviazione" and "Importo". New second option replaces "Deviazione" with projection label (e.g., "Proiezione"?). Exact copy is Claude's Discretion; recommend asking user.

4. ~~**Dashboard tab nav (`buildDashboardTabHref`):**~~ **RESOLVED** — it is exported from `components/dashboard/dashboard-tab-nav.tsx` and copies exactly `preset`, `type`, `sort`, `lens`; `year` is absent. See "Closed by orchestrator" under Sources. Remaining sub-question for the planner: the builder is shared by all three tabs, so confirm the Tags page tolerates `preset` being dropped before removing it.

5. **Validation: What constitutes "byte-identical" for RETIRE-05?** Running the test at Phase 83 plan-time will answer. If it fails, predicate flip is wrong (but codebase inspection suggests it will pass).

---

## Testing Harness Summary

**For DAL work (ranking query, predicate flip verification):**
1. Spin up `sparter_test` Postgres: `yarn db:up` (docker-compose, or local Postgres)
2. Run harness test: `yarn test pace-engine-lens-regression.test.ts` (RETIRE-05 baseline)
3. Run new ranking test (Phase 83): `yarn test categories-ranking-dal.test.ts` (when written)
4. Seeding: Use `seedUser`, `seedMinimalTaxonomy`, `seedExpenseWithTransaction` from `tests/fixtures/reimbursement-seed.ts`
5. Isolation: Advisory lock prevents cross-test corruption; tests can run in parallel

**For RSC / component work (list row, sparkline, direction filter):**
1. Use `renderToStaticMarkup` + mocks for `next/navigation`, Radix portals
2. Mock `@/lib/db` with test-scoped drizzle instance (see pace-engine-lens-regression pattern)
3. Assert DOM structure, not interaction (no jsdom; use `renderToStaticMarkup`)
4. Run: `yarn test {feature}.test.tsx` (component render tests)

---

## Sources

### High Confidence (Verified via Code Inspection + ADR)

- `docs/adr/0020-categories-year-view-retires-deviation.md` — accepted ADR, 10 decisions
- `.planning/dashboard-categories-DECISIONS.md` — 19 locked decisions (D1–D19)
- Phase 82 `SUMMARY.md` — number engine exports, types, RETIRE-05 contract
- `lib/dal/dashboard.ts` (lines 103–1390) — type definitions, query shapes, builder functions
- `lib/services/pace-and-projection.ts` (lines 1–157) — Decimal.js patterns, buildYearSeries contract
- `lib/dal/covered-months.ts` (lines 1–90) — getCoveredMonthsInYear, getCategoryMonthlyAmounts exports
- `scripts/seed-data.ts` — direction seeding: `includedInTotals`, `hidden` fields per direction
- `tests/pace-engine-lens-regression.test.ts` (line 273) — RETIRE-05 baseline, real Postgres harness pattern
- `tests/helpers/reimbursement-test-db.ts` — test harness, `sparter_test` setup, seeding helpers

### Medium Confidence (Code Inspection, Not Cross-Checked)

- `app/(app)/dashboard/categories/page.tsx` — current Categories list structure, SortToggle, preset-based params
- `lib/routes.ts` (lines 44–142) — `buildDashboardCategoriesHref`, `buildDashboardCategoryDetailHref` current shape
- `lib/validations/dashboard.ts` (lines 1–48) — `parseDashboardFilters` logic, preset defaults
- `components/dashboard/overview/resolve-year.ts` (lines 18–42) — Overview year resolution logic

### Closed by orchestrator after the research run (verified by direct file read)

The three items originally left uninspected were closed before planning. Findings below are
first-hand reads, not inference.

**`components/dashboard/dashboard-tab-nav.tsx`** — `buildDashboardTabHref(href, searchParams)`
is exported from this same file (not from `lib/routes.ts`) and is consumed by `DashboardTabNav`,
which renders all three tabs (Overview / Categorie / Tag) from a single `tabs` array. It builds a
fresh `URLSearchParams` and copies across exactly four keys when truthy: `preset`, `type`, `sort`,
`lens`. **`year` is absent** — this is the concrete D-12/CLIST-05 defect.

Two consequences the planner must not miss:
- The builder is **shared by all three tabs**, so adding `year` propagates it to Tags as well
  (harmless — Tags is all-time and ignores it), and dropping `preset` removes it from the
  Overview and Tags links too. Overview already runs on `?year=`; Tags ignores both. Verify this
  claim against the Tags page before dropping `preset`, since the builder is the only site that
  currently carries the param between tabs.
- It is a `'use client'` component reading `useSearchParams()`; the year therefore has to be
  present *in the URL* to survive a tab hop — Overview's `sessionStorage` persistence
  (`overview-persistence.ts` `saveYear`) is not visible to this builder.

**`components/dashboard/category-sparkline.tsx`** — reusable, but **three concrete blockers for
this phase**, all in ~88 lines:
1. `type Props = { points, type: 'in' | 'out', label? }` — the `type` prop is a two-value union
   and drives the stroke colour (`var(--total-in)` / `var(--total-out)`). **D-09 adds
   `allocation`**, so both the union and the colour map need a third case. This is the same
   "one copy/colour set per direction, resolved centrally" rule as D-11 — do not add a local
   ternary.
2. `parseAmount` does `Math.max(parsed, 0)` — it **silently clamps negative months to zero**. On
   `allocation` a divestment month is legitimately negative (recorded in CONTEXT.md
   `## Risk Summary`: "selling an ETF drags a month negative"), so the clamp would hide exactly
   the case D-09 introduces. Decide deliberately: widen the domain, or keep the clamp and state
   why.
3. `CategorySparklinePoint = { month: string; label: string; amount: string }` (`lib/dal/dashboard.ts`
   line 97) carries **no coverage or month-state field**. The Risk Summary requires uncovered
   months to get an explicit visual signal (never a silent gap) and the current month to be a
   third state distinct from fact and estimate. The point type must widen, or a parallel
   coverage array must be threaded in.

Already suitable, no change needed: the component renders a **single point as a circle**
(`chartPoints.length === 1`), which is exactly CLIST-06's one-point series.

**`next.config.ts`** — grep for `preset|dashboard|categor|redirect` returns **no matches**. There
are no legacy dashboard redirects or rewrites, so the `?preset=` → `?year=` change on the
Categories list breaks no published URL at the framework level. `lib/routes.ts` remains the only
place to check for in-app href construction.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — ADR locked, Phase 82 exports verified, codebase audit complete
- Architecture: HIGH — locked decisions + code inspection confirm no unforeseen interactions
- Ranking data path: MEDIUM — multiple viable approaches; choice is Claude's Discretion
- Predicate flip: HIGH — caller inventory complete; RETIRE-05 impact verified via code inspection
- URL contract: MEDIUM — Overview logic verified; Categories integration not yet implemented
- Testing: HIGH — harness pattern established by Phase 82; RETIRE-05 gate ready to re-run

**Research date:** 2026-07-30  
**Valid until:** 2026-08-06 (stable design, Phase 82 code unlikely to shift; 7 days for implementation)

