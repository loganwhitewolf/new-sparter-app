---
gsd_state_version: 1.0
milestone: v2.5
milestone_name: Detail Pages
current_phase: 62
current_phase_name: transaction-edit-core
status: "v2.5 opened — Phases 62–64 planned, ready for /gsd-plan-phase 62"
stopped_at: Milestone v2.5 requirements + roadmap written
last_updated: "2026-07-05T00:00:00.000Z"
last_activity: 2026-07-05 - Opened milestone v2.5 (Detail Pages); requirements DET-01..09, phases 62-64
last_activity_desc: Grill locked - hashes/description immutable, auto-reconcile derived aggregates, pair-guard blocks, route pages; branch gsd/v2.5-detail-pages
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-01)

**Core value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending.
**Current focus:** v2.5 — Detail Pages, Phase 62 (transaction-edit-core)

## Current Position

Phase: v2.5 Phase 62 — transaction-edit-core (not started)
Plan: —
Status: Milestone v2.5 opened; requirements + roadmap written on branch `gsd/v2.5-detail-pages`
Last activity: 2026-07-05 — grill session locked the edit-domain contract

## Roadmap (v2.5 — Phases 62–64)

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 62 | transaction-edit-core | DET-01, DET-02, DET-03, DET-04 | Not started |
| 63 | detail-pages-tx-expense | DET-05, DET-06, DET-07 | Not started |
| 64 | file-detail-and-navigation | DET-08, DET-09 | Not started |

**Coverage:** 9/9 DET requirements mapped across Phases 62–64. Edit-domain contract locked (grill 2026-07-05): hashes/description immutable, auto-reconcile, pair-guard blocks, route pages.

## Accumulated Context

### Decisions

**v2.5 milestone decisions (locked in grill 2026-07-05):**

- **Immutability boundary.** `transactionHash`, `descriptionHash`, and
  `transaction.description` are never editable. Description is the raw bank key
  (sha256 → descriptionHash, Tier 2); `customTitle` is the rename mechanism.
  Frozen `transactionHash` means an edited transaction still dedups on re-import.
- **Editable sets.** Transaction: `amount` (Decimal.js, signed), `occurredAt`,
  `customTitle`, category via linked expense. Expense: `title`, `notes`,
  `subCategoryId`; derived aggregates (`totalAmount`, count, first/last dates)
  are NEVER directly writable — they reconcile automatically after transaction
  edits, in the same `db.transaction`. File: `displayName` only.
- **Pair guard.** An amount edit that breaks a refund pair's opposite-sign/nonzero
  invariant is rejected with an Italian message ("Scollega prima il rimborso") —
  never auto-unlinked.
- **Route pages** (`/transactions/[id]`, `/expenses/[id]`, `/import/[fileId]`),
  pencil-inline editing, SubcategoryPicker reuse, cerca-su-internet on tx+expense
  pages; the expense "dettagli"+"modifica" dialogs collapse into the page.

---

**v2.4 historical decisions (ADR 0016 — shipped, kept for reference):**

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

## Quick Tasks Completed

| # | Description | Date | Commit |
|---|-------------|------|--------|
| 260609-fru | Dashboard overview prototype fixes | 2026-06-09 | 5ebd690 |
| 260609-k2d | Transactions nature + in/out/transfer filters; 7 UI fixes | 2026-06-09 | cdc5997 |
| 260609-lcp | Cascading filters (type→nature, category→subcat); amount sign strip | 2026-06-09 | ffd4fc3 |
| 260615-dtm | Bank-agnostic regex-discovery tool | 2026-06-15 | d737b8e |
| 260615-n3t | Onboarding step-4 fix | 2026-06-15 | 1434308 |
| 260615-oiq | Onboarding private platform creation | 2026-06-15 | d5b590c |
| 260616-dlw | Fix transaction description sort | 2026-06-16 | c71d32e |
| 260629-gdp | Pattern suggestions back link + auto-redirect after classify | 2026-06-29 | 4673927 |
| 260629-lky | File list R2 download + expense details dialog source file | 2026-06-29 | a6d7f95 |
| 260629-m9i | Detach transaction to dedicated expense + re-import manual lock | 2026-06-29 | 90bfa69 |
| 260630-dd7 | Delete stuck analyzing imports from file table | 2026-06-30 | 60ee221 |
| 260630-dhw | CTA da categorizzare su vista Spese (pill header, rimuovi filtro toolbar) | 2026-06-30 | cc09ab3 |
| 260630-fdt | Unifica CTA step 4 onboarding — un solo pulsante verde | 2026-06-30 | 522522a |
| 260630-gbv | Rinomina import inline con matita come expenses/transazioni | 2026-06-30 | 7927bf8 |
| 260630-gy0 | Bulk categorizzazione massiva nella vista Transazioni | 2026-06-30 | a85a0ec |
| 260630-h1j | Nome file cliccabile in transazioni → filtro tabella import | 2026-06-30 | a85fb27 |
| 260630-mkf | Platform picker card grid con ricerca nel wizard import step 1 | 2026-06-30 | 380e4a4 |
| 260630-mpw | Skip analyze per formato sconosciuto, redirect a configure | 2026-06-30 | f525630 |
| 260630-opy | Ereditare campi parsing da global format version nel wizard privato | 2026-06-30 | 364b553 |
| 260701-ki4 | Generic secondaryDescriptionColumn — combine two columns as Primary — @secondary (Satispay) | 2026-07-01 | 7feb756 |
| 260701-mqh | Expand Italian supermarket regex patterns (Penny, NaturaSì, DPiù, regional GDO) | 2026-07-01 | 75bb0ef |
| 260703-l2b | Conferma cancellazione entità collegate su delete spese/transazioni | 2026-07-03 | 8209a9f |
| 260703-kzg | Import preview: view all rows + filter by valid/duplicate/error | 2026-07-03 | ecc2665 |
| 260703-gwa | Pairing a refund categorizes+isolates its expense under the spend's subcategory (decision 2); repaint refund row | 2026-07-03 | 3816800 |
| 260703-leo | Fix filtro descrizione spese/transazioni (substring + focus) | 2026-07-03 | e947a16 |

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

**Stopped at:** Milestone v2.5 requirements + roadmap written (branch `gsd/v2.5-detail-pages`)

Last session: 2026-07-05

**Next:** Plan the first phase with `/gsd-plan-phase 62`

## Operator Next Steps

- Run `yarn db:seed-patterns` to apply supermarket regex changes from quick task 260701-mqh (if still pending)
- Plan v2.5 Phase 62 with `/gsd-plan-phase 62`

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
