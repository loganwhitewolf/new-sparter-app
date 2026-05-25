---
phase: 34-import-analysis-suggestions
plan: "02"
subsystem: import-service
tags: [import, analyze, pattern-suggestions, integration, wave1, tdd]
dependency_graph:
  requires: [failing-test-scaffold-34-01]
  provides: [analyzeFile-patternSuggestions-integration]
  affects:
    - lib/services/import.ts
    - tests/import-service.test.ts
    - tests/import-preview-ui.test.tsx
tech_stack:
  added: []
  patterns:
    - isolated try/catch for non-critical detection (D-01)
    - safeImportErrorMessage for sanitized warn log (ANL-05 / T-34-01)
    - sort+cap caller responsibility (ADR-0002)
key_files:
  created: []
  modified:
    - lib/services/import.ts
    - tests/import-service.test.ts
    - tests/import-preview-ui.test.tsx
decisions:
  - "analyzeFile calls loadActivePatterns(db, input.userId) — no subscriptionPlan gating (D-03)"
  - "Try/catch isolated: markFileFailed not called, error not rethrown, patternSuggestions stays [] (D-01)"
  - "Warn payload contains only {event, message, userId, fileId} — no raw error, no rows, no objectKey (ANL-05 / T-34-01)"
  - "Sort+cap applied in analyzeFile: .sort((a, b) => b.matchCount - a.matchCount).slice(0, 5) (D-06 / ADR-0002)"
  - "Rule 1 auto-fix: Wave 0 test scaffold had off-by-one assertion (index[4] expected 3, data gives 2) — corrected toBe(2)"
  - "Rule 1 auto-fix: tests/import-preview-ui.test.tsx baseResult mock missing patternSuggestions field — added patternSuggestions: []"
metrics:
  duration: "12m"
  completed_at: "2026-05-23T08:35:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
---

# Phase 34 Plan 02: detectPatternSuggestions Integration — analyzeFile Summary

Wire `detectPatternSuggestions` from `lib/utils/pattern-suggestions.ts` into `analyzeFile` in `lib/services/import.ts`, extending `ImportAnalysisResult` with `patternSuggestions: PatternSuggestion[]` — isolated try/catch, sort+cap at 5, sanitized warn log.

## Files Modified

| File | Change |
|------|--------|
| `lib/services/import.ts` | +4 import lines, +1 type field, +25 lines (try/catch block + return field) |
| `tests/import-service.test.ts` | -1 line: fix Wave 0 off-by-one assertion (index[4] toBe(3) → toBe(2)) |
| `tests/import-preview-ui.test.tsx` | +1 line: add `patternSuggestions: []` to `baseResult` mock |

## Task 1: Type Extension and Import (commit 0c12a8b)

Two edits to `lib/services/import.ts`:

**Import block added after categorization imports (lines 27–31):**
```typescript
import {
  detectPatternSuggestions,
  type PatternDetectorRow,
  type PatternSuggestion,
} from '@/lib/utils/pattern-suggestions'
```

**Type field added to `ImportAnalysisResult` (line 56):**
```typescript
patternSuggestions: PatternSuggestion[]
```

Expected RED signal confirmed: `yarn tsc --noEmit` reported `Property 'patternSuggestions' is missing` in the `analyzeFile` return statement, as planned.

Also fixed `tests/import-preview-ui.test.tsx` `baseResult` mock to include `patternSuggestions: []` (Rule 1 auto-fix — type mismatch introduced by additive type extension).

## Task 2: analyzeFile Integration (commit f66d950)

### Inserted try/catch block (lines 297–321)

Location: immediately after `applyExistingHashesToStats` assignment and before `const sampleRows` mapping.

```typescript
let patternSuggestions: PatternSuggestion[] = []
if (best) {
  try {
    const activePatterns = await loadActivePatterns(db, input.userId)
    const detectorRows: PatternDetectorRow[] = provisionalStats.normalizedRows.map((r) => ({
      description: r.description,
      normalizedDescription: r.normalizedDescription,
      amount: r.amount,
      valid: r.valid,
      covered: false,
    }))
    const raw = detectPatternSuggestions(detectorRows, activePatterns)
    patternSuggestions = raw
      .sort((a, b) => b.matchCount - a.matchCount)
      .slice(0, 5)
  } catch (error) {
    const msg = safeImportErrorMessage(error, 'Pattern suggestion detection failed.')
    logger.warn({
      event: 'pattern_suggestion_detection_failed',
      message: msg,
      userId: input.userId,
      fileId: input.fileId,
    })
  }
}
```

### Updated return statement (lines 368–379)

Added `patternSuggestions` as last field.

### Rule 1 auto-fix: Wave 0 test assertion

The test case "returns at most 5 suggestions sorted by matchCount descending" had raw data `[b=2, a=10, c=7, d=3, e=5, f=1]`. After sorting descending and slicing to 5: `[10, 7, 5, 3, 2]`. The Wave 0 scaffold incorrectly asserted `index[4] toBe(3)`; the correct value is `2`. Fixed `toBe(3)` → `toBe(2)`.

## Test Transitions: Wave 0 RED → GREEN

All 6 Phase 34 Wave 0 cases in `describe('analyzeFile — pattern suggestions')`:

| # | Test Name | Req | Result |
|---|-----------|-----|--------|
| 1 | `includes patternSuggestions field in result even when empty` | ANL-01 | RED → GREEN |
| 2 | `includes patternSuggestions as [] when analysis produces errors` | ANL-01 + D-07 | RED → GREEN |
| 3 | `returns at most 5 suggestions sorted by matchCount descending` | ANL-03 | RED → GREEN (after Rule 1 fix) |
| 4 | `returns patternSuggestions [] and logs a warning when detection throws` | ANL-05 | RED → GREEN |
| 5 | `does not require subscriptionPlan — calls loadActivePatterns for all plans` | D-03 | RED → GREEN |
| 6 | `skips loadActivePatterns when no format is detected` | D-05 / SCOP-01 | RED → GREEN |

## TypeScript Output

`yarn tsc --noEmit` exits 0. Only pre-existing errors remain (`NODE_ENV` in `tests/production-smoke.test.ts` and `tests/set-r2-cors.test.ts` — confirmed pre-existing via git stash baseline check).

## Full Test Suite

```
Tests  557 passed | 1 todo (558)
Test Files  51 passed (51)
```

No regressions across any pre-existing test file.

## Cross-File Impact

- `lib/actions/import.ts` — NOT modified. Type extension is additive; the action passes `ImportAnalysisResult` through unchanged. TypeScript clean.
- `app/(app)/import/[fileId]/analyze/page.tsx` — NOT modified. Additive type propagates transparently.
- `components/import/import-preview.tsx` — NOT modified. Component receives `ImportAnalysisResult` as prop; `patternSuggestions` is unused in Phase 34 UI — Phase 35 will wire it.

## ROADMAP.md Phase 34 Success Criteria Mapping

| Criterion | Evidence |
|-----------|----------|
| 1. `analyzeFile` returns capped, ranked `patternSuggestions` | Tests 1 & 3 GREEN (ANL-01, ANL-03) |
| 2. Suggestion detection uses same active-pattern coverage as `importFile` | Test 5 GREEN: `loadActivePatterns(db, userId)` called with same signature (D-03, D-04) |
| 3. Analysis failures remain safe — no R2 key / presigned URL / raw row / stack trace leaks | Test 4 GREEN: `logPayload` does not contain URL or stack-frame substrings (ANL-05 / T-34-01) |
| 4. Existing analysis and confirmation behavior still works when no suggestions | Tests 1 + full suite GREEN |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wave 0 test scaffold off-by-one assertion**
- **Found during:** Task 2 (test run)
- **Issue:** Test case 3 asserted `result.patternSuggestions[4]!.matchCount` to be `3`, but raw data array has `b.matchCount = 2` at index 4 after sort. The sorted slice `[10, 7, 5, 3, 2]` yields `2` not `3`.
- **Fix:** Changed assertion `toBe(3)` → `toBe(2)` in `tests/import-service.test.ts` line 1527.
- **Files modified:** `tests/import-service.test.ts`
- **Commit:** f66d950

**2. [Rule 1 - Bug] Import preview test mock missing required field**
- **Found during:** Task 1 (tsc check after type extension)
- **Issue:** `tests/import-preview-ui.test.tsx` `baseResult` object did not include `patternSuggestions`, causing TS2769 type error after `ImportAnalysisResult` gained the required field.
- **Fix:** Added `patternSuggestions: []` to `baseResult` in the test file.
- **Files modified:** `tests/import-preview-ui.test.tsx`
- **Commit:** 0c12a8b

## Known Stubs

None — `patternSuggestions` is fully populated in the service layer. Phase 35 consumes it in the UI (no stubs in this plan).

## Threat Surface Scan

The try/catch payload enforces T-34-01 mitigation: only `{ event, message, userId, fileId }` passed to `logger.warn`. `message` is produced by `safeImportErrorMessage` which strips `https?://...` URLs and `\s+at\s+...` stack frames and caps at 500 chars. Verified by test 4 security assertions. No new trust boundaries introduced.

## Hand-off Note for Phase 35

`analyzeFile` now returns `result.patternSuggestions: PatternSuggestion[]` (always present, possibly empty) in `ImportAnalysisResult`. Phase 35 should consume this field in `components/import/import-preview.tsx` to render suggestion cards. No further service-layer work needed for Phase 34 scope.

## Self-Check: PASSED

- `lib/services/import.ts` exists and contains all required changes (import block, type field, try/catch block, return field)
- `tests/import-service.test.ts` exists with corrected assertion
- `tests/import-preview-ui.test.tsx` exists with added `patternSuggestions: []`
- Commit `0c12a8b` verified: Task 1 (type extension + import + test mock fix)
- Commit `f66d950` verified: Task 2 (full integration + test assertion fix)
- `yarn tsc --noEmit` exits 0
- `yarn test` 557 passed, 1 todo — all Wave 0 RED tests are GREEN
