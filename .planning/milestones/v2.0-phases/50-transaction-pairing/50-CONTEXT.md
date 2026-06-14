# Phase 50: transaction-pairing - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning

<domain>
## Phase Boundary

A user can explicitly link two transactions that cancel each other (order↔refund,
expense↔reimbursement) via a row action in the transaction list. The pair is
persisted as a `transaction_pair` table (1:1 strict). Paired transactions net
each other in ALL dashboard aggregations (monthly charts + KPI cards): the
secondary is excluded from its own month; the net appears in the primary's month
under the primary's direction/category. The transaction list shows each paired
row independently with a badge displaying the link icon + net amount; clicking
the badge opens a popover with counterpart details. Unlinking is a row action
("Scollega") on either paired transaction.

**What is NOT changing:**
- The implicit algebraic-sum netting (ADR 0004) for unpaired transactions.
- Expenses: pairing is a transaction-level metadata annotation; expenses are
  never touched when a pair is created or removed.
- The 1:N case (one order ↔ multiple partial refunds) — deferred to a future phase.

</domain>

<decisions>
## Implementation Decisions

### A — Data model

- **D-01:** A new `transaction_pair` table with two symmetric FK columns:
  `transaction_a_id` and `transaction_b_id`, both referencing `transaction.id`
  with `ON DELETE CASCADE`. Unique constraint on both columns (prevents double-linking).
  `userId`-scoped but cross-file — both transactions must belong to the same user,
  regardless of which import file they came from.

- **D-02:** Cardinality is **1:1 strict** in this phase. No 1:N (partial refunds)
  — deferred. A transaction can appear as `a` or `b` in at most one pair row.

- **D-03:** `ON DELETE CASCADE` on both FKs: deleting either transaction automatically
  removes the `transaction_pair` row. The counterpart transaction returns to unpaired
  with no additional action required.

- **D-04:** Pairing does **not touch expenses**. The categorization model (expense →
  sub_category → nature → direction) is unchanged. The pair is a metadata annotation
  at the transaction level only.

### B — Dashboard netting (dashboard-aware pairing)

- **D-05:** Paired transactions are **excluded from individual aggregation** and
  replaced by their algebraic net. The **primary** transaction (the one with larger
  `|amount|`) determines:
  - Which direction/category bucket the net falls into
  - Which calendar month the net appears in

- **D-06:** The **secondary** transaction (smaller `|amount|`) is excluded from its
  own month's totals across all dashboard surfaces.

- **D-07:** The netting applies **consistently everywhere**: monthly bar chart
  (overview), KPI cards (IN/OUT/Accantonato/Bilancio/Tasso risparmio). There is
  no partial netting (e.g., KPI only).

- **D-08:** This design solves the core ambiguity that the `expense` model cannot
  resolve: a "ricarica da Marco" expense shared by two transactions (one a dinner
  refund, one a gift contribution) would be indistinguishable by category alone.
  The explicit pair identifies which specific transaction is the refund; the
  secondary is excluded from IN totals and netted against the primary's OUT month.

### C — UX entry point

- **D-09:** The pair is initiated from a **row action in the transaction list**
  ("Collega rimborso" in the existing row dropdown). No new page or surface.

- **D-10:** The **user initiates from the primary (larger |amount|) transaction
  only**. The system automatically determines which transaction is primary after
  the link is confirmed (by comparing absolute amounts). If the user initiates from
  the "wrong" side (smaller amount), the system swaps the roles silently.

- **D-11:** Unlinking is available as a row action on either paired transaction:
  "Scollega" replaces "Collega rimborso" when the row is already paired.

### D — Counterpart picker

- **D-12:** A **dialog/modal** opens with a searchable list of available transactions
  (consistent with existing `TransactionFormDialog` pattern — no bottom sheet for
  this surface).

- **D-13:** The picker pre-filters to **opposite sign + ±90 days date range** by
  default. The date range is configurable (the user can expand it). Opposite-sign
  filter is always applied.

- **D-14:** Transactions that are **already paired with another transaction are
  excluded** from the picker list. Prevents double-linking without requiring a
  separate guard.

### E — Visual indicator in transaction list

- **D-15:** Paired rows remain in their **natural chronological position** in the
  list (no re-ordering or grouping). Each paired row shows a small badge/chip with
  a link icon + net amount (e.g., "🔗 €-50"). The badge appears inline in the row.

- **D-16:** Clicking the pair badge opens an **inline popover** showing:
  counterpart description, counterpart amount, counterpart date, net effect, and
  a "Vai alla transazione" link. No navigation or scroll-jump.

### Claude's Discretion

- Exact SQL for the netting in DAL queries (CTE vs subquery vs window function)
  — the planner decides based on query plan efficiency.
- Badge/chip visual style (color, size, position within the row) — use the
  existing chip/badge components; align with the row action bar styling.
- Whether the `transaction_pair` table carries a `created_at` timestamp and
  `created_by_user_id` — reasonable to add for auditing; planner decides.
- Migration strategy: the table is purely additive (new table + indexes); no
  backfill needed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pairing design contract
- `.planning/REQUIREMENTS.md` §PAIR-01, PAIR-02, PAIR-03 — the 3 requirements
  this phase validates; read before planning to confirm success criteria.
- `.planning/ROADMAP.md` §"Phase 50: transaction-pairing" — goal + 3 success
  criteria (link persisted, visual indicator + net, unlink restores baseline).

### Implicit netting baseline (must remain unchanged)
- `docs/adr/0004-nature-segments-algebraic-sum.md` — algebraic-sum netting for
  unpaired transactions. The explicit pairing is additive over this; ADR 0004
  behaviour must be preserved for all transactions not in a pair.
- `docs/adr/0012-direction-derived-from-nature-allocation.md` — direction derived
  from nature; the primary transaction's direction is used for the net bucket.

### Prior phase context
- `.planning/phases/49-dashboard-and-surfaces/49-CONTEXT.md` — dashboard DAL
  patterns (react.cache, verifySession, algebraic aggregation by direction) that
  the pairing netting must follow; also confirms direction join path.
- `CONTEXT.md` (repo root) — canonical domain vocabulary: Transaction vs Expense,
  implicit vs explicit netting, Direction, Reference Period.

### Code anchors (read before editing)
- `lib/db/schema.ts` — `transaction` table definition; `transaction_pair` is a
  new table to add here.
- `lib/dal/transactions.ts` — `getTransactions`, `TransactionListRow` type;
  the pair badge data must be added to the select and the type.
- `lib/dal/dashboard.ts` — all aggregation queries (`getOverviewAmountTotals`,
  `getCategoriesBreakdown`, `getCategoryRanking`, etc.) must be updated for
  paired-transaction netting (D-05–D-07).
- `lib/dal/overview.ts` — `getOverview`, `getOverviewChart`,
  `getMonthOverMonthCategoryChanges` — same netting update required.
- `components/transactions/transaction-table.tsx` — `TransactionTable`,
  row actions dropdown; add "Collega rimborso" / "Scollega" actions (D-09–D-11).
- `app/(app)/transactions/page.tsx` — transactions page; picker dialog and
  pair server action wired here.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Row action dropdown** in `transaction-table.tsx` — already has edit, categorizza,
  delete actions. "Collega rimborso" / "Scollega" plug in as additional items.
- **`TransactionFormDialog`** — existing modal pattern for transaction-level dialogs;
  the counterpart picker reuses the same dialog shell and search input style.
- **`TransactionListRow` type** — needs two new nullable fields: `pairedWithId`,
  `pairedNetAmount`; the DAL select extends it with a LEFT JOIN on `transaction_pair`.
- **`getTransactions` DAL** — already LEFT JOINs expense and file; add LEFT JOIN
  `transaction_pair` (either FK) + nested select for counterpart amount.

### Established Patterns
- All DAL aggregations are `react.cache`'d and `verifySession()`-scoped — preserve.
- The dashboard direction join goes `transaction → expense → sub_category → nature →
  direction`; paired netting uses the same join on the primary transaction.
- Dialog components are server-safe (data fetched server-side, state client-side) —
  keep the picker dialog consistent with this split.
- Server actions in `lib/actions/` are thin wrappers; pairing create/delete actions
  follow the same pattern (validate userId ownership of both transactions, then
  insert/delete `transaction_pair` row).

### Integration Points
- `transaction_pair` must enforce that both `transaction_a_id` and `transaction_b_id`
  belong to the same `userId` — enforce via server action validation (not DB constraint,
  since `userId` is not on the pair table directly).
- Dashboard netting: the planner must decide whether to implement the primary/secondary
  resolution in SQL (using `CASE WHEN abs(a.amount) >= abs(b.amount)`) or in a
  TypeScript post-processing step. SQL is preferred for consistency with existing
  DAL aggregation patterns.
- The picker date range filter reuses the `MonthMultiPicker` / date range pattern
  already established in `DataTableToolbar`; or a simpler ±N-days approach — planner
  decides based on complexity.

</code_context>

<specifics>
## Specific Ideas

- **The dinner/Satispay scenario** (the key design driver): Transaction A = cena
  €-100 (OUT/ristoranti, marzo); Transaction B = ricarica da Marco €+50 (IN, marzo
  or aprile). Without explicit pairing, both show individually in the dashboard.
  With the pair: B is excluded from IN totals; net €-50 appears in OUT/ristoranti
  for marzo (primary's month). Transaction C = altra ricarica da Marco €+100
  (unpaired, regalo) continues to appear as IN independently.

- **Primary determination:** `|tx_a.amount| >= |tx_b.amount|` → tx_a is primary.
  If amounts are equal, the earlier `occurredAt` is primary (the "order" typically
  precedes the "refund").

- The pair badge in the transaction list shows: 🔗 followed by the net amount
  formatted as a signed currency string (e.g., "🔗 €-50" or "🔗 +€50"). The sign
  reflects the net from the perspective of the paired row's transaction.

</specifics>

<deferred>
## Deferred Ideas

- **1:N pairing** (one order ↔ multiple partial refunds): deferred to a future phase.
  The schema design (symmetric `transaction_pair` table with 1:1 unique constraint)
  would need to be migrated to a join table approach for 1:N support.
- **Recategorization suggestion on pair creation**: when pairing B with A, the
  system could suggest recategorizing B's expense under A's subcategory (ADR 0004
  explicit). Deferred — the dashboard netting in D-05–D-08 makes this unnecessary
  for financial correctness.
- **Dashboard pair visibility filter**: a filter chip in the overview to
  "show/hide paired transactions" — not in scope for this phase.
- **Employer salary bundled reimbursements** (splitting a monthly salary credit
  into base + expense reimbursement): known limitation, deferred per ADR 0012.

</deferred>

---

*Phase: 50-transaction-pairing*
*Context gathered: 2026-06-13*
