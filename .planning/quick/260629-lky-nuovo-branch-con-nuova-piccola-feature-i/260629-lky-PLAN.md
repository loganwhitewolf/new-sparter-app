# Quick Task 260629-lky: File download + expense details

## Task 1: R2 presigned GET + download API

**Files:** `lib/services/r2.ts`, `app/api/files/[fileId]/download/route.ts`, `lib/utils/import-status.ts`, `tests/r2.test.ts`, `tests/file-download-api.test.ts`

- Add `createPresignedGetUrl` with attachment Content-Disposition
- GET route verifies session + file ownership; reject `pending_upload`
- Return short-lived presigned URL JSON (never proxy bytes)

## Task 2: Import list download action

**Files:** `components/import/import-row-actions.tsx`, `tests/import-table-actions.test.tsx`

- Dropdown item "Scarica file originale" for downloadable statuses
- Client fetches API then opens presigned URL in new tab

## Task 3: Expense details dialog

**Files:** `lib/dal/expenses.ts`, `lib/actions/expenses.ts`, `components/expenses/expense-transactions-dialog.tsx`, `components/expenses/expense-table.tsx`

- Rename menu item "Vedi transazioni" → "Dettagli"
- Show source import file name in dialog (link to `/import?q=…`)
- Extend `fetchExpenseTransactions` with `sourceFile`
