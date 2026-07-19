---
gsd_state_version: 1.0
milestone: v2.6
milestone_name: Expenses & Transactions Refinement
current_phase: 66
current_phase_name: expense-group-lifecycle
status: executing
stopped_at: Completed 66-03-PLAN.md
last_updated: "2026-07-19T20:33:51.311Z"
last_activity: 2026-07-19
last_activity_desc: Phase 66 execution started
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 11
  completed_plans: 9
  percent: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-18)

**Core value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending.
**Current focus:** Phase 66 — expense-group-lifecycle

## Current Position

Phase: 66 (expense-group-lifecycle) — EXECUTING
Plan: 4 of 5
Status: Ready to execute
Last activity: 2026-07-19 — Phase 66 execution started

Progress: [████████░░] 82%

## Roadmap (v2.6 — Phases 65-68)

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 65 | expense-group-merge-and-view | GRP-01, GRP-02, GRP-03, GRP-04, GRP-08 | Not started |
| 66 | expense-group-lifecycle | GRP-05, GRP-06, GRP-07, GRP-09 | Not started |
| 67 | tags-foundation-and-assignment | TAG-01, TAG-02, TAG-03, TAG-06 | Not started |
| 68 | tags-dashboard-and-navigation | TAG-04, TAG-05, NAV-01 | Not started |

**Coverage:** 16/16 v2.6 requirements mapped across Phases 65-68, none orphaned. Expense Group
model LOCKED in `docs/adr/0017-expense-group-over-physical-merge.md` (grill 2026-07-18) — no
discovery to redo: grouping entity above intact Expenses, same-subcategory gate, group is the
categorization unit, no import-time auto-merge, read-time totals never persisted. Transaction
Tags design LOCKED in `.planning/REQUIREMENTS.md` notes (source: Obsidian "sparter-tag-transazioni",
2026-07-06) — tag = filter, never breakdown; curated entity, never deleted. Cross-cutting
invariant across both features (GRP-09 testable requirement): neither grouping nor tagging may
change dashboard totals or category breakdowns.

## Roadmap (v2.5 — Phases 62-64, shipped)

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 62 | transaction-edit-core | DET-01, DET-02, DET-03, DET-04 | Complete |
| 63 | detail-pages-tx-expense | DET-05, DET-06, DET-07 | Complete |
| 64 | file-detail-and-navigation | DET-08, DET-09 | Complete |

**Coverage:** 9/9 DET requirements mapped across Phases 62-64, all shipped. Edit-domain contract locked (grill 2026-07-05): hashes/description immutable, auto-reconcile, pair-guard blocks, route pages.

## Accumulated Context

### Decisions

**v2.6 milestone contract (locked at roadmap creation, 2026-07-18):**

- **Expense Group model** — ADR 0017: grouping entity above intact Expenses (option A);
  members keep `descriptionHash`, aggregates, Tier 2 history unchanged; group totals computed
  at read time, never persisted. Merge requires all members share one non-null subcategory
  (uncategorized selections are categorized explicitly in the merge dialog first — merge itself
  never assigns categories). Group is the categorization unit — recategorizing the group
  propagates to all members. No import-time auto-merge/similarity heuristics (deferred: GRP-F01).
  Standalone Expenses are not special-cased and may join a group.

- **Transaction Tags design** — curated entity (name + optional date range), never deleted
  (archive only); N tags per transaction; bulk-assign only (no per-transaction single-tag UI
  requirement); tag = filter axis, never a breakdown dimension (multi-tag would double-count).
  Date-range suggestion fires on tag creation and on every subsequent import. TAG-06 (Viaggi
  audit) restricts Vacanze/Viaggi subcategories to intrinsically-travel spend so trip-tagging
  has a clean categorization substrate underneath it.

- **Cross-cutting invariant** — neither Expense Group nor Tag work may change dashboard values:
  structural for GRP (pure regrouping, read-time totals — GRP-09 is a testable requirement); via
  the "tag = filter, never breakdown" rule for TAG.

- Deferred out of this milestone: GRP-F01 (similarity hints at import), TAG-F01 (AI tagging
  pass), TAG-F02 (person/"for whom" tag family) — see REQUIREMENTS.md Future Requirements.

---

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
- [Phase ?]: expenseGroupMembership enforces at most one group per expense via a standalone unique(expenseId), not just the (groupId, expenseId) pair unique
- [Phase ?]: MergeExpensesSchema has no category field at all — merge is pure regrouping; categorization happens via bulkCategorize separately (D-02)
- [Phase ?]: mergeExpenses never writes expense.subCategoryId/status — pure regrouping delegated to createExpenseGroup (D-02, verified via grep)
- [Phase ?]: categorizeExpense guards against grouped members via a pre-transaction expenseGroupMembership check (D-03 defense-in-depth)
- [Phase ?]: 65-03: getExpenses composes group rows read-time, collapse-then-paginate in JS (never SQL LIMIT/OFFSET pre-collapse) to guarantee a group is never split across pagination pages
- [Phase ?]: MergeExpensesDialog's step logic exported as pure/async functions (isGroupTitleValid, nextStepAfterTitle, getUncategorizedIds, runCategorizeStep, runMergeStep) for direct unit testing, since the repo's Vitest setup has no jsdom/@testing-library for DOM-interaction simulation
- [Phase ?]: MergeExpensesDialog always calls mergeExpenses with the FULL original selectedExpenses id set, never just the ids categorized during the categorize step (GRP-02)
- [Phase ?]: [Phase 65-06] transaction-table.tsx categorize-dialog-prefill call sites (setCategorizeTarget title: expenseTitle ?? rowLabel) left untouched — they only fire for uncategorized expenses, which can never be grouped (a group requires a shared non-null subcategory)
- [Phase ?]: [Phase 65-06] Expense detail 'Parte di' links to expenseGroupDetailHref; transaction detail 'Spesa collegata' link target stays expenseDetailHref unchanged — cross-reference chain is transaction -> member's own expense page -> that page's 'Parte di' link to the group, never a direct transaction-to-group link
- [Phase ?]: Phase 66-01: removeExpenseFromGroup auto-dissolve threshold checked as memberCount===2 BEFORE delete (not post-delete count) to keep the read-then-write in one DbOrTx call and close the TOCTOU gap (T-66-03)
- [Phase ?]: Phase 66-01: shared-subcategory validation (D-05) deliberately NOT implemented in addExpensesToGroup — stays in Plan 66-02's action layer, which already has the group's subCategoryId in scope
- [Phase ?]: Phase 66-02: categorizeExpenseGroup writes inline (mirrors bulkCategorize) rather than delegating to a service function — no other caller needs whole-group recategorize logic separately
- [Phase ?]: Phase 66-02: removeExpenseFromGroupAction/dissolveExpenseGroupAction each open their own db.transaction around the single Plan 66-01 service call to guarantee the auto-dissolve TOCTOU count-then-delete (T-66-03) always runs inside a transaction
- [Phase ?]: Phase 66-03: snapshotBreakdown hand-computes the GROUP BY (categoryId, subCategoryId) step mirroring getCategoriesBreakdown, then delegates to the REAL buildBreakdownData export — only the SQL aggregation itself is faked
- [Phase ?]: Phase 66-03: CAT_A_SUB/CAT_C_SUB deliberately share one parent category (Casa) so Assertion B proves a subcategory-level movement, not a trivially-satisfied category-level one

### Deferred (per ADR 0016 — not built now)

- **SUBS-VIEW** — normalized "Subscriptions" view showing net cost per covered month for shared/recurring expenses. The main entrate/uscite dashboard stays cash-basis; the monthly chart is not amortized.
- **SPLIT-01** — split a single inflow across multiple subcategories (e.g. €50 subscription + €20 pizza in one transfer). The one-transaction → one-subcategory limit holds.
- A "money received from a person" (counterparty) category — rejected by ADR 0016.

### Codebase facts relevant to the milestone

- **Expense Group (Phases 65-66)** — no existing schema entity; requires a new grouping table
  (group + membership) via `drizzle-kit generate` + `scripts/migrate.ts`. No migration touches
  existing expense/transaction rows (ADR 0017 consequence). Group totals must be computed at
  read time in the DAL, never persisted/cached on the group row.

- **Transaction Tags (Phases 67-68)** — no existing schema entity; new curated tag table +
  transaction-tag join table (N:M). TAG-06's regex/categorizer updates for Vacanze/Viaggi follow
  the existing `scripts/seed-patterns-data.ts` full-replace model (`yarn db:seed-patterns`) — new
  or corrected patterns go there, not in `seed-data.ts`/`seed-extras.ts`.

- `lib/services/transaction-detach.ts` — `detachTransactionToDedicatedExpense({ userId, transactionId, title, subCategoryId })` (shipped v2.4/ADR 0016) is the precedent for in-place re-hash mechanics; ADR 0017 §5 notes a Standalone Expense may join a group without special-casing.
- `SubcategoryPicker` (vaul bottom sheet, single `subCategoryId` output, adopted across all 7 selection surfaces) is the intended control for any new subcategory-capture UI in the merge dialog (GRP-02) — reuse, do not build a new picker (v1.13 / ADR 0008).
- Dashboard aggregation sites (8, per v2.0 `isNotSecondary()`/`effectiveAmount()` netting) are the surfaces GRP-09's invariant test and TAG-04's global filter must both leave structurally unchanged / correctly narrow.

### Blockers/Concerns

None. Both feature models (Expense Group via ADR 0017, Transaction Tags via the Obsidian design note) are locked — no discovery to redo before planning Phase 65.

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
| 260708-jt6 | Fix description/title cell overflow + edge-to-edge truncation + narrower amount column in transactions+expenses tables (min-w-0/table-fixed, inline span/link, flex-1, w-32→w-28) | 2026-07-08 | 1cd879d |
| 260709-bdk | Re-import unlock: /api/files/initiate returns 409 only for completed imports; stale (failed/stuck) rows deleted on re-upload so onboarding + standard import can retry | 2026-07-09 | da24841 |
| 260709-dq2 | Trade Republic CSV import format (seed-data v2, coexists with PDF v1 via header detection; datetime/description/amount mapping, quantity-strip aggregation). Prod version-collision fixed via seed-extras step ensure-trade-republic-csv-global-format (MAX+1) | 2026-07-09 | 8d14b95 |
| 260709-gfz | Persist dashboard Overview filters per-tab (sessionStorage): chart chips (chart-local, excluded-keys) restored post-hydration + year restored on bare mount via router.replace. Verification gap: live browser round-trip not driven (node-only test env, no jsdom) | 2026-07-09 | 8c8ed8a |
| 260709-kp1 | Bilancio KPI structural-aware reading (B+): headline stays totalIn−totalOut; warn "Senza le entrate straordinarie saresti a −X €" when positive only thanks to income_extraordinary. New totalInRecurring aggregate + OverviewData.structuralBalance. Tasso risparmio unchanged; freelance profile flagged as future work | 2026-07-09 | 2a2094d |
| 260709-lan | Entrate KPI card composition breakdown: Ricorrenti + Straordinarie rows under the total (ReadingKpiCard breakdown slot; extraordinary derived totalIn−recurring via Decimal.js) | 2026-07-09 | 91dbd3e |
| 260709-leg | Bilancio KPI card structural breakdown row: "Ricorrente −X €" under the total headline (reuses structuralBalance + breakdown slot; parity with Entrate card) | 2026-07-09 | 20e7021 |
| 260709-lj5 | Tasso risparmio card recurring-only rate row (structuralSavingsRate, same formula/guards). Label locked: Solo ricorrenti (review 2026-07-09) | 2026-07-09 | f820be8 |
| 260709-lkw | Uscite card nature breakdown: Essenziali/Discrezionali/Debiti rows (per-nature OUT sums in shared aggregate, outByNature). Labels locked: NATURE_LABELS chip lexicon (review 2026-07-09) | 2026-07-09 | c671da1 |

## Deferred Items

Items acknowledged and postponed:

| Category | Item | Status |
|----------|------|--------|
| v2.6 | GRP-F01 (similarity hints at import time) | deferred — ADR 0017 |
| v2.6 | TAG-F01 (AI tagging pass) | deferred — post-stabilization |
| v2.6 | TAG-F02 (person/"for whom" tag family) | deferred — not a promoted product concept |
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

**Stopped at:** Completed 66-03-PLAN.md

Last session: 2026-07-19T20:33:51.305Z

**Next:** `/gsd-plan-phase 65` to plan the Expense Group merge-and-view phase

## Operator Next Steps

- On the live DB (if not yet applied): `yarn db:migrate && yarn db:seed-extras` — migration 0025 (expense.title → text) + backfill-truncated-expense-titles step from quick task 260703-na4
- Phases 65-66 (Expense Group) will require a new `drizzle-kit generate` migration once planned — no existing schema entity for group/membership

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
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 65 P01 | 12min | 3 tasks | 5 files |
| Phase 65 P02 | 12min | 3 tasks | 5 files |
| Phase 65 P03 | 20min | 3 tasks | 9 files |
| Phase 65 P04 | 9min | 3 tasks | 6 files |
| Phase 65 P05 | 2min | 3 tasks | 4 files |
| Phase 65 P06 | 15min | 3 tasks | 6 files |
| Phase 66 P01 | 5min | 3 tasks | 3 files |
| Phase 66 P02 | 3min | 3 tasks | 2 files |
| Phase 66 P03 | 15min | 1 tasks | 1 files |
