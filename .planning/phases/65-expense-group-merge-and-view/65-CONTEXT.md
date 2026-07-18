# Phase 65: expense-group-merge-and-view — Context

**Source:** ADR Ingest Express Path (docs/adr/0017-expense-group-over-physical-merge.md)
**Phase requirements:** GRP-01, GRP-02, GRP-03, GRP-04, GRP-08
**Status of source ADR:** accepted (grill session 2026-07-18)

<domain>

The same real-world merchant produces distinct Expenses because bank descriptions
differ per platform/card (e.g. `Cherasco 57`, `CHERASCO 57`, `Cherasco 57 SRL`
across three cards). The user sees three rows for one spending relationship and
wants to unify them — under a hard constraint: **dashboard values must not change**
as a side effect.

Structural facts (verified against schema during the grill):

- An Expense aggregates transactions by `UNIQUE (user_id, description_hash)`
  (`lib/db/schema.ts`); `descriptionHash` is also the Tier 2 (history)
  categorization key and drives re-import dedup.
- The dashboard sums **transaction** amounts via `effectiveAmount()` by
  direction/nature/category (`lib/dal/dashboard.ts`), not `expense.totalAmount` —
  so regrouping expenses cannot move totals *unless a category assignment moves*.
- Canonical domain term: **Expense Group (Gruppo di spese)** — see CONTEXT.md
  glossary entry. UI verbs: **Unisci** / **Scomponi**.

</domain>

<decisions>

- **D-01:** Unification is a grouping entity above Expense — members stay intact (locked). An Expense Group holds N member Expenses, a user-given title, and implies a single subcategory. Members keep their `descriptionHash`, aggregates, Tier 2 history, and re-import behavior unchanged. Group totals (amount sum, transaction count, min/max dates) are computed at read time, **never persisted**.
- **D-02:** Merge requires equal subcategory; categorization is a separate act (locked). The merge gate is: all members share the same non-null subcategory. Uncategorized selections are softened in UI only — the merge dialog offers to categorize them first (an explicit, Tier-2-visible categorization act), then groups. The merge itself is pure regrouping and therefore structurally unable to move dashboard values.
- **D-03:** The group is the categorization unit (locked). Phase 65 consequence: the group detail page shows ONE subcategory; member-level recategorization controls are not offered on grouped members. The propagation mechanics of recategorizing a group are Phase 66 scope.
- **D-04:** Membership is manual; no import-time auto-merge (locked). No similarity heuristics at import. New variants appear as ungrouped rows until manually joined. Add-to-existing-group / remove-member / dissolve flows are Phase 66 scope; Phase 65 delivers creation via bulk "Unisci" only.
- **D-05:** Standalone Expenses are not special-cased (locked). A Standalone Expense may join a group (grouping is orthogonal to hash aggregation). Detaching a transaction from a grouped member follows normal rules: the new standalone expense is born outside the group; the in-place single-transaction re-hash (ADR 0016 §4) keeps the member — now synthetic-hashed — inside its group.

</decisions>

<canonical_refs>

- `docs/adr/0017-expense-group-over-physical-merge.md` — the locked model (this phase implements it; do not re-open)
- `docs/adr/0016-shared-costs-net-by-subcategory-inflows-isolated-per-transaction.md` — Standalone Expense mechanics interacting with groups (D-05)
- `CONTEXT.md` → "Expense Group (Gruppo di spese)" glossary entry — canonical vocabulary
- `lib/db/schema.ts` — `expense` / `transaction` tables (unique constraints that make physical merge impossible)
- `lib/dal/dashboard.ts` — `effectiveAmount()` aggregation (why dashboard is structurally safe)
- `.planning/REQUIREMENTS.md` — GRP-01..09 definitions (65 covers 01,02,03,04,08)

</canonical_refs>

<specifics>

- Bulk entry point: the expenses table bulk-selection bar gains "Unisci" (GRP-01);
  gate = same non-null subcategory across selection.
- Merge dialog: custom title input; if selection includes uncategorized expenses,
  offer inline categorization first (SubcategoryPicker reuse), then merge (GRP-02).
- Rendering (GRP-03): expenses list and dashboard drill-down expense lists show the
  group as ONE row — title, summed amount, combined transaction count, min/max
  dates, "unita" badge (member-count/platform hint acceptable); member rows hidden.
  Filters/sort treat the group row like a normal row.
- Group detail page (GRP-04): shared subcategory, member list (original titles +
  totals), combined transaction list, rename action. Follow the v2.5
  `DetailPageShell` pattern (`/expenses/[id]` precedent).
- Transaction surfaces (GRP-08): transaction rows show the group title for grouped
  members' transactions; member expense detail pages declare "parte di: {group}".
- Money display math uses Decimal.js helpers (`@/lib/utils/decimal`) — read-time
  sums are still monetary arithmetic.
- Layering: queries in `lib/dal/`, business logic in `lib/services/`, thin
  `"use server"` wrappers in `lib/actions/`; schema change via
  `drizzle-kit generate` + `scripts/migrate.ts` (never push).
- Product copy in Italian (Unisci, Scomponi, "unita"); code/comments in English.

</specifics>

<deferred>

- Recategorize-group propagation, add-member-to-existing-group, remove-member,
  dissolve, auto-dissolve-at-1, and the dashboard-invariance proof cycle → Phase 66
  (GRP-05, GRP-06, GRP-07, GRP-09).
- Similarity hints at import ("looks like group X") → future (GRP-F01), never auto-merge.

</deferred>

<scope_fence>

REJECTED by ADR 0017 — do not implement, do not partially implement:

- **(B) Physical merge** — repointing transactions onto one Expense and deleting
  the others. Re-import recreates deleted variants; irreversible.
- **(C) Hash aliasing at normalization** — mapping variant descriptions to a
  canonical hash + backfill. Violates the v2.5 `descriptionHash` immutability
  contract and pollutes Tier 2 history keys.
- No persisted group aggregates (no `totalAmount` column on the group entity).
- No import-time auto-merge or similarity heuristics.
- No member-level recategorization controls while grouped.

</scope_fence>

## Success Criteria (from ADR consequences)

1. Reversibility is structural: nothing about member expenses is rewritten by
   grouping (dissolve in Phase 66 will restore pre-merge state exactly — Phase 65
   must not persist anything that would prevent that).
2. Rendering changes are read-side only: expenses list and dashboard drill-downs
   show one group row in place of member rows; transaction rows display the group
   title; member detail pages declare their group membership.
3. New schema entities are additive (group + membership); no migration touches
   existing expense/transaction rows.
4. New variants keep appearing as ungrouped rows until manually joined — accepted.

## Risk Summary

- ADR lists no negative consequences; residual risks are implementation-level:
  read-time aggregation must not regress expenses-list query performance, and the
  group row must compose correctly with the v1.14 filter/sort system (URL-first,
  server-side WHERE).
