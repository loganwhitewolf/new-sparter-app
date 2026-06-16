---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: — Regex Discovery & Transaction Unification
status: executing
last_updated: "2026-06-16T17:30:00Z"
last_activity: 2026-06-16 -- Phase 53 Plan 03 complete
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 9
  completed_plans: 9
  percent: 56
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-16)

**Core value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending — all running on a zero-cost personal deploy.
**Current focus:** Phase 53 — retroactive-application

## Current Position

Phase: 53 (retroactive-application) — COMPLETE
Plan: 3 of 3 — ALL PLANS COMPLETE
Status: Phase complete — ready for Phase 54
Last activity: 2026-06-16 -- Phase 53 Plan 03 complete (inline apply feedback UI)

## Roadmap (v2.1 — Phases 51–55)

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 51 | discovery-pipeline-reorder | PIPE-01, PIPE-02, PIPE-03 | Complete |
| 52 | regex-validity-and-dedup | RDISC-01, RDISC-02, RDISC-03, RDISC-04 | Complete |
| 53 | retroactive-application | APPLY-01, APPLY-02 | Complete |
| 54 | reusable-trigger | TRIG-01, TRIG-02 | Not started |
| 55 | import-summary-ux | SUMUI-01, SUMUI-02, SUMUI-03 | Not started |

**Open decisions to resolve in discuss/plan:** APPLY-02 retroactive scope (current file vs platform history); TRIG-02 re-check UX (per-row vs bulk); SUMUI-03 exact copy/placement of the "discovery is now a separate step" cue. Phase success criteria are phrased to accommodate either resolution.

**Deferred (tracked, not in v2.1):** TOOL-01 (consolidate in-app discovery with offline `yarn regex:discover`), GLOBAL-01 (file-independent suggestions), DISM-01 (persistent dismissal).

## Accumulated Context

### Decisions

Plan 51-01: detectPatternSuggestionsWithMeta reuses shared helpers — no clustering logic duplicated; strippedByNormalization rolled up as any-member-true at candidate level; residualVariablePart from first grouped row's tokens beyond stable prefix.

Plan 51-02: getUncategorizedExpensesForDiscovery uses isNull(expense.subCategoryId) as sole Set B filter (covers statuses 1 and 4 without enumerating them); no cache() or verifySession() — userId passed as parameter following loadActivePatterns pattern; no DbOrTx — discovery is post-commit, never inside a transaction.

Plan 51-03: discoverRegexCandidates reads stripPattern from expenses[0].descriptionStripPattern (platform-level constant from DAL join); applyStrip is a private one-liner — does NOT call normalizeTransactionRow (requires ImportPlatformConfig not available here); amount: null on all detector rows (description-only clustering); legacy analyzeFile call annotated with TODO Phase 55, not deleted (preserves current import summary UI).

Plan 52-01: PatternSuggestionWithMeta now carries all grouped member descriptionHashes (legacy nulls filtered); candidateCoveredByExistingPattern is a pure helper that mirrors the existing full plus numeric-stripped active-pattern matcher; clustering guard and prefix math unchanged.

Plan 52-02: getManuallyCategorizedHashes queries expenseClassificationHistory source='manual' joined to expense.descriptionHash, scoped by userId, with empty-input short-circuit and Set<string> result for Check 2.

Plan 52-03: discoverRegexCandidates now returns two lists: regex candidates from non-empty residual families and singleCategorizationSuggestions from identical normalized groups; Check 1 gates regex families with candidateCoveredByExistingPattern and Check 2 gates both lists with any-member manual-history hashes.

Plan 53-01: applyNewPatternToPlatformExpenses is a new sibling function using platform-scoped Set B DAL; PatternApplyResult exported from service layer; legacy applyNewPatternToExpenses unchanged for createPatternAction; getPlatformIdForUserFile resolves file ownership with platform join.

Plan 53-02: ActionState extended with optional applyResult?: PatternApplyResult | null; promoteSuggestionAction resolves platformId server-side from fileId (T-53-04/05), calls applyNewPatternToPlatformExpenses, returns structured counts; non-fatal apply failure returns zero counts; APPLY-02 scope locked to platform uncategorized history.

Plan 53-03: fileId/platformId threaded from RSC page → SuggestionSection → SuggestionCard → SuggestionPromoteForm; hidden fileId input in form (T-53-08); SuggestionCard renders Italian count copy (categorizzate / ancora senza match) from applyResult after promote; card persists with opacity-50 (not removed); notFound when platformId null; initialApplyResult test-only prop for SSR snapshot testing.

Design contract is LOCKED. Do not re-open or re-derive the data model:

- ADR 0012: direction derived from nature; 4th direction `allocation`; `category.type` removed
- CONTEXT.md: canonical nature/direction vocabulary + categorization rules
- `.planning/nature-remapping-WORKING.md`: 23 categories / ~65 subcats — final remap confirmed 2026-06-09

v2.0 closed (Phases 46–50, shipped 2026-06-14): nature/direction lookup tables, schema migration 0018, data recategorization, 4-direction dashboard, explicit transaction pairing (`transaction_pair`, migration 0020). Full decision log archived with the v2.0 milestone.

Codebase facts relevant to v2.1 (verified, do not re-research):

- `lib/services/import.ts`: `analyzeFile()` runs `detectPatternSuggestions` over ALL normalized rows with `covered:false` hardcoded, BEFORE categorization — discovery currently runs in the wrong place. `importFile()` runs `categorizePipeline` per-expense inside a `db.transaction`. (Phase 51 reorders this.)
- `lib/utils/pattern-suggestions.ts`: pure `detectPatternSuggestions` / `detectPatternSuggestionsWithMeta` — token-prefix grouping (>=2 tokens, >=2 members), strips numeric tokens, carries grouped `descriptionHashes`, and exposes `candidateCoveredByExistingPattern` for generated-regex coverage checks.
- `lib/services/categorization.ts`: `categorizePipeline` (Tier1 regex `applyTier1Regex` + Tier2 history), `loadActivePatterns`.
- `lib/services/pattern-application.ts`: `applyNewPatternToExpenses` already applies a new pattern retroactively to ALL of a user's uncategorized expenses (platform-agnostic) — relevant to APPLY-01/APPLY-02 scope decision (Phase 53).
- `app/(app)/import/[fileId]/suggestions/page.tsx`: post-import re-run on `getUncategorizedTransactionsByFileId` (Set B for that file), capped at 5, still `covered:false`, no Check 2.
- Files table: `app/(app)/import/files.table.ts` + `app/(app)/import/FilesToolbar.tsx` — where the on-demand "ricontrolla regex" trigger (TRIG-02) lives (Phase 54).
- Import summary UI: `ImportPreview`/`AnalyzePage` consume `analyzeFile`'s `sampleRows` + `patternSuggestions` (capped at 5, sampleDescriptions sliced to 3) (Phase 55).
- Offline tool exists: `scripts/regex-discovery.ts` + `/regex-label` skill (quick-task 260615-dtm). Relationship to in-pipeline discovery is TOOL-01 (deferred — only clarify the boundary).
- [Phase ?]: Plan 53-01: applyNewPatternToPlatformExpenses is a sibling function using platform-scoped Set B DAL; PatternApplyResult exported from service layer; legacy applyNewPatternToExpenses unchanged for createPatternAction

### Planning Risk

None open. All v2.1 success criteria are observable; the two DoD test cases (Fineco "Bonifico Andrea Bernardini" → regex; identical "Macellaio" → single categorization) are encoded in Phase 51 and Phase 52 criteria.

### Blockers/Concerns

None.

### Quick Tasks Completed (carried from v1.16 / v2.0)

| # | Description | Date | Commit |
|---|-------------|------|--------|
| 260609-fru | Dashboard overview prototype fixes | 2026-06-09 | 5ebd690 |
| 260609-k2d | Transactions nature + in/out/transfer filters; 7 UI fixes | 2026-06-09 | cdc5997 |
| 260609-lcp | Cascading filters (type→nature, category→subcat); amount sign strip | 2026-06-09 | ffd4fc3 |
| 260615-dtm | Bank-agnostic regex-discovery tool (uncovered-description clustering → proposed patterns) | 2026-06-15 | d737b8e |
| 260615-n3t | Onboarding step-4 fix: guarded light theme + catalogued items stay with green check | 2026-06-15 | 1434308 |
| 260615-oiq | Onboarding private platform creation imports immediately and returns to step 2 | 2026-06-15 | d5b590c |

## Deferred Items

| Category | Item | Status |
|----------|------|--------|
| v2.1 | TOOL-01 | consolidate in-app + offline discovery — only clarify boundary this milestone |
| v2.1 | GLOBAL-01 | file-independent suggestions — parked |
| v2.1 | DISM-01 | persistent dismissal of noisy suggestions — parked |
| operator | R038/R039/R041 | live Vercel/Supabase/R2 deploy operator-pending |
| backlog | R029 | partial categorization revalidation coverage |
| backlog | REVAL-01 | superseded by APPLY-01/APPLY-02 in this milestone |

## Session Continuity

Last session: 2026-06-16T17:30:00Z
Handoff synced: 2026-06-16 — Phase 53 complete: all 3 plans done. Plan 03 wired inline apply feedback UI (commits 4406115, ce3190b).
Resume file: None

**Next:** Phase 54 — reusable-trigger (TRIG-01, TRIG-02).

## Operator Next Steps

- Start Phase 53 (`$gsd-discuss-phase 53` or `$gsd-plan-phase 53`) to resolve retroactive application scope and implementation details.

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 49 P02 | 30m | 2 tasks | 5 files |
| Phase 50 P01 | 20m | 2 tasks | 4 files |
| Phase 50-transaction-pairing P50-02 | 35min | 2 tasks | 5 files |
| Phase 50-transaction-pairing P50-03 | 10min | 2 tasks | 4 files |
| Phase 50-transaction-pairing P50-04 | 25min | 2 tasks | 3 files |
| Phase 50-transaction-pairing P50-05 | 90min | 2 tasks + operator checkpoint + 5 fixes | 5 files |
| Phase 51 P01 | 15min | 2 tasks | 2 files |
| Phase 51 P02 | 15min | 2 tasks | 2 files |
| Phase 51 P03 | 8min | 3 tasks (TDD RED+GREEN + comment) | 3 files |
| Phase 52 P01 | 3 min | 2 tasks | 6 files |
| Phase 52 P02 | 2 min | 2 tasks | 2 files |
| Phase 52 P03 | 3 min | 3 tasks | 2 files |
| Phase 53 PP01 | 3min | - tasks | - files |
| Phase 53 P02 | 8min | 2 tasks (TDD RED+GREEN) | 4 files |
| Phase 53 P03 | 10min | 2 tasks + verification | 7 files |
