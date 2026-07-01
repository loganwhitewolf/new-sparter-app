---
quick_id: 260630-gbv
status: complete
---

# Quick Task 260630-gbv — Summary

## Done

- Added `ImportDisplayNameEdit` — inline rename with pencil (parity with expenses/transactions).
- Wired into import table File column; removed overflow menu «Rinomina» and `ImportRenameDialog`.
- Updated unit + e2e tests for inline edit flow.

## Verification

- `yarn test tests/import-display-name-edit.test.tsx tests/import-table-actions.test.tsx` — new tests pass; one pre-existing failure on suggestions href assertion (unrelated).
