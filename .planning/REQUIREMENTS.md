# Requirements — v2.5 Detail Pages (uniform entity management)

**Milestone goal:** Every core entity — transaction, expense, import file — gets a
dedicated detail page (`/transactions/[id]`, `/expenses/[id]`, `/import/[fileId]`)
that is the single place to view AND edit everything editable about it, with
cross-references between entities. Editing never touches the dedup/grouping keys
(`transactionHash`, `descriptionHash`): an edited transaction is still the same
transaction to the importer.

## Locked decisions (grill 2026-07-05)

1. **Milestone, not quick** — 3 pages + full edit + derived-field reconciliation.
2. **Transaction editable set:** `amount`, `occurredAt`, `customTitle`, category
   (via its linked expense). **`description` is IMMUTABLE** — it is the raw bank
   key feeding `descriptionHash` (sha256 invariant) and Tier 2; `customTitle` is
   the rename mechanism. **Hashes are frozen** on edit: `transactionHash` keeps
   matching the originally imported row, so re-imports still dedup correctly.

3. **Auto-reconciliation:** saving an amount/date edit recomputes the linked
   expense's derived fields (`totalAmount`, `transactionCount`,
   `firstTransactionAt`, `lastTransactionAt`) in the same `db.transaction`
   (generalize the existing reconcile service).

4. **Paired transactions:** an edit that would make a pair incoherent (signs no
   longer opposite, or zero amount) is **blocked with a message** ("Scollega
   prima il rimborso") — never silently unlinked.

5. **Route pages, not dialogs** — shareable URLs, browser back, room for
   cross-refs and actions.

## Defaults (proposed, veto-able)

- Expense page: editable `title`, `notes`, subcategory; `totalAmount`/dates
  readonly (derived — edited via the transactions). Standalone (1:1) expense
  amounts are edited on the single linked transaction.

- File page: editable `displayName` only; platform/format/stats readonly.
- Row-title click navigates to the detail page; the expenses "dettagli" and
  "modifica" dialogs collapse into the page; quick inline actions stay in tables.

## Requirements

### Edit core (Phase 62 — backend first)

- [x] **DET-01** — `updateTransaction` service+action: edit `amount` (Decimal.js,
  signed), `occurredAt`, `customTitle`, all inside `db.transaction`; hashes and
  `description` untouched. Zod validation; ownership-gated.

- [x] **DET-02** — Reconciliation: after an amount/date edit, the linked expense's
  `totalAmount`/`transactionCount`/`firstTransactionAt`/`lastTransactionAt` are
  recomputed atomically (reuse/generalize `expense-reconciliation`).

- [x] **DET-03** — Pair guard: editing a paired transaction's amount is rejected
  with an Italian message when the result breaks the opposite-sign/nonzero
  invariant; unpaired transactions are unaffected.

- [x] **DET-04** — `updateExpense` covers `title`, `notes`, `subCategoryId`
  (status transitions consistent with categorize flow); derived fields are never
  writable.

### Detail pages (Phase 63 — transactions + expenses)

- [x] **DET-05** — `/transactions/[id]`: all fields shown; pencil-inline edit for
  amount/date/title; category assign/change via `SubcategoryPicker`; immutable
  fields visibly readonly (description, hashes never shown as editable); actions:
  cerca su internet, collega/scollega rimborso, spesa a sé, elimina; cross-refs:
  linked expense (link), source file (link) or "Manuale".

- [x] **DET-06** — `/expenses/[id]`: merges today's "dettagli" + "modifica"
  dialogs; pencil-inline edit for title/notes/category; readonly derived totals;
  actions: cerca su internet, categorizza, elimina; cross-refs: linked
  transactions list (each linking to its page), source file, platform.

- [ ] **DET-07** — The old expense edit/details dialogs are removed/redirected;
  no dead menu entries; tables link to the new pages.

### File page + navigation (Phase 64)

- [ ] **DET-08** — `/import/[fileId]` detail page: `displayName` editable inline;
  platform/format/stats readonly; transactions of the file listed (linking out);
  existing actions preserved (R2 download, suggestions, delete).

- [ ] **DET-09** — Navigation wiring: row-title click → detail page on all three
  tables; menu "Dettagli" entries; breadcrumb/back behavior consistent.

## Out of scope

- Editing `description`, `transactionHash`, `descriptionHash` (dedup/grouping keys).
- Editing derived expense aggregates directly.
- Bulk edit from detail pages; revision history/audit log.
- Splitting a transaction across expenses (SPLIT-01 stays deferred).

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DET-01..04 | 62 | Not started |
| DET-05..07 | 63 | Not started |
| DET-08..09 | 64 | Not started |
