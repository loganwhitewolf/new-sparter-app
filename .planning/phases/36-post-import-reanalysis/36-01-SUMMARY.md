---
phase: 36-post-import-reanalysis
plan: "01"
subsystem: dal
tags:
  - dal
  - transactions
  - pattern-suggestions
  - tdd

dependency_graph:
  requires:
    - lib/db/schema (transaction, file/importFile tables)
    - drizzle-orm (and, eq, isNull operators)
  provides:
    - lib/dal/transactions#getUncategorizedTransactionsByFileId
  affects:
    - Plan 02: app/(app)/import/[fileId]/suggestions/page.tsx will consume this function

tech_stack:
  added: []
  patterns:
    - Non-cached DAL function accepting DbOrTx (composable pattern, mirrors getDuplicateHashes)
    - innerJoin for ownership enforcement (vs leftJoin for nullable fileId cases)
    - Narrow { description, amount } projection for pattern-detector input contract

key_files:
  created: []
  modified:
    - lib/dal/transactions.ts
    - tests/transactions-dal.test.ts

decisions:
  - innerJoin on importFile chosen over leftJoin — transaction.fileId is non-null for all imported rows; join enforces ownership (D-03)
  - No cache() wrapper — called once per server render of /import/[fileId]/suggestions; no benefit
  - No verifySession() call — userId passed explicitly by caller; composable pattern consistent with getDuplicateHashes
  - makeWhereTerminalChain helper added to test file — makeQueryChain terminates at .offset() but this function terminates at .where(); separate variant needed for correct mock wiring

metrics:
  duration: "~5 minutes"
  completed: "2026-05-23T17:59:25Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 36 Plan 01: DAL Function for Post-Import Uncategorized Transactions Summary

TDD implementation of `getUncategorizedTransactionsByFileId` — ownership-safe DAL query returning `{ description, amount }` rows for uncategorized persisted transactions scoped to a single import file.

## Function Signature

```ts
export async function getUncategorizedTransactionsByFileId(
  database: DbOrTx,
  fileId: string,
  userId: string,
): Promise<Array<{ description: string; amount: string }>>
```

Located at: `lib/dal/transactions.ts` (appended after `getDuplicateHashes`).

## Implementation

```ts
return database
  .select({
    description: transaction.description,
    amount: transaction.amount,
  })
  .from(transaction)
  .innerJoin(importFile, eq(transaction.fileId, importFile.id))
  .where(
    and(
      eq(transaction.fileId, fileId),
      eq(importFile.userId, userId),
      isNull(transaction.expenseId),
    ),
  )
```

No new imports required — `and`, `eq`, `isNull`, `importFile`, `transaction`, `DbOrTx` were all already imported.

## Test Cases Added

| Test | Requirement pinned | Assertion |
|------|-------------------|-----------|
| "returns only description+amount rows and filters by fileId + expenseId IS NULL" | POST-04 | where args contain `{ op: 'isNull', column: 'transaction.expenseId' }` and `{ op: 'eq', left: 'transaction.fileId', right: 'file-1' }` |
| "enforces ownership via innerJoin on importFile and userId equality" | POST-03 | `chain.innerJoin` called once; where args contain `{ op: 'eq', left: 'file.userId', right: 'user-1' }` |
| "selects only { description, amount } (narrow projection)" | T-36-02 (threat) | `Object.keys(shape).sort()` equals `['amount', 'description']` exactly |
| "does not call verifySession (userId is passed explicitly)" | composability | `mocks.verifySession` not called |
| "uses the passed-in DbOrTx argument, not the module-level db singleton" | DbOrTx contract | `chain.from` and `chain.select` called on the passed-in object |

## TDD Gate Compliance

- RED commit `28da622`: `test(36-01): add failing tests for getUncategorizedTransactionsByFileId (POST-03, POST-04)` — 5 tests failing with "not a function"
- GREEN commit `559f6bc`: `feat(36-01): implement getUncategorizedTransactionsByFileId (POST-03, POST-04)` — all 427 tests pass

## Deviations from Plan

### Deviation: makeWhereTerminalChain helper

**Rule:** Rule 3 (blocking issue)
**Found during:** Task 1 (RED test writing)
**Issue:** The existing `makeQueryChain` in the test file terminates at `.offset()` (returns `Promise.resolve(finalValue)`). The new function ends at `.where()` — no `.offset()` call. Using the existing chain would make tests pass the wrong way (`.where()` returns the chain object, not the final value array).
**Fix:** Added `makeWhereTerminalChain` helper inside the new `describe` block — a variant that has `.select()` capture the shape and `.where()` return `Promise.resolve(finalValue)`. This mirrors the existing mock pattern without modifying the shared `makeQueryChain`.
**Files modified:** `tests/transactions-dal.test.ts` (new helper within the new describe block)

## Note for Plan 02

Import path: `@/lib/dal/transactions`
Call signature: `getUncategorizedTransactionsByFileId(db, fileId, userId)`
Return type: `Array<{ description: string; amount: string }>`

Plan 02 will pass this result through the adapter:
```ts
const detectorRows: PatternDetectorRow[] = uncategorizedTxs.map((t) => ({
  description: t.description,
  normalizedDescription: t.description,
  amount: t.amount,
  valid: true,
  covered: false,
}))
```

## Known Stubs

None — the function is fully implemented with no placeholders.

## Threat Flags

No new network endpoints, auth paths, or schema changes introduced. The function is a read-only DAL query with no surface beyond what the plan's threat model already covers (T-36-01 through T-36-05).

## Self-Check: PASSED

- `lib/dal/transactions.ts` exists and exports `getUncategorizedTransactionsByFileId`: FOUND
- `tests/transactions-dal.test.ts` contains describe block: FOUND
- Commit `28da622` exists (RED): FOUND
- Commit `559f6bc` exists (GREEN): FOUND
- 427 tests pass, 0 failures: VERIFIED
