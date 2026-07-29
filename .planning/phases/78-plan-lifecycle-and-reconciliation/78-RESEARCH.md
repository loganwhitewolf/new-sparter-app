# Phase 78: plan-lifecycle-and-reconciliation - Research

**Researched:** 2026-07-28
**Domain:** Amortization plan lifecycle (close, realize, reimburse), transaction edit invariant
**Confidence:** HIGH

## Summary

Phase 78 delivers the complete lifecycle of an amortization plan: closing it (collapsing future instalments onto the closure month), realizing it via a linked sale transaction (netting the sale against the closure month), reducing and re-spreading it on a partial reimbursement, and blocking or reconciling edits to the source transaction to prevent desynchronization.

The model is **fully locked by ADR 0019 §7–§8 and 78-CONTEXT.md decisions D-01 through D-04** — there is no architecture to explore, only implementation seams to wire. Phase 77 has already shipped the foundation: the `amortization_plan` and `amortization_instalment` schema, the `ledger_entry` seam views (cash/accrual), and the eligibility guards (D-04..D-08). Phase 78 adds four lifecycle services (close, realize, reimburse-redistribute) and one edit guard extension, all atomic write operations inside `db.transaction`.

**Primary recommendation:** Implement the four lifecycle services as methods on a new `lib/services/amortization-lifecycle.ts` file, each accepting `DbOrTx` and reusing the `materializeInstalments` math and `deriveResidualFromAggregates` residual logic. Extend `transaction-edit.ts`'s pair-guard pattern with an amortization-plan branch. All writes must keep `tests/reimbursement-regression.test.ts` (LENS-03) green under the cash lens.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Plan closure & collapse | Backend/API (service layer) | — | Materializes future instalments to closure month; touches multiple rows atomically |
| Realization via sale netting | Backend/API (service layer) | — | Reuses v2.8 reimbursement linking; nets sale against closure-month instalment (Mondo Netto exception) |
| Reimbursement-linked redistribution | Backend/API (service layer) | — | Reduces plan base, re-spreads remaining instalments proportionally; atomic multi-row update |
| Edit amount/date block | Backend/API (service layer, guard) | Frontend (mirror validation, sync state) | Pair-guard pattern; prevents source transaction desynchronization from plan |
| Residual validation (over-residual block) | Backend/API (service layer, guard) | — | Reuses residual computation from v2.8; blocks re-spread if amount exceeds remaining |

## Standard Stack

### Core (Phase 77 foundation — use directly)

| Library / Module | Version | Purpose | Why Standard |
|---|---|---|---|
| `lib/services/amortization-math.ts` | Phase 77 (AMORT-03) | `materializeInstalments()` — uniform instalment spread + remainder-on-first + month clamping | Pure function, zero-drift client/server consistency; reuse for D-01 collapse + D-03 redistribute |
| `lib/services/amortization-activation.ts` | Phase 77 (AMORT-01/02) | `activatePlanTx()` — detach + plan insert + instalment materialisation | Establishes DbOrTx pattern for atomic multi-write; reverseDetachTx() for D-09 undo |
| `lib/services/amortization-guards.ts` | Phase 77 (D-04..D-08) | `getAmortizationEligibility()` — reimbursement/already-amortized/expense-group/not-outflow/too-small | D-03a keeps D-04 (Phase 77); no loosening needed for D-03 (amortize-first-then-reimburse order unchanged) |
| `lib/db/schema.ts` ~L646–715 | Phase 77 (migration 0033) | `amortizationPlan` + `amortizationInstalment` tables | `status` (open/closed), `totalAmount` snapshot at activation; instalment `amount`/`occurredAt` immutable once materialized |
| `lib/db/schema.ts` ~L717+ | Phase 77 (migration 0033) | `ledger_entry_cash` / `ledger_entry_accrual` views | Seam rows resolve `amount` once; instalments carry their own materialized amount, never passed through `effectiveAmount()` (structurally prevents double-netting trap, ADR 0019 §10) |

### Reused from v2.8 Reimbursement (D-02/D-03 netting)

| Library / Module | Purpose | Reuse Pattern |
|---|---|---|
| `lib/services/reimbursement.ts` | `deriveResidualFromAggregates()`, residual states (owed/settled/surplus) | D-03 over-residual block: if new-refund amount > plan's residual, reject with "usa 'chiudi per vendita'." |
| `lib/services/transaction-pairs.ts` | `createPairTx()` — anchor + refund linking, netting write | D-02 realize: link sale transaction to plan, nest inside close-for-sale operation |
| `lib/dal/transaction-pairs-sql.ts` | `effectiveAmount()` / `isNotSecondary()` fragments (DEPRECATED for new reads) | Pre-existing; no new code calls these on instalment rows |

### Edit Guard (D-04 — reuse pair-guard pattern from v2.5/v2.8)

| File | Purpose | Reuse Pattern |
|---|---|---|
| `lib/services/transaction-edit.ts` | `buildPairGuardMessage()`, amount/date guard detection | Extend with amortization-plan FK check; same message model (N>1 reads reimbursement title; reuse for plan base? — see Pitfall 1) |
| `lib/actions/transaction-edit.ts` | Action wrapper, error passthrough | No changes needed; service-layer message bubbles to UI verbatim |

### Validation & Regression Testing

| Test Suite | Purpose | Required for Phase 78 |
|---|---|---|
| `tests/reimbursement-regression.test.ts` | LENS-03: real-Postgres byte-identical cash lens after lifecycle writes (v2.8 reimbursement regression gate pattern) | **MUST stay green** — every close/realize/reimburse write is tested for cash-lens invariance |
| `tests/amortization-*.test.ts` | Phase 77 unit tests (math, guards, activation, undo) | Foundation; Phase 78 adds amortization-lifecycle.test.ts |

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Frontend UI (minimal)                            │
│  ├─ Transaction row/detail: close/realize/reimburse actions         │
│  └─ Intent dialog (D-03): "Chiudi per vendita" vs "Rimborso parziale"│
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Action Layer (lib/actions/)                         │
│  ├─ closePlanAction(planId, closure-month)                           │
│  ├─ realizePlanAction(planId, saleTransactionId)                     │
│  ├─ reimbursePlanAction(planId, reimbursementId, intent)             │
│  └─ updateTransactionAction(+amortization guard)                     │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Service Layer (lib/services/)                           │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ amortization-lifecycle.ts (PHASE 78)                          │  │
│  │  ├─ closePlanTx(tx, {planId, closureMonth})                  │  │
│  │  │  ├─ load plan (status check)                              │  │
│  │  │  ├─ delete remaining instalments (month > closure)        │  │
│  │  │  ├─ create ONE closure-month instalment (summed remaining)│  │
│  │  │  └─ set plan.status = 'closed'                            │  │
│  │  ├─ realizePlanTx(tx, {planId, saleTransactionId})           │  │
│  │  │  ├─ closePlanTx (collapse remaining)                      │  │
│  │  │  ├─ createPairTx (reuse v2.8, nets sale at closure month) │  │
│  │  │  └─ plan.status = 'closed'                                │  │
│  │  ├─ reimbursePlanTx(tx, {planId, refundAmount, intent})      │  │
│  │  │  ├─ if intent='chiudi per vendita': realizePlanTx        │  │
│  │  │  └─ if intent='rimborso parziale':                        │  │
│  │  │     ├─ validate residual (refund ≤ remaining base)        │  │
│  │  │     ├─ reduce plan.totalAmount by refund                  │  │
│  │  │     ├─ delete future instalments                          │  │
│  │  │     ├─ re-spread remaining instalments (reuse math)       │  │
│  │  │     └─ plan.status stays 'open'                           │  │
│  │  └─ Helpers: deriveResidualFromPlan(), loadPlanWithStatus()  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ transaction-edit.ts (PHASE 78 EXTENSION)                      │  │
│  │  └─ updateTransaction(+amortization guard)                    │  │
│  │     ├─ existing reimbursement pair guard (unchanged)          │  │
│  │     ├─ NEW: amortization-plan FK check                        │  │
│  │     │   if amount/date being edited AND plan exists → BLOCK   │  │
│  │     └─ subcategory edits allowed (derives via Expense)        │  │
│  └────────────────────────────────────────────────────────────────┘  │
│  Reused (v2.8):                                                      │
│  ├─ reimbursement.ts: deriveResidualFromAggregates()                 │
│  ├─ transaction-pairs.ts: createPairTx()                             │
│  └─ amortization-math.ts: materializeInstalments()                   │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Data Access & Database (lib/dal/, lib/db/)              │
│  ├─ amortization_plan (select by id, update status/months/amount)  │
│  ├─ amortization_instalment (delete by planId, bulk insert)         │
│  ├─ transaction_pairs / reimbursement (createPairTx netting)        │
│  └─ db.transaction { ... } — atomicity                              │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Validation (LENS-03)                                │
│  └─ tests/reimbursement-regression.test.ts                           │
│     └─ cash lens byte-identical after every lifecycle write         │
└─────────────────────────────────────────────────────────────────────┘
```

### Close & Collapse (D-01, AMORT-04)

**What:** An open plan's remaining (future) instalments are deleted, their summed value is materialized onto a single closure-month instalment, and past instalments stay untouched.

**Operational outline:**
1. Load plan (ownership check, status=open validation)
2. Compute remaining value: sum of all future (`occurredAt` ≥ closure-month-start)
3. Delete all future instalment rows
4. Create ONE new instalment on the closure month with the remaining sum
5. Set `plan.status = 'closed'`, `plan.updatedAt = now`
6. All inside `db.transaction` for atomicity

**Decimal.js details:**
- Remaining sum is computed with `toDecimal()` + `plus()` across each instalment's `amount` (a string)
- Result written to DB via `toDbDecimal()`; no rounding on sum (already rounded per-instalment from Phase 77)

**Closure month determination (D-02a):**
- If realizing via sale: closure month = linked sale transaction's `occurredAt`
- If scrapping (no sale): closure month = the close-action's month (user-supplied or today's month)
- Implementation: closure month is a parameter; caller determines which

**Reversibility (D-01):** Costly — re-materialisating the original schedule is deterministic but requires persisting the original `months` count. Phase 77 already stores this on `amortization_plan.months`, so reversal is theoretically possible but deferred ("plan re-open out of scope").

### Realize via Sale (D-02, AMORT-05)

**What:** Close a plan with a realization value by linking a sale transaction and netting it against the closure month (Mondo Netto exception per ADR 0019 §8).

**Operational outline:**
1. Call `closePlanTx` (collapse remaining to closure month)
2. Call `createPairTx(anchor={transactionId: planTransactionId}, refund={transactionId: saleTransactionId})` to link the sale
   - This creates a `reimbursement` row + `reimbursement_refund` row
   - Netting resolves inside `ledger_entry` (never hand-rolled here)
   - Sale is a real transaction in the DB, not synthetic
3. Set plan status to closed
4. All inside one `db.transaction` for atomicity

**Netting behavior (§8 exception to Mondo Netto):**
- Normal Mondo Netto: a refund nets at the cost month (where the outflow occurred)
- Sale netting: the sale nets at the **closure month** (not the purchase month)
- This is why `createPairTx` must be called AFTER the closure instalment is materialized on the closure month
- Over-recovery (sale > remaining): correctly produces positive net (extraordinary income), never blocked

**Decimal.js:** Sale amount is signed (negative, since it's an inflow reimbursing an outflow); `createPairTx` handles netting internally via `effectiveAmount()`.

**Reversibility (D-02):** Costly — requires deleting both the plan's closure and the paired reimbursement link. Deferred.

### Reimbursement on an Open Plan (D-03, AMORT-06)

**What:** When a reimbursement/inflow is linked to a transaction with an open amortization plan, the system prompts the user to declare intent (close-for-sale vs partial-refund), then routes to the appropriate path.

**Intent Prompt (UX boundary):**
- **"Chiudi per vendita"** → routes to `realizePlanTx` (collapse + sale netting)
- **"Rimborso parziale (ridistribuisci)"** → reduces base + re-spreads remaining (plan stays open)
- Mechanics: this is UI logic that calls different action functions based on user choice; the phase research documents the two underlying service paths

#### Partial-Refund Path: Reduce Base & Re-Spread

**Operational outline:**
1. Load plan (status=open validation)
2. Compute plan residual (remaining un-spread base) from `plan.totalAmount` and previously-consumed instalments
3. **Guard:** if refund amount > residual → reject with message "supera il residuo — usa 'chiudi per vendita'."
4. Reduce plan base: `newBase = plan.totalAmount - refundAmount` (Decimal.js)
5. Delete all future instalments (same as closure path)
6. Compute remaining months: `remainingMonths = instalmentCount - (now.month - startDate.month)` (round toward zero)
7. Re-materialize instalments from `newBase`, `nextMonthAfterNow`, `remainingMonths` using `materializeInstalments()`
   - Remainder lands on the **month of reduction** (ADR 0019 §8; implementable by starting from `nextMonthAfterNow` rather than `startDate`)
8. Update `plan.totalAmount = newBase`, set `plan.updatedAt = now`
9. **Plan status stays `open`** — the asset is kept
10. All inside `db.transaction`

**Over-residual guard (D-03 boundary):**
- Residual = `plan.totalAmount - (sum of already-consumed instalments)`
- If refund ≥ residual: this is realization, not partial reduction → block and redirect to "chiudi per vendita"
- Computed once, inside the guard, before any write

**Remaining months calculation:**
- If plan started 2026-01-15 and is now 2026-04-20, and was 12 months total:
  - Months elapsed = 3 (Jan, Feb, Mar); current month is Apr
  - Remaining = 12 - 3 = 9 months (Apr–Dec)
  - Next month to materialize = Apr (the month of reduction, where remainder lands)
  - Re-spread `newBase` over Apr–Dec

**Decimal.js:** Same pattern as materialize (base / months, remainder on first).

**Reversibility (D-03):** Deterministic from the base, but rewrites materialised rows — re-spread mutation is costly. Deferred.

### Edit Invariant (D-04, AMORT-07)

**What:** Editing the **amount or date** of a transaction with an amortization plan is **BLOCKED**. Editing **subcategory** is allowed (derives via the Expense, never desyncs).

**Operational outline:**
1. In `transaction-edit.ts`, extend the pair-guard check (D-03/T-62-03) with a new amortization-plan branch
2. **Check:** `SELECT COUNT(*) FROM amortization_plan WHERE transactionId = ? AND status = 'open'`
   - If found: throw rejection message (Italian)
3. Guard predicate: `amount !== undefined || occurredAt !== undefined`
   - Only block if amount OR date is being edited
   - Subcategory edits (via linked Expense, not Transaction) always allowed
4. Message pattern: "Rimuovi ammortamento per modificare l'importo o la data della transazione."
   - Points user to Phase 77's D-09 ("rimuovi ammortamento" undo action)

**Rationale (D-04 justification):**
- Reconciling an amount edit would require rewriting the purchase-month instalment (a past, possibly closed month)
- ADR 0019 §7: "never rewrite a closed month" — the purchase month is where the plan started, so it's the oldest month and likely closed for categorization
- Hard block via guard (reversible predicate) is simpler and safer than trying to auto-recompute
- Escape hatch: remove the plan (Phase 77 D-09), edit the transaction, re-amortize

**Implementation seam:**
- The guard runs BEFORE any write in `updateTransaction()`
- Reuse the pair-guard pattern: role detection (is this transaction involved in a plan?), then condition check
- Message delivery: same as pair-guard (service throws, action catches, bubbles to UI verbatim)

**Snapshot note:**
- `amortization_plan.totalAmount` is the **authoritative base**, captured at activation and independent of the (now-blocked) `transaction.amount`
- Drift detection (defense-in-depth): if `transaction.amount ≠ plan.totalAmount` ever occurs in production (soft-edit slip-through), the invariant amount is the source of truth for re-spread / closure

**Subcategory edits stay allowed (D-13):**
- Subcategory derives from the Expense (via `transaction.expenseId → expense.subCategoryId`), not from the Transaction
- Editing `expense.subCategoryId` via the Expense detail page or categorization flow never touches `transaction.amount`
- Since subcategory is already guarded separately (D-13, non-amortized), amortization adds no extra check

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Instalment spread + rounding | Custom division logic + per-month remainder handling | `materializeInstalments()` (Phase 77, amortization-math.ts) | Already proven in Phase 77 AMORT-03 + client-side dialog; zero-drift client/server consistency |
| Residual calculation (reimbursement ≥ plan remaining) | Inline SUM + subtraction | `deriveResidualFromAggregates()` (reimbursement.ts) + load-and-check | v2.8 proven; exact formula signed-based owed/settled/surplus |
| Sale netting into a plan | Synthetic transaction + manual amount adjustment | `createPairTx()` (transaction-pairs.ts, v2.8) + `effectiveAmount()` (ledger_entry seam) | Reuses v2.8's proven netting path; cash lens reconciliation guaranteed by ledger_entry |
| Month-clamping for instalment dates | Native JS Date month overflow + string formatting | `addMonthsClamped()` (amortization-math.ts, Phase 77) | Already handles 31/1 → 28/2 edge case; clamped-day logic proven |
| Identifying if a transaction has a plan | Manual plan table query + ownership check | Single-row `SELECT ... FROM amortization_plan WHERE transactionId = ? ... LIMIT 1` correlated in transaction-edit.ts | Matches pair-guard role-detection pattern; cheap + proven |

## Common Pitfalls

### Pitfall 1: Confusing closure month with purchase month (D-01 / D-02 boundary)

**What goes wrong:** The closure month is the month where the remaining value materializes, which is different from the purchase month (where the plan started). Closing a plan on 2026-08-15 with a purchase date of 2026-01-15 means creating an instalment on 2026-08-01 (or the sale's `occurredAt`), NOT 2026-01-15.

**Why it happens:** The term "closure" is ambiguous; "close" and "purchase" both sound like they reference the origin.

**How to avoid:** Store the closure month as an explicit parameter passed to `closePlanTx()`. Compute it as:
- If sale is linked: `closureMonth = sale.occurredAt` (D-02a)
- If scrapping: `closureMonth = today or user-supplied month`

**Warning signs:** A closure instalment materializing on the purchase month instead of the closure month; a re-spread starting from the wrong month.

### Pitfall 2: Double-netting trap — instalment amount passed to effectiveAmount() (ADR 0019 §10)

**What goes wrong:** An instalment row has an amount already spread (e.g., €100/mo from a €1200 plan). If that amount is later passed to `effectiveAmount()` and also a reimbursement is linked (at the plan level, not instalment level), the refund could spread across the instalment amount a second time, producing a wrong net.

**Why it happens:** The seam design (one `ledger_entry` row source per lens) is supposed to prevent this; but if new code calls `effectiveAmount()` on an instalment row, the trap re-opens.

**How to avoid:** The ledger_entry seam resolves amount ONCE, inside the row source SQL. No code outside the row source should ever call `effectiveAmount()` or `isNotSecondary()` on an instalment row. Instalments come from the `ledger_entry` view, already carrying their final amount; never pass their amount through fragment functions.

**Warning signs:** Dashboard totals spike or drop unexpectedly when a reimbursement is linked to an amortized transaction's plan; regression test (`tests/reimbursement-regression.test.ts`) fails.

### Pitfall 3: Remaining balance computation for re-spread (D-03 guard)

**What goes wrong:** The residual (remaining un-spread base) is computed as `totalAmount - sumOfConsumeds`, but "consumed" is ambiguous: does it mean instalments with `occurredAt` in the past, or instalments with index < currentIndex?

**Why it happens:** Calendar months and instalment indices are off-by-one-prone when the plan started mid-month or when today is mid-month.

**How to avoid:** Define "remaining" as: `sumOfInstalmentsWithOccurredAt >= now (start of current month)`. Use this for the guard. For re-spread, recalculate remaining months using the same logic.

**Warning signs:** The over-residual guard allows a refund that should be blocked; a re-spread produces instalments with `occurredAt` in the past or produces negative instalment amounts.

### Pitfall 4: Confusing plan.totalAmount (base snapshot) with transaction.amount (now-blocked)

**What goes wrong:** After D-04 blocks transaction edits, code might still try to read `transaction.amount` to compute a residual or re-spread base, ignoring that the transaction's amount could be stale (soft-edited by a past bypass or migration).

**Why it happens:** `transaction.amount` is a field that exists; `plan.totalAmount` is a new one that's less obvious.

**How to avoid:** Always use `plan.totalAmount` for lifecycle calculations (closure, re-spread, residual guard). `transaction.amount` is only used for the audit trail (e.g., "drift if not equal") or initial eligibility checks (Phase 77 D-07).

**Warning signs:** A re-spread produces different instalment amounts on the second call; a residual guard produces inconsistent rejections.

### Pitfall 5: Atomicity: forgetting to pass tx parameter through the call stack

**What goes wrong:** A lifecycle operation (close, realize, reimburse) calls multiple helper functions, but one of them calls `db.query()` instead of accepting `DbOrTx`, causing that operation to run outside the transaction and potentially leaving the plan in an inconsistent state.

**Why it happens:** Easy to miss when composing existing functions; `DbOrTx` pattern is newer.

**How to avoid:** Every helper must accept `DbOrTx`, never import and call `db` directly. Type signature: `async function(..., tx: DbOrTx): Promise<...>`. Linter/TypeScript should catch this if strict enough.

**Warning signs:** A close operation writes the closure instalment but not the plan status update; a reimbursement operation reduces the base but doesn't delete future instalments.

### Pitfall 6: Subcategory edit allowed, but Expense title edit confusion

**What goes wrong:** The amortization edit guard only blocks amount/date on the Transaction. But a user edits the Expense title (which rolls up to the Plan's isolation), and then expects the plan to recompute or regather.

**Why it happens:** D-04 explicitly allows subcategory edits but doesn't mention title edits. The distinction is: subcategory affects the instalment categorization (via the Standalone Expense); title affects display only.

**How to avoid:** Document clearly: subcategory edits (categorize the Expense) are allowed because they affect the instalment rows' categorization via the `expenseId` FK. Title edits are also allowed (it's metadata, never affects netting or spread). Only amount and date edits are blocked because they would require rewriting past months.

**Warning signs:** User edits an expense title and complains the plan doesn't update; user edits subcategory and gets an unexpected block.

## Runtime State Inventory

**Trigger:** Phase 78 involves lifecycle mutations (close, realize, reimburse-redistribute) that rewrite materialised instalment rows.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Amortization plans (open/closed) + instalment rows materialised by Phase 77; no plans exist in production yet | None — Phase 77 is the first schema; Phase 78 writes are append + update |
| Live service config | None — Phase 78 is pure backend service layer | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None | None |

**Verified:** Phase 77 just shipped; no production amortization data exists yet. Phase 78 is the first lifecycle consumer.

## Code Examples

All examples reuse Phase 77 patterns plus v2.8 reimbursement logic.

### D-01: Close & Collapse Pattern

```typescript
// Source: lib/services/amortization-lifecycle.ts (Phase 78 new file)
import { eq, lt, gte } from 'drizzle-orm'
import { amortizationPlan, amortizationInstalment } from '@/lib/db/schema'
import { materializeInstalments, type Instalment } from '@/lib/services/amortization-math'
import { toDecimal, toDbDecimal } from '@/lib/utils/decimal'

export async function closePlanTx(
  tx: DbOrTx,
  input: {
    userId: string
    planId: string
    closureMonth: Date // Date of the closure instalment (sale.occurredAt or user-supplied)
  },
): Promise<{ remainingValue: string; closureInstalmentId: string }> {
  // Load plan + ownership check
  const plans = await tx
    .select({ id: amortizationPlan.id, status: amortizationPlan.status, startDate: amortizationPlan.startDate })
    .from(amortizationPlan)
    .where(and(eq(amortizationPlan.id, input.planId), eq(amortizationPlan.userId, input.userId)))
    .limit(1)
  const plan = plans[0]
  if (!plan) throw new Error('Plan not found.')
  if (plan.status !== 'open') throw new Error('Plan is already closed.')

  // Load all future instalments (month >= closure month)
  const closureMonthStart = new Date(input.closureMonth.getFullYear(), input.closureMonth.getMonth(), 1)
  const futureInstalments = await tx
    .select({ id: amortizationInstalment.id, amount: amortizationInstalment.amount })
    .from(amortizationInstalment)
    .where(and(
      eq(amortizationInstalment.planId, input.planId),
      gte(amortizationInstalment.occurredAt, closureMonthStart),
    ))

  // Compute remaining sum (Decimal.js)
  const remainingSum = futureInstalments.reduce(
    (acc, inst) => acc.plus(toDecimal(inst.amount)),
    toDecimal('0'),
  )

  // Delete future instalments
  await tx.delete(amortizationInstalment)
    .where(and(
      eq(amortizationInstalment.planId, input.planId),
      gte(amortizationInstalment.occurredAt, closureMonthStart),
    ))

  // Create ONE closure-month instalment carrying the remaining value
  const closureInstalmentId = randomUUID()
  await tx.insert(amortizationInstalment).values({
    id: closureInstalmentId,
    userId: input.userId,
    planId: input.planId,
    instalmentNumber: futureInstalments.length + 1, // New number (gapped from past)
    expenseId: plan.expenseId, // The standalone expense
    amount: toDbDecimal(remainingSum),
    occurredAt: input.closureMonth,
  })

  // Update plan status
  await tx.update(amortizationPlan)
    .set({ status: 'closed', updatedAt: new Date() })
    .where(eq(amortizationPlan.id, input.planId))

  return { remainingValue: toDbDecimal(remainingSum), closureInstalmentId }
}
```

### D-03: Over-Residual Guard Pattern

```typescript
// Source: lib/services/amortization-lifecycle.ts (Phase 78 new file)
import { deriveResidualFromAggregates } from '@/lib/services/reimbursement'
import { getReimbursementAggregates } from '@/lib/dal/reimbursement'

export async function validateReimbursementResidual(
  tx: DbOrTx,
  input: {
    planId: string
    refundAmount: string // Proposed refund amount (Decimal string)
  },
): Promise<{ valid: true } | { valid: false; message: string }> {
  // Load plan + get current materialised sum
  const plan = ... // SELECT totalAmount FROM amortization_plan
  const consumedSum = ... // SUM of past instalments (occurredAt < now)
  
  const residual = toDecimal(plan.totalAmount).minus(toDecimal(consumedSum))
  const proposedRefund = toDecimal(input.refundAmount)

  if (proposedRefund.gt(residual)) {
    return {
      valid: false,
      message: `Rimborso di €${proposedRefund.toFixed(2)} supera il residuo €${residual.toFixed(2)} — usa 'chiudi per vendita'.`,
    }
  }

  return { valid: true }
}
```

### D-04: Edit Guard Extension Pattern

```typescript
// Source: lib/services/transaction-edit.ts (extend updateTransaction)
// The existing pair-guard code already runs; add this branch:

if (input.amount !== undefined || input.occurredAt !== undefined) {
  // Phase 78 D-04: check for amortization plan (amount/date block)
  const amortizationRows = await tx
    .select({ id: amortizationPlan.id })
    .from(amortizationPlan)
    .where(
      and(
        eq(amortizationPlan.transactionId, input.transactionId),
        eq(amortizationPlan.status, 'open'),
      ),
    )
    .limit(1)

  if (amortizationRows.length > 0) {
    throw new Error(
      'Rimuovi ammortamento per modificare l\'importo o la data della transazione.',
    )
  }

  // Then continue with the existing pair-guard code (reimbursement check)
  // ...
}
```

## Validation Architecture

**Framework:** vitest + real-Postgres (local Docker Postgres required for test harness)

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest + reimbursement-regression harness (Phase 73, LENS-03) |
| Config file | `vitest.config.ts` (inherited from Phase 77) |
| Quick run command | `yarn test amortization-lifecycle.test` |
| Full suite command | `yarn test` (all files) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File |
|--------|----------|-----------|-------------------|------|
| AMORT-04 | Close plan: remaining instalments collapse onto closure month, past stay untouched | Unit + Integration | `yarn test amortization-lifecycle.test -- --grep "close.*collapse"` | `tests/amortization-lifecycle.test.ts` |
| AMORT-04 | Closing with no sale = scrapped asset (remaining value on closure month, no reimbursement link) | Integration | `yarn test amortization-lifecycle.test -- --grep "close.*scrap"` | `tests/amortization-lifecycle.test.ts` |
| AMORT-05 | Close with sale: remaining + sale netting via createPairTx, net lands on closure month | Integration (reuse v2.8 pattern) | `yarn test amortization-lifecycle.test -- --grep "realize.*sale"` | `tests/amortization-lifecycle.test.ts` |
| AMORT-05 | Over-recovery (sale > remaining): produces positive net, never blocked | Integration | `yarn test amortization-lifecycle.test -- --grep "over.*recovery"` | `tests/amortization-lifecycle.test.ts` |
| AMORT-06 | Partial refund: reduce base + re-spread remaining instalments proportionally | Unit + Integration | `yarn test amortization-lifecycle.test -- --grep "reimburse.*redistribute"` | `tests/amortization-lifecycle.test.ts` |
| AMORT-06 | Over-residual block: refund > residual → reject with "usa 'chiudi per vendita'" message | Unit | `yarn test amortization-lifecycle.test -- --grep "over.*residual"` | `tests/amortization-lifecycle.test.ts` |
| AMORT-07 | Edit amount blocked: transaction with open plan cannot have amount edited | Unit + Integration | `yarn test transaction-edit.test -- --grep "amortization.*block"` | `tests/transaction-edit.test.ts` (extend) |
| AMORT-07 | Edit date blocked: transaction with open plan cannot have date edited | Unit + Integration | `yarn test transaction-edit.test -- --grep "amortization.*date"` | `tests/transaction-edit.test.ts` (extend) |
| AMORT-07 | Edit subcategory allowed: Expense recategorization still works | Integration | `yarn test transaction-edit.test -- --grep "amortization.*subcategory"` | `tests/transaction-edit.test.ts` (extend) |
| LENS-03 | Cash lens byte-identical after every lifecycle write | Regression (real-Postgres) | `yarn test reimbursement-regression.test` (runs entire suite) | `tests/reimbursement-regression.test.ts` |

### Sampling Rate
- **Per task commit:** `yarn test amortization-lifecycle.test`
- **Per wave merge:** `yarn test` (full suite, including regression)
- **Phase gate:** LENS-03 regression (cash lens) must be green before shipping Phase 78

### Wave 0 Gaps
- [ ] `tests/amortization-lifecycle.test.ts` — Phase 78 new file; covers D-01/D-02/D-03 paths (close, realize, reimburse-redistribute)
- [ ] `tests/transaction-edit.test.ts` — extend with D-04 amortization-plan guard cases
- [ ] `lib/services/amortization-lifecycle.ts` — Phase 78 new file; `closePlanTx` / `realizePlanTx` / `reimbursePlanTx` + helpers

*(No framework install or config needed; reuses Phase 77 vitest setup and v2.8 reimbursement-regression harness.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | No | Session checks (proxy.ts) — unchanged; phase does not introduce auth surfaces |
| V3 Session Management | No | Better Auth — unchanged |
| V4 Access Control | Yes | userId scoping in every query; `amortizationPlan.userId` FK + WHERE clause (same pattern as reimbursement.ts) |
| V5 Input Validation | Yes | Zod schemas for closure-month, refund-amount (action wrappers); server-side guard re-validation (D-04 amortization check) |
| V6 Cryptography | No | Monetary storage uses Decimal.js (no crypto) |

### Known Threat Patterns for {Amortization Lifecycle}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized plan closure | Elevation of Privilege | All queries scope by `userId`; ownership check before any write |
| SQL injection (dates, amounts) | Tampering | Decimal.js validates strings; Date objects from action layer (Zod); Drizzle parameterized queries |
| Transaction desynchronization via soft edit | Tampering | D-04 guard blocks amount/date edits after plan exists; `amortization_plan.totalAmount` snapshot is authoritative |
| Double-netting trap (instalment passed to effectiveAmount) | Information Disclosure | Seam design: `ledger_entry` resolves amount once, inside row source; no code outside calls `effectiveAmount()` on instalment rows |
| Over-residual allowing negative instalments | Information Disclosure | D-03 guard validates refund ≤ residual before any write; remainder-on-first logic in `materializeInstalments` ensures no negative amounts |

## Code Seams & Integration Points

### New Services (Phase 78)

**File:** `lib/services/amortization-lifecycle.ts`
- `closePlanTx(tx, {userId, planId, closureMonth})`: collapse remaining, create closure instalment, set status=closed
- `realizePlanTx(tx, {userId, planId, saleTransactionId, closureMonth})`: call closePlanTx, then createPairTx for netting
- `reimbursePlanTx(tx, {userId, planId, refundAmount, intent})`: validate residual, call reducePlanTx or realizePlanTx
- `reducePlanTx(tx, {userId, planId, refundAmount, closureMonth})`: reduce base, delete future, re-materialize
- Helpers: `deriveResidualFromPlan()`, `loadPlanWithStatus()`, `loadConsumedInstalments()`

### Extended Services (Phase 78)

**File:** `lib/services/transaction-edit.ts`
- Extend `updateTransaction()` with amortization-plan FK check (D-04 guard)
- Reuse pair-guard pattern: role detection correlated subquery + condition check

### Action Wrappers (Phase 78)

**File:** `lib/actions/amortization-lifecycle.ts` (new)
- `closePlanAction(planId, closureMonth)`: parse inputs, call closePlanTx
- `realizePlanAction(planId, saleTransactionId)`: parse, call realizePlanTx
- `reimbursePlanAction(planId, refundAmount, intent)`: parse, call reimbursePlanTx
- Message passthrough: service-layer Italian errors bubble to UI verbatim (same as updateTransactionAction)

### DAL Extensions (minimal — leverage existing)

**No new DAL functions needed.** Use direct Drizzle queries inside service layer:
- `tx.select(...).from(amortizationPlan)` (existing table)
- `tx.select(...).from(amortizationInstalment)` (existing table)
- `tx.insert(amortizationInstalment).values(...)` (existing table)
- `tx.delete(amortizationInstalment).where(...)` (existing table)
- Reuse `createPairTx()` from `lib/services/transaction-pairs.ts` (v2.8)
- Reuse `deriveResidualFromAggregates()` from `lib/services/reimbursement.ts` (v2.8)

### UI Integration (Phase 78 minimal surfaces)

**Phase 78 delivers backend lifecycle only.** UI surfaces ship in Phase 79 (registry) and Phase 80 (dashboard lens).

Minimal Phase 78 surfaces to exercise the backend:
- Transaction row/detail page: "Chiudi", "Realizza", "Rimborso" action buttons (gated on plan status + ownership)
- Reimbursement linking dialog: intent selector ("Chiudi per vendita" vs "Rimborso parziale") when target transaction has open plan
- Error messages: service-layer Italian errors displayed verbatim in action feedback

**Deferred to Phase 79:**
- `/amortizations` registry (list all plans, close from there, view residual)
- Per-plan detail page

**Deferred to Phase 80:**
- Global cassa/competenza switch
- Dashboard lens-aware widgets + accrual view

## Project Constraints (from CLAUDE.md)

- **Decimal.js mandatory:** all monetary arithmetic via `toDecimal()` / `toDbDecimal()`, no native `+` / `-` / `*` / `/`
- **Atomic imports via db.transaction:** every multi-write lifecycle operation (closePlanTx, realizePlanTx, reimbursePlanTx) must run inside `db.transaction`, accepting `DbOrTx` parameter
- **Drizzle migrations:** `drizzle-kit generate` + `scripts/migrate.ts` for any new schema (none needed for Phase 78; reuses Phase 77)
- **Layers:** DAL (queries) / Services (business logic) / Actions (thin `"use server"` wrappers)
- **Language:** English dev code/docs, Italian product surfaces (error messages are product-facing → Italian)
- **CONTEXT.md domain vocabulary:** Transaction vs Expense, Reference Period, "residuo", Mondo Netto, cassa/competenza

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `amortization_plan.months` field exists and stores the original planned duration | Code Seams | Re-spread logic needs to know how many months were originally planned; if missing, we'd need to infer from instalment count (fragile) |
| A2 | `createPairTx()` (v2.8 reimbursement linking) is the correct mechanism for D-02 sale netting | D-02 Realization Pattern | If the mechanism has changed or been deprecated since Phase 76, the netting path would break |
| A3 | Closure month = sale's `occurredAt` is the intended default (D-02a) | D-02 / Code Seams | If users expect closure month to be settable independently of the sale date, UX flow changes |
| A4 | Over-residual block message should redirect to "chiudi per vendita" (D-03) | D-03 Guard | If the intended UX is to clamp refunds or allow negative instalments, the guard would be wrong |
| A5 | `transaction-edit.ts` pair-guard already covers reimbursement checks; amortization is an additional orthogonal guard | D-04 / Code Seams | If amortization and reimbursement are mutually exclusive, a single unified guard might be simpler |

**Resolution:** All assumptions are from CONTEXT.md (locked decisions) or Phase 77/v2.8 precedent. No user confirmation needed before planning.

## Open Questions (RESOLVED)

1. **Closure month prompt (D-02a):** [RESOLVED] Should the close-for-sale action let the user override the closure month (default = sale's `occurredAt`), or always use the sale's date?
   - What we know: D-02a leaves this as "plan-phase discretion"
   - Recommendation: Use sale's date as default; no override needed for Phase 78 (can defer to Phase 79 registry)
   - **Resolution:** Implemented in 78-02 — closure month = sale's `occurredAt`, no override in Phase 78.

2. **Edit guard message for amortized transactions:** [RESOLVED] Should the message reuse the pair-guard title (e.g., "Rimuovi ammortamento") as an actionable label?
   - What we know: D-04 says "point user to 'rimuovi ammortamento' as escape hatch"
   - Recommendation: Use exact message "Rimuovi ammortamento per modificare l'importo o la data della transazione." (operationally clear, not title-dependent)
   - **Resolution:** Implemented in 78-03 — exact message adopted in the extended `transaction-edit.ts` guard.

3. **Over-residual edge case:** [RESOLVED] If a refund exactly equals the residual (zero remainder), should it succeed (as "chiudi per vendita") or be treated differently?
   - What we know: D-03 says "exceeds the residual" → block; equals is not specified
   - Recommendation: Allow it (refund ≤ residual); equals is the boundary condition. Zero-remainder re-spread is valid (last month gets zero, plan ends).
   - **Resolution:** Implemented in 78-02 — `refund > residual` blocks; `refund == residual` is the allowed boundary.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|
| PostgreSQL (local Docker) | LENS-03 regression tests (reimbursement-regression.test.ts) | ✓ (dev environment) | 14+ | Tests skip gracefully with console warning if unreachable |
| Node.js | Build / test runtime | ✓ | 18+ (per project) | — |
| Decimal.js | Monetary arithmetic (required) | ✓ (already in package.json) | 10.x | No fallback; hard requirement |

**Missing dependencies with fallback:**
- Docker Postgres unavailable → regression tests skip with warning; full suite still runs for unit tests

**Missing dependencies blocking execution:**
- None for Phase 78; reuses Phase 77 schema + v2.8 reimbursement patterns

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Single transaction_pair netting (N=1 only) | Generalized reimbursement 1:N linking (Phase 73, ADR 0018) | 2026-06-20 (Phase 73) | Phase 78 reuses the same createPairTx mechanism for sale netting |
| Hand-rolled instalment math (client-side only) | Materialized `materializeInstalments()` + ledger_entry seam (Phase 77) | 2026-07-27 (Phase 77) | Phase 78 reuses math for re-spread; seam prevents double-netting |
| Manual pair-guard checks | Generalized pair-guard pattern (v2.5/v2.8) | 2026-06-01 (v2.5 DET-03) | Phase 78 extends pattern for amortization (same precedent) |

**Deprecated / Outdated:**
- `transaction_pair` table (dropped in Phase 73 migration 0030) — replaced by reimbursement + reimbursement_refund
- Direct calls to `effectiveAmount()` / `isNotSecondary()` on any row — replaced by ledger_entry seam

## Sources

### Primary (HIGH confidence)

- **ADR 0019 (amortization-accrual-lens.md):** §7 (close/collapse), §8 (realization/reimbursement), §10 (seam + double-netting trap) — architecture locked
- **78-CONTEXT.md:** Decisions D-01 through D-04, locked requirements AMORT-04/05/06/07
- **Phase 77 Implementation (Phase 77 shipped):** `amortization-math.ts`, `amortization-activation.ts`, `amortization-guards.ts`, schema migrations 0033, ledger_entry views
- **Phase 73/v2.8 Reimbursement (shipped):** `reimbursement.ts`, `transaction-pairs.ts`, netting patterns (ADR 0018)
- **REQUIREMENTS.md:** AMORT-04/05/06/07 requirement definitions + traceability

### Secondary (MEDIUM confidence)

- **transaction-edit.ts pair-guard pattern (Phase 74 CR-02 + Phase 73):** reuse for D-04 amortization guard
- **reimbursement-regression.test.ts (Phase 73, LENS-03 gate):** real-Postgres regression pattern for lifecycle validation

### Tertiary (ASSUMED, marked for validation)

- [None — all architecture is locked by ADR 0019 + CONTEXT.md decisions.]

## Metadata

**Confidence breakdown:**
- Standard Stack: **HIGH** — Phase 77 schema + services live in production; v2.8 reimbursement proven (Phase 73–76 complete)
- Architecture: **HIGH** — ADR 0019 §7–§8 locked; D-01–D-04 explicit in CONTEXT.md
- Pitfalls: **HIGH** — double-netting trap documented in ADR 0019 §10; edit-guard pattern proven in v2.5/v2.8
- Security: **HIGH** — userId scoping proven across reimbursement/groups; seam design prevents double-netting structurally

**Research date:** 2026-07-28
**Valid until:** 2026-08-27 (30 days; amortization model is stable, no active PRs or design changes expected)
