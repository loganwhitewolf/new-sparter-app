# Phase 79: amortizations-registry - Research

**Researched:** 2026-07-28  
**Domain:** Registry UI + read-path for amortization plans (Phase 77/78 lifecycle surface)  
**Confidence:** HIGH

## Summary

Phase 79 delivers a dedicated `/amortizations` registry page that lists every amortization plan (open and closed) with derived monthly spread values, a summary header showing total open net residual, lets the user close plans from the registry (scrap-close only, reusing the existing `CloseAmortizationDialog`), and visually distinguishes open from closed plans with a default open-only filter.

This is a **UI + read-path phase** on top of the Phase 77–78 lifecycle (amortization activation, close/realize/reimburse mechanics). The lifecycle services (`closePlanTx` / `realizePlanTx` / `reducePlanTx`), actions (`closePlanAction`), and dialogs (`CloseAmortizationDialog`) already exist in Phase 78. Phase 79 adds:
- A DAL list query (`getAmortizationPlanList`) that derives per-row initial/consumed/net/remaining values from the schema snapshot + instalments
- The RSC page `app/(app)/amortizations/page.tsx` following the `/reimbursements` pattern
- An interactive registry table with URL-backed search + status filter + sort
- Summary header (total open net residual)
- Navigation entry + route constant
- Wiring of the existing close flow

**Primary recommendation:** Mirror the `/reimbursements` registry stack structurally (RSC page → `verifySession` → DAL → EmptyState vs. interactive table) and reuse the Phase 78 lifecycle services + dialogs without new mechanics.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-A1 — Close from registry (scrap-close only, no inline sale entry)**
- Registry "Chiudi" action **collapses remaining onto closure month** (Phase 78 D-01 semantics)
- **Reuses `CloseAmortizationDialog` as-is** (already calls `closePlanAction({ planId })`)
- Deliberately does NOT offer inline scalar sale/realization value, because Phase 78 D-02 locked realization = **real transaction link only** (never synthetic)
- Reversible (surfacing existing service on new page)

**D-A2 — Realize deep-link to transaction detail**
- Registry row also offers **"Realizza con vendita"** entry point → navigates to **transaction detail page** with the Phase 78 realization flow
- Keeps "never synthetic" invariant; avoids duplicating transaction picker UI in registry
- Reversible

**D-A3 — Actions on open plans only**
- Close + Realizza actions appear **only on open plans**
- Closed plans are read-only rows (no actions)
- Reversible (per-row conditional)

**D-B1 — Summary header: total open net residual**
- Single aggregate: **sum of net value still to amortize across all open plans** (Decimal.js)
- One number only, not a multi-KPI strip
- The most actionable at-a-glance metric

**D-B2 — Months column: X/N with progress bar**
- Reads "11/20" (consumed / total instalments) with **light progress bar**
- Locked columns per REG-01: description, transaction date, initial amount, consumed amount, net value

**D-C1 — Default to open plans, with status filter**
- Registry **defaults to open-only** (less noise; closed plans still reachable)
- **Status filter** (client-side) reveals closed plans in same table
- Follows `/reimbursements` v2.8 pattern (URL-backed search + filter + sort)

**D-C2 — Default sort: remaining months ascending**
- Plans closest to completion appear first
- Surfaces what is about to finish/close

**D-C3 (Claude's discretion) — Closed-plan badge/styling**
- Distinction must be unambiguous at a glance (REG-03)
- Specific badge color/row styling decided at UI-phase

**D-D1 — Row navigation to transaction detail**
- Clicking a registry row navigates to **transaction detail page** (`/transactions/[id]`)
- **No dedicated `/amortizations/[id]` plan detail page** — the transaction hosts the full Phase 78 lifecycle (realize, reimburse, remove amortization)
- Consistent with D-A2 "Realizza" target

### Claude's Discretion

- Navigation menu entry for `/amortizations` (where it appears in sidebar)
- `EmptyState` copy for the no-plans account
- Route constant + href helper in `lib/routes.ts` (following `/reimbursements` conventions)
- DAL query shape (single list query deriving initial/consumed/net/remaining from `amortizationPlan.totalAmount` snapshot + `amortizationInstalment` rows)
- Closed-plan badge styling (D-C3)

### Deferred Ideas (OUT OF SCOPE)

- Dedicated `/amortizations/[id]` plan detail page (transaction detail is the plan's detail, D-D1)
- Inline sale-value entry / inline transaction linking in registry (deferred to transaction detail, ADR 0019 §8)
- Global cassa/competenza switch, accrual widgets, whole-year accrual view → **Phase 80**

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REG-01 | User can see all amortization plans in `/amortizations` showing description, transaction date, initial amount, consumed amount, net value, remaining months per plan | DAL query pattern documented; schema columns identified; derived values (initial=totalAmount, consumed=sum of past instalments, net=total-consumed, remaining=future instalments) |
| REG-02 | User can close a plan from the registry, optionally entering a sale/realization value | Scrap-close via `CloseAmortizationDialog` locked; realization via deep-link to transaction detail (D-A2) |
| REG-03 | User can distinguish open from closed plans in the registry | Default open-only with status filter; closed-plan badge (D-C3 styling deferred to UI phase) |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| List fetch & empty state | Frontend Server (RSC) | — | `verifySession` → DAL → conditionally render EmptyState or table |
| Table filtering/sorting/search | Browser | Frontend Server (URL-backed) | Client-side filtering on page data (q + status); sort applied via URL param; DAL delivers pre-sorted baseline (similar to /reimbursements) |
| Close plan action wiring | Backend (Server Action) | Frontend (Dialog) | `closePlanAction` calls `closePlanTx` in transaction; dialog calls action; revalidates after success |
| Realize deep-link | Frontend (Browser) | API (href generation) | Row action → generate `transactionDetailHref(transactionId)` → navigate; no new backend |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Decimal.js | via `@/lib/utils/decimal` | Monetary arithmetic for initial/consumed/net/remaining derivations | Required by CLAUDE.md; DECIMAL columns are strings; all money must use `toDecimal()` / `toDbDecimal()` |
| Drizzle ORM | current | DAL queries against PostgreSQL | Established for all DAL work in Sparter |
| Better Auth | current | Session verification (`verifySession()`) | Standard auth provider; session check only in RSC, no DB in edge runtime |
| Next.js 16 App Router | current | RSC page structure, route groups, Server Actions | Framework standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | current | Input validation for `closePlanAction` (via `ClosePlanSchema`) | Server Action parameter validation |
| Intl.NumberFormat | built-in | Currency formatting (EUR, it-IT locale) | Format monetary amounts in table cells |
| URL URLSearchParams | built-in | Parse/build query params for filter/sort | URL-backed table state management |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DAL single list query | Multiple queries per row (plan + instalment aggregates) | Single query is more efficient; DAL pattern is already proven by `getReimbursementList` |
| Reuse `CloseAmortizationDialog` | New inline close form in registry | Dialog is already implemented, tested, and semantically correct; reuse keeps maintenance burden lower |
| Row detail page in registry | Dedicated `/amortizations/[id]` | Transaction detail already hosts the full lifecycle; this keeps amortization concerns in one place (the transaction model) |

**Installation:**
```bash
# No new packages needed; builds on existing Sparter stack
# Verify Decimal.js is available:
npm view decimal.js version
# Current Sparter: 10.4.3+
```

---

## Live Schema: amortizationPlan & amortizationInstalment

From `lib/db/schema.ts` (lines 653–715):

### amortizationPlan
```typescript
pgTable("amortization_plan", {
  id: text("id").primaryKey(),                           // UUID
  userId: text("user_id").notNull(),                     // FK user
  transactionId: text("transaction_id").notNull(),       // FK transaction (UNIQUE)
  months: integer("months").notNull(),                   // N total instalments (≥2)
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("open"),  // "open" | "closed"
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),  // Snapshot at creation (DECIMAL → string)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
// Indexes: userId, userId+status (for filtering)
// Constraint: months >= 2; transactionId is UNIQUE
```

### amortizationInstalment
```typescript
pgTable("amortization_instalment", {
  id: text("id").primaryKey(),                           // UUID
  userId: text("user_id").notNull(),                     // FK user
  planId: text("plan_id").notNull(),                     // FK amortizationPlan
  instalmentNumber: integer("instalment_number").notNull(),  // 1..N (UNIQUE per planId)
  expenseId: text("expense_id").notNull(),               // FK Standalone Expense (shared across all instalments of one plan)
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),  // DECIMAL → string
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})
// Indexes: userId, planId, expenseId, userId+occurredAt
// Constraint: instalmentNumber >= 1; UNIQUE(planId, instalmentNumber)
```

**Key facts for DAL design:**
- `totalAmount` on plan is **snapshot at creation** — immutable baseline for derived values
- Instalments are **materialised** (one row per month) for cheap dashboard reads
- Every instalment of one plan shares the **same Standalone Expense** (`expenseId` identical)
- Closure collapses future instalments onto closure month; past instalments untouched (ADR 0019 §7)
- **DECIMAL columns return as strings from Drizzle** — must use `toDecimal()` before arithmetic

---

## Pattern to Mirror: `/reimbursements` Stack

Phase 79 replicates the v2.8 `/reimbursements` registry structure precisely. Reference files:

### RSC Page Structure
**File:** `app/(app)/reimbursements/page.tsx`

Pattern:
```typescript
export const metadata = { title: 'Rimborsi' }  // or 'Ammortamenti'

export default async function AmortizationsPage() {
  const { userId } = await verifySession()
  const plans = await getAmortizationPlanList(userId)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ammortamenti</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          [Descriptive subtitle, Italian product surface]
        </p>
      </div>

      {plans.length === 0 ? (
        <EmptyState variant="no-data" message="..." hint="..." />
      ) : (
        <AmortizationTable plans={plans} route={APP_ROUTES.amortizations} />
      )}
    </div>
  )
}
```

**Summary header (D-B1):**
- Mount above the table, or as a top card
- Display single KPI: **"Netto residuo aperto: €X.XXX,XX"**
- Computed on the client from filtered (open) plans: `plans.filter(p => p.status === 'open').reduce((sum, p) => sum.plus(toDecimal(p.netValue)), toDecimal('0'))`
- Or computed on server pre-page if efficiency required (not necessary for first cut)

### DAL List Query
**File:** `lib/dal/amortization.ts` (new)

Pattern (mirrors `getReimbursementList`):
```typescript
export type AmortizationPlanListRow = {
  id: string
  planId: string
  transactionId: string
  description: string                    // from transaction.description
  transactionDate: Date                  // from transaction.occurredAt
  initialAmount: string                  // = plan.totalAmount
  consumedAmount: string                 // = sum of past instalments (occurredAt < today)
  netValue: string                        // = initialAmount - consumedAmount
  remainingMonths: number                 // = count of future instalments
  totalMonths: number                     // = plan.months
  status: 'open' | 'closed'               // from plan.status
  planCreatedAt: Date                     // from plan.createdAt
}

export async function getAmortizationPlanList(userId: string): Promise<AmortizationPlanListRow[]> {
  // Raw SQL with explicit table aliases (same pattern as getReimbursementList)
  // JOIN amortizationPlan + transaction + aggregate(amortizationInstalment)
  // Derive: consumed = SUM(amount WHERE occurredAt < TODAY), remaining = COUNT(WHERE occurredAt >= TODAY), net = initial - consumed
  // DECIMAL → string throughout; callers use toDecimal() before arithmetic
  // IDOR-safe: WHERE p.user_id = userId
  // Ordered by: remaining months ASC (D-C2), then plan.id ASC (deterministic)
}
```

**Why raw SQL:**
- Aggregates (sum, count) across two related tables need precision
- Drizzle's subqueries can be verbose; mirrors the proven pattern in `getReimbursementAggregates`
- Same alias safety (`p.` prefix) avoids ambiguity (both `amortizationPlan` and `amortizationInstalment` have `id`, `user_id`, `occurredAt`)

### Interactive Table Component
**File:** `components/amortizations/amortization-table.tsx` (new)

Pattern (mirrors `ReimbursementTable`):
```typescript
'use client'

export function AmortizationTable({ plans, route }: Props) {
  const { activeSort, activeDir, onSort } = useToolbarSort(route)
  const searchParams = useSearchParams()
  
  const q = searchParams.get('q')?.trim().toLowerCase() ?? ''
  const status = searchParams.get('status')  // 'open' | 'closed' | undefined (shows both)

  const filtered = plans.filter((row) => {
    if (status && row.status !== status) return false
    if (q && !row.description.toLowerCase().includes(q)) return false
    return true
  })

  const sorted = sortAmortizationRows(filtered, activeSort, activeDir)

  return (
    <div className="flex flex-col gap-4">
      <DataTableToolbar config={AMORTIZATIONS_TABLE_CONFIG} route={route} />
      {sorted.length === 0 ? (
        <EmptyState variant="no-result" />
      ) : (
        <Table>
          {/* Columns:
              - Description (truncate, link to /transactions/[id])
              - Transaction Date
              - Initial Amount (currency, right-align)
              - Consumed Amount (currency, right-align)
              - Net Value (currency, right-align, tone class)
              - Remaining Months (X/N, progress bar, D-B2)
              - Status Badge (open | closed, D-C3)
              - Actions (Chiudi + Realizza on open only, D-A1/D-A2/D-A3)
          */}
        </Table>
      )}
    </div>
  )
}
```

**Close action wiring:**
- Open plans show a "Chiudi" button (or row action menu)
- Click → opens `CloseAmortizationDialog` (existing, Phase 78)
- Dialog calls `closePlanAction({ planId })` (existing, Phase 78)
- On success: `onSuccess()` callback to refetch list (via SWR or route revalidation)

**Realize action wiring:**
- Open plans show a "Realizza con vendita" button or link (D-A2)
- Click → navigate to `transactionDetailHref(transactionId)` on the plan's anchor transaction
- Transaction detail page mounts the full Phase 78 realization UI

### Table Configuration
**File:** `lib/utils/amortizations-table-config.ts` (new)

Pattern (mirrors `REIMBURSEMENTS_TABLE_CONFIG`):
```typescript
export const AMORTIZATIONS_TABLE_CONFIG = {
  defaultSort: { key: 'remainingMonths', dir: 'asc' as const },  // D-C2
  filters: [
    {
      key: 'status',
      label: 'Stato',
      options: [
        { value: 'open', label: 'Aperto' },
        { value: 'closed', label: 'Chiuso' },
      ],
    },
  ],
  searchPlaceholder: 'Cerca per descrizione...',
}
```

### Route Constants
**File:** `lib/routes.ts`

Add:
```typescript
export const APP_ROUTES = {
  // ... existing ...
  amortizations: '/amortizations',
}

export function amortizationPlanDetailHref(planId: string) {
  return `${APP_ROUTES.amortizations}/${encodeURIComponent(planId)}`
}
```

**NOTE:** Phase 79 does NOT create `/amortizations/[id]` plan detail pages (D-D1 deferred). Href helpers are for future use or consistency; row clicks navigate to transaction detail via `transactionDetailHref(transactionId)`.

### Navigation Entry
**File:** `components/layout/sidebar.tsx`

Add to `topNavItems`:
```typescript
{ href: APP_ROUTES.amortizations, label: 'Ammortamenti', icon: /* choose icon */ },
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Monthly instalment distribution/materialization | Custom calculation at read time | Pre-materialized `amortizationInstalment` rows (Phase 77) | Protects dashboard aggregation performance; one source of truth for install schedule |
| Closure logic (collapsing remaining onto month) | Custom SQL or service layer | Existing `closePlanTx()` in `lib/services/amortization-lifecycle.ts` (Phase 78) | Already tested, semantically locked in ADR 0019 §7; reuse preserves invariants |
| Realization (linking sale transaction) | Inline form in registry | Deep-link to transaction detail + existing Phase 78 realization UI | ADR 0019 §8 locks realization = real transaction link; keeps "never synthetic" invariant |
| Table filter/sort persistence | URL params + local state | Unified URL-backed system (`useToolbarSort`, `DataTableToolbar`, `URLSearchParams`) | Sparter standard since v2.8; sessionStorage restore layer (PR #41); already handles filter/sort state |
| Currency formatting | Inline format() calls | Shared `formatAbsoluteAmount()` / `amountToneClass()` from `lib/utils` | One consistent formatter; handles edge cases (non-finite input) |

**Key insight:** The amortization model is intentionally built for cheap dashboard reads (materialised instalments, one snapshot per plan). Don't try to compute consumed/net/remaining on-the-fly — the DAL query should aggregate from the materialised schema.

---

## Common Pitfalls

### Pitfall 1: Decimal arithmetic on DB strings without conversion
**What goes wrong:** Directly comparing or adding DECIMAL column values without `toDecimal()` produces nonsensical results (string concatenation instead of addition, lexicographic comparison instead of numeric).

**Why it happens:** Drizzle returns `DECIMAL(12,2)` as a string for type safety; easy to forget conversion.

**How to avoid:** Every DAL query that needs per-row arithmetic (initial/consumed/net) must apply `toDecimal(stringValue)` before operations. The DAL should return `string` types; the component/service layer converts to `Decimal` at the point of use.

**Warning signs:** Summary KPI shows nonsensical figures; sort order is backwards (numeric sort broken).

### Pitfall 2: Mixing status filter (open-only default) with "no closed plans exist yet" edge case
**What goes wrong:** During phase early deployment, there may be no closed plans in the database. The status filter still renders but has only one option ("open"). UX confusion.

**Why it happens:** Filter options are hardcoded; the UI doesn't reflect whether closed plans actually exist.

**How to avoid:** Status filter always shows both options ("open" / "closed"), even if one is empty. The table renders `<EmptyState variant="no-result" />` when filtered results are empty (standard pattern).

**Warning signs:** User filters for "closed" and sees no results, but doesn't realize there are genuinely no closed plans vs. filter not working.

### Pitfall 3: Forgetting that "consumed" must exclude future instalments
**What goes wrong:** Computing `consumed = totalAmount - netValue` from raw columns gives wrong numerics if an open plan is partially realized. The remaining instalments have been re-spread; the consumed total doesn't match the historical sum.

**Why it happens:** Temptation to define consumed as `total - net` instead of explicitly summing past instalments.

**How to avoid:** Consumed is **explicitly** `SUM(amount WHERE occurredAt < TODAY and planId = X)` in the DAL query. Never derive it as residual/remainder.

**Warning signs:** Numbers don't add up per-plan; test with a plan that has been partially reimbursed + re-spread.

### Pitfall 4: Row navigation forgets to preserve transaction detail context
**What goes wrong:** Clicking a registry row navigates to `/transactions/[id]`, but the user has no way to return to the registry. Breadcrumb/back button is missing or navigates to transactions list instead.

**Why it happens:** Each detail page has its own back-button logic; the amortizations registry is a new entry point not yet in the breadcrumb chain.

**How to avoid:** Reuse standard back-navigation pattern: either a standard back button (browser back), or a breadcrumb showing `Ammortamenti > [description]`. Test: can the user reliably return to the registry from detail.

**Warning signs:** User reports "I got lost in the detail page, how do I get back to the list?"

---

## Code Examples

### Example 1: DAL List Query (Decimal-safe aggregation)

**Source:** Pattern derived from `lib/dal/reimbursement.ts:getReimbursementList` (CITED: live codebase)

```typescript
// lib/dal/amortization.ts
import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { toDecimal, toDbDecimal } from '@/lib/utils/decimal'

export type AmortizationPlanListRow = {
  id: string
  description: string
  transactionDate: Date
  initialAmount: string
  consumedAmount: string
  netValue: string
  remainingMonths: number
  totalMonths: number
  status: 'open' | 'closed'
}

/**
 * Lists every amortization plan for userId, deriving per-plan consumed/net/remaining from
 * materialised amortizationInstalment rows. Ordered by remaining months ascending (D-C2),
 * then plan.id ASC for determinism.
 *
 * All amounts returned as DECIMAL-as-string (Drizzle convention). Callers must use toDecimal()
 * before arithmetic. The summary header (total open net residual) is computed client-side via
 * plans.filter(p => p.status === 'open').reduce(...).
 *
 * IDOR-safe: WHERE p.user_id = userId scoped server-side from verifySession.
 */
export async function getAmortizationPlanList(userId: string): Promise<AmortizationPlanListRow[]> {
  const result = await db.execute(sql`
    SELECT
      p.id,
      t.description,
      t.occurred_at AS transaction_date,
      p.total_amount AS initial_amount,
      COALESCE(
        (
          SELECT SUM(ai2.amount::numeric)::text
          FROM amortization_instalment ai2
          WHERE ai2.plan_id = p.id AND ai2.occurred_at < CURRENT_DATE
        ),
        '0.00'
      ) AS consumed_amount,
      (
        p.total_amount::numeric -
        COALESCE(
          (
            SELECT SUM(ai3.amount::numeric)
            FROM amortization_instalment ai3
            WHERE ai3.plan_id = p.id AND ai3.occurred_at < CURRENT_DATE
          ),
          0
        )
      )::text AS net_value,
      (
        SELECT COUNT(*)
        FROM amortization_instalment ai4
        WHERE ai4.plan_id = p.id AND ai4.occurred_at >= CURRENT_DATE
      ) AS remaining_months,
      p.months AS total_months,
      p.status
    FROM amortization_plan p
    INNER JOIN transaction t ON t.id = p.transaction_id
    WHERE p.user_id = ${userId}
    ORDER BY
      CASE WHEN p.status = 'open' THEN 0 ELSE 1 END,
      (SELECT COUNT(*) FROM amortization_instalment ai5 WHERE ai5.plan_id = p.id AND ai5.occurred_at >= CURRENT_DATE) ASC,
      p.id ASC
  `)

  const rows = result.rows as {
    id: string
    description: string
    transaction_date: Date
    initial_amount: string
    consumed_amount: string
    net_value: string
    remaining_months: number
    total_months: number
    status: string
  }[]

  return rows.map((row) => ({
    id: row.id,
    description: row.description,
    transactionDate: new Date(row.transaction_date),
    initialAmount: row.initial_amount,
    consumedAmount: row.consumed_amount,
    netValue: row.net_value,
    remainingMonths: row.remaining_months,
    totalMonths: row.total_months,
    status: row.status as 'open' | 'closed',
  }))
}
```

### Example 2: Table Sort Helper (Decimal-aware comparison)

**Source:** Pattern derived from `components/reimbursements/reimbursement-table.tsx:sortReimbursementRows` (CITED)

```typescript
// components/amortizations/amortization-table.tsx
import { toDecimal } from '@/lib/utils/decimal'
import type { AmortizationPlanListRow } from '@/lib/dal/amortization'

/**
 * Pure sort helper: sort amortization rows by the specified key in the specified direction.
 * Numeric keys use Decimal.comparedTo() for precision; string keys use localeCompare.
 * Deterministic: ties preserve input order (stable sort).
 */
export function sortAmortizationRows(
  rows: AmortizationPlanListRow[],
  sort: string,
  dir: 'asc' | 'desc'
): AmortizationPlanListRow[] {
  const factor = dir === 'asc' ? 1 : -1

  return [...rows].sort((a, b) => {
    if (sort === 'description') {
      return factor * a.description.localeCompare(b.description)
    }
    if (sort === 'initialAmount') {
      return factor * toDecimal(a.initialAmount).comparedTo(toDecimal(b.initialAmount))
    }
    if (sort === 'netValue') {
      return factor * toDecimal(a.netValue).comparedTo(toDecimal(b.netValue))
    }
    if (sort === 'remainingMonths') {
      return factor * (a.remainingMonths - b.remainingMonths)
    }
    // 'transactionDate' (default)
    return factor * (a.transactionDate.getTime() - b.transactionDate.getTime())
  })
}
```

### Example 3: Summary Header KPI (Client-side Decimal aggregation)

**Source:** Custom pattern for Phase 79 D-B1 (not in prior phases; derived from Decimal.js conventions in CLAUDE.md)

```typescript
// components/amortizations/amortization-summary-header.tsx
'use client'

import { toDecimal } from '@/lib/utils/decimal'
import { AmortizationPlanListRow } from '@/lib/dal/amortization'

function formatCurrency(value: string): string {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return `${value} EUR`
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount)
}

export function AmortizationSummaryHeader({ plans }: { plans: AmortizationPlanListRow[] }) {
  // D-B1: total open net residual
  const totalOpenResidual = plans
    .filter((p) => p.status === 'open')
    .reduce((sum, p) => sum.plus(toDecimal(p.netValue)), toDecimal('0'))

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">Netto residuo aperto</p>
      <p className="text-2xl font-semibold tracking-tight">
        {formatCurrency(totalOpenResidual.toFixed(2))}
      </p>
    </div>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dashboard aggregations read transactions directly with `effectiveAmount()` netting | Two row sources: ledger_entry CTE for each lens (cash = transactions; accrual = transactions UNION instalments) | Phase 77 (ADR 0019 §10) | Makes lens swap cheap; reimbursement double-netting trap structurally impossible |
| Amortization plan details spread across transaction detail + history | Dedicated `/amortizations` registry surfaces all plans in one place | Phase 79 | Users can see every plan at-a-glance, close/realize from one location |
| No programmatic distinction between closed and open plans at UI level | Status filter + default open-only view | Phase 79 D-C1 | Reduces cognitive load; closed plans still reachable but not cluttering the default view |

**Deprecated/outdated:**
- N/A for Phase 79 (new surface; no deprecated tech involved)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `totalAmount` on amortizationPlan is immutable snapshot at creation; derived values (consumed/net/remaining) are always computed from `totalAmount` + materialised instalments, never from the anchor transaction's mutable amount | Schema facts + DAL design | If totalAmount could change, a realization/reimbursement affecting the base would silently skew the remaining value. The lock (UNIQUE transactionId) prevents plan remapping, so totalAmount immutability is guaranteed. |
| A2 | The `/reimbursements` RSC → DAL → interactive table pattern is the correct structural analog for `/amortizations` | Pattern to mirror section | If the pattern is wrong (e.g., reimbursements needs a different auth check), the registry's auth boundary will be broken. Confidence HIGH because reimbursements was delivered in Phase 76 and is live. |
| A3 | Closing a plan from the registry (via `CloseAmortizationDialog`) is semantically identical to closing from the transaction detail page | Close action wiring (D-A1) | If the dialog's internals differ (e.g., different closure month logic), registry close will produce different results than detail-page close. The dialog is simple (`closePlanAction({ planId })` only) and unchanged by Phase 79, so risk is minimal. |
| A4 | `today` for computing consumed/remaining (occurredAt < TODAY vs >=) is consistently defined as CURRENT_DATE in the database | Pitfall 3 + DAL query | If the DAL uses one definition (e.g., `< now()`) and the UI uses another (e.g., `< today's date`), consumed will drift by time-of-day. Database CURRENT_DATE is the safe canonical. |

**All other claims in this research were verified against:**
- Live codebase (schema, services, components)
- Canonical references (ADR 0019, CONTEXT.md, Phase 78 CONTEXT.md)
- Proven patterns (reimbursements registry)

---

## Validation Architecture

**Nyquist validation enabled** (no explicit `workflow.nyquist_validation = false` in `.planning/config.json`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + PostgreSQL (real-Postgres regression gate) |
| Config file | `vitest.config.ts` + `.env.test` |
| Quick run command | `yarn test --run lib/dal/amortization.test.ts` |
| Full suite command | `yarn test --run` (includes reimbursement-regression.test.ts gate LENS-03) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REG-01 | DAL query returns all open + closed plans with correct derived values (initial/consumed/net/remaining/months) | Unit (DAL + Decimal precision) | `yarn test --run lib/dal/amortization.test.ts -t "amortization list"` | ❌ Wave 0 — need `tests/dal/amortization.test.ts` |
| REG-01 | Table rows display correctly: description, date, amounts (currency fmt), months (X/N progress bar), status badge | Component | `yarn test --run components/amortizations/amortization-table.test.tsx` | ❌ Wave 0 — need `tests/components/amortizations/amortization-table.test.tsx` |
| REG-01 | Summary header (D-B1) computes and displays total open net residual correctly | Component | `yarn test --run components/amortizations/amortization-summary-header.test.tsx` | ❌ Wave 0 — need test |
| REG-02 | Close from registry calls `closePlanAction` and refreshes list on success | Component + E2E | RSC/route test or manual UAT (dialog is reused, already tested Phase 78) | ⚠️ Reuse existing CloseAmortizationDialog test; no new test needed if dialog test is sufficient |
| REG-02 | "Realizza con vendita" link navigates to correct transaction detail URL | Component | `yarn test --run components/amortizations/amortization-table.test.tsx -t "realizza"` | ❌ Wave 0 |
| REG-03 | Status filter correctly partitions plans (open/closed); default filter is open-only | Component | `yarn test --run components/amortizations/amortization-table.test.tsx -t "filter"` | ❌ Wave 0 |
| REG-03 | Closed plans render with distinct badge/styling; open plans render without close actions | Component | Visual inspection + snapshot test | ❌ Wave 0 — optional snapshot |
| LENS-03 | Amortizations registry (read-only) does not perturb cash-lens byte-identical gate | Regression (real-Postgres) | `yarn test --run tests/reimbursement-regression.test.ts` | ✅ Existing; must pass |

### Sampling Rate
- **Per task commit:** `yarn test --run lib/dal/amortization.test.ts` (DAL + table sort logic)
- **Per wave merge:** `yarn test --run` (full suite, including LENS-03 regression gate)
- **Phase gate:** Full suite green + manual UAT of close/realizza wiring before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/dal/amortization.test.ts` — DAL list query Decimal precision, consumed/remaining computation, IDOR-safety, ordering
- [ ] `tests/components/amortizations/amortization-table.test.tsx` — filter/sort/search client-side, row rendering, close/realizza action wiring (can reuse CloseAmortizationDialog mock from Phase 78 tests)
- [ ] `tests/components/amortizations/amortization-summary-header.test.tsx` — KPI aggregation (open plans only)
- [ ] Config/fixture: `AMORTIZATIONS_TABLE_CONFIG` with default sort + filter options

**Regression gate (LENS-03):** `reimbursement-regression.test.ts` must remain green. The registry makes no writes (except via `closePlanAction`, which is Phase 78 code) and reads only amortization data, so the reimbursement cash-lens aggregations should be unaffected. Confirm by running full suite before phase completion.

---

## Security Domain

`security_enforcement` not explicitly set to `false` → include.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | `verifySession()` at RSC page entry; no auth logic needed in DAL or component |
| V3 Session Management | Yes | Session persisted by Better Auth; proxy.ts guards the route group |
| V4 Access Control | Yes | IDOR-safe DAL query scopes to `userId` server-side (no client-supplied filter) |
| V5 Input Validation | Yes | Close action validates via `ClosePlanSchema` (Phase 78, already in place); no new validation needed |
| V6 Cryptography | No | No cryptographic operations in Phase 79 |
| V7 Error Handling & Logging | Yes | Error handling in RSC page (404 on missing plan) and component (toast on close failure) |

### Known Threat Patterns for Amortization + Dashboard Aggregations

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR: user can close another user's plan via `/api/amortization/close` | Tampering | `closePlanAction` validates via `verifySession` + `userId` scoped lookup in service layer; no plan ID alone ever accepts a close |
| Denial of service: user creates 10,000 1-month plans to bloat instalment table | Denial | Schema constraints (`months >= 2` prevents 1-month plans); rate-limiting deferred (not in Phase 79) |
| Double-netting in aggregations: amortization instalment amount resolved twice (once at materialisation, once in `effectiveAmount`) | Tampering (data corruption) | ADR 0019 §10 solves via one row source per lens; instalment rows carry their own resolved amount, never call `effectiveAmount()` a second time |

---

## Sources

### Primary (HIGH confidence)
- **Live Codebase**
  - `lib/db/schema.ts` (lines 653–715): amortizationPlan + amortizationInstalment tables
  - `lib/services/amortization-lifecycle.ts`: closePlanTx, realizePlanTx, reducePlanTx implementations
  - `lib/actions/amortization-lifecycle.ts`: closePlanAction server action
  - `components/transactions/close-amortization-dialog.tsx`: dialog reused by registry
  - `app/(app)/reimbursements/page.tsx`: RSC pattern to mirror
  - `lib/dal/reimbursement.ts` (`getReimbursementList`): DAL list query pattern
  - `components/reimbursements/reimbursement-table.tsx`: interactive table pattern with search/filter/sort
  - `lib/routes.ts`: route constants and href helpers

- **Canonical Design Documents**
  - `docs/adr/0019-amortization-accrual-lens.md` (sections 7, 8, 10): closure semantics, realization = real transaction, row source seam
  - `.planning/phases/79-amortizations-registry/79-CONTEXT.md`: phase decisions and constraints (D-A1 through D-D1)
  - `.planning/REQUIREMENTS.md`: REG-01, REG-02, REG-03 specifications

### Secondary (MEDIUM confidence)
- **Project Documentation**
  - `CLAUDE.md`: Decimal.js requirement, DAL/services/actions layering, language convention
  - `.planning/PROJECT.md`: project vision and current state
  - `CONTEXT.md` (repo root): domain vocabulary (Transaction, Standalone Expense, cassa/competenza)

### Tertiary (LOW confidence)
- Training knowledge of Next.js 16, Drizzle ORM, Decimal.js (verified against live codebase, not docs)

---

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — all libraries already in use; no new packages
- Architecture: **HIGH** — `/reimbursements` pattern is proven (Phase 76, live); Phase 78 lifecycle services are complete and tested
- DAL query + Decimal precision: **HIGH** — schema and arithmetic rules documented in ADR 0019; mirrors proven `getReimbursementList` pattern
- Validation: **MEDIUM** — regression gate (reimbursement-regression.test.ts) must pass, but Phase 79 makes no writes to amortization data itself, reducing risk

**Research date:** 2026-07-28  
**Valid until:** 2026-08-04 (stable domain; no breaking changes expected in Decimal.js or Next.js 16 within one week)

---

*Phase: 79-amortizations-registry*  
*Research gathered: 2026-07-28*  
*Next step: `/gsd-plan-phase` to create detailed PLAN.md*
