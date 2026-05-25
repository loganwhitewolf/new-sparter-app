# Phase 34: import-analysis-suggestions — Research

**Researched:** 2026-05-22
**Domain:** Service integration — wiring `detectPatternSuggestions` into `analyzeFile`
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Failure handling:** If suggestion detection fails (exception in `loadActivePatterns` or `detectPatternSuggestions`), the import analysis must NOT fail. Catch the exception, log a `logger.warn` with `error.message` safe-truncated (no R2 keys, presigned URLs, raw rows, or stack traces — same pattern as `safeImportErrorMessage`), and return `patternSuggestions: []`. File status stays `analyzed`.

**D-02 — Warning log format:** The warning log message must be a fixed-prefix string (e.g. `'Pattern suggestion detection failed'`) with only `error.message` appended. Do not log the rows array, object keys, or any import-file data.

**D-03 — Subscription gating:** Pattern suggestions are available to all subscription plans including `free`. No `subscriptionPlan` parameter added to `analyzeFile`.

**D-04 — Pattern coverage set:** `loadActivePatterns(db, userId)` is called as-is — it loads both user-owned patterns and system patterns (`userId IS NULL`). Same coverage set as `importFile`'s categorization pipeline.

**D-05 — Integration placement:** Suggestion detection runs after `normalizedRows` are computed and after `existingHashes` are resolved. It runs only when `best` (detected format) is non-null.

**D-06 — Sort and cap:** Sort by `matchCount` descending and cap at 5 in `analyzeFile` before returning.

**D-07 — Always present:** `patternSuggestions` is always present in `ImportAnalysisResult` even when `errors.length > 0`. On error or no rows, it is `[]`.

### Claude's Discretion

- Local helper function naming for the `NormalizedTransactionRow` → `PatternDetectorRow` adapter (inline or extracted private function — either is fine).
- Whether to reuse `safeImportErrorMessage` directly or mirror its pattern inline for the warning log.
- Whether to add adapter-level unit tests in this phase (acceptable to defer to later; detector is fully tested in Phase 33).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ANL-01 | Import analysis returns `patternSuggestions` in `ImportAnalysisResult` | Extend type at line 33–51 of `lib/services/import.ts`; add field to return object at line 336–345 |
| ANL-03 | Import analysis returns at most 5 pattern suggestions sorted by `matchCount` descending | Sort+cap sequence in `analyzeFile` after detector call; see D-06 |
| ANL-05 | Pattern suggestion detection failures do not leak raw R2 object keys, presigned URLs, raw rows, or stack traces | Wrap detector call in try/catch; apply `safeImportErrorMessage` pattern; see D-01/D-02 |
| SCOP-01 | Dismissed suggestions are not persisted | No persistence layer touched in this phase — purely ephemeral in `ImportAnalysisResult` |
| SCOP-02 | Pattern suggestions are scoped to one import file, not global transaction history | `detectPatternSuggestions` receives only `normalizedRows` from the current file |
</phase_requirements>

---

## Summary

Phase 34 is a pure service-integration phase. The detector function (`detectPatternSuggestions`) was delivered and fully tested in Phase 33 as a pure function in `lib/utils/pattern-suggestions.ts`. This phase wires it into `analyzeFile` in `lib/services/import.ts`, extending `ImportAnalysisResult` with a `patternSuggestions: PatternSuggestion[]` field.

The integration has three moving parts: (1) a thin row adapter that maps `NormalizedTransactionRow[]` to `PatternDetectorRow[]`, (2) a `loadActivePatterns` call to get the coverage set for the detector's second argument, and (3) a try/catch isolation block that satisfies ANL-05 — failure in suggestion detection must never propagate to the caller or alter file status. The ADR explicitly places truncation responsibility on the caller (`analyzeFile`), so the sort+cap (`matchCount desc`, slice to 5) lives here.

No new schema, no UI changes, no dismissed-suggestions persistence. The action layer (`lib/actions/import.ts`) passes `ImportAnalysisResult` through automatically — the TypeScript type addition propagates upward with no behavioral change required in the action.

**Primary recommendation:** Extend `ImportAnalysisResult`, add a single isolated try/catch block immediately after the `existingHashes` resolution (guarded by `best !== null`), call `loadActivePatterns(db, userId)` and `detectPatternSuggestions`, sort+cap, and return. Keep the adapter inline to minimize indirection in a short function.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pattern detection algorithm | Service utils (`lib/utils/`) | — | Pure function, no I/O, already delivered in Phase 33 |
| Pattern coverage loading | Service (`lib/services/categorization.ts`) | DB | `loadActivePatterns` is the established pattern-loading API |
| Analysis result assembly | Service (`lib/services/import.ts`) | — | `analyzeFile` owns `ImportAnalysisResult` construction |
| Failure isolation | Service (`lib/services/import.ts`) | — | Same layer that owns other try/catch isolation patterns |
| Result pass-through | Action (`lib/actions/import.ts`) | — | Passes `ImportAnalysisResult` as-is; no behavioral change |

---

## Standard Stack

### Core (all already installed)

| Library | Purpose | Notes |
|---------|---------|-------|
| `lib/utils/pattern-suggestions.ts` | `detectPatternSuggestions`, `PatternDetectorRow`, `CoveragePattern`, `PatternSuggestion` | Phase 33 delivery; no npm install needed |
| `lib/services/categorization.ts` | `loadActivePatterns` | Already imported by `importFile`; not yet imported by `analyzeFile` |
| `lib/logger.ts` | `logger.warn` for failure isolation log | Already imported in `lib/services/import.ts` |

No new npm dependencies. [VERIFIED: codebase grep]

---

## Architecture Patterns

### System Architecture Diagram

```
analyzeFile(userId, fileId, selectedFormatVersionId?)
  │
  ├── readR2Bytes(objectKey)          [try/catch → markFileFailed + throw]
  ├── parseImportFile(bytes)          [try/catch → markFileFailed + throw]
  ├── loadImportFormatsForDetection
  ├── detectImportFormat              → best (FormatCandidate | null)
  │
  ├── if (best)
  │   ├── deriveFullFileImportStats   → provisionalStats (normalizedRows, allHashes, …)
  │   ├── getDuplicateHashes          → existingHashes
  │   └── applyExistingHashesToStats  → fullStats
  │
  ├── [NEW] if (best)
  │   ├── loadActivePatterns(db, userId)   → ActivePattern[] (CoveragePattern duck-type)
  │   ├── adapt normalizedRows → PatternDetectorRow[]
  │   ├── detectPatternSuggestions(rows, patterns)
  │   └── sort by matchCount desc, slice(0, 5)
  │   [try/catch → logger.warn(safeMsg); patternSuggestions = []]
  │
  ├── updateFileAnalysisState
  └── return ImportAnalysisResult { …existing fields…, patternSuggestions }
```

### Recommended Project Structure

No new files or folders. All changes occur within:

```
lib/services/import.ts     — analyzeFile, ImportAnalysisResult (PRIMARY CHANGE FILE)
lib/utils/pattern-suggestions.ts  — read-only (detector already delivered)
lib/services/categorization.ts    — read-only (loadActivePatterns already exists)
tests/import-service.test.ts      — new test cases for analyzeFile with suggestions
```

### Pattern 1: Isolated try/catch block (non-critical detection)

**What:** Wrap the entire suggestion detection block in try/catch. On exception, `logger.warn` with a sanitized message, set `patternSuggestions = []`. No call to `markFileFailed` — detection failure is non-critical.

**When to use:** Any async step in `analyzeFile` that is additive (enhances the result) but must not degrade the core analysis outcome.

```typescript
// Source: extrapolated from existing safeImportErrorMessage + isolation pattern in lib/services/import.ts
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
    logger.warn({ event: 'pattern_suggestion_detection_failed', message: msg, userId: input.userId, fileId: input.fileId })
  }
}
```

**Key detail:** `provisionalStats` (not `fullStats`) is used for the adapter — `provisionalStats.normalizedRows` contains ALL rows including those that will be deduped. This is correct because the detector should see all valid uncategorized rows, not just those that will be imported.

**Alternative:** Use `fullStats.normalizedRows` — but `fullStats` is just `provisionalStats` with updated counts; the `normalizedRows` array is identical between them. Either works. Use `provisionalStats.normalizedRows` since it is computed before `applyExistingHashesToStats`.

### Pattern 2: Duck-type structural compatibility

**What:** `ActivePattern` from `loadActivePatterns` satisfies `CoveragePattern` structurally — both have `pattern: string` and `amountSign: 'positive' | 'negative' | 'any'`. No casting required because TypeScript structural typing accepts `ActivePattern[]` where `CoveragePattern[]` is expected.

**When to use:** Whenever a richer type satisfies a narrower interface structurally — no wrapper or explicit cast needed.

### Anti-Patterns to Avoid

- **Calling `markFileFailed` in the suggestion try/catch:** Detection is non-critical; file status stays `analyzed` even on detection failure. `markFileFailed` is reserved for core analysis failures (R2 read, parse failure).
- **Logging the rows array:** D-02 is strict — only `error.message` appended to a fixed prefix. No row data, no object keys in the log payload.
- **Placing detection before `existingHashes`:** D-05 requires `existingHashes` to be resolved first. (In practice, the `normalizedRows` used by the detector are the same regardless of `existingHashes`, but the ordering constraint is architectural — follow it.)
- **Sorting inside the detector:** The detector returns unsorted. The ADR places truncation responsibility on callers. Sort+cap happens in `analyzeFile`, not in `detectPatternSuggestions`.
- **Passing `fullStats.normalizedRows` after `applyExistingHashesToStats`:** `applyExistingHashesToStats` does not modify `normalizedRows` — it only adjusts counts. The rows are identical. Using `provisionalStats.normalizedRows` is cleaner and avoids confusion.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pattern detection algorithm | Custom bucketing/grouping | `detectPatternSuggestions` from `lib/utils/pattern-suggestions.ts` | Phase 33 delivered this with full test coverage; hand-rolling duplicates complexity |
| Regex escaping | Custom escape function | `detectPatternSuggestions` handles escaping internally | SUG-06 coverage already present in the detector |
| Coverage check | Re-implementing regex coverage test | Pass `activePatterns` as second arg to `detectPatternSuggestions` | Detector calls `isCoveredByPatterns` internally |
| Error sanitization | Custom redaction logic | `safeImportErrorMessage` (already in `lib/services/import.ts`) | Strips URLs, stack traces, caps to 500 chars |

---

## Common Pitfalls

### Pitfall 1: Using `db` vs `DbOrTx` in `analyzeFile`

**What goes wrong:** `analyzeFile` is not transactional (unlike `importFile`). It calls `getDuplicateHashes(db, …)` using `db` directly. `loadActivePatterns` must also be called with `db` (not a `tx`), since there is no wrapping transaction.

**Why it happens:** `loadActivePatterns` signature is `(database: DbOrTx, userId: string)` — it accepts both, so no type error fires if the wrong one is passed.

**How to avoid:** Pass `db` (imported from `@/lib/db`) to `loadActivePatterns(db, input.userId)` — consistent with `getDuplicateHashes(db, …)` in the same function.

**Warning signs:** If a reviewer sees `tx` used where `analyzeFile` has no wrapping `db.transaction`, flag it.

### Pitfall 2: Detection placed before `existingHashes` resolution

**What goes wrong:** D-05 specifies detection runs after `existingHashes` are resolved. Placing it before would violate the locked ordering.

**Why it happens:** The `normalizedRows` are the same either way, so it might seem equivalent — but the decision is locked for architectural clarity.

**How to avoid:** Place the suggestion try/catch block after the `applyExistingHashesToStats` call.

### Pitfall 3: Logging sensitive data in the warning path

**What goes wrong:** The error object from `loadActivePatterns` or `detectPatternSuggestions` could contain stack frames referencing internal paths or the error message from an upstream call could embed row data.

**Why it happens:** Structured loggers accept arbitrary objects — easy to accidentally log `{ error }` or `{ error, rows }`.

**How to avoid:** Only pass `safeImportErrorMessage(error, fallback)` output to the log. Never include `input.userId`'s rows, the `normalizedRows` array, or raw R2 object keys.

### Pitfall 4: TypeScript errors on `ImportAnalysisResult` consumers

**What goes wrong:** `ImportAnalysisResult` is referenced in `lib/actions/import.ts` (re-exported) and `app/(app)/import/[fileId]/analyze/page.tsx`. Adding `patternSuggestions: PatternSuggestion[]` to the type makes the action pass-through automatically — but the `page.tsx` uses `result.data` for `<ImportPreview>`. If `ImportPreview` destructures `ImportAnalysisResult`, TypeScript will require it to handle the new field.

**Why it happens:** Phase 35 adds the UI — Phase 34 adds the data. The page currently passes `result.data` to `<ImportPreview result={result.data} />`, which accepts `ImportAnalysisResult`. If `ImportPreview`'s prop type is inferred from the service type, it will gain `patternSuggestions` without requiring a change.

**How to avoid:** After extending the type, check that `ImportPreview` still compiles. Since `ImportPreview` likely spreads or uses individual fields, adding a field to the source type is additive and safe. Run `yarn tsc --noEmit` as part of Wave 1 verification.

### Pitfall 5: Sort mutates the original array

**What goes wrong:** `Array.prototype.sort` mutates in-place. Sorting the array returned by `detectPatternSuggestions` directly is fine since it's a fresh array, but if code is restructured to pass a reference elsewhere first, the mutation is unexpected.

**How to avoid:** The pattern `raw.sort((a, b) => b.matchCount - a.matchCount).slice(0, 5)` is safe because `raw` is a local variable returned fresh from the detector.

---

## Code Examples

### Full integration block (inside `analyzeFile`, after `applyExistingHashesToStats`)

```typescript
// Source: CONTEXT.md D-05, D-06, D-07; lib/services/import.ts isolation pattern
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
    patternSuggestions = raw.sort((a, b) => b.matchCount - a.matchCount).slice(0, 5)
  } catch (error) {
    const msg = safeImportErrorMessage(error, 'Pattern suggestion detection failed.')
    logger.warn({ event: 'pattern_suggestion_detection_failed', message: msg, userId: input.userId, fileId: input.fileId })
  }
}
```

### `ImportAnalysisResult` type extension

```typescript
// Source: lib/services/import.ts line 33; lib/utils/pattern-suggestions.ts PatternSuggestion
import type { PatternSuggestion } from '@/lib/utils/pattern-suggestions'

export type ImportAnalysisResult = {
  fileId: string
  formatVersionId: number | null
  platformName: string | null
  rowCount: number
  duplicateCount: number
  warnings: string[]
  errors: string[]
  sampleRows: { … }[]
  patternSuggestions: PatternSuggestion[]   // NEW — ANL-01
}
```

### Import additions required in `lib/services/import.ts`

```typescript
import {
  detectPatternSuggestions,
  type PatternDetectorRow,
  type PatternSuggestion,
} from '@/lib/utils/pattern-suggestions'
// loadActivePatterns is already imported from '@/lib/services/categorization'
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vitest.config.ts` |
| Quick run command | `yarn test -- --reporter=verbose tests/import-service.test.ts` |
| Full suite command | `yarn test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANL-01 | `analyzeFile` result includes `patternSuggestions` field | unit | `yarn test -- tests/import-service.test.ts` | ✅ (new cases in existing file) |
| ANL-03 | Returns at most 5 suggestions sorted by `matchCount` desc | unit | `yarn test -- tests/import-service.test.ts` | ✅ (new cases in existing file) |
| ANL-05 | Detection failure logs warning, returns `[]`, does not propagate | unit | `yarn test -- tests/import-service.test.ts` | ✅ (new cases in existing file) |
| SCOP-01 | No DB writes for suggestions (dismissed not persisted) | covered by ANL-01 test (no extra DB mock calls) | — | — |
| SCOP-02 | Only current file's rows fed to detector | covered by ANL-01 test (detector receives `provisionalStats.normalizedRows` only) | — | — |

### Sampling Rate

- **Per task commit:** `yarn test -- tests/import-service.test.ts`
- **Per wave merge:** `yarn test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] New test cases in `tests/import-service.test.ts` — covers ANL-01, ANL-03, ANL-05

  Required new mock: `detectPatternSuggestions` must be mockable in `import-service.test.ts`. The existing test file already mocks `@/lib/services/categorization` (for `loadActivePatterns`). It does not currently mock `@/lib/utils/pattern-suggestions`. Wave 0 must add:

  ```typescript
  // in vi.hoisted() block
  detectPatternSuggestions: vi.fn(),
  // in vi.mock block
  vi.mock('@/lib/utils/pattern-suggestions', () => ({
    detectPatternSuggestions: mocks.detectPatternSuggestions,
  }))
  ```

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | `safeImportErrorMessage` — strips URLs, stack traces, caps at 500 chars |
| V2 Authentication | no | No new auth boundary |
| V4 Access Control | no | `loadActivePatterns` scoped by `userId` (same as existing) |
| V6 Cryptography | no | No new crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Log injection via error.message | Information Disclosure | `safeImportErrorMessage` sanitizes URLs and stack frames before logging |
| R2 key leakage in warning log | Information Disclosure | Fixed-prefix log string; only `error.message` post-sanitization appended (D-02) |

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — code-only changes, no new services, CLIs, or runtimes required).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `provisionalStats.normalizedRows` and `fullStats.normalizedRows` are the same array reference (since `applyExistingHashesToStats` uses spread `{ ...stats, … }` and does not modify `normalizedRows`) | Code Examples | If they differ, detector could miss rows — verify by reading `applyExistingHashesToStats` (line 203 of import.ts, confirmed by reading source: uses `{ ...stats, importedCount, duplicateCount }` spread — `normalizedRows` is preserved) [VERIFIED: codebase read] |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed. A1 has been self-resolved as VERIFIED.

---

## Open Questions

None. All decisions are locked in CONTEXT.md and all code interfaces have been read directly from source.

---

## Sources

### Primary (HIGH confidence)

- `lib/services/import.ts` (read in session) — `analyzeFile`, `ImportAnalysisResult`, `safeImportErrorMessage`, isolation patterns
- `lib/utils/pattern-suggestions.ts` (read in session) — `detectPatternSuggestions`, `PatternDetectorRow`, `CoveragePattern`, `PatternSuggestion`
- `lib/services/categorization.ts` (read in session) — `loadActivePatterns`, `ActivePattern`
- `lib/utils/import.ts` (read in session) — `NormalizedTransactionRow`
- `docs/adr/0002-pattern-suggestion-detection.md` (read in session) — algorithm, cap, caller-truncation responsibility
- `tests/import-service.test.ts` (read in session) — existing mock setup, test patterns, vitest mock conventions
- `.planning/phases/34-import-analysis-suggestions/34-CONTEXT.md` (read in session) — all locked decisions
- `lib/actions/import.ts` (read in session) — pass-through confirmation
- `app/(app)/import/[fileId]/analyze/page.tsx` (read in session) — consumer of `ImportAnalysisResult`

### Secondary (MEDIUM confidence)

- `tests/pattern-suggestion-detector.test.ts` (read in session) — test shape conventions for the detector

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries are already in the codebase; read directly from source
- Architecture: HIGH — all integration points read from source; no speculation
- Pitfalls: HIGH — derived directly from code reading and locked decisions
- Test plan: HIGH — existing test file infrastructure confirmed; mock gap identified precisely

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (stable codebase; no external dependencies)
