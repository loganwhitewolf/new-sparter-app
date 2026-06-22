---
phase: 51-discovery-pipeline-reorder
plan: "03"
subsystem: services
tags: [regex-discovery, pattern-suggestions, normalization, server-only, tdd, PIPE-01, PIPE-02, PIPE-03]
dependency_graph:
  requires:
    - phase: 51-01
      provides: "detectPatternSuggestionsWithMeta, PatternSuggestionWithMeta, PatternDetectorRowWithMeta"
    - phase: 51-02
      provides: "getUncategorizedExpensesForDiscovery(userId, platformId), UncategorizedExpenseForDiscovery"
  provides:
    - "discoverRegexCandidates({ userId, scope: { platformId } }): DiscoveryResult"
    - "DiscoveryScope, DiscoveryResult types"
    - "TODO Phase 55 removal marker in lib/services/import.ts"
  affects:
    - "Phase 54 — post-import auto-run + Files-table on-demand trigger (both call this service)"
    - "Phase 55 — import summary UX will remove legacy analyzeFile discovery call"
tech_stack:
  added: []
  patterns:
    - "Standalone discovery service: server-only, no transaction, userId+platformId only"
    - "Strip-before-cluster normalization: applyStrip(rawTitle, pattern) then normalizeDescription"
    - "Platform-level stripPattern from DAL result (expenses[0].descriptionStripPattern)"
    - "TDD red-green with separate commits (test RED, then feat GREEN)"
key_files:
  created:
    - lib/services/regex-discovery.ts
    - tests/regex-discovery-service.test.ts
  modified:
    - lib/services/import.ts
key-decisions:
  - "discoverRegexCandidates reads stripPattern from expenses[0].descriptionStripPattern (platform-level constant for all rows from the DAL join)"
  - "applyStrip is a private one-liner inside the service — does NOT call normalizeTransactionRow (which requires a full ImportPlatformConfig)"
  - "amount: null on all detector rows — discovery is description-only; no monetary arithmetic"
  - "Legacy analyzeFile discovery call annotated with TODO Phase 55, not deleted — preserves current import summary UI until Phase 55 wires the new service"
patterns-established:
  - "Standalone service pattern: import 'server-only', no db.transaction, auth at caller, userId + scope passed as params"
  - "Strip-normalize-cluster ordering: strip (optional regex), then normalizeDescription, then detectPatternSuggestionsWithMeta"
requirements-completed: [PIPE-01, PIPE-02, PIPE-03]
duration: 8min
completed: "2026-06-16"
---

# Phase 51 Plan 03: Standalone discoverRegexCandidates Service Summary

**Server-only discoverRegexCandidates service fetches Set B via DAL, applies Fineco strip + normalizeDescription before clustering, and returns enriched candidates with D-05 metadata — standalone, transaction-free, platformId-scoped**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-16T09:59:29Z
- **Completed:** 2026-06-16T10:07:00Z
- **Tasks:** 3 (2 TDD — RED + GREEN, 1 comment-only)
- **Files modified:** 3

## Accomplishments

- `lib/services/regex-discovery.ts` — new server-only service exporting `discoverRegexCandidates`, `DiscoveryScope`, `DiscoveryResult`; fetches Set B by userId+platformId, applies platform strip + normalizeDescription, loads active patterns for coverage filtering, delegates to `detectPatternSuggestionsWithMeta`, returns capped candidates + totalUncategorized + platformId (PIPE-01/02/03)
- `tests/regex-discovery-service.test.ts` — four-test suite anchored on Fineco DoD (SC-4), plus standalone-callable (PIPE-02), strip-before-cluster (PIPE-03), and coverage-exclusion (PIPE-01); real util + normalizeDescription, mocked DAL + loadActivePatterns
- `lib/services/import.ts` — single-line `// TODO Phase 55` comment inserted before the legacy `if (best && !input.skipPatternSuggestions)` guard; no behavior change, 54 import-service tests still pass (T-51-09)

## Task Commits

1. **Task 1-2 RED: Add failing tests for discoverRegexCandidates** — `676a37c` (test)
2. **Task 1 GREEN: Implement discoverRegexCandidates standalone service** — `60b5479` (feat)
3. **Task 3: Annotate legacy pre-categorization discovery call** — `d169fa8` (chore)

_Note: TDD — RED commit (test file, module not found) and GREEN commit (implementation, 4/4 tests pass) are separate._

## Files Created/Modified

- `lib/services/regex-discovery.ts` — standalone service; `import 'server-only'`, `discoverRegexCandidates`, `DiscoveryScope`, `DiscoveryResult`, private `applyStrip` helper
- `tests/regex-discovery-service.test.ts` — service unit tests; vi.mock for DAL + categorization, real util/normalizeDescription; SC-4/PIPE-01/02/03 coverage
- `lib/services/import.ts` — comment-only edit: `// TODO Phase 55: remove — regex discovery now runs post-import via discoverRegexCandidates in lib/services/regex-discovery.ts (PIPE-01/02)` before legacy guard

## Decisions Made

- `stripPattern = expenses[0]?.descriptionStripPattern ?? null` reads the platform-level strip pattern from the first DAL row — identical for all rows (same platform), so reading once is correct and matches how `normalizeTransactionRow` receives it via `platform.descriptionStripPattern`.
- `applyStrip` is a private one-liner inside the service rather than calling `normalizeTransactionRow` — the latter requires `RawImportRow` + `ImportPlatformConfig`, which the service does not have (RESEARCH Anti-Pattern, Pattern 2 in 51-RESEARCH.md).
- `amount: null` on all `PatternDetectorRowWithMeta` rows — discovery is description-only; no monetary arithmetic needed, consistent with Decimal.js prohibition (never use native arithmetic on monetary amounts; here there is no monetary arithmetic at all).
- Legacy `analyzeFile` call is annotated, not deleted — the current import summary UI reads `patternSuggestions` from `analyzeFile`'s return value. Deleting before Phase 55 replaces that consumption path would break the UI.

## Deviations from Plan

None — plan executed exactly as written.

- `discoverRegexCandidates` matches the exact signature in 51-RESEARCH.md Pattern 4.
- RED commit proved test failure (module not found error, not just test assertion failure).
- GREEN commit produced 4/4 passing tests on first implementation attempt.
- Task 3 is a comment-only edit; the legacy block (lines 298–322) is byte-identical except for the inserted comment.

## Known Stubs

None. The service returns real data from the DAL query and real clustering from the util. No hardcoded empty values, no placeholder text.

## Threat Flags

No new security-relevant surface beyond the plan's threat_model:

- T-51-06 (cross-user/cross-platform leakage): service passes `userId` + `scope.platformId` straight to `getUncategorizedExpensesForDiscovery` which enforces both filters in WHERE — mitigated.
- T-51-07 (ReDoS via stripPattern): `descriptionStripPattern` is a seed/operator-controlled value, not user-supplied free text — accepted.
- T-51-08 (server-only boundary): `import 'server-only'` is the first line — mitigated, confirmed by acceptance criteria.
- T-51-09 (behavior drift): Task 3 is comment-only; import-service test suite (54/54) stays green — mitigated.

## TDD Gate Compliance

- RED gate: `676a37c` — test file committed, module not found error confirms the service did not exist (test: type).
- GREEN gate: `60b5479` — implementation committed, 4/4 tests pass (feat: type).
- REFACTOR: no cleanup needed — implementation clean on first pass.

## Self-Check: PASSED

- `lib/services/regex-discovery.ts` exists: FOUND
- `tests/regex-discovery-service.test.ts` exists: FOUND
- `lib/services/import.ts` contains `TODO Phase 55`: FOUND
- RED commit `676a37c`: FOUND
- GREEN commit `60b5479`: FOUND
- Task 3 commit `d169fa8`: FOUND
- All 4 service tests pass: CONFIRMED
- All 54 import-service tests pass: CONFIRMED
- Full suite (1065 tests): PASS (0 FAIL)
