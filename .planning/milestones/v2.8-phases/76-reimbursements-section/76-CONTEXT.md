# Phase 76: reimbursements-section - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Give reimbursements a dedicated home: a **`/reimbursements` list** of every reimbursement group
and a **per-reimbursement page** (`/reimbursements/[id]`) showing anchor, refunds, net and residual,
with in-place management (edit-title, add/remove refund, delete). Reuse the `/tags` (list) +
`/tags/[id]` (detail report) scaffolding, the unified data-table, and the already-shipped
`ReimbursementPanel` from Phase 75.

**Requirements:** RMB-10, RMB-11.

**Carried forward (locked, do NOT re-open):**
- The 1:N model, Mondo Netto netting, proportional spread, residual as a computed value
  (`computeReimbursementResidual`, Phase 74). This phase only **renders and manages** — no netting
  or schema changes to the core.
- **Expense-anchor only.** The Expense-**Group** anchor was descoped in Phase 75 UAT (the Group
  branch in DAL/service stays dormant, no UI entry point). The trip/vacation case is deferred to a
  future tag-anchor primitive. `/reimbursements` therefore lists and pages **Expense-anchored**
  reimbursements only; do NOT surface Group-anchored management UI.
- The invariant (anchor = outflow, refund = inflow); a refund transaction is never an anchor.
- The Phase 75 write/read path: `getReimbursementPanelData`, `computeReimbursementResidual`,
  `getReimbursementAggregates`, `createMultiRefundAction`, `removeRefundAction`,
  `deleteReimbursementAction`, `restoreRefundBaseline` — reuse, don't reinvent.

</domain>

<decisions>
## Implementation Decisions

### List content & scope

- **D-01:** The list shows **all reimbursements** — including the migrated N=1 (former 1:1) pairs and
  fully-settled ones. It is the canonical, complete list; volume is managed via sort + filter, not by
  hiding rows. (Faithful to RMB-10 "lists all reimbursement groups.")
- **D-02:** **Default sort = anchor date, most recent first** — consistent with the transactions/expenses
  tables (date desc). The unified table lets the user re-sort.
- **D-03:** **Row title falls back to the anchor description.** When `reimbursement.title` is empty, the
  row shows the anchor transaction/Expense description (so "la cena da X" is recognizable), the same way
  other tables derive a readable title. An explicit title, when set, wins.
- **D-04:** Columns: **title (with fallback), anchor, net, residual/status, date.** (Exact column
  widths/formatting → Claude discretion, within the unified-table pattern.)

### Navigation & deep-linking

- **D-05:** **Top-level sidebar item "Rimborsi"** (peer of Tag/Spese), with its own icon and an
  `APP_ROUTES.reimbursements` route constant. It is a first-class dedicated section (RMB-10). Sidebar
  position and icon → Claude discretion (likely after Spese). — **Reversibility:** reversible.
- **D-06:** **Deep-link everything: the per-reimbursement page becomes the canonical management point.**
  Both the `ReimbursementPanel` on `/transactions/[id]` and the `ReimbursementRowIndicator` in the
  transactions table link to `/reimbursements/[id]`. — **Reversibility:** costly — undo re-touches the
  Phase 75 panel/indicator components and their host wiring.

### Per-reimbursement page layout

- **D-07:** **Rich report + reused panel.** Header in the `/tags/[id]` style (editable title + KPI:
  net / residual / status + anchor summary), and below it **reuse `ReimbursementPanel`** for the refund
  management (add/remove/delete). Combines the tags detail-report scaffolding for presentation with the
  already-tested Phase 75 panel for actions (RMB-11).
- **D-08:** **Edit-title is inline in the header** — clickable title that becomes an input, reusing the
  `TransactionTitleEdit variant="detail"` pattern already used on `/transactions/[id]`. Editing
  `reimbursement.title` is new to the UI; a title-edit server action is needed. — **Reversibility:**
  reversible.
- **D-09:** **On `/transactions/[id]`, the panel becomes a compact summary + "Gestisci rimborso" link.**
  The transaction detail shows net/residual/status + a read-only refund list and delegates the
  destructive actions (add/remove/delete) to the dedicated page. One place owns the mutating actions.
  This is a **refactor of the Phase 75 `ReimbursementPanel`** into (a) a summary variant for the tx page
  and (b) the full management variant reused on the reimbursement page. — **Reversibility:** costly —
  undo re-touches the shipped Phase 75 panel and the `/transactions/[id]` host.

### Status presentation & filtering

- **D-10:** **Colored status badges + residual value**, both in the list column and the page header:
  e.g. "Dovuti €25" (owed / amber), "Saldato" (settled / green), "Surplus €10" (surplus / blue).
  Reuse the existing `Badge` colors/patterns. The three states come from `computeReimbursementResidual`'s
  `owed | settled | surplus`.
- **D-11:** **Add a status filter to the list** (owed / settled / surplus), alongside title/anchor
  search, using the existing persistent unified-table filter/sort system. With "all reimbursements" in
  the list (settled included), the filter is how the user isolates "what's still open."

### Claude's Discretion
- The **list DAL** does not exist yet (`getReimbursementAggregates` is per-id) — a "list all
  reimbursements for a user" query with anchor description, net, residual, status, and anchor date is
  needed. Its exact shape, joins, and index/perf strategy are Claude's discretion, IDOR-scoped by
  `reimbursement.userId`. Must render the residual/status via the shipped `computeReimbursementResidual`
  logic (or an aggregate-friendly equivalent) without diverging numerically.
- Sidebar icon + position; exact column formatting; empty-state copy; the confirm-dialog copy for
  delete-in-place on the page (reuse Phase 75 confirm behavior); Italian wording/tone of labels.
- The precise split of `ReimbursementPanel` into summary vs full-management variants (D-09) and how the
  reused panel (D-07) mounts on the page.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reimbursement model (locked)
- `docs/adr/0018-reimbursement-1n-linking-supersedes-net-by-subcategory.md` — the 1:N model,
  outflow-anchor invariant, Mondo Netto, residual, dedicated section intent
- `.planning/phases/75-linking-surfaces-and-lifecycle/75-CONTEXT.md` — Phase 75 decisions (D-08 anchor
  frozen set, create-or-append, unlink baseline) and the **Expense-only descope**
- `.planning/phases/75-linking-surfaces-and-lifecycle/75-04-SUMMARY.md` — the shipped panel/indicator UI
  and the UAT descope decisions this phase builds on
- `.planning/phases/74-group-anchor-and-reconciliation/74-CONTEXT.md` — spread + residual (D-01/D-02/D-03)

### Data & services this phase renders (reuse, don't reinvent)
- `lib/dal/reimbursement.ts` — `getReimbursementAggregates`, `getReimbursementPanelData`,
  `getRefundMembership` (the dormant Group branch is documented here — do NOT wire it to UI)
- `lib/services/reimbursement.ts` — `computeReimbursementResidual` / `ReimbursementResidual`
  (`owed | settled | surplus`) — the net/residual/status the list and page render
- `lib/services/transaction-pairs.ts` — `createPair`/`deletePairByTransactionId` (unlink→baseline)
- `lib/actions/transaction-pairs.ts` — `createMultiRefundAction`, `removeRefundAction`,
  `deleteReimbursementAction` (the actions the page's management panel calls); a new **edit-title action**
  goes here or in a reimbursement action module (D-08)
- `lib/db/schema.ts` — `reimbursement` (`title`, `expenseId` XOR `expenseGroupId`), `reimbursement_refund`,
  `reimbursement_anchor_transaction`, `reimbursement_refund_snapshot`

### Scaffolding to reuse (list + detail + table)
- `app/(app)/tags/page.tsx` — list page scaffolding pattern (RSC + `verifySession` + list DAL)
- `app/(app)/tags/[id]/page.tsx` — detail page scaffolding (IDOR guard → `notFound()`, header + report)
- `components/tags/tag-detail-report.tsx` — the rich detail-report layout to mirror for the page header
- `components/tags/tag-mutation-dialogs.tsx` — edit/mutation dialog pattern (reference for title edit if
  a dialog were used; D-08 chose inline instead)
- `components/data-table/` (`DataTableToolbar.tsx`, `use-table-url.ts`) + `lib/utils/table-config.ts` —
  the unified table with persistent filter/sort (RMB-10 "unified table scaffolding") — add the status filter here
- `components/transactions/transaction-table.tsx` / `components/expenses/expense-table.tsx` — reference
  usages of the unified table

### Phase 75 UI this phase evolves
- `components/transactions/reimbursement-panel.tsx` — split into summary (tx page) + full-management
  (reimbursement page) variants (D-07, D-09)
- `components/transactions/reimbursement-row-indicator.tsx` — becomes a link to `/reimbursements/[id]` (D-06)
- `components/transactions/transaction-title-edit.tsx` — the inline `variant="detail"` edit pattern to
  reuse for the reimbursement title (D-08)
- `components/layout/sidebar.tsx` — add the "Rimborsi" nav item (D-05)
- `lib/routes.ts` — add `APP_ROUTES.reimbursements` + a `reimbursementHref(id)` helper (D-05, D-06)

### Project rules
- `CLAUDE.md` — Decimal.js for money, `dal`/`services`/`actions` layering, `drizzle-kit generate` +
  `scripts/migrate.ts`, English code / Italian product surfaces, `yarn check:language`
- `CONTEXT.md` (repo root) — domain language (Transaction vs Expense, residual/net, Reference Period)
- `.planning/REQUIREMENTS.md` — RMB-10, RMB-11 wording

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ReimbursementPanel` (`components/transactions/reimbursement-panel.tsx`): shipped add/remove/delete —
  reuse for the page's management block (D-07) and split off a summary variant for the tx page (D-09).
- `getReimbursementPanelData` / `computeReimbursementResidual`: give refunds + net + residual + state —
  the page consumes these directly; the list needs a new sibling DAL that returns the same shape per row.
- `/tags` + `/tags/[id]` scaffolding (`app/(app)/tags/*`, `components/tags/tag-detail-report.tsx`): the
  list page + detail-report skeleton, including the IDOR `notFound()` guard to copy verbatim.
- `components/data-table/` + `lib/utils/table-config.ts`: persistent filter/sort/search — reuse for the
  list and its status filter (D-11).
- `TransactionTitleEdit variant="detail"`: the inline title-edit pattern for D-08.

### Established Patterns
- List/detail pages are RSC: `verifySession()` → IDOR-scoped DAL → `notFound()` on foreign/missing id.
- Money is `Decimal.js` end-to-end; `DECIMAL` columns are strings; residual/status from the service, never recomputed ad hoc.
- Mutations flow through thin `lib/actions/` server actions over ownership-validating writes in `db.transaction`.
- The unified table is URL-driven with a sessionStorage restore layer; add filters through its config, not bespoke UI.

### Integration Points
- New route `/reimbursements` (list) + `/reimbursements/[id]` (page) under the authenticated `(app)` group.
- New "list all reimbursements" DAL; new **edit-title** server action; a small refactor of the Phase 75
  panel + row indicator to point at the canonical page (D-06, D-09).
- Sidebar + `lib/routes.ts` gain the new section.

</code_context>

<specifics>
## Specific Ideas

- The per-reimbursement page is the **canonical place to manage a reimbursement** — every other surface
  (tx detail panel, table indicator) points here. Elsewhere is read-only summary.
- Status vocabulary is user-facing Italian: "Dovuti €X" / "Saldato" / "Surplus €X"; anchor description as
  the human-readable title fallback.
- Keep the dormant Group-anchor branch invisible: no navigation, no page, no list rows for it (there are
  none in practice, but the DAL must not surface it as a UI affordance).

</specifics>

<deferred>
## Deferred Ideas

- **Group-anchored reimbursements UI** (trip/vacation bundling) — descoped in Phase 75; future tag-anchor
  primitive, not this milestone.
- **RMB-F1 — subscription temporal amortization** — later milestone (ADR 0018 §6), separate from this
  spatial linking work.
- **RMB-F2 — refund CSV export** from a reimbursement page.
- **Bulk actions on the list** (multi-delete, mark-settled) — not requested; own phase if ever wanted.

None beyond the above — discussion stayed within phase scope.

</deferred>

---

*Phase: 76-reimbursements-section*
*Context gathered: 2026-07-27*
