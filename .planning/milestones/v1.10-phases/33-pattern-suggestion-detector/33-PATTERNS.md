# Phase 33: pattern-suggestion-detector - Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 2
**Analogs found:** 2 / 2

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/utils/pattern-suggestions.ts` | utility | transform | `lib/utils/import.ts` | role-match |
| `tests/pattern-suggestion-detector.test.ts` | test | — | `tests/dashboard-utils.test.ts` | exact |

## Pattern Assignments

### `lib/utils/pattern-suggestions.ts` (utility, transform)

**Primary analog:** `lib/utils/import.ts`
**Secondary analog:** `lib/utils/dashboard.ts`

**Imports pattern** — `lib/utils/import.ts` lines 1-3 and `lib/utils/dashboard.ts` lines 1-2:

```typescript
// lib/utils/import.ts — no 'server-only', no framework imports; node:crypto only when needed
import Decimal from 'decimal.js'
// lib/utils/dashboard.ts — same shape
import { toDecimal } from '@/lib/utils/decimal'
```

The pattern-suggestions module has zero external dependencies. No `server-only`. No `'use server'`. Import Decimal only if using it for amount-sign comparison (Claude's discretion per D-06 — Decimal.js is preferred over parseFloat for consistency with project rules).

**Type co-location pattern** — `lib/utils/import.ts` lines 5-33:

```typescript
export type AmountType = 'single' | 'separate'

export type ImportPlatformConfig = {
  platformId?: number
  // ...
}

export type NormalizedTransactionRow = {
  rowIndex: number
  valid: boolean
  errors: string[]
  // ...
}
```

Pattern: exported types are defined at the top of the file, before the functions that consume them. No separate types file. Each type is exported explicitly with `export type`.

**Exported types to define** (from D-02, D-03, D-05 — define in this exact order at top of file):

```typescript
export interface PatternDetectorRow {
  description: string
  normalizedDescription: string
  amount: string | null
  valid: boolean
  covered: boolean
}

export interface CoveragePattern {
  pattern: string
  amountSign: 'positive' | 'negative' | 'any'
}

export interface PatternSuggestion {
  pattern: string
  matchCount: number
  detectedAmountSign: 'positive' | 'negative' | 'any'
  sampleDescriptions: string[]
}
```

**Core function signature** (from D-01, D-03, D-05):

```typescript
export function detectPatternSuggestions(
  rows: PatternDetectorRow[],
  coveragePatterns: CoveragePattern[],
): PatternSuggestion[]
```

**Coverage check pattern (inline — do NOT import from `lib/services/`)** — replicate `applyTier1Regex` from `lib/services/categorization.ts` lines 64-100:

```typescript
// lib/services/categorization.ts lines 64-77 — amountSignMatches
function amountSignMatches(
  amountSign: 'positive' | 'negative' | 'any',
  amount: string,
): boolean {
  if (amountSign === 'any') return true
  try {
    const d = new Decimal(amount)
    if (amountSign === 'positive') return d.greaterThanOrEqualTo(0)
    if (amountSign === 'negative') return d.lessThan(0)
  } catch {
    // unparseable amount — skip sign check
  }
  return true
}

// lib/services/categorization.ts lines 79-100 — applyTier1Regex (the try/catch + 'i' flag pattern)
for (const p of patterns) {
  try {
    const regex = new RegExp(p.pattern, 'i')  // ALWAYS use 'i' flag — case-insensitive
    if (regex.test(description) && amountSignMatches(p.amountSign, amount)) {
      return true
    }
  } catch {
    // invalid regex pattern — skip and continue, never fail whole import
  }
}
```

The detector replicates this pattern inline using `CoveragePattern` instead of `ActivePattern`. The `try/catch` around `new RegExp()` and the `'i'` flag are mandatory.

**`amountSign` string union** — `lib/services/categorization.ts` line 20:

```typescript
amountSign: 'positive' | 'negative' | 'any'
```

This is the established enum throughout the codebase (`ActivePattern`, `CreatePatternSchema`). Use the identical literal union in `CoveragePattern` and `PatternSuggestion.detectedAmountSign`.

**Error handling pattern** — `lib/utils/import.ts` lines 107-113:

```typescript
try {
  const decimal = new Decimal(normalized)
  if (!decimal.isFinite()) return null
  return toDbDecimal(decimal)
} catch {
  return null
}
```

Pattern: empty `catch {}` blocks (no bound variable) swallow errors and return a safe fallback. Use the same style for unparseable amounts in sign inference and for invalid regex patterns in coverage check.

**Internal helper visibility** — `lib/utils/import.ts` lines 62-64, 116:

```typescript
// Private helpers: no 'export', lowercase camelCase
function sha256(input: string) { ... }
function utcDate(year: number, ...) { ... }
```

Pattern: internal helpers are unexported. Only the four public symbols (`PatternDetectorRow`, `CoveragePattern`, `PatternSuggestion`, `detectPatternSuggestions`) are exported.

---

### `tests/pattern-suggestion-detector.test.ts` (test)

**Analog:** `tests/dashboard-utils.test.ts` (exact match — pure utility, inline data, no fixture files)

**Imports pattern** — `tests/dashboard-utils.test.ts` lines 1-2 vs `tests/import-utils.test.ts` lines 1-11:

```typescript
// dashboard-utils.test.ts — uses @/ alias (TSConfig path)
import { describe, expect, it } from 'vitest'
import { computeDeviation, buildDeviationMap } from '@/lib/utils/dashboard'

// import-utils.test.ts — uses relative path ../lib/utils/import
import { describe, expect, it } from 'vitest'
import {
  normalizeDescription,
  // ...
} from '../lib/utils/import'
```

Both conventions exist. RESEARCH.md shows the test structure using `'../lib/utils/pattern-suggestions'` (relative). Either works — pick one and be consistent. Relative path is used in RESEARCH.md examples; `@/` alias works in the test environment per `vitest.config.ts`.

**Test structure pattern** — `tests/dashboard-utils.test.ts` lines 3-22 (inline data, multiple `describe` blocks per behavior group):

```typescript
describe('computeDeviation', () => {
  it('returns signed percentage with 1-decimal rounding', () => {
    expect(computeDeviation('120.00', '100.00')).toBe(20)
    // ...
  })
  it("returns 'new' when baseline is zero and reference is non-zero", () => {
    expect(computeDeviation('100.50', '0')).toBe('new')
  })
})

describe('buildDeviationMap', () => {
  const noiseThreshold = '15.00'
  it('averages baseline across present months and returns deviation per id', () => {
    // inline data array constructed directly in the test
    const map = buildDeviationMap({ referenceRows: [...], baselineRows: [...], noiseThreshold })
    expect(map.get(1)).toBe(20)
  })
})
```

Pattern: one `describe` block per exported function (or per behavior cluster). Tests use inline data — no fixture files for pure functions. Shared constants (e.g. `noiseThreshold`) declared at `describe` scope.

**Fixture helper pattern** (from RESEARCH.md — approved for Claude's discretion):

```typescript
// Convenience builder — reduces repetition across test cases
function row(overrides: Partial<PatternDetectorRow> & { normalizedDescription: string }): PatternDetectorRow {
  return {
    description: overrides.normalizedDescription.toUpperCase(),
    amount: '-10.00',
    valid: true,
    covered: false,
    ...overrides,
  }
}
```

This is the pattern shown in RESEARCH.md. Consistent with how `tests/import-utils.test.ts` avoids fixture files for unit-level assertions.

**Assertion style** — `tests/dashboard-utils.test.ts` and `tests/import-utils.test.ts`:

```typescript
// Exact value assertions
expect(suggestions[0].pattern).toBe('pagamento pos')
expect(suggestions[0].matchCount).toBe(2)
expect(suggestions).toHaveLength(1)

// Negative assertions
expect(suggestions).toHaveLength(0)
expect(map.has(99)).toBe(false)
```

No custom matchers. `toBe`, `toHaveLength`, `toBeNull`, `toMatch` — standard Vitest matchers only.

---

## Shared Patterns

### No `server-only` / no `'use server'`
**Source:** `lib/utils/import.ts` (no server-only), `lib/utils/dashboard.ts` (no server-only)
**Apply to:** `lib/utils/pattern-suggestions.ts`

Pure utility files in `lib/utils/` do not carry `'server-only'` or `'use server'`. This is the invariant that makes them testable with Vitest without mocking. The detector must follow this pattern.

### Decimal.js for monetary sign comparisons
**Source:** `lib/services/categorization.ts` lines 64-77 (`amountSignMatches` using `new Decimal(amount)`)
**Apply to:** `lib/utils/pattern-suggestions.ts` — `inferAmountSign` helper

```typescript
// lib/services/categorization.ts lines 69-73
const d = new Decimal(amount)
if (amountSign === 'positive') return d.greaterThanOrEqualTo(0)
if (amountSign === 'negative') return d.lessThan(0)
```

The project rule prohibits native arithmetic on monetary amounts. Sign comparison is covered by this convention. Use `new Decimal(amount).lessThan(0)` for negative detection, not `parseFloat`.

### Empty `catch {}` for resilience
**Source:** `lib/utils/import.ts` lines 107-113, `lib/services/categorization.ts` lines 96-98
**Apply to:** `lib/utils/pattern-suggestions.ts` — coverage check and sign inference

```typescript
// Both patterns use bare catch with no bound variable
} catch {
  // invalid regex pattern — skip and continue, never fail whole import
}
```

Swallow errors from untrusted external data (regex patterns, amount strings). Return a safe fallback. Never let one bad row crash the whole analysis.

### `new RegExp(p.pattern, 'i')` for coverage matching
**Source:** `lib/services/categorization.ts` line 86
**Apply to:** `lib/utils/pattern-suggestions.ts` — inline coverage check

```typescript
const regex = new RegExp(p.pattern, 'i')
```

Always case-insensitive (`'i'` flag). Always wrapped in try/catch to handle invalid patterns.

### Vitest describe/it/expect, no beforeEach
**Source:** `tests/dashboard-utils.test.ts`, `tests/import-utils.test.ts`
**Apply to:** `tests/pattern-suggestion-detector.test.ts`

Neither existing test file uses `beforeEach` or shared mutable state. Data is constructed inline per test. Follow the same pattern.

---

## No Analog Found

No files lack a match — both new files have strong analogs in the codebase.

---

## Metadata

**Analog search scope:** `lib/utils/`, `lib/services/`, `tests/`
**Files scanned:** 5 (`lib/utils/import.ts`, `lib/utils/dashboard.ts`, `lib/services/categorization.ts`, `tests/import-utils.test.ts`, `tests/dashboard-utils.test.ts`)
**Canonical algorithm source:** `docs/adr/0002-pattern-suggestion-detection.md`
**Pattern extraction date:** 2026-05-22
