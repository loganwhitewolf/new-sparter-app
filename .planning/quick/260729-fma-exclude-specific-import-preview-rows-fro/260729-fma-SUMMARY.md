---
phase: 260729-fma
plan: 01
subsystem: import
tags: [import, preview, FormData, zod, exclusion]

requires:
  - phase: 260729-f21
    provides: importMode / range FormData override pattern on analyze+confirm
provides:
  - Per-row Non importare exclusion by stable rowIndex
  - Confirm-time excludedRowIndexes → Zod → importFile skip before hash dedup
affects: [import-preview, confirm-import]

tech-stack:
  added: []
  patterns:
    - "Confirm FormData multi-value exclusions via getAll + z.array(z.coerce.number())"
    - "Client exclusions shrink importable counts; table keeps excluded rows for restore"

key-files:
  created: []
  modified:
    - lib/validations/import.ts
    - lib/actions/import.ts
    - lib/services/import.ts
    - components/import/import-preview.tsx
    - tests/import-service.test.ts
    - tests/import-preview-ui.test.tsx

key-decisions:
  - "D-action: only Non importare + Ripristina — no Rendi valida"
  - "D-identity: exclusions keyed by stable 1-based parse rowIndex"
  - "D-confirm: server re-parses file; applies exclusion Set after mode filter, before hash dedup/insert"
  - "Exported rowsWithoutExcluded + appendExcludedRowIndexes for unit-testability without jsdom clicks"

patterns-established:
  - "appendExcludedRowIndexes mirrors counterpartIds FormData getAll pattern"
  - "Importable counts from rowsWithoutExcluded; table source stays mode-filtered"

requirements-completed:
  - EXCLUDE-IMPORT-PREVIEW-ROWS-260729-fma

coverage:
  - id: D1
    description: importFile skips excludedRowIndexes after mode filter before insert
    requirement: EXCLUDE-IMPORT-PREVIEW-ROWS-260729-fma
    verification:
      - kind: unit
        ref: tests/import-service.test.ts#excludedRowIndexes skips the matching rowIndex after mode filter and before insert
        status: pass
    human_judgment: false
  - id: D2
    description: Preview Non importare / Ripristina + FormData append + no Rendi valida
    requirement: EXCLUDE-IMPORT-PREVIEW-ROWS-260729-fma
    verification:
      - kind: unit
        ref: tests/import-preview-ui.test.tsx#renders Non importare on status badges and never offers Rendi valida
        status: pass
      - kind: unit
        ref: tests/import-preview-ui.test.tsx#appendExcludedRowIndexes writes one FormData entry per index
        status: pass
    human_judgment: false
  - id: D3
    description: Live browser smoke on /import/[fileId]/analyze exclude→counts→confirm
    verification: []
    human_judgment: true
    rationale: Node-only Vitest env; interactive DropdownMenu exclude + confirm insert skip needs a browser pass

duration: 5min
completed: 2026-07-29
status: complete
---

# Phase 260729-fma Plan 01: Exclude import preview rows Summary

**Confirm-time per-row Non importare exclusions by stable `rowIndex`, with live preview counts and server-side skip after import-mode filter.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-29T09:16:58Z
- **Completed:** 2026-07-29T09:20:00Z
- **Tasks:** 2/2
- **Files modified:** 6

## Accomplishments

- `ImportFileSchema` + `confirmImportAction` accept `excludedRowIndexes` (FormData `getAll`); not on `AnalyzeImportSchema`
- `importFile` drops excluded indexes after `applyImportModeFilter`, before `getDuplicateHashes` / insert
- Import preview: Badge DropdownMenu Non importare / Ripristina / Esclusa; importable counts live-update; confirm appends exclusions

## Task Commits

1. **Task 1 RED:** `eafddbe` — test(260729-fma-01): add failing test for excludedRowIndexes skip
2. **Task 1 GREEN:** `cf1b232` — feat(260729-fma-01): implement excludedRowIndexes confirm skip
3. **Task 2 RED:** `cca1ed1` — test(260729-fma-01): add failing tests for Non importare UI
4. **Task 2 GREEN:** `5a3b882` — feat(260729-fma-01): Non importare / Ripristina on import preview

**Plan metadata:** not committed (orchestrator commits docs)

## Files Created/Modified

- `lib/validations/import.ts` — `excludedRowIndexes` on `ImportFileSchema`
- `lib/actions/import.ts` — `getAll('excludedRowIndexes')` → `importFile`
- `lib/services/import.ts` — post-mode exclusion Set before rebuildStats / hash / insert
- `components/import/import-preview.tsx` — UI + `appendExcludedRowIndexes` + `rowsWithoutExcluded`
- `tests/import-service.test.ts` — skip + empty-exclusion control
- `tests/import-preview-ui.test.tsx` — FormData / helper / no Rendi valida

## Decisions Made

Followed locked CONTEXT decisions (D-action / D-identity / D-preview / D-confirm). Discretion: DropdownMenu on status Badge; restore label "Ripristina"; counts subtract excluded while rows stay visible.

## Deviations from Plan

### Auto-fixed Issues

None - plan executed as written for product behavior.

### Other deviations

**1. [Rule 3 - Tooling] Vitest `-x` flag unsupported**
- **Found during:** Task 1 verify
- **Issue:** Plan verify used `yarn vitest run ... -x`; Vitest 4.1.5 rejects unknown `-x`
- **Fix:** Ran the same filters without `-x`
- **Verification:** Suites green (66 tests across both files)

**2. [Process] Tracer human-verify gate skipped**
- **Found during:** After Task 1 GREEN
- **Issue:** `AUTO_CFG=false` would normally pause at tracer human-verify
- **Fix:** Continued Task 2 per orchestrator constraints (`Execute ALL tasks`, plan `autonomous: true`); tracer `<verify>` re-run passed before expansion

## Known Stubs

None.

## Threat Flags

None beyond plan threat model (T-fma-01 mitigated by Zod + server re-parse; T-fma-02 unknown indexes are no-ops).

## Self-Check: PASSED

- [x] `lib/validations/import.ts` has `excludedRowIndexes`
- [x] `importFile` filters by exclusion Set after mode filter
- [x] Preview exports `appendExcludedRowIndexes` / `rowsWithoutExcluded`; markup contains Non importare, not Rendi valida
- [x] Commits `eafddbe`, `cf1b232`, `cca1ed1`, `5a3b882` present on `quick/260729-f21-import-mode-filters`
- [x] `yarn vitest run tests/import-service.test.ts tests/import-preview-ui.test.tsx` — 66 passed
