# Phase 50: transaction-pairing — Research

**Researched:** 2026-06-13
**Domain:** Transaction pairing schema, dashboard netting SQL, DAL integration, UX wiring
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**A — Data model**
- D-01: New `transaction_pair` table with symmetric FKs `transaction_a_id` / `transaction_b_id` → `transaction.id` ON DELETE CASCADE. Unique constraint on both columns. userId-scoped but cross-file; both transactions must belong to same user (enforced in server action, not DB constraint).
- D-02: Cardinality is 1:1 strict. No 1:N in this phase.
- D-03: ON DELETE CASCADE on both FKs: deleting either transaction removes the pair row; counterpart returns to unpaired.
- D-04: Pairing does NOT touch expenses. Pair is a metadata annotation at transaction level only.

**B — Dashboard netting**
- D-05: Paired transactions excluded from individual aggregation; replaced by algebraic net. Primary transaction (larger |amount|) determines direction/category bucket AND which calendar month the net falls into.
- D-06: Secondary transaction (smaller |amount|) is excluded from its own month's totals across ALL surfaces.
- D-07: Netting applies consistently everywhere: monthly bar chart, KPI cards, category breakdown, ranking, deviation, month-over-month changes. No partial netting.
- D-08: Explicit pair identifies which specific transaction is the refund; secondary excluded from IN totals; net appears in primary's OUT month under primary's direction/category.

**C — UX entry point**
- D-09: Pair initiated from row action in transaction list ("Collega rimborso" in existing dropdown).
- D-10: User initiates from either side; system determines primary by comparing |amount| (larger = primary). If amounts equal, earlier `occurredAt` is primary. Silent swap if user initiates from wrong side.
- D-11: Unlinking available as row action on either paired transaction: "Scollega" replaces "Collega rimborso" when row is paired.

**D — Counterpart picker**
- D-12: Dialog/modal with searchable list; consistent with `TransactionFormDialog` pattern (not bottom sheet).
- D-13: Pre-filters to opposite sign + ±90 days by default. Date range configurable. Opposite-sign filter always applied.
- D-14: Transactions already paired with another transaction excluded from picker list.

**E — Visual indicator**
- D-15: Paired rows remain in natural chronological position. Each shows small badge with link icon + net amount (e.g., "🔗 €-50"). Badge is inline in the row.
- D-16: Clicking badge opens inline popover: counterpart description, amount, date, net effect, "Vai alla transazione" link. No navigation.

### Claude's Discretion

- Exact SQL for netting in DAL queries (CTE vs subquery vs window function)
- Badge/chip visual style (color, size, position) — use existing chip/badge components
- Whether `transaction_pair` carries `created_at` and `created_by_user_id` (reasonable for auditing)
- Migration strategy (purely additive — new table + indexes, no backfill)

### Deferred Ideas (OUT OF SCOPE)

- 1:N pairing (partial refunds)
- Recategorization suggestion on pair creation
- Dashboard pair visibility filter
- Employer salary bundled reimbursements
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PAIR-01 | User can explicitly link a transaction to its opposite (1:1 relationship, additive over implicit netting) | §transaction_pair schema, §Server action pattern, §DAL pairing DAL |
| PAIR-02 | Paired transactions have dedicated display in transaction list showing link + netting effect | §Transaction list integration, §UX wiring |
| PAIR-03 | Unlinking possible; implicit-netting baseline unchanged for unpaired transactions | §Server action pattern, §Netting strategy, §Validation Architecture |
</phase_requirements>

---

## Summary

Phase 50 adds explicit transaction pairing (order↔refund, expense↔reimbursement) on top of the implicit algebraic-sum baseline shipped in Phase 49. The three deliverables are: (1) a `transaction_pair` table enforcing 1:1 cardinality, (2) dashboard netting that excludes the secondary and re-attributes the net to the primary's month and direction bucket, and (3) UX in the transaction list (row action dropdown, counterpart picker dialog, pair badge with popover).

The hardest technical problem is dashboard netting: seven aggregation query sites across `lib/dal/dashboard.ts` and `lib/dal/overview.ts` must all apply the same exclusion/re-attribution logic consistently. The recommended strategy (see §Netting SQL Strategy) is a **shared Drizzle `sql` fragment (or SQL CTE) that identifies the "effective transaction" per row** — injected once into each query's WHERE clause to exclude secondaries and CASE-express netted amounts — rather than post-processing in TypeScript, which cannot match the month re-attribution requirement without a full data pull.

The schema, DAL joins, and action patterns are all well-established and directly extendable. The migration is purely additive (new table + indexes). No seed data is needed.

**Primary recommendation:** Implement netting via a shared SQL helper fragment (Drizzle `sql` tagged template) that identifies excluded secondary IDs and PRIMARY netted amounts, injected into each aggregation query's WHERE/CASE. This is written once, applied everywhere, and is consistent with the existing Drizzle + algebraic-sum DAL patterns. Details and SQL in §Netting SQL Strategy below.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 1:1 pair storage | Database / Storage | — | FK integrity + unique constraint enforced at DB level |
| userId ownership validation | API / Backend | — | Transaction pair has no userId column; action must query both transactions before insert |
| Dashboard netting (exclusion + re-attribution) | Database / Storage | — | Month re-attribution requires SQL-level grouping on primary's `occurredAt`; TS post-processing cannot aggregate cross-month correctly |
| Counterpart picker query | API / Backend | — | Server-side DAL fetches eligible transactions (opposite sign, ±90 days, not already paired) |
| Pair badge rendering | Browser / Client | — | Inline badge in the client-rendered `TransactionTable` |
| Pair popover | Browser / Client | — | Radix UI `Popover`; data already in `TransactionListRow` via LEFT JOIN |
| Server actions (create/delete pair) | API / Backend | — | `'use server'` thin wrapper in `lib/actions/`; pattern mirrors `deleteTransaction` |

---

## Standard Stack

### Core (all already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | existing | Schema definition + query builder | Project standard; `pgTable`, `unique`, `index`, `sql` already used |
| Zod | existing | Validation schema for `CreatePairSchema` / `DeletePairSchema` | Project standard for all action input validation |
| Decimal.js | existing | Net amount calculation in badge + popover | Project hard rule; never native JS arithmetic on money |
| shadcn/ui Popover | existing | Pair badge popover (D-16) | Radix UI base already in the project |
| shadcn/ui Badge | existing | Pair badge visual (D-15) | Already used in `TransactionTable` for "Da categorizzare" / "Manuale" |
| react `cache` | existing | DAL caching for pair-aware query | Project DAL pattern |

### No New Packages

This phase installs no external packages. All required primitives (Drizzle, Zod, Decimal.js, shadcn/ui, Lucide icons) are already present. [VERIFIED: codebase grep]

---

## Package Legitimacy Audit

No new packages are introduced in this phase. The section is not applicable.

---

## Architecture Patterns

### System Architecture Diagram

```
User row action "Collega rimborso"
         │
         ▼
CounterpartPickerDialog (client)
  ├── GET /transactions filtered (opposite sign, ±90d, unpaired) ── lib/dal/transactions.ts
  └── Confirm selection ──► createTransactionPair() server action
                                    │
                               verifySession()
                               validate both tx.userId == session.userId
                               determine primary (|amount| comparison)
                                    │
                              INSERT transaction_pair (a_id=primary, b_id=secondary)
                                    │
                              revalidatePath('/transactions')
                              revalidatePath('/overview')

User views dashboard
         │
         ▼
getOverviewAmountTotals / getOverviewChart / getCategoriesBreakdown / etc.
         │
         ├── LEFT JOIN transaction_pair ON (tp.transaction_a_id = t.id OR tp.transaction_b_id = t.id)
         ├── WHERE: exclude secondaries (IS secondary in pair) UNLESS primary
         └── CASE WHEN primary → use (t.amount + counterpart.amount) as netted amount
                  WHEN unpaired → use t.amount
                  (secondary rows excluded from WHERE, never reach aggregation)
         │
         ▼
         Aggregation result = paired net in primary's month/direction
                            + all unpaired transactions as before (ADR 0004 baseline unchanged)

User views transaction list
         │
         ▼
getTransactions DAL (LEFT JOIN transaction_pair on either FK)
         │
         ├── pairedWithId: counterpart transaction.id (nullable)
         ├── pairedNetAmount: t.amount + counterpart.amount (computed via correlated subselect or JOIN)
         └── TransactionTable renders pair badge if pairedWithId != null
```

### Recommended Project Structure

```
lib/
├── db/
│   └── schema.ts                     # ADD: transactionPair table + relations
├── dal/
│   ├── transactions.ts               # EXTEND: transactionListSelect + TransactionListRow
│   ├── dashboard.ts                  # EXTEND: all aggregation queries
│   ├── overview.ts                   # EXTEND: getOverviewChart + getMonthOverMonthCategoryChanges
│   └── transaction-pairs.ts          # NEW: getEligibleCounterparts, getPairByTransactionId
├── services/
│   └── transaction-pairs.ts          # NEW: createPair(), deletePair() — ownership validation + DB write
├── actions/
│   └── transaction-pairs.ts          # NEW: createTransactionPairAction, deleteTransactionPairAction
├── validations/
│   └── transaction-pairs.ts          # NEW: CreatePairSchema, DeletePairSchema
drizzle/migrations/
└── 0020_transaction_pair.sql         # NEW: generated via drizzle-kit generate
components/
├── transactions/
│   ├── transaction-table.tsx         # EXTEND: pair badge + "Collega/Scollega" in dropdown
│   ├── counterpart-picker-dialog.tsx # NEW: dialog with searchable counterpart list
│   └── transaction-pair-popover.tsx  # NEW: badge + popover showing counterpart details
app/(app)/transactions/
└── page.tsx                          # EXTEND: pass pair-action callbacks + dialog state
```

---

## 1. Exact Current Shapes of Aggregation Queries

This section quotes the real Drizzle code. [VERIFIED: codebase read]

### 1.1 `getOverviewAmountTotals` (lib/dal/dashboard.ts, line 432)

```typescript
// Join chain (every aggregation query uses this identical chain):
.from(transactionTable)
.innerJoin(expense, eq(transactionTable.expenseId, expense.id))
.innerJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
.innerJoin(category, eq(subCategory.categoryId, category.id))
.leftJoin(userSubcategoryOverride, and(
  eq(userSubcategoryOverride.subCategoryId, subCategory.id),
  eq(userSubcategoryOverride.userId, userId),
))
.innerJoin(nature, eq(nature.id,
  sql`COALESCE(${userSubcategoryOverride.natureId}, ${subCategory.natureId})`
))
.innerJoin(direction, eq(nature.directionId, direction.id))
.where(and(
  dateScopedTransactions(userId, from, to),  // eq(t.userId) + gte/lte(occurredAt)
  expenseStatusIncludedInDashboardTotals(),   // inArray(expense.status, ['1','2','3'])
  ne(direction.code, 'transfer')
))

// SELECT:
{
  totalIn:         sql`coalesce(sum(case when ${direction.code} = 'in' then ${transactionTable.amount} else 0 end), 0)::text`,
  totalOut:        sql`coalesce(abs(sum(case when ${direction.code} = 'out' then ${transactionTable.amount} else 0 end)), 0)::text`,
  totalAllocation: sql`coalesce(sum(case when ${direction.code} = 'allocation' then ${transactionTable.amount} else 0 end), 0)::text`,
}
// Single row result — no GROUP BY
```

**Netting impact:** Must (a) exclude secondary rows from this set, and (b) replace primary row's `amount` with the netted value (primary.amount + secondary.amount) in the correct direction bucket.

### 1.2 `getCategoriesBreakdown` (lib/dal/dashboard.ts, line 899)

```typescript
// Same join chain as above.
// WHERE adds: eq(direction.includedInTotals, true)
// GROUP BY: category.id, subCategory.id, userSubcategoryOverride.customName, direction.code
// SELECT:
{
  categoryId:       category.id,
  categoryName:     category.name,
  categorySlug:     category.slug,
  categoryType:     sql`${direction.code}`,
  subCategoryId:    subCategory.id,
  subCategoryName:  sql`coalesce(${userSubcategoryOverride.customName}, ${subCategory.name})`,
  subCategorySlug:  subCategory.slug,
  count:            countDistinct(expense.id),
  amount:           sql`coalesce(abs(sum(${transactionTable.amount})), 0)::text`,
}
```

**Netting impact:** Secondary must be excluded; primary's amount contribution becomes (primary.amount + secondary.amount) in primary's subcategory bucket.

### 1.3 `getCategoryRanking` (lib/dal/dashboard.ts, line 959)

```typescript
// Same join chain.
// WHERE: eq(direction.includedInTotals, true) [+ optional type filter]
// GROUP BY: category.id, monthSql, direction.code
// SELECT: categoryId, categoryName, categorySlug, categoryType, month, count, abs(sum(amount))
```

**Netting impact:** Same as breakdown. Additionally the net must appear in primary's MONTH, not secondary's month.

### 1.4 `getCategoryDeviations` (lib/dal/dashboard.ts, line 1018)

```typescript
// Two parallel queries (reference period + baseline period).
// Same join chain. WHERE adds: eq(direction.includedInTotals, true).
// GROUP BY: groupColumn (category.id or subCategory.id), optionally + monthSql
// SELECT: id (groupColumn), amount (abs sum)
```

**Netting impact:** Same exclusion/re-attribution. Reference and baseline queries both need the netting treatment.

### 1.5 `getCategoryDetail` (lib/dal/dashboard.ts, line 1124)

Three parallel sub-queries:
- **Trend** (grouped by category.id + monthSql): same chain + `direction.includedInTotals`
- **Subcategories** (grouped by subCategory.id): same chain
- **TopTransactions** (LIMIT 5): `SELECT id, description, customTitle, amount, occurredAt` — sorted by abs(amount) DESC

**Netting impact for topTransactions:** A paired primary transaction's displayed amount should reflect the net (or keep raw amount — planner decides; the net is more honest but requires the JOIN). At minimum, paired secondary transactions should be excluded from the top-5 list.

### 1.6 `getMonthlyTrendByNature` (lib/dal/dashboard.ts, line 1340)

```typescript
// Uses leftJoin (not innerJoin) for expense / subCategory / category so uncategorized
// transactions are included for totalNc/totalIgn counting.
// GROUP BY: monthSql, natureSql (correlated subselect on nature.code)
// SELECT: month, nature, sum(amount), totalNc count, totalIgn count
```

**Netting impact:** Secondary excluded; primary's net amount replaces primary's raw amount in nature/month bucket.

### 1.7 `getOverviewChart` (lib/dal/overview.ts, line 423)

```typescript
// INNER JOINs expense + subCategory + category + leftJoin userSubcategoryOverride.
// Uses correlated subselects for natureSql and directionCodeSql (unlike dashboard.ts
// which uses explicit JOIN chain to nature + direction).
// WHERE excludes transfer via correlated direction subselect.
// GROUP BY: monthSql, natureSql, directionCodeSql
// SELECT: month, nature, directionCode, sum(amount)
// Post-processing in TypeScript: buckets 12 months, routes by nature to income/out/allocation sub-keys.
```

**Netting impact:** Same exclusion/re-attribution. Correlated subselect idiom means the JOIN approach used in dashboard.ts may need adaptation here — see §Netting Strategy below.

### 1.8 `getMonthOverMonthCategoryChanges` (lib/dal/overview.ts, line 170)

Two parallel queries (current month + previous month), each using `INNER JOIN nature + direction` (same chain as dashboard.ts). Group by category.id (in/out direction) or nature.id (allocation direction).

**Netting impact:** Both current and previous month queries need secondary exclusion and primary net amount.

### 1.9 `getOverview` (lib/dal/overview.ts, line 112)

Delegates entirely to `getOverviewAmountTotals` (from dashboard.ts) for both current and previous year. Netting applied once in `getOverviewAmountTotals` automatically propagates here — no additional change needed in `getOverview` itself.

---

## 2. The transaction_pair Schema in Drizzle

[VERIFIED: codebase read — follows existing pgTable idiom in lib/db/schema.ts]

```typescript
// lib/db/schema.ts — append after the `transaction` table definition

export const transactionPair = pgTable(
  'transaction_pair',
  {
    id: serial('id').primaryKey(),
    // Symmetric FKs — both reference transaction.id with ON DELETE CASCADE (D-01, D-03)
    // transactionAId is always the PRIMARY (larger |amount|), transactionBId is the SECONDARY.
    // This invariant is enforced in the service layer, not at DB level.
    transactionAId: text('transaction_a_id')
      .notNull()
      .references(() => transaction.id, { onDelete: 'cascade' }),
    transactionBId: text('transaction_b_id')
      .notNull()
      .references(() => transaction.id, { onDelete: 'cascade' }),
    // Audit fields (Claude's Discretion)
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Prevents double-linking: each transaction may appear as A or B in at most one pair (D-02)
    unique('transaction_pair_a_unique').on(table.transactionAId),
    unique('transaction_pair_b_unique').on(table.transactionBId),
    // Lookup indexes for JOIN in aggregation queries (both directions)
    index('transaction_pair_a_idx').on(table.transactionAId),
    index('transaction_pair_b_idx').on(table.transactionBId),
  ],
)

// Relations (append to existing relation exports)
export const transactionPairRelations = relations(transactionPair, ({ one }) => ({
  transactionA: one(transaction, {
    fields: [transactionPair.transactionAId],
    references: [transaction.id],
    relationName: 'primaryTransaction',
  }),
  transactionB: one(transaction, {
    fields: [transactionPair.transactionBId],
    references: [transaction.id],
    relationName: 'secondaryTransaction',
  }),
}))

// Extend transactionRelations to know about pairing:
// (transactionRelations already defined — add 'pairAsA' and 'pairAsB' many() references
// or leave relations-only; the DAL uses explicit JOIN, not Drizzle relations, for aggregation)
```

**Migration:** `yarn db:generate` produces `drizzle/migrations/0020_transaction_pair.sql`. Purely additive. No backfill needed.

**Unique constraint design choice:** Two separate `unique()` constraints on `(transactionAId)` and `(transactionBId)` enforce 1:1 cardinality independently. A transaction cannot be the primary (A) in more than one pair, and cannot be the secondary (B) in more than one pair. This is the minimal expression of D-02. A composite `unique(a, b)` alone would not prevent a transaction from appearing in two different pairs as different sides.

---

## 3. Netting SQL Strategy — Evaluated Options and Recommendation

### The Core Problem

Each aggregation query must:
1. **Exclude the secondary** (B) transaction from its own month/bucket
2. **Replace the primary** (A) transaction's amount with `A.amount + B.amount` (algebraic net)
3. **Keep A in A's own month and direction bucket** — not B's (which may differ)

### Option A — Shared SQL helper fragment (recommended)

Define a reusable Drizzle `sql` expression that:
- Identifies which transactions are "active" (either unpaired, or the primary in a pair)
- Computes the effective amount per active transaction

**Mechanism:** A helper function returns two fragments used in every query:

```typescript
// lib/dal/transaction-pairs-sql.ts  [NEW — shared across dashboard.ts and overview.ts]

import { sql } from 'drizzle-orm'
import { transaction as transactionTable } from '@/lib/db/schema'

/**
 * WHERE clause fragment: exclude transactions that are the SECONDARY (B) in a pair.
 * A secondary is a row where transaction_pair.transaction_b_id = transaction.id exists.
 * Primaries (A) are kept; unpaired rows are kept.
 */
export function isNotSecondary() {
  return sql`NOT EXISTS (
    SELECT 1 FROM transaction_pair tp
    WHERE tp.transaction_b_id = ${transactionTable.id}
  )`
}

/**
 * Amount expression: for primary transactions, return algebraic net (A + B).
 * For unpaired transactions, return own amount unchanged.
 * Usage: replace `${transactionTable.amount}` with effectiveAmount() in SUM() expressions.
 */
export function effectiveAmount() {
  return sql`(
    CASE
      WHEN EXISTS (
        SELECT 1 FROM transaction_pair tp WHERE tp.transaction_a_id = ${transactionTable.id}
      )
      THEN ${transactionTable.amount}::numeric + (
        SELECT t2.amount::numeric
        FROM transaction_pair tp2
        INNER JOIN transaction t2 ON t2.id = tp2.transaction_b_id
        WHERE tp2.transaction_a_id = ${transactionTable.id}
      )
      ELSE ${transactionTable.amount}::numeric
    END
  )`
}
```

**Usage in each aggregation query** (example for `getOverviewAmountTotals`):

```typescript
// Add to WHERE:
isNotSecondary()

// Replace amount references in SUM CASE expressions:
// Before: ${transactionTable.amount}
// After:  effectiveAmount()

// Example:
sql`coalesce(sum(case when ${direction.code} = 'in' then ${effectiveAmount()} else 0 end), 0)::text`
```

**Tradeoffs:**
- Written once, applied identically in all 7 query sites (no drift)
- Correlated subqueries run per row; on small-to-medium datasets (personal finance app) this is fine
- PostgreSQL optimizer typically indexes these to index scans on `transaction_pair_a_idx` and `transaction_pair_b_idx`
- No CTE/view to maintain; no migration needed for the netting logic itself
- Fully consistent with the existing Drizzle `sql` tagged template pattern in the codebase

### Option B — PostgreSQL CTE or View

Create a `pair_resolved` view or WITH clause that materialises each transaction's effective amount and "is secondary" flag. Every query then SELECTs from the view instead of `transaction`.

**Tradeoffs:**
- Requires a migration for the view (or explicit CTE in every query)
- Drizzle does not have first-class CTE/view support that integrates cleanly with the existing builder chain (would require `sql` raw queries or `$with()`)
- The view would duplicate the `transaction → expense → sub_category → nature → direction` join path that already exists in each query, or it would need to remain generic (just amount + is_secondary), reintroducing the JOIN in every query anyway
- **Rejected:** adds migration complexity without meaningful query-plan benefit at this scale

### Option C — TypeScript post-processing

Fetch all raw rows, apply pairing logic in TypeScript, then aggregate.

**Tradeoffs:**
- Impossible to correctly re-attribute a secondary's amount to the primary's month without pulling both rows in full — `getOverviewAmountTotals` returns a single aggregate row, not individual amounts
- Would require completely restructuring the DAL to return row-level data, contradicting the existing aggregate-at-SQL pattern
- **Rejected:** cannot implement month re-attribution without fetching all individual rows

### Recommendation

**Option A — Shared SQL helper fragment.** Two helper functions (`isNotSecondary()` and `effectiveAmount()`) in a new file `lib/dal/transaction-pairs-sql.ts`, imported and applied in the 7 aggregation sites listed above. Consistent with existing Drizzle idioms, zero migration overhead for netting logic, no duplication.

**Performance note:** The `transaction_pair` table will have at most O(user_transactions / 2) rows. On a personal finance app, this is hundreds to low thousands. The correlated subquery on an indexed column is inexpensive. If profiling ever reveals a bottleneck, a LEFT JOIN approach can replace the EXISTS checks without changing the calling API.

---

## 4. Transaction List Integration

### Current `transactionListSelect` (lib/dal/transactions.ts, line 70)

```typescript
export const transactionListSelect = {
  id: transaction.id,
  description: transaction.description,
  customTitle: transaction.customTitle,
  amount: transaction.amount,
  currency: transaction.currency,
  occurredAt: transaction.occurredAt,
  rowIndex: transaction.rowIndex,
  expenseId: expense.id,
  expenseTitle: expense.title,
  expenseStatus: expense.status,
  expenseCategoryName: category.name,
  expenseSubCategoryName: sql<string | null>`coalesce(${userSubcategoryOverride.customName}, ${subCategory.name})`,
  fileId: importFile.id,
  fileName: sql<string | null>`coalesce(nullif(trim(coalesce(${importFile.displayName}, '')), ''), ${importFile.originalName})`,
  importedAt: importFile.importedAt,
  platformId: platform.id,
  platformName: platform.name,
  platformSlug: platform.slug,
  categoryType: direction.code,
}
```

### Current `TransactionListRow` type (line 100)

```typescript
export type TransactionListRow = {
  id: string
  description: string
  customTitle: string | null
  amount: string
  currency: string
  occurredAt: Date
  rowIndex: number
  expenseId: string | null
  expenseTitle: string | null
  expenseStatus: (typeof expense.$inferSelect)['status'] | null
  expenseCategoryName: string | null
  expenseSubCategoryName: string | null
  fileId: string | null
  fileName: string | null
  importedAt: Date | null
  platformId: number | null
  platformName: string | null
  platformSlug: string | null
  categoryType: string | null
}
```

### Required Extensions

Add two fields to `transactionListSelect` and `TransactionListRow`:

```typescript
// Add to transactionListSelect:
pairedWithId: sql<string | null>`(
  SELECT CASE
    WHEN tp.transaction_a_id = ${transaction.id} THEN tp.transaction_b_id
    WHEN tp.transaction_b_id = ${transaction.id} THEN tp.transaction_a_id
  END
  FROM transaction_pair tp
  WHERE tp.transaction_a_id = ${transaction.id}
     OR tp.transaction_b_id = ${transaction.id}
  LIMIT 1
)`,
pairedNetAmount: sql<string | null>`(
  SELECT CASE
    WHEN tp.transaction_a_id = ${transaction.id}
      THEN (${transaction.amount}::numeric + (
        SELECT t2.amount::numeric FROM transaction t2
        WHERE t2.id = tp.transaction_b_id
      ))::text
    WHEN tp.transaction_b_id = ${transaction.id}
      THEN (${transaction.amount}::numeric + (
        SELECT t2.amount::numeric FROM transaction t2
        WHERE t2.id = tp.transaction_a_id
      ))::text
    ELSE NULL
  END
  FROM transaction_pair tp
  WHERE tp.transaction_a_id = ${transaction.id}
     OR tp.transaction_b_id = ${transaction.id}
  LIMIT 1
)`,
```

Add to `TransactionListRow` type:
```typescript
pairedWithId: string | null
pairedNetAmount: string | null
```

**Note:** No LEFT JOIN on `transaction_pair` needed in `getTransactions` since correlated subqueries handle both the paired-with-id lookup and the net computation. This avoids JOIN fan-out issues and keeps `buildTransactionOrderBy` unchanged.

**Counterpart picker DAL** (`lib/dal/transaction-pairs.ts`) needs a separate function:
```typescript
export async function getEligibleCounterparts(
  userId: string,
  referenceAmount: string,
  referenceId: string,
  dateFrom: Date,
  dateTo: Date,
): Promise<CounterpartRow[]>
// Filters: eq(transaction.userId, userId)
//          opposite sign: if referenceAmount < 0 → filter amount > 0 / vice versa
//          date range: gte/lte(occurredAt)
//          not already paired: NOT EXISTS (SELECT 1 FROM transaction_pair WHERE ...)
//          not the initiating transaction itself: ne(transaction.id, referenceId)
// Returns: id, description, customTitle, amount, occurredAt, direction code
```

---

## 5. UX Wiring

### 5.1 Row Action Dropdown (`components/transactions/transaction-table.tsx`)

Current structure (line 437–495):
```tsx
<DropdownMenuContent align="end">
  {isCategorized ? (
    <DropdownMenuItem>Ricategorizza</DropdownMenuItem>
  ) : (
    <>
      <DropdownMenuItem asChild>Cerca su Google</DropdownMenuItem>
      {transaction.expenseId && expenseStatus === '1' && (
        <DropdownMenuItem>Categorizza spesa</DropdownMenuItem>
      )}
    </>
  )}
  <DropdownMenuSeparator />
  <DeleteTransactionMenuItem ... />
</DropdownMenuContent>
```

**Add before `<DropdownMenuSeparator />`:**
```tsx
{transaction.pairedWithId ? (
  <DropdownMenuItem onSelect={() => onUnpair(transaction.id)}>
    Scollega  {/* D-11 */}
  </DropdownMenuItem>
) : (
  <DropdownMenuItem onSelect={() => onLinkRefund(transaction.id, transaction.amount)}>
    Collega rimborso  {/* D-09 */}
  </DropdownMenuItem>
)}
```

`TransactionTable` props extend with:
```typescript
onLinkRefund: (transactionId: string, amount: string) => void
onUnpair: (transactionId: string) => void
```

### 5.2 Pair Badge in the Row (D-15, D-16)

In the `TransactionTable` row render (currently `<TableCell>` for the description column), add after the `TransactionTitleEdit` component:

```tsx
{transaction.pairedWithId && transaction.pairedNetAmount && (
  <TransactionPairBadge
    pairedWithId={transaction.pairedWithId}
    netAmount={transaction.pairedNetAmount}
    currency={transaction.currency}
    // Popover data: loaded from the already-fetched counterpart in TransactionListRow
    // or passed via a separate onFetchCounterpart callback
  />
)}
```

**Design:** The badge shows `<Link2 icon> {formattedNet}`. Clicking opens a Radix `Popover` showing counterpart description, amount, date, net effect, and a "Vai alla transazione" link (anchor with `href={APP_ROUTES.transactions}?q={counterpartId}`).

The counterpart details needed for the popover (description, date, amount) are NOT in the current `TransactionListRow`. Two options:
- **Option 1 (recommended):** Extend `transactionListSelect` with additional correlated subqueries for `pairedDescription`, `pairedAmount`, `pairedOccurredAt`. This adds 3 more correlated subselects but avoids a round-trip.
- **Option 2:** Fetch counterpart on popover open via a `getTransactionById` DAL call.

**Recommendation to planner:** Option 1 (extend select) — all data needed for the popover is available in the SQL context. Add `pairedDescription`, `pairedOccurredAt` alongside `pairedWithId` and `pairedNetAmount`. The popover amount is simply the counterpart's raw amount (not the net), shown for context.

### 5.3 `CounterpartPickerDialog` (new component)

Mirrors `TransactionFormDialog` pattern:
- `Dialog` (shadcn/ui) with `open`/`onOpenChange` props
- `Input` search field (ilike filter on description/customTitle)
- Date range: `Input type="date"` for from/to (default ±90 days from initiating transaction's `occurredAt`)
- Scrollable list of eligible counterparts (fetched server-side or via server action)
- On confirm: calls `createTransactionPairAction(transactionId, counterpartId)`

The counterpart list can be fetched via a Server Action (`loadEligibleCounterparts`) that calls `getEligibleCounterparts` DAL, similar to `loadMoreTransactions`.

### 5.4 `app/(app)/transactions/page.tsx` Wiring

The page is a Server Component (RSC). Dialog state must be managed client-side. Pattern follows the existing `categorizeTarget` state in `TransactionTable`:

```tsx
// TransactionTable already manages:
const [categorizeTarget, setCategorizeTarget] = useState<{id: string; title: string} | null>(null)

// Extend with:
const [pairTarget, setPairTarget] = useState<{id: string; amount: string} | null>(null)
```

The `CounterpartPickerDialog` renders alongside `ExpenseCategorizeDialog` inside `TransactionTable` — it needs no new RSC data since counterpart lookup is performed lazily on dialog open.

---

## 6. Server Action Ownership Validation

### Existing Pattern (lib/actions/transactions.ts)

```typescript
'use server'

export async function deleteTransaction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = DeleteTransactionSchema.safeParse({ id: formData.get('id') })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Transazione non valida.' }
  const { userId } = await verifySession()   // ← session check always first
  try {
    const result = await deleteTransactionsAndReconcileExpenses({ userId, transactionIds: [parsed.data.id] })
    if (result.deletedTransactionIds.length === 0) return { error: 'Transazione non trovata o già eliminata.' }
  } catch { return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' } }
  revalidateCategorizationSurfaces()
  return { error: null }
}
```

### New `lib/actions/transaction-pairs.ts`

```typescript
'use server'
import { verifySession } from '@/lib/dal/auth'
import { CreatePairSchema, DeletePairSchema } from '@/lib/validations/transaction-pairs'
import { createPair, deletePairByTransactionId } from '@/lib/services/transaction-pairs'
import type { ActionState } from '@/lib/validations/expense'
import { revalidatePath } from 'next/cache'

export async function createTransactionPairAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = CreatePairSchema.safeParse({
    transactionId: formData.get('transactionId'),
    counterpartId: formData.get('counterpartId'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { userId } = await verifySession()   // ← always first
  try {
    await createPair({ userId, transactionId: parsed.data.transactionId, counterpartId: parsed.data.counterpartId })
  } catch (err) {
    if (err instanceof Error) return { error: err.message }
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }
  revalidatePath('/transactions')
  revalidatePath('/overview')  // dashboard surfaces
  return { error: null }
}

export async function deleteTransactionPairAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = DeletePairSchema.safeParse({ transactionId: formData.get('transactionId') })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { userId } = await verifySession()
  try {
    await deletePairByTransactionId({ userId, transactionId: parsed.data.transactionId })
  } catch { return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' } }
  revalidatePath('/transactions')
  revalidatePath('/overview')
  return { error: null }
}
```

### `lib/services/transaction-pairs.ts`

```typescript
import { db } from '@/lib/db'
import { transaction, transactionPair } from '@/lib/db/schema'
import { and, eq, or } from 'drizzle-orm'
import { toDecimal } from '@/lib/utils/decimal'

export async function createPair(input: {
  userId: string
  transactionId: string
  counterpartId: string
}): Promise<void> {
  // 1. Load both transactions, verify both belong to userId
  const [txA, txB] = await Promise.all([
    db.select({ id: transaction.id, amount: transaction.amount, occurredAt: transaction.occurredAt, userId: transaction.userId })
      .from(transaction).where(eq(transaction.id, input.transactionId)).limit(1),
    db.select({ id: transaction.id, amount: transaction.amount, occurredAt: transaction.occurredAt, userId: transaction.userId })
      .from(transaction).where(eq(transaction.id, input.counterpartId)).limit(1),
  ])
  const t1 = txA[0], t2 = txB[0]
  if (!t1 || !t2) throw new Error('Transazione non trovata.')
  if (t1.userId !== input.userId || t2.userId !== input.userId)
    throw new Error('Non sei autorizzato a collegare queste transazioni.')

  // 2. Determine primary (D-05, D-10): larger |amount| = primary; ties → earlier occurredAt
  const abs1 = toDecimal(t1.amount).abs()
  const abs2 = toDecimal(t2.amount).abs()
  let primaryId: string, secondaryId: string
  if (abs1.gt(abs2)) { primaryId = t1.id; secondaryId = t2.id }
  else if (abs2.gt(abs1)) { primaryId = t2.id; secondaryId = t1.id }
  else {
    // Equal amounts: earlier occurredAt = primary
    primaryId = new Date(t1.occurredAt) <= new Date(t2.occurredAt) ? t1.id : t2.id
    secondaryId = primaryId === t1.id ? t2.id : t1.id
  }

  // 3. Insert pair (unique constraints prevent double-linking)
  await db.insert(transactionPair).values({
    transactionAId: primaryId,
    transactionBId: secondaryId,
  })
}

export async function deletePairByTransactionId(input: {
  userId: string
  transactionId: string
}): Promise<void> {
  // Verify the transaction belongs to userId before deleting
  const tx = await db.select({ userId: transaction.userId })
    .from(transaction).where(eq(transaction.id, input.transactionId)).limit(1)
  if (!tx[0] || tx[0].userId !== input.userId)
    throw new Error('Non sei autorizzato a scollegare questa transazione.')
  // Delete pair where this transaction appears on either side
  await db.delete(transactionPair).where(
    or(
      eq(transactionPair.transactionAId, input.transactionId),
      eq(transactionPair.transactionBId, input.transactionId),
    )
  )
}
```

**Key point (D-01):** userId is NOT on `transaction_pair`. The service layer validates ownership by querying `transaction` with the session userId before any insert or delete. This is the correct pattern per the CONTEXT.md integration note.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Popover for pair details | Custom positioned div | shadcn/ui `Popover` (Radix UI) | Handles focus management, accessibility, z-index stacking — already in project |
| Net amount arithmetic | Native `+` operator on strings | `toDecimal(a).plus(toDecimal(b)).toFixed(2)` | Project hard rule: all money arithmetic via Decimal.js |
| SQL netting logic per query | 7 separate inline CASE expressions | Shared `isNotSecondary()` + `effectiveAmount()` helpers | Drift prevention across 7 sites |
| Ownership check at DB level | `userId` FK on `transaction_pair` | Service-layer query before insert/delete | The transaction table already carries userId; double-join in DB adds no real security and complicates the schema |
| Dialog from scratch for picker | Custom modal | shadcn/ui `Dialog` (same as `TransactionFormDialog`) | Already the project standard |

---

## Common Pitfalls

### Pitfall 1: Secondary transaction bleeds into aggregation

**What goes wrong:** Adding only `isNotSecondary()` to the WHERE but failing to replace the amount expression with `effectiveAmount()` in the primary row. Result: secondary is excluded (correct) but primary contributes its raw amount (not the net), so the refunded portion appears as full expense.

**How to avoid:** Always apply both helpers together — treat them as a pair that must be deployed together at each query site.

**Warning signs:** Tests show `totalOut` equals full primary amount when a pair exists, not `primary.amount + secondary.amount`.

### Pitfall 2: Month re-attribution ignored

**What goes wrong:** The secondary's amount is simply excluded from the secondary's month, but the primary receives no adjustment. Net is wrong: primary's month shows full primary.amount instead of `primary.amount + secondary.amount`.

**Root cause:** Only `isNotSecondary()` applied without `effectiveAmount()` on the primary.

**How to avoid:** `effectiveAmount()` in the SUM expression returns the netted value for primaries. Both helpers must be applied.

### Pitfall 3: Double-counting in `getOverview` (overview.ts)

**What goes wrong:** `getOverview` calls `getOverviewAmountTotals` (dashboard.ts) — if the netting is applied in `getOverviewAmountTotals`, `getOverview` picks it up automatically. But `getOverviewChart` (also in overview.ts) uses a different JOIN idiom (correlated subselects for nature/direction) — the same `isNotSecondary()` WHERE fragment still applies identically; only `effectiveAmount()` needs adapting for the different column reference.

**How to avoid:** Verify `isNotSecondary()` references `${transactionTable.id}` consistently — the Drizzle `sql` fragment uses the imported table alias, which is correct in both files.

### Pitfall 4: `react.cache` scoping with pair state

**What goes wrong:** `getTransactions` is wrapped in `react.cache`. If the pair badge data is computed via a separate call, the cache may return stale data (before pairing) in the same request.

**How to avoid:** Add `pairedWithId` and `pairedNetAmount` directly to `transactionListSelect` (correlated subqueries). Both fields are computed in the same cached query — no separate cache-busting needed. Revalidation via `revalidatePath` on pair create/delete handles cross-request staleness.

### Pitfall 5: Picker showing already-paired transactions

**What goes wrong:** `getEligibleCounterparts` omits the "not already paired" filter. User links a transaction to one that's already in another pair, creating orphaned pairs or violating the unique constraint (which surfaces as a DB error in production).

**How to avoid:** The unique constraint on `transactionAId` and `transactionBId` prevents DB insertion. But the UX should pre-filter: `NOT EXISTS (SELECT 1 FROM transaction_pair WHERE tp.transaction_a_id = t.id OR tp.transaction_b_id = t.id)` in the picker DAL query (D-14). Unique constraint is a safety net, not the first line of defense.

### Pitfall 6: ON DELETE CASCADE race condition

**What goes wrong:** User deletes a paired primary transaction. Cascade removes `transaction_pair` row. The secondary is now unpaired — correct per D-03. But if the dashboard is cached (react.cache within a request) and both primary and secondary were fetched before the delete, stale data shows the secondary still paired.

**How to avoid:** The cascade fires synchronously in PostgreSQL during the DELETE. `revalidatePath` in `deleteTransaction` action already busts the Next.js cache. The race only affects concurrent requests, which is acceptable for a personal finance app.

---

## Runtime State Inventory

> Greenfield phase (new table, no rename/refactor). Standard inventory not required.

**Nothing found:** This phase adds a new `transaction_pair` table only. No stored data, live service config, OS-registered state, secrets, or build artifacts carry pairing metadata at this point (no pairs exist yet).

---

## Environment Availability

> Phase is code/schema-only. No new external dependencies.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | transaction_pair schema | ✓ | existing | — |
| drizzle-kit | `yarn db:generate` | ✓ | existing | — |
| Vitest | Test suite | ✓ | existing | — |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (vitest.config.ts) |
| Config file | `vitest.config.ts` |
| Quick run command | `yarn test` (runs all tests via `vitest run`) |
| Full suite command | `yarn test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAIR-01 | `createPair` validates userId ownership on both transactions | unit | `yarn test tests/transaction-pairs-service.test.ts` | ❌ Wave 0 |
| PAIR-01 | `createPair` correctly determines primary by |amount| (and tie-break by date) | unit | `yarn test tests/transaction-pairs-service.test.ts` | ❌ Wave 0 |
| PAIR-01 | `createPair` throws if transaction already paired (unique constraint / service guard) | unit | `yarn test tests/transaction-pairs-service.test.ts` | ❌ Wave 0 |
| PAIR-01 | `deletePairByTransactionId` removes pair and validates ownership | unit | `yarn test tests/transaction-pairs-service.test.ts` | ❌ Wave 0 |
| PAIR-02 | `transactionListSelect` / `TransactionListRow` includes `pairedWithId` + `pairedNetAmount` fields | unit | `yarn test tests/transactions-dal.test.ts` | ✅ extend existing |
| PAIR-02 | `pairedNetAmount` = primary.amount + secondary.amount (signed Decimal arithmetic) | unit | `yarn test tests/transaction-pairs-service.test.ts` | ❌ Wave 0 |
| PAIR-03 | `buildOverviewData` netting: paired secondary excluded; net in primary's direction | unit | `yarn test tests/dashboard-dal.test.ts` | ✅ extend existing |
| PAIR-03 | `getOverviewAmountTotals` with pair: totalOut reflects net, not sum of both | integration-style unit | `yarn test tests/dashboard-dal.test.ts` | ✅ extend existing |
| PAIR-03 | After unlink (`deletePairByTransactionId`), both transactions aggregated independently | unit | `yarn test tests/transaction-pairs-service.test.ts` | ❌ Wave 0 |
| PAIR-03 | Unpaired transactions unaffected (algebraic-sum baseline from ADR 0004 unchanged) | regression | `yarn test tests/dashboard-dal.test.ts` | ✅ existing |

### Testing Pattern (from existing tests)

```typescript
// Pattern from tests/dashboard-dal.test.ts — mock DAL dependencies, test builder functions:
vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/dal/auth', () => ({ verifySession: vi.fn() }))

// Test the pure builder functions (buildOverviewData, buildBreakdownData) with injected rows.
// Netting helper functions (isNotSecondary, effectiveAmount) are pure SQL fragment factories —
// test their output strings match expected SQL.
```

For service-layer tests (`transaction-pairs-service.test.ts`), mock `db.select` and `db.insert` similar to `tests/expense-actions.test.ts` pattern, injecting controlled transaction row fixtures.

### Sampling Rate

- **Per task commit:** `yarn test` (full suite — ~50 test files, sub-30s)
- **Per wave merge:** `yarn test` (same — suite is fast enough to run every commit)
- **Phase gate:** Full suite green + `yarn build` green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/transaction-pairs-service.test.ts` — covers PAIR-01, createPair + deletePair unit tests
- [ ] `tests/transaction-pairs-dal.test.ts` — covers getEligibleCounterparts filter logic
- [ ] Extend `tests/dashboard-dal.test.ts` — add netting scenarios to existing `buildOverviewData` tests
- [ ] Extend `tests/transactions-dal.test.ts` — verify `pairedWithId`/`pairedNetAmount` in select shape

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a (Better Auth handles sessions) |
| V3 Session Management | no | n/a (verifySession pattern, unchanged) |
| V4 Access Control | **yes** | verifySession() in every server action; service layer validates both tx.userId == sessionUserId before pair insert/delete |
| V5 Input Validation | **yes** | Zod `CreatePairSchema` / `DeletePairSchema` in actions; IDs validated as non-empty strings |
| V6 Cryptography | no | No new secrets or crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR — linking another user's transaction | Tampering | Service queries `transaction.userId` for both IDs before insert; throws if mismatch |
| Double-linking a transaction | Tampering | Unique constraint on `(transactionAId)` and `(transactionBId)` at DB level; also pre-filtered in picker DAL |
| Cross-user pair (both FKs to different users) | Tampering | Service validates both userId values against session before insert |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sign-split totals (`sum(amount>0)` / `abs(sum(amount<0))`) | Algebraic sum by direction group | Phase 49 (ADR 0004 extended by ADR 0012) | The `effectiveAmount()` helper fits naturally into the existing algebraic-sum pattern |
| `category.type` for direction | `direction.code` derived via `nature → direction` FK chain | Phase 49 | All existing queries already use the `direction` join; pairing netting uses the same join |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `transaction_pair` table has no `userId` column; ownership enforced in service layer only | §Schema, §Action pattern | If DB needs its own enforcement, a check constraint `(SELECT userId FROM transaction WHERE id = a_id) = (SELECT userId FROM transaction WHERE id = b_id)` could be added but is non-standard Drizzle | 
| A2 | Correlated subqueries for `isNotSecondary()` and `effectiveAmount()` are performant at personal-finance dataset sizes | §Netting Strategy | If query plans show seq-scans, replace with explicit LEFT JOIN; the calling API is identical | 

**If this table is empty:** No — two low-risk assumptions remain. Both are validated by the design intent (A1) and by scale context (A2).

---

## Open Questions

1. **Badge net amount sign convention**
   - What we know: D-15 says badge shows "🔗 €-50" (perspective of the current row's transaction)
   - What's unclear: For the primary row (e.g., dinner €-100), the net from its perspective is -50 (the refund reduced the cost). For the secondary row (refund €+50), the net from its perspective is... 0? Or should both rows show the same net?
   - Recommendation: Show the same signed net value on both rows: the algebraic net of `primary.amount + secondary.amount` (e.g., "€-50"). This is unambiguous and consistent.

2. **`getOverviewChart` adaptation**
   - What we know: `getOverviewChart` uses correlated subqueries for nature/direction instead of explicit JOINs to `nature` and `direction` tables.
   - What's unclear: Whether `isNotSecondary()` — which references `${transactionTable.id}` — resolves correctly in the `getOverviewChart` query context.
   - Recommendation: Confirm `transactionTable` alias import is consistent across both files; it is (both import as `transaction as transactionTable`). The `sql` fragment should resolve identically.

3. **topTransactions in `getCategoryDetail` — show paired transactions?**
   - What we know: `getCategoryDetail` returns top 5 transactions by absolute amount.
   - What's unclear: Should secondary (refund) transactions appear in the top-5 list, or should they be excluded?
   - Recommendation: Exclude secondaries (apply `isNotSecondary()` to the topTransactions sub-query) and show primary's netted amount. Seeing a €-50 net is more useful than seeing a €-100 original that's half-refunded.

---

## Sources

### Primary (HIGH confidence)
- `lib/dal/dashboard.ts` — all aggregation functions read directly [VERIFIED: codebase read]
- `lib/dal/overview.ts` — `getOverview`, `getOverviewChart`, `getMonthOverMonthCategoryChanges` [VERIFIED: codebase read]
- `lib/dal/transactions.ts` — `getTransactions`, `transactionListSelect`, `TransactionListRow` [VERIFIED: codebase read]
- `lib/db/schema.ts` — `transaction` table + all existing table definitions + relations [VERIFIED: codebase read]
- `components/transactions/transaction-table.tsx` — `TransactionTable` + row action dropdown [VERIFIED: codebase read]
- `lib/actions/transactions.ts` — server action pattern (verifySession + Zod + DAL) [VERIFIED: codebase read]
- `lib/dal/auth.ts` — `verifySession` cache + session pattern [VERIFIED: codebase read]
- `components/transactions/transaction-form-dialog.tsx` — dialog pattern to mirror for picker [VERIFIED: codebase read]
- `app/(app)/transactions/page.tsx` — RSC page wiring pattern [VERIFIED: codebase read]
- `.planning/phases/50-transaction-pairing/50-CONTEXT.md` — design contract [VERIFIED: codebase read]

### Secondary (MEDIUM confidence)
- `docs/adr/0004-nature-segments-algebraic-sum.md` — algebraic-sum baseline behaviour [VERIFIED: codebase read]
- `tests/dashboard-dal.test.ts` — test mock pattern for DAL modules [VERIFIED: codebase read]
- `vitest.config.ts` — test configuration [VERIFIED: codebase read]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all existing, verified in codebase
- Architecture: HIGH — all code paths read directly from source files
- Netting strategy: HIGH — SQL fragment approach derived from reading all 7 aggregation sites; PostgreSQL correlated subquery pattern is standard
- Pitfalls: HIGH — derived from real query structure analysis

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 (30 days; stable stack)
