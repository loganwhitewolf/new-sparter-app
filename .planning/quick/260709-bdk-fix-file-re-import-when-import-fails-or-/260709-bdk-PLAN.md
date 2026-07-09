# Quick Task 260709-bdk: Re-import a file when the previous import failed or got stuck

## Problem

`POST /api/files/initiate` blocks with `409 duplicate_file` whenever a file with the
same content hash already exists — **regardless of that file's status**. If an import
stalls or fails, the stale `file` row stays forever and the user can never re-upload the
same file, in both onboarding (`step-1-upload.tsx`) and standard import
(`import-uploader.tsx`). Both clients call the same `/api/files/initiate` route, so the
fix lives entirely server-side.

## Decision

- Only a file that **finished importing** (`status === 'imported'`) blocks a re-upload.
  This preserves the intended guard: a correctly imported file cannot be re-uploaded.
- Any other status (`pending_upload`, `uploaded`, `analyzing`, `analyzed`, `importing`,
  `failed`) means the import never completed — a stuck `importing` is exactly the
  reported bug. On re-initiate, **delete the stale `file` row** and proceed to mint a
  fresh record + presigned PUT URL, restarting the flow from scratch.
- No R2 cleanup needed. Re-upload writes a new object key; the orphaned old object is
  acceptable (per task brief). `transaction.fileId` is `onDelete: cascade`, so any
  leftover rows from a rolled-back import are removed with the file row. Committed
  imports are never deleted (only `imported` blocks), and `expense.importedFromFileId`
  is `onDelete: set null` — irrelevant here since a failed import runs inside
  `db.transaction` and rolls back its expense/transaction writes.

## Tasks

### 1. Add blocking-status predicate to `lib/utils/import-status.ts`
- Export `const BLOCKS_REUPLOAD_STATUSES = ['imported'] as const satisfies readonly ImportListRow['status'][]`
  with a doc comment explaining a completed import is the only state that blocks re-upload.
- Export `function blocksReupload(status: ImportListRow['status']): boolean`.

### 2. Add userId-scoped delete to `lib/dal/files.ts`
- Export `async function deleteFileForUser(input: { userId: string; fileId: string }, database: DbOrTx = db): Promise<void>`
  that runs `db.delete(file).where(and(eq(file.id, fileId), eq(file.userId, userId)))`.
- Mirror the existing DAL style (`DbOrTx` default param, `and`/`eq` from the same imports).

### 3. Update `app/api/files/initiate/route.ts` duplicate handling
- When `findFileByContentHash` returns `existing`:
  - If `blocksReupload(existing.status)` → keep the `409 duplicate_file` response.
    Sharpen the message to "Hai già importato questo file." (it now only fires for a
    completed import). Keep `existingFileId` in details.
  - Else → log a new event `upload_initiate_stale_replaced` (userId, contentHash,
    staleFileId, staleStatus), call `deleteFileForUser({ userId, fileId: existing.id })`,
    and fall through to the normal create-record + presigned-URL path (do NOT return).
- Import `blocksReupload` from `@/lib/utils/import-status` and `deleteFileForUser` from
  `@/lib/dal/files`.

### 4. Tests
- `import-status`: `blocksReupload('imported') === true`; `false` for `failed`,
  `importing`, `analyzed`, `uploaded`, `pending_upload`, `analyzing`.
- `initiate` route (unit/integration per existing test style for this route, if any):
  - existing file with `status: 'imported'` → 409, no delete call.
  - existing file with `status: 'failed'` (and `'importing'`) → deletes stale row and
    returns 200 with a fresh presigned URL.
  - no existing file → unchanged happy path.
  - If the route has no existing test harness, add focused tests for `deleteFileForUser`
    and `blocksReupload` and note the route-level gap in SUMMARY.

## Verify
- `yarn typecheck` (or `tsc --noEmit`) clean.
- `yarn check:language` clean (new dev strings are English; the one user-facing IT
  message is an intentional product surface).
- Relevant unit tests pass.

## Out of scope
- No client changes: both uploaders already proceed normally on a 200 and show the
  duplicate message only on 409, which is now correct.
- No R2 object deletion.
