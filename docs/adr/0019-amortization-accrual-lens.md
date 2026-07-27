# Amortization spreads a one-off cost over N months, shown through a second dashboard lens

## Status

accepted (builds on [ADR 0016](./0016-shared-costs-net-by-subcategory-inflows-isolated-per-transaction.md) §2–§4 for the forced detach, [ADR 0017](./0017-expense-group-over-physical-merge.md) for why the unit is the transaction and not the group, and [ADR 0018](./0018-reimbursement-1n-linking-supersedes-net-by-subcategory.md) for the reimbursement mechanism the sale of an amortized asset reuses; keeps the categorization doctrine in [CONTEXT.md](../../CONTEXT.md))

## Context

A large one-off purchase distorts the month it lands in. A €2.400 laptop bought in August blows up August's Uscite, fires as "spesa nuova" in the movers panel, and skews that month's deviation — even though the value is consumed over years, not in August. Sparter shows money strictly cash-basis: a transaction lives in the month the bank recorded it. There is no way to say "this cost belongs to a span of months, not a day."

This is distinct from the four readings the term "ammortamento" could carry, three of which are rejected up front:

- **Spreading a one-off cost over N months** — the chosen scope.
- Accrual saving toward a future expected expense — a budgeting feature, cousin but different.
- A debt amortization schedule (principal/interest split) — already ruled out in CONTEXT.md: "the whole instalment is OUT; principal and interest are not separable from the bank import."
- Asset depreciation — needs a net-worth/asset model Sparter does not have.

The mechanism sits directly on top of v2.8 (Reimbursements 1:N). Selling an amortized asset *is* a partial reimbursement of its cost — semantically identical to "return of an online order," which ADR 0018 already models. A second mechanism for the same thing would double the code and open a double-counting hole.

A codebase survey (`.scratch/amortization/`, ticket 01) established the load-bearing fact: all ten dashboard aggregation sites share one join spine that touches only four transaction columns (`userId`, `expenseId`, `occurredAt`, `amount`, plus `id` for netting). Nothing else about a transaction reaches an aggregation. That is what makes a second lens affordable without rewriting ten functions.

## Decision

**1. The unit of amortization is the single Transaction** — not the Expense, not the Expense Group. Expenses aggregate by `descriptionHash` (per-merchant); amortization is per-purchase. Two laptops bought in different months land in the same Expense, so anchoring the plan on the Expense would break. Amortizing therefore **forces a detach into a Standalone Expense** (ADR 0016 §2–§4, `detachTransactionToDedicatedExpense`) — the same isolation used for "money from a person," reused here so a later same-description purchase is not swept into the plan.

**2. Outflows only, for now.** `in`, `allocation` and `transfer` are out of scope. The unit being the transaction (not the generic Expense) is what makes per-purchase plans coherent.

**3. Uniform plan starting from the month of the purchase.** A purchase on 14/8 over 4 months produces instalments on 14/8, 14/9, 14/10, 14/11 — the first instalment coincides with the purchase, so no already-closed month is ever rewritten. The rounding remainder lands on the **first** instalment (Decimal.js; €1000 / 3 → 333,34 · 333,33 · 333,33). The instalment falls on the purchase's calendar day each month, clamped to the last day of a short month (31/1 → 28/2) so it never slips into a different month.

**4. Instalments are materialised** in the database, to keep dashboard reads cheap.

**5. Two lenses, one global switch.** The dashboard gains a switch — *cassa* (current behaviour, values unchanged) vs *competenza* (amortized costs spread across months) — global to the whole dashboard exactly like the year selector. Every widget follows it: bar chart, KPIs, category breakdown, movers, deviations. The switch is **not a widget**; it is a cross-cutting dimension of the read layer. Movers and deviations following the lens is the point — they are precisely where a big purchase screams today.

**6. The accrual lens shows the whole selected year, future months included.** Instalments exist in the database, so they are shown; KPIs under the accrual lens mix actuals with commitments already made — that is the intent. Instalments past 31/12 land in the following year's dashboard, which means the year and month selectors must become lens-aware (an instalment can create a year with no transaction in it).

**7. Closing a plan collapses every remaining instalment onto the closure month.** Past instalments stay where they are. Closure is an explicit user action.

**8. Realization is a reimbursement, not a new mechanism.** Selling the asset means linking a transaction (imported, or created manually at closure) and netting it against the **closure month** — an explicit exception to ADR 0018's Mondo Netto, which nets at cost-time. Scrapping the asset = closure with no linked transaction. On an *open* plan a reimbursement instead reduces the base and re-spreads the remaining instalments proportionally (remainder on the month of reduction). The system **never writes a synthetic transaction**: the cash lens must stay reconcilable with the bank statement.

**9. Activation is always manual** — from the transaction row, the transaction detail page, or at manual entry — and the user supplies the number of months. No automatic or threshold-based suggestion.

**10. Implementation seam: one swappable `ledger_entry` row source per lens**, not a `lens` parameter threaded through ten functions. Cash = transactions with `effectiveAmount()`; accrual = non-amortized transactions `UNION ALL` instalment rows, each carrying its plan's `expense_id`, its own date, its own amount. The aggregations read `ledger.amount` and stop calling `effectiveAmount()`/`isNotSecondary()` directly — sixteen call sites of a fragment pair documented as "never one without the other" collapse into one definition. Resolving the amount *inside* the row source makes the reimbursement double-netting trap (see Consequences) structurally impossible.

## Consequences

- **New schema:** an amortization plan (transaction FK, months, start date, status open/closed) plus N materialised instalment rows. The exact columns, indexes, constraint syntax and migration ordering are left to plan-phase (`gsd-pattern-mapper` against the live schema).
- **The double-netting trap.** §8 bakes reimbursement netting into instalment amounts at materialisation; `effectiveAmount()` also spreads refunds at read time. Applied together on an instalment row, a refund nets twice. §10's row source resolves the amount once, inside itself, making this structural rather than a rule to remember.
- **The lens leaks into navigation.** `getYearsWithData` / `getMonthsWithData` read transactions only; under the accrual lens they must also see instalments, or the selector will hide a year whose dashboard would render. Needs a horizon decision (a 60-month plan reaches far out).
- **Regression instrument reused.** v2.8's real-Postgres suite proving all ten aggregation sites byte-identical is the tool that proves the seam inert under the cash lens: every site must stay byte-identical after `ledger_entry` lands.
- **Incidental cleanup.** `dateScopedTransactions()` and `expenseStatusIncludedInDashboardTotals()` are duplicated privately in both `dashboard.ts` and `overview.ts`; the seam work should extract them.
- **A dedicated `/amortizations` section** (modelled on `/tags`) lists every plan with description, transaction date, initial amount, consumed, net value, remaining months, and the close action.
- **Left to the discuss/plan phase (details, not architecture):**
  1. What a reimbursement that **exceeds the residual** does (clamp, allow negative, or block).
  2. Whether an amortized transaction's **amount/date/subcategory** can be edited after the plan exists, and the write-path invariant (model: v2.5 pair-guard, v2.8 D-02).
  3. Whether the accrual lens is a **durable preference** or a URL/session view, and its behaviour across the four dashboard sub-routes.
  4. Whether `/dashboard/tags` and `/tags/[id]` are **lens-invariant** (all-time totals make the spread a no-op) or follow the switch.
  5. What deviations/movers **do instead** once a cost is spread (it goes invisible to deviation after month 1), and whether a plan's closure spike should fire or be suppressed.
- **Out of scope:** configurable amortization day in settings (deferred — every instalment falls on the purchase's calendar day); amortizing `in`/`allocation`/`transfer`; amortizing an Expense or Expense Group; non-uniform plans; automatic/threshold activation; splitting semantics inside a widget (future months dashed while KPIs stop at today).
