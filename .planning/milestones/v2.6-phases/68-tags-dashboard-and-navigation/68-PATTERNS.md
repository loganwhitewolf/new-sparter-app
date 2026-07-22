# Phase 68: tags-dashboard-and-navigation - Pattern Map

**Mapped:** 2026-07-21
**Files analyzed:** 16
**Analogs found:** 16 / 16

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `lib/dal/transaction-tags-sql.ts` (NEW) | utility (SQL predicate) | request-response | `lib/dal/transaction-pairs-sql.ts` | exact |
| `lib/dal/dashboard.ts` (MODIFY: getUncategorizedCount, getOverviewAmountTotals, getCategoryRanking, getCategoryDeviations, getCategoryDetail) | model/DAL | CRUD (aggregate read) | itself (same file, existing `isNotSecondary()`/`dateScopedTransactions()` call sites) | exact |
| `lib/dal/overview.ts` (MODIFY: getOverview, getOverviewChart, getMonthOverMonthCategoryChanges) | model/DAL | CRUD (aggregate read) | itself (same file, mirrors `lib/dal/dashboard.ts` predicate composition) | exact |
| `lib/actions/overview.ts` (MODIFY: fetchMovers) | controller (Server Action) | request-response | itself (existing closed-enum validation pattern) | exact |
| `lib/dal/tags.ts` (MODIFY: add `getTagTotals`) | model/DAL | CRUD (aggregate read) | `lib/dal/dashboard.ts` → `getCategoryRanking` | role-match |
| `lib/validations/transactions.ts` (MODIFY: add `tag` param) | utility (validation) | transform | itself (existing `subCategoryId` numeric-param parsing) | exact |
| `lib/dal/transactions.ts` (MODIFY: `getTransactions`, `TransactionFilters`) | model/DAL | CRUD (paginated read) | itself (existing `conditions.push(...)` idiom) | exact |
| `lib/actions/tags.ts` (MODIFY: `archiveTagAction` — add 2nd `revalidatePath`) | controller (Server Action) | request-response | itself | exact |
| `app/(app)/dashboard/overview/page.tsx` (MODIFY: read `?tag=`) | route (RSC page) | request-response | itself | exact |
| `app/(app)/dashboard/categories/page.tsx` (MODIFY: read `?tag=`) | route (RSC page) | request-response | itself | exact |
| `app/(app)/dashboard/categories/[id]/page.tsx` (MODIFY: thread tagId per Open-Question resolution #2) | route (RSC page) | request-response | itself | exact |
| `app/(app)/dashboard/tags/page.tsx` (NEW) | route (RSC page) | request-response | `app/(app)/dashboard/categories/page.tsx` | role-match |
| `components/dashboard/dashboard-tab-nav.tsx` (MODIFY: 3rd tab + `tag` in `buildDashboardTabHref`) | component (client nav) | request-response | itself | exact |
| `components/dashboard/tag-filter-select.tsx` (NEW) | component (client Select) | request-response | `components/dashboard/dashboard-filters.tsx` | exact |
| `components/dashboard/tag-ranking-list.tsx` (NEW) | component (server-rendered list) | CRUD (display) | `components/dashboard/category-ranking-list.tsx` | exact |
| `components/dashboard/overview/overview-movers-panel.tsx` (MODIFY: wrap `<li>` rows in `<Link>`) | component | request-response | itself (`MoverList`) | exact |

## Pattern Assignments

### `lib/dal/transaction-tags-sql.ts` (NEW — utility, request-response)

**Analog:** `lib/dal/transaction-pairs-sql.ts` (full file, 54 lines — read in full, small file)

**Imports pattern** (lines 1-5):
```typescript
import 'server-only'

import { sql } from 'drizzle-orm'

import { transaction as transactionTable } from '@/lib/db/schema'
```

**Core predicate pattern** (lines 7-24, `isNotSecondary`):
```typescript
/**
 * WHERE clause fragment: exclude transactions that are the SECONDARY (B) in a pair.
 * ...
 * Usage: add to the `and(...)` in every aggregation query WHERE clause alongside
 * dateScopedTransactions() and expenseStatusIncludedInDashboardTotals().
 */
export function isNotSecondary() {
  return sql`NOT EXISTS (
    SELECT 1 FROM transaction_pair tp
    WHERE tp.transaction_b_id = ${transactionTable.id}
  )`
}
```

**New file to write** (adapt the above shape 1:1 — `tagId` optional, returns `undefined` when absent so the caller's `and(...)` drops it, matching how `typeFilter`/`categoryScope` are already conditionally built in `lib/dal/dashboard.ts` lines 1096-1099):
```typescript
import 'server-only'

import { sql } from 'drizzle-orm'

import { transaction as transactionTable } from '@/lib/db/schema'

/**
 * WHERE clause fragment: narrow to transactions carrying a specific tag via a
 * genuine N:M table (transaction_tag). ALWAYS use EXISTS, never a JOIN, to avoid
 * row fan-out for transactions carrying 2+ tags (see 68-RESEARCH.md Pitfall 1).
 *
 * Returns undefined when tagId is not provided — the caller's and(...) drops
 * undefined conditions automatically (same idiom as typeFilter in dashboard.ts).
 */
export function tagScopedTransactions(tagId?: number) {
  if (!tagId) return undefined
  return sql`EXISTS (
    SELECT 1 FROM transaction_tag tt
    WHERE tt.transaction_id = ${transactionTable.id}
      AND tt.tag_id = ${tagId}
  )`
}
```

**Schema reference used above** (verified `lib/db/schema.ts` lines 558-573 — `transaction_tag` table: `tagId` FK → `tag.id`, `transactionId` FK → `transaction.id`, unique on `(tagId, transactionId)`).

---

### `lib/dal/dashboard.ts` (MODIFY — thread `tagId` through 5 functions)

**Analog:** itself — every exported aggregate already threads an optional filter (`typeFilter`, `categoryScope`) the identical way; `tagScopedTransactions(tagId)` slots in beside `isNotSecondary()`.

**Existing conditional-filter idiom to copy** (lines 1091-1099, `getCategoryDeviations`):
```typescript
const typeFilter = input.type === 'all' ? undefined : eq(direction.code, input.type)
const groupColumn = input.categoryId !== undefined ? subCategory.id : category.id
const categoryScope =
  input.categoryId !== undefined ? eq(category.id, input.categoryId) : undefined
```

**WHERE-clause insertion point** — every touched function's `.where(and(...))` call already lists `isNotSecondary()` last-ish; add `tagScopedTransactions(tagId)` right after it, e.g. `getOverviewAmountTotals` (lines 488-495):
```typescript
.where(
  and(
    dateScopedTransactions(userId, from, to),
    expenseStatusIncludedInDashboardTotals(),
    ne(direction.code, 'transfer'),
    isNotSecondary(),
    tagScopedTransactions(tagId)   // <- NEW, no-op when tagId undefined
  )
)
```

**Signature-threading convention** — add `tagId?: number` as the LAST parameter (per RESEARCH.md "State of the Art" row — additive, no breaking change) to:
- `getUncategorizedCount(userId, from, to, tagId?)` (line 433)
- `getOverviewAmountTotals(userId, from, to, tagId?)` (line 455)
- `getCategoryRanking` — takes `filters: DashboardFilters`; add `tagId?: number` as 2nd param (line 1031)
- `getCategoryDeviations` — takes `input: CategoryDeviationsInput`; add `tagId` to the `input` object (line 1091) since it's already an object-shaped signature
- `getCategoryDetail(categoryId, filters, tagId?)` (line 1199) — RESOLVED scope: TAG-04 requires the drill-down page to narrow too (Open Question #2, locked)

**Import to add:**
```typescript
import { tagScopedTransactions } from '@/lib/dal/transaction-tags-sql'
```

---

### `lib/dal/overview.ts` (MODIFY — thread `tagId` + add `category.slug`)

**Analog:** itself, mirrors `lib/dal/dashboard.ts`'s composition style exactly (same `dateScopedTransactions`/`expenseStatusIncludedInDashboardTotals`/`isNotSecondary` local re-declarations).

**Functions to thread `tagId?: number` through (last param):**
- `getOverview(year, tagId?)` (line 113) — passes down into its two `getOverviewAmountTotals`/`getUncategorizedCount` calls (lines 134-137)
- `getOverviewChart(year, tagId?)` (line 452) — add `tagScopedTransactions(tagId)` to the `.where(and(...))` at lines 495-507
- `getMonthOverMonthCategoryChanges(year, monthIndex, directionParam, limit, tagId?)` (line 187) — add to BOTH the allocation-grain and category-grain `.where(and(...))` blocks (4 total WHERE clauses in this function: lines 241-247, 275-281, 320-326, 354-360)

**Pitfall 2 fix — add `category.slug` to the in/out grain SELECTs** (lines 296-300 and 330-334, currently missing `slug`):
```typescript
// BEFORE (current, lines 296-300):
.select({
  id: category.id,
  name: category.name,
  amount: sql<string>`coalesce(abs(sum(${effectiveAmount()})), 0)::text`,
})

// AFTER — add categorySlug, and to MonthOverMonthChange type (line 29-35):
.select({
  id: category.id,
  name: category.name,
  categorySlug: category.slug,   // NEW — fixes slug-vs-id mismatch (Pitfall 2)
  amount: sql<string>`coalesce(abs(sum(${effectiveAmount()})), 0)::text`,
})
```
Apply to both the `currRows`/`prevRows` in/out-grain queries (not the allocation-grain ones, which group by `natureTable` and are explicitly out of NAV-01 scope per UI-SPEC §3). Add `categorySlug: string | null` to the `MonthOverMonthChange` type (line 29-35) and to the `AmountRow` local type (line 207) and thread it through the `changes.push({...})` calls (lines 397-403, 419-425).

**Import to add:**
```typescript
import { tagScopedTransactions } from '@/lib/dal/transaction-tags-sql'
```

---

### `lib/actions/overview.ts` (MODIFY `fetchMovers` — Pitfall 4 fix)

**Analog:** itself (full file, 55 lines, read in full) — existing closed-enum validation idiom for `direction`.

**Current signature** (line 20-24):
```typescript
export async function fetchMovers(
  year: number,
  monthIndex: number,
  direction: 'in' | 'out' | 'allocation' = 'out',
): Promise<{ movers: MonthOverMonthChange[]; error: string | null }> {
```

**Pattern to extend — add `tagId` as a 4th optional param, validated the same defensive way as `year`/`monthIndex` (lines 31-39):**
```typescript
export async function fetchMovers(
  year: number,
  monthIndex: number,
  direction: 'in' | 'out' | 'allocation' = 'out',
  tagId?: number,
): Promise<{ movers: MonthOverMonthChange[]; error: string | null }> {
  try {
    const { userId } = await verifySession()
    void userId

    if (
      !Number.isInteger(year) || year < 2000 || year > 2100 ||
      !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11
    ) {
      return { movers: [], error: 'Parametri non validi.' }
    }
    if (!(VALID_DIRECTIONS as readonly string[]).includes(direction)) {
      return { movers: [], error: 'Parametri non validi.' }
    }
    // NEW: bound tagId the same defensive way as year/monthIndex
    const safeTagId = Number.isInteger(tagId) && (tagId as number) > 0 ? tagId : undefined

    const movers = await getMonthOverMonthCategoryChanges(year, monthIndex, direction as ValidDirection, 10, safeTagId)
    return { movers, error: null }
  } catch {
    return { movers: [], error: 'Non è stato possibile caricare i dati. Riprova.' }
  }
}
```
Caller-side: `OverviewMoversSection`'s `handleMonthSelect` closure must also thread its own `tagId` prop into this call (component not yet read in this pass — grep `handleMonthSelect` in `components/dashboard/overview/overview-movers-section.tsx` at plan time to locate the exact call site).

---

### `lib/dal/tags.ts` (MODIFY — add `getTagTotals`)

**Analog:** `lib/dal/dashboard.ts` → `getCategoryRanking` (LEFT JOIN + COALESCE(0) zero-safe aggregate idiom) — but note the join DIRECTION is reversed: `FROM tag LEFT JOIN transaction_tag LEFT JOIN transaction` (never `FROM transaction`), per Anti-Pattern warning in RESEARCH.md.

**Resolved scope (locked, Open Question #1):** per-tag total applies the SAME exclusions as every other dashboard total — `expenseStatusIncludedInDashboardTotals()`, exclude `transfer` direction, `effectiveAmount()`/`isNotSecondary()` pair-netting. This means the join chain must ALSO bring in `expense`/`subCategory`/`nature`/`direction` (unlike the simpler sketch in RESEARCH.md's Pattern 2, which the user's resolution supersedes).

**Existing imports in this file** (lines 1-5):
```typescript
import 'server-only'
import { cache } from 'react'
import { db, type DbOrTx } from '@/lib/db'
import { tag } from '@/lib/db/schema'
import { and, asc, eq, isNotNull } from 'drizzle-orm'
```

**Additional imports needed** (mirror `lib/dal/dashboard.ts` lines 3-38):
```typescript
import { countDistinct, sql, ne, inArray } from 'drizzle-orm'
import {
  category, direction, expense, nature, subCategory,
  transaction as transactionTable, transactionTag, userSubcategoryOverride,
} from '@/lib/db/schema'
import { effectiveAmount, isNotSecondary } from '@/lib/dal/transaction-pairs-sql'
import { DASHBOARD_TOTAL_EXPENSE_STATUSES } from '@/lib/dal/dashboard'
```

**Query shape** (adapt `getCategoryRanking`'s join chain, lines 1042-1082, but rooted at `tag` with LEFT JOINs so zero-transaction tags still surface a row):
```typescript
export type TagTotalItem = {
  tagId: number
  name: string
  archived: boolean
  count: number
  minDate: string | null
  maxDate: string | null
  total: string  // signed — sign-colored per UI-SPEC Color section
}

export async function getTagTotals(userId: string): Promise<TagTotalItem[]> {
  const rows = await db
    .select({
      tagId: tag.id,
      name: tag.name,
      archived: tag.archived,
      count: countDistinct(transactionTable.id),
      minDate: sql<string | null>`MIN(${transactionTable.occurredAt})`,
      maxDate: sql<string | null>`MAX(${transactionTable.occurredAt})`,
      total: sql<string>`coalesce(sum(${effectiveAmount()}), 0)::text`,
    })
    .from(tag)
    .leftJoin(transactionTag, eq(transactionTag.tagId, tag.id))
    .leftJoin(transactionTable, eq(transactionTag.transactionId, transactionTable.id))
    .leftJoin(expense, eq(transactionTable.expenseId, expense.id))
    .leftJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
    .leftJoin(category, eq(subCategory.categoryId, category.id))
    .leftJoin(
      userSubcategoryOverride,
      and(eq(userSubcategoryOverride.subCategoryId, subCategory.id), eq(userSubcategoryOverride.userId, userId)),
    )
    .leftJoin(nature, eq(nature.id, sql`COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})`))
    .leftJoin(direction, eq(nature.directionId, direction.id))
    .where(
      and(
        eq(tag.userId, userId),
        // Only apply exclusions to rows that HAVE a transaction — a tag with zero
        // transactions must still surface via the LEFT JOIN, so these must be OR'd
        // with "no transaction attached" (transactionTable.id IS NULL) at implementation time.
      ),
    )
    .groupBy(tag.id, tag.name, tag.archived)
  // sort by ABS(total) desc at the DAL layer or in a buildTagTotalsData() pure fn (mirrors
  // buildCategoryRankingData's separation of query vs. shaping)
}
```
**Note for planner:** the exact WHERE-clause composition for "apply dashboard exclusions but never drop a zero-transaction tag" needs care — `expenseStatusIncludedInDashboardTotals()`/`ne(direction.code,'transfer')`/`isNotSecondary()` must be scoped so they don't filter OUT the LEFT JOIN's null rows. Recommend a `CASE WHEN transactionTable.id IS NOT NULL THEN ... END` guard or applying the exclusions inside the `effectiveAmount()`/`count` SQL expressions (via `FILTER (WHERE ...)`) rather than in the outer `WHERE`, to avoid silently dropping tags whose only transactions are excluded categories.

**Caption format** (per UI-SPEC copy contract): `"{count} movimenti · {minDate}–{maxDate}"` — mirrors Expense Group read-time total shape (GRP-03), not `CategoryRankingList`'s percentage/sparkline shape.

---

### `lib/validations/transactions.ts` (MODIFY — add `tag` searchParam)

**Analog:** itself — existing `subCategoryId` numeric-param parsing (lines 206, 213-216).

**Pattern to copy exactly** (lines 206, 213-216):
```typescript
const rawSubCategory = firstTrimmed(input.subCategory)
// ...
const parsedSubCategoryId = rawSubCategory ? Number(rawSubCategory) : NaN
const subCategoryId = Number.isInteger(parsedSubCategoryId) && parsedSubCategoryId > 0
  ? parsedSubCategoryId
  : undefined
```

**New `tag` field — identical shape:**
```typescript
const rawTag = firstTrimmed(input.tag)
const parsedTagId = rawTag ? Number(rawTag) : NaN
const tagId = Number.isInteger(parsedTagId) && parsedTagId > 0 ? parsedTagId : undefined
```
Add `tagId?: number` to `ParsedTransactionFilters` type (line 89-112, alongside `subCategoryId`), and `...(tagId ? { tagId } : {})` to the return object (line 227-241).

---

### `lib/dal/transactions.ts` (MODIFY `getTransactions` — add `tag` filter)

**Analog:** itself — existing `conditions.push(...)` idiom for `subCategoryId` (lines 329-331).

**Pattern to copy exactly** (lines 329-331):
```typescript
if (filters.subCategoryId) {
  conditions.push(eq(subCategory.id, filters.subCategoryId))
}
```

**New tag condition (uses the shared EXISTS helper, per Anti-Pattern warning — never a `leftJoin(transactionTag, ...)`):**
```typescript
if (filters.tagId) {
  conditions.push(tagScopedTransactions(filters.tagId))
}
```
Add `tagId?: number` to `TransactionFilters` type (lines 57-75, alongside `subCategoryId`) and import `tagScopedTransactions` from `@/lib/dal/transaction-tags-sql`. Also update `mapParsedTransactionFiltersToDal` (lines 260-268) — it currently spreads `...rest` so `tagId` passes through automatically as long as the field name matches between `ParsedTransactionFilters` and `TransactionFilters` (both should use `tagId`, no renaming needed, matching how `subCategoryId` already passes through unchanged).

---

### `lib/actions/tags.ts` (MODIFY `archiveTagAction` — Pitfall 3 fix)

**Analog:** itself (full file, 112 lines, read in full).

**Current single revalidate** (line 106):
```typescript
await archiveTagService({ userId, tagId: parsed.data.id })
revalidatePath(APP_ROUTES.tagSettings)
return { error: null }
```

**Fix — add a second `revalidatePath` call for the new dashboard Tag section route** (add `dashboardTags: '/dashboard/tags'` to `APP_ROUTES` in `lib/routes.ts` first, per A2 in RESEARCH.md):
```typescript
await archiveTagService({ userId, tagId: parsed.data.id })
revalidatePath(APP_ROUTES.tagSettings)
revalidatePath(APP_ROUTES.dashboardTags)  // NEW — Pitfall 3 fix
return { error: null }
```

---

### `components/dashboard/dashboard-tab-nav.tsx` (MODIFY — 3rd tab + `tag` param)

**Analog:** itself (full file, 65 lines).

**Tabs array to extend** (lines 8-11):
```typescript
const tabs = [
  { href: APP_ROUTES.dashboardOverview, label: 'Overview' },
  { href: APP_ROUTES.dashboardCategories, label: 'Categorie' },
  { href: APP_ROUTES.dashboardTags, label: 'Tag' },  // NEW
]
```

**`buildDashboardTabHref` to extend** (lines 13-36) — copy the `preset`/`type`/`sort` read-and-forward idiom verbatim:
```typescript
export function buildDashboardTabHref(
  href: string,
  searchParams: Pick<URLSearchParams, 'get'>
) {
  const params = new URLSearchParams()
  const preset = searchParams.get('preset')
  const type = searchParams.get('type')
  const sort = searchParams.get('sort')
  const tag = searchParams.get('tag')  // NEW

  if (preset) params.set('preset', preset)
  if (type) params.set('type', type)
  if (sort) params.set('sort', sort)
  if (tag) params.set('tag', tag)  // NEW

  const search = params.toString()
  return href + (search ? `?${search}` : '')
}
```
Active-tab styling (lines 51-56, `border-b-2 border-primary text-primary` vs `text-muted-foreground hover:text-foreground`) applies unchanged to the 3rd tab.

---

### `components/dashboard/tag-filter-select.tsx` (NEW)

**Analog:** `components/dashboard/dashboard-filters.tsx` (full file, 111 lines, read in full) — specifically the preset `Select` block (lines 92-107) and the `updateFilters`/`useSearchParams`/`router.replace` pattern (lines 42-68).

**Imports pattern to copy** (lines 1-13):
```typescript
'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
```

**URL-state update pattern to copy** (lines 47-68 — clear-to-default idiom):
```typescript
function updateFilters(next: Partial<Props>) {
  const params = new URLSearchParams(searchParams.toString())
  const nextPreset = next.preset ?? preset
  if (nextPreset === defaultPreset) {
    params.delete('preset')
  } else {
    params.set('preset', nextPreset)
  }
  const search = params.toString()
  startTransition(() => {
    router.replace(pathname + (search ? '?' + search : ''), { scroll: false })
  })
}
```
For the tag filter: no `tagId` param in the URL ⇒ delete `?tag=` (sentinel "Tutti i tag" per Copywriting Contract); a selected tag sets `?tag=<id>`.

**SelectTrigger pattern to copy** (lines 92-107, `w-[170px]` width contract from UI-SPEC §1):
```typescript
<Select value={preset} onValueChange={(value) => updateFilters({ preset: value as DashboardPreset })} disabled={isPending}>
  <SelectTrigger aria-label="Periodo dashboard" className="w-[170px]">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {presetOptions.map((option) => (
      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
    ))}
  </SelectContent>
</Select>
```
Adapt: `aria-label="Filtro tag"`, options = `"Tutti i tag"` (sentinel, no value/clears param) + one `SelectItem` per tag, archived ones suffixed with `<Badge variant="secondary" className="text-[10px]">Archiviato</Badge>` inline (reuse the exact badge idiom from `tag-mutation-dialogs.tsx`/`/settings/tags`, not shown in this pass — grep `Archiviato` in `components/tags/` at plan time for the exact JSX).

---

### `components/dashboard/tag-ranking-list.tsx` (NEW)

**Analog:** `components/dashboard/category-ranking-list.tsx` (full file, 168 lines, read in full).

**Card shell to copy** (lines 106-109 — minus percentage bar/sparkline/deviation badge per UI-SPEC §2):
```typescript
<li className="group rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/50">
```

**Title-link pattern to copy** (lines 117-124):
```typescript
<Link
  href={href}
  className="block truncate text-sm font-semibold text-foreground underline-offset-4 outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
  aria-label={`${item.name}: apri transazioni`}
  title={item.name}
>
  {item.name}
</Link>
```

**Empty-state pattern to copy** (lines 81-92 — adapt copy to "Nessun tag creato" per Copywriting Contract, and the dashed-box shape `rounded-xl border border-dashed py-12` per UI-SPEC's `CategoryDetailEmptyState` reference, not `CategoryRankingList`'s `min-h-[260px]` variant):
```typescript
if (sortedData.length === 0) {
  return (
    <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 text-center">
      <div className="max-w-sm space-y-2">
        <p className="text-sm font-medium">Nessuna categoria nel periodo selezionato</p>
        <p className="text-sm text-muted-foreground">Cambia periodo o tipo movimento per visualizzare la classifica.</p>
      </div>
    </div>
  )
}
```

**List container + amount formatting to copy** (lines 55-63, 94-95, 143-149):
```typescript
const amountFormatter = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
function formatAmount(value: string): string {
  const amount = Number(value)
  return amountFormatter.format(Number.isFinite(amount) ? amount : 0)
}
// ...
<ol className="grid gap-3" aria-label="Classifica categorie">
  {/* map to one <li> per tag */}
</ol>
// ...
<p className="font-mono text-sm font-semibold tabular-nums">{formatAmount(item.total)}</p>
```
Adapt amount color: sign-based (`Number(total) >= 0 ? 'text-[var(--total-in)]' : 'text-[var(--total-out)]'`), copied from `overview-movers-panel.tsx` line 158 (`OverviewMoversPanel`'s allocation column tone rule), NOT the fixed `type === 'in'`/`'out'` bar-color rule used in `category-ranking-list.tsx` line 103 (a tag has no fixed direction).

**Archive button placement** — reuse `ArchiveTagDialog` verbatim (component import, no new dialog code):
```typescript
import { ArchiveTagDialog } from '@/components/tags/tag-mutation-dialogs'
// inside the card's action area:
<ArchiveTagDialog tag={tagRow} />
```

**"Archiviato" badge** — reuse the exact `Badge variant="secondary"` idiom already established in Phase 67's `/settings/tags` and the bulk-assign dialog (not re-read in this pass; grep `Archiviato` for the exact className string at plan time — UI-SPEC locks it as `text-[10px]`).

---

### `components/dashboard/overview/overview-movers-panel.tsx` (MODIFY — NAV-01 click-through)

**Analog:** itself (full file, 172 lines, read in full) — `MoverList` function (lines 40-63).

**Current non-clickable row** (lines 47-60):
```typescript
<li
  key={m.categoryId ?? m.natureCode ?? m.name ?? idx}
  className="flex items-center justify-between py-1.5 odd:bg-muted/30 rounded-sm px-1"
>
  <span className="text-xs truncate mr-2">{m.name}</span>
  <span className="text-xs font-medium whitespace-nowrap text-right shrink-0">
    <span className={moverAmountTone(m) === 'increase' ? `text-[var(--total-${toneOnIncrease})]` : (toneOnIncrease === 'out' ? 'text-[var(--total-in)]' : 'text-[var(--total-out)]')}>
      {formatEur(Math.abs(Number(m.delta)))}
    </span>
    {' '}
    <span className="text-xs text-muted-foreground">{moverQualifier(m)}</span>
  </span>
</li>
```

**Fix — wrap in `<Link>` when `categorySlug` is present** (per UI-SPEC §3 and Pitfall 2 — href built from slug, not `categoryId`; needs `MoverListProps` to receive `year`/`selectedMonth` for the `months` param, both already available as `Props` on the parent `OverviewMoversPanel`):
```typescript
{m.categorySlug ? (
  <Link
    href={`/transactions?months=${year}-${String(selectedMonth + 1).padStart(2, '0')}&category=${m.categorySlug}`}
    className="flex items-center justify-between py-1.5 odd:bg-muted/30 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1"
  >
    {/* same inner content as before */}
  </Link>
) : (
  <div className="flex items-center justify-between py-1.5 odd:bg-muted/30 rounded-sm px-1">
    {/* same inner content, non-clickable (allocation column / no categorySlug) */}
  </div>
)}
```
`MoverListProps` and `MoverList` call sites (lines 34-38, 114-118, 125-129, 136-140) need `year`/`selectedMonth` threaded in (already props on the parent `OverviewMoversPanel`, just not yet passed to `MoverList`). The 4th column (Accantonamenti, lines 150-165) stays a plain non-linked `<li>` — explicitly out of NAV-01 scope per UI-SPEC §3.

---

## Shared Patterns

### WHERE-EXISTS predicate for N:M scoping (the single cross-cutting pattern of this phase)
**Source:** `lib/dal/transaction-pairs-sql.ts` (`isNotSecondary()`) → new `lib/dal/transaction-tags-sql.ts` (`tagScopedTransactions()`)
**Apply to:** `lib/dal/dashboard.ts` (5 functions), `lib/dal/overview.ts` (3 functions), `lib/dal/transactions.ts` (`getTransactions`), `lib/dal/tags.ts` (`getTagTotals`, inverted join direction)
```typescript
export function tagScopedTransactions(tagId?: number) {
  if (!tagId) return undefined
  return sql`EXISTS (
    SELECT 1 FROM transaction_tag tt
    WHERE tt.transaction_id = ${transactionTable.id}
      AND tt.tag_id = ${tagId}
  )`
}
```

### URL-searchParam client filter control
**Source:** `components/dashboard/dashboard-filters.tsx` (`updateFilters` + `useSearchParams`/`router.replace`/`useTransition`)
**Apply to:** `components/dashboard/tag-filter-select.tsx` (NEW), `components/dashboard/dashboard-tab-nav.tsx` (`buildDashboardTabHref`)

### Zero-safe LEFT JOIN aggregate with Decimal formatting
**Source:** `lib/dal/dashboard.ts` → `getCategoryRanking`/`buildCategoryRankingData` (`coalesce(...,0)::text` + `toDecimal`/`toFixed(2)` in the pure-function shaping layer)
**Apply to:** `lib/dal/tags.ts` → `getTagTotals`

### Archive lifecycle (verbatim reuse, zero new code)
**Source:** `lib/services/tag-operations.ts` (`archiveTag`), `lib/actions/tags.ts` (`archiveTagAction`), `components/tags/tag-mutation-dialogs.tsx` (`ArchiveTagDialog`)
**Apply to:** `components/dashboard/tag-ranking-list.tsx` — import `ArchiveTagDialog` directly; only `archiveTagAction` gets a second `revalidatePath` call, no new dialog/service code.

## No Analog Found

None — every file in scope has a direct or role-match analog in the existing codebase (this phase is explicitly framed by RESEARCH.md as "100% internal wiring," not new architectural surface).

## Metadata

**Analog search scope:** `lib/dal/`, `lib/validations/`, `lib/actions/`, `lib/services/`, `components/dashboard/`, `components/tags/`, `app/(app)/dashboard/`, `lib/db/schema.ts`, `lib/routes.ts`
**Files scanned (full or targeted read):** `lib/dal/transaction-pairs-sql.ts` (full), `lib/dal/dashboard.ts` (full, 1480 lines), `lib/dal/overview.ts` (full, 580 lines), `lib/dal/transactions.ts` (full, 888 lines), `lib/dal/tags.ts` (full), `lib/validations/transactions.ts` (full), `lib/validations/dashboard.ts` (full), `lib/actions/overview.ts` (full), `lib/actions/tags.ts` (full), `lib/services/tag-operations.ts` (full), `components/dashboard/dashboard-filters.tsx` (full), `components/dashboard/category-ranking-list.tsx` (full), `components/dashboard/dashboard-tab-nav.tsx` (full), `components/dashboard/overview/overview-movers-panel.tsx` (full), `components/tags/tag-mutation-dialogs.tsx` (full), `lib/routes.ts` (full), `lib/db/schema.ts` (targeted grep for `tag`/`transactionTag` table defs)
**Pattern extraction date:** 2026-07-21
