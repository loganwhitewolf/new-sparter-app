# Milestones

## v3.0 Categories Year View (Shipped: 2026-08-03)

**Delivered:** The Categories dashboard section reads on a coherent yearly axis — monthly pace and
year-end projection replacing the rolling-preset model — with the Deviation, Baseline, Noise
Threshold and Preset vocabulary retired from both the interface and the codebase.

**Phases completed:** 3 phases (82–84), 13 plans, 30 tasks
**Closeout:** verified_closeout — audit 25/25 requirements, 3/3 phase verifications, 5/5 integration
checks, 4/4 E2E flows, Nyquist 3/3 compliant. Design locked in
[ADR 0020](../docs/adr/0020-categories-year-view-retires-deviation.md) +
`dashboard-categories-DECISIONS.md` (D1–D19).

**Stats:** 112 commits (`ba039ba4`..`2e526817`) · 133 files · +22,490 / −2,489 · 4 days
(2026-07-30 → 2026-08-03) · suite 183 files / 2194 tests green, 1 pre-existing todo

**Key accomplishments:**

- **Number engine on a yearly axis** — Covered/Partial Month classification, monthly pace, year-end
  projection with a type-unreadable insufficient-coverage outcome, the hybrid current-month value
  `max(spent so far, pace)`, and the total-equals-sum-of-series invariant. All pure Decimal.js,
  proven against real Postgres before any UI shipped.
- **Cassa/competenza lens confined to Overview** (amends LENS-01 of ADR 0019) — Categories is
  pinned to cash *by construction*: no `ledgerRowSource` argument can reach the category DAL
  functions from either page, and `LensSwitch` has exactly one render site.
- **Categories list rewritten on year + direction** — ranking by total with % share, a 12-month
  sparkline, a subordinate labelled year-end projection, a sort-by-projection toggle, and
  Accantonamenti reachable for the first time.
- **Category detail as a 12-month table** — month-over-month delta inside each cell, a previous-year
  comparison row with D-11/D-12 stated-reason gates, a re-anchorable 9/6/3-month window scoping
  every figure on the page, and subcategory contributions that provably sum to the parent's
  difference (including subcategories present in only one period).
- **Deviation/Baseline/Noise-Threshold/Preset retired outright** — the four cross-page aggregation
  functions moved from preset-shaped `DashboardFilters` to an explicit `{from, to, type}` range; the
  caller-less `getOverview`/Deviation chain, 4 components and 3 test files deleted; an
  identifier-scoped exit grep and a 25-test `retired-vocabulary-guard.test.ts` keep it gone.
- **RETIRE-05 regression gate held end to end** — Overview and Tags totals stayed byte-identical
  across every engine and DAL signature change, re-run at each phase boundary.

### Known Gaps

None against the v3.0 requirement contract — all 25 satisfied with three-source agreement
(traceability × VERIFICATION × SUMMARY frontmatter).

### Technical Debt Accepted at Close

Audit status was `tech_debt` rather than `passed`; the two headline items were consciously accepted
at close rather than fixed (decision 2026-08-03).

- **No v3.0 flow exercised in a browser.** Playwright (`tests/dashboard.spec.ts`) is blocked by a
  pre-existing `proxy.ts` auth redirect loop (`ERR_TOO_MANY_REDIRECTS`) that also blocked v2.9's
  Phases 78 and 80. Two consecutive milestones now — this debt is compounding. RETIRE-03 is proven
  by unit tests plus a one-hop import-graph walk instead.
- **Accantonamenti is reachable but not drillable.** Phase 83's non-interactive-span guard was
  framed as temporary pending Phase 84, but Phase 84 shipped without an allocation detail page, so
  the guard is now the de facto permanent contract. CLIST-04 is satisfied as written.
- 65 occurrences of the unguarded `describeIfReachable` skip pattern can report vacuous green in CI;
  only 2 files opted into `assertHarnessReachableInCi`.
- Phase 83 accessibility/test-quality items: `aria-disabled` on a role-less `<span>` (WR-01), a
  deleted D-13 rationale comment (WR-02), allocation row fields not asserted together (IN-03),
  `toContain('<a')` substring matching instead of DOM assertion (IN-04).

**Carried from v2.8 / v2.9:** operator deploy R038 / R039 / R041 with live migrations 0028–0033 and
the seed run order (still the next candidate milestone); Phase 78 browser UAT.

**Correction (2026-08-03, at merge time):** the audit and the notes above inherited a claim that
`git tag v2.9` was still pending. It was not — v2.8 and v2.9 were both tagged when they merged
(`v2.8` → PR #52 merge `91299769`, `v2.9` → PR #59 merge `68796fe1`, plus patch tags v2.9.1–v2.9.3).
The claim survived because every milestone close writes "tag pending post-merge" and nothing clears
it once the tag exists. Corrected across PROJECT.md, ROADMAP.md and STATE.md.

**Shipped:** merged into `main` as `fa7d5b8a` (merge commit, history preserved) and tagged **v3.0**.
Merging `main` in first surfaced a silent CLIST-05 violation in the Overview KPI deep-links, plus 19
typecheck errors and 11 test failures PR #66 had left red on `main` — all fixed before the merge.
Final state: 188 files / 2263 tests passed / 0 failed.

### Process Lesson

Deleting a component during Phase 84's retirement sweep silently deleted a *different* phase's
requirement coverage — `tests/dashboard-filters.test.ts` was named for the component it sat beside
rather than the requirement it guarded (RETIRE-04), and two verification passes then cited a file
that no longer existed. Requirement-critical assertions should live in files named for the
requirement or the function under test. Separately, two of three phases needed a re-verification
pass to catch a real defect a first pass had signed off, one of them a self-referential assertion.

---

## v2.9 Amortization (Shipped: 2026-07-29)

**Phases completed:** 5 phases, 19 plans, 37 tasks

**Key accomplishments:**

- amortization_plan/amortization_instalment schema + ledger_entry_cash/accrual Postgres views + Decimal.js instalment math + full "Ammortizza" row-action activation (dialog -> atomic detach+plan+instalment write) + D-04..D-07 eligibility guards + getOverviewAmountTotals migrated with a byte-identical LENS-03 regression proof
- D-09 "rimuovi ammortamento" undo path (reverseDetachTx: atomic plan+instalment delete, reverse-detach re-attaching the transaction to its shared Expense by recomputed original descriptionHash) plus detail-page parity for both "Ammortizza" and "Rimuovi ammortamento"
- Third AMORT-01 entry point: an inline "Ammortizza questa transazione" checkbox on the manual create-transaction form that atomically creates, detaches, plans, and materialises instalments in one db.transaction, reusing activatePlanTx unmodified
- Migrated the remaining five `lib/dal/dashboard.ts` cash-lens aggregation functions (getCategoriesBreakdown, getCategoryRanking, getCategoryDeviations, getCategoryDetail, getMonthlyTrendByNature) off `effectiveAmount()`/`isNotSecondary()` onto `ledger_entry_cash`, closing D-11/LENS-03 for dashboard.ts entirely
- Migrated the last 4 gated dashboard aggregation functions (`getMonthOverMonthCategoryChanges`, `getOverviewChart` in `overview.ts`; `getTagTotals`, `getTagDetail` in `tags.ts`) off `effectiveAmount()`/`isNotSecondary()` onto `ledger_entry_cash`, closing full 10-function LENS-03 coverage and proving reimbursement/amortization non-interaction
- Closed the LENS-03 phase gate by proving the full 153-file/1866-test vitest suite is green post-seam-migration (not just the regression file), and structurally verifying zero production call sites still reach effectiveAmount()/isNotSecondary() directly
- closePlanTx collapses every remaining instalment of an open amortization plan onto one Decimal-summed closure-month row, wired end-to-end from a "Chiudi ammortamento" dialog on both the transaction row and detail page, real-Postgres-proven not to disturb the cash lens.
- realizePlanTx (close-for-sale, dual-lens netting via composed closePlanTx + reused createPairTx) and reducePlanTx (open-plan reduce+re-spread) plus the AmortizationReimburseDialog intent-prompt that routes a reimbursement link to whichever one the user chooses.
- Extended `updateTransaction`'s pair-guard model with an amortization-plan branch: amount/date edits on a transaction with an OPEN amortization plan are hard-blocked (including date-only edits, a gap the pre-existing pair-guard never covered), while subcategory/title edits and edits on closed/unamortized transactions stay unaffected — zero action-layer changes needed.
- `/amortizations` registry page listing every amortization plan (open+closed) with Decimal-precise consumed/net values, an open-only-by-default status filter, an X/N + progress-bar months column, and a single total-open-net-residual KPI — reusing the v2.8 `/reimbursements` RSC/DAL/table stack.
- Wired "Chiudi" (reuses the existing `CloseAmortizationDialog` verbatim, scrap-close only) and "Realizza con vendita" (deep-link to the transaction detail page) row actions onto the `/amortizations` registry table, gated to open plans only via a single exported `resolveRowActions(row)` predicate, plus a real-Postgres proof that the registry's read path and Phase 78's `closePlanTx` write path never numerically diverge.
- Threaded `?lens=cassa|competenza` through `getOverviewAmountTotals`/`getOverview` and rendered a global `LensSwitch` on `/dashboard/overview`, proving the ledger_entry row-source seam on one real path with a real-Postgres regression gate before fanning out to the remaining nine aggregation sites.
- Migrated the remaining five `lib/dal/dashboard.ts` aggregation functions (getCategoriesBreakdown, getCategoryRanking, getCategoryDeviations, getCategoryDetail, getMonthlyTrendByNature) to the Plan 80-01 `ledgerRowSource` seam, redesigning getCategoryDetail's Top 5 movimenti sub-query with a display-only LEFT JOIN so an amortization instalment row surfaces under competenza.
- Migrated the movers drill-down (`getMonthOverMonthCategoryChanges`) and 12-month bar chart (`getOverviewChart`) to the `ledgerRowSource` pattern, and separately made `getYearsWithData`/`getMonthsWithData` lens-aware via an additive UNION against `amortization_instalment` — so an accrual-only future instalment year/month is never hidden from the selector, with `resolveYear` clamping a cross-lens period mismatch to the active lens's latest year.
- `/dashboard/overview` now fetches both lenses' years unconditionally, resolves the active year through the D-10 cross-lens clamp, and threads one shared `ledgerRowSource` into the KPI totals, 12-month chart (incl. prior-year YoY), and movers drill-down; `buildDashboardTabHref` carries `?lens=` across tab navigation exactly like `preset`/`type`/`sort`/`tag`.
- Wired `/dashboard/categories` and `/dashboard/categories/[id]` to the global cassa/competenza lens by reusing the Plan 80-01 `LensSwitch`/`parseLensParam`/`resolveLedgerRowSource` infrastructure and Plan 80-02's already-migrated DAL functions — zero new DAL or component code, pure call-site threading.
- `/dashboard/tags` now renders the global LensSwitch disabled with the D-05 no-op note, parsing `?lens=` only for the switch's visual state while `getTagTotals` stays exactly `getTagTotals(userId)`; `/tags/[id]` remains untouched.
- Authored the phase-closing Playwright LENS suite across all four dashboard sub-routes exactly per spec and re-ran the full regression trio green, but could not drive the browser suite to a passing run in this sandbox — diagnosed and documented a pre-existing, unrelated `proxy.ts` staging-bypass bug (infinite redirect loop) that blocks every dashboard Playwright spec, old and new alike.

---

## v2.8 Reimbursements 1:N (Shipped: 2026-07-27)

**Phases completed:** 4 phases, 17 plans, 35 tasks

**Key accomplishments:**

- Generalized 1:1 `transaction_pair` into `reimbursement`/`reimbursement_refund` (D-03 XOR anchor), backfilled via a sign-based migration, rewrote `effectiveAmount()`/`isNotSecondary()` to read only the new tables, and proved N=1 + empty-refund correctness with a real-Postgres regression harness across all 10 aggregation call sites.
- D-02 outflow-anchor/inflow-refund invariant module plus a 5-scenario real-Postgres regression matrix (dinner N=3, both adjacency directions, refund-order determinism, Q3 tie-break) and the first numeric proof of migration 0029's backfill correctness, each scenario asserted across the full 10-function aggregation surface via 73-01's captureAggregationSnapshot harness.
- Repointed `createPair`/`deletePairByTransactionId` and `getEligibleCounterparts` from `transaction_pair` onto `reimbursement`/`reimbursement_refund` (sign-based anchor resolution, retiring the Phase 50 magnitude tie-break), then executed Plan 73-01's locked drop decision and closed Phase 73 with a green 1756-test suite.
- Rewrote `effectiveAmount()` from a two-branch earliest-transaction-wins CASE into one uniform proportional-spread SQL expression covering both Expense and Expense Group anchors, with largest-remainder cent exactness and a zero-sum division guard, proven against 8 regression scenarios (19 tests) on real Postgres.
- `getReimbursementAggregates()` + `computeReimbursementResidual()` deliver residual as a Decimal-safe, on-the-fly computed value (never persisted) — owed/settled/surplus across Expense and Expense Group anchors, IDOR-safe by WHERE-clause construction, proven by 7 real-Postgres tests.
- buildPairGuardMessage() names the blocking reimbursement by title when N>1 linked refunds exist; N<=1 stays byte-identical to the pre-Phase-74 message — the guard's hard-block condition itself is untouched.
- Closed both CONFIRMED critical gaps from 74-REVIEW.md (CR-01/CR-02) in the RMB-09 amount-edit pair guard, plus a correlation-ambiguity bug the fix's own real-Postgres tests surfaced in the same code block — the pair guard's refund-edit branch had never been exercised against a real database until this plan.
- Closed the reimbursement anchor-contamination gap by making the anchor transaction-granular via a new frozen `reimbursement_anchor_transaction` join table, repointed `effectiveAmount()`'s Expense-anchor branch to read it exclusively, and proved a same-merchant re-import can no longer inherit a share of a past refund.
- Generalized the reimbursement write path from "always create, Expense-anchor only" to create-or-append with either an Expense or Expense-Group anchor, and generalized the eligible-counterparts candidate query from a single self-exclusion id to a set — the backend prerequisite the multi-select picker (Plan 75-04) and unlink lifecycle (Plan 75-03) both build on.
- Pre-link snapshot table + shared restore helper close the reversibility gap: unlinking a refund or deleting a whole reimbursement now reverts the refund-cleanup recategorization createPairTx applies at link time, not just the link row.
- getReimbursementList DAL (Expense-anchor-only, shared residual derivation) and the first real `/reimbursements` list page, proven end-to-end on seeded data
- REIMBURSEMENTS_TABLE_CONFIG + client ReimbursementTable reusing the unified DataTableToolbar/HeaderSortButton system for search, a 3-state status filter, and sortable Titolo/Netto/Data columns, all operating client-side over the already-fetched row set
- The transactions-table reimbursement badge becomes a Link to /reimbursements/[id], and a "Rimborsi" sidebar item makes the section reachable without typing the URL
- Split ReimbursementPanel into 'summary' (read-only, links to /reimbursements/[id]) and 'management' (unchanged full add/remove/delete) variants, activated on /transactions/[id]
- `/reimbursements/[id]` — header (editable title + D-07 status KPI + anchor link) over the reused Plan 76-04 `ReimbursementPanel` full-management variant, closing RMB-11's complete contract
- Human-approved end-to-end confirmation of the dedicated Rimborsi section, plus two UAT-discovered fixes: a no-404 redirect when a reimbursement is removed, and removal of the synthetic "rimborso &lt;anchor&gt;" refund-title rewrite.

---

## v2.7 Tag Dedicated View (Shipped: 2026-07-22)

**Phases completed:** 4 phases, 6 plans, 50 commits (`v2.6..v2.7`), 185 files (+5177 / −1251)

**Key accomplishments:**

- `/tags/[id]` — the canonical all-time per-tag page (Variant A "report verticale"): three reconciled totals (Entrate / Uscite / Valore finale via the single numeric source `getTagDetail`/`getTagTotals`), included-transaction count, per-category CSS-bar breakdown with signed amounts, and a compact date-descending transaction list — no charting dependency.
- In-place edit/archive of the tag directly from the page, with entry points from both `/tags` and `/dashboard/tags`.
- Removed the period-scoped `?tag=` dashboard filter entirely — `TagFilterSelect`, `tagId` threading through the overview/category DAL, the `no-data-for-tag` empty state, and `parseTagIdParam` — so per-tag analysis now lives only in the dedicated all-time page; legacy `?tag=` dashboard URLs render the normal unfiltered dashboard.
- Transactions toolbar gained a tag filter control integrated into the existing unified filter/sort system (writes `?tag=`, persisted via the sessionStorage restore layer, shown as an active chip, cleared by clear-all) — the list keeps a tag *navigation* filter while the dashboard loses the tag *analysis* filter.
- Inline tag chip on the transaction title line (after the ellipsis when truncated) with a hover/tap popover listing the linked tags — replaced the wrapping name-chips block, keeping every row one line tall.

**Model note:** tags are event-shaped — the canonical per-tag view is all-time (every transaction carrying the tag, regardless of calendar); `dateRange` is a descriptive label, not a filter.

---

## v2.5 Detail Pages (Shipped: 2026-07-07)

**Phases completed:** 3 phases, 13 plans, 23 tasks

**Key accomplishments:**

- `updateTransaction` service — atomic amount/date/title edit with frozen hashes, same-transaction expense reconciliation, and a pre-write pair-invariant guard (Italian "Scollega prima il rimborso")
- 1. [Rule 3 - blocking] Widened drizzle-orm and schema mocks beyond the plan's minimal shape
- Ownership-scoped `getTransactionForDetail`/`getExpenseForDetail` DAL queries plus a shared `DetailPageShell` layout component and route builders — the read-side foundation Plans 02/03 will wire into `/transactions/[id]` and `/expenses/[id]`.
- `/transactions/[id]` — ownership-gated RSC page with pencil-inline amount/date/title editing wired to Phase 62's `updateTransactionAction`, category editing via the existing `ExpenseCategorizeDialog`, and full reuse of `CounterpartPickerDialog`/`DetachExpenseDialog`/delete confirmation with zero new server actions.
- `/expenses/[id]` — ownership-gated RSC page merging the existing "dettagli" and "modifica" expense dialogs into one route page, with pencil-inline title/notes editing, category editing via the existing `categorizeExpense` action, readonly derived totals, and a linked-transactions table cross-referencing `/transactions/[id]`.
- Transaction table row menu gains a "Dettagli" entry linking to `/transactions/[id]`; expense table's "Dettagli"+"Modifica" pair collapses into a single "Dettagli" link to `/expenses/[id]`, retiring the table's edit-dialog and transactions-dialog call sites (DET-07).
- Canonical `importFileDetailHref` route builder plus two ownership-scoped DAL queries (`getTransactionsByFileId`, `getFileDetailForUser`) that later Phase 64 plans build the file detail page and cross-references on.
- TransactionTitleEdit and ExpenseTitleEdit now render the row title as a genuine `next/link` Link to the entity's detail page, with the pencil icon split into its own independent edit-trigger button — closing the DET-09 gap where clicking a row title never navigated anywhere.
- `/import/[fileId]` RSC route with exhaustive ownership+status gating plus `FileDetailClient`, the third and final detail page in the v2.5 trilogy — files are now navigable first-class entities with editable displayName, readonly stats, a linked transactions preview, and lifted download/suggestions/delete actions.
- Import table file names are now real links to `/import/[fileId]` with a "Dettagli" menu entry, and every remaining `/import?fileId=` cross-reference in the codebase (transaction table, transaction detail, expense detail) is repointed to `importFileDetailHref`.
- DetailPageShell's back control now tries `router.back()` first (preserving the origin table's ephemeral filters/sort/scroll) and falls back to the static `backHref` route only when there's no usable in-app history — retroactively completing "consistent back behavior" (DET-09) for all three detail pages (transaction, expense, file) from one shared implementation.
- DetailPageShell arms a one-time popstate listener before router.back() to force-refresh the destination table's RSC payload, closing the UAT-reported "filter lost on Indietro" defect without touching the static-fallback path.
- Added `.group` Tailwind ancestor to the three detail-page title wrappers so the shared inline-edit pencil is finally discoverable on hover, and replaced the broken `document.referrer` smart-back check with a pure `hasInAppHistory(historyLength)` helper.

---

## v2.4 Standalone Expense (Shipped: 2026-07-01)

**Phases completed:** 1 phases, 2 plans, 6 tasks

**Key accomplishments:**

- Subcategory capture and single-transaction in-place re-hash added to `detachTransactionToDedicatedExpense`, replacing the `SINGLE_TRANSACTION_EXPENSE` guard, with a hash-level test proving the standalone expense stays out of aggregation and Tier 2.
- Inline "Spesa a sé (non aggregare)" action wired into the transactions table row menu on any transaction with a linked expense, capturing title + subcategory in one dialog flow via the reused SubcategoryPicker, landing the detached expense already categorized without a second dialog step — human-verified in-browser on both multi- and single-transaction cases.

---

## v2.2 PDF Import (Shipped: 2026-06-26)

**Phases completed:** 2 phases (56–57), 10 plans
**Git range:** 5c9e8ec → dc1fd62 · 52 files · +11129 / -235 lines · 2 days
**Closeout type:** override_closeout (no formal audit — both phases verified, all 10 requirements satisfied)

**Key accomplishments:**

- Parsing contract (`delimiter`, `*Column`, `dateFormat`, `dateReplace`, `decimalReplace`, `multiplyBy`, `descriptionStripPattern`, `amountType`) moved from `platform` to `import_format_version` via two-step migration (ADD nullable → data copy → DROP); behavior proven identical by regression test over 7 real CSV fixtures (Phase 56)
- `platform` reduced to pure identity (`name`, `slug`, `country`, `visibility`, `ownerUserId`); multiple versioned format contracts per bank are now expressible with a `unique(platformId, version)` constraint (Phase 56)
- Trade Republic PDF parser built on `unpdf` positional X-coordinate column detection + Decimal.js balance chain validation; only "TRANSAZIONI SUL CONTO" section extracted, summaries and mirror sections discarded (Phase 57)
- PDF rows normalized to `ParsedImportFile` with synthetic headers — detector, `normalizeTransactionRow`, dedup, and preview pass unchanged; `descriptionStripPattern` strips `quantity:` serial token so savings plan rows aggregate into a single Expense (Phase 57)
- User-friendly Italian "PDF non riconosciuto" error UX with supported-platform list; `PDF_IMPORT_PLATFORM_SLUGS` allowlist co-located with `.pdf` dispatch as the single source of truth for adding future banks (Phase 57)

---

## v2.1 Regex Discovery & Transaction Unification (Shipped: 2026-06-22)

**Phases completed:** 5 phases (51–55), 15 plans
**Git range:** 11d1f9f → 09d0f57 · 89 files · +11214 / -803 lines · 50 commits · 8 days
**Known deferred items at close:** 5 (see STATE.md Deferred Items)

**Key accomplishments:**

- Standalone `discoverRegexCandidates` service with Set B filter (`isNull(subCategoryId)`), platform-specific normalization strip, and D-05 metadata — regex discovery extracted from the import flow and independently callable with only `userId` + `platformId` (Fase 51)
- Two-list `DiscoveryResult` with RDISC-01/02 routing (regex vs single-cat), Check 1 active-pattern dedup, and Check 2 manual-history hash dedup — zero false-positive proposals (Fase 52)
- Platform-scoped retroactive application via `promoteSuggestionAction` with IDOR guard (`getPlatformIdForUserFile`): promotes a candidate to a pattern and immediately categorizes the platform's uncategorized history, returning inline Italian count copy on the suggestion card (Fase 53)
- Single service (`discoverRegexCandidates`), two entry points: auto post-import non-fatal run with `discoveryCount` CTA (TRIG-01) and per-row "Ricontrolla regex" from the Files table via `recheckRegexAction` (TRIG-02) — no divergent implementation (Fase 54)
- `detectPatternSuggestions` fully removed from utils and import service; `sampleRows` capped at 10; `SuggestionSection` with distinct headings + intro text; SUMUI-03 discovery-step paragraph — clean import summary UX (Fase 55)

---

## v2.0 Nature/Direction Model Realignment (Shipped: 2026-06-14)

**Phases completed:** 5 phases, 22 plans, 37 tasks

**Key accomplishments:**

- `direction` and `nature` lookup tables added to schema.ts with NOT NULL FK chain, 3 deprecated enums removed, `category.type` + `amount_sign` dropped, and pattern unique constraint shrunk to `(pattern, subCategoryId)` — schema authorship complete, no migration generated (D-06)
- 1. [Rule 1 - Bug] FlowNature v2.0 codes in NATURE_SLUGS record
- direction (4) and nature (8) baseline lookup rows authored in seed-data.ts; seed.ts wired in FK order with setval; removed-column writes cleaned from both seed scripts (build-survival for 46-01 schema, D-05)
- Fixture manifest esplicito (23 cat / 87 sub) e 6 test Vitest RED che gateano il wholesale replace di seed-data in Plan 02
- 23 active v2 categories and 87 natureId-tagged subcategories replace v1 literals in seed-data.ts; Wave 0 contract tests GREEN
- 28 sign-agnostic categorizationPatterns retargeted to v2 slugs; seed.ts passes natureId and sets excludeFromTotals on v2 TRANSFER subs
- Step 1 no-op plus seven additive v2 seed-extras steps for deployed DB remap and code-based nature_id backfill — ready for Phase 48 operator apply
- R-FN-03 seed nature assignment tests enabled against v2 subCategories.natureId — Phase 47 closes with 949 tests and production build green without DB apply
- Task 1
- Read-only operator verification script asserting D-04 nature_id coverage + MIG-03 pattern dedup via fatal/info split, with `db:verify*` npm scripts and a pure classifier unit test.
- Authored MIGRATION-RUNBOOK.md (canonical D-06 order, pg_dump/pg_restore rollback, staging-first gate) and drove the guarded apply of migration 0018 + seed + seed-extras to the deployed DB, with the staging/backup deviation documented in the runbook.
- 1. [Rule 1 - Bug] savingsRate expected value corrected from 33 to 33.3
- Restored `CategoryWithSubCategories.type` as a real direction code via correlated subquery, re-pointed transaction/expense filters from `nature.code` to `direction.code`, and wired `getMostUsedSubcategories` direction filtering — unblocking cascade-options and the SubcategoryPicker.
- 1. [Post-checkpoint fix] KPI "Accantonato" showed negative values
- Rewired all categorization surfaces to the nature→direction model: buildDirectionNatureMap with allocation bucket, 4-direction SubcategoryPicker chips, table filters keyed by direction, settings panel grouping by direction, and nature write-path fixed to pass real natureId via NATURE_ID_BY_CODE.
- Rimossa la colonna `sub_category.exclude_from_totals` dallo schema e dal database via migration 0019; `direction.included_in_totals` è ora l'unica fonte di verità per l'esclusione dai totali di spesa.
- tests/transaction-pairs-service.test.ts
- Drizzle transaction_pair table (dual single-column UNIQUEs + cascade FKs) materialized in local DB via 0020 migration, plus shared isNotSecondary()/effectiveAmount() SQL fragment helpers
- Ownership-validating pairing service with Decimal.js primary resolution, counterpart-picker DAL (verifySession-scoped + NOT EXISTS), and thin server actions — 23/23 Plan 01 RED tests now GREEN.
- Dashboard and overview aggregations netted via shared `isNotSecondary()`/`effectiveAmount()` fragments at all 8 sites; transaction list exposes 4 paired fields via correlated subqueries.
- Full pairing UX shipped: "Collega rimborso"/"Scollega" row actions, searchable counterpart picker dialog, inline signed-net badge, and counterpart-detail popover — operator-verified end-to-end including dashboard netting and unlink baseline restoration

---

## v1.16 Dashboard Overview Redesign (Shipped: 2026-06-09)

**Phases completed:** 4 phases, 13 plans, 19 tasks

**Key accomplishments:**

- FlowNature union extended to 9 members with income_extraordinary, standalone ADD VALUE migration generated, two dashboard helpers exported, and failing test scaffold created for overview DAL
- PO confirmed candidata-base slug list — dividends (`dividendi-azionari`, `dividendi-fondi-comuni`, `dividendi-immobiliari`) stay as `income` (recurring). 22 slugs move to `income_extraordinary`.
- Four year-scoped DAL functions implementing the overview data contract — getYearsWithData, getOverview, getMonthOverMonthCategoryChanges, getOverviewChart — plus CONTEXT.md glossary update
- Ported PO-approved proto KPI row (ReadingKpiCard + reading helpers), production EUR formatters, and inline year-selector header into `components/dashboard/overview/` wired to real `OverviewData` DAL types.
- `components/dashboard/overview/format.ts`
- Year-scoped async Server Component wiring OverviewHeader + KpiRow + OverviewChart to Phase 42 DAL with D-04 resolution and D-06 empty states.
- 1. [Rule 3 - Blocking] Cherry-pick Plan 43-03 prerequisite commits
- execution start
- `fetchMovers` server action + `formatMoverLine`/`splitMovers` pure functions with Vitest coverage — data and presentation contracts for the movers panel
- Controlled OverviewChart + OverviewMoversSection shared-state parent + OverviewMoversPanel inline panel — interactive movers drill-down wired end-to-end
- All five MOVE requirements verified end-to-end in the browser: bar click highlights + updates panel (MOVE-01), red/green sections hide when empty (MOVE-02), humanized Italian sentences with "spesa nuova" for new spend (MOVE-03), default to last month with data (MOVE-04), empty state for first month (MOVE-05)

---

## v1.15 — Collapsible Sidebar

**Shipped:** 2026-06-07
**Phases:** 41 (1 phase)
**Plans:** 3
**Tasks:** 7

### Delivered

Replaced the two-zone topbar+sidebar layout with a single collapsible icon-rail sidebar. The sidebar collapses to w-16 (icon-only with tooltips) and expands to w-60, persists state in localStorage key `sparter-sidebar-collapsed`, and contains all nav + user controls. Topbar deleted on all breakpoints. BottomNav gained a 5th "Impostazioni" entry. ThemeToggle moved to SettingsHub Aspetto section. ADR 0011 locked the decision.

### Key Accomplishments

1. `SidebarProvider` + `useSidebarCollapsed` hook: SSR-safe `useState(false)` default, `useEffect` restores from localStorage after mount — prevents hydration mismatch (D-14)
2. `AppShell` client component drives `<aside>` width (`md:w-16`/`md:w-60`) from SidebarContext; RSC layout wraps `AppShell` in `SidebarProvider`; topbar import removed (D-01)
3. Sidebar rewritten: chevron toggle with aria-labels, icon-only+tooltip collapsed nav (mounted guard), user Avatar dropdown at bottom with Profilo + Logout (D-03/D-04/D-06/D-07/D-08)
4. BottomNav 5th entry `{ href: APP_ROUTES.settings, label: 'Impostazioni', icon: Settings }` (D-10); SettingsHub Aspetto section with ThemeToggle (D-11/D-12); topbar.tsx deleted
5. Nyquist audit: `tests/sidebar-provider.test.tsx` (D-13/D-14) + `tests/settings-hub.test.tsx` (D-11/D-12) added; 836 tests green

### Known Deferred Items

- Quick-task tracking artifacts acknowledged at close (4) — same pre-existing items as v1.14: `260524-pha`, `260524-pnk`, `260525-ga2`, `260530-bib` (see STATE.md Deferred Items)
- D-03/D-07/D-09 manual-only verification (see 41-VALIDATION.md)

### Archive

- `.planning/milestones/v1.15-ROADMAP.md`

---

## v1.14 — Unified Table Filter & Sort

**Shipped:** 2026-06-04
**Phases:** 40 (1 phase)
**Plans:** 5
**Tasks:** 11

### Delivered

Unified filtering and sorting across the Transactions, Expenses, and Files tables behind one declarative `DataTableToolbar` driven by per-table `TableConfig`. URL is the single source of truth, filtering runs server-side, every DAL sort carries an `id` tiebreaker, Expenses have no temporal filter (ADR 0009), and there is no filter engine (ADR 0010).

### Key Accomplishments

1. Shared `TableConfig` / `FilterField` / `SortColumn` types and total URL param parsers (`parseMonths`, `parseAmount`, `parseStatus`, `parseSortDir`) with `id` tiebreaker appended to all transaction and import DAL `orderBy` calls
2. Shared `DataTableToolbar` consuming `TableConfig`: inline search, "Filtri (n)" Popover, active-chip row ("Cancella tutto"), mobile Sheets for filters + sort, desktop `HeaderSortButton` with `aria-sort` and ASC→DESC→off cycle — all state in the URL via `useTableUrl`
3. Session-scoped `getMonthsWithData` DAL (TDD) + data-aware `MonthMultiPicker` (year-grid, presets, "Tutto l'anno") + `AmountRangePicker` (absolute-value inputs) replacing Wave-2 placeholders
4. Three `TableConfig` objects + DAL WHERE conditions + rewired pages: Transactions (months/amount/platform/category/categorization), Expenses (no temporal, all-time default, status-4→uncategorized), Files (3 processing buckets, coverage months, platform, amount)
5. `EmptyState` component (no-data vs no-result) wired in all three table pages, mobile sort button labeled, legacy URL params silently dropped in total-function parsers, prototype route deleted, `yarn build` green

### Known Deferred Items

- Quick-task tracking artifacts acknowledged at close (4) — flagged by the open-artifact audit but triaged as already-shipped or deferred, none part of v1.14 scope: `260524-pha` (empty dir, dup of `pnk`), `260524-pnk` (shipped 889ae56), `260525-ga2` (shipped 4a722f2), `260530-bib-description-strip-pattern` (descriptionStripPattern — shipped separately, migration 0015)
- R038, R039, R041 — live Vercel/Supabase/R2 deploy operator-pending
- R029 — partial categorization revalidation coverage

### Archive

- `.planning/milestones/v1.14-ROADMAP.md`

---

## v1.13 — Unified Categorization Picker

**Shipped:** 2026-06-02
**Phases:** 39 (1 phase)
**Plans:** 6
**Commits:** ~50

### Delivered

Replaced three divergent subcategory-selection implementations with a single reusable `SubcategoryPicker` (vaul bottom sheet, variant E). Adopted across all 7 selection surfaces. Pattern and suggestion-promotion forms reduced to regex + description + Categorizza button; `amountSign` derived server-side from category type per ADR 0008; `confidence` hardcoded to 1. Old `CategoryCombobox`, `SubcategoryCombobox`, and cascading Select pairs deleted.

### Key Accomplishments

1. `SubcategoryPicker` (vaul bottom sheet): fixed-height, type chips (Entrate/Uscite/Trasferimenti), two-column master-detail, search-collapse, single `subCategoryId` output
2. `getMostUsedSubcategories` DAL: top ~6 per-user by categorization count, hidden at cold-start
3. Adopted picker in 4 commit-on-tap surfaces: single expense, transaction-table, bulk, onboarding step 4
4. Adopted picker in 2 fill-field forms: create/edit expense, create transaction — cascading Selects deleted
5. Pattern + suggestion-promotion forms reworked: `amountSign` server-side from category type, `confidence=1` (ADR 0008)
6. Cleanup: `CategoryCombobox` + all legacy picker code deleted; prototype route removed; `yarn build` + `yarn check:language` green

### Known Deferred Items

- `260530-bib-description-strip-pattern` — `descriptionStripPattern` field on Platform (plan exists, not executed; backlog for next milestone)
- R038, R039, R041 — live Vercel/Supabase/R2 deploy operator-pending
- R029 — partial categorization revalidation coverage

### Archive

- `.planning/milestones/v1.13-ROADMAP.md`

---

## v1.12 — First-import Onboarding

**Shipped:** 2026-05-28
**Phases:** 38 (1 phase)
**Plans:** 3
**Commits:** ~38

### Delivered

New users with zero transactions see a dedicated 5-step onboarding flow instead of an empty dashboard. Flow: upload → overview → categorization education → manual categorization wizard → outro. RSC layout routing gate redirects all authenticated routes to `/onboarding` while `count(transaction) === 0`.

### Key Accomplishments

1. DAL foundation: `getTransactionCount`, `getTopUncategorizedExpenses`, `getFileCoveredMonths`, `formatMonthRange`
2. RSC layout gate in `app/(app)/layout.tsx` — Drizzle not allowed in Edge runtime, implemented in RSC per D-11
3. Onboarding route group + Steps 1–3: upload (reuses R2 presigned PUT), overview (real data), education (giroconto tip)
4. Step 4: manual categorization wizard with FlowNature badges + `onboardingCategorizeExpense` action
5. Step 5 outro + full-screen hero design (dark bg Steps 1–3+5, light bg Step 4) + prototype deletion

### Known Deferred Items

- R038, R039, R041 — live Vercel/Supabase/R2 deploy operator-pending
- R029 — partial categorization revalidation coverage

---

## v1.11 — FlowNature & Segmented Chart

**Shipped:** 2026-05-26
**Phases:** 37 (1 phase)
**Plans:** 5
**Commits:** ~45

### Delivered

Added `nature` enum column to `sub_category` and evolved the dashboard chart into a stacked nature-segmented bar chart with URL-persisted legend toggles. Seeded 126 system subcategories with default natures. Exposed nature override in `/settings/categories`.

### Key Accomplishments

1. Schema migration: `flowNatureEnum` on `sub_category` + `user_subcategory_override`; 126 subcategories seeded with defaults
2. `getMonthlyTrendByNature` DAL + `MonthlyNatureTrendPoint`; `effectiveNature = COALESCE(override, seed default)`
3. Stacked nature `EntrateUsciteChart` with URL-persisted legend toggles (`?hidden=` param); null nature → "non classificato"
4. `SubcategoryNatureSelect` + `setSubcategoryNatureAction` in settings — nature required on creation (default: discretionary)
5. NATURE_COLORS: hex values for Recharts fill; `Transfer` flows excluded via existing `excludeFromTotals`

### Known Deferred Items

- R038, R039, R041 — live Vercel/Supabase/R2 deploy operator-pending

---

## v1.10 — Pattern Suggestions

**Shipped:** 2026-05-25
**Phases:** 33–36 (4 phases)
**Plans:** 9
**Quick Tasks:** 2
**Timeline:** 2026-05-22 → 2026-05-25 (4 days)

### Delivered

Full end-to-end pattern suggestion pipeline for the import flow. Users can now discover recurring uncategorized bank descriptions via a deterministic token-prefix detector, see ranked suggestions during import analysis, promote useful ones to categorization patterns before confirming the import, and re-run suggestion analysis after an import from persisted transactions at `/import/[fileId]/suggestions` — without touching the raw R2 file. Two quick-task fixes added: partial-match-only filter (SUG-07) and pattern application bug with numeric token stripping.

### Key Accomplishments

1. Pure `detectPatternSuggestions` utility — tokenizes bank descriptions, strips numeric tokens, emits longest common prefixes (≥2 tokens, ≥2 uncategorized matches), infers `detectedAmountSign`, escapes regex metacharacters
2. `analyzeFile` extended with isolated try/catch pattern detection — detection failures never block import; `ImportAnalysisResult` carries capped, ranked `patternSuggestions`
3. `promoteSuggestionAction` Server Action with `verifySession()` + `CreatePatternSchema.safeParse()` + hardcoded confidence 0.85 — no UI tamperability
4. `SuggestionSection` + `SuggestionCard` + `SuggestionPromoteForm` components wired into `ImportPreview` and `AnalyzePage` via parallel fetch; 577 Vitest tests GREEN
5. `getUncategorizedTransactionsByFileId` DAL function with `innerJoin` ownership enforcement; `/import/[fileId]/suggestions` server component page with `notFound()` guard
6. `createPattern` handles unique-constraint violations by reactivating soft-deleted user patterns instead of throwing

### Known Deferred Items

- REVAL-01: Apply newly created pattern to existing transactions from same import file
- GLOBAL-01: Pattern suggestions across all uncategorized transaction history
- DISM-01: Persistent dismissal of noisy suggestions
- R038/R039/R041 — live Vercel/Supabase/R2 deploy remains operator-pending
- R029 — partial categorization revalidation coverage

### Archive

- `.planning/milestones/v1.10-ROADMAP.md`
- `.planning/milestones/v1.10-REQUIREMENTS.md`

---

## v1.9 — Social Auth

**Shipped:** 2026-05-22
**Phases:** 30–32 (3 phases)
**Plans:** 9
**Commits:** 45

### Delivered

Enabled Google and GitHub OAuth for Sparter: users can sign in or register with social providers, link or unlink providers from a new /settings/profile page, and the registration guardrail has been removed so any OAuth account can register freely. Settings navigation reorganized with a /settings hub and dedicated profile page hosting ConnectedAccountsCard.

### Key Accomplishments

1. Removed registration guardrail (REG-01) — deleted `lib/auth/registration.ts` and all consumers; any user can now register via OAuth or email/password
2. Added env-conditional Google + GitHub OAuth providers to Better Auth via conditional spread on CLIENT_ID — no code change needed to activate a provider
3. `SocialProviderButtons` client component with inline SVG GitHub icon, pending state, Italian error mapping, and per-page `errorCallbackURL`
4. Login and Register pages converted to async server components reading `process.env` — provider buttons appear only when credentials are configured
5. Settings IA reorganized: `/settings` hub, `/settings/profile` canonical page, `/profile` compatibility redirect shim, topbar retargeted
6. `ConnectedAccountsCard` — link/unlink flows via `authClient`, `canUnlink` guard (credential OR other social), confirmation Dialog, `decodeAndMapError`, stable `PROVIDER_ORDER`

### Known Deferred Items

- LINK-01..04 live OAuth E2E tests are `test.fixme()` stubs — require real provider credentials configured for dev URL
- R038/R039/R041 — live Vercel/Supabase/R2 deploy remains operator-pending (code complete in M007)
- R029 — partial categorization revalidation coverage

### Archive

- `.planning/milestones/v1.9-ROADMAP.md`
- `.planning/milestones/v1.9-REQUIREMENTS.md`

---

## v1.8 — Dashboard Intelligence

**Shipped:** 2026-05-20
**Phases:** 29 (1 phase)
**Plans:** 4
**Tasks:** 16 commits

### Delivered

Made the Sparter dashboard actionable at a glance: deviation badges on category pages show % vs 3-month baseline, the old 5-series MonthlyTrendChart is replaced by two focused charts (EntrateUsciteChart + BilancioBarsChart), and a sort toggle lets users rank categories by deviation or amount.

### Key Accomplishments

1. Fixed D-01 date preset bug — `last-month` now correctly computes both `from` and `to` using `month - 1`
2. Built `getCategoryDeviations` DAL: parallel Drizzle queries for reference + baseline periods, Decimal.js arithmetic, noise threshold €15
3. `DeviationBadge` component with correct color polarity (out: positive = red, in: positive = green)
4. Deleted `MonthlyTrendChart` — replaced by `EntrateUsciteChart` (2 bars) + `BilancioBarsChart` (per-month green/red cells)
5. Sort toggle on `/dashboard/categories` — deviation-sort as default, URL-preserving, tab-nav aware
6. 83 tests green (40 phase-29 utils/dal/badge/charts + 43 plan-04 category/filter tests)

### Known Deferred Items

- R038/R039/R041 — live Vercel/Supabase/R2 deploy is operator-pending (code complete in M007)
- R029 — partial categorization revalidation coverage

### Archive

- `.planning/milestones/v1.8-ROADMAP.md`
- `.planning/milestones/v1.8-REQUIREMENTS.md`
