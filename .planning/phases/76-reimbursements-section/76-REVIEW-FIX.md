---
phase: 76-reimbursements-section
fixed_at: 2026-07-27T15:20:00Z
review_path: .planning/phases/76-reimbursements-section/76-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 3
skipped: 2
status: partial
---

# Phase 76: Code Review Fix Report

**Fixed at:** 2026-07-27T15:20:00Z
**Source review:** .planning/phases/76-reimbursements-section/76-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (critical + warning): 5 — CR-01, CR-02, WR-01, WR-02, WR-03
- Fixed (this run): 3 — WR-01, WR-02, WR-03
- Skipped (already resolved prior to this run): 2 — CR-01, CR-02
- Info (IN-01): out of scope for `fix_scope: critical_warning`, left untouched.

Both CRITICAL findings were verified against current code and confirmed already fixed and committed on the source branch before this run started (`b6316f3` for CR-01, `05eb9ea` for CR-02, per REVIEW.md's own "Resolution" note). No re-application or revert was performed. All work in this run targeted the 3 open WARNINGs.

## Fixed Issues

### WR-01: Residual/status label text duplicated across two files with divergent copy

**Files modified:** `lib/utils/reimbursement-format.ts`, `components/transactions/reimbursement-panel.tsx`
**Commit:** `492a133`
**Applied fix:** Extracted the actual duplicated *logic* (residual → absolute-value → `formatAbsoluteAmount`) into one new shared helper, `formatResidualAbsoluteAmount`, in `lib/utils/reimbursement-format.ts`. `formatResidualBadgeLabel` (same file) and `formatResidualLabel` (`reimbursement-panel.tsx`) both now call this single helper instead of each inlining `formatAbsoluteAmount(toDecimal(residual).abs().toFixed(2))` independently.

Rendered text was deliberately left unchanged — `formatResidualLabel`'s "Ancora dovuti €N" / "Surplus di €N" wording (asserted verbatim by `tests/reimbursement-panel.test.ts`, which imports the function from `reimbursement-panel.tsx` by name) still differs intentionally from `formatResidualBadgeLabel`'s "Dovuti €N" / "Surplus €N" and from the panel's own `stateBadgeLabel` ("Da saldare" / "Saldato" / "Surplus"). Per REVIEW.md's stated alternative ("if the different wording per surface is intentional, leave an explicit comment... so a future edit doesn't silently diverge"), added cross-reference doc comments on all three functions naming the other two call sites, so a future copy change is caught by a human reading the comment rather than drifting silently. This removes the actual numeric-formatting duplication while satisfying the "do not change rendered text" constraint.

Verified: `tsc --noEmit` clean on both files; `tests/reimbursement-panel.test.ts`, `tests/reimbursement-list.test.ts`, `tests/reimbursement-table-sort.test.ts` (11 tests) pass unchanged.

### WR-02: `updateReimbursementTitleAction` stores an untrimmed title verbatim

**Files modified:** `lib/validations/reimbursement.ts`
**Commit:** `233f647`
**Applied fix:** Added `.trim()` to `UpdateReimbursementTitleSchema.title` (`z.string().trim().max(255, ...)`), per REVIEW.md's first suggested option — trimming at the Zod schema is the single source of truth, ahead of both the DAL write and every downstream `resolveReimbursementDisplayTitle` read. A whitespace-only submission (`"   "`) is now parsed to `''` (which still correctly triggers the existing D-03 anchor-title fallback), and leading/trailing whitespace around a real title (`"  hello  "` → `"hello"`) is stripped before it ever reaches `updateReimbursementTitle`/the DB. No `.min(1)` was added — an empty title remains an intentionally valid, non-error state per the schema's existing doc comment.

Verified: manual `safeParse` check confirmed `"   "` → `title: ""` and `"  hello  "` → `title: "hello"`; `tsc --noEmit` clean; `tests/reimbursement-detail-dal.test.ts`, `tests/reimbursement-list.test.ts`, `tests/reimbursement-phase-75.test.ts` (37 tests) pass unchanged (no existing test asserted the previous untrimmed behavior).

### WR-03: `formatSignedAmount` silently coerces a non-finite residual to €0.00

**Files modified:** `components/reimbursements/reimbursement-table.tsx`
**Commit:** `615636b`
**Applied fix:** Changed the non-finite branch of the local `formatSignedAmount` helper to return the raw value suffixed with the currency code (`` `${value} EUR` ``) instead of coercing to `0` and formatting that as `"0,00 €"`. This mirrors `formatAbsoluteAmount`'s documented convention (`lib/utils/format-amount.ts:38-40`, `` return `${amount} ${currency}` ``) verbatim, so a malformed upstream `row.residual` now renders as a visibly wrong string rather than a plausible "Saldato"-shaped zero amount.

Verified: `tsc --noEmit` clean; `tests/reimbursement-table-sort.test.ts`, `tests/reimbursement-list.test.ts` (8 tests) pass unchanged (function is a local, non-exported helper with no existing direct unit test).

## Skipped Issues

### CR-01: Deleting/removing a refund or reimbursement never revalidates `/reimbursements`

**File:** `lib/actions/transaction-pairs.ts`
**Reason:** already resolved, no change needed. Verified against current worktree code: all four mutation actions (`createTransactionPairAction`, `deleteTransactionPairAction`/`removeRefundAction`, `deleteReimbursementAction`, `createMultiRefundAction`) already call `revalidatePath('/reimbursements')` alongside the existing `/transactions` and `/overview` calls (13 `revalidatePath` call sites confirmed via grep). This matches REVIEW.md's own "Resolution" note: fixed and committed prior to this run in `b6316f3`. Not re-applied or reverted.

### CR-02: Unlinking the anchor transaction never restores linked refunds' pre-link baseline

**File:** `lib/services/transaction-pairs.ts`
**Reason:** already resolved, no change needed. Verified against current worktree code: `deletePairByTransactionId`'s anchor-side branch now delegates to `restoreRefundsAndDeleteReimbursement` (restore-every-linked-refund-then-delete, `userId`-scoped), the same core `deleteReimbursementForAnchor` uses, closing the restore-before-cascade-delete gap described in the finding. This matches REVIEW.md's own "Resolution" note: fixed and committed prior to this run in `05eb9ea`. Not re-applied or reverted.

---

_Fixed: 2026-07-27T15:20:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
