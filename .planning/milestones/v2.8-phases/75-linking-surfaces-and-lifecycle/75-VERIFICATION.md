---
phase: 75-linking-surfaces-and-lifecycle
verified: 2026-07-27T08:02:35Z
status: passed
score: 9/9 must-haves verified (1 explicitly descoped by locked user decision, not counted as a gap)
behavior_unverified: 0
overrides_applied: 0
scope_note:
  - "Success Criterion #1's 'and from an Expense Group' clause and 75-04's must-have truth #2
     ('SAME reusable component ... hosts reimbursement creation/management with the Group as
     anchor') are OUT OF SCOPE by a locked decision made during 75-04's UAT (documented in
     75-04-SUMMARY.md 'Key decisions' and deferred-items.md item 3). The Group-anchor backend
     (createPairTx's dual-anchor path, getGroupOccurrenceInterval, getGroupMemberTransactionIds,
     loadGroupOccurrenceIntervalAction/loadGroupRefundCandidatesAction, getReimbursementPanelData's
     { groupId } branch) is confirmed present and dormant — no UI entry point calls it with a
     { groupId } anchor anywhere in the codebase. This is treated as a verified descope, not a
     gap, per the phase's explicit instructions."
---

# Phase 75: Linking Surfaces and Lifecycle Verification Report

**Phase Goal:** Let the user create and manage a reimbursement in place from the transaction
detail page (D-01: the outflow transaction) — pick the anchor, attach/remove refunds, unlink/
delete restoring baseline. Also closes the D-08 netting-correctness gap: the anchor becomes
transaction-granular via a frozen anchored-transaction set. (Expense-Group anchor UI descoped by
locked decision — see scope_note above.)

**Verified:** 2026-07-27T08:02:35Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A frozen `reimbursement_anchor_transaction` row is recorded unconditionally on every `createPair`/`createPairTx` call (create path), never skipped as a create-only special case (D-08, Plan 75-01/02). | ✓ VERIFIED | `lib/services/transaction-pairs.ts:334-339` — unconditional insert inside the CREATE branch, gated only on `anchorTransactionIdForFrozenSet` being set (Expense anchor). Ran `tests/reimbursement-regression.test.ts -t "frozen-set"` live against real Postgres — 2/2 pass. |
| 2 | `effectiveAmount()`'s Expense-anchor branch resolves its member set exclusively via `reimbursement_anchor_transaction`; the Group-anchor branch is byte-identical to pre-Phase-75 (`expense_group_membership`). | ✓ VERIFIED | `lib/dal/transaction-pairs-sql.ts:99-117` — `member_transactions` is a `UNION ALL` of Branch A (`INNER JOIN reimbursement_anchor_transaction`) and Branch B (unchanged `member_expense_ids` predicate). Ran the full `tests/reimbursement-regression.test.ts -t "empty"` (byte-identical N=1/empty-refund cases) live — 2/2 pass. |
| 3 | A same-`expense_id` transaction inserted after linking (simulating a later same-merchant import) is excluded from `effectiveAmount()`'s member set and does not inherit any share of the linked refund — the D-08 contamination guard. | ✓ VERIFIED | Ran `tests/reimbursement-regression.test.ts -t "contamination"` live against real Postgres — 1/1 pass (behavioral, not presence-only). |
| 4 | The backfill migration populates exactly one `reimbursement_anchor_transaction` row per transaction under an Expense-anchored reimbursement's `expense_id`, and zero rows for Group-anchored reimbursements. | ✓ VERIFIED | `drizzle/migrations/0031_reimbursement_anchor_transaction.sql:26-31` — `INSERT ... WHERE r.expense_id IS NOT NULL ON CONFLICT DO NOTHING`, no Group-anchor path touched. Migration confirmed actually applied against the local dev Postgres (`\d reimbursement_anchor_transaction` shows the live table/constraints). |
| 5 | Linking a second (third...) refund to an anchor that already has a reimbursement appends a `reimbursement_refund` row instead of throwing the 23505 unique-violation — create-or-append (D-05). | ✓ VERIFIED | `lib/services/transaction-pairs.ts:275-346` — explicit existing-reimbursement lookup before insert, APPEND vs CREATE branch. `tests/reimbursement-phase-75.test.ts` Test 1 (dinner 1:N append) present and (per SUMMARY, real-Postgres) passing; code path directly inspected. |
| 6 | RMB-07 — user can **add** and **remove** individual refund links; unlinking a refund or deleting the reimbursement **restores baseline** (refund reappears as a normal, correctly-categorized inflow; anchor's net reverts). | ✓ VERIFIED | Code: `restoreRefundBaseline` (`lib/services/transaction-pairs.ts:463-542`) is called from both `deletePairByTransactionId`'s refund branch (before deleting the link row) and `deleteReimbursementForAnchor` (for every refund, before deleting the reimbursement row). **Ran live behavioral spot-checks** against real Postgres: `tests/reimbursement-phase-75.test.ts -t "Amazon 1:1 unlink"` (1/1 pass — single-refund restore), `-t "delete-whole-reimbursement"` (1/1 pass — restores ALL refunds, not just the last). These are the actual state-transition/restore invariants exercised, not symbol presence. |
| 7 | The UI wires the panel end to end on `/transactions/[id]`: creating a reimbursement, multi-select adding refunds with a running total, removing one inline, and deleting the whole reimbursement with confirmation, all visible net/residual/status (D-01, D-02, D-04, RMB-08 transaction-host). | ✓ VERIFIED | `app/(app)/transactions/[id]/page.tsx` resolves `getReimbursementPanelData`/`getRefundMembership` and passes both to `TransactionDetailClient`; `transaction-detail-client.tsx:382-420` mounts `ReimbursementPanel`/`RefundMembershipCard`/`RefundPickerDialog` gated on `isInflow = toDecimal(transaction.amount).isPositive()`. `ReimbursementPanel` (`components/transactions/reimbursement-panel.tsx`) renders net/residual/status via `formatResidualLabel`, ordered refund list with inline "Scollega", and a confirm-gated "Elimina rimborso" dialog calling `deleteReimbursementAction`. Manual E2E was user-approved per 75-04-SUMMARY.md (this session's Task 3 checkpoint). |
| 8 | The refund list renders in deterministic order (`reimbursement_refund.created_at ASC, transaction_id ASC` tie-break) — never unspecified DB row order. | ✓ VERIFIED | `lib/dal/reimbursement.ts:185` — `.orderBy(asc(reimbursementRefund.createdAt), asc(reimbursementRefund.transactionId))`. |
| 9 | Submitting the refund picker with zero ticked candidates is rejected client-and-server-side (Italian message), never silently creating an empty reimbursement. | ✓ VERIFIED | Client: `refund-picker-dialog.tsx:366` — submit `disabled={... || selectedIds.size === 0}`. Server: `CreateMultiRefundSchema.counterpartIds.min(1, { error: 'Seleziona almeno un rimborso da collegare.' })` in `lib/validations/transaction-pairs.ts:61-63`. Ran `tests/reimbursement-phase-75.test.ts -t "submitting zero ids"` live — 1/1 pass, asserts the Italian error and no DB write. |
| 10 (descoped, not counted) | From the Expense Group detail page, the SAME reusable component hosts reimbursement creation/management with the Group as anchor. | ⛔ DESCOPED (locked decision) | `components/expenses/group-detail-client.tsx` does not import or render `ReimbursementPanel`/`RefundPickerDialog` (confirmed by grep). This is the intentional, user-locked descope documented in 75-04-SUMMARY.md and `deferred-items.md` item 3 — not treated as a gap per the phase's explicit verification instructions. |

**Score:** 9/9 in-scope truths verified (0 present-but-behavior-unverified). Truth #10 is out of scope by locked decision and excluded from the denominator.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/db/schema.ts` — `reimbursementAnchorTransaction`, `reimbursementRefundSnapshot` | New tables + relations | ✓ VERIFIED | Both tables defined with composite/standalone uniques, both-side indexes, correct `onDelete` semantics (`cascade` for anchor set, `set null` for the snapshot's `expenseId`). Confirmed live in Postgres via `\d`. |
| `drizzle/migrations/0031_reimbursement_anchor_transaction.sql` | CREATE TABLE + backfill | ✓ VERIFIED | Present, applied to local dev DB, backfill scoped to `expense_id IS NOT NULL`, `ON CONFLICT DO NOTHING`. |
| `drizzle/migrations/0032_reimbursement_refund_snapshot.sql` | CREATE TABLE, no backfill | ✓ VERIFIED | Present, applied to local dev DB. |
| `lib/dal/transaction-pairs-sql.ts` (`effectiveAmount()`) | UNION ALL branch split | ✓ VERIFIED | Branch A (frozen set) / Branch B (unchanged `expense_group_membership`) confirmed in source. |
| `lib/services/transaction-pairs.ts` (`createPairTx`/`createPair`, `restoreRefundBaseline`, `deletePairByTransactionId`, `deleteReimbursementForAnchor`) | Create-or-append, dual anchor, restore lifecycle | ✓ VERIFIED | 673 lines, full logic inspected line-by-line — substantive, not a stub. |
| `lib/dal/reimbursement.ts` (`getReimbursementPanelData`, `getRefundMembership`, `getReimbursementAggregates`) | Panel read models | ✓ VERIFIED | 257 lines, IDOR-safe scoping (`userId` in every WHERE), deterministic ordering, `computeReimbursementResidual` reused not re-derived. |
| `lib/actions/transaction-pairs.ts` (`createMultiRefundAction`, `removeRefundAction`, `deleteReimbursementAction`) | Server actions | ✓ VERIFIED | 327 lines. `createMultiRefundAction` batches N `createPairTx` calls in one `db.transaction` — atomic rollback confirmed by live test. |
| `components/transactions/reimbursement-panel.tsx` | Management panel | ✓ VERIFIED | 271 lines. Empty-state CTA, net/residual/status line, ordered refund list, remove/delete actions — no stub markers, no dead handlers. |
| `components/transactions/refund-picker-dialog.tsx` | Multi-select picker | ✓ VERIFIED | 375 lines. Checkbox multi-select, Decimal.js running total, dual anchor support (transaction/group), client+server empty-selection guard. |
| `components/transactions/transaction-detail-client.tsx` | Host wiring | ✓ VERIFIED | Mounts panel/picker/membership-card, direction-gated (`isInflow`), old inline `pairedWithId` block removed. |
| `app/(app)/transactions/[id]/page.tsx` | RSC data threading | ✓ VERIFIED | Resolves both DAL calls in parallel, branches by direction, passes both props down. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `ReimbursementPanel` | `getReimbursementPanelData` / `computeReimbursementResidual` | RSC-resolved `data` prop | WIRED | Page resolves data server-side; panel is a pure renderer of the passed shape, no client fetch. |
| `RefundPickerDialog` | `getEligibleCounterparts` / `getGroupOccurrenceInterval` | `loadEligibleCounterpartsAction` / `loadGroupOccurrenceIntervalAction` / `loadGroupRefundCandidatesAction` | WIRED (transaction-anchor path); DORMANT-BUT-WIRED (group-anchor path, no caller passes `{ groupId }`) | Transaction-anchor path is live end to end. Group-anchor path is code-complete and internally consistent but has zero UI entry points — confirmed by grep across `components/` and `app/`. |
| `transaction-detail-client.tsx` collegamentiCard | `ReimbursementPanel` / `RefundMembershipCard` | Direct render, `isInflow` gate | WIRED | Old `pairedWithId` inline block confirmed removed (replaced). |
| `createMultiRefundAction` | `createPairTx` | Shared `db.transaction`, one call per selected counterpart id | WIRED | Live test confirms atomic rollback on a mid-batch failure (foreign-owned id). |
| `deletePairByTransactionId` / `deleteReimbursementForAnchor` | `restoreRefundBaseline` | Called before link/reimbursement row deletion | WIRED | Live tests confirm restore-before-delete ordering for both single-unlink and delete-all paths. |
| Transactions table row | `ReimbursementRowIndicator` | `pairedNetAmount != null` gate | WIRED | Confirmed via `git show --stat 0602039` — replaces the stale, dead-link `TransactionPairPopover`; documented as a UAT-driven fix in 75-04-SUMMARY.md, full suite green afterward. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Frozen-set write (unconditional on create) | `vitest run tests/reimbursement-regression.test.ts -t "frozen-set"` | 2/2 pass | ✓ PASS |
| D-08 contamination guard (same-`expense_id` re-import never inherits a share) | `vitest run tests/reimbursement-regression.test.ts -t "contamination"` | 1/1 pass | ✓ PASS |
| Byte-identical netting (N=1/empty-refund regression) | `vitest run tests/reimbursement-regression.test.ts -t "empty"` | 2/2 pass | ✓ PASS |
| RMB-07 single-refund unlink restores baseline | `vitest run tests/reimbursement-phase-75.test.ts -t "Amazon 1:1 unlink"` | 1/1 pass | ✓ PASS |
| RMB-07 delete-whole-reimbursement restores ALL refunds | `vitest run tests/reimbursement-phase-75.test.ts -t "delete-whole-reimbursement"` | 1/1 pass | ✓ PASS |
| `createMultiRefundAction` atomic rollback on mid-batch failure | `vitest run tests/reimbursement-phase-75.test.ts -t "mid-batch failure"` | 1/1 pass | ✓ PASS |
| Empty-selection server-side rejection | `vitest run tests/reimbursement-phase-75.test.ts -t "submitting zero ids"` | 1/1 pass | ✓ PASS |
| `tsc --noEmit` | `node_modules/.bin/tsc --noEmit -p tsconfig.json` | no output (clean) | ✓ PASS |
| `yarn check:language` | `node scripts/check-code-language.mjs` | "English code convention check passed." | ✓ PASS |
| Migrations 0031/0032 actually applied to local dev DB | `docker exec sparter-postgres psql ... \d reimbursement_anchor_transaction / reimbursement_refund_snapshot` | Both tables present with expected columns/constraints | ✓ PASS |

Full suite was NOT re-run (per task instructions — already confirmed green at 146 files/1815 tests by the executor); the 7 behavioral spot-checks above were each run individually via `-t` name filters against the real Postgres harness to confirm the specific state-transition/invariant claims, not just symbol presence.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RMB-07 | 75-01/75-02/75-03/75-04 | Add/remove refund links; unlink/delete restores baseline | ✓ SATISFIED | Full backend (snapshot + restore) verified by live behavioral tests; UI wired end to end on `/transactions/[id]`. |
| RMB-08 | 75-01/75-02/75-04 | Create/manage a reimbursement from an entry-point surface | ✓ SATISFIED (transaction-detail host) / DESCOPED (Group-host, locked decision) | Transaction-detail host fully live (create, multi-add, remove, delete, net/residual/status inline). Expense-Group host UI intentionally removed by user decision during 75-04 UAT; backend stays dormant, not deleted — verified by grep showing zero `{ groupId }` anchor callers in any host component. |

**Note on REQUIREMENTS.md text drift:** REQUIREMENTS.md's RMB-08 line still reads "the Expense detail page (`/expenses/[id]`) and from the Expense Group" — this predates the phase's own locked CONTEXT decision D-01 ("Entry points are `/transactions/[id]` ... and the Expense Group"), which never named `/expenses/[id]` as a host at all. `/expenses/[id]` correctly has NO linking UI (confirmed by grep) — this is by design (D-01), not a gap. REQUIREMENTS.md's prose should be corrected to match D-01/the locked 75-04 descope when RMB-07/RMB-08 are marked complete, but this is a documentation-accuracy note, not an implementation gap.

No orphaned requirements found — RMB-07/RMB-08 are the only two requirements mapped to Phase 75 in REQUIREMENTS.md's traceability table, and both are explicitly declared in the plans' frontmatter `requirements:` fields.

### Anti-Patterns Found

None. Scanned every touched file (`lib/dal/reimbursement.ts`, `lib/services/transaction-pairs.ts`, `lib/actions/transaction-pairs.ts`, `lib/validations/transaction-pairs.ts`, `lib/dal/transaction-pairs.ts`, `components/transactions/reimbursement-panel.tsx`, `refund-picker-dialog.tsx`, `transaction-detail-client.tsx`, `reimbursement-row-indicator.tsx`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/stub patterns. Zero debt markers. The only "placeholder" string hits are a legitimate HTML `placeholder` attribute and a comment describing an intentional design choice (a synthetic negative amount for the sign-only filter) — neither is a stub.

### Human Verification Required

None outstanding. The phase's own `checkpoint:human-verify` gate (75-04 Task 3, manual E2E: create → multi-add → remove → delete → inflow-refund read-state → group-host-no-UI → detail-page polish) was already run and user-approved per 75-04-SUMMARY.md, before this verification.

### Gaps Summary

No gaps. All 9 in-scope must-have truths verified by direct code inspection plus live, targeted behavioral tests against the real Postgres harness (not full-suite re-run, per task scope). The one item explicitly out of scope (Expense-Group anchor UI) is a locked product decision, confirmed dormant-not-broken in the codebase, and is not counted as a gap per this verification's explicit instructions.

---

_Verified: 2026-07-27T08:02:35Z_
_Verifier: Claude (gsd-verifier)_
