# Phase 51: discovery-pipeline-reorder — Pattern Map

**Mapped:** 2026-06-16
**Files analyzed:** 4 (3 new files + 1 comment edit)
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/dal/regex-discovery.ts` | dal | request-response | `lib/dal/expenses.ts` (getExpenses join chain) | exact |
| `lib/utils/pattern-suggestions.ts` (extend) | utility | transform | same file — existing `detectPatternSuggestions` | exact (additive extension) |
| `lib/services/regex-discovery.ts` | service | request-response | `lib/services/categorization.ts` (fetch → process shape) | exact |
| `lib/services/import.ts` lines 298–322 (comment only) | service | — | same file — `skipPatternSuggestions` guard | exact |

---

## Pattern Assignments

### `lib/dal/regex-discovery.ts` (dal, request-response)

**Analog:** `lib/dal/expenses.ts` — platform join chain at lines 182–186, imports at lines 1–8, uncategorized filter at lines 108–110.

**Imports pattern** (`lib/dal/expenses.ts` lines 1–5):
```typescript
import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'
import { category, direction, expense, file, importFormatVersion, nature, platform, subCategory, userSubcategoryOverride } from '@/lib/db/schema'
import { eq, and, gte, ilike, inArray, isNull, lte, or, asc, desc, sql } from 'drizzle-orm'
```
For the new DAL file, the import set narrows to: `{ expense, file, importFormatVersion, platform }` from schema, and `{ and, eq, isNull, inArray }` from drizzle-orm. No `cache` or `verifySession` — this query is called from the service with a userId parameter.

**Platform join chain** (`lib/dal/expenses.ts` lines 182–186):
```typescript
// Platform join chain — only materializes a platform row when expense was imported from a file
.leftJoin(file, eq(expense.importedFromFileId, file.id))
.leftJoin(importFormatVersion, eq(file.importFormatVersionId, importFormatVersion.id))
.leftJoin(platform, eq(importFormatVersion.platformId, platform.id))
```
Mirror this exact join order. All three are `leftJoin`. The `eq(platform.id, platformId)` in the WHERE clause acts as the implicit inner-join filter per D-03.

**Uncategorized status filter** (`lib/dal/expenses.ts` lines 108–110):
```typescript
// O-01: status 4 → uncategorized bucket (conservative mapping)
if (filters.status === 'uncategorized') {
  conditions.push(inArray(expense.status, ['1', '4']))
}
```
The new DAL query uses `isNull(expense.subCategoryId)` as the primary Set B filter (mirrors `applyNewPatternToExpenses` in `lib/services/pattern-application.ts` line 38, which is the most semantically correct signal). Alternatively combine with `inArray(expense.status, ['1', '4'])` to match the UI bucket. Research recommends `isNull(expense.subCategoryId)` alone.

**Query function shape** — does NOT use `cache()` (called from a service, not a React Server Component), does NOT call `verifySession()` (userId is passed as parameter, following the same pattern as `loadActivePatterns` in `lib/services/categorization.ts` line 22–24):
```typescript
export async function loadActivePatterns(
  database: DbOrTx,
  userId: string,
): Promise<ActivePattern[]>
```
The new DAL query should accept plain `(userId: string, platformId: number)` — no `DbOrTx` needed since discovery never runs inside a transaction (reads only, post-commit).

**`server-only` guard:** Required. The query accesses `db`. Mirror line 1 of `lib/dal/expenses.ts`.

---

### `lib/utils/pattern-suggestions.ts` (utility, transform) — ADDITIVE EXTENSION

**Analog:** same file — existing types and function at lines 1–122.

**Existing types to keep unchanged** (lines 1–18):
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
}

export interface PatternSuggestion {
  pattern: string
  matchCount: number
  sampleDescriptions: string[]
}
```
These must remain untouched so the existing `analyzeFile` call in `import.ts` keeps compiling without modification.

**Existing function signature to keep unchanged** (lines 70–73):
```typescript
export function detectPatternSuggestions(
  rows: PatternDetectorRow[],
  coveragePatterns: CoveragePattern[],
): PatternSuggestion[]
```

**Internal variable the new function builds on** — `prefixString` at line 110:
```typescript
const prefixString = prefix.join(' ')
const escaped = escapeRegex(prefixString)
const sampleDescriptions = group.slice(0, 3).map(g => g.row.description)
```
`stablePrefix` in `PatternSuggestionWithMeta` is exactly this `prefixString` (human-readable, pre-escape). `residualVariablePart` is derived from `sampleDescriptions[0]` by stripping the prefix tokens.

**New types to ADD at end of file** (after line 122):
```typescript
export interface PatternDetectorRowWithMeta extends PatternDetectorRow {
  /** Raw (pre-strip) title for D-05 reporting */
  rawTitle: string
  /** Whether descriptionStripPattern altered rawTitle before normalizeDescription was called */
  strippedByNormalization: boolean
}

export interface PatternSuggestionWithMeta extends PatternSuggestion {
  /** Shared prefix tokens joined, pre-escape (human-readable stable portion) */
  stablePrefix: string
  /** True if at least one sample had its description altered by the platform strip pattern */
  strippedByNormalization: boolean
  /** Example residual variable text beyond the stable prefix (from first sample description) */
  residualVariablePart: string
  /** One sample normalized description (post-strip, post-normalizeDescription) */
  sampleNormalized: string
}

export function detectPatternSuggestionsWithMeta(
  rows: PatternDetectorRowWithMeta[],
  coveragePatterns: CoveragePattern[],
): PatternSuggestionWithMeta[]
```

**Critical constraint:** Do NOT add `import 'server-only'` to this file. The file currently has NO server-only guard (confirmed: line 1 is the `PatternDetectorRow` interface). Adding it would break `scripts/regex-discovery.ts`. Mirror the pattern from `lib/services/categorization-match.ts` lines 1–7:
```typescript
// Pure Tier-1 regex matcher — single source of truth for categorization coverage.
//
// This module deliberately carries NO `import 'server-only'` guard so it can be
// imported both from production server code (re-exported by categorization.ts) and
// from plain Node/tsx scripts (e.g. scripts/regex-discovery.ts). The `server-only`
// package throws unconditionally outside a React Server Component context, so a
// script can never import categorization.ts directly; it imports this module instead.
```
Add an equivalent comment block at the top of `pattern-suggestions.ts` if one does not exist, documenting the same intentional omission.

---

### `lib/services/regex-discovery.ts` (service, request-response)

**Analog:** `lib/services/categorization.ts` — module structure (server-only guard, DbOrTx param pattern, loadActivePatterns call at lines 22–51).

**`server-only` + import pattern** (`lib/services/categorization.ts` lines 1–17):
```typescript
import 'server-only'
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import {
  categorizationPattern,
  expense,
  expenseClassificationHistory,
} from '@/lib/db/schema'
import {
  canUseHistoryCategorization,
  canUseRegexCategorization,
} from '@/lib/config/categorization'
import { applyTier1Regex } from './categorization-match'
import type { ActivePattern, CategorizationResult } from './categorization-match'
```
For the new service, replace the schema and config imports with the DAL and util imports. `db` is imported but no `DbOrTx` needed (no transaction).

**Service function calling DAL then processing** — `loadActivePatterns` at `lib/services/categorization.ts` lines 22–51:
```typescript
export async function loadActivePatterns(
  database: DbOrTx,
  userId: string,
): Promise<ActivePattern[]> {
  const rows = await database
    .select({ ... })
    .from(categorizationPattern)
    .where(and( ... ))
    .orderBy( ... )
  return rows as ActivePattern[]
}
```
The new service follows the same shape: async function, accepts typed input, calls DAL (which returns typed rows), post-processes in-memory, returns typed result. No `DbOrTx` parameter — uses module-level `db` directly, since discovery is always called outside a transaction.

**Normalization one-liner to use** (`lib/utils/import.ts` lines 67–72 and research Pattern 2):
```typescript
export function normalizeDescription(description: string | null | undefined): string {
  return String(description ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('it-IT')
}
```
In the service, apply strip before calling `normalizeDescription`:
```typescript
function applyStrip(rawTitle: string, stripPattern: string | null): string {
  if (!stripPattern) return rawTitle
  return rawTitle.replace(new RegExp(stripPattern, 'i'), '').trim()
}
```
Do NOT call `normalizeTransactionRow` directly — it requires a full `ImportPlatformConfig` + `RawImportRow` (`lib/utils/import.ts` lines 195–252).

**Exports to declare:**
```typescript
export type DiscoveryScope = { platformId: number }
export type DiscoveryResult = {
  candidates: PatternSuggestionWithMeta[]
  totalUncategorized: number
  platformId: number
}
export async function discoverRegexCandidates(input: {
  userId: string
  scope: DiscoveryScope
}): Promise<DiscoveryResult>
```

---

### `lib/services/import.ts` lines 298–322 (comment edit only)

**What exists** (lines 298–322, verified):
```typescript
let patternSuggestions: PatternSuggestion[] = []
if (best && !input.skipPatternSuggestions) {
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
  } catch (error) { /* non-fatal */ }
}
```

**What to add:** A single-line comment immediately before the `if (best && !input.skipPatternSuggestions)` guard:
```typescript
// TODO Phase 55: remove — discovery now runs post-import via discoverRegexCandidates in lib/services/regex-discovery.ts
```
Do not delete any code. `ImportAnalysisResult.patternSuggestions` is still returned to the current UI and removing it would break the import summary before Phase 55 replaces it.

---

## Shared Patterns

### `server-only` guard
**Source:** `lib/services/categorization.ts` line 1 and `lib/dal/expenses.ts` line 1
**Apply to:** `lib/dal/regex-discovery.ts` (line 1) and `lib/services/regex-discovery.ts` (line 1)
```typescript
import 'server-only'
```

### No `server-only` guard (intentional omission)
**Source:** `lib/services/categorization-match.ts` lines 1–7
**Apply to:** `lib/utils/pattern-suggestions.ts` — must remain guard-free
```typescript
// This module deliberately carries NO `import 'server-only'` guard so it can be
// imported both from production server code and from plain Node/tsx scripts.
```

### Drizzle `db` import (module-level, no DbOrTx)
**Source:** `lib/dal/expenses.ts` lines 3–4
**Apply to:** `lib/dal/regex-discovery.ts`
```typescript
import { db } from '@/lib/db'
```
The new DAL query does not participate in an ongoing transaction (discovery is post-commit). No `DbOrTx` parameter needed. Same applies to the service.

### `loadActivePatterns` call shape
**Source:** `lib/services/categorization.ts` lines 22–24
**Apply to:** `lib/services/regex-discovery.ts`
```typescript
export async function loadActivePatterns(
  database: DbOrTx,
  userId: string,
): Promise<ActivePattern[]>
```
Call as `loadActivePatterns(db, userId)` — pass module-level `db` since the service does not run inside a transaction.

### `isNull(expense.subCategoryId)` as uncategorized filter
**Source:** `lib/services/pattern-application.ts` line 38 (referenced in research)
**Apply to:** `lib/dal/regex-discovery.ts` WHERE clause
This is the most semantically reliable Set B signal — `subCategoryId IS NULL` means "not yet classified", regardless of status value. Using it (rather than `inArray(expense.status, ['1', '4'])`) mirrors the pattern-application service's own uncategorized lookup.

---

## No Analog Found

None — all four artifacts have strong codebase analogs.

---

## Metadata

**Analog search scope:** `lib/dal/`, `lib/services/`, `lib/utils/`
**Files read:** `lib/dal/expenses.ts`, `lib/utils/pattern-suggestions.ts`, `lib/services/categorization.ts`, `lib/services/categorization-match.ts`, `lib/services/import.ts` (lines 290–322), `lib/utils/import.ts` (lines 1–75)
**Pattern extraction date:** 2026-06-16
