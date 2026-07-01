---
gsd_state_version: 1.0
milestone: v2.4
milestone_name: Standalone Expense
current_phase: 61
current_phase_name: standalone-expense
status: verifying
stopped_at: Completed 61-02-PLAN.md
last_updated: "2026-07-01T09:41:27.048Z"
last_activity: 2026-07-01
last_activity_desc: Phase 61 execution started
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
  percent: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-01)

**Core value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending — all running on a zero-cost personal deploy.
**Current focus:** Phase 61 — standalone-expense

## Current Position

Phase: 61 (standalone-expense) — EXECUTING
Plan: 2 of 2
Status: Phase complete — ready for verification
Last activity: 2026-07-01 — Phase 61 execution started
Progress: [                    ] 0/1 phases

## Roadmap (v2.4 — Phase 61)

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 61 | standalone-expense | STEXP-01, STEXP-02, STEXP-03 | Not started |

**Coverage:** 3/3 STEXP requirements mapped to Phase 61. Decision contract LOCKED (ADR 0016) — pure implementation, no discovery to redo.

## Accumulated Context

### Decisions

Design contract is LOCKED (ADR 0016). Do not re-derive the approach:

- **ADR 0016 (decision 1) — netting doctrine already usable, zero code.** A reimbursement for a shared/recurring cost is categorized under the *same* subcategory as the spend it offsets (option A, per ADR 0004) and nets by algebraic sum. The month a lump sum lands showing a net-positive OUT segment is accepted cash-basis behavior, not a bug. This milestone builds **no** new income/transfer classification for reimbursements.
- **ADR 0016 (decision 2) — general "standalone expense" action, not a counterparty category.** The categorization flow gains an explicit "treat as a standalone expense / do not aggregate" option that captures a **title + subcategory** and detaches the single transaction into its own expense with a synthetic `descriptionHash` (`sha256("detached:{id}")`). It is deliberately general — available on any transaction — never a "money from a person" feature (classifying by counterparty is forbidden by the CONTEXT.md doctrine: classify by purpose, not by who).
- **ADR 0016 (decision 3) — isolation is per-transaction, not a standing rule.** Detaching frees the original `descriptionHash`; the next same-description transaction arrives fresh and uncategorized. No persisted "never aggregate this sender" flag — the same description legitimately means different things. The recurring manual cost is accepted; relieving it is the job of the deferred Subscriptions view.
- **ADR 0016 (decision 4) — single-transaction path re-hashes in place; the guard is lifted, not patched.** The `SINGLE_TRANSACTION_EXPENSE` guard in `lib/services/transaction-detach.ts` exists to avoid orphaning an empty source in the multi-transaction detach path. For the single-transaction case, rewrite the existing expense's `description_hash` to the synthetic value in place — same row, same id, no new expense, no orphan, classification history preserved. Observable outcome identical to a normal detach.
- Layers / hard rules still apply: Decimal.js for amounts, writes inside `db.transaction`, DAL/services/actions separation, English dev-facing code, Italian only for product surfaces.
- [Phase 61]: In-place detach branch never calls reconcileExpensesAfterTransactionRemoval — no separate source row exists once the branch is taken (ADR 0016 decision 4) — Prevents reconciling the wrong row or a no-op call
- [Phase 61]: hasSubCategoryId = input.subCategoryId !== undefined distinguishes omitted from explicitly-null across both detach branches — Backward compatibility: omitted stays untouched on in-place branch, defaults to null/status 1 on insert branch
- [Phase ?]: Phase 61 (61-02): standalone menu item gated only on transaction.expenseId (STEXP-02 count gate removed); relabeled to 'Spesa a se (non aggregare)' to read as one-off/do-not-aggregate, not a mechanical split
- [Phase ?]: Phase 61 (61-02): DetachExpenseDialog onSuccess payload gains subCategoryId; table applies markExpensesCategorized(String(subCategoryId)) immediately instead of opening a second ExpenseCategorizeDialog step
- [Phase ?]: Phase 61 (61-02): TransactionTitleEdit row title precedence fixed to customTitle -> expenseTitle -> description (fallbackTitle prop) so a renamed standalone expense shows its chosen title, not the raw bank description

### Deferred (per ADR 0016 — not built now)

- **SUBS-VIEW** — normalized "Subscriptions" view showing net cost per covered month for shared/recurring expenses. The main entrate/uscite dashboard stays cash-basis; the monthly chart is not amortized.
- **SPLIT-01** — split a single inflow across multiple subcategories (e.g. €50 subscription + €20 pizza in one transfer). The one-transaction → one-subcategory limit holds.
- A "money received from a person" (counterparty) category — rejected by ADR 0016.

### Codebase facts relevant to the milestone

- `lib/services/transaction-detach.ts` — `detachTransactionToDedicatedExpense({ userId, transactionId, title })` already: validates ownership via `innerJoin(expense)`, computes `syntheticDescriptionHash = sha256("detached:{transactionId}")`, inserts a new expense (`subCategoryId: null`, `transactionCount: 1`, `status: '1'`), repoints the transaction, and reconciles the source. **STEXP-01 must add subcategory capture** (the service currently sets `subCategoryId: null`). **STEXP-02 must lift the `SINGLE_TRANSACTION_EXPENSE` guard** (currently throws when `expenseTransactionCount <= 1`) via an in-place re-hash branch.
- Landed via quick task `260629-m9i` (commit 90bfa69): "Detach transaction to dedicated expense + re-import manual lock" — the multi-transaction detach and the synthetic-hash mechanism already exist. This milestone surfaces it inline in the categorization flow and adds the single-transaction path + subcategory.
- Tier 2 history learning writes to `expenseClassificationHistory` (source `manual`), keyed by `(userId, descriptionHash)`. Because a standalone expense carries a synthetic per-transaction hash, it does not teach Tier 2 for the original description — STEXP-03 must confirm/preserve this.
- `SubcategoryPicker` (vaul bottom sheet, single `subCategoryId` output, adopted across all 7 selection surfaces) is the intended control for the inline standalone action's subcategory capture — reuse, do not build a new picker (v1.13 / ADR 0008).

### Blockers/Concerns

None. Scope is small, cohesive, and fully specified by ADR 0016.

## Deferred Items

Items acknowledged and postponed:

| Category | Item | Status |
|----------|------|--------|
| v2.4 | SUBS-VIEW (normalized Subscriptions net-per-month view) | deferred — ADR 0016 |
| v2.4 | SPLIT-01 (split one inflow across subcategories) | deferred — ADR 0016 |
| v2.3 | Operator approval UI (`pending` → `approved`) | deferred — needed only with a second user |
| v2.3 | Multi-user platform identity dedup | deferred — multi-user only |
| verification_gap | 53-VERIFICATION.md | human_needed — 3 browser/visual checks |
| verification_gap | 55-VERIFICATION.md | human_needed — 2 visual checks |
| uat_gap | 53-UAT.md | diagnosed — 0 pending scenarios |
| v2.1 | TOOL-01 | consolidate in-app + offline discovery — parked |
| v2.1 | GLOBAL-01 | file-independent suggestions — parked |
| v2.1 | DISM-01 | persistent dismissal of noisy suggestions — parked |
| v2.2 | TR categorization | regex-discovery + seed-patterns post-import — deferred |
| operator | R038/R039/R041 | live Vercel/Supabase/R2 deploy operator-pending |
| backlog | R029 | partial categorization revalidation coverage |

## Session Continuity

**Resume file:** None

**Stopped at:** Completed 61-02-PLAN.md

Last session: 2026-07-01T09:41:27.043Z

**Next:** Plan Phase 61 (`/gsd-plan-phase 61`).

## Operator Next Steps

- No migration expected for v2.4 (ADR 0016 requires no schema change — the synthetic-hash mechanism and columns already exist). Confirm during planning; if a migration is introduced, apply the standard order `yarn db:migrate → yarn db:seed → yarn db:seed-extras → yarn db:seed-patterns`.

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 58 P01 | 5min | 3 tasks | 4 files |
| Phase 58 P02 | 3min | 2 tasks | 2 files |
| Phase 58 P03 | 5min | 2 tasks | 2 files |
| Phase 59 P01 | 2min | 2 tasks | 2 files |
| Phase 59 P02 | 13min | 5 tasks (TDD RED+GREEN x2 + action) | 5 files |
| Phase 59 P03 | 8min | 3 tasks | 3 files |
| Phase 59 P04 | 2min | 2 tasks | 2 files |
| Phase 61 P01 | 6min | 3 tasks | 5 files |
| Phase 61 P02 | 90min | 3 tasks | 5 files |
