# Quick Task 260730-e6z: riepilogo totali netti nel footer della tabella transazioni - Context

**Gathered:** 2026-07-30
**Status:** Ready for planning

<domain>
## Task Boundary

Replace the plain "Tutte le transazioni disponibili sono caricate." end-of-list message in the
transactions table footer with a compact summary of the loaded set: transaction count, total in,
total out, and the resulting difference.

Goal stated by the user: give simple numbers that help a user sanity-check the transactions they
are looking at. Anything richer (breakdowns, trends, nature/direction analysis) belongs to the
dashboard, not here.

</domain>

<decisions>
## Implementation Decisions

### Placement — footer, not a header card
- The summary lives in the existing end-of-list footer block of
  `components/transactions/transaction-table.tsx` (lines ~956-972), replacing the
  "Tutte le transazioni disponibili sono caricate." paragraph.
- Rejected: sticky bar under the filters, and a large card above the table. Rationale: a summary
  above the table reads as "this is the total of your whole filter", which sets an expectation of
  analytical completeness the user explicitly does not want here.

### Totals scope — loaded rows, client-side, no new DAL query
- Totals are computed client-side over `loadedTransactions` in the table component.
- This is NOT an approximation: the footer branch that currently renders the "all loaded" message
  only renders when `hasMore === false`, i.e. when every row of the active filter is already in
  `loadedTransactions`. At that point "current view" and "full filter set" are identical.
- Therefore: do NOT add an aggregate/SUM DAL function, and do NOT refactor the condition-building
  currently inlined in `getTransactions` (`lib/dal/transactions.ts:386-509`). Explicitly out of scope.

### Partial scroll — no totals until everything is loaded
- While `hasMore === true` (footer shows the "Carica altre 50 transazioni" button) or while
  `isLoadingMore`, the footer renders exactly what it renders today. No partial totals.
- Rejected: always-visible totals labelled "caricate finora". Rationale: numbers that change while
  scrolling undermine the verification purpose.

### Amount field — the net, always
- Per row use `pairedNetAmount ?? amount`.
- The user's framing: "here we only have the net, there is no gross". `pairedNetAmount` is only
  populated on paired (reimbursed) transactions; where it is null, `amount` IS the net.
- Both are DECIMAL columns surfaced as strings. All arithmetic MUST go through `Decimal.js` via
  `@/lib/utils/decimal` (`toDecimal`) — never native `+`/`-`. This is a hard project rule.

### In/out split — by sign, not by the `direction` lookup table
- Entrate = sum of rows whose net is > 0. Uscite = sum of absolute values of rows whose net is < 0.
  Differenza = entrate − uscite (equivalently: the signed sum of all rows).
- The three numbers must reconcile exactly with what is visible in the table.
- Rejected: splitting by the `direction` lookup (`in`/`out`/`allocation`/`transfer`). Uncategorized
  transactions have no direction (no linked expense → subcategory → nature → direction), so they
  would silently drop out of the totals and the figures would not match the visible rows.
- Rows with a net of exactly 0 count toward the transaction count but contribute to neither side.

### Scope — transactions table only
- Do not touch `components/expenses/expense-table.tsx` or `components/import/import-table.tsx`,
  even though they share the same offset-pagination pattern. Possible follow-up, not this task.

### Copy
- Italian, product-facing (per the project language convention).
- Keep it short and factual — a label-and-figures layout, not a sentence. Reference shape:
  count of transactions, then Entrate / Uscite / Differenza.
- Format money with the existing `it-IT` EUR helpers already used elsewhere
  (see `components/dashboard/overview/format.ts` and `components/dashboard/category-detail-summary.tsx`).
- The difference should read as signed (e.g. `+2.559,50 €` / `-1.204,00 €`).

### Claude's Discretion
- Exact visual treatment inside the footer (single row vs. small grid, separators, muted labels),
  as long as it stays compact and does not become a "card".
- Whether to use the existing `text-total-in` / `text-total-out` color tokens for the two figures.
- Whether to extract the totals computation into a small pure helper (e.g. `useMemo` inline vs. a
  tested utility function) — prefer whatever keeps `transaction-table.tsx` readable.
- Responsive behaviour on narrow viewports.

</decisions>

<specifics>
## Specific Ideas

Codebase anchors surfaced during scouting:

- `components/transactions/transaction-table.tsx:956-972` — the footer block to modify.
- `components/transactions/transaction-table.tsx:84` — `PAGE_SIZE = 50`.
- `components/transactions/transaction-table.tsx:194-199` — `loadedTransactions` state, `hasMore` init.
- `components/transactions/transaction-table.tsx:269-321` — `loadNextPage` + IntersectionObserver.
- `lib/dal/transactions.ts:266-303` — `TransactionListRow` type; `amount: string`,
  `pairedNetAmount: string | null`, `pairedAmount: string | null`.
- `lib/db/schema.ts:431` — `transaction.amount` numeric(12,2), sign carried in the value.
- `components/dashboard/category-detail-summary.tsx` — closest existing pattern for a lightweight
  Totale / Movimenti / Media tile group, with `it-IT` EUR formatting and the color tokens.

Existing accessibility detail worth preserving: the footer div already carries `aria-live="polite"`.

</specifics>

<canonical_refs>
## Canonical References

- `CLAUDE.md` — Non-Negotiable Rules: monetary arithmetic via Decimal.js; Drizzle DECIMAL returns
  strings; Language Convention (Italian only for product-facing UI copy).
- `CONTEXT.md` — canonical domain vocabulary. Note the Transaction vs Expense distinction: this
  summary is over Transactions.

</canonical_refs>
