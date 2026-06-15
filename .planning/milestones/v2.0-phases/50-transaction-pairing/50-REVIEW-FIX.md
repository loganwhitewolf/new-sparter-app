---
phase: 50-transaction-pairing
fixed_at: 2026-06-14T00:00:00Z
review_path: .planning/phases/50-transaction-pairing/50-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 5
skipped: 2
status: partial
---

# Phase 50: Code Review Fix Report

**Fixed at:** 2026-06-14
**Source review:** .planning/phases/50-transaction-pairing/50-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (the 3 criticals CR-01/CR-02/CR-03 were already resolved in commit 221382b and excluded)
- Fixed: 5 (WR-02, WR-03, WR-05, WR-06, WR-07)
- Skipped: 2 (WR-01, WR-04)

## Fixed Issues

### WR-02: `loadEligibleCounterpartsAction` has no Zod validation

**Files modified:** `lib/validations/transaction-pairs.ts`, `lib/actions/transaction-pairs.ts`
**Commit:** c89019b
**Applied fix:** Added `LoadCounterpartsSchema` (non-empty `referenceId`; `referenceAmount` validated as a numeric DECIMAL string via regex, never coerced to a JS number per the monetary hard rule; `dateFrom`/`dateTo` as `Date`s with a `dateFrom <= dateTo` refinement) and call `safeParse` at the top of `loadEligibleCounterpartsAction`, returning the first issue message on failure. The action now passes `parsed.data` to the DAL.

**Partial scope note:** The review also suggested defensively deriving `referenceAmount` server-side by re-loading the reference transaction under the session user instead of trusting the client value. That requires changing `getEligibleCounterparts`'s signature and adding a new DAL lookup — a cross-cutting change beyond this fix. The review itself notes there is no cross-user leak today (the candidate list is `userId`-scoped and `referenceAmount` only selects the sign filter), so the input-shape validation is the actionable, scoped part. The deeper server-side derivation is left as a follow-up.

### WR-03: unique-constraint violation not translated to a user-facing message

**Files modified:** `lib/services/transaction-pairs.ts`, `tests/transaction-pairs-service.test.ts`
**Commit:** 396999a
**Applied fix:** Added a local `errorCauseCode(error)` helper (mirrors the existing `lib/dal/patterns.ts` pattern) that reads the Postgres SQLSTATE off `error.cause.code`. Wrapped the `tx.insert(transactionPair)` in a try/catch: on code `23505` it throws the localized message `Una delle transazioni è già collegata a un'altra.`; any other error is re-thrown unchanged so non-unique failures propagate verbatim. Added two tests: one asserting a 23505 error surfaces the localized message with no DB internals leaking, one asserting a non-unique error re-throws unchanged.

### WR-05: `transaction-table` substitutes fallback amount/date instead of hiding the badge

**Files modified:** `components/transactions/transaction-table.tsx`
**Commit:** a16462b
**Applied fix:** Changed the pair-popover render guard to require ALL financial fields to be non-null (`pairedWithId && pairedNetAmount && pairedAmount && pairedOccurredAt`) before rendering, and removed the `pairedAmount ?? pairedNetAmount` and `pairedOccurredAt ?? new Date()` fallbacks that would have rendered plausible-but-wrong data. `pairedDescription ?? ''` is kept (an empty description is benign display, unlike a fabricated amount or date).
**Status:** fixed — requires human verification (rendering-logic change; no component test exists to lock the new gating, eslint + JSX type-check pass).

### WR-06: dead/incorrect dedup guard in `getMonthOverMonthCategoryChanges`

**Files modified:** `lib/dal/overview.ts`
**Commit:** 68a703e
**Applied fix:** Replaced the misleading `changes.some((c) => c.categoryId === prev.id)` guard (which never matches a real id in allocation mode where `categoryId` is nulled) with a `Set<number>` (`processedIds`) keyed on the raw `id`, populated when each current-month change is pushed. The prev-row loop now skips via `processedIds.has(prev.id)`; the `hasCurrRow` guard is retained to skip current-month rows that fell below the noise floor. Behaviour is equivalent for the intended dedup but keyed correctly on the raw id regardless of grain.
**Status:** fixed — requires human verification (de-dup logic change; existing overview tests pass, 44 green).

### WR-07: `offsetDateISO` off-by-one near midnight / DST (local-time vs UTC mismatch)

**Files modified:** `components/transactions/counterpart-picker-dialog.tsx`
**Commit:** 13c767e
**Applied fix:** Rewrote `offsetDateISO` to compute the offset entirely in UTC via `Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + days)` instead of mutating with local-time `setDate` and reading back with UTC `toISOString()`. This keeps the produced `YYYY-MM-DD` string aligned with the UTC-midnight re-parse performed by `fetchCounterparts` (`new Date(from)`), eliminating the boundary shift for users in a positive UTC offset (Italy is UTC+1/+2). Verified day-overflow handling (Jan 31 +1 → Feb 01, Dec 31 +1 → next year) and round-trip agreement with a manual node check.

## Skipped Issues

### WR-01: Blanket `catch {}` returning empty/zero data masks real DB failures across the dashboard DAL

**File:** `lib/dal/dashboard.ts` (multiple ranges) and `lib/dal/overview.ts` (multiple ranges)
**Reason:** skipped — pre-existing project-wide pattern, not introduced by this phase. The blanket `try { … } catch { return ZERO/[] }` wrapping spans the entire dashboard/overview DAL across many handlers; adding `console.error` logging to every one is a broad cross-cutting change outside this phase's scope. Per the fix instructions, prefer to skip and document rather than make a sweeping change. Recommend a dedicated follow-up to add observable logging consistently.
**Original issue:** Nearly every aggregation query swallows errors and degrades silently to "€0.00 / no data" with no log, so a broken pairing fragment would render as an empty dashboard rather than a visible failure.

### WR-04: `pairedNetAmount` correlated subquery does not exclude self-pairs / assumes exactly one counterpart

**File:** `lib/dal/transactions.ts:93-147`
**Reason:** skipped — the self-pair concern is already neutralized by the resolved CR-01 guard (no `(X, X)` rows can be created). The remaining suggestion (collapse the five correlated subqueries into a single `LEFT JOIN LATERAL`) is a non-trivial SQL refactor that risks regressing the existing query (which deliberately avoids a LEFT JOIN to preserve `buildTransactionOrderBy`, per the inline comment) and is not required for correctness. Deferred as a follow-up optimization rather than risk a behavior change here.
**Original issue:** Five separate correlated subqueries re-derive the same `CASE` counterpart-resolution per row, diverging from the "reuse, don't re-derive" guidance and risking drift.

## Info findings (out of scope)

IN-01 through IN-04 were not in scope (`fix_scope: critical_warning`) and were not addressed. Note: IN-01 (dead `getAmountFormatter`/`amountFormatterCache` in `transaction-table.tsx`) surfaces as a pre-existing eslint warning unrelated to the WR-05 edit.

---

_Fixed: 2026-06-14_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
