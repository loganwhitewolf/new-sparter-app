# Phase 34: import-analysis-suggestions - Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 2 (1 modified + 1 new test cases in existing file)
**Analogs found:** 2 / 2

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/services/import.ts` | service | request-response | `lib/services/import.ts` (same file — `importFile` is the analog for `analyzeFile` extension) | exact |
| `tests/import-service.test.ts` | test | — | `tests/import-service.test.ts` (existing file — new `describe` blocks added) | exact |

## Pattern Assignments

### `lib/services/import.ts` — `ImportAnalysisResult` type extension

**Analog:** lines 33–51 (existing type definition)

**Current type** (lines 33–51):
```typescript
export type ImportAnalysisResult = {
  fileId: string
  formatVersionId: number | null
  platformName: string | null
  rowCount: number
  duplicateCount: number
  warnings: string[]
  errors: string[]
  sampleRows: {
    rowIndex: number
    description: string
    amount: string | null
    occurredAt: string | null
    duplicate: boolean
    valid: boolean
    errors: string[]
    warnings: string[]
  }[]
}
```

**New field to append before the closing `}`:**
```typescript
  patternSuggestions: PatternSuggestion[]
```

**Import addition** — add to the existing import block at top of file (lines 1–31):
```typescript
import {
  detectPatternSuggestions,
  type PatternDetectorRow,
  type PatternSuggestion,
} from '@/lib/utils/pattern-suggestions'
// loadActivePatterns is already imported at line 24 from '@/lib/services/categorization'
```

---

### `lib/services/import.ts` — integration block inside `analyzeFile`

**Analog:** existing isolation try/catch blocks at lines 249–265 (`readR2Bytes`) and lines 258–265 (`parseImportFile`). Those blocks follow: catch → `safeImportErrorMessage` → `markFileFailed` → `throw`. The suggestion block is identical in structure but does NOT call `markFileFailed` and does NOT rethrow.

**Placement:** after `applyExistingHashesToStats` call (line 288) and before the `sampleRows` mapping (line 291). The `best` guard is already present in the surrounding context.

**Non-critical isolation pattern** (copy from existing `importFile` categorization error at lines 523–527):
```typescript
// importFile pattern — error suppression for non-critical step:
try {
  catResult = await categorizePipeline(tx, input.userId, plan, acc.description, acc.totalAmount, descHash, patterns)
} catch {
  // categorization error — uncategorized, never fails import
}
```

**Adapted for suggestion detection** (new block to insert after line 288):
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
    patternSuggestions = raw.sort((a, b) => b.matchCount - a.matchCount).slice(0, 5)
  } catch (error) {
    const msg = safeImportErrorMessage(error, 'Pattern suggestion detection failed.')
    logger.warn({ event: 'pattern_suggestion_detection_failed', message: msg, userId: input.userId, fileId: input.fileId })
  }
}
```

**Key detail — `db` not `tx`:** `analyzeFile` is not transactional. It calls `getDuplicateHashes(db, ...)` at line 286. Call `loadActivePatterns(db, input.userId)` consistently — NOT a `tx` variable.

**Key detail — `provisionalStats` not `fullStats`:** `applyExistingHashesToStats` (line 203–216) uses `{ ...stats, importedCount, duplicateCount }` spread and does NOT modify `normalizedRows`. Both `provisionalStats.normalizedRows` and `fullStats.normalizedRows` are the same array. Use `provisionalStats.normalizedRows` since it is computed first and the intent is clearer.

**Return statement extension** (lines 336–345 — current):
```typescript
return {
  fileId: input.fileId,
  formatVersionId: best?.formatVersionId ?? null,
  platformName: best?.platform.name ?? null,
  rowCount: parsed.rowCount,
  duplicateCount: fullStats.duplicateCount,
  warnings: detected.warnings,
  errors: detected.errors,
  sampleRows,
}
```

**New return statement** (add `patternSuggestions` field):
```typescript
return {
  fileId: input.fileId,
  formatVersionId: best?.formatVersionId ?? null,
  platformName: best?.platform.name ?? null,
  rowCount: parsed.rowCount,
  duplicateCount: fullStats.duplicateCount,
  warnings: detected.warnings,
  errors: detected.errors,
  sampleRows,
  patternSuggestions,
}
```

---

### `tests/import-service.test.ts` — new `detectPatternSuggestions` mock

**Analog:** existing mock pattern at lines 8–46 (`vi.hoisted`) and lines 214–218 (`vi.mock('@/lib/services/categorization', ...)`).

**Step 1 — add to `vi.hoisted` block** (after line 46, before the closing `}))`):
```typescript
// in vi.hoisted() block — add alongside existing mocks:
detectPatternSuggestions: vi.fn(),
```

**Step 2 — add new `vi.mock` call** (after line 218, alongside the categorization mock):
```typescript
vi.mock('@/lib/utils/pattern-suggestions', () => ({
  detectPatternSuggestions: mocks.detectPatternSuggestions,
}))
```

**Step 3 — default mock setup in `analyzeFile` describe `beforeEach`** (line 1268 area — existing `beforeEach`):
```typescript
// Add to the existing beforeEach at line 1268:
mocks.loadActivePatterns.mockResolvedValue([])
mocks.detectPatternSuggestions.mockReturnValue([])
```

**New `describe` block for ANL-01 / ANL-03 / ANL-05** — copy structure from `analyzeFile — lifecycle guards` at line 807:
```typescript
describe('analyzeFile — pattern suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getFileForUser.mockResolvedValue(makeFileRow())
    mocks.updateFileAnalysisState.mockResolvedValue(undefined)
    mocks.markFileFailed.mockResolvedValue(undefined)
    mocks.getDuplicateHashes.mockResolvedValue(new Set<string>())
    mocks.loadImportFormatsForDetection.mockResolvedValue([makeFormatCandidate()])
    mocks.loadActivePatterns.mockResolvedValue([])
    mocks.detectPatternSuggestions.mockReturnValue([])
    mocks.readObjectBody.mockResolvedValue(
      (async function* () { yield GENERAL_CSV })(),
    )
    mocks.parseImportFile.mockResolvedValue(makeParsedImport())
  })

  // ANL-01: patternSuggestions is always present in ImportAnalysisResult
  it('includes patternSuggestions field in result even when empty', async () => {
    const result = await analyzeFile({ userId: USER_ID, fileId: FILE_ID })
    expect(result).toHaveProperty('patternSuggestions')
    expect(result.patternSuggestions).toEqual([])
  })

  // ANL-01 + D-07: patternSuggestions present even when errors.length > 0
  it('includes patternSuggestions as [] when analysis produces errors', async () => {
    // test with no-format scenario — errors array is non-empty
    mocks.loadImportFormatsForDetection.mockResolvedValue([])
    const result = await analyzeFile({ userId: USER_ID, fileId: FILE_ID })
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result).toHaveProperty('patternSuggestions', [])
  })

  // ANL-03: sorted by matchCount desc, capped at 5
  it('returns at most 5 suggestions sorted by matchCount descending', async () => {
    const raw = [
      { pattern: 'b', matchCount: 2, detectedAmountSign: 'any' as const, sampleDescriptions: [] },
      { pattern: 'a', matchCount: 10, detectedAmountSign: 'negative' as const, sampleDescriptions: [] },
      { pattern: 'c', matchCount: 7, detectedAmountSign: 'any' as const, sampleDescriptions: [] },
      { pattern: 'd', matchCount: 3, detectedAmountSign: 'any' as const, sampleDescriptions: [] },
      { pattern: 'e', matchCount: 5, detectedAmountSign: 'any' as const, sampleDescriptions: [] },
      { pattern: 'f', matchCount: 1, detectedAmountSign: 'any' as const, sampleDescriptions: [] },
    ]
    mocks.detectPatternSuggestions.mockReturnValue(raw)

    const result = await analyzeFile({ userId: USER_ID, fileId: FILE_ID })

    expect(result.patternSuggestions).toHaveLength(5)
    expect(result.patternSuggestions[0]!.matchCount).toBe(10)
    expect(result.patternSuggestions[4]!.matchCount).toBe(3)
  })

  // ANL-05: detection failure does not propagate, logs warn, returns []
  it('returns patternSuggestions [] and logs a warning when detection throws', async () => {
    mocks.loadActivePatterns.mockRejectedValue(new Error('DB timeout with https://internal-r2/secret-key'))

    const result = await analyzeFile({ userId: USER_ID, fileId: FILE_ID })

    expect(result.patternSuggestions).toEqual([])
    expect(result.errors).toHaveLength(0) // file still analyzed
    expect(mocks.loggerWarn).toHaveBeenCalledWith(expect.objectContaining({
      event: 'pattern_suggestion_detection_failed',
    }))
    // Sensitive data must not appear in log
    const logPayload = JSON.stringify(mocks.loggerWarn.mock.calls)
    expect(logPayload).not.toContain('https://internal-r2/secret-key')
    expect(logPayload).not.toContain('Supermercato Esselunga')
  })

  // D-03: no subscriptionPlan parameter added — free users get suggestions
  it('does not require subscriptionPlan — calls loadActivePatterns for all plans', async () => {
    await analyzeFile({ userId: USER_ID, fileId: FILE_ID })
    expect(mocks.loadActivePatterns).toHaveBeenCalledWith(expect.anything(), USER_ID)
  })

  // D-05: loadActivePatterns is skipped when best is null
  it('skips loadActivePatterns when no format is detected', async () => {
    mocks.loadImportFormatsForDetection.mockResolvedValue([])
    await analyzeFile({ userId: USER_ID, fileId: FILE_ID })
    expect(mocks.loadActivePatterns).not.toHaveBeenCalled()
  })
})
```

---

## Shared Patterns

### Error isolation (non-critical step)

**Source:** `lib/services/import.ts` lines 522–527 (categorization error inside `importFile`)
**Apply to:** The suggestion detection try/catch block only — this is the only non-critical async step in `analyzeFile`.

```typescript
try {
  // ... non-critical step ...
} catch {
  // step error — non-critical, never fails the parent operation
}
```

The suggestion variant extends this pattern by logging a sanitized warning (D-02) rather than silently swallowing the error.

### Safe error message extraction

**Source:** `lib/services/import.ts` lines 93–109 (`safeImportErrorMessage`)
**Apply to:** The `catch` block of the suggestion detection try/catch.

```typescript
function safeImportErrorMessage(
  error: unknown,
  fallback: string,
  options: { exposeMessage?: boolean } = { exposeMessage: true },
): string {
  const raw = options.exposeMessage === false
    ? fallback
    : error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : fallback
  return raw
    .replace(/https?:\/\/\S+/g, '[redacted-url]')
    .replace(/\s+at\s+[^\n]+/g, '')
    .slice(0, SAFE_ERROR_MAX_LENGTH)
}
```

Call with default options (exposeMessage: true) — same as the R2 read failure at line 253. This strips URLs and stack frames from `error.message` and caps at 500 chars.

### Structured logger warn pattern

**Source:** `lib/services/import.ts` lines 80–91 (`logImportRetry`) and the `logger` import at line 31.
**Apply to:** The suggestion detection warning log.

```typescript
// Existing warn call pattern (line 273):
logger.warn({ event: 'import_format_wizard.retry_failed', userId: input.userId, fileId: input.fileId, formatVersionId: selectedFormatVersionId, code: 'selected_format_inaccessible' })

// Suggestion detection warning follows same shape:
logger.warn({ event: 'pattern_suggestion_detection_failed', message: msg, userId: input.userId, fileId: input.fileId })
```

Do NOT include `normalizedRows`, row data, or raw error objects as log fields — only the sanitized `msg` string.

### Vitest mock registration pattern

**Source:** `tests/import-service.test.ts` lines 8–46 (`vi.hoisted`) and lines 214–218.
**Apply to:** New `detectPatternSuggestions` mock.

```typescript
// Pattern: declare fn in vi.hoisted, register in vi.mock, configure in beforeEach
const mocks = vi.hoisted(() => ({
  existingMock: vi.fn(),
  detectPatternSuggestions: vi.fn(),  // add here
}))

vi.mock('@/lib/utils/pattern-suggestions', () => ({
  detectPatternSuggestions: mocks.detectPatternSuggestions,
}))

// In beforeEach:
mocks.detectPatternSuggestions.mockReturnValue([])  // safe default
```

## No Analog Found

None. All files in scope have close analogs within the same file (service isolation pattern, mock registration pattern).

## Metadata

**Analog search scope:** `lib/services/import.ts`, `lib/services/categorization.ts`, `lib/utils/pattern-suggestions.ts`, `tests/import-service.test.ts`
**Files read:** 4
**Pattern extraction date:** 2026-05-22
