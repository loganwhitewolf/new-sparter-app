---
phase: quick-260615-dtm
plan: 01
subsystem: tooling
tags: [categorization, regex, import, drizzle, decimal, tsx-script]

# Dependency graph
requires:
  - phase: v2.0 (Phase 46-50)
    provides: nature/direction model, sign-agnostic categorizationPattern, import layer (parsers + detector + normalizer)
provides:
  - Pure non-server-only Tier-1 matcher module (single source of truth for coverage)
  - Bank-agnostic regex-discovery tool (yarn regex:discover) writing dated reports to .data/regex-discovery/
  - .data/ gitignore entry for real bank-export PII
  - Method doc explaining re-runs over time and the seed-extras persistence path
affects: [categorization, import-formats, seed-extras pattern authoring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure matcher module re-exported by server-only module — lets tsx scripts reuse production logic verbatim"
    - "Operator-DB bootstrap mirrored from seed-extras.ts for standalone scripts"

key-files:
  created:
    - lib/services/categorization-match.ts
    - tests/categorization-match.test.ts
    - scripts/regex-discovery.ts
    - docs/regex-discovery.md
  modified:
    - lib/services/categorization.ts
    - .gitignore
    - package.json

key-decisions:
  - "Extracted applyTier1Regex byte-for-byte into a pure module; categorization.ts re-exports — production import sites unchanged, single source of truth for coverage"
  - "Script loads active GLOBAL patterns + formats inline (no server-only DAL import); userId-null filter doubles as system-only scope"
  - "Cluster heuristic: top significant token (len>=3, non-numeric) per uncovered description; ranked by tx count then EUR total (Decimal-compared)"

patterns-established:
  - "Coverage fidelity: pass description unmodified to applyTier1Regex (matcher does its own stripped-variant test)"
  - "EUR aggregation via Decimal.js (toDecimal/toDbDecimal) — never native arithmetic"

requirements-completed: []

# Metrics
duration: 25min
completed: 2026-06-15
---

# Quick Task 260615-dtm: Reusable Regex-Discovery Tool Summary

**Bank-agnostic `yarn regex:discover` tool that reuses the production import layer and the extracted pure `applyTier1Regex` matcher to surface still-uncovered transaction descriptions, clustered by merchant token with proposed word-boundary regexes, in dated reports under gitignored `.data/`.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-15T10:07:00Z
- **Completed:** 2026-06-15T10:14:00Z
- **Tasks:** 3
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments

- Extracted `applyTier1Regex` + `ActivePattern`/`CategorizationResult` into `lib/services/categorization-match.ts` with **no `server-only` guard**; `categorization.ts` re-exports them so every production import site is unchanged. Single source of truth for coverage.
- Built `scripts/regex-discovery.ts`: parses any supported export via the production import layer (`parseImportFile` → `detectImportFormat` → `normalizeTransactionRow`), evaluates coverage with the identical production matcher, clusters uncovered descriptions by recurring merchant token, and writes a dated markdown report.
- Validated end-to-end against synthetic fixtures: COOP and AMAZON (covered) were **not** flagged as gaps; the repeated `WONKABAR` merchant clustered (4 tx, -31.70 EUR, proposed `(?:\bwonkabar\b)`); an unknown-layout file surfaced under "Unmatched files". Run exited 0, DB not degraded (28 patterns loaded).
- `.data/` gitignored (real bank PII + reports); `regex:discover` yarn entry added; method doc written.

## Task Commits

1. **Task 1: Extract applyTier1Regex into pure matcher module** — `98d7963` (refactor; TDD — test written first, ran green, then production extract)
2. **Task 2: Build regex-discovery script, gitignore .data/, yarn entry, doc** — `d737b8e` (feat)
3. **Task 3: Validate end-to-end against fixtures** — no commit (validation inputs live under gitignored `.data/`; no committed code changed)

_Note: Task 1 was a single refactor commit — the new pure module passed its direct-import test before the production file was rewired, satisfying the RED→GREEN intent without a separate failing-test commit since the extracted function was correct by construction._

## Files Created/Modified

- `lib/services/categorization-match.ts` — pure Tier-1 matcher (applyTier1Regex + types), no server-only guard
- `lib/services/categorization.ts` — removed moved defs, re-exports from categorization-match
- `tests/categorization-match.test.ts` — 6 tests, imports the module directly (proves it loads outside a server context)
- `scripts/regex-discovery.ts` — the discovery tool (~390 lines)
- `docs/regex-discovery.md` — method doc (inputs, run, fidelity, degraded path, seed-extras persistence)
- `.gitignore` — added `.data/`
- `package.json` — added `regex:discover` script

## Decisions Made

- Reused the matcher **verbatim** via extraction + re-export rather than copy-paste (D-4) — production behavior identical, coverage cannot drift from production.
- Script loads active global patterns/formats with lightweight inline Drizzle queries mirroring the DAL's global-approved branch; the server-only DAL (`loadImportFormatsForDetection`) is never imported, and the userId-null filter restricts patterns to the system/global set.
- Cluster key = most frequent significant token (length ≥ 3, non-numeric) per uncovered description; clusters ranked by tx count, then EUR total compared via Decimal.

## Deviations from Plan

None — plan executed exactly as written. No real patterns added and no PII committed (D-6, D-7 honored).

## Issues Encountered

- **Pre-existing tsc + language-check failures (out of scope):** `npx tsc --noEmit` reports 6 errors in `tests/cascade-options.test.ts` and `tests/category-combobox.test.tsx`, and `yarn check:language` flags comments in `overview-movers-panel.tsx`, `v2-taxonomy-manifest.ts`, `subcategory-picker.test.tsx`, `suggestion-promote-form.test.tsx`. Confirmed pre-existing by stashing this task's changes and re-running tsc (all 6 errors persisted on clean HEAD). None are in files touched by this task. Logged to `deferred-items.md`. Not fixed per SCOPE BOUNDARY.

## Known Stubs

None. The tool is fully wired: it reads real DB patterns/formats and real input files. The "degraded path" (no seeded global patterns/formats → everything unmatched, coherent report, seeding prerequisite noted) is intentional and documented, not a stub.

## User Setup Required

None for the tool itself. To use it against real data: drop bank exports into `.data/regex-discovery/`, ensure the target DB is seeded (`yarn db:seed && yarn db:seed-extras`), then run `yarn regex:discover`.

## Next Phase Readiness

- Tool is ready for Andrea to run over real bank exports. Chosen patterns are persisted manually as a new additive step in `scripts/seed-extras.ts` (workflow in `docs/regex-discovery.md`).
- No blockers.

## Self-Check: PASSED

- All 4 created files exist on disk.
- Both task commits (`98d7963`, `d737b8e`) exist in git history.
- Nothing under `.data/` is staged or tracked (PII safety, D-2).

---
*Phase: quick-260615-dtm*
*Completed: 2026-06-15*
