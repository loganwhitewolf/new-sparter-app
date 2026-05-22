---
phase: "06"
plan: "01"
---

# T01: Implemented transactional import service, subscription-gated categorization pipeline, transaction DAL, and server actions with 15 passing unit tests

**Implemented transactional import service, subscription-gated categorization pipeline, transaction DAL, and server actions with 15 passing unit tests**

## What Happened

S05 T05 produced zero files; this task rebuilt all five missing modules from scratch.

**lib/dal/transactions.ts** — Three DAL functions accepting DbOrTx: `getDuplicateHashes` (compound AND-scoped userId + inArray query to prevent cross-user hash leaks), `insertTransaction`, and `insertTransactionBatch`. All operate inside or outside a transaction context via the DbOrTx type.

**lib/services/categorization.ts** — `loadActivePatterns` fetches system (userId IS NULL) + user patterns ordered by priority ASC. `applyTier1Regex` iterates patterns, skips invalid regex with try/catch (never fails import), respects amountSign via Decimal.js comparison. `applyTier2History` uses raw SQL count with HAVING >= 3 to find the most-frequent manual classification for a descriptionHash. `categorizePipeline` returns null for free plan, applies Tier 1 then Tier 2 for basic/pro.

**lib/services/import.ts** — `analyzeFile` marks file analyzing→analyzed/failed, reads R2 bytes, parses, detects format, bulk-checks duplicate hashes, updates file row with rowCount/duplicateCount/formatVersionId. `importFile` wraps all expense/transaction/history inserts in a single `db.transaction()`: bulk-normalizes rows, skips duplicates, aggregates transactions by descriptionHash into expenses, upsert-by-check (SELECT then INSERT or UPDATE), calls categorizePipeline per unique expense, writes classification history rows, links transactions back to their expense, marks file imported/failed. Both failure modes (R2 read failure before parse, DB transaction error) call markFileFailed with a safe user-facing message.

**lib/actions/import.ts** — `analyzeImportAction` and `confirmImportAction` server actions: verifySession() first, Zod validation, ownership-check via getFileForUser, subscriptionPlan passed through to importFile, revalidatePath('/import') and '/spese' on success, structured ImportActionState<T> return type.

**tests/import-service.test.ts** — 15 tests across three suites: applyTier1Regex (pure unit: 6 tests covering system/user pattern source, amountSign enforcement, invalid regex skip, no-match null); importFile (7 tests: file-not-found ownership check, R2 read failure + markFileFailed, duplicate skipping, free-plan uncategorized, basic-plan categorization pipeline called, cross-user IDOR denial, transaction rollback + markFileFailed); analyzeFile (2 tests: empty R2 body + markFileFailed, cross-user file access).

**Key deviation from plan**: `import.ts` imports r2/parsers/detector/categorization using `@/lib/services/...` aliases (not relative `./r2`) — Vitest's mock registry resolves `vi.mock('@/lib/services/r2')` to the aliased absolute path, which only matches when the importer also uses the alias. Relative imports create a different module ID in Vitest's registry and bypass the mock. This is an existing project gotcha (similar to MEM002/MEM003).

## Verification

Ran `npx vitest run tests/import-service.test.ts --reporter=verbose` — 15/15 tests pass.
Ran `npx vitest run tests/*.test.ts --reporter=verbose` — 54/54 tests pass (no regressions in existing import-api, import-detector, import-utils, dashboard-dal suites).
Ran `npx tsc --noEmit` — 0 type errors on any of the 5 new files.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx vitest run tests/import-service.test.ts --reporter=verbose` | 0 | ✅ pass — 15/15 tests | 233ms |
| 2 | `npx vitest run tests/*.test.ts --reporter=verbose` | 0 | ✅ pass — 54/54 tests (no regressions) | 281ms |
| 3 | `npx tsc --noEmit` | 0 | ✅ pass — 0 type errors | 8000ms |

## Deviations

Import service uses @/ alias imports instead of relative ./r2 imports to ensure Vitest mock registry resolution works correctly. This is a testability constraint, not a plan deviation in substance.

## Known Issues

loadFormatVersions in importFile is called outside the db.transaction() block — a format version lookup failure after file status is set to 'importing' will not be wrapped by the transaction rollback. The markFileFailed call in the outer catch handles this, but it means the file status transitions are: importing → failed (not importing → rolled_back → failed). Acceptable for now; a future task could move format loading inside the transaction.

## Files Created/Modified

- `lib/dal/transactions.ts`
- `lib/services/categorization.ts`
- `lib/services/import.ts`
- `lib/actions/import.ts`
- `tests/import-service.test.ts`
