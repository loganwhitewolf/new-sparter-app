---
gsd_state_version: 1.0
milestone: v2.5
milestone_name: Detail Pages
current_phase: 5
status: Awaiting next milestone
stopped_at: v2.5 milestone complete, ready to plan next milestone
last_updated: "2026-07-07T06:54:03.129Z"
last_activity: 2026-07-08
last_activity_desc: Completed quick task 260708-jt6 — fixed description/title cell overflow in transactions+expenses tables
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 13
  completed_plans: 13
  percent: 100
current_phase_name: file-detail-and-navigation
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-01)

**Core value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending.
**Current focus:** v2.5 milestone complete — ready to start next milestone

## Current Position

Phase: Milestone v2.5 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-07-07 — Completed quick task 260707-fy4: persistent table filters via sessionStorage URL restore

## Roadmap (v2.5 — Phases 62–64)

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 62 | transaction-edit-core | DET-01, DET-02, DET-03, DET-04 | Complete |
| 63 | detail-pages-tx-expense | DET-05, DET-06, DET-07 | Complete |
| 64 | file-detail-and-navigation | DET-08, DET-09 | Complete |

**Coverage:** 9/9 DET requirements mapped across Phases 62–64, all shipped. Edit-domain contract locked (grill 2026-07-05): hashes/description immutable, auto-reconcile, pair-guard blocks, route pages.

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
- [Phase ?]: transaction table has no updatedAt column (schema.ts) — removed the updatedAt field from the .set() payload described in the plan/research skeleton (Rule 1 bug fix)
- [Phase ?]: Select-chain test mock made thenable so awaited .where() calls without a following .limit()/.groupBy() resolve correctly, matching Drizzle's real query builder shape
- [Phase 62]: updateExpense subCategoryId three-state contract: undefined leaves category/status untouched, null clears (status 1, no history), positive number assigns (status 3, history written) — Matches categorizeExpense semantics for DET-04 without a separate schema; consistent status/history behavior across all manual-categorization entry points
- [Phase 62]: History write failure inside updateExpense's transaction is non-fatal — Matches existing categorizeExpense/bulkCategorize behavior — consistency with the categorize flow is the DET-04 requirement itself
- [Phase 63]: getExpenseForDetail accepts userId as a parameter instead of self-calling verifySession() — The RSC page already verifies the session once and passes it down
- [Phase 63]: transactionDetailHref/expenseDetailHref are standalone functions in lib/routes.ts, not APP_ROUTES keys — Preserves the APP_ROUTES object's as-const static-string shape
- [Phase ?]: [Phase 63]: Category edit on /transactions/[id] reuses ExpenseCategorizeDialog/categorizeExpense directly instead of updateExpense — UpdateExpenseSchema requires title, categorizeExpense's narrower {id, subCategoryId} contract matches D-12's single edit-point requirement
- [Phase ?]: Expense detail page category edit reuses categorizeExpense directly (not updateExpense) — matches the 63-02 transaction-page deviation; UpdateExpenseSchema requires title, categorizeExpense's {id, subCategoryId} contract is the correct minimal action
- [Phase ?]: Expense Riepilogo card renders only fields ExpenseRow/getExpenseForDetail expose (totalAmount, transactionCount, createdAt) — no first/last transaction date field exists on the DAL row, none invented
- [Phase 63]: Table component tests (full render, not per-row extraction) require mocking next/navigation (useRouter/useSearchParams/usePathname) in addition to @/components/ui/dropdown-menu, because useToolbarSort/useTableUrl call next/navigation hooks directly — Established pattern from tests/data-table-toolbar.test.tsx; without it renderToStaticMarkup throws 'invariant expected app router to be mounted'
- [Phase 64]: importFileDetailHref is a standalone function, not added to APP_ROUTES, per the Phase 63 precedent
- [Phase 64]: getFileDetailForUser supersedes getFileForUser for the file detail page; returns platformName: null when importFormatVersionId is absent
- [Phase 64]: Expense pencil aria-label changed to 'Rinomina spesa' to avoid colliding with the pre-existing 'never renders a Modifica menu entry' guard test (Rule 1 bug fix)
- [Phase 64]: Removed the now-unused APP_ROUTES import from transaction-table.tsx once its only remaining use (?fileId= href) was replaced by importFileDetailHref
- [Phase ?]: [Phase 64]: DetailPageShell smart-back fallback triggers on window.history.length <= 1 OR cross-origin document.referrer; otherwise prefers router.back() to preserve in-app history
- [Phase ?]: [Phase 64]: Components calling useRouter and tested via renderToStaticMarkup must mock next/navigation (precedent: tests/transaction-table-menu.test.tsx) — applied to tests/detail-page-shell.test.tsx
- [Phase 64]: [Phase 64-06] Fix scoped to router.back() call site in handleBackClick's else branch only; use-table-url.ts's router.replace() writes untouched (switching to push() rejected as worse tradeoff)
- [Phase 64]: [Phase 64-06] attachPopstateRefresh is a standalone hook-free export so it is unit-testable with a plain mock object, no jsdom needed
- [Phase 64]: [Phase 64-07] CR-01 fixed via ancestor-only `.group` addition on the three detail-page title wrappers, not a rewrite of the shared pencil components — keeps the fix isolated from the already-correct table-row hover behavior
- [Phase 64]: [Phase 64-07] WR-02: hasInAppHistory(historyLength) replaces document.referrer entirely as handleBackClick's sole branch signal — referrer is fixed at hard navigation and never updated by client-side App Router transitions, so it silently and permanently disabled smart-back for any tab that ever loaded from an external link

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
| 20260622-allocation | Dashboard allocation chips (Risparmio/Investimento) filterable (reconciled 2026-07-07) | 2026-06-22 | 3d99988 |
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
| 260703-na4 | Full description tooltip: widen expense.title to text, de-truncate writes, backfill, wrapped dialog column (reconciled 2026-07-07) | 2026-07-03 | 2ffbb4d |
| 260707-fy4 | Persistent table filters via sessionStorage URL restore (bare-navigation restore layer, URL stays source of truth) | 2026-07-07 | def3f4b |
| 260707-fast | Fix pre-existing test failures (expense-actions mock, import-table stale assertion, overview fixtures, expense title 500) + language-check quoted-string false positives | 2026-07-07 | c9dc08a |
| 260708-jt6 | Fix description/title cell overflow in transactions+expenses tables (missing min-w-0 / table-fixed broke CSS truncate chain) | 2026-07-08 | 9d1ad08 |

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
| debug | 64-smart-back-filter-loss | resolved — fix shipped in 64-06/64-07, UAT 2/2 passed; status reconciled 2026-07-07 |
| quick_task | allocation-filter-dashboard (20260622) | reconciled 2026-07-07 — executed 2026-06-22 (3d99988), SUMMARY was missing |
| quick_task | 260615-dtm-reusable-regex-discovery-tool-bank-agnos | reconciled 2026-07-07 — complete (d737b8e), SUMMARY lacked status field |
| quick_task | 260615-n3t-fix-recurring-onboarding-catalogazione-s | reconciled 2026-07-07 — complete (1434308), SUMMARY lacked status field |
| quick_task | 260703-na4-full-description-tooltip-widen-expense-t | reconciled 2026-07-07 — was fully executed 2026-07-03, SUMMARY.md was missing |

## Session Continuity

**Resume file:** None

**Stopped at:** v2.5 milestone complete, ready to plan next milestone

Last session: 2026-07-06T22:45:00.000Z

**Next:** `/gsd-complete-milestone v2.5` to archive, then `/gsd-new-milestone` to start the next cycle

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
- On the live DB (if not yet applied): `yarn db:migrate && yarn db:seed-extras` — migration 0025 (expense.title → text) + backfill-truncated-expense-titles step from quick task 260703-na4

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
| Phase 62 P01 | 5min | 2 tasks | 4 files |
| Phase 62 P02 | 3min | 2 tasks | 2 files |
| Phase 63 P01 | 15min | 2 tasks | 7 files |
| Phase 63 P02 | 12min | 2 tasks | 5 files |
| Phase 63 P03 | 12min | 2 tasks | 4 files |
| Phase 63 P04 | 6min | 2 tasks | 4 files |
| Phase 64 P01 | 5min | 3 tasks | 6 files |
| Phase 64 P02 | 8min | 2 tasks | 4 files |
| Phase 64 P04 | 10min | 2 tasks | 9 files |
| Phase 64 P05 | 8min | 1 tasks | 2 files |
| Phase 64 P06 | 5min | 1 tasks | 2 files |
| Phase 64 P07 | 12min | 2 tasks | 4 files |
