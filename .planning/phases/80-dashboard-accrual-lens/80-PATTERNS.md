# Phase 80: dashboard-accrual-lens - Pattern Map

**Mapped:** 2026-07-29
**Files analyzed:** 13
**Analogs found:** 8 / 13

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/dal/dashboard.ts` | service | CRUD (aggregation) | `lib/dal/dashboard.ts` (self) | exact-self |
| `lib/dal/overview.ts` | service | CRUD (aggregation) | `lib/dal/overview.ts` (self) | exact-self |
| `lib/dal/months-with-data.ts` | service | CRUD (aggregation) | `lib/dal/months-with-data.ts` (self) | exact-self |
| `lib/dal/tags.ts` | service | CRUD (aggregation) | `lib/dal/tags.ts` (self) | exact-self |
| `components/dashboard/overview/overview-persistence.ts` | utility | transform (state) | `components/dashboard/overview/overview-persistence.ts` (self) | exact-self |
| `components/dashboard/overview/overview-header.tsx` | component | request-response | `components/dashboard/overview/overview-header.tsx` (self) | exact-self |
| `components/dashboard/overview/resolve-year.ts` | utility | transform (pure) | `components/dashboard/overview/resolve-year.ts` (self) | exact-self |
| `components/dashboard/dashboard-tab-nav.tsx` | component | request-response | `components/dashboard/dashboard-tab-nav.tsx` (self) | exact-self |
| `app/(app)/dashboard/overview/page.tsx` | controller | request-response | `app/(app)/dashboard/overview/page.tsx` (self) | exact-self |
| `app/(app)/dashboard/categories/page.tsx` | controller | request-response | `app/(app)/dashboard/categories/page.tsx` (self) | exact-self |
| `app/(app)/dashboard/categories/[id]/page.tsx` | controller | request-response | `app/(app)/dashboard/categories/[id]/page.tsx` (self) | exact-self |
| `app/(app)/dashboard/tags/page.tsx` | controller | request-response | `app/(app)/dashboard/tags/page.tsx` (self) | exact-self |
| `lib/dal/dashboard-filters.ts` | utility | transform (predicate) | `lib/dal/dashboard-filters.ts` (self) | exact-self |

---

## Pattern Assignments

### `lib/dal/dashboard.ts` (service, CRUD aggregation)

**Analog:** `lib/dal/dashboard.ts` (existing code)

**Current pattern — hardcoded ledgerEntryCash** (lines 451–517):
```typescript
export async function getOverviewAmountTotals(userId: string, from: Date, to: Date): Promise<OverviewAggregateRow> {
  try {
    const rows = await db
      .select({
        totalIn: sql<string>`coalesce(sum(case when ${direction.code} = 'in' then ${ledgerEntryCash.amount} else 0 end), 0)::text`,
        totalOut: sql<string>`coalesce(abs(sum(case when ${direction.code} = 'out' then ${ledgerEntryCash.amount} else 0 end)), 0)::text`,
        totalAllocation: sql<string>`coalesce(sum(case when ${direction.code} = 'allocation' then ${ledgerEntryCash.amount} else 0 end), 0)::text`,
        totalInRecurring: sql<string>`coalesce(sum(case when ${direction.code} = 'in' and ${nature.code} = 'income' then ${ledgerEntryCash.amount} else 0 end), 0)::text`,
        totalOutEssential: sql<string>`coalesce(abs(sum(case when ${direction.code} = 'out' and ${nature.code} = 'essential' then ${ledgerEntryCash.amount} else 0 end)), 0)::text`,
        totalOutDiscretionary: sql<string>`coalesce(abs(sum(case when ${direction.code} = 'out' and ${nature.code} = 'discretionary' then ${ledgerEntryCash.amount} else 0 end)), 0)::text`,
        totalOutDebt: sql<string>`coalesce(abs(sum(case when ${direction.code} = 'out' and ${nature.code} = 'debt' then ${ledgerEntryCash.amount} else 0 end)), 0)::text`,
      })
      .from(ledgerEntryCash)  // ← SWAP HERE
      .innerJoin(expense, eq(ledgerEntryCash.expenseId, expense.id))
      .innerJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
      .innerJoin(category, eq(subCategory.categoryId, category.id))
      .leftJoin(
        userSubcategoryOverride,
        and(
          eq(userSubcategoryOverride.subCategoryId, subCategory.id),
          eq(userSubcategoryOverride.userId, userId),
        ),
      )
      .innerJoin(
        nature,
        eq(
          nature.id,
          sql`COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})`
        )
      )
      .innerJoin(direction, eq(nature.directionId, direction.id))
      .where(
        and(
          dateScopedTransactions(ledgerEntryCash, userId, from, to),
          expenseStatusIncludedInDashboardTotals(),
          ne(direction.code, 'transfer'),
        )
      )
```

**Modification strategy:**
1. Add `ledgerRowSource = ledgerEntryCash` parameter to the function signature
2. Replace all hardcoded `ledgerEntryCash.` column references with `ledgerRowSource.`
3. Pass the parameter at call sites (in `getOverview()` wrapper, line 948 onward)

**Ten aggregation sites in this file to modify:**
- `getUncategorizedCount()` (line 429) — uses `transactionTable`, not ledger view; **no change**
- `getOverviewAmountTotals()` (line 451) — **must swap**
- `getCategoriesBreakdown()` (line 968, line 991 `.from(ledgerEntryCash)`) — **must swap**
- `getCategoryRanking()` (line 1030, line 1052 `.from(ledgerEntryCash)`) — **must swap**
- `getCategoryDeviations()` (line 1091, dual queries at lines 1108 & 1150) — **must swap both**
- `getCategoryDetail()` (line 1201, three dual queries at lines 1286, 1330, 1382) — **must swap**
- `getMonthlyTrendByNature()` (line 1437, line 1459 `.from(ledgerEntryCash)`) — **must swap**

**Import statement (already present)** (lines 18–29):
```typescript
import {
  category,
  direction,
  expense,
  expenseGroup,
  expenseGroupMembership,
  ledgerEntryCash,
  nature,
  subCategory,
  transaction as transactionTable,
  userSubcategoryOverride,
} from '@/lib/db/schema'
```

Add `ledgerEntryAccrual` to this import list (already in schema.ts).

---

### `lib/dal/overview.ts` (service, CRUD aggregation)

**Analog:** `lib/dal/overview.ts` (existing code)

**Current getYearsWithData (single-lens hardcoded)** (lines 79–94):
```typescript
export const getYearsWithData = cache(async (): Promise<string[]> => {
  const { userId } = await verifySession()

  try {
    const result = await db.execute(sql`
      SELECT DISTINCT TO_CHAR(occurred_at, 'YYYY') AS yr
      FROM transaction
      WHERE user_id = ${userId}
      ORDER BY yr DESC
    `)
    const rows = result.rows as { yr: string }[]
    return rows.map((row) => row.yr)
  } catch {
    return []
  }
})
```

**Modification strategy (D-09):**
1. Add `lens: 'cassa' | 'competenza' = 'cassa'` parameter
2. Branch on lens: cassa reads transaction only (existing); competenza UNIONs transaction + amortization_instalment
3. Cache key becomes lens-dependent (parameter to cache makes this automatic in React)

**Code example for competenza branch:**
```typescript
export const getYearsWithData = cache(
  async (lens: 'cassa' | 'competenza' = 'cassa'): Promise<string[]> => {
    const { userId } = await verifySession()

    try {
      const result = await db.execute(
        lens === 'cassa'
          ? sql`
              SELECT DISTINCT TO_CHAR(occurred_at, 'YYYY') AS yr
              FROM transaction
              WHERE user_id = ${userId}
              ORDER BY yr DESC
            `
          : sql`
              SELECT DISTINCT TO_CHAR(occurred_at, 'YYYY') AS yr
              FROM (
                SELECT occurred_at FROM transaction WHERE user_id = ${userId}
                UNION ALL
                SELECT occurred_at FROM amortization_instalment WHERE user_id = ${userId}
              ) combined_ledger
              ORDER BY yr DESC
            `
      )
      const rows = result.rows as { yr: string }[]
      return rows.map((row) => row.yr)
    } catch {
      return []
    }
  }
)
```

**Other aggregation functions in overview.ts also need row-source swaps** (similar pattern to dashboard.ts ten sites).

---

### `lib/dal/months-with-data.ts` (service, CRUD aggregation)

**Analog:** `lib/dal/months-with-data.ts` (existing code)

**Current pattern (transaction-only)** (lines 14–40):
```typescript
export const getMonthsWithData = cache(
  async (table: 'transactions' | 'files'): Promise<string[]> => {
    const { userId } = await verifySession()

    if (table === 'transactions') {
      const result = await db.execute(sql`
        SELECT DISTINCT TO_CHAR(occurred_at, 'YYYY-MM') AS ym
        FROM transaction
        WHERE user_id = ${userId}
        ORDER BY ym DESC
      `)
      const rows = result.rows as { ym: string }[]
      return rows.map((row) => row.ym)
    }
    // ... file branch unchanged
  }
)
```

**Modification strategy (D-09):**
1. Add `lens: 'cassa' | 'competenza' = 'cassa'` parameter
2. For transactions under competenza: UNION transaction months with amortization_instalment months
3. Files branch unchanged (files are not part of amortization model)

**Accrual union pattern:**
```typescript
// Competencia branch (simplified):
SELECT DISTINCT TO_CHAR(occurred_at, 'YYYY-MM') AS ym
FROM (
  SELECT occurred_at FROM transaction WHERE user_id = ${userId}
  UNION ALL
  SELECT occurred_at FROM amortization_instalment WHERE user_id = ${userId}
) combined_ledger
ORDER BY ym DESC
```

---

### `lib/dal/tags.ts` (service, CRUD aggregation)

**Analog:** `lib/dal/tags.ts` (existing code)

**Hard-code ledgerEntryCash for lens-invariance (D-05)** — lines 205–257 for `getTagTotals`:
```typescript
export async function getTagTotals(userId: string): Promise<TagTotalItem[]> {
  // NO LENS PARAMETER — tags are all-time per ADR 0019.
  // Hard-code ledgerEntryCash; this function never reads ledgerEntryAccrual.
  const tagTotalExclusion = sql`(
    ${inArray(expense.status, [...DASHBOARD_TOTAL_EXPENSE_STATUSES])}
    AND ${ne(direction.code, 'transfer')}
    AND ${sql`${ledgerEntryCash.id} IS NOT NULL`}
  )`

  const rows = await db
    .select({
      tagId: tag.id,
      name: tag.name,
      archived: tag.archived,
      count: sql<string>`count(distinct ${transactionTable.id}) FILTER (WHERE ${tagTotalExclusion})`,
      minDate: sql<string | null>`(MIN(${transactionTable.occurredAt}) FILTER (WHERE ${tagTotalExclusion}))::text`,
      maxDate: sql<string | null>`(MAX(${transactionTable.occurredAt}) FILTER (WHERE ${tagTotalExclusion}))::text`,
      total: sql<string>`coalesce(sum(${ledgerEntryCash.amount}) FILTER (WHERE ${tagTotalExclusion}), 0)::text`,
    })
    .from(tag)
    .leftJoin(transactionTag, eq(transactionTag.tagId, tag.id))
    .leftJoin(transactionTable, eq(transactionTag.transactionId, transactionTable.id))
    .leftJoin(ledgerEntryCash, eq(ledgerEntryCash.id, transactionTable.id))  // ← NO SWAP
    // ... rest of joins and WHERE
```

**No changes to tags.ts — it stays on ledgerEntryCash always per ADR 0019 §5 and D-05.**

---

### `lib/dal/dashboard-filters.ts` (utility, transform)

**Analog:** `lib/dal/dashboard-filters.ts` (existing code — ALREADY GENERALIZED)

**Already supports row-source parameter** (lines 13–31):
```typescript
export type DateScopedSource = {
  userId: PgColumn
  occurredAt: PgColumn
}

/**
 * Date-range + ownership WHERE fragment. Generalized (Phase 77, D-11 seam) to accept ANY row
 * source exposing userId/occurredAt columns — `transaction` or `ledgerEntryCash`.
 */
export function dateScopedTransactions(
  source: DateScopedSource,
  userId: string,
  from: Date,
  to: Date,
) {
  return and(eq(source.userId, userId), gte(source.occurredAt, from), lte(source.occurredAt, to))
}
```

**NO CHANGES NEEDED** — this file already accepts `ledgerRowSource` as a parameter. Both `ledgerEntryCash` and `ledgerEntryAccrual` expose `userId` and `occurredAt`, so they both conform to `DateScopedSource`.

---

### `components/dashboard/overview/overview-persistence.ts` (utility, state)

**Analog:** `components/dashboard/overview/overview-persistence.ts` (existing year persistence)

**Existing year persistence pattern** (lines 95–114):
```typescript
export const YEAR_STORAGE_KEY = 'dashboard-overview:year'

export function readSavedYear(storage: Pick<Storage, 'getItem'> | null): string | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(YEAR_STORAGE_KEY)
    return raw && raw.trim() !== '' ? raw : null
  } catch {
    return null
  }
}

export function saveYear(storage: Pick<Storage, 'setItem'> | null, year: string): void {
  if (!storage) return
  try {
    storage.setItem(YEAR_STORAGE_KEY, year)
  } catch {
    // Feature degrades silently.
  }
}
```

**Extend with lens persistence (mirror the pattern, D-01):**
```typescript
export const LENS_STORAGE_KEY = 'dashboard-overview:lens'

export function readSavedLens(storage: Pick<Storage, 'getItem'> | null): 'cassa' | 'competenza' | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(LENS_STORAGE_KEY)
    return raw === 'competenza' ? 'competenza' : null  // Default null → cassa in caller
  } catch {
    return null
  }
}

export function saveLens(storage: Pick<Storage, 'setItem'> | null, lens: 'cassa' | 'competenza'): void {
  if (!storage) return
  try {
    storage.setItem(LENS_STORAGE_KEY, lens)
  } catch {
    // Feature degrades silently.
  }
}
```

**Key insight:** Use a boolean trick — store only 'competenza', absent/null means cassa (D-02 default). This matches the existing year pattern's "return null on absence" → caller decides default.

---

### `components/dashboard/overview/overview-header.tsx` (component, request-response)

**Analog:** `components/dashboard/overview/overview-header.tsx` (existing year-selector pattern)

**Existing year selector update pattern** (lines 22–27):
```typescript
function update(next: string) {
  saveYear(safeSessionStorage(), next)
  const params = new URLSearchParams(searchParams.toString())
  params.set('year', next)
  router.replace(`${pathname}?${params.toString()}`, { scroll: false })
}
```

**Extend with lens update (same structure, D-01):**
```typescript
function updateLens(next: 'cassa' | 'competenza') {
  saveLens(safeSessionStorage(), next)
  const params = new URLSearchParams(searchParams.toString())
  params.set('lens', next)
  router.replace(`${pathname}?${params.toString()}`, { scroll: false })
}
```

**Bare mount restoration** (lines 33–39 — extend for lens):
```typescript
useEffect(() => {
  if (searchParams.has('year')) return
  const saved = readSavedYear(safeSessionStorage())
  if (saved && saved !== String(year) && years.includes(saved)) {
    router.replace(`${pathname}?year=${saved}`, { scroll: false })
  }
}, [])
```

**Add parallel lens restoration:**
```typescript
useEffect(() => {
  if (searchParams.has('lens')) return
  const saved = readSavedLens(safeSessionStorage())
  if (saved) {
    router.replace(`${pathname}?lens=${saved}`, { scroll: false })
  }
}, [])
```

**Props extension:**
- Add `lens: 'cassa' | 'competenza'` and `yearsForOtherLens?: string[]` (cross-lens fallback, D-10)
- Render lens switch UI (UI discretion per planning)

---

### `components/dashboard/overview/resolve-year.ts` (utility, pure function)

**Analog:** `components/dashboard/overview/resolve-year.ts` (existing period fallback)

**Current single-lens logic** (lines 12–27):
```typescript
export function resolveYear(requested: string | undefined, years: string[]): number | null {
  if (years.length === 0) return null

  // If the requested year is present in the list, use it.
  if (requested !== undefined && years.includes(requested)) {
    return Number(requested)
  }

  // Fall back: current calendar year if it has data, else most recent (years are DESC).
  const currentYear = String(new Date().getFullYear())
  if (years.includes(currentYear)) {
    return Number(currentYear)
  }

  return Number(years[0])
}
```

**Extend for cross-lens clamp (D-10):**
```typescript
export function resolveYear(
  requested: string | undefined,
  yearsForActiveLens: string[],
  yearsForOtherLens?: string[]  // NEW: other lens's years
): number | null {
  if (yearsForActiveLens.length === 0) return null

  // If requested year is in active lens, use it
  if (requested !== undefined && yearsForActiveLens.includes(requested)) {
    return Number(requested)
  }

  // If requested year was valid in OTHER lens but not active lens (cross-lens case),
  // clamp to most recent year in active lens (D-10)
  if (requested !== undefined && yearsForOtherLens?.includes(requested)) {
    return Number(yearsForActiveLens[0])  // DESC ordered, so [0] is newest
  }

  // Fall back: current calendar year if it has data, else most recent
  const currentYear = String(new Date().getFullYear())
  if (yearsForActiveLens.includes(currentYear)) {
    return Number(currentYear)
  }

  return Number(yearsForActiveLens[0])
}
```

---

### `components/dashboard/dashboard-tab-nav.tsx` (component, request-response)

**Analog:** `components/dashboard/dashboard-tab-nav.tsx` (existing param preservation)

**Current buildDashboardTabHref** (lines 14–42):
```typescript
export function buildDashboardTabHref(
  href: string,
  searchParams: Pick<URLSearchParams, 'get'>
) {
  const params = new URLSearchParams()
  const preset = searchParams.get('preset')
  const type = searchParams.get('type')
  const sort = searchParams.get('sort')
  const tag = searchParams.get('tag')

  if (preset) params.set('preset', preset)
  if (type) params.set('type', type)
  if (sort) params.set('sort', sort)
  if (tag) params.set('tag', tag)

  const search = params.toString()
  return href + (search ? `?${search}` : '')
}
```

**Extend to preserve lens (D-03):**
```typescript
export function buildDashboardTabHref(
  href: string,
  searchParams: Pick<URLSearchParams, 'get'>
) {
  const params = new URLSearchParams()
  const preset = searchParams.get('preset')
  const type = searchParams.get('type')
  const sort = searchParams.get('sort')
  const tag = searchParams.get('tag')
  const lens = searchParams.get('lens')  // NEW

  if (preset) params.set('preset', preset)
  if (type) params.set('type', type)
  if (sort) params.set('sort', sort)
  if (tag) params.set('tag', tag)
  if (lens) params.set('lens', lens)  // NEW

  const search = params.toString()
  return href + (search ? `?${search}` : '')
}
```

**No other changes** — the function is already called in DashboardTabNav rendering (line 56); the preserved `lens` param will automatically flow through.

---

### `app/(app)/dashboard/overview/page.tsx` (controller, request-response)

**Analog:** `app/(app)/dashboard/overview/page.tsx` (existing page component)

**Current structure** (lines 1–20):
```typescript
type Props = {
  searchParams: Promise<{ year?: string }>  // ← ADD lens here
}
```

**Modification strategy:**
1. Extend `searchParams` type: `{ year?: string; lens?: string }`
2. Parse and default lens: `const lens = (await searchParams).lens ?? 'cassa'` (D-02)
3. Fetch years for both lenses (for cross-lens clamp):
   - `yearsForCassa = await getYearsWithData('cassa')`
   - `yearsForCompetenza = await getYearsWithData('competenza')`
4. Resolve year using extended `resolveYear()`: `resolveYear(year, yearsForActiveLens, yearsForOtherLens)`
5. Pass `lens` and both `yearsForCassa`/`yearsForCompetenza` to server-rendered sections and props
6. Thread `ledgerRowSource` to all ten aggregation call sites (pass the appropriate view based on lens)

**Key line to modify:**
```typescript
// OLD (line 10):
const years = await getYearsWithData()

// NEW:
const lens = (await searchParams).lens ?? 'cassa'  // D-02
const ledgerRowSource = lens === 'competenza' ? ledgerEntryAccrual : ledgerEntryCash
const yearsForCassa = await getYearsWithData('cassa')
const yearsForCompetenza = await getYearsWithData('competenza')
const yearsForActiveLens = lens === 'competenza' ? yearsForCompetenza : yearsForCassa
```

---

### `app/(app)/dashboard/categories/page.tsx` (controller, request-response)

**Analog:** `app/(app)/dashboard/overview/page.tsx` (same pattern as overview page)

**Identical modifications:**
1. Extend `searchParams` type with `lens?: string`
2. Parse lens, fetch years for both, resolve year with cross-lens fallback
3. Thread `ledgerRowSource` to `getCategoriesBreakdown()`, `getCategoryRanking()`, `getCategoryDeviations()`
4. Pass `lens` to OverviewHeader (or equivalent header component)

---

### `app/(app)/dashboard/categories/[id]/page.tsx` (controller, request-response)

**Analog:** `app/(app)/dashboard/categories/page.tsx` (same pattern as categories page)

**Identical modifications:**
1. Extend `searchParams` type with `lens?: string`
2. Parse lens, resolve year with cross-lens fallback
3. Thread `ledgerRowSource` to `getCategoryDetail()`
4. Pass `lens` to OverviewHeader

---

### `app/(app)/dashboard/tags/page.tsx` (controller, request-response)

**Analog:** `app/(app)/dashboard/tags/page.tsx` (existing tags page)

**Special handling per D-05 (tags are lens-invariant):**
1. Extend `searchParams` type with `lens?: string` (for URL canonicality)
2. Parse lens (for UI state, even though read operations ignore it)
3. Fetch data from `getTagTotals()` — **NO lens parameter, always reads ledgerEntryCash**
4. Pass `lens` to header for rendering the disabled/badged switch
5. Mark lens switch as **disabled** with explanatory note: "i tag sono all-time: la lente non cambia i totali" (D-05, Specifics)

---

## Shared Patterns

### Authentication & Session
**Source:** `lib/dal/auth.ts` (verifySession)
**Apply to:** All DAL aggregation functions

All ten aggregation sites already call `verifySession()` once per function. No changes; lens parameter is peer to existing `userId` parameter.

### Error Handling
**Source:** dashboard.ts try/catch blocks (lines 451–517)
**Apply to:** All modified aggregation functions

All ten sites wrap queries in try/catch, returning zero/empty fallback on error. Extend this pattern unchanged — the swappable row source does not change error semantics.

### Row Source Swapping (Core Pattern)
**Source:** `lib/dal/dashboard.ts` (existing pattern + `lib/dal/dashboard-filters.ts` generalization)
**Apply to:** All aggregation functions (except tags, which hard-code ledgerEntryCash)

Type for swappable row source (already used in dashboard-filters.ts):
```typescript
import { type PgView } from 'drizzle-orm/pg-core'

// At call site (e.g., in app/(app)/dashboard/overview/page.tsx):
const ledgerRowSource: typeof ledgerEntryCash | typeof ledgerEntryAccrual = 
  lens === 'competenza' ? ledgerEntryAccrual : ledgerEntryCash

// Pass to each aggregation:
const totals = await getOverviewAmountTotals(userId, from, to, ledgerRowSource)
```

### Persistence (sessionStorage + URL canonical)
**Source:** `components/dashboard/overview/overview-persistence.ts` + `overview-header.tsx`
**Apply to:** Lens parameter (mirrors existing year persistence)

Key functions to add:
```typescript
export const LENS_STORAGE_KEY = 'dashboard-overview:lens'

export function readSavedLens(storage: Pick<Storage, 'getItem'> | null): 'cassa' | 'competenza' | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(LENS_STORAGE_KEY)
    return raw === 'competenza' ? 'competenza' : null
  } catch {
    return null
  }
}

export function saveLens(storage: Pick<Storage, 'setItem'> | null, lens: 'cassa' | 'competenza'): void {
  if (!storage) return
  try {
    storage.setItem(LENS_STORAGE_KEY, lens)
  } catch {
    // Degrades silently
  }
}
```

### Tab Navigation Preservation
**Source:** `components/dashboard/dashboard-tab-nav.tsx::buildDashboardTabHref`
**Apply to:** All dashboard sub-routes

Single 2-line addition to preserve lens across tab navigation.

---

## No Analog Found

None. All files are modifications to existing code, with patterns established by existing year-selector (persistence) and table-filter (URL canonical) implementations. The ten aggregation sites all follow the same hardcoded-ledgerEntryCash pattern today.

---

## Critical Imports Required

**For all DAL modifications (dashboard.ts, overview.ts, months-with-data.ts, tags.ts):**

Add to imports if not present:
```typescript
import { ledgerEntryAccrual } from '@/lib/db/schema'
```

(ledgerEntryCash already imported in all these files; ledgerEntryAccrual is new)

**For component modifications (overview-header.tsx, overview-persistence.ts):**

Already have:
```typescript
import { readSavedYear, saveYear, safeSessionStorage } from './overview-persistence'
```

Extend to include `readSavedLens`, `saveLens` (in same file).

---

## Double-Netting Trap Warning (ADR 0019 Consequences)

**Critical:** Do NOT call `effectiveAmount()` or check `isNotSecondary()` on instalment rows anywhere in the modified call sites. The seam resolves amounts inside the view; re-applying netting at call sites doubles refunds.

Example — **WRONG:**
```typescript
// WRONG: This doubles the refund.
.select({
  amount: sql`${ledgerRowSource.amount} * (CASE WHEN isNotSecondary() THEN ... END)`
})
```

Example — **CORRECT:**
```typescript
// CORRECT: Amount is pre-resolved inside the view.
.select({
  amount: ledgerRowSource.amount  // Read directly; do not re-net
})
```

---

## Metadata

**Analog search scope:** lib/dal/, components/dashboard/overview/, app/(app)/dashboard/
**Files scanned:** 13 (all modified files are self-analogs; patterns extracted from existing implementations)
**Pattern extraction date:** 2026-07-29

---

*Phase: 80-dashboard-accrual-lens*
*Pattern Map prepared for planner*
