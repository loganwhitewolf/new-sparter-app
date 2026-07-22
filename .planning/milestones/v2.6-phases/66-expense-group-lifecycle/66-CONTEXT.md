# Phase 66: expense-group-lifecycle - Context

**Gathered:** 2026-07-19
**Status:** Ready for planning
**Phase requirements:** GRP-05, GRP-06, GRP-07, GRP-09
**Depends on:** Phase 65 (expense-group-merge-and-view — shipped)

<domain>
## Phase Boundary

Keep an Expense Group current over time. Phase 65 delivered creation (bulk "Unisci")
and read-side rendering; Phase 66 delivers the **lifecycle operations** on an existing
group:

- **GRP-05** — recategorize the group as one unit; the new subcategory propagates to
  every member (the group is the categorization unit; member-level recategorization
  stays suppressed while grouped).
- **GRP-06** — add a later-arriving expense into an existing group via "Unisci", gated
  on the same shared-subcategory rule as initial merge.
- **GRP-07** — "Scomponi": remove a single member or dissolve the whole group; a group
  left with exactly one member auto-dissolves; dissolution restores the exact pre-merge
  state.
- **GRP-09** — prove (structurally + by test) that merge and dissolve never move a
  transaction row, a subcategory assignment, or a dashboard total.

**Not this phase:** creation/rendering (Phase 65, done); import-time similarity hints
or auto-merge (GRP-F01, deferred forever per ADR 0017); group-to-group merge (rejected
below).

</domain>

<decisions>
## Implementation Decisions

### GRP-05 — Recategorize the group (propagation)
- **D-01:** Recategorization can be triggered from **two surfaces**: (a) the group detail
  page — the currently read-only subcategory display (`group-detail-client.tsx:73-75`)
  becomes an editable `SubcategoryPicker`; and (b) the collapsed **group row in the
  expenses table** — parity with individual expense rows, since the expenses table is the
  primary post-import categorization surface. Both paths invoke one group-recategorize
  operation.
- **D-02:** Propagation mechanics: one group-recategorize action runs inside a single
  `db.transaction` and, for every member expense, writes `expense.subCategoryId`,
  `status='3'`, and a **per-member Tier-2 classification-history row** (ADR 0017 §3:
  "keeping every member's Tier 2 key learning"). It also updates `expense_group.subCategoryId`
  so the two subcategory sources stay in lockstep (see D-09). Model the write on the
  existing `bulkCategorize` action (`lib/actions/expenses.ts:212-301`), which already does
  per-id subcategory+status+history writes and has **no** grouped-member guard — but a
  dedicated group action is preferred so it also touches `expense_group.subCategoryId` and
  is IDOR-scoped to `userId` + group ownership.
- **D-03:** The existing member-level guard stays. `categorizeExpense`
  (`lib/actions/expenses.ts:327-340`) already blocks categorizing a grouped member
  individually; do not weaken it. The group path is the *only* way to move a grouped
  member's category. Confirm `bulkCategorize` cannot be reached with a grouped member id
  in a way that bypasses this (grouped members are collapsed out of the table, so their
  raw ids are not individually selectable — verify during planning).

### GRP-06 — Add an expense to an existing group ("Unisci")
- **D-04:** Entry point is the **expenses-table bulk-selection bar** only. When the
  selection is exactly **one group row + N ungrouped expenses**, "Unisci" adds those
  expenses into that group instead of creating a new one. Reuse the `MergeExpensesDialog`
  flow (`components/expenses/merge-expenses-dialog.tsx`). No separate add-member action on
  the group detail page in this phase.
- **D-05:** Same shared-subcategory gate as create. The added expense(s) must resolve to
  the group's subcategory. Uncategorized added expenses get the **Phase-65 softening**:
  the dialog offers to categorize them to the group's subcategory first (explicit,
  Tier-2-visible act), then adds. An added expense already categorized to a *different*
  subcategory is rejected — identical to the create-group gate.
- **D-06:** **Group-to-group merge is rejected.** Selecting two group rows together is not
  a supported "Unisci" — the gesture adds ungrouped expenses into exactly one selected
  group. (Locked; user did not object.)

### GRP-07 — Remove member / dissolve ("Scomponi")
- **D-07:** Controls live on the **group detail page**: each member row gets a per-member
  "Rimuovi dal gruppo" (Scomponi one), and the page gets a "Scomponi gruppo" action to
  dissolve the whole group. No "Scomponi" in the expenses-table bulk bar this phase.
- **D-08:** Granularity + auto-dissolve: removing a single member deletes only that
  `expense_group_membership` row → the member becomes an ungrouped standalone expense
  again. When a removal leaves the group with **exactly one** member, the group
  **auto-dissolves** (delete the last membership row + the `expense_group` row). Dissolving
  the whole group deletes all membership rows + the group row. All mutations run inside a
  single `db.transaction`, scoped to `userId` + group ownership.

### GRP-07 / GRP-09 — Dissolution & subcategory semantics (the crux)
- **D-09:** Dissolution is **structural — nothing is reverted.** It deletes only the group
  and membership rows; freed members keep whatever subcategory they currently carry (the
  recategorized one, if the group was recategorized). No per-member "pre-merge subcategory"
  is ever stored or restored. This is exact because grouping never rewrote members
  (ADR 0017 consequence 1); recategorization is a separate, deliberate, persistent act.
  "Restore the exact pre-merge state" therefore holds **literally** for the no-recategorization
  path (same standalone rows, same totals, same hashes), and for the recategorized path the
  members simply retain their explicitly-chosen category.

### GRP-09 — Invariance proof
- **D-10:** GRP-09 is a testable requirement. The proof is an **automated integration test**
  that snapshots the dashboard aggregates (the `effectiveAmount()` sums by
  direction/nature/category from `lib/dal/dashboard.ts`) and category breakdowns
  **before and after** a full merge → recategorize → dissolve cycle, and asserts:
  (1) **merge** leaves all dashboard aggregates byte-identical; (2) **dissolve** leaves all
  dashboard aggregates byte-identical to the state immediately before it; (3) the only step
  that moves any category total is **recategorize**, and its dashboard delta is provably
  identical to recategorizing the same member expenses individually (i.e. grouping adds no
  hidden movement). Test substrate is the repo's node-only Vitest (no jsdom); assert on DAL
  aggregate outputs, not rendered UI.

### Claude's Discretion
- Exact dialog wording/step reuse vs. a thin variant of `MergeExpensesDialog` for the
  add-to-group case (D-04) — planner/executor choose, provided the softening (D-05) holds.
- Whether the group-recategorize action is a brand-new `categorizeExpenseGroup` action or a
  parameterized reuse — planner decides; D-02's invariants (per-member history, group column
  update, one transaction, IDOR scoping) are the contract.
- Confirmation-dialog copy for dissolve/remove (Italian product copy).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked model (do not re-open)
- `docs/adr/0017-expense-group-over-physical-merge.md` — the Expense Group model; §3
  (group is the categorization unit, propagation keeps per-member Tier-2 learning), §4
  (membership evolvable: add via group+expense, remove single, auto-dissolve at one),
  consequence 1 (dissolution is structurally exact because members were never rewritten).
- `docs/adr/0016-shared-costs-net-by-subcategory-inflows-isolated-per-transaction.md` —
  Standalone Expense / in-place re-hash mechanics that interact with grouped members (D-05
  in Phase 65 CONTEXT).
- `.planning/phases/65-expense-group-merge-and-view/65-CONTEXT.md` — Phase 65 locked
  decisions D-01..D-05 and `<scope_fence>` (rejected physical merge / hash aliasing / no
  persisted aggregates / no member-level recategorization while grouped).

### Requirements & domain language
- `.planning/REQUIREMENTS.md` — GRP-05/06/07/09 definitions.
- `CONTEXT.md` (repo root) → "Expense Group (Gruppo di spese)" glossary + UI verbs
  **Unisci** / **Scomponi**; Transaction vs Expense vs dashboard vocabulary.

### Why the dashboard is structurally safe (GRP-09)
- `lib/dal/dashboard.ts` — `effectiveAmount()` sums **transaction** amounts by
  direction/nature/category, never `expense.totalAmount`; the surface GRP-09's invariance
  test snapshots.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/expenses/merge-expenses-dialog.tsx` — `MergeExpensesDialog` + exported pure
  step fns (`isGroupTitleValid`, `getUncategorizedIds`, `nextStepAfterTitle`,
  `getSharedSubCategoryId`, `runCategorizeStep`, `runMergeStep`). Reuse/extend for the
  add-to-group flow (D-04, D-05).
- `components/expenses/bulk-action-bar.tsx` — "Unisci ({count})" button + `onBulkMerge`
  prop; entry point for D-04.
- `lib/actions/expenses.ts` — `bulkCategorize` (L212-301, per-id subcategory+status+history,
  no guard) is the write template for group recategorization (D-02); `mergeExpenses`
  (L438-506, validates shared non-null subcategory, dedupe, IDOR/ignored-member guards,
  calls `createExpenseGroup`) is the template for the add-to-group action.
- `lib/services/expense-group.ts` — `createExpenseGroup(dbOrTx, …)` (group + membership
  inserts only, caller owns the transaction) and `renameExpenseGroup`; add
  membership-delete / group-delete / group-recategorize service fns here (accept `DbOrTx`).
- `SubcategoryPicker` (vaul bottom sheet, single `subCategoryId` output, 7 existing surfaces)
  — the control for the editable group subcategory (D-01). Reuse; do not build a new picker.
- `components/expenses/group-detail-client.tsx` — where the editable subcategory (D-01),
  per-member "Rimuovi" and "Scomponi gruppo" (D-07) attach.
- `writeClassificationHistory` (`lib/dal/classification-history`) — per-member Tier-2 write
  (D-02).

### Established Patterns
- Schema (`lib/db/schema.ts:478-522`): `expense_group` (id, userId cascade, title,
  subCategoryId nullable set-null, timestamps — **no persisted totals**) and
  `expense_group_membership` (groupId cascade, expenseId cascade, `unique(groupId,expenseId)`
  **and standalone `unique(expenseId)`** enforcing one-group-per-expense). Membership rows
  are only removed today via FK cascade — Phase 66 introduces explicit deletes (D-08).
- Read-time composition: `composeExpenseRows` (`lib/dal/expenses.ts:175-233`) builds the
  group row (`id: "group:${groupId}"`, subcategory from **first member**); the group row's
  categorize/scomponi actions must key off the `groupId`/`groupTitle` fields it carries.
- `getExpenseGroupForDetail` (`lib/dal/expenses.ts:643-729`) reads `expense_group.subCategoryId`
  directly (joined). **Two subcategory sources** (group column vs. first-member-derived
  row) → D-02 must update both so detail page and list row never disagree.
- Layering: DAL queries in `lib/dal/`, business logic in `lib/services/`, thin `"use server"`
  in `lib/actions/`; Decimal.js for all money; IDOR-scope every mutation to `userId` (+ group
  ownership); schema change (if any FK/index needed) via `drizzle-kit generate` + `scripts/migrate.ts`.
  Note: no schema change is expected — the lifecycle ops are inserts/deletes/updates on the
  existing two tables.

### Integration Points
- Expenses table (`components/expenses/expense-table.tsx`): today `mergeEligible =
  selectedIds.length >= 2 && categorizedSubCatIds.size <= 1` (L97). Phase 66 must extend
  selection logic to recognize a selected **group row** (id `group:${groupId}`) and branch
  "Unisci" into add-to-group (D-04) and expose the group row's recategorize action (D-01).
- Group detail page (`app/(app)/expenses/groups/[groupId]/page.tsx` → `GroupDetailClient`):
  gains editable subcategory (D-01) + Scomponi controls (D-07).

</code_context>

<specifics>
## Specific Ideas

- Product copy in Italian: **Unisci** (add-to-group), **Scomponi** (remove/dissolve),
  **Rimuovi dal gruppo** (per-member), **Scomponi gruppo** (dissolve). Code/comments/tests
  in English.
- GRP-09 test is the acceptance gate for the phase: a red test here blocks completion.

</specifics>

<deferred>
## Deferred Ideas

- Group-to-group merge (combine two existing groups) — rejected for now (D-06); revisit only
  if a real need appears.
- "Scomponi" from the expenses-table bulk bar — not this phase (D-07 keeps it on the detail
  page); could be added later for table parity.
- Add-member picker on the group detail page — not this phase (D-04 uses the bulk bar only).
- Import-time similarity hints ("looks like group X") — GRP-F01, deferred forever per ADR 0017;
  never auto-merge.

</deferred>

---

*Phase: 66-expense-group-lifecycle*
*Context gathered: 2026-07-19*
