---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Regex Discovery & Transaction Unification
status: roadmapped
last_updated: "2026-06-16T09:00:00.000Z"
last_activity: 2026-06-16
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-16)

**Core value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending — all running on a zero-cost personal deploy.
**Current focus:** Phase 51 — discovery-pipeline-reorder (first phase of v2.1)

## Current Position

Phase: Not started — roadmap created (Phases 51–55)
Plan: —
Status: Roadmapped, ready to plan Phase 51
Last activity: 2026-06-16 — v2.1 roadmap created, 14/14 requirements mapped

## Roadmap (v2.1 — Phases 51–55)

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 51 | discovery-pipeline-reorder | PIPE-01, PIPE-02, PIPE-03 | Not started |
| 52 | regex-validity-and-dedup | RDISC-01, RDISC-02, RDISC-03, RDISC-04 | Not started |
| 53 | retroactive-application | APPLY-01, APPLY-02 | Not started |
| 54 | reusable-trigger | TRIG-01, TRIG-02 | Not started |
| 55 | import-summary-ux | SUMUI-01, SUMUI-02, SUMUI-03 | Not started |

**Open decisions to resolve in discuss/plan:** APPLY-02 retroactive scope (current file vs platform history); TRIG-02 re-check UX (per-row vs bulk); SUMUI-03 exact copy/placement of the "discovery is now a separate step" cue. Phase success criteria are phrased to accommodate either resolution.

**Deferred (tracked, not in v2.1):** TOOL-01 (consolidate in-app discovery with offline `yarn regex:discover`), GLOBAL-01 (file-independent suggestions), DISM-01 (persistent dismissal).

## Accumulated Context

### Decisions

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

Last session: 2026-06-16
Handoff synced: 2026-06-16 — v2.1 roadmap created (Phases 51–55), REQUIREMENTS.md traceability filled, STATE.md updated.
Resume file: None.

**Next:** Plan Phase 51 — `/gsd-plan-phase 51` (discovery-pipeline-reorder: PIPE-01/02/03).

## Operator Next Steps

- Plan the first v2.1 phase with `/gsd-plan-phase 51`

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 49 P02 | 30m | 2 tasks | 5 files |
| Phase 50 P01 | 20m | 2 tasks | 4 files |
| Phase 50-transaction-pairing P50-02 | 35min | 2 tasks | 5 files |
| Phase 50-transaction-pairing P50-03 | 10min | 2 tasks | 4 files |
| Phase 50-transaction-pairing P50-04 | 25min | 2 tasks | 3 files |
| Phase 50-transaction-pairing P50-05 | 90min | 2 tasks + operator checkpoint + 5 fixes | 5 files |
