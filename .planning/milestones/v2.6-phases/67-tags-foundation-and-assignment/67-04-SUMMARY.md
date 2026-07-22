---
phase: 67-tags-foundation-and-assignment
plan: 04
subsystem: backend
tags: [drizzle, zod, server-actions, tags, transaction-tags]

# Dependency graph
requires: ["67-01"]
provides:
  - "lib/dal/transaction-tags.ts: bulkInsertTransactionTags, bulkDeleteTransactionTags, getTagsForTransactionIds, getTransactionTagsForTransaction, getAlreadyTaggedTransactionIds, type TransactionTagChip"
  - "lib/services/tag-assignment.ts: TagAssignmentError, bulkAssignTags, bulkRemoveTags, addSingleTransactionTag, removeSingleTransactionTag"
  - "lib/actions/transaction-tags.ts: bulkAssignTagsAction, bulkRemoveTagsAction, addTransactionTagAction, removeTransactionTagAction"
affects: [67-05, 67-06, 67-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-06 additive-union assign / D-07 symmetric removal implemented as fully separate DAL and service code paths — bulkAssignTags never calls bulkDeleteTransactionTags"
    - "Dual-ownership IDOR gate: assertOwnsAllTransactions (direct transaction table re-query) AND assertOwnsAllTags (getTag re-query, Plan 67-03) both run before any write; a forged id in either array rejects the whole call (T-67-09)"
    - "Race-safe bulk insert via onConflictDoNothing({ target: [transactionTag.tagId, transactionTag.transactionId] }) against the Plan 67-01 composite unique constraint (T-67-10)"

key-files:
  created:
    - lib/dal/transaction-tags.ts
    - lib/services/tag-assignment.ts
    - lib/actions/transaction-tags.ts
    - tests/transaction-tags-dal.test.ts
    - tests/tag-assignment.test.ts
    - tests/transaction-tag-actions.test.ts
  modified: []

key-decisions:
  - "Removed the mid-file comment literally naming bulkDeleteTransactionTags inside bulkAssignTags's docstring to keep the file's only two occurrences of that identifier as the import and the single bulkRemoveTags call site — the D-06 additive-only invariant is enforced by both code structure and tests, not by a comment."
  - "ActionState imported from @/lib/validations/category (per the plan's explicit action block) rather than @/lib/validations/expense (used by lib/actions/transactions.ts) — both export an identical { error: string | null } shape, so this is a no-op type-wise; followed the plan's stated import path exactly."

requirements-completed: [TAG-02]

coverage:
  - id: D1
    description: "bulkInsertTransactionTags/bulkDeleteTransactionTags are race-safe (onConflictDoNothing) and empty-array-safe; getTagsForTransactionIds/getAlreadyTaggedTransactionIds short-circuit on empty input; getTransactionTagsForTransaction IDOR-scopes via transaction.userId"
    requirement: TAG-02
    verification:
      - kind: unit
        ref: "node_modules/.bin/vitest tests/transaction-tags-dal.test.ts --run (12 tests, including both empty-array short-circuits and the double-call no-op case)"
        status: pass
    human_judgment: false
  - id: D2
    description: "bulkAssignTags is additive-only (D-06, proven by asserting bulkDeleteTransactionTags is never called on the success path); bulkRemoveTags is symmetric (D-07); both reject before any write when transaction-ownership OR tag-ownership checks come up short (IDOR, T-67-09)"
    requirement: TAG-02
    verification:
      - kind: unit
        ref: "node_modules/.bin/vitest tests/tag-assignment.test.ts --run (7 tests, including both IDOR-rejection cases and the two D-07b single-item delegation cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "bulkAssignTagsAction/bulkRemoveTagsAction/addTransactionTagAction/removeTransactionTagAction validate input defensively (malformed JSON in either id array rejects before verifySession), surface TagAssignmentError messages verbatim, and revalidate /transactions on success"
    requirement: TAG-02
    verification:
      - kind: unit
        ref: "node_modules/.bin/vitest tests/transaction-tag-actions.test.ts --run (10 tests, including two malformed-JSON cases and the forbidden-error-message passthrough)"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-07-20
status: complete
---

# Phase 67 Plan 04: Tag Assignment Backend (transaction_tag DAL + service + actions) Summary

**Ownership-verified bulk tag assignment: `transaction_tag` join-table DAL, a service enforcing D-06 additive-union assign and D-07 symmetric removal with dual IDOR checks (transaction AND tag ownership), and the four server actions Plans 67-06/67-07 will call.**

## Performance

- **Duration:** ~3 min (task execution; excludes context-read time)
- **Started:** 2026-07-20T16:37:34+02:00 (first task commit)
- **Completed:** 2026-07-20T16:40:08+02:00 (last task commit)
- **Tasks:** 3
- **Files modified:** 6 (all created — 3 source, 3 test)

## Accomplishments

- `lib/dal/transaction-tags.ts`: `bulkInsertTransactionTags` (race-safe via `onConflictDoNothing({ target: [transactionTag.tagId, transactionTag.transactionId] })`, so two concurrent bulk-assigns for the same pair never error or duplicate), `bulkDeleteTransactionTags` (scoped to `inArray(tagId) AND inArray(transactionId)` — untouched pairs stay untouched), `getTagsForTransactionIds`, `getTransactionTagsForTransaction` (IDOR-scoped via a `transaction.userId` join clause), `getAlreadyTaggedTransactionIds` (returns a `Set<string>`, the D-10 dedup source Plan 67-05 will consume). All list-taking functions short-circuit on empty input, avoiding an `IN ()` SQL error.
- `lib/services/tag-assignment.ts`: `TagAssignmentError` (`code: 'forbidden'`), `bulkAssignTags` (D-06 — flat-maps `tagIds × transactionIds` into join rows, insert-only, never calls `bulkDeleteTransactionTags`), `bulkRemoveTags` (D-07 — symmetric, deletes exactly the requested pairs), `addSingleTransactionTag`/`removeSingleTransactionTag` (D-07b — thin one-element-array delegates to the bulk functions, no duplicated write path). Both bulk functions run `assertOwnsAllTransactions` (direct `transaction` table re-query against `userId`) AND `assertOwnsAllTags` (`getTag` re-query per tagId, from Plan 67-03) before any write — a single forged id anywhere in either array rejects the whole call with no partial write (T-67-09).
- `lib/actions/transaction-tags.ts`: `bulkAssignTagsAction`, `bulkRemoveTagsAction`, `addTransactionTagAction`, `removeTransactionTagAction`. The two bulk actions parse `transactionIds`/`tagIds` as JSON from `FormData` inside a try/catch guard (either malformed array returns `{ error: 'Selezione non valida.' }` before `verifySession()` is ever called), validate via the Plan 67-01 Zod schemas, call `verifySession()`, delegate to the service, map `TagAssignmentError` to its own message, and call `revalidatePath(APP_ROUTES.transactions)` on success (tags do not touch categorization/dashboard surfaces, so `revalidateCategorizationSurfaces()` is deliberately not used).
- 29 new unit tests across three files, all using the codebase's established mocked-drizzle-chain pattern (no live DB in tests).

## Task Commits

Each task was committed atomically:

1. **Task 1: lib/dal/transaction-tags.ts — join-table queries** - `82a6d20` (feat)
2. **Task 2: lib/services/tag-assignment.ts — ownership-verified bulk assign/remove (D-06, D-07)** - `8845a5a` (feat)
3. **Task 3: lib/actions/transaction-tags.ts — bulk + single assign/remove actions** - `19f8748` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `lib/dal/transaction-tags.ts` — join-table DAL queries, `type TransactionTagChip`
- `lib/services/tag-assignment.ts` — `TagAssignmentError`, `bulkAssignTags`, `bulkRemoveTags`, `addSingleTransactionTag`, `removeSingleTransactionTag`
- `lib/actions/transaction-tags.ts` — `bulkAssignTagsAction`, `bulkRemoveTagsAction`, `addTransactionTagAction`, `removeTransactionTagAction`
- `tests/transaction-tags-dal.test.ts`, `tests/tag-assignment.test.ts`, `tests/transaction-tag-actions.test.ts` — unit test coverage for all three layers

## Decisions Made

- Reworded a docstring inside `bulkAssignTags` to avoid literally repeating the string `bulkDeleteTransactionTags` — keeps the identifier's only two occurrences in the file as the import statement and the single real call site inside `bulkRemoveTags`. The D-06 invariant itself is enforced by code structure (the function body never references the delete DAL function) and directly asserted by a test (`bulkDeleteTransactionTags` not called on the additive-union success path).
- `ActionState` imported from `@/lib/validations/category` per the plan's explicit `<action>` instruction, rather than `@/lib/validations/expense` (the import path `lib/actions/transactions.ts` uses). Both types are structurally identical (`{ error: string | null }`); no behavioral difference.

## Deviations from Plan

None — plan executed exactly as written. All three tasks' `<action>` blocks were implemented as specified. The only adjustment (test fixture UUID format — using a v4-shaped UUID like `11111111-1111-4111-8111-111111111111` instead of an all-`1`s string) was required because Zod's `.uuid()` validator (from Plan 67-01's `BulkAssignTagsSchema`/`SingleTransactionTagSchema`) enforces the RFC 4122 version/variant nibbles; this is a test-fixture correction, not a deviation from the plan's specified behavior.

## Issues Encountered

- Pre-existing, unrelated TypeScript baseline errors (21 total, in `tests/suggestion-card.test.tsx`, `tests/suggestion-promote-form.test.tsx`, `tests/transactions-dal.test.ts` — same as documented in 67-01-SUMMARY.md and 67-03-SUMMARY.md) were confirmed present both before and after this plan's changes via `yarn tsc --noEmit`. Out of scope per the scope-boundary rule; not touched.

## User Setup Required

None — no external service configuration required. This plan only adds application code and tests; no migration or seed changes.

## Next Phase Readiness

- Plan 67-05 (date-range suggestion flow) can build on `getAlreadyTaggedTransactionIds` for its D-10 dedup query and can delegate confirmed suggestions straight into `bulkAssignTags`.
- Plan 67-06 (bulk-assign dialog UI) and Plan 67-07 (detail-page single add/remove) have all four server actions ready to call, including the two single-item wrappers.
- No blockers for downstream plans in this phase.

---
*Phase: 67-tags-foundation-and-assignment*
*Completed: 2026-07-20*

## Self-Check: PASSED

- FOUND: lib/dal/transaction-tags.ts
- FOUND: lib/services/tag-assignment.ts
- FOUND: lib/actions/transaction-tags.ts
- FOUND: tests/transaction-tags-dal.test.ts
- FOUND: tests/tag-assignment.test.ts
- FOUND: tests/transaction-tag-actions.test.ts
- FOUND: 82a6d20 (Task 1 commit)
- FOUND: 8845a5a (Task 2 commit)
- FOUND: 19f8748 (Task 3 commit)
