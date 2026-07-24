# Phase 75: linking-surfaces-and-lifecycle - Context

**Gathered:** 2026-07-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Give the user the in-place surface to **create and manage a 1:N reimbursement**: attach and remove
inflow refund transactions to an outflow anchor, with unlink/delete restoring baseline. Entry points
are the **transaction detail page** (`/transactions/[id]`, the outflow) and the **Expense Group detail
page**. Net + residual + status are surfaced on the linking surface itself.

This phase also **closes a netting-model correctness gap** surfaced during discussion (see D-08): today
an anchor resolves its netted transactions via the Expense's `descriptionHash` bucket, so a future
same-merchant purchase silently inherits a share of past refunds. Making the anchor
transaction-granular is a **prerequisite** for the linking feature to be safe, so it is in scope here
even though it touches the Phase 73/74 netting core.

**Requirements:** RMB-07, RMB-08.

**Carried forward (locked, do not re-open):** the 1:N model, Mondo Netto netting, proportional spread
(Phase 74 D-01/D-02), residual as a computed value (`computeReimbursementResidual`, Phase 74 D-03), and
the amount-edit guard (RMB-09, Phase 74). The invariant (anchor = outflow, refund = inflow) stays. The
backend write path (`createPair`/`deletePairByTransactionId`) already writes `reimbursement` /
`reimbursement_refund` and enforces ownership/sign — this phase generalizes it to N and reverses it.

</domain>

<decisions>
## Implementation Decisions

### Linking surfaces & shape

- **D-01:** Entry points are **`/transactions/[id]`** (the outflow transaction) **and the Expense Group
  detail page** (`components/expenses/group-detail-client.tsx`). **`/expenses/[id]` does NOT host the
  linking UI** — RMB-08's "Expense detail page" is read as "the spend = the transaction," matching the
  user's mental model (anchor = the transaction, or the Group).
- **D-02:** On the transaction detail, the **existing 1:1 pairing block evolves in place** into a 1:N
  reimbursement panel: list of linked refunds + net/residual/status + add/remove actions. Not a new
  dedicated card, not a dialog-only surface.
- **D-03:** A **single reusable component** hosts the management panel and is mounted on **both** the
  transaction detail and the Group detail (anchor = the Group in the Group case). One component, two
  hosts.
- **D-04:** The surface **shows net + residual + status inline** ("ancora dovuti €25" / "saldato" /
  "surplus"), consuming `computeReimbursementResidual` (already shipped in Phase 74). The dedicated
  `/reimbursements` section stays Phase 76.

### Add / remove refunds

- **D-05:** Adding refunds uses a **multi-select picker** (evolution of `CounterpartPickerDialog`): the
  user can tick several eligible inflows and link them in one action (the dinner "N friends repay"
  case). The write path becomes **create-or-append** — linking a refund to an anchor that already has a
  reimbursement **appends** to it instead of failing the `reimbursement.expenseId` partial-unique with
  23505 (the current `createPair` always creates a new reimbursement — this is the core behavior gap to
  close). — **Reversibility:** costly — undo touches the create/append service and the picker contract.
- **D-06:** For a **Group anchor** (net spread across member transactions over multiple months), the
  eligible-refund candidate **window is ±90 days computed on the Group's occurrence interval**
  (first→last member transaction), not a single reference date. The user can still widen it manually as
  today.

### Coherence with the existing 1:1 pairing UI

- **D-07:** The **inline "collega rimborso" action in the transactions table** (`transaction-table.tsx`)
  **stays a 1:1 quick-action** (create-or-append a single refund). Full N:1 management lives only on the
  two new surfaces (D-01). Two mechanics coexist deliberately; the `transaction-pair-popover` may show
  only one refund on a multi-refund reimbursement — accepted minor limitation, its full generalization
  is not in scope.

### Netting-model correctness gap (anchor contamination) — **the discussion's key finding**

- **D-08:** **The anchor becomes transaction-granular via a frozen anchored-transaction set (Option 2).**
  At link time, the exact transaction id(s) that constitute the anchored cost are **recorded**; the
  netting spread (`effectiveAmount()`) resolves its member set from that **frozen set**, never from
  "all transactions of the anchor's `expense_id`." This makes the **outflow (anchor) side**
  transaction-granular, matching the **refund side** which is already transaction-granular (refunds are
  pinned by `reimbursement_refund.transaction_id`, so future same-merchant income is a different tx and
  is never swept — verified). — **Reversibility:** costly — undo re-touches the `effectiveAmount()`
  member-resolution CTE, a schema addition, and the migrated-pair backfill + regression snapshots.

  **Why this and not the alternatives:**
  - *Anchor-as-Expense (status quo)* is unsafe: import upserts Expenses by `(userId, descriptionHash)`
    (`import.ts:561-651`), so a later same-merchant purchase joins the anchor Expense and
    `effectiveAmount()` (`transaction-pairs-sql.ts:90-96`) spreads past refunds onto it. Latent already
    for migrated 1:1 pairs; the linking feature makes it common.
  - *Isolate-anchor-as-Standalone (Option 1)* was considered and rejected: smaller on create, but it
    **mutates the anchor Expense** (re-hash) and therefore needs **bidirectional standalone surgery** to
    honor unlink→baseline (D-10), and it zoppica on a legitimate multi-transaction same-merchant cost
    that is not a Group.
  - *Transaction-granular re-architecture (Option 3)* is conceptually cleanest but reopens the Phase 74
    schema + spread + regression gates on shipped code — blast radius rejected by the user.
  - Option 2 delivers Option 3's correctness for **all three cases** (1:1, dinner 1:N, Group M:N),
    preserves the proportional spread math unchanged, keeps unlink→baseline trivial (delete the set
    rows), and leaves the **Group anchor untouched** — a Group already has explicit
    (`expense_group_membership`) frozen membership and is not vulnerable.

### Unlink / delete lifecycle & baseline restore

- **D-09:** Two actions on the surface: **remove a single refund** (inline per-refund) and **delete the
  whole reimbursement** (detaches all). Delete-reimbursement **asks for confirmation** (it detaches N
  links); single-refund removal is lighter. Removing the last refund still collapses the reimbursement
  (current `deletePairByTransactionId` behavior).
- **D-10:** **Unlink restores baseline fully — including the refund's recategorization.** Today
  `createPair` runs `applyDetachCleanupTx` on the refund (recategorizes it as a standalone expense under
  the anchor's subcategory, title "X — rimborso Y"). RMB-07's "reappears as a normal inflow" requires
  the unlink to **revert that recategorization** (restore the refund's pre-link category/title/expense
  membership), not only remove the link. This requires **snapshotting the refund's pre-link state** at
  link time so it can be restored. — **Reversibility:** costly — undo touches the create/unlink service
  and the pre-link snapshot storage.

### Claude's Discretion (details, not architecture)

- Where the **frozen anchored-transaction set** (D-08) lives (new join table vs. column) and its exact
  shape; how the `effectiveAmount()` member CTE reads it; the **backfill** for migrated 1:1 pairs
  (snapshot the anchor's current member transactions at migration time). Keep the N=1 regression gate
  numerically inert.
- Where the **pre-link snapshot** (D-10) lives (refund's prior `subCategoryId` / title / expense
  membership) and how unlink restores it; whether it re-aggregates into a still-existing merchant
  Expense.
- The multi-select picker's exact UX (checkbox list, running total, per-item amount/date), and the
  create-or-append service contract shape (D-05).
- The Italian wording/tone of the surface (net/residual labels, confirm dialog copy).
- Query/index strategy for the frozen-set resolution and candidate loading.
- **Group-anchor + refund cleanup edge:** `applyDetachCleanupTx` today uses a single Expense's
  `subCategoryId`; for a **multi-subcategory Group anchor** the refund-categorization behavior must be
  defined by research (there is no single anchor subcategory).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reimbursement model (locked)
- `docs/adr/0018-reimbursement-1n-linking-supersedes-net-by-subcategory.md` — the 1:N model, outflow-anchor
  invariant, Mondo Netto, schema shape
- `docs/adr/0017-expense-group-over-physical-merge.md` — the Expense Group anchor: explicit membership
  via `expense_group_membership` (**why the Group anchor is not vulnerable to D-08's contamination**)
- `docs/adr/0016-shared-costs-net-by-subcategory-inflows-isolated-per-transaction.md` — §1 superseded by
  0018; §2–§4 (Standalone Expense mechanism) still valid — the v2.4 isolation machinery referenced in D-08/D-10

### Phase 73/74 output — the code this phase extends
- `.planning/phases/74-group-anchor-and-reconciliation/74-CONTEXT.md` — parent decisions (spread D-01/D-02,
  residual D-03, guard D-04)
- `.planning/phases/73-reimbursement-schema-and-netting/73-CONTEXT.md` — schema/netting/invariant decisions
- `lib/dal/transaction-pairs-sql.ts` — `effectiveAmount()` (the member-resolution CTE D-08 changes; the
  spread math stays) / `isNotSecondary()` (refund pinned per `transaction_id` — the already-safe side)
- `lib/services/transaction-pairs.ts` — `createPair` (→ create-or-append D-05; anchor snapshot D-08;
  refund cleanup `applyDetachCleanupTx` D-10) / `deletePairByTransactionId` (→ full baseline restore D-10)
- `lib/services/reimbursement.ts` — `computeReimbursementResidual` (the net/residual/status the surface renders, D-04)
- `lib/dal/reimbursement.ts` — `getReimbursementAggregates`
- `lib/services/reimbursement-invariant.ts` — sign-only invariant, reuse as-is
- `lib/services/transaction-detach.ts` — `applyDetachCleanupTx` (the isolation used on refund; relevant to D-10)
- `lib/db/schema.ts` — `reimbursement` (expenseId XOR expenseGroupId), `reimbursement_refund`, `expense`,
  `expense_group` + `expense_group_membership`

### Import aggregation (the source of the D-08 contamination path)
- `lib/services/import.ts` §561-651 — Expense upsert by `(userId, descriptionHash)`; a same-merchant
  transaction reuses the existing `expenseId` (the mechanism D-08 defuses on the anchor side)

### Existing linking UI (surfaces this phase evolves)
- `components/transactions/counterpart-picker-dialog.tsx` — the 1:1 picker → multi-select create-or-append (D-05)
- `components/transactions/transaction-detail-client.tsx` — the pairing block that evolves in place (D-02)
- `components/transactions/transaction-table.tsx` — the inline quick-action that stays 1:1 (D-07)
- `components/transactions/transaction-pair-popover.tsx` — the popover (D-07 limitation)
- `components/expenses/group-detail-client.tsx` — the second host for the reused management panel (D-03)
- `lib/actions/transaction-pairs.ts` — the server actions to generalize (create/append, remove, delete)
- `lib/dal/transaction-pairs.ts` — `CounterpartRow` / eligible-counterpart loading (candidate window D-06)

### Aggregation sites the D-08 change must keep green
- `lib/dal/dashboard.ts`, `lib/dal/overview.ts`, `lib/dal/transactions.ts`, `lib/dal/expenses.ts`,
  `lib/dal/tags.ts` — every `effectiveAmount()` / `isNotSecondary()` consumer
- `tests/reimbursement-regression.test.ts`, `tests/reimbursement-invariant.test.ts`,
  `tests/fixtures/reimbursement-seed.ts` — extend for the frozen-set + unlink-baseline behavior

### Project rules
- `CLAUDE.md` — Decimal.js for money, `drizzle-kit generate` + `scripts/migrate.ts` (never push in prod),
  `dal` / `services` / `actions` layering, English code / Italian product surfaces
- `CONTEXT.md` (repo root) — canonical domain language (Transaction vs Expense, Expense Group, Reference Period)
- `.planning/REQUIREMENTS.md` — RMB-07, RMB-08 wording

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CounterpartPickerDialog` (`components/transactions/counterpart-picker-dialog.tsx`): the ±90-day,
  opposite-sign, search picker — extend to multi-select (D-05) and Group-interval window (D-06).
- The pairing block in `transaction-detail-client.tsx` (around the `transaction.pairedWithId` branch):
  evolve in place into the 1:N panel (D-02); factor into a reusable component (D-03).
- `computeReimbursementResidual` (`lib/services/reimbursement.ts`): net/residual/status data, already
  shipped — the surface only renders it (D-04).
- `applyDetachCleanupTx` (`lib/services/transaction-detach.ts`): the standalone-isolation core; already
  applied to the refund in `createPair` — relevant to the D-10 revert and to the rejected Option 1.
- `deletePairByTransactionId` (`lib/services/transaction-pairs.ts`): already unlink-restores-netting for
  either side and collapses an emptied reimbursement — extend it to also revert the refund
  recategorization (D-10).

### Established Patterns
- **Netting is per-transaction at every aggregation site**; `isNotSecondary()`/`effectiveAmount()` move
  together. D-08 keeps this and makes the anchor side per-transaction too.
- **Refund linkage is already transaction-granular** (`reimbursement_refund.transaction_id`) — future
  same-merchant income is never swept. Only the anchor side resolves via `expense_id` (the D-08 fix).
- Money is `Decimal.js` end-to-end; `DECIMAL` columns are strings.
- Regression-gate-as-tracer: prove N=1 inertness before/after the D-08 member-CTE change.
- Server actions thin in `lib/actions/`, ownership-validating writes inside `db.transaction`.

### Integration Points
- The management component mounts on `/transactions/[id]` and `group-detail-client.tsx` (D-03).
- The create-or-append + unlink actions flow through `lib/actions/transaction-pairs.ts`.
- The D-08 frozen set is read inside `effectiveAmount()`, so it flows into all five aggregation DALs
  unchanged at the call site.

</code_context>

<specifics>
## Specific Ideas

- The three motivating cases to validate every decision against:
  1. **Direct 1:1** (Amazon order/refund) — N=1, must stay numerically inert.
  2. **Dinner 1:N** (one €100 outflow, three €25 inflows) — the user's primary worry; covered on both
     sides (anchor frozen per D-08, refunds pinned already).
  3. **Vacation M:N** (Expense Group anchor) — Group membership is explicit, already contamination-safe.
- The user's guiding intuition: **"tutto deve diventare una transazione separata"** — both sides of a
  reimbursement reason per transaction (refunds already do; D-08 brings the anchor in line).
- **Anchor contamination is the load-bearing scenario:** "pago una cena, ricevo 3 rimborsi; se torno
  allo stesso ristorante da solo, la nuova spesa non deve ereditare i rimborsi precedenti." Verified as a
  real gap in the shipped model; D-08 closes it.

</specifics>

<deferred>
## Deferred Ideas

- **Full 1:N generalization of the transactions-table popover** (`transaction-pair-popover` showing all
  N refunds) — out of scope; table/popover stay 1:1 quick-actions (D-07).
- **`/reimbursements` list + per-reimbursement page** — Phase 76 (RMB-10, RMB-11); it renders the same
  net/residual delivered here.
- **RMB-F1 — subscription temporal amortization** (spread one inflow across N covered months) — later
  milestone (ADR 0018 §6). Not to be conflated with the spatial spread across anchor member transactions.
- **RMB-F2 — refund CSV export** from a reimbursement page.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 75-linking-surfaces-and-lifecycle*
*Context gathered: 2026-07-24*
