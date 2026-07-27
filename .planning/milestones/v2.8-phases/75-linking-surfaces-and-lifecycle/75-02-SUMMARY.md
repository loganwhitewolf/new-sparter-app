---
phase: 75-linking-surfaces-and-lifecycle
plan: 02
subsystem: database
tags: [drizzle, postgres, reimbursement, netting, sql, vitest]

# Dependency graph
requires:
  - phase: 75-01
    provides: "reimbursement_anchor_transaction frozen-set join table + createPair's unconditional frozen-set write on every call (the write path this plan generalizes)"
provides:
  - "createPairTx — tx-accepting create-or-append core: a second (third, ...) refund on an anchor that already has a reimbursement appends instead of throwing 23505 (D-05)"
  - "Dual anchor shape: createPair/createPairTx accept anchor: { transactionId } | { groupId } — a reimbursement can now be created anchored on an Expense Group directly from the write path (RMB-08 backend prerequisite)"
  - "getEligibleCounterparts generalized to excludeTransactionIds[] (notInArray) — a Group anchor can exclude every one of its member transactions from its own candidate refund list (D-06)"
  - "getGroupOccurrenceInterval — a Group's min/max member occurredAt, the D-06 interval source Plan 75-04's picker window will consume"
affects: [75-03-unlink-baseline-restore, 75-04-linking-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tx-accepting core + thin db.transaction wrapper (createPairTx/createPair): lets a future caller compose several links atomically inside its own transaction (Plan 75-04's multi-select picker), while the single-link public API is unchanged in behavior"
    - "Create-or-append check-then-insert INSIDE the same db.transaction as the frozen-set write, closing the read-then-write TOCTOU window a separate pre-check would leave open (T-75-05)"

key-files:
  created: []
  modified:
    - lib/services/transaction-pairs.ts
    - lib/dal/transaction-pairs.ts
    - lib/actions/transaction-pairs.ts
    - tests/reimbursement-phase-75.test.ts
    - tests/reimbursement-regression.test.ts
    - tests/transaction-pairs-service.test.ts
    - tests/transaction-pairs-dal.test.ts

key-decisions:
  - "createPair's public signature changed from a bare transactionId field to anchor: { transactionId } | { groupId } — every existing caller (createTransactionPairAction, and 2 test files not in this plan's files_modified list) updated in the same wave so no caller is ever left invoking the old signature (Rule 3 auto-fix, plan-anticipated precedent)"
  - "Self-pair guard (CR-01) duplicated: once in createPair (before opening db.transaction, preserving the pre-existing 'short-circuits before touching the DB' behavior a unit test asserts) and once in createPairTx (defense-in-depth for a future direct caller composing multiple links inside its own transaction)"
  - "A Group anchor's subCategoryId is expenseGroup.subCategoryId (the group's own column, set at group-categorize time — all members already share it per the Expense Group model), not an ambiguous per-member value — resolves the research doc's flagged 'no single anchor subCategoryId' concern for the refund-cleanup inherit path"
  - "Refund-cleanup same-expense skip generalized from a single anchorExpenseId comparison to an anchorMemberExpenseIds[] set (one element for a transaction anchor, every member Expense id for a Group anchor) — symmetric with D-06's self-exclusion generalization, prevents a refund whose own Expense IS an anchor member from being miscategorized against itself"
  - "requirements mark-complete NOT run for RMB-07/RMB-08 — same rationale as 75-01: this plan ships only backend write-path prerequisites (create-or-append, dual anchor shape, candidate exclusion); the actual user-facing linking UI ships in Plan 75-04 and the unlink lifecycle in Plan 75-03. Marking either Complete now would be a false positive in REQUIREMENTS.md's traceability table."

patterns-established:
  - "Anchor-shape generalization pattern: a service function branches on a discriminated-union input ({ transactionId } | { groupId }), resolving shared downstream variables (title/subCategoryId/memberExpenseIds) once per branch so steps 2+ never re-branch on anchor shape"

requirements-completed: []  # RMB-07/RMB-08 intentionally NOT marked complete — see key-decisions

coverage:
  - id: D1
    description: "createPairTx create-or-append: linking a second refund to an anchor that already has a reimbursement appends a reimbursement_refund row to the EXISTING reimbursement instead of throwing the 23505 unique-violation (D-05)"
    requirement: "RMB-07"
    verification:
      - kind: integration
        ref: "tests/reimbursement-phase-75.test.ts#Test 1 (dinner 1:N append)"
        status: pass
    human_judgment: false
  - id: D2
    description: "createPairTx accepts a Group anchor ({ groupId }) — creates a reimbursement with expenseGroupId set/expenseId null, resolves the Group's outflow as the SUM of member Expense totalAmounts, and NEVER writes to reimbursement_anchor_transaction for a Group anchor (D-08 stays Expense-anchor-only)"
    requirement: "RMB-08"
    verification:
      - kind: integration
        ref: "tests/reimbursement-phase-75.test.ts#Test 2 (Group-anchor create)"
        status: pass
      - kind: integration
        ref: "tests/reimbursement-phase-75.test.ts#Test 3 (Group-anchor append)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The anchor-level sign check (assertOutflowAnchorAmount) still runs against the resolved Group-sum amount — never bypassed because the anchor is now a Group rather than a single transaction (RMB-03 invariant preserved)"
    requirement: "RMB-08"
    verification:
      - kind: integration
        ref: "tests/reimbursement-phase-75.test.ts#Test 4 (invariant preserved)"
        status: pass
    human_judgment: false
  - id: D4
    description: "getEligibleCounterparts generalized from a single referenceId (ne) to excludeTransactionIds[] (notInArray) — a candidate list excludes every id in a multi-element set, not just one"
    requirement: "RMB-08"
    verification:
      - kind: integration
        ref: "tests/reimbursement-phase-75.test.ts#excludes every id in excludeTransactionIds (2+ elements)"
        status: pass
      - kind: unit
        ref: "tests/transaction-pairs-dal.test.ts#getEligibleCounterparts"
        status: pass
    human_judgment: false
  - id: D5
    description: "getGroupOccurrenceInterval resolves the min/max occurredAt across every member transaction of a Group (D-06 window source), returning undefined for an empty group or a foreign-owned groupId"
    requirement: "RMB-08"
    verification:
      - kind: integration
        ref: "tests/reimbursement-phase-75.test.ts#getGroupOccurrenceInterval resolves the min/max occurredAt"
        status: pass
    human_judgment: false

# Metrics
duration: 110min
completed: 2026-07-24
status: complete
---

# Phase 75 Plan 2: Create-or-append write path, dual anchor shape, multi-exclusion candidates Summary

**Generalized the reimbursement write path from "always create, Expense-anchor only" to create-or-append with either an Expense or Expense-Group anchor, and generalized the eligible-counterparts candidate query from a single self-exclusion id to a set — the backend prerequisite the multi-select picker (Plan 75-04) and unlink lifecycle (Plan 75-03) both build on.**

## Performance

- **Duration:** ~110 min
- **Started:** 2026-07-24T15:41:00Z (approx, continuing directly after 75-01)
- **Completed:** 2026-07-24T17:31:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- `createPair`'s body refactored into an exported tx-accepting `createPairTx(tx, input)` core; public `createPair` is now a thin `db.transaction` wrapper — a second (third, ...) refund linked to an already-anchored reimbursement now appends instead of throwing the raw Postgres 23505 unique-violation (D-05)
- `createPairTx` accepts a discriminated-union anchor (`{ transactionId } | { groupId }`) — a reimbursement can now be created anchored directly on an Expense Group (`expenseGroupId` set, `expenseId` null), resolving the Group's outflow as the Decimal.js sum of every member Expense's `totalAmount`; the Group-anchor path never writes to `reimbursement_anchor_transaction` (D-08 stays Expense-anchor-only, per the phase's locked prohibition)
- The anchor-level sign check (`assertOutflowAnchorAmount`) runs against the resolved anchor amount for BOTH anchor shapes — proven by a dedicated test that a non-negative Group sum is still rejected
- `getEligibleCounterparts` generalized from `ne(transaction.id, referenceId)` to `notInArray(transaction.id, excludeTransactionIds)` — a Group anchor can exclude every one of its member transactions from its own candidate refund list, not just one
- New `getGroupOccurrenceInterval` DAL function resolves a Group's `MIN`/`MAX(occurredAt)` across every member transaction — the D-06 interval source Plan 75-04's picker window will consume for its ±90-day candidate range
- The action↔DAL seam in `loadEligibleCounterpartsAction` updated to wrap the D-07 quick action's single `referenceId` in a one-element array — the action's own external contract (`referenceId`, `LoadCounterpartsSchema`) and `counterpart-picker-dialog.tsx` stay completely untouched, exactly as the plan required

## Task Commits

Each task was committed atomically:

1. **Task 1: createPairTx — create-or-append, dual anchor shape (Expense or Group)** - `b7d974a` (feat)
2. **Task 2: Generalize getEligibleCounterparts — multi-exclusion + Group occurrence-interval window (D-06)** - `feaad54` (feat)

**Plan metadata:** committed alongside this SUMMARY (see final commit below)

## Files Created/Modified

- `lib/services/transaction-pairs.ts` — `createPairTx` (tx-accepting create-or-append core, dual anchor resolution) + `createPair` (thin `db.transaction` wrapper); `deletePairByTransactionId` unchanged
- `lib/dal/transaction-pairs.ts` — `getEligibleCounterparts` (`excludeTransactionIds: string[]` + `notInArray`) + new `getGroupOccurrenceInterval`
- `lib/actions/transaction-pairs.ts` — `createTransactionPairAction` call site updated to `anchor: { transactionId }`; `loadEligibleCounterpartsAction` seam updated to wrap `referenceId` in a one-element array
- `tests/reimbursement-phase-75.test.ts` (new) — 6 real-Postgres tests: Task 1's 4 behavior tests (dinner 1:N append, Group-anchor create, Group-anchor append, invariant preserved) + Task 2's 2 tests (multi-id exclusion, Group interval resolution)
- `tests/reimbursement-regression.test.ts` — 2 `createPair` call sites updated to the new `anchor`-shaped input (Rule 3 auto-fix — required by this plan's own `<verification>` block)
- `tests/transaction-pairs-service.test.ts` — 23 `createPair` call sites updated to `anchor: { transactionId }`; mocked schema extended with `expenseGroup`/`expenseGroupMembership`/`reimbursement.expenseGroupId`; every `dbSelectChain` mock sequence extended with the new create-or-append existing-reimbursement lookup select (Rule 3 auto-fix — createPairTx's new select call shifted every subsequent mocked select response by one position)
- `tests/transaction-pairs-dal.test.ts` — rewritten for the `excludeTransactionIds` signature (`ne` → `notInArray` assertions, single- and multi-element exclusion set tests) (Rule 3 auto-fix)

## Decisions Made

- `createPair`'s public signature changed from a bare `transactionId` field to `anchor: { transactionId } | { groupId }` per the plan's explicit `<action>` spec — every existing caller updated in the same wave (`createTransactionPairAction` per the plan's own instruction, plus `tests/reimbursement-regression.test.ts` and `tests/transaction-pairs-service.test.ts`, neither in this plan's `files_modified` list but both directly broken by the signature change — Rule 3, the plan's own "note it in the SUMMARY as an out-of-files_modified edit" precedent applied).
- Self-pair guard (CR-01) duplicated: once in `createPair` (before opening `db.transaction`, preserving the pre-existing "short-circuits before touching the DB" behavior an existing unit test asserts) and once in `createPairTx` (defense-in-depth for a future direct caller — Plan 75-04's multi-select picker composing several `createPairTx` calls inside its own transaction).
- A Group anchor's `subCategoryId` for the refund-cleanup inherit path is `expenseGroup.subCategoryId` (the Group's own schema column, set at group-categorize time) — resolves the research doc's flagged "no single anchor subCategoryId for a multi-subcategory Group" concern, since the Expense Group model already requires all members to share one subcategory before grouping (D-04, Phase 65/66).
- Refund-cleanup's same-expense skip generalized from a single `anchorExpenseId` comparison to an `anchorMemberExpenseIds[]` set (one element for a transaction anchor, every member Expense id for a Group anchor) — symmetric with Task 2's self-exclusion generalization; prevents a refund whose own Expense is itself an anchor member from being miscategorized against itself.
- `requirements mark-complete` NOT run for RMB-07/RMB-08 — same rationale as 75-01: this plan ships only backend write-path prerequisites; the user-facing linking UI ships in Plan 75-04, the unlink lifecycle in Plan 75-03.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] createPair's signature change breaks every existing caller — updated all call sites in the same wave**
- **Found during:** Task 1, immediately after refactoring `createPair`'s signature per the plan's own `<action>` spec
- **Issue:** `createPair({ userId, transactionId, counterpartId })` became `createPair({ userId, anchor: { transactionId }, counterpartId })`. Besides the plan-named `createTransactionPairAction` call site, two test files not in this plan's `files_modified` list call `createPair` directly with the old bare-`transactionId` shape: `tests/reimbursement-regression.test.ts` (2 call sites, and explicitly required to stay green by this plan's own `<verification>` block) and `tests/transaction-pairs-service.test.ts` (23 call sites).
- **Fix:** Updated all 25 call sites to the new `anchor`-shaped input via targeted mechanical transforms (verified against a full-file diff review, not blind find/replace). Also extended `transaction-pairs-service.test.ts`'s mocked schema with `expenseGroup`/`expenseGroupMembership`/`reimbursement.expenseGroupId` (needed for the module import to resolve) and every affected `dbSelectChain.mockImplementation` sequence with an explicit response for `createPairTx`'s new create-or-append existing-reimbursement lookup select — without this, several tests silently took the wrong CREATE/APPEND branch (a mock's catch-all "default" response, previously only reachable by the refund-cleanup title lookup, was now ALSO being returned for the new lookup call one position earlier in the sequence).
- **Files modified:** `tests/reimbursement-regression.test.ts`, `tests/transaction-pairs-service.test.ts`
- **Verification:** Both files' full suites green (21/21 and 33/33 respectively); full repo suite (`vitest run`) green at 145/145 files, 1787/1787 tests.
- **Committed in:** `b7d974a` (Task 1 commit)

**2. [Rule 3 - Blocking] Self-pair guard moved into createPairTx broke a "short-circuits before opening db.transaction" test**
- **Found during:** Task 1, running `tests/transaction-pairs-service.test.ts` after the initial refactor
- **Issue:** The self-pair guard (CR-01) originally ran in `createPair` BEFORE calling `db.transaction`. Moving it entirely into `createPairTx` (per the plan's literal architecture) meant `createPair`'s wrapper opened `db.transaction` FIRST, so `db.transaction` was invoked even for a rejected self-pair — breaking `expect(db.transaction).not.toHaveBeenCalled()`.
- **Fix:** Duplicated the guard: `createPair` checks it before opening the transaction (preserving the exact prior short-circuit behavior); `createPairTx` keeps its own copy for a future direct caller.
- **Files modified:** `lib/services/transaction-pairs.ts`
- **Verification:** `tests/transaction-pairs-service.test.ts` full suite green (33/33).
- **Committed in:** `b7d974a` (Task 1 commit)

**3. [Rule 3 - Blocking] getEligibleCounterparts signature change breaks its DAL unit test file**
- **Found during:** Task 2, after generalizing `referenceId` → `excludeTransactionIds`
- **Issue:** `tests/transaction-pairs-dal.test.ts` (not in this plan's `files_modified` list) calls `getEligibleCounterparts` with the old `referenceId` field and asserts a `ne(transaction.id, referenceId)` predicate — both invalid against the new signature and the new `notInArray`-based implementation.
- **Fix:** Rewrote every call site to `excludeTransactionIds: [...]`, added `notInArray` to the file's `drizzle-orm` mock, and replaced the single self-exclusion assertion with two (single-element array for the D-07 quick-action case, multi-element array for the Group-exclusion case) asserting `notInArray` instead of `ne`.
- **Files modified:** `tests/transaction-pairs-dal.test.ts`
- **Verification:** Full file green (11/11 tests, including the 2 new multi-exclusion assertions).
- **Committed in:** `feaad54` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 3 — blocking issues directly caused by this plan's own mandated signature changes)
**Impact on plan:** All three fixes were required to complete verification as specified (the plan's own `<verification>` block requires `tests/reimbursement-regression.test.ts` green, which cannot pass without fix #1). No scope creep — all three are scoped strictly to call sites broken by this plan's own API changes, matching the plan's explicit "Rule 3 auto-fix precedent" note for the `createTransactionPairAction` edit.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None — no external service configuration required, no schema migration in this plan (D-05/D-06 are pure service/DAL logic changes against the schema Plan 75-01 already migrated).

## Next Phase Readiness

- Plan 75-03 (unlink-baseline-restore) can now build on a write path that correctly represents 1:N and Group-anchored reimbursements — its baseline-restore logic no longer needs to special-case "the first refund created the reimbursement" vs. "a later refund appended to it."
- Plan 75-04 (linking UI) has both backend pieces its multi-select picker needs: `createPairTx` (composable inside one `db.transaction` for atomic multi-link) and `getGroupOccurrenceInterval` (the ±90-day window source for a Group anchor, D-06). No further backend wiring required for the picker to consume these.
- No blockers. `createPair`'s only behavior-preserving external contract (`createTransactionPairAction`, `counterpart-picker-dialog.tsx`) is unchanged for the existing D-07 quick-action flow.

---
*Phase: 75-linking-surfaces-and-lifecycle*
*Completed: 2026-07-24*

## Self-Check: PASSED

All 8 declared files verified present on disk; both task commits (`b7d974a`, `feaad54`) verified present in git history.
