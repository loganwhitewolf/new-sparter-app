---
phase: 39-unified-subcategory-picker
fixed_at: 2026-06-02T14:45:00Z
review_path: .planning/phases/39-unified-subcategory-picker/39-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 39: Code Review Fix Report

**Fixed at:** 2026-06-02T14:45:00Z
**Source review:** .planning/phases/39-unified-subcategory-picker/39-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (CR-01 through CR-04, WR-01 through WR-05; IN-* excluded per fix_scope)
- Fixed: 9
- Skipped: 0

## Fixed Issues

### CR-01: Inverted amount color coding in TransactionTable

**Files modified:** `components/transactions/transaction-table.tsx`
**Commit:** 2d6b030
**Applied fix:** Swapped the ternary branches — negative amounts now get `text-foreground` (neutral), positive amounts get `text-emerald-700` (green). Income is now green, expenses neutral.

---

### CR-02: PickerBody type state stales on re-open

**Files modified:** `components/categorization/subcategory-picker.tsx`
**Commit:** 81d2699
**Applied fix:** Added `key={open ? 'open' : 'closed'}` to `<PickerBody>` inside `SubcategoryPicker`. This forces a remount each time the sheet opens, resetting `type`, `query`, and `active` to their initial values from `defaultType`. Also fixed WR-03 in the same commit (same file).

---

### CR-03: UpdatePatternSchema allows client-supplied amountSign/confidence

**Files modified:** `lib/validations/pattern.ts`, `lib/actions/patterns.ts`
**Commit:** f2300e0
**Applied fix:** Added `UpdatePatternClientSchema` to `lib/validations/pattern.ts` that omits `amountSign` and `confidence` via `.omit({ amountSign: true, confidence: true }).partial()`. Updated `updatePatternAction` to import and use `UpdatePatternClientSchema` instead of `UpdatePatternSchema`, with an explanatory comment.

---

### CR-04: Soft-delete reactivation does not update amountSign/confidence

**Files modified:** `lib/dal/patterns.ts`
**Commit:** 011a781
**Applied fix:** Extended the reactivation `.set()` call to include `amountSign: input.amountSign` and `confidence: input.confidence.toFixed(2)` in addition to `isActive: true` and `updatedAt`. Reactivated rows now always reflect the current server-derived values.

---

### WR-01: Dead useActionState in ExpenseCategorizeDialog

**Files modified:** `components/expenses/expense-categorize-dialog.tsx`
**Commit:** 2dc7208
**Applied fix:** Removed `useActionState`, `formAction`, `lastErrorRef`, `useRef`, the unused `Alert`/`AlertDescription`/`AlertCircle` imports, and the unreachable sr-only error block. The component now imports only `useTransition` and uses the working direct-call pattern via `startTransition`.

---

### WR-02: CreatePatternDialog does not reset subcategory on cancel/close

**Files modified:** `components/patterns/create-pattern-dialog.tsx`
**Commit:** 4187527
**Applied fix:** Added `handleOpenChange(next: boolean)` that calls `setOpen(next)` and additionally clears `subCategoryId` and `subCategoryLabel` when `next` is `false`. Wired it to `<Dialog onOpenChange={handleOpenChange}>`.

---

### WR-03: Stale task-tracking comment in subcategory-picker.tsx

**Files modified:** `components/categorization/subcategory-picker.tsx`
**Commit:** 81d2699 (bundled with CR-02 — same file)
**Applied fix:** Replaced the inline comment `{/* Body — filled in Task 2 */}` with `{/* Master-detail body — keyed on open to reset internal state on each open */}`. Replaced the section header comment `// PickerBody — placeholder until Task 2 (compiles but shows nothing)` with `// PickerBody — master-detail layout with type chips, search, and rail`.

---

### WR-04: normalizePatternInput accepts /// as valid (source = '/')

**Files modified:** `lib/validations/pattern.ts`
**Commit:** 2f61095
**Applied fix:** Changed the empty-source guard from `source.length === 0` to `source.length < 2`. Inputs that normalize to a single character (e.g. `///` → `/`) are now rejected with `INVALID_PATTERN_MESSAGE`. Added an explanatory comment.

---

### WR-05: Redundant customName fallback in form dialog label resolution

**Files modified:** `components/expenses/expense-form-dialog.tsx`, `components/transactions/transaction-form-dialog.tsx`
**Commit:** c1fb764
**Applied fix:** Replaced `subCat.customName ?? subCat.name` with `subCat.name` in both `ExpenseFormDialog` and `TransactionFormDialog`. The DAL already bakes `overrideCustomName ?? subCategoryName` into the `name` field at row-map time, so `customName ?? name` is redundant. Both dialogs now follow the same convention as `SuggestionPromoteForm`.

---

_Fixed: 2026-06-02T14:45:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
