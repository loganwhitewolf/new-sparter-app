---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Categories Year View
current_phase: 84
current_phase_name: category-detail-and-cleanup
status: executing
stopped_at: Completed 84-03-PLAN.md
last_updated: "2026-08-03T13:04:42.140Z"
last_activity: 2026-08-03
last_activity_desc: Phase 84 execution started
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 13
  completed_plans: 12
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-30)

**Core value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending.
**Current focus:** Phase 84 — category-detail-and-cleanup

## Current Position

Phase: 84 (category-detail-and-cleanup) — EXECUTING
Plan: 4 of 4
Status: Ready to execute
Branch: `gsd/v3.0-categories-year-view` (synced with `origin/main` @ fe8273f9 — PR #65)
Last activity: 2026-08-03 — Phase 84 execution started

Preceding activity on `main` (merged into this branch): 2026-07-30 — completed quick task
260730-n2z (Amort UX: Visualizza ammortamento, Tutti=all, vendita/rimborso copy) and quick task
260730-m2x (amortization reimbursement linking / re-amortizability), shipped as PR #65.

## Roadmap (v3.0 — Phases 82-84)

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 82 | number-engine-and-regression-gate | PACE-01, PACE-02, PACE-03, PACE-04, PACE-05, PACE-06, RETIRE-03, RETIRE-04, RETIRE-05 | Not started |
| 83 | categories-list | CLIST-01, CLIST-02, CLIST-03, CLIST-04, CLIST-05, CLIST-06, CLIST-07 | Not started |
| 84 | category-detail-and-cleanup | CDET-01, CDET-02, CDET-03, CDET-04, CDET-05, CDET-06, CDET-07, RETIRE-01, RETIRE-02 | Not started |

**Coverage:** 25/25 v3.0 requirements mapped across Phases 82-84, none orphaned. Design **LOCKED
in ADR 0020** (amends LENS-01 of ADR 0019) + `.planning/dashboard-categories-DECISIONS.md` (19
decisions D1-D19): the Categories list reads a whole year + direction with no month selection; the
detail page is a 12-month table (prototype variant A, chosen over a chart because a chart cannot
render "€180 in meno" inside a 60px bar); the pace is the average of the year's Covered Months
(months with zero transactions excluded from the denominator, months with zero category movement
counted as €0); the current month is worth `max(spent so far, pace)`; the period total is always
the sum of the displayed series; comparisons are stored `current − previous` and rendered as
magnitude + word, never a sign; direction coverage widens to three (`direction.hidden = false`
replaces `includedInTotals`); the cassa/competenza lens is confined to Overview (Categories is
lens-invariant — amortization is a property of a transaction, not of a category's spending); and
the Deviation/Baseline/Noise-Threshold/Preset vocabulary is retired (not re-anchored), replaced by
the month-over-month delta, the homologous-window year comparison, and per-subcategory
contribution to the difference.

**Phase sequencing rationale:** mirrors the v2.8 netting gate / v2.9 LENS-03 pattern — the number
engine and the `direction.hidden` predicate change touch the same shared dashboard aggregation
infrastructure Overview and Tags read, so Phase 82 builds the engine, confines the lens, drops the
dead `tag` param, and proves Overview/Tags totals byte-identical **before** any Categories UI
ships. Phase 83 rewrites the list (the shallower surface, and the entry point into the detail
page per CLIST-07). Phase 84 rewrites the detail page (the deeper 12-month-table surface) and,
being the last remaining caller of the Deviation/Preset machinery, closes the milestone by
retiring it with no dead references left — RETIRE-01/02 could not complete correctly any earlier,
since both Categories pages read that machinery today (per ADR 0020: "referenced only by the two
Categories pages"). This is a deliberate deviation from the orchestrator's suggested shape (which
grouped all RETIRE-* into Phase 82): RETIRE-01/02 are moved to Phase 84 because their "no dead
references left" / "no regression on any surface that used its helpers" acceptance criteria can
only be verified once both consuming pages have migrated off the old machinery. RETIRE-03/04/05,
which are either independent of the page rewrite or explicitly required to gate it, stay in
Phase 82.

**Left OPEN for the per-phase discuss/plan stage** (details, not architecture — do NOT resolve in
the roadmap, per `.planning/dashboard-categories-DECISIONS.md` "Deliberately left open"):

1. **Previous-year coverage threshold** for gating the total difference (proposed: ≥6 Covered
   Months) → Phase 84.

2. **Copy set and colour mapping per direction**, `allocation` included → Phase 83/84.
3. **Name of the "annual estimate vs closed year" comparison** — not *delta* (reserved for KPI
   period-over-period), not *deviation* (retired) → Phase 84.

4. **Visual treatment of the three month states** (fact / current hybrid / estimate) and of
   uncovered months → Phase 84.

5. **URL shape of the detail window** (start month + length) → Phase 84.
6. **Whether the tab nav preserves `?lens=` invisibly** across Categories navigation (recommended:
   yes) → Phase 82/83.

7. **Fate of the detail page's current `topTransactions` block** → Phase 84.
8. **Whether the list also offers an acceleration ordering** (projection ÷ total) → Phase 83.

**Out of scope** (no phases): month/window selection on the Categories list, the competenza lens on
Categories, a `source` discriminator on the lens views, predictive forecasting, per-day pro-rating
of the current month, re-anchoring the Deviation instead of retiring it, slow-drift detection
(CDET-F01, accepted loss of D15), acceleration ordering as a shipped feature (CLIST-F01, deferred)
— see REQUIREMENTS.md Future Requirements / Out of Scope.

**Resolved during planning (2026-07-30), no longer open:** item 1 above (previous-year coverage
threshold) landed in Phase 82 rather than 84 — the engine owns it, exported as
`PREVIOUS_YEAR_TOTAL_DIFFERENCE_MIN_COVERED_MONTHS = 6` for Phases 83/84 to consume. Item 6
(tab nav preserving `?lens=` invisibly) resolved **yes** as Phase 82 decision D-13.

## Roadmap (v2.9 — Phases 77-81) — SHIPPED 2026-07-29

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 77 | amortization-schema-and-activation | AMORT-01, AMORT-02, AMORT-03, LENS-03 | Complete |
| 78 | plan-lifecycle-and-reconciliation | AMORT-04, AMORT-05, AMORT-06, AMORT-07 | Complete |
| 79 | amortizations-registry | REG-01, REG-02, REG-03 | Complete |
| 80 | dashboard-accrual-lens | LENS-01, LENS-02, LENS-04, LENS-05 | Complete |
| 81 | inline-net-display-for-paired-transactions | Phase 78 UAT closure (no new REQ-ID) | Complete |

**Coverage:** 15/15 v2.9 requirements mapped across Phases 77-80, none orphaned. Model
**LOCKED in ADR 0019**: amortization spreads a one-off outflow **Transaction** (never an Expense or
Expense Group) over N uniform monthly instalments starting from the purchase month, forcing a
detach into a Standalone Expense (reuses ADR 0016 §2-4 / `detachTransactionToDedicatedExpense`).
Instalments are materialised in the database. The dashboard gains a global cassa/competenza switch;
the seam is **one swappable `ledger_entry` row source per lens** — cash = transactions with
`effectiveAmount()`, accrual = non-amortized transactions `UNION ALL` instalment rows — not a `lens`
parameter threaded through the ten aggregation functions. Resolving the amount inside the row source
is what makes the reimbursement double-netting trap (an instalment's amount already carries any
re-spread from §8; `effectiveAmount()` must never apply to it a second time) structurally
impossible. Realization (selling or scrapping an amortized asset) reuses the v2.8 reimbursement
mechanism, netting against the **closure month** as an explicit exception to Mondo Netto's
cost-month netting. Navigation (`getYearsWithData`/`getMonthsWithData`) must become lens-aware,
since instalments can create a year with no transaction in it.

**Phase sequencing rationale:** the schema+seam is the highest-risk piece (the survey at
`.scratch/amortization/assets/01-lens-seam.md` confirms the same 10 aggregation sites v2.8 proved
byte-identical), so it ships first with the cash-lens regression gate **before any lifecycle or lens
UI** (77); plan resolution — closure, realization, reimbursement re-spread, edit guard — completes
the backend model next (78); the dedicated registry surfaces it (79); the dashboard accrual lens
ships last, once the instalment source is stable (80). Incidental cleanup folded into Phase 77:
extract the duplicated `dateScopedTransactions()`/`expenseStatusIncludedInDashboardTotals()` out of
`dashboard.ts` and `overview.ts`.

**Left OPEN for the per-phase discuss/plan stage** (details, not architecture — do NOT resolve in
the roadmap):

1. **Reimbursement exceeding residual** — what a reimbursement larger than a plan's residual does
   (clamp, allow negative, or block) → Phase 78.

2. **Amortized-transaction edit invariant** — the exact write-path rule for amount/date/subcategory
   edits after a plan exists (model: v2.5 pair-guard, v2.8 D-02) → Phase 78.

3. **Lens durability** — whether the accrual lens is a durable user preference or a URL/session
   view, and its behavior across the four dashboard sub-routes → Phase 80.

4. **Lens on tag surfaces** — whether `/dashboard/tags` and `/tags/[id]` are lens-invariant (all-time
   totals make the spread a no-op) or follow the switch → Phase 80.

5. **Deviations/movers after month 1** — what a spread cost's invisibility to deviation does to the
   movers/deviations widgets, and whether a plan's closure spike should fire or be suppressed →
   Phase 80.

**Out of scope** (no phases): configurable amortization day in settings, amortizing `in`/
`allocation`/`transfer`, amortizing an Expense or Expense Group, non-uniform plans (variable
instalments/depreciation curves), automatic/threshold-based activation, a debt amortization
schedule (principal/interest split), asset depreciation/net-worth tracking.

## Roadmap (v2.8 — Phases 73-76)

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 73 | reimbursement-schema-and-netting | RMB-01, RMB-03, RMB-04, RMB-05 | Planned (4 plans) |
| 74 | group-anchor-and-reconciliation | RMB-02, RMB-06, RMB-09 | Not started |
| 75 | linking-surfaces-and-lifecycle | RMB-07, RMB-08 | Not started |
| 76 | reimbursements-section | RMB-10, RMB-11 | Not started |

**Coverage:** 11/11 v2.8 RMB requirements mapped across Phases 73-76, none orphaned. Model
**LOCKED in ADR 0018** (supersedes ADR 0016 §1): a reimbursement is one explicit **outflow → N
inflows** link — one mechanism, the 1:1 `transaction_pair` generalized to 1:N (the old pair is the
N=1 case, migrated and subsumed, not kept alongside). Invariants: the anchor is **always an
outflow** (an Expense or an Expense Group); refunds are inflows; a positive-anchored reimbursement
is rejected. Netting is **Mondo Netto** — `effectiveAmount`/`isNotSecondary` generalize from the
single secondary to the linked-refund set; the net lands in the **cost's month**, each refund is
excluded from its own month, and dashboard entrate/uscite/per-category totals stay correct at every
aggregation site (the highest-risk piece — regression-gated in Phase 73). Residual =
`Σoutflow + Σ(refunds so far)`, surfaced while negative. Dedicated `/reimbursements` section +
per-reimbursement page reuse the `/tags/[id]` and Expense Group RSC scaffolding.

**Phase sequencing rationale:** the schema+migration+netting backend is the risky core, so it is
an early tracer phase (73) with a dashboard-totals regression gate **before any UI**; the Expense
Group anchor + residual + generalized edit-guard complete the model (74); the linking surfaces
(Expense detail page + Expense Group) come next (75); the dedicated section ships last (76).

**Left OPEN for the per-phase discuss/plan stage** (details, not architecture — do NOT resolve in
the roadmap):

1. **Refund→subcategory attribution** when the anchor spans multiple subcategories — invisible on
   top-line entrate/uscite, matters only for the per-category breakdown (surfaces with a Group
   anchor → Phase 74).

2. **Multi-month anchor handling** — constrain an anchor to one netting-month or attribute
   per-transaction (holiday confirmed "single-period") → Phase 73.

3. **Verifying per-transaction `effectiveAmount` attribution** when an Expense anchor has multiple
   transactions → Phase 73.

**Out of scope** (no phases): subscription temporal amortization (RMB-F1 — projection/fan-out, a
focused later milestone), inflow-anchored reimbursements (invariant RMB-03), one-inflow fan-out.

## Roadmap (v2.7 — Phases 69-70)

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 69 | tag-dedicated-page | TAG-06, TAG-07, TAG-08, TAG-09, TAG-10, TAG-11, TAG-12 | In progress (2/3 plans) |
| 70 | dashboard-tag-filter-removal | TAG-13 | Not started |

**Coverage:** 8/8 v2.7 requirements mapped across Phases 69-70, none orphaned. Model LOCKED
(2026-07-22): tags are event-shaped; the canonical per-tag view is all-time (every transaction
carrying the tag, regardless of calendar) — `dateRange` is a descriptive label, not a filter.
Single numeric source `getTagDetail`/`getTagTotals` already exists in the branch base (quick task
260722-ked absorbed); only the per-category breakdown query is new. Phase 69 builds the dedicated
Variant A page (header + 3 KPI + included count + per-category breakdown bars + compact tx list,
edit/archive in place, entry from /tags and /dashboard/tags); Phase 70 removes the period-scoped
`?tag=` dashboard filter and all its wiring. No discovery to redo — prototype Variant A won on
branch `proto/tag-view`.

## Roadmap (v2.6 — Phases 65-68, shipped 2026-07-22, tag v2.6)

Expense Group (ADR 0017) + Transaction Tags + dashboard global tag filter and
month→filtered-transactions navigation. 16/16 requirements, audit passed 16/16. Archived to
`.planning/milestones/v2.6-ROADMAP.md`.

## Roadmap (v2.5 — Phases 62-64, shipped)

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 62 | transaction-edit-core | DET-01, DET-02, DET-03, DET-04 | Complete |
| 63 | detail-pages-tx-expense | DET-05, DET-06, DET-07 | Complete |
| 64 | file-detail-and-navigation | DET-08, DET-09 | Complete |

**Coverage:** 9/9 DET requirements mapped across Phases 62-64, all shipped. Edit-domain contract locked (grill 2026-07-05): hashes/description immutable, auto-reconcile, pair-guard blocks, route pages.

## Accumulated Context

### Roadmap Evolution

- v3.0 roadmap created (2026-07-30): 3 phases (82-84) derived from 25 v3.0 requirements — number
  engine + regression gate (82), categories list (83), category detail + retirement cleanup (84).
  Deviated from the suggested shape by moving RETIRE-01/02 (Deviation/Preset code removal) from
  Phase 82 to Phase 84 — both are used only by the two Categories pages per ADR 0020, so removal
  cannot be proven dead-reference-free until both pages are rewritten off them. RETIRE-03/04/05
  stayed in Phase 82 (independent of the page rewrite, or an explicit pre-UI gate).

- Phase 81 added (2026-07-29): Inline net display for paired transactions — v2.9 UAT closure. Net
  + struck-through gross on all paired anchors (amortization-sale + v2.8 reimbursements),
  "riduzione di …" badge on the counterpart row. Presentational only, netting unchanged.
  Decisions locked in memory `project_paired_tx_inline_net_display`.

### Decisions

**v3.0 milestone contract (locked at roadmap creation, 2026-07-30):**

- **Categories is lens-invariant** — always cassa; the cassa/competenza switch is confined to
  Overview (ADR 0020, amends LENS-01 of ADR 0019).

- **Pace = average of Covered Months of the selected year**, never the window — a window can
  legitimately contain zero Covered Months.

- **Coverage is two-level**: a month with zero transactions is excluded from every denominator; a
  Covered Month with zero category movement counts as €0.

- **Current month = `max(spent so far, pace)`** — never below an observed fact, never a per-day
  pro-rate.

- **Period total = sum of the displayed series** — no independent projection formula.
- **Signs live in the data (`current − previous`), words live in the UI** — never a sign glyph;
  colour judgement resolved per direction, centrally.

- **Direction coverage widens to three** — `direction.hidden = false` replaces
  `direction.includedInTotals` as the Categories predicate, surfacing Accantonamenti.

- **Detail page is a 12-month table (prototype variant A)** — locked over a chart, which cannot
  render "€180 in meno" inside a bar.

- **Deviation/Baseline/Noise Threshold/Preset are retired, not re-anchored** — replaced by
  month-over-month delta + homologous-window year comparison + per-subcategory contribution.

**v2.9 milestone contract (locked at roadmap creation, 2026-07-27):**

- **Unit of amortization is the single Transaction** — never an Expense or Expense Group (ADR 0019
  §1). Amortizing forces a detach into a Standalone Expense (reuses ADR 0016 §2-4).

- **Outflows only** for v2.9 — `in`/`allocation`/`transfer` amortization deferred.
- **Uniform plan from the purchase month** — rounding remainder on the first instalment, each
  instalment on the purchase's calendar day clamped to month end.

- **Instalments are materialised** in the database (not computed on read) to keep dashboard reads
  cheap.

- **Seam: one swappable `ledger_entry` row source per lens**, not a `lens` parameter threaded
  through the ten aggregation functions — resolving the amount inside the row source is what
  structurally prevents the reimbursement double-netting trap.

- **Realization reuses the v2.8 reimbursement mechanism**, netting against the closure month (an
  explicit exception to Mondo Netto's cost-month netting); the system never writes a synthetic
  transaction.

- **Activation is always manual** — no automatic or threshold-based suggestion.

**v2.7 milestone contract (locked at roadmap creation, 2026-07-22):**

- **Tags are event-shaped; the canonical per-tag view is all-time.** Every transaction carrying
  the tag is included regardless of the calendar; `dateRange` is a descriptive label, never a
  hard filter on the transaction set (TAG-06). Per-tag analysis lives only in the dedicated page.

- **Single numeric source.** The dedicated page's three totals (Entrate / Uscite / Valore finale,
  signed net) and included-transaction count come from `getTagDetail` / `getTagTotals` — the same
  netting/exclusions as the dashboard — so the page reconciles with `/dashboard/tags` (TAG-07).
  These already exist in the branch base (quick task 260722-ked absorbed); only the per-category
  breakdown query is new.

- **Layout: Variant A ("report verticale", prototype `proto/tag-view`).** Header (name +
  date-range label + Edit/Archive) → 3 KPI → included count → per-category breakdown with CSS
  bars (no charting dependency) → compact transaction list (date · subcategory · signed amount,
  date-descending).

- **`?tag=` dashboard filter is removed, not kept alongside.** The period-scoped filter and its
  wiring (`TagFilterSelect`, `tagId` threading through the overview/category DAL,
  `no-data-for-tag` empty state, `parseTagIdParam`) are deleted in Phase 70, sequenced after the
  dedicated page ships in Phase 69 (TAG-13).

---

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
- [Phase ?]: [Phase 66-04] selectedIncludesGroupRow added as a second exported pure helper (beyond computeMergeEligibility) so the Categorizza/Elimina bulk-action gate decision is directly unit-testable, since this repo has no jsdom for click-time toast assertions
- [Phase ?]: Phase 66-05: GroupDetailClient's Cambia categoria control is an independent inline trigger, not a reuse of Plan 66-04's GroupCategorizeDialog (no dependency edge between sibling Wave-3 plans; both call categorizeExpenseGroup)
- [Phase ?]: Phase 66-05: tests/group-detail-page.test.tsx mocks @/components/ui/dropdown-menu with a flat SSR stub (DropdownMenuContent always renders children) since Radix portals closed-menu content out of static markup — same pattern as tests/expense-table-menu.test.tsx
- [Phase ?]: Phase 67-01: normalizedName computed by service layer (Plan 67-03) via name.trim().toLowerCase(), never derived in DB; DB stores it as a plain column with a (userId, normalizedName) unique constraint closing the TAG-01 concurrency race
- [Phase ?]: Phase 67-01: transactionTag has no standalone unique on transactionId — a transaction may carry N tags, unlike expenseGroupMembership's one-group-per-expense rule; only composite (tagId, transactionId) unique applies
- [Phase ?]: Phase 67-01: local db:migrate target resolves DATABASE_URL to a Supabase-hosted Postgres instance in this dev environment, not the docker-compose sparter-postgres container (which is empty/unused) — migration 0027 verified against the actual db:migrate target
- [Phase ?]: Phase 67-02: vacanzeAudit seed-extras STEP resets linked expenses to da-categorizzare BEFORE deactivating attivita-e-intrattenimento/cibo-e-bevande (D-11/D-12/D-13), lookup by slug never filtered on isActive for idempotent re-run
- [Phase ?]: Phase 67-02: D-14 regex half only — travel-only 'trasporto' pattern excludes daily-commute keywords; AI-categorizer-rules half deferred (Tier-3 not built)
- [Phase ?]: Phase 67-02: yarn db:seed-patterns intentionally not run in this plan (full replace, broader blast radius) — flagged as Operator Next Step
- [Phase ?]: 67-04: bulkAssignTags/bulkRemoveTags implement D-06 additive-union / D-07 symmetric removal as fully separate code paths, gated by dual IDOR checks (transaction + tag ownership) before any write
- [Phase ?]: 67-04: ActionState imported from lib/validations/category (per plan) rather than lib/validations/expense — structurally identical, no behavior change
- [Phase ?]: Test-file mocking: each task's tests exercise the REAL implementation of the module built by the prior task (backed by that task's lower-level mocks) instead of mocking it wholesale, avoiding vi.mock file-wide hoisting conflicts in the single accumulated tests/tag-suggestions.test.ts
- [Phase ?]: computeSuggestionsForNewTag always returns its one group (never null) for a found tag, including a range-less tag (matches: []) — followed the plan's <action> block code spec over ambiguous <behavior> summary prose
- [Phase ?]: No lucide-react Tag icon import in bulk-assign-tags-dialog.tsx — dialog title is text-only, so no icon usage; naming-collision acceptance criterion still satisfied since no Tag identifier is imported at all.
- [Phase ?]: verifySession() now called directly in app/(app)/transactions/page.tsx (first time) to obtain userId for getTags(userId) — additive, no existing behavior changed.
- [Phase ?]: 67-07: Detail-page Tag section uses shadcn Select (not a bottom-sheet) for the single-item picker; @/components/ui/select mocked as passthrough divs in tests since Radix Select portals into document.body (no output under renderToStaticMarkup in this repo's Node-only test env) — same pattern as the existing Sheet mock.
- [Phase ?]: Phase 67-08: CreateTagDialog manages its own useActionState (not useDialogAction) to inspect the create result (tagId, hadRange) after success and decide whether to fetch/open the D-08a suggestion modal
- [Phase ?]: Phase 67-08: tests/settings-hub.test.tsx mocks updated (Tags icon, tagSettings route) to support the new SettingsHub 'Tag' card (Rule 3 auto-fix, file not in plan's files_modified list)
- [Phase ?]: 67-09: TagSuggestionCard keeps a local confirmed state instead of removing itself on success — sibling tag cards on the same screen may still be pending confirmation.
- [Phase ?]: 68-01: tagScopedTransactions lives in a new sibling lib/dal/transaction-tags-sql.ts (not transaction-pairs-sql.ts), keeping pairing vs. tagging predicates in separate files
- [Phase ?]: 68-01: mapParsedTransactionFiltersToDal needed no code change for tagId — its existing ...rest spread already passes tagId through identically to subCategoryId
- [Phase ?]: 68-02: tests/dashboard-dal.test.ts extended with a real db chain mock (from/leftJoin/innerJoin/where/groupBy/orderBy/limit, thenable) instead of mocking drizzle-orm itself — real and()/eq()/sql() work fine against the file's existing plain-string schema mocks
- [Phase ?]: 68-02: getCategoryDetail's category-metadata lookup query intentionally left untouched by tagId (no transaction join to scope); all 3 of its data-bearing queries (trend, subcategory breakdown, top transactions) narrow
- [Phase ?]: Phase 68 (68-04): getTagTotals rooted at FROM tag with every join LEFT so a zero-transaction tag still surfaces a row via COALESCE/FILTER defaults instead of being dropped
- [Phase ?]: Phase 68 (68-04): dashboard exclusion set (status/transfer/pair-netting) composed once and applied via SQL FILTER (WHERE ...) inside count/MIN/MAX/SUM, never the outer WHERE — outer WHERE is only eq(tag.userId, userId)
- [Phase ?]: Phase 68 (68-04): tests/tags-dal.test.ts drizzle-orm mock switched to importOriginal() + selective overrides (and/asc/eq/isNotNull stay mocked, sql/inArray/ne pass through real) to support getTagTotals's real-SQL FILTER usage without rewriting pre-existing tests
- [Phase ?]: 68-05: buildTagFilterSearch extracted as a standalone exported pure function (not inlined in the component) for unit-testability without jsdom — mirrors MergeExpensesDialog's exported step-logic precedent
- [Phase ?]: 68-05: 'Tutti i tag' sentinel value is the literal string 'all', not empty string — Radix Select reserves value="" for no-selection; no real tagId can ever be 'all'
- [Phase ?]: MonthOverMonthChange.categorySlug is required (string | null), not optional — matches the NAV-01 fix literally; updated 11 fixture sites in tests/overview-movers.test.tsx
- [Phase ?]: fetchMovers had no dedicated test file (tests/overview-movers.test.tsx only covers pure format helpers) — created tests/overview-movers-action.test.ts for Pitfall 4 coverage
- [Phase ?]: [Phase 68] 68-08: TagRankingList constructs a minimal TagRow-shaped object for ArchiveTagDialog (only id/name/archived populated) instead of fetching a second, separate TagRow[]
- [Phase ?]: [Phase 68] 68-08: /dashboard/tags reads no searchParams at all (no preset/year/tag) — TAG-05's per-tag total is all-time and independent of the dashboard's global filters (LOCKED DECISION 1)
- [Phase ?]: 68-06: Added no-data-for-tag OverviewEmptyState variant + tagId-aware CategoryRankingList empty copy to satisfy the plan's locked must_haves copy contract (not spelled out in task action blocks)
- [Phase ?]: 68-06: Category detail page renders no TagFilterSelect of its own — filter is set on the ranking-list page and carried through via ?tag= only, matching the existing preset/type no-second-control pattern
- [Phase ?]: 68-07: MoverList rows built from categorySlug (never categoryId) per Pitfall 2; UI-SPEC's stale category={m.categoryId} snippet is superseded by the plan/PATTERNS.md
- [Phase 70]: Dashboard legacy ?tag= URLs degrade silently — param not read, no redirect (Phase 70 D1)
- [Phase 70]: Per-tag analysis lives only in /tags/[id]; no substitute affordance on the dashboard (Phase 70 D2)
- [Phase ?]: Phase 73 Task 1 (locked): option-b — drop transaction_pair at phase end (Plan 73-04 Task 3), not kept dormant
- [Phase ?]: Migration 0029 resolves the reimbursement anchor by transaction sign (amount < 0), not the legacy magnitude-based 'primary' label — closes a theoretical D-02 violation (Rule 2, user-approved)
- [Phase ?]: Migration 0029 groups backfill by anchor expense_id (one reimbursement, N refunds) rather than one reimbursement per transaction_pair row — required by the reimbursement_expenseId_unique partial index (Rule 2, user-approved)
- [Phase ?]: Phase 73 Plan 02: Q3 per-transaction attribution proven via raw effectiveAmount() probe per sibling + combined category/month total (no function exposes per-row netted amounts; 5/8 functions hard-code 'last-month' date scope)
- [Phase ?]: Phase 73 Plan 02: getOverviewChart's out.* segments are abs()'d (unlike getMonthlyTrendByNature's raw signed sum) — corrected sign-flip assertions accordingly
- [Phase ?]: Phase 73 Plan 02: connectReimbursementTestDb() now serializes cross-file access via a Postgres advisory lock (idleTimeoutMillis: 0) after discovering two harness test files corrupt each other's fixtures when run together under vitest's default file parallelism
- [Phase ?]: 73-03: Shared role-resolution SQL helpers (pairedCounterpartIdExpr/pairedReimbursementIdExpr) reused across transactions.ts's 5 paired-* fields instead of duplicating the anchor/refund tie-break CASE per field.
- [Phase ?]: 73-03: Amount-edit guard's role detection (refund vs anchor) resolved via one combined SELECT with two correlated subquery columns, keeping the unpaired-case round-trip count at 2, matching the old 1:1 guard's shape.
- [Phase ?]: Phase 73 Plan 04: executed locked option-b — dropped transaction_pair (migration 0030) after repointing createPair/deletePairByTransactionId and getEligibleCounterparts; retired the before/after byte-identical regression harness (transaction_pair-dependent) in favor of native seedReimbursement fixtures; full suite green (141 files, 1756 tests).
- [Phase ?]: 74-01: effectiveAmount() rewritten as one uniform proportional-spread CTE chain (anchor -> member_expense_ids -> member_transactions -> refund_total -> raw_shares -> member_shares) covering both Expense and Expense Group anchors (D-01/D-02); largest-remainder cent assignment tie-broken by ABS(amount) DESC, occurredAt ASC, id ASC; zero-sum member set guarded via NULLIF/COALESCE, never divides by zero
- [Phase ?]: 74-01: split the plan's single-CTE member_shares pseudocode into raw_shares + member_shares (Postgres disallows referencing a SELECT-list alias from another expression at the same query level) -- pure SQL-structuring fix, formula/tie-break/guard semantics unchanged (Rule 1)
- [Phase ?]: 74-02: getReimbursementAggregates() uses raw db.execute(sql) with an explicit r alias for the outer reimbursement row -- Drizzle's typed column proxies render as bare unqualified column names, ambiguous inside correlated subqueries joining tables (reimbursement_refund, transaction) that share an id column
- [Phase ?]: 74-02: residual = outflowSum + refundSum (Decimal.js), state owed/settled/surplus purely by sign, no magnitude guard (D-03) -- computed on the fly via computeReimbursementResidual(), never a stored column
- [Phase ?]: 74-03: buildPairGuardMessage() N>1 message enriched with reimbursement title, N<=1 unchanged; guard block condition itself untouched (RMB-09)
- [Phase ?]: 74-03: refund-edit branch's refundCount counts ALL linked refunds (not excluding the edited one) -- total N determines message ambiguity
- [Phase ?]: Phase 74-04 gap-closure: fixed CR-01 (group-anchor member edits were unguarded) and CR-02 (refund-edit anchor magnitude silently defaulted to 0 for group anchors) in updateTransaction()'s pair guard; also fixed a correlation-ambiguity bug (bare Drizzle column proxy bound to the wrong local column in a nested subquery) discovered by the new real-Postgres tests, which had silently broken the refund-edit branch for all anchor shapes
- [Phase ?]: [Phase 75-01] Frozen anchored-transaction set stored as a new join table (reimbursement_anchor_transaction), mirroring expense_group_membership's composite-unique + both-side-index shape
- [Phase ?]: [Phase 75-01] effectiveAmount()'s member_transactions CTE split into a UNION ALL of two branches by anchor shape (Expense frozen-set / Group expense_group_membership unchanged), not a runtime CASE, so the Group branch stays provably byte-identical
- [Phase ?]: [Phase 75-01] seedReimbursement() fixture populates the frozen set from ALL transactions currently under the anchor expenseId (not a single passed-in id), required by the pre-existing Q3 multi-transaction-Expense sibling scenario
- [Phase ?]: [Phase 75-01] requirements.mark-complete NOT run for RMB-08 — this plan delivers only the D-08 backend prerequisite; the user-facing linking UI (RMB-08's actual capability) ships in Plan 75-04
- [Phase ?]: 75-02: createPair signature changed to anchor: {transactionId}|{groupId}; all existing callers updated in same wave (Rule 3)
- [Phase ?]: 75-02: Group anchor subCategoryId resolved from expenseGroup.subCategoryId (group's own column), not per-member ambiguity
- [Phase ?]: 75-02: requirements mark-complete NOT run for RMB-07/RMB-08 — backend-only plan, user-facing linking UI ships in Plan 75-04
- [Phase ?]: 75-03: reimbursementRefundSnapshot.expenseId nullable+set-null lets restore branch on expense-exists vs deleted-after-linking with no manual SELECT
- [Phase ?]: 75-03: restoreRefundBaseline re-derives its own reimbursement_refund row via join on refundTransactionId, letting deleteReimbursementForAnchor reuse it directly with no adapter
- [Phase ?]: 75-03: removeRefundAction aliases deleteTransactionPairAction directly (its refund-side behavior is already correct post-restore); deletePairByTransactionId anchor-side branch left unchanged per plan
- [Phase ?]: 75-03: requirements mark-complete NOT run for RMB-07 — backend unlink/delete lifecycle only, user-facing linking UI ships in Plan 75-04
- [Phase ?]: 76-01: requirements mark-complete NOT run for RMB-10/RMB-11 -- this plan delivers only the DAL/tracer foundation (bare table, no search/filter/sort, no per-reimbursement page); RMB-10 completes in Plan 76-02, RMB-11 completes in Plan 76-05
- [Phase ?]: RMB-10 marked complete in Plan 76-02 (search+status-filter+sort+both EmptyState variants delivered); RMB-11 remains Pending until Plan 76-05's detail page.
- [Phase ?]: 76-03: reimbursementId row-indicator gate + unpair fix — reused pairedReimbursementIdExpr() verbatim; Rule 1 auto-fix cleared reimbursementId in handleUnpair's optimistic state to avoid a stale-link regression.
- [Phase ?]: ReimbursementPanel variant defaults to 'management' — every existing call site keeps unchanged behavior; only the tx-detail page opts into 'summary'
- [Phase ?]: 76-05: status Badge omits variant prop entirely (relies on residualBadgeClassName's className via twMerge) to satisfy this plan's own zero-variant= acceptance criterion in reimbursement-detail-client.tsx.
- [Phase ?]: ledger_entry seam (ledger_entry_cash/ledger_entry_accrual) is a plain Postgres VIEW, not materialized — user-chosen at 77-01 Task 1 checkpoint (always-fresh reads, no refresh infra needed).
- [Phase ?]: Amortization not-outflow guard reads the transaction's raw signed amount directly, never via subCategory->nature->direction join, so uncategorized transactions are never silently blocked.
- [Phase ?]: Client-side row-action amortization eligibility is a synchronous mirror of server guards (transactionListSelect fields), avoiding a loading-flash; server independently re-validates every guard before any write.
- [Phase ?]: 77-02: reverseDetachTx recomputes the original descriptionHash via computeDescriptionHash and reuses reconcileExpensesAfterTransactionRemoval on both the target and abandoned expense ids — no bespoke undo cleanup logic
- [Phase ?]: 77-04: Grep-verifiable migration comments must paraphrase removed effectiveAmount()/isNotSecondary() calls, never quote them, when the plan's own acceptance criteria greps for zero occurrences
- [Phase ?]: createTransaction's CreateTransactionResult extends ActionState with optional amortized/months fields rather than a separate action, keeping useActionState's initial state valid with zero call-site changes.
- [Phase ?]: Default (non-amortized) submit button label changed from 'Salva transazione' to 'Crea transazione' per the UI-SPEC's exact D-10 copywriting pair.
- [Phase ?]: Manual-entry preview reuses the bounded-height + IntersectionObserver incremental-render technique from ActivateAmortizationDialog, since the UI-SPEC names E4 alongside E1 in the overflow resolution.
- [Phase ?]: 77-05: getTagTotals inverted-LEFT-JOIN migrated by adding one id-to-id leftJoin(ledgerEntryCash) and folding its IS NOT NULL check into the existing tagTotalExclusion FILTER (uniform across count/minDate/maxDate/total)
- [Phase ?]: 77-05: getTagDetail migrated via the dual-join pattern (raw description/occurredAt from transaction, netted amount from ledger_entry_cash) — same technique as 77-04's getCategoryDetail
- [Phase ?]: 77-05: closing cross-feature non-interaction test isolates amortization fixture on category AND month axes to avoid polluting getCategoryDeviations' 3-month baseline window
- [Phase ?]: Task 1 (diagnose collateral unit-test breakage) required no changes: full suite already green thanks to 77-05's tags-dal.test.ts mock fix
- [Phase ?]: 77-06: reworded dashboard.ts:487 comment quoting isNotSecondary() literally to close the repo-wide zero-hit grep gate for LENS-03/D-11
- [Phase ?]: closePlanTx (D-01/AMORT-04): collapses future instalments (occurredAt >= closure-month start, inclusive) onto ONE closure-month row, expenseId sourced from a deleted future instalment since amortization_plan has no expenseId column (Phase 77 D-13: all instalments of a plan share one Standalone Expense)
- [Phase ?]: 78-03: amortizationPlanId correlated subquery mirrors transactionListSelect's raw-SQL-identifier style (no amortizationPlan schema import — would be unused); guard runs BEFORE the amount-only pair-guard so it also covers occurredAt-only edits; loose != null comparison keeps every pre-existing test unmodified
- [Phase ?]: [Phase 78] 78-02: closePlanTx's collapse logic extracted into a private collapseAndCloseTx(tx, {userId, plan, closureMonth, extraAmount}) core -- closePlanTx is a thin extraAmount=0 wrapper; realizePlanTx reuses it with the sale's signed amount folded in, zero duplication of the D-01 collapse algorithm
- [Phase ?]: [Phase 78] 78-02: grep -c 'createPairTx' floor is 2 (import + single call site), not the plan's literal 'exactly 1' -- an import line necessarily matches too; comments paraphrased to avoid inflating further, semantic guarantee (only realizePlanTx calls it) verified via 0-hit effectiveAmount()/isNotSecondary() grep plus manual inspection
- [Phase ?]: [Phase 78] 78-02: reducePlanTx adds the SAME refund signed amount to both plan.totalAmount (whole-life base) and the future-only remaining sum (re-spread base) -- algebraically consistent since totalAmount = consumedSum + futureSum invariant holds before and after
- [Phase ?]: 79-01: remaining_months bigint-as-string coerced via Number() in DAL row mapper (Postgres COUNT(*) returns bigint, node-postgres surfaces as string)
- [Phase ?]: 79-01: IDOR cross-user DAL test seeds global direction/nature taxonomy once per test and reuses subCategoryId across both users, since seedMinimalTaxonomy cannot be called twice (unique(code))
- [Phase ?]: 79-02: resolveRowActions returns realizeHref unconditionally (regardless of status) — only showActions gates rendering, matching the plan's <behavior> contract literally
- [Phase ?]: 79-02: DAL/lifecycle consistency test asserts remainingMonths is EITHER 0 or 1 after closePlanTx (never a hardcoded value) since the closure instalment's classification against Postgres's CURRENT_DATE depends on real wall-clock timing at test run; both branches checked against the known past-instalment sum + closePlanTx's own returned remainingValue
- [Phase ?]: 80-01: requirements.mark-complete NOT run for LENS-01/LENS-02 — one-route tracer slice only, full capability lands across Plans 80-02..80-07 (Phase 75/76 precedent)
- [Phase ?]: 80-01: getUncategorizedCount stays lens-invariant (no ledgerRowSource param) — an amortized transaction is always pre-categorized before a plan can attach, closing the seam survey's flagged Confirm note
- [Phase ?]: 80-01: lens-persistence.ts re-exports safeSessionStorage from overview/overview-persistence.ts instead of duplicating it, giving lens-switch.tsx one import path
- [Phase ?]: 80-02: topTransactionRows amount COALESCEs raw transaction.amount first, ledger row's amount second — preserves byte-identical cash display contract, only instalments (no transaction row) fall back
- [Phase ?]: 80-02: requirements.mark-complete NOT run for LENS-02 — five of ten aggregation sites done (all six dashboard.ts functions lens-selectable), full capability needs Plans 80-03..80-07
- [Phase ?]: 80-03: getYearsWithData/getMonthsWithData's competenza branches UNION transaction/amortization_instalment directly, never ledgerEntryCash/ledgerEntryAccrual — these are navigation functions ('any activity'), not netting aggregations; the ledger views' NOT EXISTS refund-exclusion would silently drop a refund year/month (T-80-06)
- [Phase ?]: 80-03: getYearsWithData's cash branch kept as a separate unindented early-return AFTER the new competenza branch (not nested in an if-block) so git diff shows zero line changes inside the pre-existing cash path, satisfying the plan's byte-identical acceptance criterion literally
- [Phase ?]: 80-03: requirements.mark-complete NOT run for LENS-04/LENS-05 — this plan delivers only the DAL/pure-function backend (ledgerRowSource on movers/chart, lens-aware navigation, resolveYear cross-lens clamp); the year-selector UI wiring lands in a later Wave plan
- [Phase ?]: 80-06: getTagTotals call site left exactly as getTagTotals(userId) — parsed lens only sets LensSwitch's visual state, never passed to the DAL (D-05)
- [Phase ?]: 80-06: requirements.mark-complete NOT run for LENS-01 — Plans 80-04/80-05 (overview full reflection, categories/categories-detail wiring) had not executed yet at this plan's runtime; D-03's all-four-routes contract completes at Plan 80-07
- [Phase ?]: 80-04: buildDashboardTabHref preserves ?lens= mirroring the existing preset/type/sort/tag precedent (D-03)
- [Phase ?]: 80-04: page-level lens parsing reordered to run BEFORE the year fetch (parseLensParam -> getYearsWithData for both lenses -> resolveYear) since the D-10 clamp needs the active lens to distinguish active vs other years[]
- [Phase ?]: 80-05: DashboardFilters left untouched (shared preset/type-only toolbar); lens parsed/resolved at page level only, passed to LensSwitch + DAL calls
- [Phase ?]: 80-07: Did not fix pre-existing proxy.ts staging-bypass redirect-loop bug (blocks all dashboard Playwright specs, unrelated to this plan's files) — logged to deferred-items.md per SCOPE BOUNDARY
- [Phase ?]: 80-07: Marked LENS-01/LENS-02 complete — D-03's all-four-routes contract satisfied by 80-04+80-05+80-06 together; DAL/URL-wiring proven by real-Postgres+unit tests, live-browser proof blocked by unrelated environmental bug
- [Phase ?]: 260730-e6z: transactions footer totals bucketed per currency (falsy/empty -> EUR), split by sign of pairedNetAmount ?? amount via Decimal.js, rendered only once hasMore is false and not loading
- [Phase ?]: 260730-e6z: formatSignedAmount forces useGrouping: true explicitly — this Node/ICU build drops the thousands separator when signDisplay is non-default and useGrouping is left at 'auto'
- [Phase ?]: 82-01: MonthlyValue amounts are magnitudes (abs), not signed transaction amounts — matches getCategoryRanking's abs(sum(...)) convention
- [Phase ?]: 82-01: userId-scoping test reuses first taxonomy's essentialNatureId via seedSecondEssentialCategory rather than calling seedMinimalTaxonomy twice (direction/nature are global unique(code) lookup tables)
- [Phase ?]: Categories pinned to cash by construction — pages stop parsing ?lens= entirely instead of parsing and pinning the result (D-12)
- [Phase ?]: buildDashboardTabHref drops the dead tag param, keeps lens propagation unchanged (D-13/D-14)
- [Phase ?]: 82-03: buildYearSeries's total is structurally the reduce-sum of its own months array — never re-derived independently — proven with a rounding-exposing fixture where the naive total ('100.00') diverges from the structurally-correct one ('99.99')
- [Phase ?]: 82-03: isPartialMonth compares only (year, month) equality against today, no day-of-month arithmetic at all — D-03's explicit no-presumption rule
- [Phase ?]: getCategoryYearRanking is additive alongside getCategoryRanking (never a reshape) to protect v2.8/v2.9 regression baselines
- [Phase ?]: D-09 predicate flip (direction.hidden=false) surfaces the allocation direction for the first time in the new Categories year-view code path
- [Phase ?]: 83-02: DashboardCategoryFilters.type/.sort widened additively to carry CLIST-04 allocation direction + CLIST-03 projection sort at the type level
- [Phase ?]: resolveCategoryDirectionCopy has no default/fallback switch case — a future 4th direction cannot ship with partial copy
- [Phase ?]: Phase 83 Plan 04: DirectionFilter/SortToggle/NoYearsEmptyState extracted into components/dashboard/category-list-controls.tsx — Next.js App Router route-typing rejects any named export from page.tsx beyond its allowed route exports
- [Phase ?]: Phase 83 Plan 04: Categories list mobile layout simplified — sparkline/projection columns hidden below sm: breakpoint via Tailwind rather than duplicated into a separate mobile-only block (Claude's Discretion, 83-CONTEXT.md)
- [Phase ?]: 83-05: getCategoryYearRanking branches amountSql on directionCode (signed sum for allocation, abs(sum) unchanged for in/out) rather than removing abs() globally
- [Phase ?]: 83-05: resolveEstimatedReference falls back to observed covered/current magnitude, then a fixed ESTIMATED_HEIGHT_FALLBACK=1 constant, only when estimatedHeightHint is null
- [Phase ?]: 83-06: guarded allocation-direction Categories row against broken detail link (CR-01 NEW) by rendering a non-interactive span with no href computed, per locked user decision
- [Phase ?]: getCategoryDetailMeta replicates getCategoryDetail's metadata subquery verbatim (same allocation-category gap) — widening it is out of Plan 84-01's scope
- [Phase ?]: Window's first column (index 0) never renders a delta line, not even 'nessun confronto' — it has no in-window predecessor by definition
- [Phase ?]: 84-02: chart delta null-guards both sides (current uncovered OR previous uncovered), not just the whole previousYear row unavailable — corrects the plan's own '?? 0.00' pseudocode that would fabricate a comparison against an uncovered month
- [Phase ?]: 84-02: CategorySubcategoryBreakdown gained an explicit year prop beyond the plan's declared props — Totale {year}/nuova nel {year} copy needs the window's year, not system current year
- [Phase ?]: Plan 84-03: dropped unused DateRange import from lib/dal/dashboard.ts once DeviationDateRanges (its only consumer) was deleted
- [Phase ?]: Plan 84-03: getCategoryDetail's new type field destructured but unused (_type), for signature symmetry with getCategoriesBreakdown/getCategoryRanking per D-15

### Deferred (per ADR 0016 — not built now)

- **SUBS-VIEW** — normalized "Subscriptions" view showing net cost per covered month for shared/recurring expenses. The main entrate/uscite dashboard stays cash-basis; the monthly chart is not amortized.
- **SPLIT-01** — split a single inflow across multiple subcategories (e.g. €50 subscription + €20 pizza in one transfer). The one-transaction → one-subcategory limit holds.
- A "money received from a person" (counterparty) category — rejected by ADR 0016.

### Codebase facts relevant to the milestone

- **Categories list (Phase 83) / detail (Phase 84)** — currently read `getCategoryRanking` (filters
  `direction.includedInTotals`), `getCategoryDeviations`/`getCategoryDetail` and the Preset helpers
  (`parseDashboardFilters`, `dashboardPresetToDateRange`, `dashboard-filters.tsx`). Both are being
  rewired off these in Phases 83/84; the underlying functions retire in Phase 84 once no caller
  remains (ADR 0020: "referenced only by the two Categories pages").

- **Shared month-coverage plumbing (Phase 82)** — `getMonthsWithData`/`getYearsWithData` already
  exist and are lens-aware (v2.9 Phase 80); the new "Mese Coperto" (D11) concept is a per-user,
  any-category month coverage predicate that likely reuses/extends this same plumbing — the
  reason RETIRE-05's Overview/Tags regression gate exists.

- **Amortization plan + instalment schema (Phase 77, v2.9)** — plan table (transaction FK, months,
  start date, status open/closed) + N materialised instalment rows, per ADR 0019.

- **The `ledger_entry` seam (Phase 77, v2.9)** — a Postgres view per lens (`ledger_entry_cash`,
  `ledger_entry_accrual`). Categories' number engine (Phase 82) reads only `ledger_entry_cash`
  (D6/D-05 — Categories is lens-invariant); no new view or `source` discriminator column needed
  (Out of Scope, per ADR 0020).

- **Lens-adjacent navigation** — `getYearsWithData` (`overview.ts`) and `getMonthsWithData`
  (`months-with-data.ts`) read `transaction` only under cassa; under the accrual lens they also see
  instalments (LENS-05, v2.9) — unaffected by v3.0, which is cash-only on Categories.

- `lib/services/transaction-detach.ts` — `detachTransactionToDedicatedExpense({ userId, transactionId, title, subCategoryId })` (shipped v2.4/ADR 0016) is the reused detach mechanism for AMORT-02.
- The v2.8 reimbursement mechanism (`reimbursement`/`reimbursement_refund`, `effectiveAmount()`) is reused as-is for realization (AMORT-05/06) — no new netting mechanism per ADR 0019.
- `.scratch/dashboard-categories/` — prototype assets backing D19 (12-month table variant A chosen over a chart); read before planning Phase 84.

- **Expense Group (Phases 65-66)** — no existing schema entity; requires a new grouping table
  (group + membership) via `drizzle-kit generate` + `scripts/migrate.ts`. No migration touches
  existing expense/transaction rows (ADR 0017 consequence). Group totals must be computed at
  read time in the DAL, never persisted/cached on the group row.

- **Transaction Tags (Phases 67-68)** — no existing schema entity; new curated tag table +
  transaction-tag join table (N:M). TAG-06's regex/categorizer updates for Vacanze/Viaggi follow
  the existing `scripts/seed-patterns-data.ts` full-replace model (`yarn db:seed-patterns`) — new
  or corrected patterns go there, not in `seed-data.ts`/`seed-extras.ts`.

- `SubcategoryPicker` (vaul bottom sheet, single `subCategoryId` output, adopted across all 7 selection surfaces) is the intended control for any new subcategory-capture UI in the merge dialog (GRP-02) — reuse, do not build a new picker (v1.13 / ADR 0008).
- Dashboard aggregation sites (8, per v2.0 `isNotSecondary()`/`effectiveAmount()` netting) are the surfaces GRP-09's invariant test and TAG-04's global filter must both leave structurally unchanged / correctly narrow.

### Blockers/Concerns

No discovery to redo for v3.0 before planning Phase 82 — design locked in ADR 0020 +
`.planning/dashboard-categories-DECISIONS.md`. See "Deliberately left open" list above for
per-phase decisions still to make at discuss/plan time.

Both feature models (Expense Group via ADR 0017, Transaction Tags via the Obsidian design note) are locked — no discovery to redo before planning Phase 65.

- Operator: run yarn db:seed-patterns against the real target to make Phase 67-02's new travel-only 'trasporto' regex pattern live (full replace of system patterns)
- proxy.ts staging-bypass never sets x-pathname/x-search headers -> infinite /onboarding redirect loop for zero-transaction staging users -> blocks ALL dashboard Playwright specs (tests/dashboard.spec.ts). Fix candidates + full diagnosis in .planning/phases/80-dashboard-accrual-lens/deferred-items.md.

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
| 260721-mim | Fix transactions free-text search to also match the Expense Group title (getTransactions name filter or() + precedence comment) | 2026-07-21 | e52608f |
| 260721-n3c | Remove overflowing "Data" column from expenses table; add "Periodo" row to expense/group detail riepilogoCard | 2026-07-21 | 72c82f8 |
| 260721-o5t | Dashboard category-detail Top 5 movimenti shows Expense Group title (GRP-08 gap closed): topTransactionRows leftJoins expenseGroup, title precedence customTitle ?? groupTitle ?? description | 2026-07-21 | 0b473c3 |
| 260709-mf6 | Recurring-first KPI card restyle: ReadingKpiCard reworked to components-first (recurring/structural hero, total as summary line); Entrate/Uscite stacked additive rows, Bilancio/Tasso stacked structural label, sign-coloured. Verified in running app (light+dark) via throwaway proto | 2026-07-09 | d347a8b |
| 260711-cbr | Composition-bar KPI card restyle (supersedes mf6): total = hero again; Entrate/Uscite mix as a single-hue composition bar + dominant legend (rest on hover); Tasso risparmio = rate + progress bar toward 20%; Bilancio/Accantonato = hero + reading. Compact top-right YoY delta chip. Chosen from 3 proposals informed by Copilot/KPI-card research. Verified light+dark+7-figure via throwaway proto | 2026-07-11 | dd7c017 |
| 260711-gfd | Dashboard-wide filter chips + sustainability default (option B): nature chips lifted from the chart to OverviewDashboardSection and now drive KPI cards AND chart; KPIs derived client-side from monthly points (overview-kpi-derive.ts, Decimal); YoY deltas vs prior-year points under the same selection (page fetches year−1); default = recurring income vs all spending (Straordinarie excluse) so Bilancio/Tasso heroes ARE the structural numbers; reset → default; Reimposta shown when ≠ default. Verified in-browser (toggle updates cards+chart together) | 2026-07-11 | 2af669f |
| 260721-mm0 | Fix: private format create drops secondaryDescriptionColumn (formData not forwarded in createPrivateImportFormatAction) | 2026-07-21 | 7904df5 |
| 260721-mrl | Move Categorie into primary left sidebar; remove hub card; keep /settings/categories route | 2026-07-21 | eddc893 |
| 260722-iys | Nav IA: /tags + /patterns primary; Patterns out of Categories; theme→Profile; /settings→Profilo; mobile Altro sheet | 2026-07-22 | fcb1646 |
| 260722-ked | Enrich tag detail panel: Entrate/Uscite/Valore finale totals + included-tx count + compact tx list (date·subcat·signed amount), lazy via getTagDetailAction; dashboard-consistent netting (getTagDetail/buildTagDetailData) | 2026-07-22 | 1cce578 |
| 260730-bfa | Sidebar sections by feature type (Option A: Panoramica / Movimenti / Ingresso dati / Configurazione) | 2026-07-30 | 5a064b8e |
| 260730-e6z | Riepilogo totali netti (Entrate/Uscite/Differenza per valuta) nel footer della tabella transazioni | 2026-07-30 | 95f3adee |
| 260730-g3b | Lens selector redesign (LSD-01..05, `.planning/lens-selector-DECISIONS.md`): pill segmented control → dropdown integrato nel titolo pagina con voci descritte; overlay tratteggiato "Uscite (cassa)" sul grafico overview solo con lente competenza (secondo fetch gated); controllo nascosto senza piani di ammortamento (`hasAmortizationPlans`) e rimosso da /dashboard/tags. Verifica visiva in-browser passata 2026-07-30 | 2026-07-30 | 4bbafc63 |
| 260730-m2x | Fix amortizzazione: collegamento rimborso come vendita (`reducePlanTx`→`createPairTx`); ri-ammortizzabilità dopo "Rimuovi ammortamento" (clear stale `reimbursementId`/pairing client-side); link dashboard movers → `/transactions?months=YYYY-MM` | 2026-07-30 | 963f213b |
| 260730-n2z | Amort UX: detail→Visualizza ammortamento (`?transactionId=`); Tutti mostra aperti+chiusi; copy Chiudi con vendita/rimborso | 2026-07-30 | 71351519 |
| 260803-e9w | Chiusura WR-01/WR-02 di 83-REVIEW.md: nome accessibile per la riga Accantonamenti (testo `sr-only` nello `<span>` inerte — `aria-label` scartato perché il ruolo implicito `generic` non ammette naming da autore) via nuovo `rowAccessibleSuffix` nella copy service centralizzata (D-11); ripristinato il commento di razionale D-13/CLIST-07 sopra l'href del `<Link>`. Nessun cambiamento visivo | 2026-08-03 | 64403c6a |

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

**Stopped at:** Completed 84-03-PLAN.md

Last session: 2026-08-03T13:04:42.126Z

**Next:** `/gsd-discuss-phase 82` or `/gsd-plan-phase 82` to begin Phase 82 (number-engine-and-regression-gate).

## Operator Next Steps

- v3.0 roadmap created (Phases 82-84). Continue with `/gsd-discuss-phase 82` or `/gsd-plan-phase 82`.

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
| Phase 66 P04 | 7min | 3 tasks | 5 files |
| Phase 66 P05 | 6min | 3 tasks | 4 files |
| Phase 67 P01 | 3min | 3 tasks | 6 files |
| Phase 67 P02 | 12min | 2 tasks | 4 files |
| Phase 67 P04 | 3min | 3 tasks | 6 files |
| Phase 67 P05 | 5min | 3 tasks | 4 files |
| Phase 67 P06 | 3min | 3 tasks | 6 files |
| Phase 67 P07 | 8min | 2 tasks | 3 files |
| Phase 67 P08 | 4min | 3 tasks | 8 files |
| Phase 67 P09 | 8min | 2 tasks | 3 files |
| Phase 68 P01 | 25min | 3 tasks | 9 files |
| Phase 68 P02 | 12min | 3 tasks | 2 files |
| Phase 68 P04 | 25min | 2 tasks | 4 files |
| Phase 68 P05 | 12min | 2 tasks | 5 files |
| Phase 68 P03 | 15min | 3 tasks | 6 files |
| Phase 68 P08 | 20min | 2 tasks | 4 files |
| Phase 68 P06 | 12min | 3 tasks | 7 files |
| Phase 68 P07 | 15min | 1 tasks | 2 files |
| Phase 69 P02 | 4min | 2 tasks | 4 files |
| Phase 70 P01 | 8min | 3 tasks | 10 files |
| Phase 73 P01 | 95min | 3 tasks | 8 files |
| Phase 73 P02 | 55min | 2 tasks | 6 files |
| Phase 73 P03 | 25min | 2 tasks | 4 files |
| Phase 73 P04 | 90min | 3 tasks | 16 files |
| Phase 74 P01 | 75min | 2 tasks | 3 files |
| Phase 74 P02 | 40min | 2 tasks | 3 files |
| Phase 74 P03 | 20min | 2 tasks | 3 files |
| Phase 74 P04-gap-closure | 55min | 1 tasks | 2 files |
| Phase 75 P01 | 27min | 2 tasks | 9 files |
| Phase 75 P02 | 110min | 2 tasks | 7 files |
| Phase 75 P03 | 24min | 2 tasks | 7 files |
| Phase 76 P01 | 20min | 1 tasks | 6 files |
| Phase 76 P02 | 15min | 2 tasks | 5 files |
| Phase 76 P03 | ~15min | 3 tasks | 6 files |
| Phase 76 P04 | 12min | 2 tasks | 2 files |
| Phase 76 P05 | 35min | 3 tasks | 7 files |
| Phase 77 P01 | resumed session ~2h | 3 tasks | 23 files |
| Phase 77 P02 | ~20min | 2 tasks | 9 files |
| Phase 77 P04 | 25min | 2 tasks | 2 files |
| Phase 77 P03 | ~10min | 2 tasks | 6 files |
| Phase 77 P05 | 35min | 2 tasks | 4 files |
| Phase 77 P06 | 20min | 2 tasks | 1 files |
| Phase 78 P01 | 20min | 2 tasks | 11 files |
| Phase 78 P03 | 15min | 2 tasks | 2 files |
| Phase 78 P02 | 20min | 2 tasks | 7 files |
| Phase 79 P01 | 10min | 2 tasks | 10 files |
| Phase 79 P02 | ~15min | 2 tasks | 3 files |
| Phase 80 P01 | 25min | 2 tasks | 12 files |
| Phase 80 P02 | ~20min | 3 tasks | 2 files |
| Phase 80 P03 | 11min | 2 tasks | 8 files |
| Phase 80 P06 | 10min | 1 tasks | 1 files |
| Phase 80 P04 | ~15min | 2 tasks | 3 files |
| Phase 80 P05 | ~10min | 2 tasks | 2 files |
| Phase 80 P07 | 35min | 2 tasks | 2 files |
| Phase 260730-e6z P01 | 25min | 1 tasks | 6 files |
| Phase 82 P01 | 35min | 2 tasks | 4 files |
| Phase 82 P02 | 25min | 2 tasks | 5 files |
| Phase 82 P03 | 25min | 2 tasks | 2 files |
| Phase 83 P01 | 48min | 2 tasks | 2 files |
| Phase 83 P02 | 7min | 2 tasks | 5 files |
| Phase 83 P03 | 8min | 2 tasks | 7 files |
| Phase 83 P04 | 32min | 3 tasks | 7 files |
| Phase 83 P05 | 3min | 3 tasks | 7 files |
| Phase 83 P06 | 12min | 1 tasks | 2 files |
| Phase 84 P1 | 40min | 2 tasks | 9 files |
| Phase 84 P02 | 30min | 3 tasks | 11 files |
| Phase 84 P03 | 25min | 3 tasks | 5 files |
