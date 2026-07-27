---
phase: 74-group-anchor-and-reconciliation
reviewed: 2026-07-24T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - lib/dal/reimbursement.ts
  - lib/dal/transaction-pairs-sql.ts
  - lib/services/reimbursement.ts
  - lib/services/transaction-edit.ts
  - tests/fixtures/reimbursement-seed.ts
  - tests/pair-guard-message.test.ts
  - tests/reimbursement-regression.test.ts
  - tests/reimbursement-residual.test.ts
  - tests/transaction-edit.test.ts
findings:
  critical: 2
  warning: 2
  info: 1
  total: 5
status: issues_found
---

# Phase 74: Code Review Report

**Reviewed:** 2026-07-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

`lib/dal/transaction-pairs-sql.ts` (`effectiveAmount()`) and `lib/dal/reimbursement.ts`
(`getReimbursementAggregates()`) are both correctly Group-anchor-aware: the proportional-spread
SQL, the largest-remainder cent assignment, and the zero-sum division guard all check out against
their own docstrings and are exercised by real-Postgres regression tests
(`tests/reimbursement-regression.test.ts` Scenarios A/B/C, `tests/reimbursement-residual.test.ts`
Task 2) that I traced by hand and confirmed arithmetically correct, including the NULL-propagation
path through `COALESCE`/`NULLIF` on the zero-sum guard.

`lib/services/transaction-edit.ts`, however, was **not** updated for Group anchors at all — it
still only ever resolves a reimbursement's anchor via `reimbursement.expense_id`, never
`expense_group_id` / `expense_group_membership`. This is the exact failure mode called out in
CLAUDE.md ("a guard that silently mutates totals is the exact failure it prevents"): editing the
amount of a transaction that belongs to a Group-anchored reimbursement's member Expense bypasses
the pair guard entirely, and even where a refund IS detected against a Group anchor, the "other
side" sum silently drops the anchor's own outflow. Both are BLOCKERs. Neither is covered by any
test — `tests/transaction-edit.test.ts` fully mocks the SQL layer and never constructs a Group
scenario, and no real-Postgres integration test calls `updateTransaction` against a Group anchor at
all (confirmed via `grep -rln updateTransaction tests/`).

## Critical Issues

### CR-01: Pair guard never detects a Group-anchored reimbursement — amount edits on group members are completely unguarded

**File:** `lib/services/transaction-edit.ts:109-134`

**Issue:** `asAnchorReimbursementId` is the sole mechanism that decides whether an amount edit needs
the pair-guard check at all:

```ts
asAnchorReimbursementId: sql<number | null>`(
  SELECT r.id FROM reimbursement r
  WHERE r.expense_id = ${row.expenseId}
  AND ${input.transactionId} = (
    SELECT t2.id FROM transaction t2
    WHERE t2.expense_id = ${row.expenseId}
    ORDER BY t2.occurred_at ASC, t2.id ASC
    LIMIT 1
  )
  LIMIT 1
)`,
```

This only ever matches `reimbursement.expense_id`. For a Group-anchored reimbursement,
`expense_id` is `NULL` (per the `reimbursement_anchor_xor` CHECK constraint — `expense_group_id` is
set instead, resolved via `expense_group_membership`, exactly as `lib/dal/reimbursement.ts` and
`lib/dal/transaction-pairs-sql.ts`'s `effectiveAmount()` already do for this same table shape).
There is no `OR` branch checking `expense_group_id` anywhere in this file (confirmed via
`grep -n "expense_group" lib/services/transaction-edit.ts` — zero matches).

Consequence: editing the amount of ANY member transaction of a Group-anchored reimbursement
resolves `reimbursementId = null`, so the entire `if (reimbursementId != null)` guard block
(lines 137-228) is skipped — the edit proceeds straight to the plain `.update()` and
`applyExpenseReconciliation()` with zero protection. A user can flip a group member's outflow to a
matching-sign value, or zero it out, and the write goes through silently, exactly the scenario the
guard exists to prevent (per this file's own docstring at lines 62-77).

Untested: `tests/transaction-edit.test.ts` mocks `dbSelectChain` directly and never exercises the
real SQL fragment above; no scenario in that file (or anywhere else in `tests/`) seeds a Group
anchor and calls `updateTransaction` against one of its members.

**Fix:** Add the Group-anchor branch to the anchor-detection query (mirroring
`effectiveAmount()`'s `anchor` CTE), and treat every member transaction of the group as capable of
triggering the guard, not just one representative:

```ts
asAnchorReimbursementId: sql<number | null>`(
  SELECT r.id FROM reimbursement r
  WHERE (
    r.expense_id = ${row.expenseId}
    AND ${input.transactionId} = (
      SELECT t2.id FROM transaction t2
      WHERE t2.expense_id = ${row.expenseId}
      ORDER BY t2.occurred_at ASC, t2.id ASC
      LIMIT 1
    )
  ) OR (
    r.expense_group_id = (
      SELECT egm.group_id FROM expense_group_membership egm
      WHERE egm.expense_id = ${row.expenseId}
    )
  )
  LIMIT 1
)`,
```

Better: don't re-derive this logic a third time in a third place. `lib/dal/reimbursement.ts`
already resolves "does this expense belong to an anchor, Expense- or Group-shaped" correctly and is
covered by regression tests — extract/reuse that resolution (or a small shared helper) instead of
maintaining a parallel, drifting copy here. This duplication is what let the Group case slip
through in the first place (see WR-02).

### CR-02: Refund-edit guard silently treats the anchor's outflow as zero for Group-anchored reimbursements

**File:** `lib/services/transaction-edit.ts:146-154`

**Issue:** When editing a REFUND transaction (`isRefundEdit === true`), the "other side" of the
opposite-sign check is computed as `anchorAmount + otherRefundsSum`:

```ts
anchorAmount: sql<string | null>`(
  SELECT t2.amount FROM transaction t2
  WHERE t2.id = (
    SELECT t3.id FROM transaction t3
    WHERE t3.expense_id = ${reimbursement.expenseId}
    ORDER BY t3.occurred_at ASC, t3.id ASC
    LIMIT 1
  )
)`,
```

This resolves `reimbursement.expenseId` only. For a Group anchor `reimbursement.expenseId` is
`NULL`, so `t3.expense_id = NULL` matches nothing, the inner subquery returns 0 rows (`NULL`),
`t2.id = NULL` matches nothing, and `anchorAmount` resolves to `NULL`. Downstream:

```ts
const otherSum = toDecimal(sumRow?.anchorAmount ?? '0').plus(
  toDecimal(sumRow?.otherRefundsSum ?? '0'),
)
```

`?? '0'` silently substitutes zero for the anchor's entire outflow magnitude. For a refund linked to
a Group anchor, `otherSum` becomes just the sum of the OTHER refunds — potentially a small or even
zero value — instead of `Σ(group member outflows) + Σ(other refunds)`. The opposite-sign check then
evaluates against the wrong magnitude/sign basis, so it can wrongly permit an edit that should be
blocked (e.g. when the correct `otherSum` is strongly negative but the miscalculated one is near
zero or positive) or wrongly block one that should be allowed. This is a distinct defect from CR-01
(different code path — this one requires `asRefundReimbursementId` to already correctly identify
the refund's reimbursement, which it does, since that lookup is anchor-shape-agnostic; the bug is
purely in what the "other side" sum resolves to).

**Fix:** Reuse `getReimbursementAggregates()` (`lib/dal/reimbursement.ts`), which already computes
`outflowSum` correctly for both anchor shapes, instead of re-deriving "the anchor's own amount"
inline via a `reimbursement.expenseId`-only subquery:

```ts
const aggregates = await getReimbursementAggregates({ reimbursementId, userId: input.userId })
const otherSum = toDecimal(aggregates?.outflowSum ?? '0').plus(
  toDecimal(sumRow?.otherRefundsSum ?? '0'),
)
```

(Note `getReimbursementAggregates` takes the full `tx`-scoped `db`/`userId`/`reimbursementId` triple
— confirm it accepts a `DbOrTx` or add that support, per CLAUDE.md's atomic-import convention, so
this call participates in the same `db.transaction`.)

## Warnings

### WR-01: Anchor-detection tie-break only recognizes the earliest transaction of a multi-transaction Expense anchor

**File:** `lib/services/transaction-edit.ts:105-125`

**Issue:** The comment claims this uses "the same Q3 tie-break used by effectiveAmount()", but it
does not:

- `transaction-edit.ts`: `ORDER BY t2.occurred_at ASC, t2.id ASC` (occurredAt-first)
- `effectiveAmount()` (`lib/dal/transaction-pairs-sql.ts:112-114`): `ORDER BY ABS(mt.amount) DESC,
  mt.occurred_at ASC, mt.id ASC` (magnitude-first)

These only coincide by accident when all siblings share the same magnitude. More importantly, for
an Expense with multiple member transactions (the Q3 scenario, which `effectiveAmount()` explicitly
supports — every sibling absorbs a proportional share), only the transaction picked by this
`occurred_at ASC` tie-break is ever treated as "the anchor" for guard purposes. Editing a
*non-earliest* sibling transaction's amount resolves `asAnchorReimbursementId = null` and skips the
guard, even though that sibling's amount participates directly in `effectiveAmount()`'s
proportional-spread denominator and would change every other sibling's share.

**Fix:** Either (a) check membership in the full sibling set (any transaction with the same
`expense_id` as an Expense-shaped anchor should trigger the guard, not just the earliest), matching
how `effectiveAmount()` treats every sibling as an equal participant, or (b) if the "earliest
transaction is authoritative" design is intentional for some other reason, correct the comment (it
currently asserts equivalence with `effectiveAmount()`'s tie-break, which is false) and document
why non-earliest siblings are deliberately left unguarded.

### WR-02: Anchor/refund resolution logic is duplicated (and now drifted) across three places

**File:** `lib/services/transaction-edit.ts:109-228` vs `lib/dal/reimbursement.ts:49-73` vs
`lib/dal/transaction-pairs-sql.ts:72-129`

**Issue:** "Given an expense, is it linked to a reimbursement, and if so is it Expense- or
Group-shaped, and what's the correct aggregate outflow/refund sum" is resolved independently, via
raw inline SQL, in three different files. `lib/dal/reimbursement.ts` and `effectiveAmount()` got
updated for Group anchors in this phase; `transaction-edit.ts` did not (CR-01/CR-02). This is a
direct, provable consequence of not having one shared resolution function — the next reader who
touches anchor resolution has no single place to change and three places to remember to keep in
sync.

**Fix:** Extract a shared DAL helper (e.g. `resolveReimbursementForExpense(db, expenseId)` returning
`{ reimbursementId, shape: 'expense' | 'group' } | undefined`) that both `transaction-edit.ts` and
`transaction-pairs-sql.ts` call into, and have `transaction-edit.ts`'s "other side" sums call
`getReimbursementAggregates()` directly instead of re-deriving them.

## Info

### IN-01: "largest-remainder" docstring terminology doesn't match the actual assignment rule

**File:** `lib/dal/transaction-pairs-sql.ts:37-49`

**Issue:** The docstring and variable names (`raw_share`, the comment "assigned by
largest-remainder") evoke the classical largest-remainder rounding method (remainder goes to the
item(s) with the largest *fractional* deviation after truncation). What's actually implemented
assigns the *entire* residual correction (which can be any number of cents, not just ±1) to a single
canonical member chosen by largest absolute amount (tie-broken by `occurred_at ASC, id ASC`) —
correct and well-tested for its stated purpose (RMB-02/precision, Scenario B), but a future
maintainer skimming for "largest remainder method" semantics (distributing 1-cent adjustments across
multiple members by fractional size) could be misled into thinking multiple members can absorb
remainder cents when in fact only ever one does.

**Fix:** Non-blocking; consider renaming the doc language to something like "the entire rounding
correction is assigned to one canonical member (the largest-magnitude one, tie-broken
deterministically)" to avoid the classical-LRM association.

---

_Reviewed: 2026-07-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
