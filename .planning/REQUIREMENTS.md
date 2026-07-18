# Requirements: Sparter — Milestone v2.6 (Expenses & Transactions Refinement)

**Defined:** 2026-07-18
**Core Value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending.

## v2.6 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Expense Group (GRP)

Model locked in ADR 0017 (grill 2026-07-18): grouping entity above intact Expenses; no
physical merge, no hash aliasing; read-time totals; dashboard values structurally unchanged.

- [x] **GRP-01**: User can select multiple expenses sharing the same subcategory from the expenses table bulk bar and merge them into an Expense Group with a custom title ("Unisci")
- [x] **GRP-02**: When the selection includes uncategorized expenses, the merge dialog offers to categorize them explicitly (Tier-2-visible act) before grouping — merge itself never assigns categories
- [ ] **GRP-03**: Expenses list and dashboard drill-downs show the group as a single row (title, read-time computed totals: amount sum, transaction count, min/max dates, "unita" badge); member rows are hidden
- [x] **GRP-04**: User can open a group detail page showing subcategory, member expenses with original titles/totals, and the combined transaction list; rename lives here
- [ ] **GRP-05**: User can recategorize the group and the new subcategory propagates to all members (group is the categorization unit; member-level recategorization not offered while grouped)
- [ ] **GRP-06**: User can add a later expense to an existing group (select group + expense → "Unisci"), same subcategory gate
- [ ] **GRP-07**: User can remove a single member or dissolve the group ("Scomponi"); a group left with one member auto-dissolves; dissolution restores the exact pre-merge state
- [ ] **GRP-08**: Transaction rows display the group title for transactions of grouped members; member detail pages declare group membership
- [ ] **GRP-09**: Dashboard totals and category breakdowns are provably unchanged by merge/dissolve (structural invariant: no transaction or subcategory is touched)

### Transaction Tags (TAG)

Design source: Obsidian note "sparter-tag-transazioni" (2026-07-06). Tag = second axis orthogonal to categories (context: event/trip/project). Rendering rule: tag = filter, never breakdown.

- [ ] **TAG-01**: User can create, edit, and archive tags in a curated list (name, optional date range); tags are never deleted and archived tags remain queryable
- [ ] **TAG-02**: User can bulk-assign one or more tags to transactions from the (filtered) transactions page; a transaction holds N tags
- [ ] **TAG-03**: On tag creation with a date range and on each subsequent import, the app proposes the transactions falling in the range as a pre-checked confirmable list
- [ ] **TAG-04**: User can filter the dashboard globally by tag (like month/year): all existing widgets narrow to tagged transactions, sums always reconcile
- [ ] **TAG-05**: User can view the Tag section: every tag with its per-tag total (independent cards, no sum expectation), with archive action; archived tags stay interrogable
- [ ] **TAG-06**: Viaggi category is audited: subcategories restricted to intrinsically-travel spend (flight, hotel, rental, insurance); regex/AI categorizer rules updated accordingly

### Dashboard → Transactions Navigation (NAV)

- [ ] **NAV-01**: From the dashboard with a month selected, each row of the savings/deviations view links to the transactions section with filters pre-applied matching the dashboard's current settings (month + row category context)

## Future Requirements

Deferred, tracked but not in current roadmap.

### Tags

- **TAG-F01**: AI tagging pass — pipeline suggests tags (foreign currency, unusual merchants, restaurant density ⇒ probable trip); post-stabilization per design note
- **TAG-F02**: Person/"for whom" tag family — mechanics support it for free, not promoted as a product concept

### Expense Group

- **GRP-F01**: Similarity hints at import time ("this new expense looks like group X") — suggestion only, never auto-merge (ADR 0017)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Import-time auto-merge of similar expenses | False positives merge different merchants; manual bulk is the natural post-import flow (ADR 0017) |
| Per-tag breakdown charts | Multi-tag double-counts; tag = filter, never breakdown (design note) |
| Status/reimbursement tags ("da rimborsare", "condivisa") | Already covered by transaction pairing + Standalone Expense (ADR 0016); two mechanisms for one concept is an error |
| Behavioral tags ("acquisto d'impulso") | Requires unrealistic tagging discipline |
| Physical expense merge / hash aliasing | Violates descriptionHash immutability (v2.5 contract), breaks re-import dedup (ADR 0017) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| GRP-01 | Phase 65 | Complete |
| GRP-02 | Phase 65 | Complete |
| GRP-03 | Phase 65 | Pending |
| GRP-04 | Phase 65 | Complete |
| GRP-08 | Phase 65 | Pending |
| GRP-05 | Phase 66 | Pending |
| GRP-06 | Phase 66 | Pending |
| GRP-07 | Phase 66 | Pending |
| GRP-09 | Phase 66 | Pending |
| TAG-01 | Phase 67 | Pending |
| TAG-02 | Phase 67 | Pending |
| TAG-03 | Phase 67 | Pending |
| TAG-06 | Phase 67 | Pending |
| TAG-04 | Phase 68 | Pending |
| TAG-05 | Phase 68 | Pending |
| NAV-01 | Phase 68 | Pending |

**Coverage:**

- v2.6 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-18*
*Last updated: 2026-07-18 after roadmap creation (Phases 65–68)*
