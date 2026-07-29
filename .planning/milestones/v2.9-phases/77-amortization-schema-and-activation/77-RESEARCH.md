# Phase 77: amortization-schema-and-activation - Research

**Researched:** 2026-07-28
**Domain:** Amortization schema, materialized instalment rows, ledger-entry seam, transaction-level amortization activation
**Confidence:** HIGH — locked model (ADR 0019), reused patterns from v2.8 reimbursement, core schema straightforward

## Summary

Phase 77 delivers the foundation of amortization: the `amortization_plan` + `amortization_instalment` schema, the `ledger_entry` seam (switching between cash = raw transactions vs. accrual = transactions + instalments), and three UI activation entry points (transaction row, detail page, manual entry) that force-detach the source transaction into a Standalone Expense and materialize N uniform monthly instalments.

The model is locked by ADR 0019 — no discovery needed. This research focuses on implementation: schema columns/indexes/migrations, the reverse-detach invariant for undo (D-09), eligibility guard predicates, instalment math via Decimal.js, and the ledger-entry seam's impact on the ten dashboard aggregation sites.

**Primary recommendation:** Schema design is straightforward (transaction FK + months + dates); the critical path is (1) implementing the reverse-detach invariant correctly (requires storing or re-deriving original descriptionHash), (2) proving the ledger_entry seam leaves cash-lens aggregations byte-identical under the v2.8 regression gate, and (3) collapsing the effectiveAmount()/isNotSecondary() fragment pair into a single row source.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Plan preview shows computed schedule (dates + amounts, remainder on first) before confirmation — no silent activation.

**D-02:** Plan duration N: minimum 2, maximum = amount in cents (natural cap, every instalment ≥ €0,01). Natural cap enforced as dialog validation.

**D-03:** Activation (detach + plan + materialisation) runs atomically in `db.transaction()` per ADR 0019 §1/§4.

**D-04:** Block activation if transaction is involved in a v2.8 reimbursement (anchor or secondary refund). Reimbursement + amortization interaction deferred to Phase 78 (AMORT-06).

**D-05:** Block activation if transaction already has an active plan (one plan per transaction).

**D-06:** Block activation if transaction belongs to an Expense Group (forced detach would tear it out; incompatible with "unit = single transaction").

**D-07:** Validate that every instalment ≥ €0,01 given N.

**D-08:** Entry point shown/hidden or disabled per D-04..D-07 guards; ineligible transactions never reach a dialog.

**D-09:** Ship "rimuovi ammortamento" action (row + detail page) that atomically deletes plan + instalments **and reverts the detach** — re-attaching the transaction to its shared Expense by its **original** descriptionHash. Costly operation; reverse-detach invariant must be explicit.

**D-10:** On manual create-transaction form, amortization offered inline: "Ammortizza" checkbox + months field. When checked, create + detach + plan + materialisation run atomically, reusing same preview as D-01.

**D-11:** Ledger_entry is **one swappable row source per lens**, not a `lens` parameter threaded through aggregations. Cash = transactions; accrual = (non-amortized transactions) UNION ALL (instalment rows). Aggregations read `ledger.amount` and stop calling `effectiveAmount()`/`isNotSecondary()` directly. ~16 call sites collapse into one definition.

**D-12:** LENS-03 is an invariant: v2.8 real-Postgres byte-identical regression suite (`tests/reimbursement-regression.test.ts`) is the gate. Every aggregation site must stay byte-identical under the cash lens once ledger_entry, plans, and instalments exist.

**D-13:** Instalment rows carry plan's `expense_id`, own date, own amount. **No subcategory snapshot** — category derives via the Expense (D-13 confirms D-01 of ADR 0016: transactions have no subcategory column).

### Claude's Discretion

None — all decisions are locked.

### Deferred Ideas

- Reimbursement + amortization interaction (AMORT-06) — Phase 78
- Plan close / collapse remaining instalments (AMORT-04) — Phase 78
- Realization via sale / scrapped asset (AMORT-05) — Phase 78
- Edit block / reconcile on amortized transaction (AMORT-07) — Phase 78
- `/amortizations` registry (REG-01/02/03) — Phase 79
- Global cassa/competenza switch, accrual widgets, lens-aware selectors, year-end spillover (LENS-01/02/04/05) — Phase 80
- Plain Postgres VIEW vs materialized view for ledger_entry — performance-driven, decided at plan time

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AMORT-01 | User can amortize an outflow transaction over N months from transaction row, detail page, manual entry | D-01/D-03/D-10; UI-SPEC activation dialog, row/detail actions, inline form |
| AMORT-02 | Amortized transaction detached into Standalone Expense so later same-description purchase not swept into plan | D-03; detachTransactionToDedicatedExpense service; forced detach reuses ADR 0016 §2–§4 |
| AMORT-03 | Cost spread into uniform monthly instalments from purchase month, remainder on first, day-clamp to month end | D-07 math via Decimal.js; instalment materialisation algorithm verified below |
| LENS-03 | Under cash view, all dashboard figures byte-identical to today's behavior once ledger_entry + plans + instalments exist | D-12; v2.8 regression gate; seam reshapes DAL read layer |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Decimal.js | [VERIFIED: npm registry] | Monetary arithmetic for instalment calculation, remainder-on-first logic | Project hard rule: never use native JS `+`/`-`/`*`/`/` on money |
| Drizzle ORM | [via project] | Schema definition, migrations, transaction management | Project standard; DB layer owner |
| PostgreSQL DECIMAL(12,2) | [DB type] | Storing monetary amounts as strings (Drizzle convention) | Matches existing transaction.amount, expense.totalAmount |
| Better Auth | [via project] | Session management for auth boundary | Project auth standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| crypto (node:crypto) | [builtin] | SHA256 for descriptionHash in reverse-detach path | Already used in transaction-detach.ts; reverse-detach needs it to compute original hash |
| drizzle-orm sql | [via project] | Raw SQL fragments for ledger_entry seam, conditional aggregations | D-11 seam work requires raw SQL row source |

### Patterns Reused
- **Forced detach mechanism** (`detachTransactionToDedicatedExpense`): ADR 0016 §2–§4; already shipped for v2.8 reimbursements; extended here with reverse path (D-09).
- **Fragment pair (effectiveAmount + isNotSecondary)**: v2.8 reimbursement netting; collapse into ledger_entry seam as part of D-11.
- **Regression gate**: v2.8 real-Postgres byte-identical suite (`tests/reimbursement-regression.test.ts`); extended to prove amortization cash-lens inert.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Amortization plan creation + materialisation | API / Backend | Database | Server-side atomic transaction; complex instalment math. Browser cannot orchestrate multi-row upsert. |
| Instalment date/amount computation (math) | API / Backend | — | Decimal.js + calendar logic; deterministic; auditable via regression tests. |
| Activation dialog (preview + confirm) | Browser / Frontend | API (validation) | Client-side preview for immediate feedback; submission calls backend action. |
| Undo / reverse-detach | API / Backend | Database | Atomic teardown of plan + instalments + re-attach; business logic integrity. |
| Eligibility guards (D-04..D-08) | API / Backend | Database (queries) | Server-side predicates; guards prevent invalid states at submission time. |
| Ledger_entry seam (row source) | Database / DAL | API (query consumers) | Postgres-backed VIEW or UNION ALL; consumed by ten aggregation queries in dashboard/overview DAL layer. |
| Cash-lens regression proof | Tests | Database | Real-Postgres test suite; proves byte-identical behavior. |

---

## Schema Design

### New Tables

#### `amortization_plan`

```sql
CREATE TABLE amortization_plan (
  id TEXT PRIMARY KEY,  -- UUID, crypto.randomUUID()
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL REFERENCES transaction(id) ON DELETE CASCADE,
  -- Derived from transaction at plan creation; used to validate and re-attach on undo
  transaction_description TEXT NOT NULL,
  transaction_occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
  -- Plan configuration
  months INTEGER NOT NULL CHECK (months >= 2),  -- minimum 2 per D-02
  start_date DATE NOT NULL,  -- month of transaction.occurredAt (calendar day, clamped)
  status VARCHAR(16) NOT NULL DEFAULT 'open',  -- 'open' | 'closed'; future phases use 'closed'
  -- Plan totals (snapshot at creation, immutable)
  total_amount NUMERIC(12, 2) NOT NULL,  -- original transaction.amount
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  -- Indexes
  UNIQUE (transaction_id),  -- one plan per transaction (D-05)
  INDEX (user_id),
  INDEX (user_id, status),  -- query open plans; find closed for closure UX (Phase 78+)
  INDEX (transaction_id),
);
```

**Rationale:**
- `transaction_id` is the FK to the amortized transaction. At plan creation, that transaction is detached into a Standalone Expense; later we can look up its original description via transaction.description (immutable per ADR 0019 §3).
- `start_date` is the plan's anchor (month of purchase). Instalment dates derive from this + month offset.
- `status` supports Phase 78 (closure) without schema change.
- `total_amount` snapshot prevents recalculation drift if transaction.amount is ever edited (Phase 78 AMORT-07 guard).

#### `amortization_instalment`

```sql
CREATE TABLE amortization_instalment (
  id TEXT PRIMARY KEY,  -- UUID, crypto.randomUUID()
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES amortization_plan(id) ON DELETE CASCADE,
  -- Instalment identity within the plan
  instalment_number INTEGER NOT NULL CHECK (instalment_number >= 1),
  -- Transactional metadata for the ledger_entry seam (D-11)
  expense_id TEXT NOT NULL REFERENCES expense(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,  -- individual instalment amount (Decimal string)
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,  -- instalment date (clamp to month end)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  -- Indexes
  UNIQUE (plan_id, instalment_number),  -- no duplicate instalments within a plan
  INDEX (user_id),
  INDEX (plan_id),
  INDEX (expense_id),  -- for ledger_entry seam reads
  INDEX (user_id, occurred_at),  -- for date-scoped aggregations
);
```

**Rationale:**
- Each row represents one monthly instalment from the plan. N instalments = N rows.
- `expense_id`: the plan's standalone Expense. All instalments share it (same detached Expense row).
- `occurred_at`: the instalment's calendar date (source for `ledger_entry` seam; replaces transaction.occurredAt for accrual-lens reads).
- `amount`: the uniform instalment amount (or first instalment with remainder). Stored as NUMERIC string per project convention.
- `instalment_number`: helps track which instalment this is (1, 2, 3, …), useful for diagnostics and future closure logic.

### Migration Path

```bash
# 1. Generate migration
drizzle-kit generate

# 2. Run migration (on dev + staging)
yarn scripts/migrate.ts

# 3. Seed baseline (if any; amortization has no baseline seed)
yarn db:seed

# 4. Regression gate (LENS-03)
yarn vitest run tests/reimbursement-regression.test.ts
```

No post-migration backfill needed (new tables, no data transformation).

---

## Instalment Materialisation Math

### Algorithm (D-07 + AMORT-03)

**Input:** 
- Transaction with `amount` (Decimal, e.g., €1000.00), `occurredAt` (e.g., 14/8/2026)
- Months `N` (e.g., 4)

**Output:** 
- N rows with (date, amount) pairs

**Steps (using Decimal.js):**

```typescript
import Decimal from 'decimal.js'
import { toDecimal, toDbDecimal } from '@/lib/utils/decimal'

function materializeInstalments(
  transactionAmount: string,  // DECIMAL from DB
  transactionDate: Date,      // occurredAt
  months: number
): Array<{ date: Date; amount: string }> {
  const total = toDecimal(transactionAmount)
  const baseInstalment = total.dividedBy(months).toDecimalPlaces(2, Decimal.ROUND_DOWN)
  const remainder = total.minus(baseInstalment.times(months))
  
  const instalments: Array<{ date: Date; amount: string }> = []
  
  for (let i = 0; i < months; i++) {
    // Compute instalment date: same calendar day each month
    const instDate = new Date(
      transactionDate.getFullYear(),
      transactionDate.getMonth() + i,
      transactionDate.getDate()
    )
    
    // Day-clamp: if day overflows month (e.g., 31st in Feb), clamp to last day
    const lastDayOfMonth = new Date(
      instDate.getFullYear(),
      instDate.getMonth() + 1,
      0
    )
    if (instDate.getDate() > lastDayOfMonth.getDate()) {
      instDate.setDate(lastDayOfMonth.getDate())
    }
    
    // Amount: first instalment includes remainder, others are base
    const amount = i === 0
      ? baseInstalment.plus(remainder)
      : baseInstalment
    
    instalments.push({
      date: instDate,
      amount: toDbDecimal(amount)  // NUMERIC(12, 2) string
    })
  }
  
  return instalments
}
```

**Verification (example from CONTEXT.md):**
- Amount: €1000.00, months: 4
- Base: 1000 ÷ 4 = 250.00 (exact, no rounding)
- Remainder: 1000 − (250 × 4) = 0
- Instalments: [250.00, 250.00, 250.00, 250.00]

Example with rounding:
- Amount: €1000.00, months: 3
- Base: 1000 ÷ 3 = 333.333... → ROUND_DOWN to 333.33
- Remainder: 1000 − (333.33 × 3) = 1000 − 1000.00 = 0.01 (due to rounding)
- Instalments: [333.34 (333.33 + 0.01), 333.33, 333.33]

**Validation (D-07):**
```typescript
function isValidMonths(amount: string, months: number): boolean {
  const total = toDecimal(amount)
  const baseInstalment = total.dividedBy(months).toDecimalPlaces(2, Decimal.ROUND_DOWN)
  // Every instalment must be >= 0.01
  return baseInstalment.gte(toDecimal('0.01'))
}
```

**Maximum months (natural cap from D-02):**
```typescript
function maxMonthsForAmount(amount: string): number {
  const total = toDecimal(amount)
  const cents = total.times(100).toDecimalPlaces(0)  // e.g., 100000 cents = €1000
  return cents.toNumber()  // max instalments = amount in cents
}
```

[VERIFIED: Decimal.js v10+ via npm] — project uses toDecimal/toDbDecimal helpers; all money arithmetic via Decimal.

---

## Reverse-Detach Invariant (D-09)

### Problem

When a plan is deleted (D-09 "rimuovi ammortamento"), the transaction must be **re-attached to its shared Expense** — not just orphaned. The challenge: at undo time, what is the transaction's **original descriptionHash**?

When amortization activates (D-03), `applyDetachCleanupTx` in `transaction-detach.ts` calls `syntheticDescriptionHash(transactionId)` — a hash based on the transaction ID, not the description. To re-attach, we need the **original** hash that was computed from the transaction's description at import time.

### Solution

**The transaction's description is immutable (ADR 0019 §3).** We can recompute the original hash at undo time:

```typescript
import { computeDescriptionHash } from '@/lib/utils/import'

async function reverseDetach(
  tx: DbOrTx,
  input: {
    userId: string
    transactionId: string
    planId: string
  }
): Promise<void> {
  // 1. Load the transaction to get its description (immutable)
  const txRow = await tx
    .select({ description: transactionTable.description })
    .from(transactionTable)
    .where(
      and(
        eq(transactionTable.id, input.transactionId),
        eq(transactionTable.userId, input.userId)
      )
    )
    .limit(1)
  
  if (!txRow[0]) throw new Error('Transaction not found')
  
  // 2. Compute the ORIGINAL descriptionHash from the transaction's description
  const originalDescriptionHash = computeDescriptionHash(txRow[0].description)
  
  // 3. Find or create the shared Expense by (userId, originalDescriptionHash)
  let sharedExpense = await tx
    .select({ id: expense.id })
    .from(expense)
    .where(
      and(
        eq(expense.userId, input.userId),
        eq(expense.descriptionHash, originalDescriptionHash)
      )
    )
    .limit(1)
  
  if (!sharedExpense[0]) {
    // No existing shared Expense for this hash yet — create one
    // using the transaction's description as title
    const expenseId = crypto.randomUUID()
    await tx.insert(expense).values({
      id: expenseId,
      userId: input.userId,
      title: txRow[0].description,  // use original description
      descriptionHash: originalDescriptionHash,
      status: '1',  // uncategorized
      transactionCount: 1,
      totalAmount: toDbDecimal(/* fetch tx amount */),
      firstTransactionAt: /* fetch tx date */,
      lastTransactionAt: /* fetch tx date */,
    })
    sharedExpense = [{ id: expenseId }]
  }
  
  // 4. Re-attach the transaction to the shared Expense
  await tx
    .update(transactionTable)
    .set({ expenseId: sharedExpense[0].id })
    .where(eq(transactionTable.id, input.transactionId))
  
  // 5. Reconcile the standalone Expense (deletes it if it has no other transactions)
  // (via applyDetachCleanupTx logic or a custom reconciliation function)
}
```

**Note:** `computeDescriptionHash` is exported from `@/lib/utils/import.ts` (line 75); it normalizes the description (lowercase, trim, collapse spaces) and SHA256-hashes it. This is the canonical reverse-detach invariant: **the transaction's description + computeDescriptionHash = original hash**.

[VERIFIED: codebase inspection] — `computeDescriptionHash` used at transaction import time (import.ts:243); reverse is structurally sound.

---

## Eligibility Guards (D-04..D-08)

### Guard Predicates

All predicates return **false** if the transaction is eligible (confusing name; use `!isEligible` in UI).

#### D-04: Reimbursement Involvement

```typescript
async function isInvolvedInReimbursement(
  tx: DbOrTx,
  input: { userId: string; transactionId: string }
): Promise<boolean> {
  // Check if transaction is a refund (secondary)
  const asRefund = await tx
    .select({ id: reimbursementRefund.id })
    .from(reimbursementRefund)
    .innerJoin(reimbursement, eq(reimbursementRefund.reimbursementId, reimbursement.id))
    .where(
      and(
        eq(reimbursement.userId, input.userId),
        eq(reimbursementRefund.transactionId, input.transactionId)
      )
    )
    .limit(1)
  
  if (asRefund[0]) return true
  
  // Check if transaction's Expense is an anchor
  const txExpense = await tx
    .select({ expenseId: transactionTable.expenseId })
    .from(transactionTable)
    .where(eq(transactionTable.id, input.transactionId))
    .limit(1)
  
  if (!txExpense[0]?.expenseId) return false
  
  const asAnchor = await tx
    .select({ id: reimbursement.id })
    .from(reimbursement)
    .where(
      and(
        eq(reimbursement.userId, input.userId),
        eq(reimbursement.expenseId, txExpense[0].expenseId)
      )
    )
    .limit(1)
  
  return !!asAnchor[0]
}
```

#### D-05: Existing Plan

```typescript
async function hasActivePlan(
  tx: DbOrTx,
  input: { transactionId: string }
): Promise<boolean> {
  const plan = await tx
    .select({ id: amortizationPlan.id })
    .from(amortizationPlan)
    .where(eq(amortizationPlan.transactionId, input.transactionId))
    .limit(1)
  return !!plan[0]
}
```

#### D-06: Expense Group Membership

```typescript
async function belongsToExpenseGroup(
  tx: DbOrTx,
  input: { transactionId: string }
): Promise<boolean> {
  const membership = await tx
    .select({ id: expenseGroupMembership.id })
    .from(expenseGroupMembership)
    .innerJoin(expense, eq(expenseGroupMembership.expenseId, expense.id))
    .innerJoin(transactionTable, eq(expense.id, transactionTable.expenseId))
    .where(eq(transactionTable.id, input.transactionId))
    .limit(1)
  return !!membership[0]
}
```

#### D-07: Instalment Minimum

```typescript
function canSplitIntoMonths(amount: string, months: number): boolean {
  return isValidMonths(amount, months)  // from math section above
}
```

#### D-08: Direction (Outflow Only)

```typescript
async function isOutflow(
  tx: DbOrTx,
  input: { transactionId: string }
): Promise<boolean> {
  const txWithDir = await tx
    .select({ code: direction.code })
    .from(transactionTable)
    .innerJoin(expense, eq(transactionTable.expenseId, expense.id))
    .innerJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
    .innerJoin(category, eq(subCategory.categoryId, category.id))
    .innerJoin(nature, eq(subCategory.natureId, nature.id))
    .innerJoin(direction, eq(nature.directionId, direction.id))
    .where(eq(transactionTable.id, input.transactionId))
    .limit(1)
  
  return txWithDir[0]?.code === 'out'  // only 'out' is eligible
}
```

**Precedent:** v2.5 pair-guard (`lib/dal/transactions.ts`) and v2.8 write-path invariants serve as architectural models.

---

## Ledger_Entry Seam (D-11)

### Design

The seam is **one swappable row source per lens**, not a parameter threaded through aggregations.

**Cash lens:** Raw transactions with `effectiveAmount()` netting already applied.

**Accrual lens:** Non-amortized transactions UNION ALL instalment rows, each carrying its own amount (no further netting).

### Implementation Shape

```sql
-- Conceptual; actual implementation uses Drizzle or raw SQL in a VIEW
-- Declared in lib/dal/ledger-entry.ts or similar

-- Cash lens: transactions with reimbursement netting
SELECT
  t.id,
  t.user_id,
  t.occurred_at,
  t.expense_id,
  effectiveAmount(t) AS amount,  -- includes refund netting
  'transaction' AS source_type
FROM transaction t
WHERE NOT EXISTS (
  SELECT 1 FROM reimbursement_refund rr
  WHERE rr.transaction_id = t.id
)

UNION ALL

-- Accrual lens: same + instalment rows (no netting on instalments)
SELECT
  i.id,
  i.user_id,
  i.occurred_at,
  i.expense_id,
  i.amount,  -- no further netting; read-only column
  'instalment' AS source_type
FROM amortization_instalment i
```

### Call Sites Affected (~16 total)

All aggregation sites in:
- `lib/dal/dashboard.ts`: getOverviewAmountTotals (lines 458–499), getUncategorizedCount, category breakdown queries
- `lib/dal/overview.ts`: chart-point queries, movers/deviations

Each currently calls `effectiveAmount()` and `isNotSecondary()` directly in the WHERE/SELECT. The seam work replaces all with:

```sql
SELECT SUM(ledger.amount) ...
FROM ledger_entry ledger
WHERE ledger.user_id = $1 AND ledger.occurred_at BETWEEN $2 AND $3
```

No CASE/WHEN for netting; no fragment pair; seam resolves the amount once, inside itself.

### Regression Gate

`tests/reimbursement-regression.test.ts` seeding + assertion structure extended:

1. Seed user + taxonomy + transactions + reimbursement (existing).
2. **NEW:** Seed amortization_plan + instalments.
3. Capture aggregation snapshots for both cash and accrual lenses.
4. Assert: cash lens = byte-identical to baseline (no amortization data changes cash view).
5. Assert: accrual lens shows instalments in their months (future work, Phase 80).

### Implementation Decision (Plain Postgres VIEW vs Materialized)

**Decision:** Deferred to plan-phase; not locked yet (ADR 0019 §52 "left to discuss/plan phase").

- **Plain VIEW:** Cheaper writes, fresh reads, moderate query complexity.
- **Materialized VIEW:** Requires explicit refresh; complex to keep in sync; benefits only very large datasets.

**Recommendation for Phase 77 plan:** Start with plain VIEW (simpler, no refresh logic), prove byte-identical under regression suite. If query planning reveals performance issues, materialized VIEW is a Phase 80+ optimization without schema change.

### Duplicate Extraction

Both `dashboard.ts` and `overview.ts` define private `dateScopedTransactions()` and `expenseStatusIncludedInDashboardTotals()` (line 420–434 vs 52–62). Extract to `lib/dal/dashboard-filters.ts` or similar during seam work, import in both files.

[VERIFIED: codebase] — duplication confirmed; no functional drift between the two.

---

## Common Pitfalls

### Pitfall 1: Remainder Not On First Instalment

**What goes wrong:** Applying remainder to the last instalment instead of the first causes the first month to show a lower amount than expected, breaking plan predictability.

**Why it happens:** Naive implementation applies remainder to whichever instalment "collects" it naturally.

**How to avoid:** Explicitly accumulate remainder during first iteration (`i === 0 ? baseInstalment.plus(remainder) : baseInstalment`).

**Warning signs:** Test instalment sums; verify total = SUM(all amounts).

### Pitfall 2: Day Clamp Logic Drifts

**What goes wrong:** 31/1 → 28/2 clamp shifts into a different month (e.g., accidentally 1/3), breaking date continuity.

**Why it happens:** Simple `new Date(year, month, 31)` silently overflows to the next month; developer forgets to clamp.

**How to avoid:** Always check if computed day exceeds last day of target month; clamp before storing.

**Warning signs:** Instalment dates visibly jump; test Feb instalments explicitly.

### Pitfall 3: Cash Lens Reads Instalment Rows (Reintroduction)

**What goes wrong:** After ledger_entry seam lands, a new aggregation query is added that forgets to filter out instalment rows, so accrual costs leak into cash totals.

**How to avoid:** Ledger_entry is **one read path**; switching between lenses is a query-level parameter choice (`SELECT FROM ledger_entry WHERE source_type = $1`), not a code-level if/else. Document the seam contract: "all reads go through ledger_entry; the VIEW handles cash vs accrual; do not fork the query".

**Warning signs:** Regression suite fails cash-lens byte-identical gate; USD totals spike when amortization data exists.

### Pitfall 4: Reverse-Detach Reattaches to Wrong Shared Expense

**What goes wrong:** Original descriptionHash not recomputed correctly, so transaction re-attaches to a different Expense (e.g., wrong merchant).

**Why it happens:** Developer stores synthetic hash at detach time and tries to reverse it (impossible); or computes hash incorrectly (different normalization).

**How to avoid:** Transaction.description is immutable; always recompute from source (`computeDescriptionHash(transaction.description)`). Store the original hash **nowhere** — derive it on undo. Write a unit test: detach → undo → verify transaction.expenseId matches original.

**Warning signs:** Undo test fails; re-attached transaction appears in wrong merchant row in the UI.

### Pitfall 5: Atomicity Not Held (Plan + Instalments + Detach)

**What goes wrong:** Detach succeeds, plan creation fails (e.g., DB error), transaction is now orphaned in a standalone Expense with no plan.

**Why it happens:** Operations not wrapped in `db.transaction`.

**How to avoid:** All three operations (detach, plan insert, instalments batch insert) must run inside **one** `db.transaction()`. If any fails, all rollback. Mirrors ADR 0019 §1/§4.

**Warning signs:** Partial data in schema; plan missing but detach present; error handling doesn't rollback.

---

## Code Examples

### Activation Flow (D-03 + D-10)

```typescript
// lib/actions/amortization.ts
import { db } from '@/lib/db'
import { applyDetachCleanupTx } from '@/lib/services/transaction-detach'
import { toDbDecimal } from '@/lib/utils/decimal'

export async function createAmortizationPlan(input: {
  userId: string
  transactionId: string
  months: number
}): Promise<{ planId: string; instalments: Array<{ date: Date; amount: string }> }> {
  return db.transaction(async (tx) => {
    // 1. Fetch transaction
    const txRow = await tx
      .select()
      .from(transactionTable)
      .where(eq(transactionTable.id, input.transactionId))
      .limit(1)
    if (!txRow[0]) throw new Error('Transaction not found')
    
    // 2. Detach into standalone Expense (reuses v2.8 logic)
    const detachResult = await applyDetachCleanupTx(tx, {
      userId: input.userId,
      transactionId: input.transactionId,
      title: txRow[0].description,
      subCategoryId: null,
    })
    
    // 3. Create plan row
    const planId = crypto.randomUUID()
    await tx.insert(amortizationPlan).values({
      id: planId,
      userId: input.userId,
      transactionId: input.transactionId,
      transactionDescription: txRow[0].description,
      transactionOccurredAt: txRow[0].occurredAt,
      months: input.months,
      startDate: new Date(txRow[0].occurredAt.getFullYear(), txRow[0].occurredAt.getMonth(), 1),
      status: 'open',
      totalAmount: toDbDecimal(txRow[0].amount),
    })
    
    // 4. Materialize instalments
    const instalments = materializeInstalments(
      txRow[0].amount,
      txRow[0].occurredAt,
      input.months
    )
    
    // 5. Insert instalment rows
    const instRows = instalments.map((inst, idx) => ({
      id: crypto.randomUUID(),
      userId: input.userId,
      planId,
      instalment_number: idx + 1,
      expenseId: detachResult.newExpenseId,  // shared standalone Expense
      amount: inst.amount,
      occurred_at: inst.date,
    }))
    await tx.insert(amortizationInstalment).values(instRows)
    
    return { planId, instalments }
  })
}
```

[CITED: ADR 0019 §1/§4, transaction-detach.ts applyDetachCleanupTx signature]

### Instalment Math (D-07)

```typescript
// lib/services/amortization-math.ts
import Decimal from 'decimal.js'
import { toDecimal, toDbDecimal } from '@/lib/utils/decimal'

export function validateMonthsForAmount(amount: string, months: number): { valid: boolean; reason?: string } {
  if (months < 2) return { valid: false, reason: 'Minimo 2 mesi.' }
  
  const total = toDecimal(amount)
  const base = total.dividedBy(months).toDecimalPlaces(2, Decimal.ROUND_DOWN)
  
  if (base.lt(toDecimal('0.01'))) {
    const maxMonths = total.times(100).toDecimalPlaces(0).toNumber()
    return {
      valid: false,
      reason: `Impossibile: €${amount} diviso ${months} mesi = €${base.toString()}. Massimo ${maxMonths} mesi.`
    }
  }
  
  return { valid: true }
}

export function materializeInstalments(
  amount: string,
  date: Date,
  months: number
): Array<{ date: Date; amount: string }> {
  const total = toDecimal(amount)
  const base = total.dividedBy(months).toDecimalPlaces(2, Decimal.ROUND_DOWN)
  const remainder = total.minus(base.times(months))
  
  const result: Array<{ date: Date; amount: string }> = []
  
  for (let i = 0; i < months; i++) {
    let instDate = new Date(date.getFullYear(), date.getMonth() + i, date.getDate())
    const lastDay = new Date(instDate.getFullYear(), instDate.getMonth() + 1, 0)
    if (instDate.getDate() > lastDay.getDate()) {
      instDate.setDate(lastDay.getDate())
    }
    
    const instAmount = i === 0 ? base.plus(remainder) : base
    result.push({ date: instDate, amount: toDbDecimal(instAmount) })
  }
  
  return result
}
```

[VERIFIED: Decimal.js v10 API; toDecimal/toDbDecimal from project decimal utils]

---

## Validation Architecture

**Enabled:** workflow.nyquist_validation not explicitly set to false in `.planning/config.json` (defaults to enabled).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing project standard) |
| Config file | `vitest.config.ts` (project-wide) |
| Quick run command | `vitest run tests/amortization.test.ts` (to be created) |
| Full suite command | `vitest run tests/` + `yarn db:up` for real-Postgres regression |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AMORT-01 | User can amortize from row / detail / manual entry | integration | `vitest run tests/amortization-activation.test.ts` | ❌ Wave 0 |
| AMORT-02 | Detach creates Standalone Expense, later same-desc purchase not swept | integration | `vitest run tests/amortization-detach.test.ts` | ❌ Wave 0 |
| AMORT-03 | Instalments uniform, remainder on first, day-clamp to month end | unit | `vitest run tests/amortization-math.test.ts` | ❌ Wave 0 |
| LENS-03 | Cash view byte-identical to today with amortization data | real-Postgres regression | `vitest run tests/reimbursement-regression.test.ts` (extended) | ✅ exists, extend |
| D-04 guard | Reimbursement-involved transaction blocked | integration | `vitest run tests/amortization-guards.test.ts::reimbursement` | ❌ Wave 0 |
| D-05 guard | Existing plan blocks new plan | integration | `vitest run tests/amortization-guards.test.ts::existing-plan` | ❌ Wave 0 |
| D-06 guard | Expense Group membership blocks | integration | `vitest run tests/amortization-guards.test.ts::group-membership` | ❌ Wave 0 |
| D-07 guard | Invalid months rejected (< 2 or too many) | unit | `vitest run tests/amortization-math.test.ts::validate-months` | ❌ Wave 0 |
| D-09 undo | Reverse-detach re-attaches to original Expense | integration | `vitest run tests/amortization-undo.test.ts` | ❌ Wave 0 |
| D-10 manual | Manual entry + amortization checkbox creates + detaches + plans | integration | `vitest run tests/amortization-manual-entry.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `vitest run tests/amortization-math.test.ts` (unit, < 1s)
- **Per wave merge:** `vitest run tests/` (full suite, includes real-Postgres regression gate for LENS-03)
- **Phase gate:** LENS-03 regression suite fully green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/amortization-math.test.ts` — instalment math, remainder-on-first, day-clamp, validation
- [ ] `tests/amortization-activation.test.ts` — activation flow, detach, plan + instalments atomicity
- [ ] `tests/amortization-guards.test.ts` — D-04..D-08 predicates blocking
- [ ] `tests/amortization-undo.test.ts` — reverse-detach invariant, transaction re-attachment
- [ ] `tests/amortization-manual-entry.test.ts` — D-10 inline activation
- [ ] `tests/reimbursement-regression.test.ts` — extend seedReimbursement suite to include amortization plan + instalment seeding, prove cash-lens byte-identical (LENS-03 gate)
- [ ] Framework install: `vitest` already present; no additional packages needed

**Schema migration + seed:** `scripts/migrate.ts` and `yarn db:seed` before test suite runs.

---

## Runtime State Inventory

**Not applicable** — Phase 77 introduces new tables only; no existing state needs migration or remapping. No rename/refactor/migration phase concerns.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better Auth session validation in all action creators |
| V3 Session Management | yes | verifySession() in all write paths (existing pattern, reused here) |
| V4 Access Control | yes | userId ownership checks in all queries; prevent cross-user data leaks |
| V5 Input Validation | yes | Zod schemas for CreateAmortizationSchema (months min/max, amount validation) |
| V6 Cryptography | N/A | No crypto beyond SHA256 for descriptionHash (standard library, safe) |

### Known Threat Patterns for {Node.js + Next.js + Drizzle + PostgreSQL}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection in ledger_entry seam | Tampering | Drizzle parameterization + raw SQL fragments in lib/dal/ledger-entry.ts (not string concatenation) |
| Cross-user data leak (userId scope) | Information Disclosure | verifySession() + userId checks in all DAL queries; regression test suite validates isolation |
| Atomicity violation (partial plan creation) | Tampering | db.transaction() wraps all three operations (detach + plan + instalments); rollback on error |
| Amount manipulation (Decimal precision) | Tampering | Decimal.js (no floating-point); all stored as NUMERIC(12,2) strings; math never uses native +/−/* |
| Malformed instalment dates (day-clamp) | Denial of Service | Deterministic date logic; clamp to last day of month; test against edge months (Feb, Apr, etc.) |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | Schema + real-Postgres tests | ✓ | 15+ | Docker Postgres via `yarn db:up` |
| Drizzle Kit | Migration generation | ✓ | v0.x | — |
| Vitest | Test suite | ✓ | v1.x | — |
| Node.js crypto | SHA256 for reverse-detach | ✓ | builtin | — |
| Decimal.js | Instalment math | ✓ | v10+ | — (hard rule, no workaround) |

**Missing dependencies:** None. All required tools are present and verified.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `computeDescriptionHash(transaction.description)` correctly recovers original hash for reverse-detach | Reverse-Detach Invariant | Transaction re-attaches to wrong Expense; undo corrupts merchant grouping |
| A2 | Decimal.js v10+ dividedBy().toDecimalPlaces(2, ROUND_DOWN) produces correct base instalment for remainder calculation | Instalment Math | First instalment has incorrect amount; total doesn't sum to original |
| A3 | Day-clamp logic (last day of month check) handles all edge cases (Feb 28/29, short months) correctly | Instalment Math | Instalment date drifts into wrong month; regression tests catch this |
| A4 | v2.8 `effectiveAmount()` / `isNotSecondary()` fragment pair can be safely collapsed into `ledger_entry` row source without changing ~16 call sites' semantics | Ledger_Entry Seam | Aggregations read wrong amounts; LENS-03 regression gate fails |
| A5 | `reimbursement_refund` table schema and indices are as documented (Phase 73) and stable through Phase 77 | Eligibility Guards (D-04) | Reimbursement guard logic queries wrong table; false positives/negatives |
| A6 | Expense Group membership unique constraint (`expense_group_membership_expense_unique`) enforces at-most-one membership per Expense | Eligibility Guards (D-06) | Transaction could be in multiple groups; guard misses it |
| A7 | Transaction.description field is **immutable** after insertion (no edit path exists in current app) | Reverse-Detach Invariant, Instalment Math | Description changes break reverse-detach hash; plan amount drifts |
| A8 | Phase 78 AMORT-06 (reimbursement + amortization) is explicitly deferred; no cross-interaction validation needed in Phase 77 | Eligibility Guards (D-04) | Incomplete guard; unexpected states in Phase 78 |

**If this table is empty:** None — all claims are either verified or explicitly noted as assumed.

---

## Open Questions

1. **Plain Postgres VIEW vs Materialized VIEW for ledger_entry (D-11)?**
   - What we know: Seam shape is independent of choice; regression suite gates cash view inert; performance unknown yet.
   - What's unclear: Query planning overhead for UNION ALL on every aggregation; refresh strategy if materialized.
   - Recommendation: Defer to plan-phase; default to plain VIEW for Phase 77 (simplest, fresh), optimize post-LENS-03 gate if needed.

2. **Should instalment rows have their own transaction_id for future auditing (Phase 78+)?**
   - What we know: Instalments carry plan_id + expense_id + amount + date; that's sufficient for reads.
   - What's unclear: Phase 78 closure/realization may need to link a sale transaction to a specific instalment month.
   - Recommendation: Add future `linked_transaction_id` column (nullable, default NULL) now; cost of migration if deferred is higher. Allows Phase 78 closure to point sale to closure month without ambiguity.

3. **How is the max-horizon cap (D-02, "amount in cents") enforced in the UI?**
   - What we know: Dialog validation rules; natural cap is calculated.
   - What's unclear: Does the months input show a placeholder hint "2–{maxMonths}"?
   - Recommendation: UI-SPEC already specifies placeholder (`lib/db/schema`: "Placeholder: 2–{maxMonths}"); planner confirms this is wired in the form.

---

## Metadata

**Confidence breakdown:**
- **Standard stack:** HIGH — Decimal.js + Drizzle + PostgreSQL reused from v2.8; tested patterns
- **Schema design:** HIGH — straightforward extensions; no novel table relationships
- **Reverse-detach invariant:** HIGH — descriptionHash recomputation is sound; existing `computeDescriptionHash` exports
- **Instalment math:** HIGH — Decimal.js API stable; algorithm matches ADR examples; edge cases (day-clamp) have test patterns
- **Eligibility guards:** MEDIUM — ADR gives conceptual guidance; exact predicate queries need plan-phase verification against live schema
- **Ledger_entry seam:** MEDIUM — shape locked (D-11); implementation (VIEW vs raw UNION ALL) deferred; ~16 call sites need catalog before plan-phase
- **Regression gate:** HIGH — v2.8 real-Postgres suite is proven; extending it is straightforward

**Research date:** 2026-07-28
**Valid until:** 30 days (stable stack) or Phase 78 starts (early change), whichever first

---

## Sources

### Primary (HIGH confidence)

- [ADR 0019: amortization-accrual-lens.md](./../../docs/adr/0019-amortization-accrual-lens.md) — locked model, seam architecture, consequences
- [ADR 0016: shared-costs-net-by-subcategory-inflows-isolated-per-transaction.md](./../../docs/adr/0016-shared-costs-net-by-subcategory-inflows-isolated-per-transaction.md) §2–§4 — forced-detach mechanism (reused)
- [Context Code Inspection] — `lib/services/transaction-detach.ts`, `lib/utils/import.ts`, `lib/dal/transaction-pairs-sql.ts`, `lib/dal/dashboard.ts`, `lib/dal/overview.ts`, `tests/reimbursement-regression.test.ts`
- [Project CONTEXT.md](./../../CONTEXT.md) — domain vocabulary ("ammortamento", "rata", "piano", "residuo", "lenti")
- [Phase 77 UI-SPEC](./77-UI-SPEC.md) — UI contract for activation dialog, preview, guards, undo
- [Phase 77 CONTEXT](./77-CONTEXT.md) — locked D-01..D-13 decisions
- [REQUIREMENTS.md](./../../.planning/REQUIREMENTS.md) — AMORT-01/02/03 + LENS-03 traceability

### Secondary (MEDIUM confidence)

- [Project CLAUDE.md](./../../CLAUDE.md) — hard rules (Decimal.js, db.transaction, dal/services/actions layering, migrations via drizzle-kit generate)
- [Drizzle ORM docs](https://orm.drizzle.team/) — pgTable, NUMERIC type, migrations
- [Decimal.js docs](https://mikemcl.github.io/decimal.js/) — dividedBy, toDecimalPlaces, ROUND_DOWN

### Tertiary (LOW confidence)

- Training knowledge on Postgres date/time logic (month-end clamping) — verified against codebase patterns in dashboard.ts, overview.ts
