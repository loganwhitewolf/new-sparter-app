---
quick_id: 260630-h1j
status: complete
---

# Quick Task 260630-h1j — Summary

## Done

- File name in transactions column links to `/import?fileId=…`.
- Import list supports `fileId` UUID filter (parser + DAL).
- Import page treats `fileId` as active filter for empty-state / table remount.

## Verification

- `yarn test lib/validations/__tests__/import.test.ts tests/imports-dal.test.ts` — 49 passed
