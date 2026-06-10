# Requirements: Sparter v2.0 — Nature/Direction Model Realignment

**Defined:** 2026-06-10
**Core Value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending — all on a zero-cost personal deploy.

**Design contract (LOCKED & certified):** `docs/adr/0012-direction-derived-from-nature-allocation.md`, `CONTEXT.md`, `.planning/nature-remapping-WORKING.md`. No discovery to redo — these requirements are derived directly from the contract.

**Milestone goal:** Replace the redundant `category.type` + `nature` dual-axis classification with a single nature→direction model backed by lookup tables, dissolve and rename the category/subcategory taxonomy, migrate and recategorize all existing data, move the dashboard from a 2-way to a 4-direction algebraic-sum view, and add explicit transaction pairing on top of the implicit netting.

---

## v2.0 Requirements

### Data Model — lookup tables & schema cleanup (NATURE-TABLE-01)

- [ ] **DATA-01**: A `direction` lookup table exists with the 4 static rows (`in`, `out`, `allocation`, `transfer`) carrying analytical attributes: `net_worth_effect` (increase|decrease|neutral), `included_in_totals`, `shown_separately`, `hidden`, `display_order`, `color`, `label_it`.
- [ ] **DATA-02**: A `nature` lookup table exists with one row per nature in the ADR 0012 set, each with a `direction_id` FK to `direction`, `code`, `label_it`, `color`, `display_order`. Enumerated set: `income`, `income_extraordinary` (IN); `essential`, `discretionary`, `debt` (OUT); `transfer` (TRANSFER); `savings`, `investment` (ALLOCATION). _(See Planning Risk: 8-vs-9 row-count discrepancy to resolve before schema build.)_
- [ ] **DATA-03**: `sub_category.nature_id` and `user_subcategory_override.nature_id` are FK columns to `nature`, replacing the `flow_nature` enum column. Direction is **never stored** on the transaction — it is derived via join `transaction → sub_category → nature → direction`.
- [ ] **DATA-04**: `category.type` (`category_type` enum) and its index `category_type_idx` are removed, and all ~18 call sites that branch on `category.type` are migrated to nature-derived direction (supersedes ADR 0008).
- [ ] **DATA-05**: `amount_sign` (`amount_sign` enum) is removed from `categorization_pattern`, the derive-sign-from-category logic is deleted, patterns become sign-agnostic, and the unique constraint becomes `(pattern, subCategoryId)`.
- [ ] **DATA-06**: `sub_category.exclude_from_totals` is removed; "excluded from spending totals" is now sourced from `direction.included_in_totals` (transfer + allocation excluded from spending totals).

### Taxonomy & Seeds — category/subcategory remap

- [ ] **TAX-01**: The seeded taxonomy matches the working-doc final remap: 23 categories / ~65 subcategories across IN (4 categories), OUT (16), ALLOCATION (2), TRANSFER (1), each subcategory assigned its correct nature.
- [ ] **TAX-02**: Category/nature dissolutions and renames are applied per the working doc: `operational` dissolved into essential/discretionary; `financial`→`investment`, `extraordinary`→`savings`; wrapper categories (Assicurazioni, Abbonamenti, Famiglia) distributed by object/purpose; Risparmio + Investimenti moved to ALLOCATION; Bonifici/movimenti-liquidità folded into TRANSFER.
- [ ] **TAX-03**: `scripts/seed-data.ts` reflects the new baseline taxonomy and `scripts/seed-extras.ts` gains the additive step(s) needed to populate `nature_id` / direction data on existing rows, following the additive seed model (no edits to already-shipped seed shapes).

### Migration & Recategorization — existing data

- [ ] **MIG-01**: A generated SQL migration (no `drizzle-kit push`) creates the new tables/columns, backfills `nature_id` for every existing subcategory and override, and removes the deprecated columns/enums in the correct dependency order.
- [ ] **MIG-02**: Existing transactions are recategorized so their effective nature matches the new model — including the misclassified cases the model fixes (e.g. `vendita-investimenti` → `investment` divestment, inheritances → `income_extraordinary`).
- [ ] **MIG-03**: Existing categorization patterns are converted to sign-agnostic without losing their subcategory targeting, so a `+` refund can reach the same subcategory as the original expense and net.

### Dashboard & Aggregation — 4-direction algebraic sum

- [ ] **DASH-01**: The dashboard presents a 4-direction view: IN and OUT as today, a visible-but-separate ALLOCATION block ("Accantonato / Investito"), and TRANSFER excluded and hidden.
- [ ] **DASH-02**: All dashboard/KPI/category aggregations use direction-grouped **algebraic sum** (generalising ADR 0004), replacing the sign-split `sum(amount>0)` / `abs(sum(amount<0))` logic everywhere it appears (overview, KPI, category DAL, components).
- [ ] **DASH-03**: Divestments and refunds net within their own direction/subcategory segment — a transaction's amount sign may oppose its nature's direction (a `+` refund under an OUT subcategory): shown by real amount in the list, netted in the chart/KPIs.
- [ ] **DASH-04**: KPI cards and reading lines reflect the new direction model (spending totals exclude allocation + transfer; allocation surfaced as its own measure such as "quanto ho accantonato/investito").

### Categorization Surfaces — cascade, filters, pickers

- [ ] **CAT-01**: `cascade-options.ts` and the type→nature cascade derive from the nature→direction mapping (single source of truth), with no reference to the removed `category.type`.
- [ ] **CAT-02**: Transaction/expense table filters operate on direction + nature consistently with the new model (the recently shipped nature/type filters re-pointed to the lookup-backed values), and remain functional after the schema change.

### Transaction Pairing (TX-PAIRING-01) — final phase

- [ ] **PAIR-01**: A user can explicitly link a transaction to the opposite transaction that cancels it (order↔refund, expense↔reimbursement) as a 1:1 (or 1:N) relationship, additive over — not replacing — the implicit subcategory netting (ADR 0004).
- [ ] **PAIR-02**: Paired transactions have a dedicated display in the transaction list that makes the link and its netting effect visible.
- [ ] **PAIR-03**: Unlinking is possible, and the implicit-netting baseline behaviour is unchanged for transactions that are not explicitly paired.

---

## Future / Deferred

- **REVAL-01**: Apply a newly created pattern to existing transactions from the same import file. _(Parked backlog, predates v2.0.)_
- **R029**: Complete categorization revalidation for all entrypoints. _(Partial; predates v2.0.)_
- **Employer reimbursement split**: Splitting expense reimbursements bundled into a monthly salary credit. _(Explicitly deferred in ADR 0012 — known limitation.)_

## Out of Scope

| Feature | Reason |
|---------|--------|
| Two independent axes + consistency constraint | Rejected in ADR 0012 — stores the same fact twice; direction is a property of nature |
| `category.type` as direction source | Rejected — contradicts nature-based grouping (ADR 0003/0004) |
| Treating savings/investments as `out` spending | Rejected — not consumption; inflates reported spending |
| Folding savings/investments into `transfer` | Rejected — allocations are a positive behaviour the user wants to see/measure |
| A separate "recurring spend / subscriptions" nature | Rejected — orthogonal cut (flag/view), not a nature |
| Niche investment subcategories (crowdfunding/P2P, startup equity, art, forex) | Users create their own; keep the seed taxonomy lean |
| Operator deploy (Vercel/Supabase/R2 — R038/R039/R041) | Operator-pending, unrelated to model realignment |

## Planning Risk

- **Nature row-count (8 vs 9):** ADR 0012's "Consequences" enumerates a **final set of 8** natures; the ADR data-model section and the working-doc summary both say **`nature` (9 rows)**. DATA-02 is written against the enumerated 8. Resolve the intended count (stale "9", or a deliberate 9th row such as an `uncategorized`/null-sentinel nature) before building the `nature` table and seed. _(Carried from the source contract; not a re-opening of the locked design.)_

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 46 | Pending |
| DATA-02 | Phase 46 | Pending |
| DATA-03 | Phase 46 | Pending |
| DATA-04 | Phase 46 | Pending |
| DATA-05 | Phase 46 | Pending |
| DATA-06 | Phase 46 | Pending |
| TAX-01 | Phase 47 | Pending |
| TAX-02 | Phase 47 | Pending |
| TAX-03 | Phase 47 | Pending |
| MIG-01 | Phase 48 | Pending |
| MIG-02 | Phase 48 | Pending |
| MIG-03 | Phase 48 | Pending |
| DASH-01 | Phase 49 | Pending |
| DASH-02 | Phase 49 | Pending |
| DASH-03 | Phase 49 | Pending |
| DASH-04 | Phase 49 | Pending |
| CAT-01 | Phase 49 | Pending |
| CAT-02 | Phase 49 | Pending |
| PAIR-01 | Phase 50 | Pending |
| PAIR-02 | Phase 50 | Pending |
| PAIR-03 | Phase 50 | Pending |

**Coverage:**
- v2.0 requirements: 21 total
- Mapped to phases: 21/21 ✓
- Unmapped: 0

---
*Requirements defined: 2026-06-10*
*Last updated: 2026-06-10 — traceability populated after roadmap creation*
