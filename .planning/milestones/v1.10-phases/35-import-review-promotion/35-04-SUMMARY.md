---
phase: 35
plan: 04
subsystem: import-review-promotion
tags: [tdd, green-phase, pattern-suggestions, wave-2, integration, wiring]
dependency_graph:
  requires:
    - "35-01 RED test scaffolding (import-preview-ui.test.tsx, import-analyze-page.test.tsx)"
    - "35-02 promoteSuggestionAction (lib/actions/patterns.ts)"
    - "35-03 UI components (SuggestionSection, SuggestionCard, SuggestionPromoteForm)"
  provides:
    - "ImportPreview with categories prop + SuggestionSection insertion (REV-01, REV-04)"
    - "AnalyzePage parallel fetch of analyzeImportAction + getCategories (REV-01 wiring)"
    - "server-only alias in vitest.config.ts for DAL imports in client component tests"
  affects:
    - "tests/import-preview-ui.test.tsx (now 5/5 GREEN)"
    - "tests/import-analyze-page.test.tsx (now 3/3 GREEN)"
    - "Full Vitest suite (53 files, 577 tests — no regressions)"
tech_stack:
  added: []
  patterns:
    - "Promise.all([serverAction, DAL]) for parallel server-side fetch in RSC (Pattern 4 from RESEARCH.md)"
    - "server-only alias in vitest.config.ts to allow DAL types in client component tests"
    - "SuggestionSection self-conditional (returns null when empty) — no change to confirm block state"
key_files:
  created:
    - tests/__mocks__/server-only.ts
  modified:
    - components/import/import-preview.tsx
    - app/(app)/import/[fileId]/analyze/page.tsx
    - vitest.config.ts
decisions:
  - "server-only mock added as vitest.config.ts alias (not per-test vi.mock) to avoid touching phase 35 test contracts"
  - "SuggestionSection inserted between sample rows and confirm button with no coupling to confirm state (REV-04 preserved)"
  - "getCategories() failure surface documented in page.tsx comment — acceptable as infra 500, no try/catch added (per plan spec)"
metrics:
  duration: "~4m"
  completed: "2026-05-23"
  tasks_completed: 3
  files_modified: 4
---

# Phase 35 Plan 04: Integration Wiring — ImportPreview + AnalyzePage Summary

Final integration wiring that turns the remaining 3 RED tests GREEN: adds `categories` prop to `ImportPreview`, inserts `<SuggestionSection>` between sample rows and confirm, and switches `AnalyzePage` to a parallel fetch via `Promise.all`. Phase 35 implementation complete.

## Changes Applied

### components/import/import-preview.tsx

Two imports added after line 26:
```typescript
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import { SuggestionSection } from './suggestion-section'
```

Props type updated (required `categories` field added):
```typescript
type Props = {
  result: ImportAnalysisResult
  candidates?: FormatCandidate[]
  confirmDisabledReason?: string
  categories: CategoryWithSubCategories[]  // ADDED
}
```

Function signature updated:
```typescript
export function ImportPreview({ result, candidates = [], confirmDisabledReason, categories }: Props) {
```

SuggestionSection inserted between sample rows card and confirm button:
```tsx
{/* Pattern suggestions — REV-01: rendered only when there are suggestions */}
<SuggestionSection suggestions={result.patternSuggestions} categories={categories} />

{/* Confirm button — hidden when analysis has fatal errors */}
{!hasErrors && !confirmDisabledReason && (
```

### app/(app)/import/[fileId]/analyze/page.tsx

Import added after line 7:
```typescript
import { getCategories } from '@/lib/dal/categories'
```

Sequential fetch replaced with parallel fetch:
```typescript
// Before:
const result = await analyzeImportAction(fd)

// After:
const [result, categories] = await Promise.all([
  analyzeImportAction(fd),
  getCategories(),
])
```

ImportPreview call updated to pass categories:
```tsx
{!isUnknownFormat && <ImportPreview result={result.data} categories={categories} />}
```

### vitest.config.ts + tests/__mocks__/server-only.ts

Added `server-only` alias to allow DAL modules (which carry the `import 'server-only'` boundary marker) to be imported in Vitest tests without throwing. See Deviations section.

## Test Results

### Phase 35 Test Files

| File | Tests | Status |
|------|-------|--------|
| tests/import-preview-ui.test.tsx | 5/5 | GREEN |
| tests/import-analyze-page.test.tsx | 3/3 | GREEN |
| tests/pattern-actions.test.ts | 14/14 | GREEN (unchanged) |
| tests/suggestion-card.test.tsx | 4/4 | GREEN (unchanged) |
| tests/suggestion-promote-form.test.tsx | 5/5 | GREEN (unchanged) |
| **Total phase 35** | **31/31** | **GREEN** |

### Full Suite

| Metric | Value |
|--------|-------|
| Test files | 53 passed |
| Tests | 577 passed, 1 todo |
| Failures | 0 |
| Duration | ~2.5s |

## REV-* Requirements Satisfied End-to-End

| Requirement | Test | Status |
|-------------|------|--------|
| REV-01: suggestion cards visible on analyze page | import-preview-ui REV-01a, import-analyze-page REV-01 wiring | SATISFIED |
| REV-02: sample descriptions hidden by default, toggle available | suggestion-card REV-02 | SATISFIED |
| REV-03: promote to pattern with subcategory selection | pattern-actions promoteSuggestionAction, suggestion-promote-form | SATISFIED |
| REV-04: confirm button unblocked by suggestion state | import-preview-ui REV-04 | SATISFIED |
| REV-05: promotion feedback (success badge, error alert) | suggestion-promote-form REV-05, suggestion-card promoted state | SATISFIED |
| SCOP-01: dismissed suggestions not persisted | no persistence code in any file | SATISFIED |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] server-only blocked import-preview-ui.test.tsx**
- **Found during:** Task 1 verification
- **Issue:** `tests/import-preview-ui.test.tsx` (created in Plan 01, not modifiable) imports `ImportPreview` which now imports `type { CategoryWithSubCategories }` from `@/lib/dal/categories`. That module has `import 'server-only'` at the top, which throws in Vitest (Node environment). The test failed immediately with "This module cannot be imported from a Client Component module."
- **Fix:** Added `'server-only'` alias in `vitest.config.ts` pointing to `tests/__mocks__/server-only.ts` (empty export). This matches the pattern used by newer phase 35 tests (`vi.mock('server-only', () => ({}))`) but applies globally so the pinned Plan 01 test does not need to be touched.
- **Files modified:** `vitest.config.ts`, `tests/__mocks__/server-only.ts` (new)
- **Commit:** 26ca677

## Known Stubs

None — all components wire to real props passed server-side. `categories` comes from `getCategories()` in AnalyzePage; `patternSuggestions` comes from `analyzeImportAction` (phase 34). No hardcoded empty values flow to UI rendering.

## Threat Flags

None — threat register from plan's `<threat_model>` covers all surfaces introduced:
- T-35-04: categories sent to client are user-scoped (getCategories calls verifySession internally)
- T-35-05: Promise.all prevents serial latency; getCategories is React-cache wrapped
- T-35-06: confirm block rendered independently of SuggestionSection state (REV-04 verified by test)

## Self-Check: PASSED

### Files verified

- `components/import/import-preview.tsx`: FOUND — contains SuggestionSection import + render
- `app/(app)/import/[fileId]/analyze/page.tsx`: FOUND — contains Promise.all + categories prop
- `vitest.config.ts`: FOUND — contains server-only alias
- `tests/__mocks__/server-only.ts`: FOUND

### Commits verified

- 26ca677 (Task 1 — ImportPreview wiring): in git log
- 3ab8876 (Task 2 — AnalyzePage parallel fetch): in git log

## Next Step

Phase 35 implementation is complete. Run `/gsd-verify-work 35` to execute the validation plan (`35-VALIDATION.md`) and confirm all success criteria end-to-end.
