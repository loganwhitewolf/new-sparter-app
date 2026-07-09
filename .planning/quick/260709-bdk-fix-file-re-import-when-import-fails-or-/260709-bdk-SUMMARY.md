---
quick_id: 260709-bdk
description: Re-import a file when the previous import failed or got stuck
date: 2026-07-09
status: complete
---

# Quick Task 260709-bdk — Summary

## Problem

`POST /api/files/initiate` returned `409 duplicate_file` for any file whose content
hash already existed, regardless of the prior file's status. A stalled or failed import
left a permanent `file` row that locked the user out of re-uploading the same file, in
both onboarding (`step-1-upload.tsx`) and standard import (`import-uploader.tsx`) — both
hit the same route.

## What changed (server-side only)

1. **`lib/utils/import-status.ts`** — added `BLOCKS_REUPLOAD_STATUSES = ['imported']`
   and `blocksReupload(status)`. A completed import is the only state that blocks a
   re-upload; every other status (including a stuck `importing`) is re-importable.
2. **`lib/dal/files.ts`** — added `deleteFileForUser({ userId, fileId })`, an
   ownership-scoped delete. `transaction.fileId` is `onDelete: cascade`, so any leftover
   rows go with it.
3. **`app/api/files/initiate/route.ts`** — on a content-hash match: return `409` only
   when `blocksReupload(existing.status)` (message sharpened to "Hai già importato questo
   file."); otherwise log `upload_initiate_stale_replaced`, delete the stale row via
   `deleteFileForUser`, and fall through to mint a fresh record + presigned PUT URL,
   restarting the flow.

No R2 cleanup (re-upload writes a new object key; the orphaned object is acceptable).
No client changes — both uploaders already proceed on 200 and only surface the duplicate
message on 409, which is now correct.

## Commits (code)

- `cf04131` feat: add blocksReupload predicate for stale re-imports
- `6557f79` feat: add deleteFileForUser DAL helper
- `d5998c2` fix: allow re-upload when previous import did not complete
- `da24841` test: cover blocksReupload and stale re-upload replacement

(Executor ran in an isolated worktree off the wrong base branch; commits were
cherry-picked onto the clean `gsd/quick-260709-bdk-file-re-import` branch — same trees,
new hashes above.)

## Verification

- `vitest run tests/import-status.test.ts tests/import-api.test.ts` — 25 passed.
- Full executor suite in worktree — 1389 tests passed.
- `tsc --noEmit` — only pre-existing errors, none in touched files.
- `node scripts/check-code-language.mjs` — passed.

## Tests added

- `tests/import-status.test.ts` (new) — `blocksReupload` truth table.
- `tests/import-api.test.ts` (extended) — imported → 409/no delete; failed & importing →
  delete stale row + 200 fresh presigned URL; no existing file → unchanged happy path.

## Out of scope

- No client changes, no R2 object deletion.
