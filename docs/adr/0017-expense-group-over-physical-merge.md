# Same-merchant expenses unify via an Expense Group above intact Expenses, never by physical merge or hash aliasing

## Status

accepted (grill session 2026-07-18; respects the v2.5 edit-domain contract — `descriptionHash` immutable, derived aggregates never directly writable; consistent with the Standalone Expense mechanics of [ADR 0016](./0016-shared-costs-net-by-subcategory-inflows-isolated-per-transaction.md))

## Context

The same real-world merchant produces distinct Expenses because bank descriptions differ per platform/card (e.g. `Cherasco 57`, `CHERASCO 57`, `Cherasco 57 SRL` across three cards). The user sees three rows for what is one spending relationship and wants to unify them — under a hard constraint: **dashboard values must not change** as a side effect.

Relevant structural facts:

- An Expense aggregates transactions by `UNIQUE (user_id, description_hash)`; `descriptionHash` is also the Tier 2 (history) categorization key and drives re-import dedup.
- The dashboard sums **transaction** amounts (by direction/nature/category), not `expense.totalAmount` — so regrouping expenses cannot move totals *unless the category assignment moves*.

## Decision

**1. Unification is a grouping entity above Expense (option A) — members stay intact.** An Expense Group holds N member Expenses, a user-given title, and implies a single subcategory. Members keep their `descriptionHash`, aggregates, Tier 2 history, and re-import behavior unchanged. Group totals (amount, transaction count, date range) are computed at read time, never persisted.

Rejected:
- **(B) Physical merge** — repoint transactions onto one Expense and delete the others. Re-import recreates the deleted variants (dedup is per-hash), so an alias map becomes necessary anyway: all of A's complexity plus irreversibility.
- **(C) Hash aliasing at normalization** — map variant descriptions to a canonical hash at import plus backfill. Violates the v2.5 immutability contract on `descriptionHash` and pollutes Tier 2 history keys.

**2. Merge requires equal subcategory; categorization is a separate act.** The merge gate is *all members share the same non-null subcategory*. Uncategorized selections are softened in UI only: the merge dialog offers to categorize them first (an explicit, Tier-2-visible categorization act), then groups. The merge itself is pure regrouping and therefore **structurally** unable to move dashboard values.

**3. The group is the categorization unit.** Recategorizing the group propagates to all members (keeping every member's Tier 2 key learning). Member-level recategorization is not offered while grouped — detach from the group first.

**4. Membership is manual and evolvable; no import-time auto-merge.** A later variant joins by selecting `group + expense → Unisci`. A single member can be removed; a group left with one member dissolves. No similarity heuristics at import: false positives (merging different merchants) are costlier than the manual bulk gesture, which is already Sparter's natural post-import flow.

**5. Standalone Expenses are not special-cased.** A Standalone Expense may join a group (grouping is orthogonal to hash aggregation). Detaching a transaction from a grouped member follows normal rules: a new standalone expense is born outside the group; the in-place single-transaction re-hash (ADR 0016 §4) keeps the member — now synthetic-hashed — inside its group.

## Consequences

- Reversibility is structural: dissolving a group restores exactly the pre-merge state, because nothing about the members was ever rewritten.
- Rendering changes are read-side only: expenses list and dashboard drill-downs show one group row in place of member rows; transaction rows display the group title; member detail pages declare their group membership.
- A new schema entity (group + membership) and read-time aggregation are required; no migration touches existing expense/transaction rows.
- New variants keep appearing as ungrouped rows until manually joined — accepted; auto-suggestion (e.g. similarity hints) is a possible future layer, deliberately out of this decision.
