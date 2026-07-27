# Phase 73: reimbursement-schema-and-netting - Research

**Researched:** 2026-07-23
**Domain:** Data model generalization, migration architecture, aggregation refactoring
**Confidence:** HIGH (architecture locked; implementation details verified against codebase)

## Summary

Phase 73 generalizes the 1:1 transaction pairing (`transaction_pair` table) into an explicit 1:N reimbursement model where one outflow anchor carries N linked inflow refunds. The locked architecture (ADR 0018) supersedes the net-by-subcategory approach and commits to "Mondo Netto" (netting at cost-time). The planner must migrate existing pairs, generalize `effectiveAmount()` / `isNotSecondary()` across 5 aggregation sites, and gate the migration with a dashboard regression harness that proves entrate / uscite / per-category totals remain identical before and after.

**Primary recommendation:** Treat the aggregation-site inventory (callsites of `effectiveAmount()` and `isNotSecondary()`) as the regression gate's surface, not as a by-product. Plan the migration and the harness together; the harness *is* the proof that netting was correctly generalized, not a final QA step.

---

## User Constraints (from CONTEXT.md)

All decisions below are **locked** by ADR 0018 (status: accepted; supersedes ADR 0016 §1).

### Locked Decisions

- **D-01:** Evolve the 1:1 pairing into an explicit 1:N link from one outflow to N inflows. The old `transaction_pair` becomes the N=1 case and is **migrated, not kept alongside** — after this phase there is exactly one netting mechanism. (RMB-01)

- **D-02:** **The anchor is always an outflow; refunds are always inflows.** A reimbursement group is defined by its spend. An inflow is never the anchor. This is a rule of *role*, not of *time* — a friend pre-paying before the spend still attaches to the outflow. Anchoring on an inflow, or linking an outflow as a refund, must be **rejected by the invariant** (DB constraint + service-level validation, not UI-only). (RMB-03)

- **D-03:** **The anchor is an Expense XOR an Expense Group** (both in outflow). The schema lands with both columns and the XOR constraint **in this phase**, so no second migration is needed later — `reimbursement (id, userId, title, expenseId XOR expenseGroupId, createdAt)` plus the `reimbursement_refund` join (`reimbursementId → transactionId`). Netting stays **per-transaction** (`effectiveAmount`); the Expense / Expense Group is only the *selection* unit. Group-anchor *behaviour* (netting over group members, surfaces) is Phase 74 — this phase only guarantees the shape is right and the invariant holds. (RMB-01, RMB-03)

- **D-04:** **Mondo Netto (net at cost-time).** Linked refunds net into the **month of the cost**; the refund's own month does not show the inflow. Chosen over "Mondo Cash" for consistency with the existing pairing — the 1:1 is generalized, not rewritten. **Accepted cost:** a past month *can* change retroactively when a late refund is linked. This is already today's 1:1 behaviour, so it is not a new regression. (RMB-04)

- **D-05:** `effectiveAmount` / `isNotSecondary` **generalize from "the one secondary" to "the set of linked refunds"**, and the generalization must be applied at **every** aggregation site — not only the ones the old pair touched. The current implementations live in `lib/dal/transaction-pairs-sql.ts` and are consumed across `lib/dal/dashboard.ts`, `lib/dal/overview.ts`, `lib/dal/transactions.ts`, `lib/dal/expenses.ts`, `lib/dal/tags.ts`. An inventory of call sites is a prerequisite, not an afterthought. (RMB-04)

- **D-06:** Every existing `transaction_pair` row is migrated to a reimbursement: **anchor = the primary's Expense, refund = the secondary**. After migration `transaction_pair` is **no longer the live netting source** — the netting layer reads the new tables only. (RMB-05)

- **D-07:** **Dashboard regression gate before any expansion.** Entrate / uscite / per-category totals must be **identical before and after** the migration, verified across every aggregation site. This gate is the phase's defining acceptance condition: no netting change ships without it green. Money comparisons use `Decimal.js` (`@/lib/utils/decimal`) — never native JS arithmetic. (RMB-05)

### Claude's Discretion

These are **details, not architecture**. Resolve them during research/planning with the stated leaning; do not escalate unless the codebase contradicts the leaning.

- **(Q2) Multi-month anchors** — whether an anchor is constrained to a single netting-month or attributed per-transaction. Leaning: **single-period** (the holiday case was confirmed "single-period" during the ADR discussion).
- **(Q3) Per-transaction `effectiveAmount` attribution when an Expense anchor has multiple transactions** — verify the attribution still holds; this is a correctness check to perform, not a choice to make.
- Naming of the new tables/columns beyond the ADR-specified shape, index strategy, and the mechanics of the regression harness (fixtures vs. snapshot of live aggregates) are open.
- Whether `transaction_pair` is dropped in this phase or left as a dormant table post-migration — the only locked part is that it stops being the live netting source (D-06).

### Deferred Ideas (OUT OF SCOPE)

- Group-anchor behaviour (Phase 74 — RMB-02)
- Residual as a first-class value (Phase 74 — RMB-06)
- Amount-edit guard generalized to 1:N (Phase 74 — RMB-09)
- Create/manage from UI (Phase 75 — RMB-07, RMB-08)
- `/reimbursements` section (Phase 76 — RMB-10, RMB-11)
- Subscription amortization (RMB-F1 — deferred milestone)

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RMB-01 | A user can link N inflow transactions to a single outflow anchor (1:N); the old `transaction_pair` becomes the N=1 case. | Schema (reimbursement + reimbursement_refund), migration from transaction_pair verified. |
| RMB-03 | The model enforces: only an outflow can anchor, only an inflow can refund (invariant). | Direction/Nature model determines outflow via direction.code='out'; service-level guards in transaction-pairs.ts pattern confirmed. |
| RMB-04 | Linked refunds net into the anchor's cost via Mondo Netto; every aggregation site generalized. | effectiveAmount()/isNotSecondary() call sites inventoried; month derived from transaction.occurredAt via `to_char(occurredAt, 'YYYY-MM')`. |
| RMB-05 | Existing transaction_pair rows migrated; dashboard totals identical before/after. | Migration pattern (0022 precedent), aggregation sites identified for regression harness. |

---

## Standard Stack

### Core Libraries

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | ~0.28 | Database queries, migrations | Project standard (CLAUDE.md); DECIMAL columns returned as strings |
| PostgreSQL | 15+ | Relational database | Project standard; `to_char()` for date formatting, `CASE` for netting math |
| Decimal.js | ~10.4 | Monetary arithmetic | Project hard rule (CLAUDE.md); all money comparisons via `toDecimal()`, never native `+` / `-` / `*` / `/` |
| Drizzle Kit | ~0.19 | Migration scaffolding | Project standard; `drizzle-kit generate` produces SQL; `drizzle-kit push` forbidden in prod |
| Vitest | ~1.0 | Unit & integration testing | Project standard; mocking pattern in `tests/dashboard-dal.test.ts` demonstrates DAL testing approach |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React Cache API | Built-in | Query deduplication in RSC | DAL functions wrapped in `cache()` per project convention |
| Drizzle Relations | Built-in | Schema relationships | expense.transactions: many(transaction) — Expense owns N transactions |

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          Dashboard Pages                         │
│  (overview KPI, category ranking, category detail, trends)       │
└────────────────┬──────────────────────────────────────────────────┘
                 │
                 ├──> lib/dal/dashboard.ts, overview.ts, tags.ts
                 │    [Aggregation queries calling]
                 │
                 ├──> effectiveAmount() / isNotSecondary()
                 │    [SQL fragments replacing transaction.amount]
                 │
    ┌────────────┴────────────────────────────────────────┐
    │                                                     │
    ▼                                                     ▼
PostgreSQL DB                                   Transaction Netting
├─ transaction (amount, occurredAt)             ├─ OLD: transaction_pair (A→B 1:1)
├─ transaction_pair (A, B)                      └─ NEW: reimbursement
├─ expense (id, title, totalAmount)                  reimbursement_refund (refund set)
├─ expenseGroup (id, title)
├─ direction (code, includedInTotals)
└─ nature (code, directionId)
```

**Data flow:**
1. Dashboard queries fetch transactions scoped by userId and date range (`dateScopedTransactions`).
2. For each transaction in `effectiveAmount()`: if it's a primary in a pair, compute `amount + secondary.amount`; else return `amount`.
3. Exclude all secondaries from aggregation via `isNotSecondary()` WHERE clause.
4. Group by month (`to_char(occurredAt, 'YYYY-MM')`) and/or category/nature/subcategory.
5. Display totals per direction (in/out/allocation) and by nature (income, essential, discretionary, debt).

**After migration to 1:N:**
1. `effectiveAmount()` changes: if it's an anchor in a reimbursement, compute `amount + SUM(refund.amount)` instead of `amount + secondary.amount`.
2. `isNotSecondary()` changes: exclude all rows where `transaction.id` appears as a refund in any reimbursement.
3. All other query shapes, joins, groupings, and aggregations remain identical.
4. Month scoping stays tied to the primary/anchor transaction's `occurredAt` — refunds are excluded from their own month.

### Recommended Project Structure

```
lib/
├── dal/
│   ├── transaction-pairs-sql.ts          [REFACTOR: effectiveAmount() → handles reimbursement set]
│   ├── transaction-pairs.ts              [DEPRECATE or move to reimbursement-pairs.ts]
│   ├── reimbursement-pairs.ts            [NEW: reimbursement-specific DAL if split desired]
│   ├── dashboard.ts                      [MAINTAIN: aggregation queries, no shape change]
│   ├── overview.ts                       [MAINTAIN: calls updated functions]
│   ├── tags.ts                           [MAINTAIN: calls updated functions]
│   └── (expenses.ts, transactions.ts)    [VERIFY: expenses does NOT use effectiveAmount; transactions.getTransactionsByExpenseId lists raw amounts]
│
├── services/
│   ├── transaction-pairs.ts              [DEPRECATE or move to reimbursement-pairs.ts]
│   ├── reimbursement-pairs.ts            [NEW: createReimbursement, addRefund, removeRefund, delete]
│   └── (others unchanged)
│
├── actions/
│   ├── transaction-pairs.ts              [DEPRECATE or move]
│   ├── reimbursement-pairs.ts            [NEW: thin wrappers for phase 75 linking UI]
│   └── (others unchanged)
│
├── validations/
│   ├── transaction-pairs.ts              [DEPRECATE or move]
│   ├── reimbursement-pairs.ts            [NEW: Zod schema for reimbursement shape]
│   └── (others unchanged)
│
├── db/
│   ├── schema.ts                         [ADD: reimbursement, reimbursement_refund tables; Mark transaction_pair deprecated]
│   └── migrations/
│       └── 00XX_reimbursement_1n.sql     [CREATE TABLE reimbursement, reimbursement_refund; BACKFILL existing pairs]
│
└── utils/
    ├── decimal.ts                        [MAINTAIN: no changes needed]
    └── (others unchanged)

scripts/
├── migrate.ts                            [MAINTAIN: executes drizzle-kit migrate; backfill in SQL migration]
└── (seed-*.ts unchanged)
```

### Pattern 1: Netting SQL Fragment

**What:** The `effectiveAmount()` function computes an amount that reflects the net cost at the time of the primary/anchor transaction. For secondaries/refunds, there is no effectiveAmount — they are excluded via `isNotSecondary()` WHERE clause.

**Current implementation (1:1):**

```typescript
// Source: lib/dal/transaction-pairs-sql.ts (verified)
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

**Generalization needed (1:N):** Replace the subquery with a SUM over all refunds in the reimbursement set:

```typescript
// Pseudocode — exact implementation open
export function effectiveAmount() {
  return sql`(
    CASE
      WHEN EXISTS (
        SELECT 1 FROM reimbursement r
        WHERE (r.expense_id = ${expenseTable.id} OR r.expense_group_id = ...)
          AND EXISTS (SELECT 1 FROM reimbursement_refund rr WHERE rr.reimbursement_id = r.id AND rr.transaction_id = ${transactionTable.id})
      )
      THEN ${transactionTable.amount}::numeric
      WHEN EXISTS (
        SELECT 1 FROM reimbursement r
        INNER JOIN reimbursement_refund rr ON rr.reimbursement_id = r.id
        WHERE (${transactionTable.id} refers to anchor expense/group) 
          AND rr.transaction_id = ${transactionTable.id}
      )
      THEN ${transactionTable.amount}::numeric + COALESCE(
        (SELECT SUM(t_refund.amount::numeric) FROM reimbursement_refund rr
         INNER JOIN transaction t_refund ON t_refund.id = rr.transaction_id
         WHERE rr.reimbursement_id = r.id),
        0
      )
      ELSE ${transactionTable.amount}::numeric
    END
  )`
}
```

**When to use:** Every aggregation query that sums or displays an amount (dashboard, overview, tags, category detail). Never use raw `${transactionTable.amount}` without wrapping in `effectiveAmount()` when computing totals or trends.

### Pattern 2: Exclusion via isNotSecondary()

**What:** A WHERE clause fragment that excludes all transactions that are linked as refunds in a reimbursement, ensuring no double-counting.

**Current implementation (1:1):**

```typescript
// Source: lib/dal/transaction-pairs-sql.ts (verified)
export function isNotSecondary() {
  return sql`NOT EXISTS (
    SELECT 1 FROM transaction_pair tp
    WHERE tp.transaction_b_id = ${transactionTable.id}
  )`
}
```

**Generalization needed (1:N):**

```typescript
// Pseudocode
export function isNotSecondary() {
  return sql`NOT EXISTS (
    SELECT 1 FROM reimbursement_refund rr
    WHERE rr.transaction_id = ${transactionTable.id}
  )`
}
```

**When to use:** Every WHERE clause in an aggregation query. Apply unconditionally alongside `effectiveAmount()`. Missing either causes silent aggregation errors (Pitfall 1 & 2 from Phase 50 research).

### Pattern 3: Monthly Attribution via to_char()

**What:** Transactions are attributed to the month of their `occurredAt` timestamp, extracted via PostgreSQL's `to_char()` function.

**Current implementation:**

```typescript
// Source: lib/dal/dashboard.ts, getCategoryRanking() (verified, line 1038)
const monthSql = sql<string>`to_char(${transactionTable.occurredAt}, 'YYYY-MM')`
```

**For 1:N reimbursements:** When a refund is linked to an anchor with `occurredAt` in March, the refund's `occurredAt` (e.g., April) is ignored — its amount nets into the March total via `effectiveAmount()`, and it does not appear in April's total because it is excluded via `isNotSecondary()`.

**Consequence:** A closed past month can change retroactively when a new refund is linked (D-04, accepted cost).

### Anti-Patterns to Avoid

- **Using native JS arithmetic on DECIMAL strings:** `+`, `-`, `*`, `/` without `Decimal.js` violates CLAUDE.md hard rule. The effect is silent rounding errors in netting. Always wrap with `toDecimal()`.
- **Forgetting `isNotSecondary()` in a WHERE clause:** Any aggregation that counts transactions or sums amounts without excluding refunds will double-count the net. Secondaries must be excluded unconditionally.
- **Using `transaction.amount` instead of `effectiveAmount()` in an aggregate SUM():** The net is wrong — secondaries appear as separate inflows, defeating the purpose of pairing/linking.
- **Applying netting logic in the application layer instead of SQL:** Dashboard code in `lib/dal/dashboard.ts` pushes netting into the database via SQL fragments, not TypeScript. Do not move logic up the stack.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Netting logic (computing the net when an anchor has N refunds) | Custom recursive sum or transaction shuffling | `effectiveAmount()` SQL fragment generalized | The 1:1 pairing already proved the pattern; extending to 1:N is a scoped change to the subquery, not a new design. |
| Excluding refunds from aggregations | Manual filtering in TypeScript after fetching all rows | `isNotSecondary()` WHERE clause | Pushing exclusion to the database ensures correctness and avoids loading unnecessary rows. |
| Schema validation of invariants (outflow anchor, inflow refunds, XOR) | Application-only checks before insert | DB CHECK constraints + service-level guards | Constraints + guards together provide defense-in-depth; constraints alone are incomplete (can be bypassed by direct SQL; migration risk). |
| Monthly attribution (which month a refund belongs to) | Application-layer date remapping | Transaction.occurredAt → anchor's month via SQL | The 1:1 pairing already uses `to_char(primary.occurredAt, 'YYYY-MM')` — generalization keeps this logic in SQL. |
| Regression testing (proving totals are identical before/after) | Snapshot of hardcoded expected values | Snapshot of live query results from both models side-by-side | The migration is a one-time event, not an ongoing feature — the regression harness can compare the old model's output to the new model's output on the same seeded dataset. |

**Key insight:** The 1:1 pairing (Phase 50, ADR 0004) proved all these patterns work at scale. The 1:N generalization does not need new mechanisms — it refactors the SQL subqueries and table references, nothing more. Do not introduce a different approach to netting, exclusion, or dating just because the data model changed.

---

## Call-Site Inventory: effectiveAmount() and isNotSecondary()

This is the regression gate's surface. Every site listed below must be updated to read the new reimbursement tables instead of transaction_pair.

### Dashboard Aggregation Sites [VERIFIED]

All sites use `effectiveAmount()` in SUM(CASE ...) and `isNotSecondary()` in WHERE.

1. **lib/dal/dashboard.ts : getOverviewAmountTotals()** (line ~458)
   - **What:** Top-line KPI: totalIn, totalOut, totalAllocation, totalInRecurring, totalOutEssential/Discretionary/Debt
   - **Aggregation:** SUM(effectiveAmount()) grouped by direction + nature
   - **Where clause:** dateScopedTransactions + expenseStatus + isNotSecondary()
   - **Verification:** ✅ SQL uses `coalesce(sum(case when ${direction.code} = 'in' then ${effectiveAmount()} ...`

2. **lib/dal/dashboard.ts : getCategoriesBreakdown()** (line ~973)
   - **What:** Per-category totals (In, Out) without monthly breakdown
   - **Aggregation:** SUM(effectiveAmount()) grouped by category
   - **Where clause:** dateScopedTransactions + expenseStatus + isNotSecondary()
   - **Verification:** ✅ SQL uses `sum(${effectiveAmount()})` and `isNotSecondary()`

3. **lib/dal/dashboard.ts : getCategoryRanking()** (line ~1034)
   - **What:** Per-category monthly trend: amount + count, sorted by total
   - **Aggregation:** SUM(effectiveAmount()) grouped by category + month (`to_char(occurredAt, 'YYYY-MM')`)
   - **Where clause:** dateScopedTransactions + expenseStatus + isNotSecondary()
   - **Verification:** ✅ SQL uses `sum(${effectiveAmount()})`, `isNotSecondary()`, and `to_char(..., 'YYYY-MM')`

4. **lib/dal/dashboard.ts : getCategoryDeviations()** (line ~1094)
   - **What:** Deviation analysis: per-category amount vs. baseline, comparison ranges
   - **Aggregation:** SUM(effectiveAmount()) grouped by category (and optional month for baseline)
   - **Where clause:** dateScopedTransactions + expenseStatus + isNotSecondary()
   - **Verification:** ✅ SQL uses `sum(${effectiveAmount()})`, `isNotSecondary()`, and `to_char(..., 'YYYY-MM')`

5. **lib/dal/dashboard.ts : getCategoryDetail()** (line ~1202)
   - **What:** Category detail page: totals, trends, subcategories, top transactions
   - **Aggregation:** SUM(effectiveAmount()) grouped by subcategory (sub-trends) and category (sparkline)
   - **Where clause:** dateScopedTransactions + expenseStatus + isNotSecondary()
   - **Verification:** ✅ SQL uses `sum(${effectiveAmount()})`, `isNotSecondary()`, and `to_char(..., 'YYYY-MM')`

6. **lib/dal/overview.ts** (line ~1 onwards)
   - **What:** Overview breakdown cards: 4 nature totals (income, essential, discretionary, debt) per direction
   - **Aggregation:** SUM(effectiveAmount()) grouped by nature
   - **Where clause:** dateScopedTransactions + expenseStatus + isNotSecondary()
   - **Verification:** ✅ Multiple SELECT blocks use `sum(${effectiveAmount()})`, `isNotSecondary()`, and explicit nature.code filter

7. **lib/dal/tags.ts : getTotalByTag()** (line ~200s)
   - **What:** Per-tag total amount (excluding transfers)
   - **Aggregation:** SUM(effectiveAmount()) grouped by tag
   - **Where clause:** dateScopedTransactions + tagFilter + isNotSecondary() (explicitly applied to query)
   - **Verification:** ✅ SQL uses `sum(${effectiveAmount()})` FILTER and `isNotSecondary()` in AND()

8. **lib/dal/tags.ts : getTagDetail()** (line ~300s)
   - **What:** Per-tag detail page: transactions with their effective amounts
   - **Aggregation:** Individual transaction rows; amount shown is `effectiveAmount()`
   - **Where clause:** tagId + isNotSecondary()
   - **Verification:** ✅ SELECT includes `(${effectiveAmount()})::text` as the amount field, `isNotSecondary()` in WHERE

### Verification Notes

- **Expenses.ts:** Does NOT use effectiveAmount() or isNotSecondary(). Expense aggregates are computed at the application layer via `reduce()` over fetched expense.totalAmount values. No change needed in this file.
- **Transactions.ts:** The `getTransactionsByExpenseId()` function lists raw transaction amounts (not aggregates). No netting applied at this level. No change needed.
- **Transaction-tags-sql.ts:** Provides helper functions alongside transaction-pairs-sql.ts (both in use for filtering, not aggregation of amounts directly). Verify if tag-specific netting is needed; current implementation suggests tag aggregates go through dashboard/tags.ts which already generalizes.

### Regression Gate Surface

The planner must create a harness that:
1. Populates the old `transaction_pair` table with test data (e.g., 1 outflow + 1 inflow pair).
2. Runs all 8 aggregation queries above and captures their results (totalIn, totalOut, per-category amounts, trends, etc.).
3. Migrates to the new `reimbursement` + `reimbursement_refund` schema, inserting matching rows.
4. Runs the same 8 queries again (with updated function implementations).
5. Compares results using `Decimal.js` equality (never `===` on strings).
6. Fails loudly if any total differs by more than a rounding error (e.g., ±0.01).

**Checkpoints:**
- Overall dashboard KPIs (totalIn, totalOut, per-nature spending).
- Per-category amounts (entry, exit, essential, discretionary, debt).
- Monthly trends (trend point totals, sparkline values).
- Per-tag totals.
- Top-transaction lists (if amounts are filtered/sorted by effectiveAmount).

---

## Runtime State Inventory

**Trigger:** This is a data-model migration phase (rename/refactor), so a full audit is required.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | `transaction_pair` table (~X rows per user, exact count unknown from this audit) | Backfill migration SQL: each row → new reimbursement (anchor = primary's expense, refund = secondary) + reimbursement_refund |
| **Live service config** | None identified | — |
| **OS-registered state** | None identified | — |
| **Secrets/env vars** | None identified (no new auth boundary or API keys) | — |
| **Build artifacts** | None identified (schema change, no CLI or installed packages added) | — |

**Verification method:** Counted `SELECT COUNT(*) FROM transaction_pair;` conceptually. The actual count is unknown without a live DB query, but migration SQL must handle 0 to N rows correctly.

---

## Common Pitfalls

### Pitfall 1: Missing isNotSecondary() in WHERE Clause

**What goes wrong:** A dashboard query that sums amounts but omits the `isNotSecondary()` WHERE clause will include refund amounts alongside their corresponding net on the primary — double-counting the refund portion.

**Example:** `SELECT SUM(amount) FROM transaction` without `NOT EXISTS (SELECT 1 FROM transaction_pair WHERE transaction_b_id = transaction.id)` counts each refund twice: once in the primary's effectiveAmount, and again as a separate inflow.

**Why it happens:** The developer updates `effectiveAmount()` but forgets that the WHERE clause is equally important. The two functions are tightly coupled; they must move together.

**How to avoid:** Treat `effectiveAmount()` and `isNotSecondary()` as an atomic pair. Any query using one must use the other. Add a code comment at the call site: `// Always use isNotSecondary() alongside effectiveAmount().`

**Warning signs:** Dashboard totals are higher than expected; per-category breakdown sums don't match the KPI totals.

**Harness check:** Regression query comparison will fail if isNotSecondary() is missing — totals will be inflated.

### Pitfall 2: Using Raw transaction.amount Instead of effectiveAmount()

**What goes wrong:** A query sums `${transactionTable.amount}` instead of `${effectiveAmount()}` — the net is not computed, and refunds appear as separate rows in the result.

**Example:** `SELECT category, SUM(transaction.amount) FROM transaction GROUP BY category` on a pairing where expense A=€100 and refund B=-€50 returns category.amount=€50 for A *and* category.amount=-€50 for B, for a total of €0 (correct by accident). But if the query is structured to show per-transaction rows (no GROUP BY), it shows both €100 and -€50 as separate line items, confusing the user.

**Why it happens:** Refactoring an old query that never used pairs; the developer doesn't realize the amount column needs wrapping.

**How to avoid:** Use `effectiveAmount()` reflexively whenever a query touches the `amount` column inside a SUM() or aggregate. If the query lists individual transactions (no SUM), raw `amount` is correct; if it aggregates, use `effectiveAmount()`.

**Warning signs:** Dashboard totals are lower than expected; per-category or per-tag totals don't add up correctly; transactions list shows refunds as separate entries instead of netted into their anchor.

**Harness check:** Regression harness will detect this via mismatched per-category totals.

### Pitfall 3: Forgetting to Generalize a Call Site

**What goes wrong:** A new aggregation query is added (e.g., a reporting feature) that uses transaction amounts, but the developer is not aware of `effectiveAmount()` and `isNotSecondary()`, so they use raw amounts and WHERE on expense status alone.

**Why it happens:** The patterns are not documented in the query itself; a new developer doesn't see them at first glance.

**How to avoid:** Document the pairing pattern at the top of `transaction-pairs-sql.ts` and link to it from `dashboard.ts`. Add a checklist to the PR template: "Queries using transaction.amount must call effectiveAmount() and isNotSecondary(). Run the regression gate."

**Warning signs:** A feature introduced after the migration that aggregates amounts and doesn't match dashboard totals.

**Harness check:** The regression harness only checks 8 existing aggregation sites; a new site added after migration won't be covered. This is a planning-phase risk to mitigate via code-review checklist.

### Pitfall 4: Netting Backwards (Refund is Primary, Expense is Secondary)

**What goes wrong:** The schema or service assumes the refund can be the primary/anchor, or the expense can be a refund. This violates D-02 (anchor is always outflow, refund is always inflow).

**Why it happens:** During migration, a row is inserted with the wrong assignment (e.g., anchor_id pointing to the secondary's expense, refund pointing to the primary).

**How to avoid:** Service-level guard in the migration script: before inserting a reimbursement, verify the anchor's expense.direction = 'out' and the refund's transaction.direction = 'in' (via a JOIN to direction/nature). Reject silently or throw an error if the invariant is violated. In the new schema, add a CHECK constraint: `(SELECT direction.code FROM ... WHERE ...) = 'out'` (if PostgreSQL allows nested SELECT in CHECK; if not, enforce in service layer with a note in schema comments).

**Warning signs:** A reimbursement row with the "backwards" pairing; dashboard amounts are inverted (in/out flipped); regression harness totals differ with a sign flip.

**Harness check:** The harness compares before/after totals; if a backwards pairing slips through, the new-model total will be opposite in sign, failing the test. Add an explicit invariant check: all anchor expenses must have direction='out', all refunds must have direction='in'.

---

## Testing & Validation Infrastructure

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 1.0+ |
| Config file | `vitest.config.ts` |
| Quick run command | `./node_modules/.bin/vitest run tests/dashboard-dal.test.ts` |
| Full suite command | `./node_modules/.bin/vitest run` |

**Note:** Per project memory, `npx vitest` and `npx tsc` are intercepted by a token-optimizing proxy (RTK) that can produce unreliable output. Always use direct binaries in `node_modules/.bin/` for verification.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RMB-01 | Schema: reimbursement + reimbursement_refund tables exist | unit (schema) | `drizzle-kit generate --verify` (generates migration if schema is valid) | ✅ schema.ts (add tables) |
| RMB-03 | Invariant: anchor must be outflow, refund must be inflow | unit (service) | `./node_modules/.bin/vitest run tests/reimbursement-invariant.test.ts` | ❌ Wave 0 (new file) |
| RMB-04 | Netting: effectiveAmount() generalized; query results identical before/after | integration (regression) | `./node_modules/.bin/vitest run tests/reimbursement-regression.test.ts` | ❌ Wave 0 (new file) |
| RMB-05 | Migration: existing transaction_pair rows migrated without data loss | integration (migration) | `yarn db:migrate --verify` (after creating migration SQL) | ❌ Wave 0 (migration file) |

### Sampling Rate

- **Per task commit:** Run `./node_modules/.bin/vitest run tests/reimbursement-regression.test.ts` after each aggregation-site refactor.
- **Per wave merge:** Run full suite `./node_modules/.bin/vitest run` before marking wave complete.
- **Phase gate:** Regression harness green (all 8 aggregation queries return identical totals before/after migration) before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `tests/reimbursement-invariant.test.ts` — unit tests for D-02 (anchor must be outflow, refund must be inflow). Verify the service-level guards reject invalid combinations.
- [ ] `tests/reimbursement-regression.test.ts` — integration test that:
  1. Seeds test data into the old `transaction_pair` schema.
  2. Runs the 8 aggregation queries (getOverviewAmountTotals, getCategoriesBreakdown, getCategoryRanking, getCategoryDeviations, getCategoryDetail, overview totals, getTotalByTag, getTagDetail).
  3. Captures results (amounts, counts, totals per category/nature).
  4. Migrates the schema (runs the backfill SQL migration).
  5. Runs the same 8 queries with updated effectiveAmount()/isNotSecondary() implementations.
  6. Compares results using Decimal.js; asserts all totals are equal.
- [ ] `drizzle/migrations/00XX_reimbursement_1n.sql` — CREATE TABLE reimbursement, reimbursement_refund; BACKFILL existing transaction_pair rows; optional: mark transaction_pair deprecated or drop (depends on Claude's Discretion choice).
- [ ] Update `lib/dal/transaction-pairs-sql.ts` — rewrite effectiveAmount() and isNotSecondary() to reference reimbursement tables instead of transaction_pair.

**If all gaps are filled:** Regression harness passes, invariant tests pass, migration completes successfully → phase is ready for execution.

---

## Answers to Open Questions

### Q2: Multi-Month Anchors — Single-Period Netting

**Verification:** Confirmed in codebase. The month is derived from the **anchor transaction's** `occurredAt` column via `to_char(occurredAt, 'YYYY-MM')` in every aggregation query (dashboard.ts lines 1038, 1108; overview.ts applies same pattern).

**Finding:** Each transaction belongs to exactly one month based on its `occurredAt`. When an anchor has N transactions (possible via the Expense schema: `expense.transactions: many(transaction)`), the netting is applied **per transaction**. In other words, if an Expense has two transactions (March €100 out, May €50 out) and they are jointly anchored to a single refund (June €50 in), the netting rules are:
- March: show €100 (unchanged; refund is in June).
- May: show €50 (unchanged; refund is in June).
- June: show €0 (the refund is excluded via isNotSecondary()).

**Consequence:** An Expense Group anchor (Phase 74) will need special handling to decide which month receives the netting credit when the group has transactions in multiple months. This phase does not address it (single Expense anchor only, which today always has one primary transaction).

**Answer to Q2:** Single-period netting by the anchor's month is correct. The anchor's `occurredAt` (a transaction field, indexed in the schema) is the source of truth. No change to the month-derivation logic is needed; the existing `to_char(occurredAt, 'YYYY-MM')` continues to work.

### Q3: Per-Transaction effectiveAmount Attribution for Multi-Transaction Expense Anchors

**Verification:** Confirmed in schema and DAL. An Expense owns N transactions via `expense.transactions: many(transaction)` (schema.ts line 757). The `lib/dal/expenses.ts` DAL provides `getExpenseDetail()` which joins to transaction and fetches all N rows. The `lib/dal/transactions.ts` DAL provides `getTransactionsByExpenseId()` which returns all N transactions for a given expense.

**Finding:** The current 1:1 pairing assumes one primary transaction per Expense. When a pair is created, the Expense is fetched by the primary's expenseId (schema line 424: `transaction.expenseId`). The secondary's transaction is also fetched and also has its own expenseId. In the normal flow, **an Expense is paired at most once** (you pair one specific outflow transaction with one inflow transaction). 

**Example:** An Amazon expense with *one* transaction (€100 out) is paired with a refund (€50 in). The pair is created on the primary transaction. The Expense's transactionCount = 1. There is no ambiguity.

**Edge case (possible but not yet encountered):** An Expense with *multiple* transactions (e.g., order placed on March 1 for €50, reorder on March 5 for €50, same Expense, total €100) is anchored to a refund. The current effectiveAmount() logic uses the **primary transaction's expenseId** to identify the Expense. When netting is applied, it applies to the *primary transaction's amount* only, not to all transactions in the Expense. 

**Consequence:** If this edge case arises, the netting is correctness-preserving: `effectiveAmount(primary) = primary.amount + refund.amount`; the second transaction in the same Expense shows `effectiveAmount(secondary-tx) = secondary-tx.amount` (no netting, because the netting subquery only triggers on `transaction_a_id`, not on "all transactions in this expense"). The dashboard totals will be correct.

**Answer to Q3:** Per-transaction attribution holds. The `effectiveAmount()` logic is tied to individual transaction PKs, not Expense PKs. A multi-transaction Expense that is paired/reimbursed will have its primary transaction netted and its secondary transactions left alone, which is correct. **No change to `effectiveAmount()` implementation is needed for correctness.** (Phase 74's Group-anchor behavior may introduce new semantics, but that is Phase 74's concern.)

---

## Environment Availability

**External tools required:** PostgreSQL 15+, Drizzle Kit (included in node_modules), Node.js 18+ (project standard).

**Availability check:**
```bash
command -v node && node --version
command -v psql && psql --version
npm list drizzle-kit | grep -q drizzle-kit && echo "OK"
```

**If missing:** All are standard project dependencies; no fallback. The phase cannot execute without PostgreSQL and Drizzle Kit.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 1.0+ with mocking support |
| Config file | `vitest.config.ts` |
| Quick run command | `./node_modules/.bin/vitest run tests/dashboard-dal.test.ts -t "effectiveAmount\|isNotSecondary"` |
| Full suite command | `./node_modules/.bin/vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RMB-01 | Schema: reimbursement table with XOR constraint | unit (schema definition) | `drizzle-kit generate --verify` (validates schema.ts) | ✅ Add to schema.ts |
| RMB-03 | Invariant: createReimbursement rejects inflow anchor or outflow refund | unit (service) | `./node_modules/.bin/vitest run tests/reimbursement-invariant.test.ts` | ❌ Wave 0 |
| RMB-04 | Netting: dashboard totals identical before/after migration | integration (regression) | `./node_modules/.bin/vitest run tests/reimbursement-regression.test.ts --reporter=verbose` | ❌ Wave 0 |
| RMB-05 | Migration: transaction_pair → reimbursement, no rows lost | integration (backfill) | `yarn db:migrate --verify && ./node_modules/.bin/vitest run tests/migration-backfill.test.ts` | ❌ Wave 0 |

### Wave 0 Gaps

- [ ] `tests/reimbursement-invariant.test.ts` (NEW)
  - Test: `createReimbursement({ expenseId, refundTransactionIds })` with expense.direction='out', all refunds.direction='in' → succeeds
  - Test: `createReimbursement({ expenseId, refundTransactionIds })` with expense.direction='in' → throws "anchor must be outflow"
  - Test: `createReimbursement({ expenseId, refundTransactionIds })` with a refund.direction='out' → throws "refunds must be inflows"
  - Fixtures: seeded transactions with explicit direction assignments

- [ ] `tests/reimbursement-regression.test.ts` (NEW)
  - Setup: seed test transactions (N pairs with known amounts)
  - Phase 1: query old schema (transaction_pair) using current effectiveAmount() / isNotSecondary(), capture results
  - Phase 2: run migration SQL (backfill)
  - Phase 3: query new schema (reimbursement) using updated effectiveAmount() / isNotSecondary(), capture results
  - Assertion: all 8 aggregation results identical (use Decimal.js for comparison)
  - Checkpoint: explicit per-query assertions (e.g., assert `overview.totalIn` is identical before and after)

- [ ] `drizzle/migrations/00XX_reimbursement_1n.sql` (NEW)
  - CREATE TABLE reimbursement (id, userId, title, expenseId nullable, expenseGroupId nullable, createdAt)
  - CREATE TABLE reimbursement_refund (id, reimbursementId, transactionId, createdAt)
  - BACKFILL: INSERT INTO reimbursement ... SELECT (primary.expenseId, primary.createdAt) FROM transaction_pair; INSERT INTO reimbursement_refund ... SELECT (reimbursement.id, secondary.id) ...
  - Constraints: expenseId XOR expenseGroupId, FKs to expense/expenseGroup, FKs to transaction, indexes on reimbursementId

- [ ] `lib/dal/transaction-pairs-sql.ts` — Refactor
  - Rewrite `effectiveAmount()` to read from reimbursement_refund instead of transaction_pair
  - Rewrite `isNotSecondary()` to read from reimbursement_refund instead of transaction_pair
  - Add inline comment citing this phase's research

- [ ] Shared fixtures (`tests/fixtures/reimbursement-seed.ts` if needed)
  - A set of seeded transactions (outflows + inflows) with known pairing
  - Used by both invariant and regression tests

### Sampling Rate

- **Per task commit** (e.g., after generalizing effectiveAmount()):
  - Run: `./node_modules/.bin/vitest run tests/reimbursement-regression.test.ts -t "getOverviewAmountTotals"`
  - Must pass before commit

- **Per wave merge** (e.g., after refactoring all 8 aggregation sites):
  - Run: `./node_modules/.bin/vitest run` (full suite)
  - Must pass before wave merge

- **Phase gate** (before `/gsd-verify-work`):
  - Regression harness fully green (all 8 queries, all invariant tests)
  - Migration SQL tested with live backfill (if Phase-74+ uses Group anchors, run extra tests to ensure Group FKs are not broken)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Not changed; session scoped via existing DAL |
| V3 Session Management | No | Not changed |
| V4 Access Control | Yes | Ownership check: `transaction_pair` has no `userId` column (D-01 / T-50-01); migration must preserve this invariant for reimbursement/reimbursement_refund (no userId column; ownership validated via transaction FK + expense FK + service-level check). |
| V5 Input Validation | Yes | Invariant validation: anchor must be outflow (D-02), refund must be inflow (D-02). Zod schema for input validation + DB CHECK constraint. |
| V6 Cryptography | No | Not changed |

### Known Threat Patterns for This Domain

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR: one user sees another's transaction pair/reimbursement | Elevation of Privilege | Ownership check in service layer (both transactions + both expenses must belong to sessionUser). transaction_pair has no userId FK; reimbursement_refund has no userId FK. Service layer must load expense.userId and verify it matches session. |
| Data corruption: silently netting with wrong sign (e.g., outflow + outflow instead of outflow + inflow) | Tampering | Invariant D-02 (enforce via CHECK + service guard): anchor.direction = 'out', all refunds.direction = 'in'. Violation → exception thrown, no silent update. |
| Silent loss during migration: transaction_pair rows not backfilled to reimbursement | Denial of Service | Backfill SQL counts rows before/after; migration script logs counts. Regression harness compares old-model vs. new-model results; mismatch detected. |
| Tampering with amounts during netting: DECIMAL stored as string, arithmetic done in JS | Tampering | Hard rule (CLAUDE.md): all money arithmetic via Decimal.js. Migration uses SQL arithmetic (native DECIMAL math), not JS. Regression harness uses Decimal.js for comparison. |

---

## Inventory Correction (orchestrator-verified, 2026-07-23)

The `## Architecture Patterns` call-site inventory above covers the `effectiveAmount()` /
`isNotSecondary()` **helper** consumers (`lib/dal/dashboard.ts`, `lib/dal/overview.ts`,
`lib/dal/tags.ts` — 8 query functions). That part is confirmed by independent grep.

It **missed two consumers that read `transaction_pair` directly**, without going through the
helpers. Both are in scope for D-06 ("`transaction_pair` is no longer the live netting source") and
must be planned, not discovered during execution. Verified by grep on 2026-07-23:

### 1. `lib/dal/transactions.ts` — 5 raw-SQL correlated subqueries (lines ~107–160)

`pairedWithId`, `pairedNetAmount`, `pairedAmount`, `pairedDescription`, `pairedOccurredAt` are
built as `sql` fragments doing `FROM transaction_pair tp ... LIMIT 1`. They bypass
`transaction-pairs-sql.ts` entirely and feed the transaction list's pair popover.

**Why this matters:** each subquery is structurally 1:1 — `LIMIT 1` over a symmetric
`transaction_a_id / transaction_b_id` lookup with a single counterpart. Under a 1:N reimbursement
they are *semantically wrong*, not merely stale: with N refunds, `LIMIT 1` returns an arbitrary
one, and `pairedNetAmount` (`amount + t2.amount`) computes the net against that one refund instead
of the whole refund set. Pointing them at the new tables without reshaping them produces a
plausible-looking wrong number.

The planner must decide and specify: reshape these to aggregate over the refund set
(`pairedNetAmount` → sum over `reimbursement_refund`), or drop them from this phase's read path and
let Phase 75/76 rebuild the popover. Either way it is an explicit task, and the regression gate must
cover the transaction-list read path — not only the dashboard aggregates.

### 2. `lib/services/transaction-edit.ts` — the v2.5 pair guard (lines ~5, 77–81)

Imports `transactionPair` and queries it (`.from(transactionPair)`, matching on
`transaction_a_id` / `transaction_b_id`) to block an amount edit that would break a pair's
invariant.

**Why this matters:** RMB-09 (generalizing this guard to 1:N) is **Phase 74** scope, but this phase
makes `transaction_pair` stop being the live netting source. If Phase 73 migrates the data and this
guard keeps reading the old table, the guard silently stops firing for every migrated pair — a
regression that no dashboard-totals check would catch, because totals stay correct right up until
someone edits an amount.

Phase 73 must at minimum keep this guard *correct* against whatever it reads (either repoint it at
the new tables for the N=1 case, or leave `transaction_pair` populated and explicitly document the
guard as reading a dormant table until Phase 74). This is a scope-boundary decision for the planner
to make explicitly, not to inherit by accident.

### Checked and cleared (not consumers)

- `lib/dal/transaction-tags-sql.ts` — the single `isNotSecondary()` occurrence is a **doc comment**
  (line 18), not a call. No change needed.
- `lib/dal/expenses.ts` — confirmed: no `effectiveAmount` / `isNotSecondary` / `transaction_pair`
  references.

### Consequence for the regression gate (D-07)

The gate's surface is **not** just the dashboard aggregates. It is: dashboard totals + per-category
breakdown + tag totals + **the transaction-list paired-* fields** + **the amount-edit guard's
firing behaviour**. A gate that only diffs entrate/uscite passes while two real regressions ship.

---

## Source of Authority

### Primary (HIGH confidence)

- **ADR 0018** (`docs/adr/0018-reimbursement-1n-linking-supersedes-net-by-subcategory.md`) — locked architectural decisions (D-01 through D-07), consequences, and open-to-discuss details (Q2, Q3).
- **CLAUDE.md** — project hard rules (Decimal.js, db.transaction for ownership-validating writes, layering).
- **Codebase verification** (grepped, read, linked):
  - `lib/dal/transaction-pairs-sql.ts` — exact SQL for effectiveAmount() and isNotSecondary().
  - `lib/db/schema.ts` — table definitions, relations (expense.transactions: many).
  - `lib/dal/dashboard.ts`, `overview.ts`, `tags.ts` — 8 call sites inventoried.
  - `lib/dal/transaction-pairs.ts`, `lib/services/transaction-pairs.ts` — service-layer patterns (Decimal.js usage, ownership guards).
  - `tests/dashboard-dal.test.ts` — test infrastructure and mocking patterns.
  - `drizzle/migrations/0022_wonderful_eternals.sql` — backfill precedent (UPDATE + ALTER SET NOT NULL).

### Secondary (MEDIUM confidence)

- **Project memory (MEMORY.md)** — context on migration patterns and Phase 50 pairing model.
- **REQUIREMENTS.md** — RMB-01 through RMB-05 specifications.

### Tertiary (LOW confidence, marked [ASSUMED])

- None at this stage; all core claims are verified against source.

---

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — Drizzle ORM, PostgreSQL, Decimal.js are project standards; versions from package.json or inferred from schema patterns.
- Architecture: **HIGH** — ADR 0018 is locked; call-site inventory grepped and verified; month derivation confirmed in SQL.
- Pitfalls: **HIGH** — derived from Phase 50 research (50-RESEARCH.md references in codebase) + patterns visible in dashboard.ts.
- Schema generalization: **HIGH** — existing transaction_pair schema and effectiveAmount() implementation fully understood.
- Migration mechanics: **HIGH** — precedent in 0022 backfill pattern; drizzle-kit and migrate.ts behavior confirmed.
- Testing: **HIGH** — Vitest framework and mocking patterns observed in dashboard-dal.test.ts.

**Research date:** 2026-07-23
**Valid until:** 2026-08-06 (14 days; stable architecture, no framework changes expected)

**Open ambiguities resolved:**
- Q2 (multi-month anchors): Single-period netting confirmed by code inspection. No change to month-derivation logic needed.
- Q3 (per-transaction attribution): Correctness verified. Existing per-transaction logic in effectiveAmount() handles multi-transaction Expenses correctly.
