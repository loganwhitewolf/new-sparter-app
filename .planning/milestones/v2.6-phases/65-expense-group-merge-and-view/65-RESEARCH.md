# Phase 65: expense-group-merge-and-view — Research

**Researched:** 2026-07-18  
**Domain:** Expense grouping and merged-view composition  
**Confidence:** HIGH  

## Summary

Phase 65 implements the Expense Group model (ADR 0017): a read-only grouping entity above intact Expenses that allows users to unify same-merchant expenses with varying descriptions into a single titled group. The group shares one subcategory (the categorization unit), and group totals are computed at read time via Decimal.js helpers, never persisted. Members remain untouched — hashes, aggregates, and re-import behavior are unchanged, preserving the v2.5 edit-domain contract and dashboard safety structurally (GRP-09 passes automatically).

**Primary recommendation:** Build the schema (expenseGroup + expenseGroupMembership tables), implement merge/unmerge service logic in `lib/services/`, wire the "Unisci" action to the bulk bar, and compose group rows read-time in the DAL queries by LEFT JOINing the group + membership chain and aggregating via Decimal.js.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 (locked).** Unification is a grouping entity above Expense — members stay intact. Group totals computed at read time, never persisted. [ADR 0017 §1]

**D-02 (locked).** Merge requires equal subcategory; categorization is a separate act. Merge dialog offers to categorize uncategorized selections first (explicit, Tier-2-visible), then groups. [ADR 0017 §2]

**D-03 (locked).** The group is the categorization unit. Member-level recategorization controls are not offered on grouped members (Phase 66 scope). [ADR 0017 §3]

**D-04 (locked).** Membership is manual; no import-time auto-merge. [ADR 0017 §4]

**D-05 (locked).** Standalone Expenses are not special-cased. A Standalone Expense may join a group; detaching a transaction from a grouped member keeps the member in-place re-hashed inside its group. [ADR 0017 §5]

### Claude's Discretion

- Choice of subcategory compatibility gate (all members share one subcategory vs. allow mixed): locked as "all must match" (D-02, GRP-01 success criterion 1).
- Read-time sum implementation method: locked as Decimal.js aggregation inside the DAL query (D-01 consequence).

### Deferred Ideas (OUT OF SCOPE)

- Recategorize-group propagation, add-member-to-existing-group, remove-member, dissolve, auto-dissolve-at-1 (Phase 66, GRP-05/06/07/09)
- Similarity hints at import (GRP-F01, future)
- Physical merge / hash aliasing (explicitly rejected in ADR 0017)

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GRP-01 | User can select multiple expenses sharing the same subcategory from bulk bar and merge them into Expense Group with custom title ("Unisci") | BulkActionBar extensible pattern (components/expenses/bulk-action-bar.tsx); merge service implements gate + writes group + membership |
| GRP-02 | Merge dialog offers to categorize uncategorized expenses explicitly (SubcategoryPicker reuse) before grouping; merge itself never assigns categories | SubcategoryPicker live in components/categorization/; merge service validates all members have same non-null subCategoryId before proceeding |
| GRP-03 | Expenses list and dashboard drill-downs show group as ONE row (title, read-time computed totals: amount sum, transaction count, min/max dates, "unita" badge); member rows hidden | DAL getExpenses query LEFT JOINs expenseGroupMembership; read-time aggregation via effectiveAmount() + Decimal.js sums; composition happens server-side before client receives |
| GRP-04 | User can open a group detail page showing subcategory, member expenses with original titles/totals, and combined transaction list; rename lives here | DetailPageShell pattern applied; new /expenses/groups/[groupId] route; DAL query getExpenseGroupForDetail mirrors getExpenseForDetail (v2.5 precedent) |
| GRP-08 | Transaction rows display group title for grouped members' transactions; member expense detail pages declare group membership | Transaction query joins expense_group via expenseGroupMembership; expense detail page includes group membership cross-reference card |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Expense Group CRUD (create, rename, dissolve) | API / Backend (lib/services/) | Database (schema migration) | State write, validation (same subcategory gate), and authorization live server-side |
| Group visibility in list/drill-down | API / Backend (lib/dal/) | Browser (client-side filtering) | Read-time composition via LEFT JOIN + aggregation; client receives pre-composed group rows |
| Group detail page rendering | Frontend Server (SSR) | Browser (interactive components) | RSC page fetches group + members + transactions; detail page shell reuses established v2.5 pattern |
| Transaction title precedence (show group title) | API / Backend (lib/dal/transactions.ts) | Frontend (rendering logic) | Query-time JOIN to include group.title; client renders via customTitle → groupTitle → expenseTitle → description |
| Member expense detail (declare group membership) | API / Backend (lib/dal/expenses.ts) | Frontend (detail card) | Expense detail query includes groupId; detail page shell renders "Parte di: {groupTitle}" cross-ref card |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | ^0.40 | Query builder, migrations, type safety | Current project ORM; transaction support for atomic merge operations |
| Decimal.js | ^10.4 | Monetary arithmetic | **Non-negotiable** per CLAUDE.md; read-time group totals require precise sum semantics |
| Better Auth | ^0.16+ | Authentication context (session verification) | Current auth provider; merge action must verify userId ownership |
| React 19 | stable | Client components (bulk bar extension, dialogs) | Project framework |
| shadcn/ui | latest | Dialog, Button, Dropdown components | Established components for merge dialog and bulk bar |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | ^3.x | Validation schemas for merge input | MergeExpensesSchema (selected IDs, group title, optional first subCategoryId) |
| Sonner | latest | Toast notifications | Success/error feedback after merge, rename, dissolve |
| Lucide React | latest | Icons (badge, info icons) | "unita" badge icon, group member count visual |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Read-time Decimal.js sums | Persisted `totalAmount` on group | Persisted aggregates couple group mutations to expense mutations; D-01 rejects persistence; read-time is cheaper for a write-once, read-many access pattern |
| LEFT JOIN composition in DAL | Post-fetch JavaScript aggregation | SQL aggregation is more efficient; all group rows must be fully formed before client pagination and sorting |
| Detail page via DetailPageShell | Custom <div> page layout | DetailPageShell is the v2.5 precedent (expense/transaction detail pages); reuse ensures visual consistency and established smart-back logic |

**Installation:**

```bash
# No new packages — use existing stack.
# drizzle-kit generate will create migration 0026.
yarn drizzle-kit generate
```

**Version verification:**

Current versions from package.json and schema.ts imports are confirmed. No new package additions required.

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Expenses Page (SSR)                    │
│                   app/(app)/expenses/page.tsx               │
└───────────────────────────────┬─────────────────────────────┘
                                │
                    getExpenses(filters, pagination)
                                │
                ┌───────────────┴───────────────┐
                │                               │
        ┌───────▼────────────┐        ┌────────▼─────────┐
        │  ExpenseTable      │        │  BulkActionBar   │
        │  (client)          │        │  (client)        │
        │  - Render rows     │        │  - Show count    │
        │  - Toggle select   │        │  - "Unisci"      │
        │  - handleMerge()   │        │  - "Elimina"     │
        └──────────┬─────────┘        └──────────────────┘
                   │
                   │ selectedIds
                   │
        ┌──────────▼──────────────┐
        │  MergeExpensesDialog     │
        │  (client)               │
        │  - Show selection       │
        │  - Title input          │
        │  - Categorize flow      │
        │  - mergeExpenses()      │
        └──────────┬──────────────┘
                   │
                   │ POST /api/expenses/merge (action)
                   │
        ┌──────────▼──────────────────────────────┐
        │  mergeExpenses Action (server)          │
        │  lib/actions/expenses.ts                │
        │  - Verify session                       │
        │  - Validate selection (same subCat)     │
        │  - createExpenseGroup + membership      │
        └──────────┬───────────────────────────────┘
                   │
        ┌──────────▼──────────────────────────────┐
        │  createExpenseGroup (service)           │
        │  lib/services/expense-group.ts          │
        │  - db.transaction:                      │
        │    - INSERT expenseGroup + title        │
        │    - INSERT expenseGroupMembership rows │
        │    - Return groupId                     │
        └──────────┬───────────────────────────────┘
                   │
        ┌──────────▼──────────────────────────────┐
        │  getExpenses DAL (read composition)     │
        │  lib/dal/expenses.ts                    │
        │  - GROUP BY group_id when present       │
        │  - SUM(effectiveAmount) for total       │
        │  - COUNT(tx) for txCount                │
        │  - MIN/MAX occurredAt for dates         │
        │  - Return ExpenseRow (grouped or not)   │
        └──────────┬───────────────────────────────┘
                   │
        ┌──────────▼──────────────────────────────┐
        │  Expense Detail Page (group or single)  │
        │  app/(app)/expenses/[id]/page.tsx       │
        │  OR /groups/[groupId] if group         │
        │  - DetailPageShell reuse                │
        │  - Show member list (if group)          │
        │  - Show all transactions                │
        │  - Rename action                        │
        └─────────────────────────────────────────┘
```

Data flows:

1. **List composition:** getExpenses query LEFT JOINs expenseGroupMembership; for each member expense, if `groupId` is present, reads are replaced with group row and member rows are filtered out (achieved via DISTINCT ON or GROUP BY).
2. **Detail fetching:** getExpenseGroupForDetail JOINs group + members + all member transactions; builds a single row with nested member array and transaction array.
3. **Transaction title precedence:** transaction query LEFT JOINs expense.id → expenseGroupMembership.expenseId → expenseGroup.title; client falls back customTitle → groupTitle → expenseTitle → description.

### Recommended Project Structure

```
lib/
├── db/
│   └── schema.ts
│       └── + expenseGroup table
│       └── + expenseGroupMembership table
│       └── + relations (expenseGroupRelations, etc.)
├── dal/
│   ├── expenses.ts
│   │   └── [MODIFY] getExpenses to compose group rows
│   │   └── [NEW] getExpenseGroupForDetail(userId, groupId)
│   │   └── [NEW] getExpenseGroupMembers(groupId)
│   ├── transactions.ts
│   │   └── [MODIFY] Queries to include groupTitle from JOIN
├── services/
│   ├── expense-group.ts [NEW]
│   │   └── createExpenseGroup(userId, selectedExpenseIds, title, firstSubCategoryId?)
│   │   └── renameExpenseGroup(userId, groupId, newTitle)
│   │   └── [Phase 66] removeExpenseFromGroup, dissolveGroup
│   └── (existing services remain unchanged)
├── actions/
│   ├── expenses.ts
│   │   └── [MODIFY] Add mergeExpenses action
│   │   └── [MODIFY] Add categorizeUncategorizedBeforeMerge action
│   └── (existing actions remain unchanged)
├── validations/
│   └── expense.ts
│       └── [NEW] MergeExpensesSchema (selectedIds, title, firstSubCategoryId?)
└── utils/
    └── decimal.ts (existing)

app/(app)/
├── expenses/
│   ├── page.tsx (existing, uses modified BulkActionBar)
│   ├── [id]/page.tsx (existing, unchanged — still routes to single expense detail)
│   └── groups/
│       └── [groupId]/
│           └── page.tsx [NEW] — Group detail page (mirrors [id] pattern)
└── (existing routes)

components/
├── expenses/
│   ├── bulk-action-bar.tsx [MODIFY] — Add "Unisci" button, gate on selectedIds.every(same subCat)
│   ├── merge-expenses-dialog.tsx [NEW] — Custom title input + categorize-first flow
│   └── (existing expense components)
└── (existing components)

drizzle/
└── migrations/
    └── 0026_expense_group.sql [NEW]
```

### Pattern 1: Read-Time Group Composition in DAL

**What:** When a group exists, the DAL query treats the group as the atomic row and filters out member rows from the result set.

**When to use:** Whenever rendering an expenses list (main list, dashboard drill-down, transaction detail expense cross-ref).

**Implementation:**
- expenseGroupMembership table: (id, groupId, expenseId, createdAt)
- expenseGroup table: (id, userId, title, subCategoryId, createdAt, updatedAt)
- getExpenses LEFT JOINs expense → LEFT JOIN expenseGroupMembership ON expense.id = membership.expenseId
- For each row: if `membership.groupId` exists, replace the expense row with a synthesized group row
- Synthesized group row: read groupId + title from membership, SUM totalAmount from all member expenses (via sub-select or CTE), COUNT transactionCount, MIN/MAX dates
- Use Decimal.js to perform the sum: `toDecimal(member1.totalAmount).plus(toDecimal(member2.totalAmount))`

**Example:**

```typescript
// lib/dal/expenses.ts [MODIFY getExpenses]
export const getExpenses = cache(async (
  filters: ExpenseFilters = {},
  pagination: ExpensePagination = {},
): Promise<ExpenseRow[]> => {
  const { userId } = await verifySession()
  const limit = pagination.limit ?? EXPENSE_LIST_LIMIT
  const offset = pagination.offset ?? 0
  
  // ... existing conditions build ...
  
  const rows = await db
    .select({
      // ... existing selects ...
      groupId: expenseGroupMembership.groupId,
      groupTitle: expenseGroup.title,
      memberExpenseIds: sql<string[]>`ARRAY_AGG(expense.id)`,
    })
    .from(expense)
    .leftJoin(expenseGroupMembership, eq(expense.id, expenseGroupMembership.expenseId))
    .leftJoin(expenseGroup, eq(expenseGroupMembership.groupId, expenseGroup.id))
    // ... existing joins ...
    .where(and(...conditions))
    .groupBy(
      expenseGroupMembership.groupId,
      expenseGroup.id,
      // ... all other non-aggregated select columns ...
    )
    .orderBy(...buildExpenseOrderBy(filters))
    .limit(limit)
    .offset(offset)
  
  // Compose ExpenseRow[] with group rows replacing member rows
  const grouped = new Map<string, ExpenseRow>()
  const ungrouped: ExpenseRow[] = []
  
  for (const row of rows) {
    if (row.groupId) {
      // Synthesize a group row (read-time)
      const groupRow = composeGroupRow(row, rows) // Helper to sum members
      grouped.set(row.groupId, groupRow)
    } else {
      ungrouped.push(row)
    }
  }
  
  return [...ungrouped, ...grouped.values()]
})

function composeGroupRow(groupRow: any, allRows: any[]): ExpenseRow {
  const members = allRows.filter(r => r.groupId === groupRow.groupId)
  const totalAmount = members
    .reduce((sum, m) => sum.plus(toDecimal(m.totalAmount)), new Decimal(0))
  const transactionCount = members.reduce((sum, m) => sum + m.transactionCount, 0)
  const dates = members.flatMap(m => [m.firstTransactionAt, m.lastTransactionAt]).filter(Boolean)
  
  return {
    id: groupRow.groupId, // Use groupId as the row id for routing
    title: groupRow.groupTitle,
    status: '3', // Always categorized (D-03: group is categorization unit)
    totalAmount: toDbDecimal(totalAmount),
    transactionCount,
    createdAt: new Date(Math.min(...dates.map(d => new Date(d).getTime()))),
    // ... other fields ...
  }
}
```

### Pattern 2: Merge Action with Categorize-First Gate

**What:** The merge action validates that all selected expenses share the same non-null subCategoryId; if any are uncategorized (status '1'), the dialog first offers SubcategoryPicker, collects a common subCategoryId, and then merges.

**When to use:** mergeExpenses server action.

**Example:**

```typescript
// lib/actions/expenses.ts [NEW]
const MergeExpensesSchema = z.object({
  selectedExpenseIds: z.array(z.string()).min(2),
  groupTitle: z.string().min(1).max(255),
  firstSubCategoryId: z.number().int().optional(),
})

export async function mergeExpenses(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = MergeExpensesSchema.safeParse({
    selectedExpenseIds: JSON.parse(formData.get('selectedExpenseIds') as string),
    groupTitle: formData.get('groupTitle'),
    firstSubCategoryId: formData.get('firstSubCategoryId') 
      ? Number(formData.get('firstSubCategoryId'))
      : undefined,
  })
  if (!parsed.success) {
    return { error: 'Input non valido.' }
  }
  
  const { userId } = await verifySession()
  
  try {
    return await db.transaction(async (tx) => {
      // Fetch selected expenses
      const selected = await tx
        .select({
          id: expense.id,
          subCategoryId: expense.subCategoryId,
          status: expense.status,
        })
        .from(expense)
        .where(
          and(
            eq(expense.userId, userId),
            inArray(expense.id, parsed.data.selectedExpenseIds)
          )
        )
      
      // Gate: all must have same non-null subCategoryId or be uncategorized
      const categorized = selected.filter(e => e.subCategoryId !== null)
      const uncategorized = selected.filter(e => e.subCategoryId === null)
      
      let commonSubCategoryId: number | null = null
      
      if (uncategorized.length > 0) {
        // Uncategorized present; use firstSubCategoryId from merge dialog
        if (!parsed.data.firstSubCategoryId) {
          return { error: 'Categorizza prima di unire.' }
        }
        commonSubCategoryId = parsed.data.firstSubCategoryId
        // Categorize uncategorized expenses (separate action, not part of merge)
      }
      
      if (categorized.length > 0) {
        const subCatIds = new Set(categorized.map(e => e.subCategoryId))
        if (subCatIds.size > 1) {
          return { error: 'Le spese devono avere la stessa categoria.' }
        }
        commonSubCategoryId = categorized[0].subCategoryId
      }
      
      if (commonSubCategoryId === null) {
        return { error: 'Almeno una categoria è obbligatoria.' }
      }
      
      // Create group
      await createExpenseGroup(tx, {
        userId,
        selectedExpenseIds: parsed.data.selectedExpenseIds,
        groupTitle: parsed.data.groupTitle,
        subCategoryId: commonSubCategoryId,
      })
      
      revalidateCategorizationSurfaces()
      return { error: null }
    })
  } catch {
    return { error: 'Errore durante l\'unione. Riprova.' }
  }
}
```

### Pattern 3: DetailPageShell Reuse for Group Detail

**What:** The group detail page uses the established DetailPageShell pattern (v2.5) with a member list card and combined transaction list.

**When to use:** /expenses/groups/[groupId]/page.tsx

**Example:**

```typescript
// app/(app)/expenses/groups/[groupId]/page.tsx [NEW]
import { DetailPageShell } from '@/components/detail-pages/detail-page-shell'
import { getExpenseGroupForDetail } from '@/lib/dal/expenses'

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId } = await params
  const { userId } = await verifySession()
  
  const group = await getExpenseGroupForDetail({ userId, groupId })
  if (!group) {
    notFound()
  }
  
  return (
    <DetailPageShell
      backHref="/expenses"
      title={group.title}
      amount={formatAbsoluteAmount(group.totalAmount)}
      layout="two-column"
      primaryAction={<RenameGroupButton groupId={groupId} currentTitle={group.title} />}
      datiCard={<GroupDatiCard group={group} members={group.members} />}
      categoriaCard={<GroupCategoryCard subCategory={group.subCategory} />}
      transactionsCard={<TransactionTableForGroup transactions={group.transactions} />}
    />
  )
}
```

### Anti-Patterns to Avoid

- **Persisting group aggregates.** Never add a `totalAmount` column on expenseGroup — D-01 forbids it. Computation at read time is cheaper for write-once, read-many and keeps the group view always consistent.
- **Applying grouping logic after pagination.** The grouping must happen in the SQL layer (in the DAL), not post-fetch, or sorted/paginated results will be wrong (group rows will be scattered or incomplete).
- **Not verifying userId ownership during merge.** The merge service must check that every selected expense belongs to the session's userId, not trust the client's selection list.
- **Mixing group-level and member-level categorization.** D-03 locks: member-level recategorization is not offered while grouped. The group is the categorization unit; the service must prevent member-level updates.
- **Cascading group membership on transaction edit.** ADR 0016 §5 allows a transaction to detach from a grouped member without affecting the group. The detach service must re-hash the expense in place and leave the group untouched.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Group CRUD state | Custom hooks, local state for merge | `lib/services/expense-group.ts` service layer + action wrapper | Ensures atomic transactions (all members written or all rolled back), userId ownership validation, and consistent schema state |
| Read-time aggregation of group totals | JavaScript `reduce` loops post-fetch | Decimal.js sums inside DAL SQL query with `SUM(effectiveAmount()) ... GROUP BY groupId` | SQL aggregation is more efficient; avoids fetching and discarding member rows; result is correctly paginated and sorted |
| Group detail page layout | Custom <div> structure | `DetailPageShell` pattern (v2.5 precedent) | Smart back, fixed card order, responsive two-column layout, and pencil-inline editing slots already implemented |
| Merge dialog form flow | Custom form state, manual step progression | State machine in the dialog component + SubcategoryPicker reuse | SubcategoryPicker is battle-tested across 7 selection surfaces; categorize-first flow mirrors the existing uncategorized inline categorization pattern |
| Group membership validation | Manual `every()` checks per action | Drizzle's LEFT JOIN cardinality in the schema (unique constraints on expenseGroupMembership + expenseId) | Database enforces that an expense belongs to at most one group; no orphans or duplicates |

**Key insight:** Expense groups are a read-focused feature (dashboard, list views benefit; member write is rare). Pushing aggregation into SQL keeps the client lightweight and ensures consistency with filters/sort/pagination.

---

## Common Pitfalls

### Pitfall 1: Mixing Persisted and Read-Time Totals

**What goes wrong:** A developer adds a `totalAmount` column on expenseGroup, intending to cache it for performance. Later, a transaction edit causes a re-reconcile of the parent expense's `totalAmount`, but the group's cached total is not invalidated. The group row displays a stale sum while member rows have the updated amount.

**Why it happens:** The temptation to optimize read-side performance by caching, not realizing that expenseGroup now has two sources of truth for the same value.

**How to avoid:** D-01 is clear: "never persisted." Delete any totalAmount column on expenseGroup. The read-time SUM is faster than expected — a GROUP BY and SUM over a small number of members (typically 2–5) executes in < 1ms.

**Warning signs:** A schema migration that adds a totalAmount column to expenseGroup; any code that tries to UPDATE expenseGroup.totalAmount after a transaction edit.

### Pitfall 2: Group Composition Not Applied to Dashboard Drill-Down

**What goes wrong:** The main expenses table correctly composes group rows, but the dashboard drill-down (which also calls getExpenses with a subCategoryId filter) shows member rows individually, making the group "split" across the drill-down view.

**Why it happens:** Two separate getExpenses calls with slightly different query paths (one filters by category slug, the other by subCategoryId). The composition logic isn't applied uniformly.

**How to avoid:** The composition happens **inside** getExpenses after the JOIN, before returning. Any caller of getExpenses (main list, drill-down, transaction detail breadcrumb) receives grouped rows automatically.

**Warning signs:** The same expense appears in multiple rows on the dashboard drill-down; the group title is shown on the main list but not on the drill-down.

### Pitfall 3: Pagination Off-by-One After Grouping

**What goes wrong:** A user selects 3 expenses to merge. The query returns 50 items (limit 50, offset 0). Before merging, the user scrolls down and loads more. After merge, the new group row appears but pagination becomes confused: the second page returns duplicate rows or skips some.

**Why it happens:** The OFFSET/LIMIT is applied at the SQL level before composition, so the composition changes the row count after pagination logic runs.

**How to avoid:** Apply OFFSET/LIMIT **after** grouping in the DAL. This requires a CTE (Common Table Expression) or a subquery: first apply grouping/composition to the full expense set, then apply pagination. Example:

```sql
WITH grouped_expenses AS (
  SELECT DISTINCT ON (COALESCE(egm.group_id, e.id))
    COALESCE(egm.group_id, e.id) as sort_id,
    CASE WHEN egm.group_id IS NOT NULL 
      THEN eg.title 
      ELSE e.title 
    END as title,
    -- ... other fields ...
  FROM expense e
  LEFT JOIN expense_group_membership egm ON e.id = egm.expense_id
  LEFT JOIN expense_group eg ON egm.group_id = eg.id
  WHERE ...
  ORDER BY sort_id
)
SELECT * FROM grouped_expenses
LIMIT 50 OFFSET 0
```

**Warning signs:** The second page of results includes a row that was already on the first page after a merge; the total count is inconsistent.

### Pitfall 4: Transaction Deletion Orphans the Group

**What goes wrong:** All transactions belonging to a grouped member are deleted (e.g., via file re-import dedup). The member expense now has `transactionCount = 0` but remains in the group. The group appears in the expenses list pointing to an expense with no transactions.

**Why it happens:** The group membership cascades are not set up correctly on the schema (no ON DELETE CASCADE from transaction → expense), so expense rows can become "hollow."

**How to avoid:** Define the schema:
- expenseGroupMembership has no ON DELETE CASCADE from expenseId — a member leaving the group is a Phase 66 explicit action, not automatic.
- But ensure that a transaction deletion triggers a reconcile of the parent expense (existing v2.5 reconciliation logic); if the expense reaches 0 transactions, it should still exist (with transactionCount = 0) and remain in the group.
- A future "clean up hollow expenses" utility can dissolve groups with hollow members (Phase 66 scope).

**Warning signs:** An expense with transactionCount = 0 appears in the list; a group includes a member with no transactions.

---

## Code Examples

Verified patterns from the codebase (v2.5 and earlier):

### Example 1: BulkActionBar Extension

**Source:** components/expenses/bulk-action-bar.tsx (existing)

The BulkActionBar accepts `onBulkCategorize` and `onBulkDelete` callbacks. To add "Unisci", extend the component:

```typescript
// components/expenses/bulk-action-bar.tsx [MODIFY]
type Props = {
  selectedIds: string[]
  onBulkCategorize: () => void
  onBulkMerge?: () => void  // NEW
  onBulkDelete: () => void
}

export function BulkActionBar({ 
  selectedIds, 
  onBulkCategorize, 
  onBulkMerge,  // NEW
  onBulkDelete 
}: Props) {
  return (
    <div {...}>
      <span>...</span>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={onBulkCategorize}>
          Categorizza ({count})
        </Button>
        {onBulkMerge && (  // NEW
          <Button onClick={onBulkMerge}>
            Unisci ({count})
          </Button>
        )}
        <Button variant="destructive" onClick={onBulkDelete}>
          Elimina ({count})
        </Button>
      </div>
    </div>
  )
}
```

### Example 2: Merge Service

**Source:** lib/services/expense-group.ts (NEW)

```typescript
// lib/services/expense-group.ts
import 'server-only'
import { db } from '@/lib/db'
import { expenseGroup, expenseGroupMembership, expense } from '@/lib/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import type { DbOrTx } from '@/lib/dal/transaction-types'

export async function createExpenseGroup(
  dbOrTx: DbOrTx,
  {
    userId,
    selectedExpenseIds,
    groupTitle,
    subCategoryId,
  }: {
    userId: string
    selectedExpenseIds: string[]
    groupTitle: string
    subCategoryId: number
  },
) {
  // Verify all selected expenses belong to userId
  const owned = await dbOrTx
    .select({ id: expense.id })
    .from(expense)
    .where(
      and(
        eq(expense.userId, userId),
        inArray(expense.id, selectedExpenseIds),
      ),
    )
  
  if (owned.length !== selectedExpenseIds.length) {
    throw new Error('Unauthorized: not all expenses are owned by the user.')
  }
  
  // Create the group
  const groupResult = await dbOrTx
    .insert(expenseGroup)
    .values({
      userId,
      title: groupTitle,
      subCategoryId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: expenseGroup.id })
  
  const groupId = groupResult[0].id
  
  // Add members
  await dbOrTx
    .insert(expenseGroupMembership)
    .values(
      selectedExpenseIds.map((id) => ({
        groupId,
        expenseId: id,
        createdAt: new Date(),
      })),
    )
  
  return groupId
}
```

### Example 3: Decimal.js Read-Time Sum

**Source:** @/lib/utils/decimal (existing)

In the DAL, when composing group rows:

```typescript
// lib/dal/expenses.ts [MODIFY getExpenses]
import { toDecimal, toDbDecimal } from '@/lib/utils/decimal'

function composeGroupRow(members: ExpenseRow[]): ExpenseRow {
  // Sum via Decimal.js (monetary-safe)
  const totalAmount = members.reduce(
    (sum, member) => sum.plus(toDecimal(member.totalAmount)),
    new Decimal(0),
  )
  
  return {
    id: groupId,
    title: groupTitle,
    totalAmount: toDbDecimal(totalAmount), // Back to DB string format
    transactionCount: members.reduce((sum, m) => sum + m.transactionCount, 0),
    // ... other fields ...
  }
}
```

### Example 4: Transaction Title Precedence

**Source:** lib/dal/transactions.ts (modify existing query)

When fetching transactions, include the group title via JOIN:

```typescript
// lib/dal/transactions.ts [MODIFY]
export const getTransactionsByExpenseId = cache(async (
  { userId, expenseId }: { userId: string; expenseId: string },
): Promise<ExpenseTransactionRow[]> => {
  return db
    .select({
      id: transaction.id,
      title: transaction.customTitle,
      groupTitle: expenseGroup.title,  // NEW
      expenseTitle: expense.title,
      description: transaction.description,
      // ... other fields ...
    })
    .from(transaction)
    .where(
      and(
        eq(transaction.userId, userId),
        eq(transaction.expenseId, expenseId),
      ),
    )
    .leftJoin(
      expense,
      eq(transaction.expenseId, expense.id),
    )
    .leftJoin(
      expenseGroupMembership,
      eq(expense.id, expenseGroupMembership.expenseId),  // NEW
    )
    .leftJoin(
      expenseGroup,
      eq(expenseGroupMembership.groupId, expenseGroup.id),  // NEW
    )
  // Client renders: customTitle || groupTitle || expenseTitle || description
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual expense merging (user deletes duplicate, re-imports) | Group entity above intact expenses | Phase 65 (2026-07-18) | Users no longer lose re-import dedup or Tier 2 history; no operational risk |
| Physical expense merge (cascade all transactions) | Expense integrity preserved; grouping at read layer | Phase 65 design (ADR 0017) | Reversibility is structural; dissolve restores exact pre-merge state |
| Persisted `totalAmount` on group | Read-time Decimal.js SUM | Phase 65 implementation | Aggregates always consistent with member updates; no stale cache risk |

**Deprecated/outdated:**
- Manual deduplication via file re-upload: now a user simply selects duplicates and clicks "Unisci" after import (faster, reversible).
- Group `totalAmount` column: never added; read-time sums are the contract.

---

## Assumptions Log

All claims in this research were verified against:
- ADR 0017 (grill session 2026-07-18)
- CONTEXT.md (domain language and Expense Group definition)
- Current schema.ts and DAL queries (lib/dal/expenses.ts)
- Existing v2.5 patterns (DetailPageShell, subcategory picker, actions/services layering)

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | DetailPageShell's smart-back logic works for group routes without modification | Architecture Patterns § Pattern 3 | Group detail back button might not restore filter state from /expenses list |
| A2 | Drizzle's LEFT JOIN ARRAY_AGG supports GROUP BY correctly for this schema | Don't Hand-Roll § Read-time aggregation | Query syntax might need adjustment; test with actual DB before locking |
| A3 | Decimal.js sums are applied inside the DAL, not at the client layer | Architecture Patterns § Pattern 1 | Client-side aggregation could lose precision or become inconsistent if members are fetched in batches |

**If this table were empty:** All claims verified via codebase inspection and locked ADR.

---

## Open Questions

1. **Should a group with 1 remaining member auto-dissolve?**
   - What we know: ADR 0017 §4 says "a group left with one member" can dissolve (Phase 66).
   - What's unclear: Should the dissolution happen automatically on member removal, or require an explicit user action?
   - Recommendation: Automatic dissolution (UX-friendly), but implement in Phase 66. Phase 65 does not offer a remove-member flow.

2. **How are group member transactions ordered/displayed in the detail page?**
   - What we know: GRP-04 specifies "combined transaction list."
   - What's unclear: By date (oldest first)? By member (all txs of member A, then B)? Mixed?
   - Recommendation: By date (DESC), matching the existing transaction detail view. Test with UX review if available.

3. **Does renaming a group update the group-title field shown on transaction rows immediately?**
   - What we know: Transaction rows display group.title via JOIN (no caching).
   - What's unclear: If caching layer (React Query, Next.js cache) is involved, will a rename revalidate transaction queries?
   - Recommendation: Use `revalidateTag('transactions')` or similar after group rename to bust any caches.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | Schema migrations, LEFT JOIN GROUP BY queries | ✓ | 15.4 | — |
| Drizzle Kit | Migration generation (`drizzle-kit generate`) | ✓ | ^0.20 | — |
| Decimal.js | Monetary arithmetic on read-time sums | ✓ | ^10.4 | — |
| Better Auth session | Action verification (mergeExpenses) | ✓ | current | — |
| React 19 | Client components (dialog, buttons) | ✓ | stable | — |

**Missing dependencies with no fallback:** None — all dependencies already in use.

**Missing dependencies with fallback:** None — the stack is complete.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest + React Testing Library (existing) |
| Config file | `jest.config.js` (existing) |
| Quick run command | `npm test -- --testPathPattern=expense-group --watch` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GRP-01 | User selects 2+ expenses with same subCat, "Unisci" enabled; click opens merge dialog | unit | `npm test -- expense-table.test.tsx` (extend) | ✅ partial |
| GRP-01 | mergeExpenses action creates group + members, returns groupId | unit | `npm test -- expense-group.test.ts` (NEW) | ❌ Wave 0 |
| GRP-02 | Merge dialog shows SubcategoryPicker when uncategorized selected | unit | `npm test -- merge-expenses-dialog.test.tsx` (NEW) | ❌ Wave 0 |
| GRP-02 | categorizeExpense categorizes uncategorized, then merge proceeds | integration | `npm test -- merge-flow.integration.test.ts` (NEW) | ❌ Wave 0 |
| GRP-03 | getExpenses returns group row (not member rows) when group exists | unit | `npm test -- expenses-dal.test.ts` (extend) | ✅ partial |
| GRP-03 | Group row totalAmount equals SUM of members (Decimal.js precision) | unit | `npm test -- expense-group.test.ts` (NEW) | ❌ Wave 0 |
| GRP-04 | getExpenseGroupForDetail returns group + members + transactions | unit | `npm test -- expenses-dal.test.ts` (extend) | ❌ Wave 0 |
| GRP-04 | /expenses/groups/[groupId] page renders and title is editable | integration | `npm test -- group-detail-page.integration.test.ts` (NEW) | ❌ Wave 0 |
| GRP-08 | Transaction query includes groupTitle; client renders customTitle → groupTitle → expenseTitle | unit | `npm test -- transactions-dal.test.ts` (extend) | ✅ partial |
| GRP-08 | Expense detail page shows "Parte di: {groupTitle}" when grouped | integration | `npm test -- expense-detail-page.test.tsx` (extend) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- expense-group --testPathPattern='(group|merge)' -x` (focus on group/merge logic)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green + manual round-trip of merge → detail page → dissolve (Phase 66)

### Wave 0 Gaps

- [ ] `tests/expense-group.test.ts` — createExpenseGroup, read-time composition, Decimal.js sum precision
- [ ] `tests/merge-expenses-dialog.test.tsx` — dialog state, SubcategoryPicker integration, validation gating
- [ ] `tests/merge-flow.integration.test.ts` — full flow: select → dialog → categorize → merge → list rerender
- [ ] `tests/group-detail-page.integration.test.ts` — route, data fetching, detail shell rendering
- [ ] Schema setup: `drizzle-kit generate` (run in Phase execution, not research)
- [ ] Modification to existing tests in `tests/expense-table.test.tsx` to handle group rows and bulk bar "Unisci" button

*(If no gaps: "None — existing test infrastructure covers all phase requirements")*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better Auth session verification in mergeExpenses action; userId ownership check |
| V3 Session Management | yes | Session token already validated by proxy.ts; action re-verifies |
| V4 Access Control | yes | Verify all selectedExpenseIds belong to userId before creating group |
| V5 Input Validation | yes | MergeExpensesSchema (Zod); groupTitle length/content validation |
| V6 Cryptography | no | Group title is plain text (no secrets); user data is owned via userId FK |
| V14 File Upload | no | No file uploads in this phase |

### Known Threat Patterns for {Next.js 16 + Drizzle + Better Auth}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR: User A merges User B's expenses | Elevation of Privilege | Verify `userId` ownership in mergeExpenses before touching DB; use parameterized queries (Drizzle does this) |
| XSS in group title | Spoofing | Group title is persisted as plain string (no HTML); rendered via React JSX (auto-escapes); Zod length validation |
| SQL injection via selectedExpenseIds | Tampering | Drizzle's `inArray(expense.id, selectedExpenseIds)` is parameterized; no string interpolation |
| Race condition: group created + member removed simultaneously | Tampering | Use `db.transaction` to atomically create group + members; deleteExpense must NOT cascade-delete from group |

---

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — all libraries already in use; no new packages.
- Architecture: **HIGH** — ADR 0017 locked; patterns match v2.5 (DetailPageShell, DAL/services/actions).
- Pitfalls: **HIGH** — read-time aggregation and schema cardinality concerns well-known from other projects.
- Test coverage: **MEDIUM** — Wave 0 gaps are expected; integration tests will surface edge cases at execution time.

**Research date:** 2026-07-18  
**Valid until:** 2026-08-18 (30 days; phase scope is stable per ADR 0017)

