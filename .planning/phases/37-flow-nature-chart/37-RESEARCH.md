# Phase 37: flow-nature-chart - Research

**Researched:** 2026-05-25
**Domain:** Drizzle schema migration · Recharts stacked bar · URL state sync · settings inline Select
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Toggle via clickable Recharts legend. No separate UI block.
- **D-02:** Toggle state synced to URL via `router.replace()` updating `?hidden=`, identical to OverviewFilters pattern.
- **D-03:** Default state (all natures visible) = `?hidden=` absent. Param is deleted when the hidden set is empty.
- **D-04:** Italian label map:
  - `essential` → `Essenziale`
  - `discretionary` → `Discrezionale`
  - `operational` → `Operativo`
  - `financial` → `Finanziario`
  - `debt` → `Debiti`
  - `extraordinary` → `Straordinario`
- **D-05:** Null-nature segment label → `"Non classificato"` (both chart legend and settings Select).
- **D-06:** Label map lives in `lib/utils/nature-labels.ts` — shared between chart component and settings Select (single source of truth).
- **D-07:** Nature editing in settings via inline Select in the subcategory row. Save on-change via server action.
- **D-08:** Inline Select applies to ALL subcategories (personal and system). User can override system nature.
- **D-09:** System subcategory nature override stored by adding a nullable `nature` column to `user_subcategory_override`. `null` = use `sub_category.nature` seed default; set = user override. Same pattern as `custom_name`.
- **ADR-0003 LOCKED:** nature lives on `sub_category`, not `category`. Nullable. System subcategories seeded.
- **ADR-0004 LOCKED:** Algebraic sum per nature (not sign-split). A segment may have net positive amount in an OUT category. No `refund` enum value.

### Claude's Discretion

- Color palette for the 6 natures in the chart (distinct colors, consistent with shadcn/ui CSS vars or hardcoded).
- "Non classificato" segment visibility: visible only when transactions with null nature exist, or always. (Planner chooses.)
- "Non classificato" color (suggested: neutral gray).
- Specific nature assignments for ~120 system subcategories in `seed-data.ts`.

### Deferred Ideas (OUT OF SCOPE)

- Dedicated nature breakdown page.
- "Non classificato" always visible even at zero (may revisit in v1.12).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R-FN-01 | Add `nature` pgEnum column to `sub_category` table (nullable) | Schema section: new `flowNatureEnum` + `ALTER TABLE` migration |
| R-FN-02 | Add nullable `nature` column to `user_subcategory_override` table | Schema section: same migration, second ALTER TABLE |
| R-FN-03 | Seed system subcategories with default natures in `seed-data.ts` | Seed section: nature field added to each of ~120 subCategory objects |
| R-FN-04 | New DAL function `getMonthlyTrendByNature`: group by nature, algebraic sum | DAL section: new query pattern documented |
| R-FN-05 | New `MonthlyNatureTrendPoint` type replacing current `MonthlyTrendPoint` for chart feed | DAL section: type definition |
| R-FN-06 | Redesign `EntrateUsciteChart` into stacked nature-segmented bar chart with URL-persisted legend toggles | Chart section: full pattern documented |
| R-FN-07 | `lib/utils/nature-labels.ts` shared label utility | Utils section |
| R-FN-08 | Expose nature override via inline Select in `/settings/categories` subcategory rows | Settings section: `setSubcategoryNatureAction` + DAL upsert |
| R-FN-09 | Extend `createSubcategoryAction` to accept `nature` (required field) for user-created subcategories | Action section: schema + action changes |
</phase_requirements>

---

## Summary

Phase 37 delivers FlowNature: a nature classification axis on spending, surfaced as a stacked bar chart replacing the current binary In/Out `EntrateUsciteChart`. The work spans four layers: a Drizzle schema migration (two ALTER TABLE statements), a new DAL query that groups by nature using algebraic sum, a rewritten chart component with URL-persisted toggle behavior, and a settings inline Select for user overrides.

The schema change is minimal: one nullable `pgEnum` column on `sub_category`, one nullable column of the same type on `user_subcategory_override`. No foreign key chains change; the existing `userSubcategoryOverride` unique constraint already scopes overrides per (userId, subCategoryId), so the nature column slots in cleanly. The `upsertSystemSubcategoryOverride` function in `lib/dal/categories.ts` already handles the upsert pattern for `customName` — the same function will be extended (or a sibling function created) to handle `nature`.

The chart rewrite is the highest-complexity piece. The current `EntrateUsciteChart` uses two hardcoded `<Bar>` series (`totalIn`, `totalOut`). The new version needs N dynamically-rendered stacked `<Bar>` elements (one per visible nature), each conditionally hidden via Recharts' `hide` prop driven by a `Set<string>` parsed from `?hidden=` URL param. The Recharts legend click handler must update the URL — this is the same `startTransition + router.replace` pattern used in `OverviewFilters`. The existing `dashboard-charts.test.tsx` tests the current label assertions (`Entrate`, `Uscite`) and negative assertions (`Non categorizzato`, `Ignorato`, `Bilancio`) — these will need updates since the chart structure changes fundamentally.

The seed update is a data assignment task: each of the ~120 entries in `subCategories` in `seed-data.ts` needs a `nature` field. The `seed.ts` runner must be confirmed to write this field to the database. System subcategories in `ignore` category get `null` nature (system internal).

**Primary recommendation:** Execute in strict wave order — migration first, DAL second, chart third, settings fourth — because each wave depends on the previous layer being stable. Do not merge the DAL and chart into one task.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `nature` enum definition | Database / Schema | — | `pgEnum` lives in `lib/db/schema.ts`, migration generated by drizzle-kit |
| Nature resolution (seed vs. override) | API / Backend (DAL) | — | `getMonthlyTrendByNature` must JOIN `userSubcategoryOverride.nature` with `COALESCE` fallback to `subCategory.nature`; this is a data-layer concern |
| Nature-segmented aggregation (algebraic sum) | API / Backend (DAL) | — | SQL `GROUP BY nature_resolved` with `SUM(amount)` — pure data layer |
| Chart rendering + toggle state | Browser / Client | Frontend Server (RSC parent) | `EntrateUsciteChart` is a `'use client'` component; RSC parent fetches data and passes it as props |
| URL param sync (`?hidden=`) | Browser / Client | — | `useSearchParams + router.replace` — runs in the client component |
| Label utility | Shared (lib/utils) | — | `nature-labels.ts` is a plain TS module, usable from both client components and server actions |
| Settings inline Select + save | Browser / Client (Select) + API/Backend (action) | — | Select is client-side, `setSubcategoryNatureAction` is a server action |
| Override persistence | API / Backend (DAL) | — | `upsertSystemSubcategoryOverride` extended with `nature` parameter |
| `createSubcategory` nature requirement | API / Backend (action + validation) | — | Zod schema extended; `createUserSubcategory` DAL call extended |

---

## Standard Stack

No new external packages are introduced by this phase. All required capabilities come from already-installed dependencies.

### Core (already installed)

| Library | Purpose | Evidence |
|---------|---------|---------|
| `drizzle-orm` | Schema definition, query builder, `pgEnum` | `[VERIFIED: lib/db/schema.ts]` — already used for all enums |
| `recharts` | `BarChart`, `Bar`, `XAxis`, `YAxis`, `Legend` (clickable) | `[VERIFIED: components/dashboard/entrate-uscite-chart.tsx]` |
| `@/components/ui/chart` | `ChartContainer`, `ChartLegend`, `ChartLegendContent`, `ChartTooltip`, `ChartTooltipContent` | `[VERIFIED: entrate-uscite-chart.tsx]` — already imported |
| `@/components/ui/select` | `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` | `[VERIFIED: category-mutation-dialogs.tsx]` — already imported |
| `zod` | Schema validation for new action fields | `[VERIFIED: lib/validations/category.ts]` |
| `decimal.js` (via `@/lib/utils/decimal`) | Algebraic sum in DAL building function | `[VERIFIED: lib/dal/dashboard.ts]` — `toDecimal` used throughout |
| `next/navigation` | `useSearchParams`, `useRouter`, `usePathname` | `[VERIFIED: components/dashboard/overview-filters.tsx]` |

### No New Packages Required

All capabilities are covered by the existing stack. No `npm install` step in this phase.

---

## Package Legitimacy Audit

Not applicable — this phase installs no external packages.

---

## Architecture Patterns

### System Architecture Diagram

```
Dashboard Overview Page (RSC)
        │
        │  preset from URL searchParams
        ▼
getMonthlyTrendByNature(preset)  ← lib/dal/dashboard.ts  [NEW]
        │
        │  JOIN transaction → expense → subCategory
        │  LEFT JOIN userSubcategoryOverride (for nature override)
        │  COALESCE(override.nature, subCategory.nature) AS nature_resolved
        │  GROUP BY (to_char(occurredAt, 'YYYY-MM'), nature_resolved)
        │  SUM(amount) — algebraic (no sign filter)
        │
        ▼
MonthlyNatureTrendPoint[]  [NEW TYPE]
  { month, label, segments: Record<NatureKey, string>, totalNc: number, totalIgn: number }
        │
        ▼
EntrateUsciteChart (client component)  [REWRITTEN]
        │
        ├── reads ?hidden= from useSearchParams → Set<NatureKey>
        ├── renders <BarChart> with stacked natures (layout="vertical" or "horizontal")
        ├── each <Bar> has hide={hiddenSet.has(key)}
        ├── ChartLegend with onClick → updates ?hidden= via router.replace
        └── ChartTooltip shows algebraic sum per nature per month

Settings Categories Page (RSC)
        │
        ▼
CategorySettingsPanel (client)
        │
        ▼
SubcategoryRow (inline)
        │
        ├── nature Select (value = effectiveNature, all options + "Non classificato")
        │   onChange → setSubcategoryNatureAction(subCategoryId, nature | null)
        │               → upsertSubcategoryNatureOverride (if system sub)
        │               OR updateUserSubcategoryNature (if owned sub, updates sub_category.nature directly)
        └── existing rename/delete buttons unchanged
```

### Recommended Project Structure (changes only)

```
lib/
├── db/
│   └── schema.ts            # ADD: flowNatureEnum, nature col on subCategory + userSubcategoryOverride
├── dal/
│   └── dashboard.ts         # ADD: getMonthlyTrendByNature, MonthlyNatureTrendPoint type
│   └── categories.ts        # EXTEND: upsertSystemSubcategoryOverride accepts nature; new upsertSubcategoryNatureOverride
├── actions/
│   └── categories.ts        # ADD: setSubcategoryNatureAction; EXTEND: createSubcategoryAction
├── validations/
│   └── category.ts          # EXTEND: CreateSubcategorySchema + NatureSchema
└── utils/
    └── nature-labels.ts     # NEW: FlowNature enum, label map, ordered array

components/
├── dashboard/
│   └── entrate-uscite-chart.tsx   # REWRITE: stacked nature bars + legend toggle
└── categories/
    ├── category-settings-panel.tsx      # EXTEND: pass nature to SubcategoryRow
    ├── category-mutation-dialogs.tsx    # EXTEND: CreateSubcategoryDialog adds nature Select
    └── subcategory-nature-select.tsx    # NEW: inline select client component

scripts/
└── seed-data.ts             # EXTEND: add nature field to all ~120 subCategory objects

drizzle/migrations/
└── 0012_flow_nature.sql     # NEW: generated by drizzle-kit generate
```

### Pattern 1: pgEnum Definition + Nullable Column Migration

**What:** Define a new `pgEnum` in schema.ts, add the column as nullable to two tables, generate migration with `drizzle-kit generate`, apply with `scripts/migrate.ts`.

**When to use:** Any time a new categorical column needs to be added to existing tables.

**Example:**
```typescript
// Source: [VERIFIED: lib/db/schema.ts — existing enum pattern]

// In schema.ts — add before the tables that use it
export const flowNatureEnum = pgEnum('flow_nature', [
  'essential',
  'discretionary',
  'operational',
  'financial',
  'debt',
  'extraordinary',
])

// In subCategory table definition — add:
nature: flowNatureEnum('nature'),  // nullable — no .notNull()

// In userSubcategoryOverride table definition — add:
nature: flowNatureEnum('nature'),  // nullable — null = use seed default
```

The migration SQL will contain:
```sql
CREATE TYPE "public"."flow_nature" AS ENUM('essential','discretionary','operational','financial','debt','extraordinary');
ALTER TABLE "sub_category" ADD COLUMN "nature" "flow_nature";
ALTER TABLE "user_subcategory_override" ADD COLUMN "nature" "flow_nature";
```

### Pattern 2: Algebraic Sum Grouped by Nature (DAL Query)

**What:** New query that groups transactions by (month, resolved_nature), SUMs amounts algebraically without sign pre-filtering.

**When to use:** Feeding the stacked nature chart.

**Critical implementation note:** The nature resolution uses `COALESCE(userSubcategoryOverride.nature, subCategory.nature)` in SQL. This must account for the LEFT JOIN — when no override row exists, `userSubcategoryOverride.nature` is NULL, and COALESCE falls through to `subCategory.nature`. When the user has an override row but `nature` is NULL on that row (user explicitly cleared override), it also falls through to `subCategory.nature`. This matches D-09.

```typescript
// Source: [VERIFIED: lib/dal/dashboard.ts — existing query structure adapted]

type NatureKey = 'essential' | 'discretionary' | 'operational' | 'financial' | 'debt' | 'extraordinary' | null

export type MonthlyNatureTrendPoint = {
  month: string
  label: string
  // keyed by nature value (null key represented as 'unclassified' string in chart data)
  segments: Record<string, string>  // nature -> algebraic sum string
  totalNc: number
  totalIgn: number
}

// Query pattern (raw shape):
// SELECT
//   to_char(t.occurred_at, 'YYYY-MM') as month,
//   COALESCE(uo.nature, sc.nature) as nature_resolved,
//   SUM(t.amount)::text as amount   -- algebraic, no ABS(), no sign filter
// FROM transaction t
// LEFT JOIN expense e ON t.expense_id = e.id
// LEFT JOIN sub_category sc ON e.sub_category_id = sc.id
// LEFT JOIN category c ON sc.category_id = c.id
// LEFT JOIN user_subcategory_override uo ON uo.sub_category_id = sc.id AND uo.user_id = $userId
// WHERE ... (date scope, expense statuses, not-ignore, not-excluded-from-totals)
// GROUP BY month, nature_resolved

// The builder function (buildMonthlyNatureTrendData) assembles MonthlyNatureTrendPoint[]
// from raw rows, using monthsBetween() to pre-populate all month buckets.
```

### Pattern 3: Recharts Stacked Bar with Legend Toggle + URL Sync

**What:** Stacked `<BarChart>` where each nature is a `<Bar stackId="a">` with `hide={hidden.has(key)}`. Legend `onClick` updates `?hidden=` URL param.

**When to use:** Any client chart that needs URL-persisted visibility toggles.

**Key Recharts behavior:**
- Recharts `<Bar hide={true}>` removes the bar from rendering but keeps it in the legend.
- `ChartLegend` with `onClick` on `ChartLegendContent` requires passing a custom `content` prop that intercepts clicks and calls the URL updater.
- The `ChartLegendContent` from shadcn/ui accepts `onClick` via the wrapper approach; alternatively render a custom legend array.

```typescript
// Source: [VERIFIED: components/dashboard/entrate-uscite-chart.tsx — existing wrapper pattern]
// + [VERIFIED: components/dashboard/overview-filters.tsx — URL sync pattern]

'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useTransition, useMemo } from 'react'
import { Bar, BarChart, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { NATURE_ORDER, NATURE_LABELS, NATURE_COLORS } from '@/lib/utils/nature-labels'
import type { MonthlyNatureTrendPoint } from '@/lib/dal/dashboard'

export function EntrateUsciteChart({ data }: { data: MonthlyNatureTrendPoint[] }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()

  // Parse ?hidden= comma-separated nature keys
  const hidden = useMemo(() => {
    const raw = searchParams.get('hidden') ?? ''
    return new Set(raw ? raw.split(',') : [])
  }, [searchParams])

  function toggleNature(key: string) {
    const next = new Set(hidden)
    if (next.has(key)) { next.delete(key) } else { next.add(key) }
    const params = new URLSearchParams(searchParams.toString())
    if (next.size === 0) {
      params.delete('hidden')
    } else {
      params.set('hidden', [...next].join(','))
    }
    const search = params.toString()
    startTransition(() => {
      router.replace(pathname + (search ? '?' + search : ''), { scroll: false })
    })
  }

  // chartData: convert MonthlyNatureTrendPoint[] to flat objects for Recharts
  const chartData = useMemo(() => data.map(point => ({
    month: point.month,
    label: point.label,
    // one key per nature, value as number
    ...Object.fromEntries(
      NATURE_ORDER.map(key => [key ?? 'unclassified', parseFloat(point.segments[key ?? 'unclassified'] ?? '0')])
    ),
  })), [data])

  return (
    <ChartContainer config={chartConfig} className="min-h-[260px] w-full">
      <BarChart data={chartData} barGap={2} barCategoryGap="20%">
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend
          content={
            <ChartLegendContent
              // Recharts passes payload to content; handle click per item
              onClick={(entry) => toggleNature(entry.dataKey as string)}
            />
          }
        />
        {NATURE_ORDER.map(key => (
          <Bar
            key={key ?? 'unclassified'}
            dataKey={key ?? 'unclassified'}
            stackId="a"
            fill={NATURE_COLORS[key ?? 'unclassified']}
            hide={hidden.has(key ?? 'unclassified')}
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}
```

**Critical note on `ChartLegendContent` onClick:** The shadcn/ui `ChartLegendContent` may not directly forward an `onClick` prop. Inspect `components/ui/chart.tsx` before implementing — if onClick is not forwarded, render a completely custom legend function instead. The legend click approach with `onMouseDown` on each item is the fallback.

### Pattern 4: Inline Nature Select in Settings Row (on-change server action)

**What:** A `'use client'` sub-component rendered inside the existing `SubcategoryList` row. On `onValueChange`, calls a server action immediately (no form submit button).

**When to use:** Any on-change persistence pattern in settings rows.

```typescript
// Source: [VERIFIED: category-mutation-dialogs.tsx — useActionState + server action pattern]
// Source: [VERIFIED: overview-filters.tsx — immediate update on change]

'use client'

import { useTransition } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { setSubcategoryNatureAction } from '@/lib/actions/categories'
import { NATURE_ORDER, NATURE_LABELS } from '@/lib/utils/nature-labels'

export function SubcategoryNatureSelect({
  subCategoryId,
  effectiveNature,   // COALESCE(override.nature, subCategory.nature) — computed by DAL
  isSystem,
}: {
  subCategoryId: number
  effectiveNature: string | null
  isSystem: boolean
}) {
  const [isPending, startTransition] = useTransition()

  function handleChange(value: string) {
    // 'unclassified' sentinel represents null
    const nature = value === 'unclassified' ? null : value
    startTransition(() => {
      setSubcategoryNatureAction(subCategoryId, nature)
    })
  }

  return (
    <Select
      value={effectiveNature ?? 'unclassified'}
      onValueChange={handleChange}
      disabled={isPending}
    >
      <SelectTrigger className="w-[160px] h-8 text-xs" aria-label="Natura sottocategoria">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unclassified">Non classificato</SelectItem>
        {NATURE_ORDER.filter(Boolean).map(key => (
          <SelectItem key={key} value={key!}>{NATURE_LABELS[key!]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

### Pattern 5: `lib/utils/nature-labels.ts` Structure

```typescript
// Source: [ASSUMED — design derived from D-04, D-05, D-06 decisions]

export type FlowNature = 'essential' | 'discretionary' | 'operational' | 'financial' | 'debt' | 'extraordinary'

export const NATURE_LABELS: Record<FlowNature | 'unclassified', string> = {
  essential: 'Essenziale',
  discretionary: 'Discrezionale',
  operational: 'Operativo',
  financial: 'Finanziario',
  debt: 'Debiti',
  extraordinary: 'Straordinario',
  unclassified: 'Non classificato',
}

// Ordered for consistent legend/bar rendering
export const NATURE_ORDER: Array<FlowNature | null> = [
  'essential',
  'discretionary',
  'operational',
  'financial',
  'debt',
  'extraordinary',
  null,  // null-nature = "Non classificato" segment, always rendered last
]

export const NATURE_COLORS: Record<FlowNature | 'unclassified', string> = {
  essential:      'hsl(var(--chart-1))',   // or hardcoded — planner's discretion
  discretionary:  'hsl(var(--chart-2))',
  operational:    'hsl(var(--chart-3))',
  financial:      'hsl(var(--chart-4))',
  debt:           'hsl(var(--chart-5))',
  extraordinary:  '#f59e0b',
  unclassified:   '#a1a1aa',              // zinc-400 — neutral gray per D-05 suggestion
}
```

### Anti-Patterns to Avoid

- **Using `ABS()` or sign-split in the new nature query:** ADR-0004 mandates algebraic sum. `SUM(amount)` with no ABS or CASE filter is correct. A segment may legitimately be positive even in an OUT category.
- **Putting nature on `category` not `subCategory`:** ADR-0003 explicitly rejects category-level nature. Always JOIN through `sub_category.nature`.
- **Hardcoding nature keys in the chart's Bar list:** Use `NATURE_ORDER` from `nature-labels.ts` to generate Bars dynamically, so adding/removing a nature value requires one edit.
- **Sharing the old `MonthlyTrendPoint` type for the new chart:** The DAL return type changes shape significantly. Define `MonthlyNatureTrendPoint` as a separate export. Keep `MonthlyTrendPoint` alive because `BilancioBarsChart` still consumes it.
- **Breaking `BilancioBarsChart`:** The overview page passes `data: MonthlyTrendPoint[]` to both charts currently. After this phase, the two charts consume different data types from different DAL functions. `getAggregatedTransactionsData` and its type remain untouched.
- **Using `drizzle-kit push` in production:** The project constraint is explicit — always `drizzle-kit generate` + `scripts/migrate.ts`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Monetary aggregation | Custom JS reduce | `toDecimal().plus()` from `@/lib/utils/decimal` | Floating point errors on financial data |
| URL param encoding | Custom serializer | `new URLSearchParams(searchParams.toString())` + `params.set/delete` | Same pattern as OverviewFilters — battle-tested |
| Enum type safety | String literals scattered | `pgEnum('flow_nature', [...])` + TypeScript union type from `nature-labels.ts` | Single source of truth; Drizzle validates on insert |
| Override upsert logic | Custom INSERT + UPDATE | Extend existing `upsertSystemSubcategoryOverride` with `onConflictDoUpdate` | Already handles the unique constraint correctly |

---

## Critical Schema Findings

### Current `userSubcategoryOverride` Structure

```typescript
// [VERIFIED: lib/db/schema.ts lines 195-220]
export const userSubcategoryOverride = pgTable('user_subcategory_override', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  subCategoryId: integer('sub_category_id').notNull().references(() => subCategory.id, { onDelete: 'cascade' }),
  customName: varchar('custom_name', { length: 100 }).notNull(),  // <-- currently NOT NULL
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
},
  // unique constraint: (userId, subCategoryId)
)
```

**Critical issue: `customName` is NOT NULL.** When we add `nature` as a nullable column, the upsert for nature-only overrides (user sets nature but has no custom name) must supply a `customName` value. Two options:
1. Make `customName` nullable in this same migration — cleaner, but a broader schema change.
2. Upsert with an empty-string sentinel for `customName` when only nature is being set — hacky.
3. Make `customName` nullable and update the unique constraint behavior.

**Recommendation:** Make `customName` nullable in the same migration as the `nature` column addition. This is the correct data model: a user may want to override just the nature without setting a custom name, or vice versa. The existing `upsertSystemSubcategoryOverride` must be updated to accept `customName: string | null`.

**Impact on existing code:**
- `getCategoriesForUser` in `lib/dal/categories.ts` uses `overrideCustomName` and falls back to `subCategory.name` — no change needed since `coalesce(override.customName, subCategory.name)` already handles null.
- `upsertSystemSubcategoryOverride` currently always writes `customName` — must be updated to accept optional.
- The `CategoryWithSubCategories` type in `lib/dal/categories.ts` must expose `effectiveNature: string | null` for the settings inline Select to consume.

### Current `subCategory` Has No `nature` Column

```typescript
// [VERIFIED: lib/db/schema.ts lines 169-193]
// subCategory table has: id, userId, categoryId, name, slug, displayOrder, isActive, excludeFromTotals
// NO nature column currently — must be added via migration
```

### Existing `getAggregatedTransactionsData` Must NOT Be Changed

```typescript
// [VERIFIED: lib/dal/dashboard.ts lines 1166-1195]
// This function feeds BilancioBarsChart with the sign-split totalIn/totalOut model.
// It must remain unchanged. The new function is a sibling, not a replacement.
export const getAggregatedTransactionsData = cache(...)  // KEEP AS-IS
```

### `createUserSubcategory` Currently Does Not Accept `nature`

```typescript
// [VERIFIED: lib/dal/categories.ts lines 206-238]
export async function createUserSubcategory(
  input: { userId: string, categoryId: number, name: string, slug: string },
  database: DbOrTx = db,
)
// Must add: nature?: FlowNature | null
```

---

## Common Pitfalls

### Pitfall 1: `ChartLegendContent` onClick signature mismatch

**What goes wrong:** `ChartLegendContent` from shadcn/ui wraps Recharts' legend; its `onClick` may receive a Recharts `LegendPayload` object, not a plain string key. If the event object structure is wrong, toggle does nothing.
**Why it happens:** shadcn/ui wraps Recharts events and may reshape the payload.
**How to avoid:** Read `components/ui/chart.tsx` before implementing. The `payload[i].dataKey` is typically the `Bar`'s `dataKey` prop — use that as the toggle key.
**Warning signs:** Clicking legend item does nothing or throws.

### Pitfall 2: `BilancioBarsChart` broken by MonthlyTrendPoint type change

**What goes wrong:** If `MonthlyTrendPoint` is modified to include nature segments, `BilancioBarsChart` will either fail to render or show wrong data.
**Why it happens:** Both charts currently receive the same `data: MonthlyTrendPoint[]` from one server call.
**How to avoid:** Keep `MonthlyTrendPoint` and `getAggregatedTransactionsData` exactly as they are. The overview page will call two DAL functions in parallel: the existing one for `BilancioBarsChart`, and the new `getMonthlyTrendByNature` for the new chart.

### Pitfall 3: Null nature in SQL GROUP BY

**What goes wrong:** `GROUP BY COALESCE(uo.nature, sc.nature)` — when both are NULL, the group key is NULL. SQL `GROUP BY` puts all NULLs in a single group (correct). But when building `MonthlyNatureTrendPoint` in TypeScript, `null` as a Record key needs special handling (you cannot use `null` as a string key directly — use `'unclassified'` as the sentinel key in the JS object).
**Why it happens:** SQL and JavaScript handle null keys differently.
**How to avoid:** In the SQL query, use `COALESCE(uo.nature, sc.nature, 'unclassified')` or handle null rows in the builder by mapping `null → 'unclassified'`.

### Pitfall 4: Stacked bar ordering inconsistency

**What goes wrong:** If nature segment ordering differs between months (e.g., one month has all 6 natures, another has 3), Recharts may render the stack in a different order visually.
**Why it happens:** Recharts stacks `<Bar>` elements in DOM order, not data order. Since we render all bars regardless, this is fine — but the `chartData` objects must have all keys present (with 0 for missing natures), not missing keys.
**How to avoid:** In `buildMonthlyNatureTrendData`, pre-populate all `NATURE_ORDER` keys with `'0.00'` for every month bucket before filling in actual values.

### Pitfall 5: Seed runner not writing `nature` to DB

**What goes wrong:** `seed-data.ts` is updated with `nature` fields, but `scripts/seed.ts` only spreads known columns and ignores `nature` because `sub_category` doesn't have the column yet at seed time.
**Why it happens:** Migration and seed must be applied in the right order.
**How to avoid:** Migration must run before `yarn db:seed`. The planner must order the wave accordingly: migration → seed update → verify.

### Pitfall 6: `customName` NOT NULL constraint on override upsert

**What goes wrong:** Calling the upsert for nature-only with no custom name hits a NOT NULL violation on `custom_name`.
**Why it happens:** Current schema has `customName` as `.notNull()`.
**How to avoid:** Make `customName` nullable in the migration. See Critical Schema Findings above.

---

## Code Examples

### DAL: `getMonthlyTrendByNature` structure sketch

```typescript
// Source: [VERIFIED: lib/dal/dashboard.ts — pattern adapted from getAggregatedTransactionsData]

type NatureTrendRow = {
  month: string
  nature: string | null   // null = unclassified
  amount: string          // algebraic sum, may be negative
  totalNc: number | string | null
  totalIgn: number | string | null
}

export const getMonthlyTrendByNature = cache(
  async (preset: DashboardPreset): Promise<MonthlyNatureTrendPoint[]> => {
    const { userId } = await verifySession()
    const { from, to } = dashboardPresetToDateRange(preset)
    const monthSql = sql<string>`to_char(${transactionTable.occurredAt}, 'YYYY-MM')`
    const natureResolved = sql<string | null>`coalesce(${userSubcategoryOverride.nature}, ${subCategory.nature})`

    const rows: NatureTrendRow[] = await db
      .select({
        month: monthSql,
        nature: natureResolved,
        amount: sql<string>`coalesce(sum(${transactionTable.amount}), 0)::text`,
        totalNc: sql<number>`count(distinct case when ${expense.status} = '1' and ${expense.subCategoryId} is null then ${expense.id} end)`,
        totalIgn: sql<number>`count(distinct case when ${category.slug} = 'ignore' then ${expense.id} end)`,
      })
      .from(transactionTable)
      .leftJoin(expense, eq(transactionTable.expenseId, expense.id))
      .leftJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
      .leftJoin(category, eq(subCategory.categoryId, category.id))
      .leftJoin(
        userSubcategoryOverride,
        and(
          eq(userSubcategoryOverride.subCategoryId, subCategory.id),
          eq(userSubcategoryOverride.userId, userId),
        ),
      )
      .where(and(dateScopedTransactions(userId, from, to), expenseStatusIncludedInDashboardTotals()))
      .groupBy(monthSql, natureResolved)

    return buildMonthlyNatureTrendData({ from, to, rows })
  }
)
```

### Migration SQL (expected shape)

```sql
-- drizzle/migrations/0012_flow_nature.sql (generated)
CREATE TYPE "public"."flow_nature" AS ENUM(
  'essential', 'discretionary', 'operational', 'financial', 'debt', 'extraordinary'
);
--> statement-breakpoint
ALTER TABLE "sub_category" ADD COLUMN "nature" "flow_nature";
--> statement-breakpoint
ALTER TABLE "user_subcategory_override" ADD COLUMN "nature" "flow_nature";
--> statement-breakpoint
ALTER TABLE "user_subcategory_override" ALTER COLUMN "custom_name" DROP NOT NULL;
-- (if making customName nullable in this migration)
```

### Seed data shape (one example per category representative)

```typescript
// Source: [VERIFIED: scripts/seed-data.ts — existing structure to extend]
// Nature assignments (ASSUMED — planner's discretion per CONTEXT.md)
{
  categoryId: 8,   // spesa
  name: 'supermercato',
  slug: 'supermercato',
  displayOrder: 0,
  isActive: true,
  nature: 'essential',  // <-- new field
},
{
  categoryId: 10,  // ristorazione
  name: 'cene fuori',
  slug: 'cene-fuori',
  displayOrder: 0,
  isActive: true,
  nature: 'discretionary',
},
{
  categoryId: 14,  // rate e finanziamenti
  name: 'mutuo casa',
  slug: 'mutuo-casa',
  displayOrder: 0,
  isActive: true,
  nature: 'debt',
},
// ignore category subcategories → nature: null (no nature field or explicit null)
```

---

## Seed Nature Assignment Guide

The planner/executor decides specific assignments. Here is a semantic mapping as a starting framework:

| Nature | Categories it maps to (examples) | Subcategory examples |
|--------|----------------------------------|----------------------|
| `essential` | spesa, salute, bollette e utilità, trasporti (mezzi pubblici), casa (affitto, manutenzione) | supermercato, visite mediche, energia elettrica, mezzi pubblici, affitto |
| `discretionary` | ristorazione, shopping, vacanze, regali, tempo libero, benessere, libri e media | cene fuori, abbigliamento, cinema, streaming video, cure estetiche |
| `operational` | abbonamenti (servizi telefonici e internet, banca), tasse imposte e commissioni, formazione | servizi telefonici e internet, commissioni bancarie, corsi online |
| `financial` | investimenti, income finanziari, vendite e dismissioni, movimenti di liquidità | azioni, dividendi azionari, ricariche conti |
| `debt` | rate e finanziamenti | mutuo casa, finanziamenti auto, altri finanziamenti |
| `extraordinary` | bonus/indennità income, risparmio, some regali scenarios | fondo emergenze, risparmio per progetti |
| `null` | ignore category, sistema internal | trasferimento, addebito carta di credito |
| IN categories | Use `essential`/`financial`/`extraordinary` as appropriate | stipendio base → null or financial (planner decides), rimborsi → extraordinary |

**Note:** IN-type category subcategories also get natures. The chart shows algebraic sum per nature across all transaction types — income subcategories with `essential` nature would offset spending in the same nature segment. This is architecturally correct per ADR-0004 but may produce counterintuitive chart behavior (income reduces spending segment). The planner should consider assigning IN subcategories distinct natures (e.g., `financial` for income) so they don't mix with OUT essential spending.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `EntrateUsciteChart` with two hardcoded bars (`totalIn`, `totalOut`) | N dynamically-rendered stacked bars by nature | Chart component fully rewritten; test assertions change |
| `MonthlyTrendPoint` with `totalIn`/`totalOut` strings | `MonthlyNatureTrendPoint` with `segments: Record<string, string>` | Two separate DAL functions feed two different charts |
| No nature concept in schema | `flowNatureEnum` pgEnum, nullable columns on `sub_category` + `user_subcategory_override` | One Drizzle migration, seed update |
| `createSubcategoryAction` with name only | Must accept `nature` as required field | Zod schema change, action change, dialog UI change |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ChartLegendContent` accepts an `onClick` handler that receives the series' `dataKey` | Chart pattern, Pitfall 1 | Toggle may silently fail; must verify by reading `components/ui/chart.tsx` |
| A2 | Making `customName` nullable is the correct fix for the NOT NULL issue | Critical Schema Findings | Alternative: keep NOT NULL and require customName on all upserts (degrades UX) |
| A3 | IN-type subcategories should get distinct natures from OUT subcategories to avoid chart segment mixing | Seed assignment guide | Chart shows algebraic net — if IN and OUT share a nature, they net against each other (may be intentional) |
| A4 | `COALESCE(userSubcategoryOverride.nature, subCategory.nature)` in a Drizzle `sql` template correctly references the joined table columns after LEFT JOIN | DAL query pattern | If column reference is ambiguous in Drizzle sql template, query fails; test with actual data |
| A5 | The `scripts/seed.ts` runner will write the new `nature` field to `sub_category` after migration | Pitfall 5 | Seed may silently ignore unknown columns if using spread without the column in Drizzle insert |

---

## Open Questions (RESOLVED)

1. **`ChartLegendContent` onClick API** (RESOLVED: use custom legend fallback)
   - What we know: The component wraps Recharts' Legend; it accepts a `content` prop.
   - What's unclear: Whether `onClick` forwarded from `ChartLegendContent` delivers `dataKey` or another shape.
   - Recommendation: Read `components/ui/chart.tsx` in Wave 3 before implementing. If no onClick forwarding, render a custom legend function that calls `toggleNature(item.dataKey)` directly.
   - RESOLVED: Plan 37-04 Task 1 reads `components/ui/chart.tsx` first and implements a custom legend function (`renderLegend`) as the guaranteed fallback. The executor must verify the onClick forwarding shape at implementation time and use the custom legend if not forwarded.

2. **Nature for IN-type subcategories** (RESOLVED: assign `financial` to all IN-type)
   - What we know: ADR-0004 says algebraic sum — IN amounts add to the nature segment, OUT amounts subtract.
   - What's unclear: Whether the user expects income to reduce spending segments or have its own visual space.
   - Recommendation: Assign `financial` or a unique nature to all IN-type subcategories to keep them visually separate from OUT spending natures. Planner decides.
   - RESOLVED: Plan 37-02 Task 3 assigns `financial` to all IN-type system subcategories (salary, investment returns, etc.) so income appears in its own visual band and does not net against OUT spending natures.

3. **"Non classificato" visibility mode** (RESOLVED: render only when non-zero)
   - What we know: CONTEXT.md defers this to Claude's discretion.
   - What's unclear: Always visible (even at zero) or only when transactions with null nature exist.
   - Recommendation: Render only when `segments['unclassified']` is non-zero for at least one month in the range. Avoids visual noise. Planner confirms.
   - RESOLVED: Plan 37-04 Task 1 renders the "Non classificato" segment only when at least one month in the selected period has a non-zero unclassified total. This avoids a persistent empty bar and reduces visual noise.

---

## Environment Availability

Step 2.6: SKIPPED — no new external CLI tools or services. All runtime dependencies (PostgreSQL, Node.js, Next.js dev server) are already in use by the project.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (config: `vitest.config.ts`) |
| Config file | `vitest.config.ts` — includes `tests/**/*.test.ts`, `tests/**/*.test.tsx` |
| Quick run command | `yarn test --reporter=verbose tests/dashboard-charts.test.tsx` |
| Full suite command | `yarn test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R-FN-01 | `flowNatureEnum` defined, `sub_category.nature` column nullable | unit (schema shape) | `yarn test tests/dashboard-dal.test.ts` | ❌ Wave 0 — add cases |
| R-FN-02 | `user_subcategory_override.nature` column nullable | unit (schema shape) | `yarn test tests/dashboard-dal.test.ts` | ❌ Wave 0 — add cases |
| R-FN-03 | Seed subcategories have `nature` field | unit (seed data) | `yarn test tests/category-settings-seed.ts` | ❌ Wave 0 — new test |
| R-FN-04 | `getMonthlyTrendByNature` returns algebraic sum grouped by nature | unit (DAL builder) | `yarn test tests/dashboard-dal.test.ts` | ❌ Wave 0 — add cases |
| R-FN-05 | `MonthlyNatureTrendPoint` type exported from dal | type check (tsc) | `yarn tsc --noEmit` | ❌ Wave 0 |
| R-FN-06 | Chart renders one bar per nature, legend click updates URL | unit (renderToStaticMarkup) | `yarn test tests/dashboard-charts.test.tsx` | ✅ exists — UPDATE existing assertions |
| R-FN-07 | `nature-labels.ts` exports `NATURE_LABELS`, `NATURE_ORDER`, `NATURE_COLORS` | unit | `yarn test tests/nature-labels.test.ts` | ❌ Wave 0 — new test |
| R-FN-08 | `setSubcategoryNatureAction` persists override correctly | unit (action test) | `yarn test tests/category-actions.test.ts` | ✅ exists — add cases |
| R-FN-09 | `createSubcategoryAction` requires `nature` field | unit (action test) | `yarn test tests/category-actions.test.ts` | ✅ exists — add cases |

### Sampling Rate
- **Per task commit:** `yarn test tests/dashboard-charts.test.tsx tests/category-actions.test.ts`
- **Per wave merge:** `yarn test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/nature-labels.test.ts` — covers R-FN-07 (new utility module)
- [ ] `tests/dashboard-dal.test.ts` — add `buildMonthlyNatureTrendData` unit tests covering: algebraic sum, null-nature grouping, all-months pre-populated (R-FN-04)
- [ ] `tests/dashboard-charts.test.tsx` — update existing assertions: remove `Entrate`/`Uscite` assertions, add nature label assertions (`Essenziale`, `Non classificato`) (R-FN-06)
- [ ] `tests/category-settings-seed.ts` — add check that at least one system subcategory has a non-null `nature` property (R-FN-03)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | `verifySession()` guards all DAL functions and server actions — already applied throughout project |
| V5 Input Validation | yes | Zod schema for `nature` enum in `CreateSubcategorySchema` and `SetNatureSchema` |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User sets nature on another user's subcategory | Tampering | `verifySession()` in action; DAL WHERE clause scopes to `userId` |
| Enum injection (invalid nature string) | Tampering | `z.enum([...])` in Zod schema rejects unknown values before reaching DAL |
| Override insertion for non-existent subcategory | Tampering | `upsertSystemSubcategoryOverride` validates subcategory exists before upsert (already present pattern) |

---

## Sources

### Primary (HIGH confidence)

- `[VERIFIED: lib/db/schema.ts]` — `subCategory`, `userSubcategoryOverride` exact column definitions
- `[VERIFIED: lib/dal/dashboard.ts]` — `getAggregatedTransactionsData`, `MonthlyTrendPoint`, `buildMonthlyTrendData`, all query helpers
- `[VERIFIED: components/dashboard/entrate-uscite-chart.tsx]` — current chart structure to replace
- `[VERIFIED: components/dashboard/overview-filters.tsx]` — URL sync pattern to replicate exactly
- `[VERIFIED: components/dashboard/dashboard-filters.tsx]` — second URL sync reference
- `[VERIFIED: lib/dal/categories.ts]` — `upsertSystemSubcategoryOverride` upsert pattern, `CategoryWithSubCategories` type
- `[VERIFIED: lib/actions/categories.ts]` — `createSubcategoryAction`, `renameSubcategoryAction` action patterns
- `[VERIFIED: lib/validations/category.ts]` — `CreateSubcategorySchema`, Zod patterns
- `[VERIFIED: components/categories/category-settings-panel.tsx]` — SubcategoryList structure to extend
- `[VERIFIED: components/categories/category-mutation-dialogs.tsx]` — dialog + useDialogAction patterns
- `[VERIFIED: scripts/seed-data.ts]` — complete ~120 subcategory list
- `[VERIFIED: app/(app)/dashboard/overview/page.tsx]` — RSC structure, dual chart pattern
- `[VERIFIED: tests/dashboard-charts.test.tsx]` — existing chart tests to update
- `[VERIFIED: vitest.config.ts]` — test framework configuration
- `[VERIFIED: docs/adr/0003-flownature-at-subcategory-level.md]` — nature lives on sub_category, nullable
- `[VERIFIED: docs/adr/0004-nature-segments-algebraic-sum.md]` — algebraic sum, no refund enum
- `[VERIFIED: .planning/phases/37-flow-nature-chart/37-CONTEXT.md]` — all locked decisions

### Secondary (MEDIUM confidence)

- Recharts `<Bar hide={boolean}>` prop behavior — [ASSUMED] based on Recharts API conventions; verify against installed version

---

## Metadata

**Confidence breakdown:**
- Schema migration: HIGH — exact current schema verified, pattern established from migration 0010
- DAL query: HIGH — pattern directly derived from `getAggregatedTransactionsData`; algebraic sum deviation documented in ADR
- Chart rewrite: MEDIUM-HIGH — Recharts `hide` prop and legend `onClick` handler shape are ASSUMED; `ChartLegendContent` onClick API flagged for verification
- Settings inline Select: HIGH — exact existing patterns reused from dialogs + overview-filters
- Seed data assignments: ASSUMED — planner's discretion per CONTEXT.md

**Research date:** 2026-05-25
**Valid until:** 2026-06-25 (stable stack; Recharts/shadcn APIs don't change rapidly)
