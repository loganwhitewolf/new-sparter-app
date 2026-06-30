---
quick_id: 260630-dd7
status: complete
---

# Quick Task 260630-dd7 — Summary

## Completed

- Added `analyzing` to stale-deletable import statuses (`lib/utils/import-status.ts`, `lib/actions/import.ts`)
- Exposed **Elimina** in the overflow menu for rows stuck in `analyzing`, keeping the in-progress indicator
- Updated `tests/import-table-actions.test.tsx` expectations

## Notes

- Uses existing `deleteStaleFileAction` + `ImportStaleDeleteDialog` — no new deletion path
- `importing` left unchanged: partial transactions would need full `deleteImport` reconciliation

## Verification

- `yarn test tests/import-table-actions.test.tsx` — analyzing tests pass (1 unrelated pre-existing failure on suggestions href)
