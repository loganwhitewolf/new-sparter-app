---
status: complete
---

# Quick Task 260629-lky — Summary

Branch: `feat/file-download-expense-details`

## Done

1. **R2 download** — `createPresignedGetUrl` + `GET /api/files/[fileId]/download` (auth-scoped, no byte proxying).
2. **File list** — overflow menu item "Scarica file originale" for uploaded/imported/failed files.
3. **Expenses** — dropdown "Dettagli"; dialog shows linked transactions + source import file name.

## Tests

- `tests/r2.test.ts` — presigned GET
- `tests/file-download-api.test.ts` — download route
- `tests/import-table-actions.test.tsx` — download menu visibility

## Commits

- Code: feature implementation
- Docs: GSD artifacts + STATE.md
