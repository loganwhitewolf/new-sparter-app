---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: — Regex Discovery & Transaction Unification
status: executing
last_updated: "2026-06-16T13:24:15.222Z"
last_activity: 2026-06-16 -- Phase 52 Plan 02 completed (manual-history hash DAL)
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 6
  completed_plans: 5
  percent: 83
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-16)

**Core value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending — all running on a zero-cost personal deploy.
**Current focus:** Phase 52 — regex-validity-and-dedup

## Current Position

Phase: 52 (regex-validity-and-dedup) — IN PROGRESS
Plan: 2 of 3
Status: Wave 1 complete — ready for Plan 52-03 service orchestration wiring
Last activity: 2026-06-16 -- Phase 52 Plan 02 completed (manual-history hash DAL)

## Roadmap (v2.1 — Phases 51–55)

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 51 | discovery-pipeline-reorder | PIPE-01, PIPE-02, PIPE-03 | Complete |
| 52 | regex-validity-and-dedup | RDISC-01, RDISC-02, RDISC-03, RDISC-04 | In Progress |
| 53 | retroactive-application | APPLY-01, APPLY-02 | Not started |
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

Design contract is LOCKED. Do not re-open or re-derive the data model:

- ADR 0012: direction derived from nature; 4th direction `allocation`; `category.type` removed
- CONTEXT.md: canonical nature/direction vocabulary + categorization rules
- `.planning/nature-remapping-WORKING.md`: 23 categories / ~65 subcats — final remap confirmed 2026-06-09

v2.0 closed (Phases 46–50, shipped 2026-06-14): nature/direction lookup tables, schema migration 0018, data recategorization, 4-direction dashboard, explicit transaction pairing (`transaction_pair`, migration 0020). Full decision log archived with the v2.0 milestone.

Codebase facts relevant to v2.1 (verified, do not re-research):

- `lib/services/import.ts`: `analyzeFile()` runs `detectPatternSuggestions` over ALL normalized rows with `covered:false` hardcoded, BEFORE categorization — discovery currently runs in the wrong place. `importFile()` runs `categorizePipeline` per-expense inside a `db.transaction`. (Phase 51 reorders this.)
- `lib/utils/pattern-suggestions.ts`: pure `detectPatternSuggestions` — token-prefix grouping (≥2 tokens, ≥2 members), strips numeric tokens; `isCoveredByPatterns` tests candidates against active regex patterns (partial Check 1). Does NOT distinguish identical-after-normalization (single categorization) from prefix+variable (regex); no Check 2. (Phase 52.)
- `lib/services/categorization.ts`: `categorizePipeline` (Tier1 regex `applyTier1Regex` + Tier2 history), `loadActivePatterns`.
- `lib/services/pattern-application.ts`: `applyNewPatternToExpenses` already applies a new pattern retroactively to ALL of a user's uncategorized expenses (platform-agnostic) — relevant to APPLY-01/APPLY-02 scope decision (Phase 53).
- `app/(app)/import/[fileId]/suggestions/page.tsx`: post-import re-run on `getUncategorizedTransactionsByFileId` (Set B for that file), capped at 5, still `covered:false`, no Check 2.
- Files table: `app/(app)/import/files.table.ts` + `app/(app)/import/FilesToolbar.tsx` — where the on-demand "ricontrolla regex" trigger (TRIG-02) lives (Phase 54).
- Import summary UI: `ImportPreview`/`AnalyzePage` consume `analyzeFile`'s `sampleRows` + `patternSuggestions` (capped at 5, sampleDescriptions sliced to 3) (Phase 55).
- Offline tool exists: `scripts/regex-discovery.ts` + `/regex-label` skill (quick-task 260615-dtm). Relationship to in-pipeline discovery is TOOL-01 (deferred — only clarify the boundary).

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

Last session: 2026-06-16T13:24:15.218Z
Handoff synced: 2026-06-16 — Phase 51 complete: service discoverRegexCandidates + tests + TODO annotation (commits 676a37c, 60b5479, d169fa8).
Resume file: None

**Next:** Execute Phase 52 Plan 03 — service split plus Check 1/Check 2 wiring.

## Operator Next Steps

- Continue `$gsd-execute-phase 52` with Plan 52-03 (service orchestration wiring for RDISC-01/02/03/04).

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
