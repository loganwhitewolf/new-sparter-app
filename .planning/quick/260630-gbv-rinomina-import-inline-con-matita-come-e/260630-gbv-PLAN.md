---
quick_id: 260630-gbv
slug: rinomina-import-inline-con-matita-come-e
status: ready
---

# Quick Plan: Rinomina import inline con matita

## Goal

Replace import rename dialog + overflow menu item with inline pencil edit (parity with `ExpenseTitleEdit` / `TransactionTitleEdit`).

## Tasks

### Task 1: ImportDisplayNameEdit component

- **files:** `components/import/import-display-name-edit.tsx` (new)
- **action:** Inline edit using `updateImportDisplayNameAction` + `useActionState`; pencil on hover; show `originalName` subtitle when custom name set.
- **done:** Component mirrors transaction title edit pattern.

### Task 2: Wire table + remove menu rename

- **files:** `import-table.tsx`, `import-row-actions.tsx`, delete `import-rename-dialog.tsx`
- **action:** Use inline edit in File column; drop `onRename` prop and menu item; remove dialog state.
- **verify:** `yarn test tests/import-table-actions.test.tsx`
- **done:** No "Rinomina" in overflow menu.

### Task 3: Tests

- **files:** `tests/import-display-name-edit.test.tsx`, `tests/import.spec.ts`, `tests/import-table-actions.test.tsx`
- **verify:** vitest + update e2e for inline edit (no dialog).
