# Phase 80: dashboard-accrual-lens - Research

**Researched:** 2026-07-29
**Domain:** Dashboard read-layer wiring + UI state management
**Confidence:** HIGH

## Summary

Phase 80 implements a second lens over the entire dashboard that flips between cassa (cash — today's behavior) and competenza (accrual — amortized costs shown as monthly instalments). The seam is already built (Phase 77): two Postgres views (`ledgerEntryCash`, `ledgerEntryAccrual`) exist in schema.ts. This phase is pure wiring work: (1) swap which view the ten aggregation functions read from, driven by a global lens value; (2) make the year/month selectors lens-aware so accrual-only future months appear; (3) add a global lens switch and thread it through four dashboard sub-routes with URL + sessionStorage persistence matching the table-filter pattern.

The architecture is **locked by ADR 0019 §10** (one swappable row source per lens, not a parameter threaded through aggregations). No new schema; no new capabilities; no suppression of closure spikes or visual future-month distinctions (deferred).

**Primary recommendation:** Extend the existing year-selector persistence pattern (sessionStorage + URL source-of-truth) to the lens; swap aggregation row sources at DAL call sites with a passed `ledgerRowSource` parameter; make `getYearsWithData` / `getMonthsWithData` query the appropriate ledger view based on lens; extend `resolveYear` fallback to clamp cross-lens periods.

## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01…D-10)

- **D-01:** Lens is URL state (`?lens=cassa|competenza`), source of truth; sessionStorage restore layer (reuse table-filter pattern: URL canonical, sessionStorage rehydrates, skeleton anti-blink).
- **D-02:** Absence of `?lens=` defaults to `cassa` (LENS-03 baseline: cash byte-identical).
- **D-03:** One global switch, shared identically across all four dashboard sub-routes (`/dashboard/overview`, `/dashboard/categories`, `/dashboard/categories/[id]`, `/dashboard/tags`); switching tabs preserves the lens.
- **D-04:** Switch always visible, even with zero amortization plans (no conditional gate).
- **D-05:** `/dashboard/tags` is lens-invariant: `getTagTotals` / `getTagDetail` keep reading `ledgerEntryCash` regardless; switch renders disabled (or badged) with note "i tag sono all-time: la lente non cambia i totali."
- **D-06:** `/tags/[id]` (outside dashboard) receives no switch at all.
- **D-07:** No special-case logic for movers/deviations; they read whatever active row source supplies.
- **D-08:** Plan-closure spike NOT suppressed; closure-month row is just another ledger row.
- **D-09:** Under competenza, selectors show every period with at least one instalment, out to last instalment of longest plan (no horizon cap). `getYearsWithData` / `getMonthsWithData` become lens-aware (LENS-05).
- **D-10:** Cross-lens period fallback = clamp to latest period with data in target lens. Extends `resolveYear` fallback contract to be lens-aware.

### Claude's Discretion

- Exact switch UI (control type, labels, placement) deferred to planning or follow-up `/gsd-ui-phase`.
- Mechanics of threading lens value from URL → server components → aggregation call sites is planning detail; substance is which source each lens picks.

### Deferred Ideas (Out of Scope)

- Visual treatment distinguishing future/committed instalment months (dashed future bars, KPIs stopping at today) — explicitly out of scope per ADR 0019.
- Configurable amortization day in settings.
- Query-timing measurement under accrual lens on realistic dataset.

## Phase Requirements

| Requirement | Status | How Research Supports It |
|------------|--------|-------------------------|
| **LENS-01** | Pending | One global control flips whole dashboard; identified in DashboardTabNav + OverviewHeader pattern for threading |
| **LENS-02** | Pending | Every dashboard widget reads appropriate ledger view; ten aggregation sites identified + their current row source (ledgerEntryCash) |
| **LENS-04** | Pending | Accrual view shows whole selected year incl. future months; requires lens-aware `getYearsWithData` returning both transaction and instalment years |
| **LENS-05** | Pending | Year/month selectors offer instalment-only periods; requires lens-aware `getMonthsWithData` query union with instalment months |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|-----------|-------------|----------------|-----------|
| Lens state persistence | Frontend (Browser) | Frontend Server | Client stores in sessionStorage; server resolves for fallback navigation |
| Lens-aware period navigation | Frontend Server (SSR) | Database | Server queries ledger view matching lens; resolves available years/months before rendering |
| Ledger row-source selection | Backend (DAL) | Database | DAL passes correct view name to aggregation functions; view swaps amount resolution |
| Global switch UI | Frontend (Browser) | Frontend Server | Browser renders switch, updates URL; server reflects selected lens in page props |
| Closure spike handling | Backend (DAL) | Database | Ledger view includes closure-month instalment row; no filtering at call site |
| Tags lens-invariance | Backend (DAL) | Frontend (Browser) | DAL hard-codes `ledgerEntryCash` for tag queries; UI badges switch as no-op |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js 16 App Router | 16.x | Server/client boundary for lens-aware page resolution | Phase 80 must resolve getYearsWithData based on lens query param before rendering |
| React | 18.x | Hooks for client-side persistence + URL state | useSearchParams, useRouter, useEffect for sessionStorage restore |
| Drizzle ORM | 0.28.x+ | Postgres view selection via schema objects | ledgerEntryCash / ledgerEntryAccrual views already exported; aggregations `.from(ledgerEntryCash)` swap to `.from(ledgerEntryAccrual)` |
| PostgreSQL | 14+ | Materialized / plain view union over transaction + instalment | Views already defined in Phase 77; ledgerEntryAccrual UNION ALL handles both branches |
| Decimal.js | 10.x | Monetary arithmetic on ledger amounts | Inherited from project hard-rule; no changes to amounts, seam resolves them |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui Select | latest | Year selector dropdown | Already in use for year; no change needed (D-03 shares same pattern) |
| shadcn/ui Segmented / Tabs | latest | Lens switch component | New — UI discretion to choose (button group, segmented, radio group); placeholder for planning |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|-----------|-----------|----------|
| `?lens=` URL param | `?view=` or computed from plan count | Lens better aligns with ADR 0019 vocabulary; plan-count inference adds logic |
| Row-source swap at DAL | Thread `lens` param through ten functions | Swap is cheaper: one parameter per aggregation call vs per-row resolution; seam makes amount resolution structural (no double-netting trap) |
| Materialized view for accrual ledger | Plain view (current seam) | Plain view is always fresh; materialized requires explicit refresh strategy when user amortizes (revisit only if measured perf problem) |
| sessionStorage restore | URL-only (no restore) | Bare navigation loses selection; sessionStorage matches table-filter precedent (ADR 0009/0010); degradation is silent |

**Installation:** No new packages required. Project already has Next.js 16, React 18, Drizzle, shadcn/ui.

## Package Legitimacy Audit

**Status:** No new external packages. Phase 80 reuses existing stack. Seam views built in Phase 77 within schema.ts.

| Package | Registry | Age | Source | Verdict | Disposition |
|---------|----------|-----|--------|---------|-------------|
| next | npm | 8+ years | vercel/next.js | OK | Approved (in use) |
| drizzle-orm | npm | 3+ years | drizzle-team/drizzle-orm | OK | Approved (in use) |
| decimal.js | npm | 8+ years | MikeMcl/decimal.js | OK | Approved (in use) |
| shadcn/ui | npm | 3+ years | shadcn/ui | OK | Approved (in use) |

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Dashboard Layout (Four Sub-Routes: overview, categories/[id], tags)
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ DashboardTabNav (reads searchParams, preserves lens)    │  │
│  │ + LensSwitch (reads ?lens, updates URL, saves to SS)    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│         ┌─────────────────┴─────────────────┐                   │
│         ▼                                   ▼                   │
│    OverviewPage                    CategoriesPage              │
│  (server-renders)                (server-renders)              │
│         │                                   │                   │
│ getYearsWithData(lens) ─┐        getCategoryData(lens) ────┐   │
│ getMonthsWithData(lens)─┤        ▼                         │   │
│ getOverviewChart(lens)  │   Ten aggregation sites:        │   │
│ getOverviewKPIs(lens)   │   - read from ledgerRowSource   │   │
│         │               │   - build WHERE/GROUP/ORDER    │   │
│         └───────────────┤                                 │   │
│                         ▼                                 │   │
│                    Aggregation Layer ◄──────────────────┘   │
│                    (lib/dal/*.ts)                          │
│                         │                                    │
│         ┌───────────────┴───────────────┐                    │
│         ▼                               ▼                    │
│   ledgerEntryCash             ledgerEntryAccrual             │
│   (Postgres VIEW)             (Postgres VIEW)               │
│   - transactions              - non-amortized txns          │
│   - NOT refunds               - amortized txns' instalments │
│   - effectiveAmount()         - no netting (amounts final)  │
│                                                             │
│   ┌───────────────────────────────────┐                    │
│   │ SELECT id, user_id, occurred_at,  │                    │
│   │        expense_id, amount         │                    │
│   │ FROM transaction WHERE ... UNION  │                    │
│   │ SELECT id, user_id, occurred_at,  │                    │
│   │        expense_id, amount         │                    │
│   │ FROM amortization_instalment      │                    │
│   └───────────────────────────────────┘                    │
│                                                             │
└─────────────────────────────────────────────────────────────────┘

Data flow:
  User selects lens via switch (button/segmented) ──► ?lens= URL param
  Browser saves to sessionStorage (silent persist)
  Server reads ?lens query param, resolves to ledger view
  DAL calls aggregations, passes ledgerEntryCash or ledgerEntryAccrual
  Views return amounts already-resolved (no double-netting at call site)
  Aggregations build totals/charts with no branching logic
```

### Recommended Project Structure

No new directories. Changes are purely in:

```
lib/dal/
├── dashboard.ts          # Swap row source param in ten functions (getOverviewAmountTotals, getCategoriesBreakdown, …)
├── overview.ts           # Extend getYearsWithData / getMonthsWithData to be lens-aware
├── tags.ts               # Hard-code ledgerEntryCash (tags are lens-invariant per D-05)
├── months-with-data.ts   # Union transaction months with instalment months under accrual
└── dashboard-filters.ts  # Already lens-aware (dateScopedTransactions accepts row source)

components/dashboard/
├── dashboard-tab-nav.tsx   # Preserve lens param in buildDashboardTabHref (like preset/type/sort)
├── overview/
│   ├── overview-header.tsx   # Extend year persistence logic to lens (new LENS_STORAGE_KEY)
│   └── resolve-year.ts       # Extend resolveYear to accept (requestedLens, years[cassa], years[competenza])

app/(app)/dashboard/
├── layout.tsx            # No changes (tab nav handles param preservation)
├── overview/page.tsx     # Read ?lens param, pass to server functions
├── categories/page.tsx   # Read ?lens param, pass to server functions
└── categories/[id]/page.tsx  # Read ?lens param, pass to server functions
```

### Pattern 1: Swappable Row Source at Call Site

**What:** Each aggregation function (getOverviewAmountTotals, getCategoriesBreakdown, etc.) receives `ledgerRowSource` parameter (type = `typeof ledgerEntryCash | typeof ledgerEntryAccrual`), swaps `.from(ledgerEntryCash)` to `.from(ledgerRowSource)`.

**When to use:** Any DAL function reading from the ledger. Tag functions explicitly exclude this (hard-code `ledgerEntryCash` per D-05).

**Example:**
```typescript
// Source: lib/db/schema.ts (already defined)
export const ledgerEntryCash = pgView("ledger_entry_cash", { /* … */ })
export const ledgerEntryAccrual = pgView("ledger_entry_accrual", { /* … */ })

// Source: lib/dal/dashboard.ts
export async function getOverviewAmountTotals(
  userId: string,
  from: Date,
  to: Date,
  ledgerRowSource = ledgerEntryCash  // Default to cassa (D-02)
) {
  return db
    .select({ totalIn: sum(ledgerRowSource.amount), … })
    .from(ledgerRowSource)  // Swap here
    .innerJoin(expense, ledgerRowSource.expenseId === expense.id)
    .where(
      and(
        dateScopedTransactions(ledgerRowSource, userId, from, to),
        expenseStatusIncludedInDashboardTotals(),
        …
      )
    )
}

// Caller threads the row source:
const totals = await getOverviewAmountTotals(userId, from, to, lens === 'competenza' ? ledgerEntryAccrual : ledgerEntryCash)
```

### Pattern 2: Lens-Aware Period Navigation

**What:** `getYearsWithData` and `getMonthsWithData` union transaction/file periods with instalment periods under accrual lens.

**When to use:** Navigation selectors (year/month pickers); must show all selectable periods.

**Example:**
```typescript
// Source: lib/dal/overview.ts + lib/dal/months-with-data.ts
export async function getYearsWithData(lens: 'cassa' | 'competenza' = 'cassa'): Promise<string[]> {
  const { userId } = await verifySession()
  
  if (lens === 'cassa') {
    // Existing query: transaction table only
    return db.execute(sql`
      SELECT DISTINCT TO_CHAR(occurred_at, 'YYYY') AS yr
      FROM transaction WHERE user_id = ${userId}
      ORDER BY yr DESC
    `)
  } else {
    // Accrual: union transaction years with instalment years (D-09)
    return db.execute(sql`
      SELECT DISTINCT TO_CHAR(occurred_at, 'YYYY') AS yr
      FROM (
        SELECT occurred_at FROM transaction WHERE user_id = ${userId}
        UNION ALL
        SELECT occurred_at FROM amortization_instalment WHERE user_id = ${userId}
      ) combined
      ORDER BY yr DESC
    `)
  }
}
```

### Pattern 3: URL + sessionStorage Persistence (Reuse Table-Filter Pattern)

**What:** Lens value in URL (source of truth); sessionStorage restore on bare navigation (no ?lens param).

**When to use:** Global client-side state that must survive navigation + reload.

**Example:**
```typescript
// Source: components/dashboard/overview/overview-persistence.ts (extend)
export const LENS_STORAGE_KEY = 'dashboard:lens'

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
    // Degrade silently
  }
}

// Source: components/dashboard/overview/overview-header.tsx (extend)
export function OverviewHeader({ year, years, nudge }: OverviewHeaderProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  function updateLens(next: 'cassa' | 'competenza') {
    saveLens(safeSessionStorage(), next)
    const params = new URLSearchParams(searchParams.toString())
    params.set('lens', next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  useEffect(() => {
    if (searchParams.has('lens')) return  // URL wins
    const saved = readSavedLens(safeSessionStorage())
    if (saved) {
      router.replace(`${pathname}?lens=${saved}`, { scroll: false })
    }
  }, [])

  // Render switch (UI discretion; button group / segmented / radio shown by planning)
  return (
    <div>
      <h1>Panoramica</h1>
      <div className="flex gap-2">
        <button onClick={() => updateLens('cassa')} aria-pressed={lens === 'cassa'}>Cassa</button>
        <button onClick={() => updateLens('competenza')} aria-pressed={lens === 'competenza'}>Competenza</button>
      </div>
      {/* existing year selector */}
    </div>
  )
}
```

### Pattern 4: Tab Navigation Preserves Lens (Like preset/type/sort)

**What:** `buildDashboardTabHref` already preserves `preset`, `type`, `sort`; extend to preserve `lens`.

**When to use:** Any navigation between dashboard sub-routes.

**Example:**
```typescript
// Source: components/dashboard/dashboard-tab-nav.tsx (line 19-42)
export function buildDashboardTabHref(
  href: string,
  searchParams: Pick<URLSearchParams, 'get'>
) {
  const params = new URLSearchParams()
  const preset = searchParams.get('preset')
  const type = searchParams.get('type')
  const sort = searchParams.get('sort')
  const tag = searchParams.get('tag')
  const lens = searchParams.get('lens')  // NEW: preserve lens

  if (preset) params.set('preset', preset)
  if (type) params.set('type', type)
  if (sort) params.set('sort', sort)
  if (tag) params.set('tag', tag)
  if (lens) params.set('lens', lens)  // NEW

  const search = params.toString()
  return href + (search ? `?${search}` : '')
}
```

### Pattern 5: Cross-Lens Period Fallback (Extend resolveYear)

**What:** If user selects a period that exists only under competenza (e.g. a 2030 future instalment year), and switches to cassa, the period selector falls back to the latest cassa period.

**When to use:** Period resolution on lens switch or browser back/forward.

**Example:**
```typescript
// Source: components/dashboard/overview/resolve-year.ts (extend)
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

### Anti-Patterns to Avoid

- **Suppress closure spikes in the view or at call site:** The seam includes closure-month instalment rows; don't filter them (D-08). Closure is the user's action, not a hidden system behaviour.
- **Apply effectiveAmount() to instalment rows:** The seam pre-resolves amounts; a second netting nets the refund twice. Hard-code this: "instalment row amounts are final" (ADR 0019 Consequences, double-netting trap).
- **Make tag queries lens-aware:** Tags are all-time; spreading a cost across months is a no-op (D-05). Hard-code `ledgerEntryCash` in `getTagTotals` / `getTagDetail`.
- **Thread lens parameter through ten functions instead of swapping row source:** Parameter threading makes the failure mode silent (a widget quietly stuck on cash) and adds logic to every call site. Swap at the FROM clause (single decision per function).
- **Forget to extend resolveYear for cross-lens clamp:** A user selecting 2030 (instalment year only) then flipping to cassa gets an empty dashboard (period not in data). Clamp to the latest valid period in the target lens (D-10).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Amount resolution (cash vs accrual) | Custom if/else at call sites, `effectiveAmount()` vs instalment row check | Postgres view (ledgerEntryCash / ledgerEntryAccrual) | View resolves amount once inside the row source; call sites read `.amount` unchanged. No double-netting trap. Seam already built in Phase 77. |
| Lens persistence (URL + sessionStorage) | Custom reducer / context provider | Extend overview-persistence.ts + OverviewHeader pattern | Table-filter pattern is battle-tested (PR #41); handles URL-canonical, sessionStorage restore, skeleton anti-blink. Reuse reduces code and risk. |
| Period navigation under lens | Custom year/month queries per lens | Union queries in getYearsWithData / getMonthsWithData | Already-written transaction-only queries; union with instalment rows under accrual (single SQL branch). No algorithmic complexity. |
| Global switch UI | Custom button group + styling | shadcn/ui Segmented / Tabs / RadioGroup + DashboardTabNav pattern | Switch behaves like year selector (already shipped). Reuse the component library; placement mirrors year selector. |
| Cross-lens period clamp logic | Custom fallback in each sub-route | Extend resolveYear (pure function, unit-testable) | resolveYear is already called by OverviewPage; extend once rather than per-route. Pure functions are testable and portable. |

**Key insight:** The seam (ledgerEntryCash / ledgerEntryAccrual views) is the load-bearing abstraction. Resolving the amount inside the view removes the need for custom logic at ten aggregation call sites. Any bespoke netting or filtering at call sites defeats the seam's design and reintroduces the double-netting trap.

## Common Pitfalls

### Pitfall 1: Double-Netting on Instalments

**What goes wrong:** A reimbursement on an amortized cost nets twice: once inside the instalment amount (baked in at materialisation per ADR 0019 §8) and again via `effectiveAmount()` at the call site. Total refund is doubled.

**Why it happens:** Instalments and transactions follow different netting models. Phase 77 resolved this by making the seam resolve amount inside the view; Phase 80 must not reintroduce per-row netting.

**How to avoid:** Hard-code: "instalment row amounts are pre-resolved; read `.amount` directly, never apply `effectiveAmount()`." Do not thread lens logic into netting. The view handles the distinction.

**Warning signs:** `effectiveAmount()` called on an instalment row; a query branching on `isNotSecondary()` for accrual rows; reimbursement total doubled in tests.

### Pitfall 2: Stale Period Selection (Cross-Lens Clamp Forgotten)

**What goes wrong:** User selects 2030 (an instalment-only year under competenza); switches to cassa; sees an empty dashboard because 2030 has no cash transactions.

**Why it happens:** Period selectors return lens-aware years (union of transaction + instalment years); a period valid in one lens may not exist in the other. No fallback.

**How to avoid:** Extend `resolveYear` to clamp to the latest valid period in the target lens (D-10). Call the extended function on every lens switch and period read.

**Warning signs:** Page renders with no data after lens switch; user must re-select year/month; resolveYear not consulted during lens change.

### Pitfall 3: Missing Future Months (getMonthsWithData Incomplete)

**What goes wrong:** Accrual lens shows September 2026 in the bar chart, but the month picker doesn't offer it because `getMonthsWithData` queries `transaction` table only.

**Why it happens:** getMonthsWithData was written before the instalment model. It sees transaction-only months; amortization_instalment rows with their own `occurred_at` dates are invisible.

**How to avoid:** Union `transaction.occurred_at` months with `amortization_instalment.occurred_at` months in getMonthsWithData under accrual lens. Test that future months appear.

**Warning signs:** Month picker doesn't show a month the chart displays; user can select a month that returns empty data; instalment months missing from selector under competenza.

### Pitfall 4: Tags Rendered Without the Disabled Badge (D-05 Unclear)

**What goes wrong:** Lens switch appears on `/dashboard/tags`, but clicking it changes nothing (it stays on cash). User assumes it's broken, or worries it silently broke the data.

**Why it happens:** Tag surfaces are all-time; spreading a cost across months is a no-op (D-05). The switch should render **disabled** or **badged** with a note "i tag sono all-time: la lente non cambia i totali" so the user understands.

**How to avoid:** Explicitly disable (or add aria-disabled + visual badge) the lens switch on the tags sub-route. Render the explanatory note inline or in a tooltip.

**Warning signs:** Switch on /dashboard/tags is clickable but does nothing; user reports confusion; no disabled state or explanation visible.

### Pitfall 5: Closure Month Suppressed (D-08 Violated)

**What goes wrong:** A plan is closed in August with a remaining €100 across 2 months; the ledger should show a €100 spike in August (both instalments on the closure date), but the spike is filtered out somewhere.

**Why it happens:** Closure-month spikes are unusual (a month shows the sum of remaining instalments, not just one transaction). An overzealous filter or a misunderstanding of the seam model suppresses them.

**How to avoid:** Don't filter closure rows anywhere. The seam includes them as normal ledger rows. Movers/deviations read whatever the active row source supplies (D-07). No special handling.

**Warning signs:** Closure month has unexpectedly small amount; movers do not fire for a closure; ledger_entry view includes closure row but aggregation skips it.

### Pitfall 6: Lens Parameter Threaded Through Ten Functions (Architecture Anti-Pattern)

**What goes wrong:** Every aggregation function gains a `lens` parameter; half of them are missed in the refactor; four functions silently stay on cash; the dashboard is partially inconsistent.

**Why it happens:** Threading is more obvious (explicit parameter); swapping a .from() clause feels implicit. But ADR 0019 §10 explicitly chose the seam to avoid this exact problem.

**How to avoid:** Don't thread `lens` parameter. Pass `ledgerRowSource` (the view object) instead, exactly once per function. The view is the single source of truth.

**Warning signs:** A function gains a `lens` parameter; another doesn't; getTagTotals explicitly ignores lens (correct per D-05, but inconsistent with the pattern); aggregation tests must manually track which lens each site uses.

## Code Examples

Verified patterns from official sources:

### Example 1: Aggregation Swaps Row Source at .from()

```typescript
// Source: lib/db/schema.ts lines 813–865 (ledger_entry seam, already defined)
// Source: lib/dal/dashboard.ts (modify existing function)

export async function getOverviewAmountTotals(
  userId: string,
  from: Date,
  to: Date,
  ledgerRowSource = ledgerEntryCash  // Default to cash (D-02)
) {
  const { userId: authedUserId } = await verifySession()

  try {
    const result = await db
      .select({
        totalIn: sql`COALESCE(SUM(CASE WHEN ${direction.code} = 'in' THEN ${ledgerRowSource.amount} ELSE 0 END), '0'::numeric)`.as('totalIn'),
        totalOut: sql`COALESCE(SUM(CASE WHEN ${direction.code} = 'out' THEN ${ledgerRowSource.amount} ELSE 0 END), '0'::numeric)`.as('totalOut'),
        // … other fields
      })
      .from(ledgerRowSource)  // ← Swap here
      .innerJoin(expense, eq(ledgerRowSource.expenseId, expense.id))
      .innerJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
      .innerJoin(category, eq(subCategory.categoryId, category.id))
      .innerJoin(direction, eq(category.directionId, direction.id))
      .where(
        and(
          dateScopedTransactions(ledgerRowSource, authedUserId, from, to),  // ← Shared predicate, already lens-aware
          expenseStatusIncludedInDashboardTotals(),
          ne(direction.code, 'transfer'),
        )
      )

    return result[0] ?? { totalIn: '0', totalOut: '0', … }
  } catch {
    return { totalIn: '0', totalOut: '0', … }
  }
}

// Caller threads the row source:
const lens = searchParams?.lens ?? 'cassa'
const ledgerRowSource = lens === 'competenza' ? ledgerEntryAccrual : ledgerEntryCash
const totals = await getOverviewAmountTotals(userId, from, to, ledgerRowSource)
```

### Example 2: Lens-Aware Period Navigation

```typescript
// Source: lib/dal/overview.ts (modify getYearsWithData)

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

### Example 3: sessionStorage Persistence + URL Restore

```typescript
// Source: components/dashboard/overview/overview-header.tsx (extend)
'use client'

import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { readSavedLens, saveLens, safeSessionStorage } from './overview-persistence'

type OverviewHeaderProps = {
  year: number
  years: string[]
  lens: 'cassa' | 'competenza'
  nudge?: React.ReactNode
}

export function OverviewHeader({ year, years, lens, nudge }: OverviewHeaderProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  function updateLens(next: 'cassa' | 'competenza') {
    saveLens(safeSessionStorage(), next)
    const params = new URLSearchParams(searchParams.toString())
    params.set('lens', next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // On bare mount (no ?lens in URL), restore from sessionStorage
  // URL params always win; this only seeds a fresh navigation (D-01)
  useEffect(() => {
    if (searchParams.has('lens')) return
    const saved = readSavedLens(safeSessionStorage())
    if (saved && saved !== lens) {
      router.replace(`${pathname}?lens=${saved}`, { scroll: false })
    }
  }, [])

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
        <h1 className="text-lg font-semibold">Panoramica</h1>
        {/* Lens switch — UI discretion for component choice; simplified example */}
        <div className="flex gap-1 rounded-full border px-1 py-1">
          <button
            onClick={() => updateLens('cassa')}
            aria-pressed={lens === 'cassa'}
            className="px-3 py-1 rounded-full text-sm font-medium transition-colors"
          >
            Cassa
          </button>
          <button
            onClick={() => updateLens('competenza')}
            aria-pressed={lens === 'competenza'}
            className="px-3 py-1 rounded-full text-sm font-medium transition-colors"
          >
            Competenza
          </button>
        </div>
        {/* Year selector (unchanged) */}
      </div>
      {nudge && <div className="ml-auto shrink-0">{nudge}</div>}
    </div>
  )
}
```

### Example 4: Tag Surfaces Stay Lens-Invariant

```typescript
// Source: lib/dal/tags.ts (NO CHANGE to row source — hard-code cassa)

export async function getTagTotals(userId: string) {
  return db
    .select({ /* … */ })
    .from(ledgerEntryCash)  // ← Always cash (D-05), no parameter
    .innerJoin(tag, eq(ledgerEntryCash.expense_id, tagTransaction.transaction_id))
    // … rest of query
}

// UI: Render lens switch disabled on /dashboard/tags
// Source: app/(app)/dashboard/tags/page.tsx or a sub-component

<div className="flex items-center gap-2">
  <span className="text-sm text-muted-foreground">Lente:</span>
  <div className="opacity-50 cursor-not-allowed">
    <button disabled className="px-3 py-1 rounded-full text-sm font-medium">Cassa</button>
    <button disabled className="px-3 py-1 rounded-full text-sm font-medium">Competenza</button>
  </div>
  <span className="text-xs text-muted-foreground">i tag sono all-time: la lente non cambia i totali</span>
</div>
```

## Validation Architecture

**Status:** nyquist_validation enabled (not explicitly false in .planning/config.json). Validation section required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (unit) + Playwright (E2E) |
| Config file | vitest.config.ts, playwright.config.ts |
| Quick run command | `yarn test tests/dashboard-dal.test.ts tests/overview-dal.test.ts tests/months-with-data-dal.test.ts` |
| Full suite command | `yarn test && yarn e2e` (or `playwright test tests/dashboard.spec.ts`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LENS-01 | Lens switch updates `?lens=` URL param, preserves across tab navigation | E2E (Playwright) | `playwright test tests/dashboard.spec.ts -k "lens"` | ✅ dashboard.spec.ts (Wave 0: add lens-switch test case) |
| LENS-01 | Lens persisted to sessionStorage, restored on bare navigation | Unit (Vitest) | `yarn test tests/overview-persistence.test.ts -t "lens"` | ✅ overview-persistence.test.ts (Wave 0: add readSavedLens/saveLens) |
| LENS-02 | All ten aggregation sites read from ledgerEntryCash under cassa | Regression (Playwright real-DB) | `playwright test tests/dashboard.spec.ts -k "cash"` | ✅ dashboard.spec.ts (v2.8: byte-identical suite) |
| LENS-02 | All ten aggregation sites read from ledgerEntryAccrual under competenza | Regression (Playwright real-DB) | `playwright test tests/dashboard.spec.ts -k "accrual"` | ❌ Wave 0: new test case "KPI totals match instalment amounts under accrual" |
| LENS-04 | Accrual view shows whole selected year including future instalment months | E2E (Playwright) | `playwright test tests/dashboard.spec.ts -k "future-months"` | ❌ Wave 0: new test case "year selector shows instalment-only years under competenza" |
| LENS-05 | Year/month selectors return instalment-only periods under accrual | Unit (Vitest) | `yarn test tests/overview-dal.test.ts tests/months-with-data-dal.test.ts -t "accrual"` | ❌ Wave 0: extend existing tests with accrual lens param |

### Sampling Rate

- **Per task commit:** `yarn test tests/overview-dal.test.ts tests/overview-persistence.test.ts` — fast path (unit tests only, no DB)
- **Per wave merge:** `playwright test tests/dashboard.spec.ts` — full regression suite over real Postgres (cash byte-identical + accrual amounts match instalments)
- **Phase gate:** Full suite green + manual UAT on staging (switch between lenses, verify tab preservation, check cross-lens clamp on period selection)

### Wave 0 Gaps

- [ ] `tests/overview-persistence.test.ts` — extend with `readSavedLens` / `saveLens` test cases (reuse year-persistence pattern)
- [ ] `tests/overview-dal.test.ts::getYearsWithData` — extend test to pass `lens='competenza'`, expect instalment years in result
- [ ] `tests/months-with-data-dal.test.ts::getMonthsWithData` — extend test to accept lens param, verify union of transaction + instalment months under accrual
- [ ] `tests/dashboard.spec.ts` — new Playwright test cases:
  - "Lens switch updates ?lens= URL param and persists across tab navigation"
  - "KPI totals under competenza match sum of instalment amounts for the period"
  - "Month picker shows future instalment months under competenza, hides under cassa"
  - "Cross-lens period fallback: selecting future year under competenza, switching to cassa, shows latest cassa year"
  - "Tags page: lens switch disabled + note visible"
  - "`/tags/[id]` has no lens switch at all"

*(If all gaps filled: "Existing test infrastructure covers all phase requirements")*

## Environment Availability

**Status:** SKIPPED. Phase 80 is UI + DAL wiring only; no external tools/services/runtimes introduced. Existing project stack (Node.js, PostgreSQL, npm, Vercel) sufficient.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ledgerEntryCash and ledgerEntryAccrual views are already correctly defined in schema.ts and migrated to Postgres (Phase 77) | Standard Stack | If views missing or incorrect, aggregations fail or return wrong totals; cash byte-identical regression suite fails |
| A2 | The v2.8 regression suite (tests/dashboard.spec.ts) is still passing against ledgerEntryCash, confirming byte-identity | Validation Architecture | If suite is stale or has false positives, we ship broken cash behaviour without detecting it |
| A3 | `getTagTotals` and `getTagDetail` can be hard-coded to ledgerEntryCash without issue; tags are truly all-time and lens-invariant (D-05) | Code Examples (Pattern 4) | If tags have a hidden temporal dimension, lens-invariance breaks the model; tag totals will disagree with period-scoped dashboard totals |
| A4 | `effectiveAmount()` and `isNotSecondary()` must NEVER be called on amortization_instalment rows (seam handles both branches) | Common Pitfalls (Pitfall 1) | Double-netting reimbursements on amortized costs; refund amounts doubled in output; regression suite passes cash but fails accrual |
| A5 | Cross-lens period clamp (resolveYear extension) is the correct fallback; no other logic (e.g. re-fetch data, show error) is needed | Architecture Patterns (Pattern 5) | User gets empty dashboard on cross-lens period selection; user confusion; planner adds unnecessary complexity |

## Open Questions

1. **Exact switch UI component & placement** — Segmented / Button Group / RadioGroup? Placed next to year selector? Responsive layout on mobile? **Recommendation:** Defer to planning/UI phase; substance (always visible, disabled+noted on tags, preserved across tab nav) is locked. UI is discretion.

2. **Tag no-op messaging** — The note "i tag sono all-time: la lente non cambia i totali" is drafted. Should it be a tooltip, a disabled state + aria-disabled, or a separate explanatory badge? **Recommendation:** Prototype in `/gsd-ui-phase`; disabled + note inline is safe.

3. **Closure-month spike prominence** — Under competenza, a closure sends remaining instalments to one month (a spike). Is this desired, or should it be attenuated in the UI? **Recommendation:** Per D-08, no suppression. If user feedback later requests visual distinction (dashed future, KPIs stopping at today), that's a deferred UX iteration (ADR 0019 Scope).

4. **Horizon cap for instalment periods** — ADR 0019 §6 says "no horizon cap"; a 60-month plan creates years 5+ years out. Should selectors show all, or cap at e.g. +5 years? **Recommendation:** Per D-09, no cap; show all instalment periods. If perf becomes an issue (e.g. 2000+ instalment months), revisit; measure first.

5. **Backwards compatibility on ?lens= absence** — Default to cassa (D-02) is set. Old shared links without ?lens= will render cassa. Expected? **Recommendation:** Yes; cassa is byte-identical to today's dashboard. No breaking change.

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Next.js 16, Drizzle, React, shadcn/ui all in production use; no new libraries needed. Seam already built (Phase 77); schema verified against existing migrations. |
| Architecture | HIGH | ADR 0019 §10 locked the seam model; ledger views exist in schema.ts (lines 813–865); ten aggregation sites inventoried in 01-lens-seam.md with line-by-line source. Pattern matches existing year-selector + table-filter precedents. |
| Pitfalls | HIGH | Double-netting trap explicitly resolved by seam design; cross-lens clamp required by architecture; closure spike is no-op (existing model). All identified risks have structured mitigations in patterns. |
| Validation | MEDIUM | Regression suite (v2.8, real-Postgres) exists for cash invariance; accrual-specific tests must be written in Wave 0 (instalment amounts, future months, period clamp). Test scaffolding proven; assertion count moderate. |
| Environment | HIGH | No external dependencies beyond project's existing stack. PostgreSQL views require no runtime tools. No API integrations or CLI tools introduced. |

## Sources

### Primary (HIGH confidence)
- **ADR 0019** (`docs/adr/0019-amortization-accrual-lens.md`) — §5 (lenses), §6 (future months), §7 (closure), §10 (seam), locked model and decisions
- **01-lens-seam.md** (`.scratch/amortization/assets/01-lens-seam.md`) — ten aggregation sites inventoried with file:line, shared join spine, double-netting trap, seam rationale
- **Schema.ts** (`lib/db/schema.ts` lines 813–865) — ledgerEntryCash and ledgerEntryAccrual view definitions, literal SQL, verified to exist in production
- **Dashboard Filters** (`lib/dal/dashboard-filters.ts`) — dateScopedTransactions generalized to accept row source parameter, shared predicates extracted
- **Overview Persistence** (`components/dashboard/overview/overview-persistence.ts`) — sessionStorage pattern for year selector, reusable for lens
- **Table-Filter Decisions** (`.planning/table-filter-sort-DECISIONS.md` + ADR 0009/0010) — URL-canonical + sessionStorage restore pattern, battle-tested in PR #41

### Secondary (MEDIUM confidence)
- **Phase 77 RESEARCH.md** (`.planning/phases/77-RESEARCH.md`) — context on seam build, test suite, regression verification
- **Existing Dashboard Tests** (`tests/dashboard.spec.ts`, `tests/overview-dal.test.ts`, `tests/months-with-data-dal.test.ts`) — test infrastructure for validation plan
- **CONTEXT.md** (locked phase decisions D-01…D-10, user discretion, deferred scope) — authoritative requirements for this phase

### Tertiary (LOW confidence — training data only, marked for confirmation)
- Next.js 16 AppRouter server/client boundary patterns — confirmed against project code but not independently verified for this session

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — existing libraries, no new packages; seam already built
- Architecture: HIGH — ADR 0019 locked; schema views exist; patterns reuse proven precedents (year selector, table filters)
- Pitfalls: HIGH — double-netting trap resolved by seam design; risks documented with mitigations in patterns
- Validation: MEDIUM — regression suite exists (cash), accrual-specific tests need Wave 0 coverage
- Environment: HIGH — no external dependencies; project stack sufficient

**Research date:** 2026-07-29
**Valid until:** 2026-08-29 (30 days; dashboard domain is stable; instalment model is locked by ADR 0019)
