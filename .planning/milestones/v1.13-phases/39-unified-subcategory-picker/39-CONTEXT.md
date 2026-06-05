# Phase 39: unified-subcategory-picker — Context

**Gathered:** 2026-06-01
**Status:** Ready for planning
**Source:** PRD Express Path (app/(app)/prototype/subcategory-picker/NOTES.md — design contract + variant E verdict) + ADR docs/adr/0008-pattern-amount-sign-derived-from-subcategory.md

<domain>
## Phase Boundary

Replace the three divergent subcategory-selection implementations with ONE reusable picker (winning prototype variant E) and adopt it across all 7 selection surfaces. Add the "most used" DAL query. Rework the pattern-creation form. Delete the prototype route on merge.

The three implementations being unified today:
1. `components/expenses/category-combobox.tsx` (`CategoryCombobox`) — searchable Popover+Command; used by `expense-categorize-dialog` (shared by Expenses page AND Transactions table) and `bulk-categorize-dialog`.
2. `app/(app)/onboarding/_components/subcategory-combobox.tsx` (`SubcategoryCombobox`) — near-duplicate Popover+Command with FlowNature badge + auto-submit.
3. Cascading `Select` pairs (Categoria → Sottocategoria, no search) — in `create-pattern-dialog`, `suggestion-promote-form`, `expense-form-dialog`, `transaction-form-dialog`.

The 8 adoption surfaces:
1. Categorize expense (`expense-categorize-dialog`)
2. Categorize transaction (same dialog, opened from `transaction-table`)
3. Onboarding categorization (Step 4)
4. Bulk categorize (`bulk-categorize-dialog`)
5. Create/edit expense form (`expense-form-dialog`)
6. Create/edit transaction form (`transaction-form-dialog`)
7. Create pattern (`create-pattern-dialog`) + suggestion promotion (`suggestion-promote-form`)
8. Edit existing pattern (`components/patterns/pattern-actions.tsx`, rendered in Settings › Categories via `category-pattern-panel.tsx`) — surfaced by the plan-checker; same act, must not keep the cascading Select + amountSign/confidence controls.

Out of scope:
- Inline "create new subcategory" from the picker (stays in Settings › Categories).
- FlowNature as a user-facing filter (deliberately excluded).
- Changing pattern selection precedence / categorization tiering (ordering stays user-before-system then `priority`).
- Drag-to-dismiss snap points / advanced `vaul` gestures beyond a basic bottom sheet.
- A "Gestisci categorie" footer link (deferred).
</domain>

<decisions>
## Implementation Decisions

### D-01: One shared subcategory-selection control
A single picker component adopted in all 7 surfaces. Output is always a single `subCategoryId`. The Category is never assigned independently — it is derived from the chosen Subcategory (the `expense` table has no `category_id` column). Subcategory selection is **mandatory** everywhere (no category-only state).
- **Status: LOCKED** — R-UP-01

### D-02: Container — fixed-height bottom sheet on all viewports (via `vaul`)
Bottom sheet that rises from the bottom on every viewport (no popover/drawer split, no centred modal). Desktop: constrained width, centred horizontally, still docked to the bottom edge. **Stable height** (≈80vh mobile / ≈600px desktop) — the sheet must NOT grow/shrink when switching type or filtering; only the inner lists scroll. Real build uses `vaul` (not yet a dependency); the prototype faked it with a throwaway primitive.
- **Status: LOCKED** — R-UP-01, R-UP-08

### D-03: Filtering — type chips as the sole coarse filter
Free-text search on top + **type chips: Entrate (`in`) · Uscite (`out`) · Trasferimenti (`transfer`)** as the only coarse filter. The picker shows all four category types together (`in/out/transfer/system`) because an `expense` row can be income, expense or transfer. The type chip is **preselected from the row's amount sign** (negative → Uscite, positive → Entrate), overridable. `system` is empty post-Trasferimenti migration → no chip, still reachable under "Tutte"/search. NO FlowNature filter.
- **Status: LOCKED** — R-UP-02

### D-04: Layout — two-column master-detail (variant E)
Left column = "⭐ Più usate" (always available, first item) + categories of the active type. Right column = subcategories of the selected category rendered as tiles (hover-lift, count hints, no FlowNature badge). Selecting "Più usate" shows the most-used (filtered by active type) in the right column. Mobile drills left→right with a back action. Free-text search collapses both columns into a flat tile list.
- **Status: LOCKED** — R-UP-03

### D-05: Row content
Subcategory name + category group + "Personale" badge if owned. NO FlowNature badge in the picker.
- **Status: LOCKED** — R-UP-03

### D-06: "Most used" semantics + DAL query
Top ~6 subcategories by per-user categorization count, scoped to the call site's allowed category types, **hidden when empty** (cold-start / new user / onboarding), **global per user** (not contextual), hidden once the user types. New DAL query required.
- **Status: LOCKED** — R-UP-04

### D-07: Interaction contract — tap = select + close + return value
Tapping a subcategory closes the sheet and returns the value via `onChange(subCategoryId)`. The caller decides what happens next:
- Categorize expense / categorize transaction / onboarding / bulk → **commit immediately** on tap (bulk applies to all selected on one tap; reversible).
- Create/edit forms (expense, transaction, pattern) → **fill the field**, form submits later.
- **Status: LOCKED** — R-UP-06

### D-08: Pattern forms reduced to regex + description + "Categorizza"
The pattern forms drop the explicit Category/Subcategory `Select` pair, the segno-importo control, and the confidence field. They become: regex input + description input + a "Categorizza" button that opens the unified picker. Applies to `create-pattern-dialog`, `suggestion-promote-form`, AND `pattern-actions.tsx` (the edit-existing-pattern dialog in Settings › Categories). `updatePatternAction` must derive `amountSign` server-side from the chosen subcategory's category type and set `confidence=1`, mirroring `createPatternAction`.
- **Status: LOCKED** — R-UP-07

### D-09: `amountSign` derived from category type; `confidence` = 1
`amountSign` is no longer a user field — it is derived from the chosen subcategory's category type: `out → negative`, `in → positive`, `transfer`/`system → any`. The `amountSignMatches` matching logic is kept (load-bearing: categorization runs across both signs). `confidence` for user-created patterns is hardcoded to `1` (metadata only; no effect on selection precedence). Same for suggestion promotion (currently hardcodes 0.85 → becomes 1). Per ADR 0008.
- **Status: LOCKED** — R-UP-07

### D-10: Remove old pickers + delete prototype on merge
Once all 8 surfaces use the new picker, delete `CategoryCombobox`, the onboarding `SubcategoryCombobox`, and ALL cascading `Select` pairs — including the one in `pattern-actions.tsx` — so no duplicate selection UX remains. The 39-06 cleanup grep sweep MUST include `pattern-actions.tsx`. Delete the prototype route `app/(app)/prototype/subcategory-picker/`. `yarn build` + `yarn check:language` must pass.
- **Status: LOCKED** — R-UP-09, R-UP-10

### Claude's Discretion
- Exact location/name of the new shared component (e.g. `components/categorization/subcategory-picker.tsx`).
- `vaul` integration specifics and how the responsive width/centering is expressed in Tailwind.
- Implementation of the most-used query (raw SQL count vs Drizzle groupBy; reuse of `expenseClassificationHistory` vs `expense` count) — but it must respect D-06.
- How the picker is parameterised per call site (allowed types, default type from sign, commit-vs-fill behavior) — props shape is the planner's call.
- Whether `buildCategoryOptions`/`filterCategoryOptions` from the current `category-combobox.tsx` are extracted/reused before that file is deleted.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design contract (authoritative)
- `app/(app)/prototype/subcategory-picker/NOTES.md` — 10 locked decisions + variant E verdict + rationale.
- `app/(app)/prototype/subcategory-picker/_prototype.tsx` — reference implementation of variant E (and A/B/C/D); the winning layout, fixed-height sheet, type chips, two-column master-detail, tile components.
- `docs/adr/0008-pattern-amount-sign-derived-from-subcategory.md` — amountSign derivation + confidence=1 + why the matching is load-bearing.
- `CONTEXT.md` (repo root) — domain glossary: Categorization, Subcategory, FlowNature, Trasferimenti, PatternSuggestion.

### Current implementations to replace / reuse
- `components/expenses/category-combobox.tsx` — `buildCategoryOptions`, `filterCategoryOptions`, `CategoryOption` (pure, reusable).
- `app/(app)/onboarding/_components/subcategory-combobox.tsx`
- `components/expenses/expense-categorize-dialog.tsx`, `components/expenses/bulk-categorize-dialog.tsx`
- `components/expenses/expense-form-dialog.tsx`, `components/transactions/transaction-form-dialog.tsx`, `components/transactions/transaction-table.tsx`
- `components/patterns/create-pattern-dialog.tsx`, `components/import/suggestion-promote-form.tsx`

### Data + logic
- `lib/dal/categories.ts` — `getCategories`, `CategoryWithSubCategories` (has `type`, `isOwned`, `effectiveNature`).
- `lib/services/categorization.ts` — `amountSignMatches`, pattern ordering (confidence is NOT in the order).
- `lib/dal/patterns.ts`, `lib/validations/pattern.ts`, `lib/actions/patterns.ts` — pattern create/promote (confidence, amountSign write paths).
- `lib/actions/expenses.ts` — `categorizeExpense` (writes `subCategoryId` only).

### Precedent
- `.planning/phases/38-first-import-onboarding/` — prior phase that deleted its prototype on merge (R-OB-11) and used a prototype verdict as context.
</canonical_refs>

<specifics>
## Specific Ideas

Variant E concrete shape (from the prototype): top = search input + `TypeChips` (Tutte/Entrate/Uscite/Trasferimenti); body = `grid sm:grid-cols-[190px_1fr]`, left rail (RailItem list: "Più usate" + categories of active type with subcategory counts), right pane (D-style `Tile` list of subcategories). Mobile: left hidden when a rail item is active, right hidden at root, "‹ Categorie" back button. Search non-empty → flat `Tile` list. Sheet height fixed; only columns scroll (`min-h-0 overflow-y-auto`).

Pattern form after rework: `<input regex>` + `<input description>` + `[Categorizza]` button → opens picker → on select fills a hidden `subCategoryId`, derives `amountSign` from that subcategory's category type, submits with `confidence=1`.
</specifics>

<deferred>
## Deferred Ideas

- "Gestisci categorie" link in the sheet footer (jump to Settings › Categories).
- `vaul` drag-to-dismiss snap points / multi-detent gestures.
- Contextual (per-amount or per-page) most-used ranking — current scope is global-per-user only.
</deferred>

---

*Phase: 39-unified-subcategory-picker*
*Context gathered: 2026-06-01 via PRD Express Path (prototype NOTES.md contract)*
