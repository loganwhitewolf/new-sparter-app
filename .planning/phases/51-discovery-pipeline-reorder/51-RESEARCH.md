# Phase 51: discovery-pipeline-reorder — Research

**Researched:** 2026-06-16
**Domain:** Backend pipeline refactor — regex discovery extraction, Drizzle DAL, server-only boundary
**Confidence:** HIGH (all findings from direct codebase inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Discovery runs post-categorization on the persisted Set B — uncategorized expenses (`expense.status = '1'` / `subCategoryId IS NULL`) after `categorizePipeline` has written results at the `descriptionHash`/expense grain. No analyze-time dry-run.
- **D-02:** Standalone service `discoverRegexCandidates({ userId, scope })` in `lib/services`. Uses a DAL query to fetch the persisted uncategorized set, applies platform normalization, then delegates prefix/variable clustering to a pure util (extend `detectPatternSuggestions` in `lib/utils/pattern-suggestions.ts`). Both Phase 54 entry points call the service, never the util directly.
- **D-03:** `scope = { platformId }` selects the platform's entire uncategorized history as discovery input. Retroactive write scope (APPLY-02) deferred to Phase 53.
- **D-04:** In-app path only. `scripts/regex-discovery.ts` (`yarn regex:discover`) is left untouched.
- **D-05:** Report is per-candidate metadata: `{ stablePrefix, strippedByNormalization, residualVariablePart, sampleNormalized }`. No top-level roll-up.

### Claude's Discretion

- Exact module/file naming, DAL query naming, how the pure util's signature is extended to carry D-05 metadata.
- Whether the old inline `analyzeFile` `detectPatternSuggestions` call (lines 298–322) is removed within Phase 51 or kept as dead-but-harmless until Phase 54/55 wires the new path.

### Deferred Ideas (OUT OF SCOPE)

- Unify offline CLI `scripts/regex-discovery.ts` onto the in-app clustering core.
- Retroactive write scope (APPLY-02) — owned by Phase 53.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PIPE-01 | Regex discovery runs after auto-categorization and operates only on the still-uncategorized set (Set B); already-categorized transactions (Set A) excluded from discovery input. | Set B defined by `expense.status = '1'` / `subCategoryId IS NULL`; new DAL query fetches this set by `platformId` join chain; the analyzeFile pre-commit call (lines 298–322) runs on ALL rows — the relocation is the core deliverable. |
| PIPE-02 | Regex discovery extracted from `analyzeFile`/`importFile` flow into a standalone service callable independently of an import in progress. | New `lib/services/regex-discovery.ts` with `discoverRegexCandidates({ userId, scope })` — no dependency on parsed file bytes, R2, or the import transaction context. |
| PIPE-03 | Platform-specific normalization applied before discovery; analysis confirms what normalization already covers vs what the residual-variable regex must still handle. | `descriptionStripPattern` fetched via `platform` table by `platformId`; `normalizeTransactionRow`-equivalent strip applied in the service; D-05 metadata per candidate reports `strippedByNormalization` vs `residualVariablePart`. |
</phase_requirements>

---

## Summary

Phase 51 is a pure backend refactor — no schema migrations, no UI changes, no new external dependencies. The work is three coordinated pieces: (1) a new DAL query that fetches persisted uncategorized expenses (`status = '1'` / `subCategoryId IS NULL`) filtered by `platformId` via the `expense → file → importFormatVersion → platform` join chain, also returning `platform.descriptionStripPattern`; (2) an extension to the existing pure util `detectPatternSuggestions` (or a thin wrapper) that accepts already-normalized descriptions and returns per-candidate D-05 metadata (`stablePrefix`, `strippedByNormalization`, `residualVariablePart`, `sampleNormalized`); and (3) a new service module `lib/services/regex-discovery.ts` that stitches these together: fetches Set B via DAL, fetches `descriptionStripPattern`, applies strip normalization in-memory, delegates to the pure util, and returns enriched candidates.

The existing `analyzeFile` call at lines 298–322 runs discovery pre-categorization on ALL normalized rows with `covered: false` hardcoded — this is exactly what PIPE-01 reverses. The old call can be left in place as dead code (skipPatternSuggestions is already a caller option) or removed; Phase 55 will stop reading `patternSuggestions` from the analyze result and read from the new service instead.

**Primary recommendation:** Build the three pieces (DAL query, util extension, service module) as independent units in a single wave. The old `analyzeFile` call is harmless dead code for now — leave it with a `// TODO: remove when Phase 55 wires the new path` comment rather than deleting it immediately, to avoid breaking any callers that still read `patternSuggestions` from the analyze result.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch persisted uncategorized Set B | Database / DAL | — | Pure data retrieval; follows `dal` layer convention |
| Apply platform normalization strip | Service layer | — | Business logic, not a DB concern; the strip is `platform.descriptionStripPattern` applied in-memory |
| Prefix/variable clustering | Pure util (`lib/utils/`) | — | Must stay script-safe and unit-testable; no server-only import |
| Service orchestration (fetch → normalize → cluster) | Service layer (`lib/services/`) | — | Needs `import 'server-only'`; calls DAL + util; no edge/client runtime |
| Calling the service | Actions layer (Phase 54) | — | Out of scope for Phase 51 |

---

## Standard Stack

This phase adds no new npm packages. All building blocks are already present.

### Core building blocks (existing)

| Asset | Location | Purpose in this phase |
|-------|----------|----------------------|
| `detectPatternSuggestions` | `lib/utils/pattern-suggestions.ts` | Core prefix/variable clustering — extend or wrap to carry D-05 metadata |
| `PatternDetectorRow`, `PatternSuggestion` | `lib/utils/pattern-suggestions.ts` | Input/output types of the pure util |
| `normalizeDescription` | `lib/utils/import.ts` | Lowercases + collapses whitespace — used to build normalized text before clustering |
| `platform.descriptionStripPattern` | `lib/db/schema.ts` line 274 | Nullable `text` column on platform table — the Fineco strip pattern `'\s+Carta N\..*$'` |
| `expense` table | `lib/db/schema.ts` lines 371–406 | Provides `descriptionHash`, `subCategoryId`, `status`, `title`, `importedFromFileId` |
| `file` table | `lib/db/schema.ts` lines 320–369 | Links expense to importFormatVersionId |
| `importFormatVersion` table | `lib/db/schema.ts` lines 289–318 | Links file to `platformId` |
| `platform` table | `lib/db/schema.ts` lines 253–287 | Provides `descriptionStripPattern`, `id` |
| `db`, `DbOrTx` | `lib/db/index.ts` | Standard Drizzle client and transaction type |
| `loadActivePatterns` | `lib/services/categorization.ts` | Needed to check coverage before clustering (reuse CoveragePattern from pattern-suggestions) |

**Installation:** None required.

---

## Package Legitimacy Audit

No new external packages introduced in this phase.

| Package | Verdict | Disposition |
|---------|---------|-------------|
| (none) | — | — |

---

## Architecture Patterns

### System Architecture Diagram

```
POST /import/[fileId]/commit
       |
       v
importFile()                 ← lib/services/import.ts
  └─ db.transaction()
       ├─ normalizeTransactionRow (per row)
       ├─ insertTransactionBatch
       ├─ categorizePipeline (per expense) ──→ writes status='3' (categorized)
       │                                       or status='1' (uncategorized) to expense
       └─ updateFileImportState → status='imported'
              |
              |   [Phase 51 — new standalone service, called AFTER this transaction commits]
              v
discoverRegexCandidates({ userId, scope: { platformId } })
       |                        ← lib/services/regex-discovery.ts  [NEW]
       ├─ getUncategorizedExpensesForDiscovery(userId, platformId)
       │       └─ DAL query: expense WHERE status='1'/subCategoryId IS NULL
       │                     + platform join for descriptionStripPattern   [NEW]
       │
       ├─ fetch platform.descriptionStripPattern from DAL result
       ├─ for each expense:
       │     raw title → apply strip pattern → normalizeDescription → normalizedDescription
       │     compute strippedByNormalization = (raw !== stripped)
       │
       ├─ loadActivePatterns(db, userId)   ← existing, server-only
       │
       └─ detectPatternSuggestionsWithMeta(rows, coveragePatterns)
               |                 ← lib/utils/pattern-suggestions.ts  [EXTENDED]
               └─ returns PatternSuggestionWithMeta[] each carrying:
                    { pattern, matchCount, sampleDescriptions,
                      stablePrefix, strippedByNormalization, residualVariablePart, sampleNormalized }
```

### Recommended File Layout

```
lib/
├── dal/
│   └── regex-discovery.ts          # NEW — getUncategorizedExpensesForDiscovery()
├── services/
│   └── regex-discovery.ts          # NEW — discoverRegexCandidates()
└── utils/
    └── pattern-suggestions.ts      # EXTEND — add PatternSuggestionWithMeta, detectPatternSuggestionsWithMeta
```

### Pattern 1: DAL query with platform join chain

The `expense` table has no direct `platformId` column. Platform is reached via:

```
expense.importedFromFileId → file.id → file.importFormatVersionId → importFormatVersion.id → importFormatVersion.platformId → platform.id
```

This exact join chain is already used by `getExpenses` (lib/dal/expenses.ts lines 183–185) and `getExpenseById` (lines 219–224). Mirror those joins in the new DAL query.

**New query (lib/dal/regex-discovery.ts):**

```typescript
import 'server-only'
import { and, eq, isNull, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { expense, file, importFormatVersion, platform } from '@/lib/db/schema'

export type UncategorizedExpenseForDiscovery = {
  id: string
  title: string
  descriptionHash: string
  descriptionStripPattern: string | null
}

export async function getUncategorizedExpensesForDiscovery(
  userId: string,
  platformId: number,
): Promise<UncategorizedExpenseForDiscovery[]> {
  return db
    .select({
      id: expense.id,
      title: expense.title,
      descriptionHash: expense.descriptionHash,
      descriptionStripPattern: platform.descriptionStripPattern,
    })
    .from(expense)
    .leftJoin(file, eq(expense.importedFromFileId, file.id))
    .leftJoin(importFormatVersion, eq(file.importFormatVersionId, importFormatVersion.id))
    .leftJoin(platform, eq(importFormatVersion.platformId, platform.id))
    .where(
      and(
        eq(expense.userId, userId),
        eq(platform.id, platformId),
        or(isNull(expense.subCategoryId), eq(expense.status, '1')),
      )
    )
}
```

**Key note on the WHERE clause:** `expense.status = '1'` and `subCategoryId IS NULL` are semantically equivalent for Set B (the import flow sets status='3' when categorized, status='1' when not). The `or(isNull(expense.subCategoryId), eq(expense.status, '1'))` union covers any edge case where status is stale. In practice, using `isNull(expense.subCategoryId)` alone is the most reliable signal (it is what `applyNewPatternToExpenses` uses on line 38 of pattern-application.ts).

**Expense status enum (verified from schema.ts line 26):**

```typescript
export const expenseStatusEnum = pgEnum("expense_status", ["1", "2", "3", "4"]);
// '1' = uncategorized (default)
// '3' = categorized (set by categorizePipeline and applyNewPatternToExpenses)
// '2', '4' — other states (partially or manually set)
```

From `getExpenses` in `lib/dal/expenses.ts` lines 108–113, the `uncategorized` filter is `inArray(expense.status, ['1', '4'])` — so status '4' is also considered uncategorized. Set B for discovery purposes should include both '1' and '4' (or rely on `subCategoryId IS NULL`).

### Pattern 2: Normalization in the service

`normalizeTransactionRow` (lib/utils/import.ts lines 195–252) applies `descriptionStripPattern` in lines 203–205:

```typescript
const description = platform.descriptionStripPattern
  ? rawDescription.replace(new RegExp(platform.descriptionStripPattern, 'i'), '').trim()
  : rawDescription
```

The new service **cannot** call `normalizeTransactionRow` directly because it requires a full `RawImportRow` and `ImportPlatformConfig`. Instead, apply the strip as a one-liner in-service using the same pattern:

```typescript
function applyStrip(rawTitle: string, stripPattern: string | null): string {
  if (!stripPattern) return rawTitle
  return rawTitle.replace(new RegExp(stripPattern, 'i'), '').trim()
}
```

Then call `normalizeDescription(strippedTitle)` from `lib/utils/import.ts` to get the lowercase + whitespace-collapsed form. This replicates exactly what `normalizeTransactionRow` does for the description field.

The `descriptionStripPattern` for Fineco is `'\s+Carta N\..*$'` (verified in scripts/seed-extras.ts line 50).

### Pattern 3: Extending detectPatternSuggestions to carry D-05 metadata

Current `PatternSuggestion` (lib/utils/pattern-suggestions.ts lines 14–18):

```typescript
export interface PatternSuggestion {
  pattern: string
  matchCount: number
  sampleDescriptions: string[]
}
```

Current `detectPatternSuggestions` returns `PatternSuggestion[]` — a pure function with no `import 'server-only'`, importable from scripts.

**Strategy:** Add a new exported type `PatternSuggestionWithMeta extends PatternSuggestion` and a new function `detectPatternSuggestionsWithMeta` that returns the enriched type. The original `detectPatternSuggestions` and `PatternSuggestion` remain unchanged, so the existing `analyzeFile` call (which reads `patternSuggestions: PatternSuggestion[]`) keeps compiling without modification.

The D-05 metadata fields that can be computed from the clustering algorithm:

| Field | How to compute |
|-------|---------------|
| `stablePrefix` | The `prefixString` already computed in the clustering loop (line 110 of pattern-suggestions.ts) |
| `strippedByNormalization` | Boolean: `rawTitle !== applyStrip(rawTitle, stripPattern)` — computed in the service before passing rows to the util |
| `residualVariablePart` | The part of each sample description beyond the stable prefix — derive by taking `sampleDescription` and stripping the prefix from its tokens |
| `sampleNormalized` | The normalized description as passed to the util — already available as `normalizedDescription` on the input row |

Because `strippedByNormalization` is a per-row boolean derived from the raw title before the util sees it, the util itself cannot compute it from normalized text alone. Two options:

**Option A (preferred):** Carry `rawTitle` and `strippedByNormalization` on an extended `PatternDetectorRowWithMeta` input type. The util sets these through to the output per-candidate.

**Option B:** Compute `strippedByNormalization` in the service after receiving suggestions, by correlating sample descriptions back to source rows. More complex — not recommended.

**Recommended extended types:**

```typescript
// lib/utils/pattern-suggestions.ts additions

export interface PatternDetectorRowWithMeta extends PatternDetectorRow {
  /** Raw (pre-strip) title for D-05 reporting */
  rawTitle: string
  /** Whether descriptionStripPattern altered rawTitle */
  strippedByNormalization: boolean
}

export interface PatternSuggestionWithMeta extends PatternSuggestion {
  /** The shared prefix tokens joined, pre-escape (human-readable) */
  stablePrefix: string
  /** True if at least one sample had its description altered by the platform strip pattern */
  strippedByNormalization: boolean
  /** Example residual variable text beyond the stable prefix */
  residualVariablePart: string
  /** One sample normalized description (post-strip, post-normalizeDescription) */
  sampleNormalized: string
}

export function detectPatternSuggestionsWithMeta(
  rows: PatternDetectorRowWithMeta[],
  coveragePatterns: CoveragePattern[],
): PatternSuggestionWithMeta[]
```

The new function is structurally identical to `detectPatternSuggestions` except it passes through `PatternDetectorRowWithMeta` and emits `PatternSuggestionWithMeta`. Internal logic (bucketing, prefix intersection) is unchanged.

### Pattern 4: Service module structure

```typescript
// lib/services/regex-discovery.ts
import 'server-only'
import { db } from '@/lib/db'
import { getUncategorizedExpensesForDiscovery } from '@/lib/dal/regex-discovery'
import { loadActivePatterns } from '@/lib/services/categorization'
import {
  detectPatternSuggestionsWithMeta,
  type PatternDetectorRowWithMeta,
  type PatternSuggestionWithMeta,
} from '@/lib/utils/pattern-suggestions'
import { normalizeDescription } from '@/lib/utils/import'

export type DiscoveryScope = { platformId: number }

export type DiscoveryResult = {
  candidates: PatternSuggestionWithMeta[]
  totalUncategorized: number
  platformId: number
}

export async function discoverRegexCandidates(input: {
  userId: string
  scope: DiscoveryScope
}): Promise<DiscoveryResult> {
  const { userId, scope } = input

  // 1. Fetch Set B — persisted uncategorized expenses for this platform
  const expenses = await getUncategorizedExpensesForDiscovery(userId, scope.platformId)

  // 2. Fetch active patterns for coverage filtering
  const activePatterns = await loadActivePatterns(db, userId)

  // 3. Apply strip normalization and build detector rows
  const stripPattern = expenses[0]?.descriptionStripPattern ?? null  // same for all rows (platform-level)
  const detectorRows: PatternDetectorRowWithMeta[] = expenses.map((e) => {
    const rawTitle = e.title
    const stripped = stripPattern
      ? rawTitle.replace(new RegExp(stripPattern, 'i'), '').trim()
      : rawTitle
    const normalizedDescription = normalizeDescription(stripped)
    return {
      description: rawTitle,          // PatternDetectorRow.description = human-readable label
      normalizedDescription,
      amount: null,                   // amount is not needed for discovery clustering
      valid: true,
      covered: false,
      rawTitle,
      strippedByNormalization: stripped !== rawTitle,
    }
  })

  // 4. Delegate to pure util
  const candidates = detectPatternSuggestionsWithMeta(detectorRows, activePatterns)
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, 10)  // reasonable cap; Phase 55 renders these

  return {
    candidates,
    totalUncategorized: expenses.length,
    platformId: scope.platformId,
  }
}
```

### Anti-Patterns to Avoid

- **Calling `normalizeTransactionRow` directly:** It requires a full `ImportPlatformConfig` and `RawImportRow`. The service only has `title` and `stripPattern` — use the one-liner strip + `normalizeDescription` instead.
- **Calling the util from actions directly (bypass service):** D-02 locks the call chain as action → service → util. Phase 54 wires the action; Phase 51 only delivers the service.
- **Adding `import 'server-only'` to `lib/utils/pattern-suggestions.ts`:** This would break `scripts/regex-discovery.ts` (confirmed: the offline CLI imports `applyTier1Regex` from `categorization-match.ts` precisely to avoid `server-only` — same pattern applies to `pattern-suggestions.ts`).
- **Running discovery inside `db.transaction`:** The service reads after the import transaction has committed. Do not wrap in a transaction (no writes happen in this phase).
- **Using Decimal.js for amount in clustering:** This phase does not do any monetary arithmetic. Amount is passed as `null` on detector rows — clustering is description-only.
- **Querying `expense.status = '1'` alone:** Status '4' is also uncategorized per the existing UI filter. Use `isNull(expense.subCategoryId)` as the primary filter (this is what `applyNewPatternToExpenses` does) or `inArray(expense.status, ['1', '4'])` to mirror the expenses DAL.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Prefix/variable clustering | Custom grouping algorithm | `detectPatternSuggestions` (or the new `WithMeta` variant) | Already tested, production-proven |
| Coverage check | Custom regex tester | `isCoveredByPatterns` inside `detectPatternSuggestions` | Mirrors `applyTier1Regex` dual-test (full + stripped) exactly |
| Description normalization | Custom lowercase/trim | `normalizeDescription` from `lib/utils/import.ts` | Canonical, used everywhere; IT-locale-aware |
| Platform config fetch | Inline SQL | DAL query pattern (join chain from `expenses.ts`) | Consistent with all other platform joins in the codebase |
| Pattern loading | Inline DB query | `loadActivePatterns(db, userId)` from `categorization.ts` | Handles both user + system patterns with correct ordering |

---

## Code Analysis: Current analyzeFile Discovery Call

**File:** `lib/services/import.ts`
**Lines 298–322** (verified by direct inspection):

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
      covered: false,                      // ← hardcoded false — never checks existing coverage
    }))
    const raw = detectPatternSuggestions(detectorRows, activePatterns)
    patternSuggestions = raw
      .sort((a, b) => b.matchCount - a.matchCount)
      .slice(0, 5)
  } catch (error) { /* non-fatal */ }
}
```

**Problems with this code (why PIPE-01 fixes it):**
1. Runs on `provisionalStats.normalizedRows` — these are pre-commit rows from the CSV, not persisted expenses. Already-categorized transactions (Set A) are included.
2. `covered: false` hardcoded — isCoveredByPatterns still runs in the util but the initial `if (r.covered) continue` is never triggered by this hardcoded value. In practice this means "don't pre-filter by a flag" but the util's own coverage check still runs.
3. This runs BEFORE `importFile`'s `db.transaction` (analyzeFile is the pre-import step) — categorization has not yet run at this point.
4. Returns `patternSuggestions` as part of `ImportAnalysisResult` — Phase 55 will change the summary UI to no longer use this field.

**Recommended handling (Claude's Discretion):** Keep the call in place with a `// TODO Phase 55: remove — discovery now runs post-import via discoverRegexCandidates` comment. Do not delete it in Phase 51, because `ImportAnalysisResult.patternSuggestions` is still returned to the UI and removing it would break the current import summary before Phase 55 replaces it.

---

## Set B at the DB Level — Verified Schema

**Table:** `expense` (schema.ts lines 371–406)

| Column | Type | Purpose in Set B |
|--------|------|-----------------|
| `id` | `text` PRIMARY KEY | Row identity |
| `userId` | `text` NOT NULL | Tenant scope |
| `title` | `varchar(120)` | The description used for clustering (= post-strip pre-normalize form stored at import time) |
| `descriptionHash` | `varchar(64)` | SHA-256 of `normalizeDescription(description)` — the grain for dedup |
| `subCategoryId` | `integer` nullable FK → `subCategory.id` | NULL → uncategorized (Set B) |
| `status` | `expenseStatusEnum` ('1','2','3','4') default '1' | '1' = uncategorized; '3' = categorized |
| `importedFromFileId` | `text` nullable FK → `file.id` | Join anchor to reach platform |

**Unique constraint:** `(userId, descriptionHash)` — one expense per unique description per user. Confirmed by line 404.

**Indexes available for the new query:**
- `expense_userId_status_idx` on `(userId, status)` — the primary filter
- `expense_importedFromFileId_idx` on `importedFromFileId` — for the join

**No existing DAL query** fetches uncategorized expenses filtered by `platformId`. `applyNewPatternToExpenses` in `lib/services/pattern-application.ts` (line 36–39) queries all uncategorized expenses without platform scope — it uses `isNull(expense.subCategoryId)` only. The new DAL query in `lib/dal/regex-discovery.ts` must be created.

**Join chain for platformId (verified from expenses.ts lines 183–185 and schema):**

```
expense.importedFromFileId → file.id
file.importFormatVersionId → importFormatVersion.id
importFormatVersion.platformId → platform.id
```

All three joins are `leftJoin` in the existing expense queries. For discovery, the platform filter is mandatory (D-03), so the join to `platform` effectively becomes an inner join semantically (expenses with no platform are excluded from this scope).

---

## Normalization Explained — The Fineco DoD

**Fineco `descriptionStripPattern`:** `'\s+Carta N\..*$'` (seed-extras.ts line 50)

**DoD input:** `"Bonifico Andrea Bernardini causale stipendio marzo/maggio/giugno"`

Step-by-step through normalization:

1. **Raw title from expense.title:** `"Bonifico Andrea Bernardini causale stipendio marzo/maggio/giugno"`
   - This was stored by `importFile` as `acc.description.slice(0, 120)` after `normalizeTransactionRow` already applied the strip at import time. So `expense.title` for Fineco expenses already has the strip applied.
   
2. **What the service applies:** Re-apply the strip as a safety measure; for Fineco expenses the strip was already applied at import time, so the re-application is idempotent. `strippedByNormalization = false` for this specific Fineco input (no " Carta N. ..." suffix present).

3. **Post `normalizeDescription`:** `"bonifico andrea bernardini causale stipendio marzo/maggio/giugno"`

4. **In `detectPatternSuggestionsWithMeta`:** `stripNumericTokens` gives `["bonifico", "andrea", "bernardini", "causale", "stipendio", "marzo/maggio/giugno"]` — 6 tokens, qualifies.

5. **Clustering:** Multiple occurrences with different month suffixes (marzo / maggio / giugno) produce bucket key `"bonifico andrea"`, prefix `["bonifico", "andrea", "bernardini", "causale", "stipendio"]` (the variable part is the month token), suggestion `pattern: "bonifico andrea bernardini causale stipendio"`.

6. **D-05 fields for this candidate:**
   - `stablePrefix`: `"bonifico andrea bernardini causale stipendio"`
   - `strippedByNormalization`: `false` (no suffix was stripped)
   - `residualVariablePart`: `"marzo/maggio/giugno"` (varies across occurrences)
   - `sampleNormalized`: `"bonifico andrea bernardini causale stipendio marzo/maggio/giugno"`

**Key insight:** The Fineco DoD input WILL reach discovery as Set B only if `categorizePipeline` fails to categorize it. If the system regex `"bonifico"` already matches, it would be Set A (status='3') and excluded. The test must ensure no existing system pattern matches the DoD description — use a test fixture with mocked `loadActivePatterns` returning an empty list or patterns that don't match "bonifico andrea bernardini".

---

## Common Pitfalls

### Pitfall 1: expense.title vs raw CSV description

**What goes wrong:** Treating `expense.title` as the pre-strip raw description. `expense.title` is stored by `importFile` as `acc.description.slice(0, 120)` where `acc.description` comes from `normalizeTransactionRow`, which has already applied the `descriptionStripPattern`. So `expense.title` is the post-strip, pre-lowercase form.

**How to avoid:** In the new service, apply the strip again but expect it to be idempotent. The `strippedByNormalization` flag should compare `applyStrip(rawTitle, pattern)` vs `rawTitle` — for most Fineco rows where the strip already happened at import time, this will be `false` (no change). This is correct: the normalization "happened at import time" and the flag accurately reports that.

**Alternative interpretation (recommended for D-05 accuracy):** Store `strippedByNormalization: true` for all Fineco expenses regardless, based on whether the platform has a non-null `descriptionStripPattern`. This is semantically more honest for the Phase 55 UX ("this platform strips its descriptions"). Planner should decide which interpretation to implement.

### Pitfall 2: Expenses with null importedFromFileId

**What goes wrong:** Expenses created manually (not via file import) have `importedFromFileId = null`. The join chain to platform returns null. These expenses will be excluded by the `eq(platform.id, platformId)` filter — correct for D-03, but the left join makes them appear in results with `descriptionStripPattern = null` and `platform.id = null` before the filter applies.

**How to avoid:** Ensure the `WHERE` clause includes `eq(platform.id, platformId)` — this implicitly excludes manually-created expenses with no platform. Confirmed from existing `getExpenses` which does the same implicit exclusion when filtering by `platform.slug`.

### Pitfall 3: server-only in pattern-suggestions.ts

**What goes wrong:** Adding `import 'server-only'` to `lib/utils/pattern-suggestions.ts` would break `scripts/regex-discovery.ts`. The offline CLI imports from `categorization-match.ts` specifically because it is the script-safe module. Similarly, `pattern-suggestions.ts` must stay script-importable.

**How to avoid:** Do NOT add `import 'server-only'` to `lib/utils/pattern-suggestions.ts`. The new function `detectPatternSuggestionsWithMeta` added to this file must also remain script-safe (no server imports). The `server-only` guard belongs only in `lib/services/regex-discovery.ts` and `lib/dal/regex-discovery.ts`.

### Pitfall 4: descriptionHash as the grain, but clustering is on title

**What goes wrong:** Confusing the "one expense per descriptionHash" dedup constraint with the discovery clustering unit. Discovery clusters expenses by common description prefix — multiple expenses with different `descriptionHash` values but similar `title` values will cluster together (that is the goal). The `descriptionHash` is just the unique identifier for each expense row; it is not the clustering key.

**How to avoid:** No action needed — just be clear that `detectPatternSuggestionsWithMeta` operates on `normalizedDescription` (the clustering dimension), not on `descriptionHash`.

### Pitfall 5: amount field is irrelevant for clustering

**What goes wrong:** Passing actual `totalAmount` from expense rows as `amount` in `PatternDetectorRow` when it is not used by the clustering algorithm. The `amount` field exists on `PatternDetectorRow` but the current clustering code (`detectPatternSuggestions`) does not read it at all — it is a vestige of the older sign-checking logic removed in ADR 0012.

**How to avoid:** Pass `amount: null` in the service when building `PatternDetectorRowWithMeta`. No Decimal.js arithmetic needed.

---

## Server-Only Boundary

| Module | `import 'server-only'`? | Callable from scripts? | Notes |
|--------|------------------------|----------------------|-------|
| `lib/utils/pattern-suggestions.ts` | NO (current) | YES | Must stay script-safe — do not add `server-only` |
| `lib/utils/import.ts` | NO (current) | YES | `normalizeDescription` and `normalizeTransactionRow` — script-safe |
| `lib/services/categorization-match.ts` | NO (intentional) | YES | Pattern: explicitly documented (lines 1–8 of file) |
| `lib/services/categorization.ts` | YES (line 1) | NO | `loadActivePatterns` — server-only; new service imports from here |
| `lib/dal/regex-discovery.ts` | YES (new) | NO | Accesses `db` — must be server-only |
| `lib/services/regex-discovery.ts` | YES (new) | NO | Calls server-only DAL + categorization |

**Confirmed pattern from `categorization-match.ts` lines 1–8:** The split between `categorization.ts` (server-only) and `categorization-match.ts` (script-safe) is the project's established model for isolating pure matching logic. Apply the same discipline to `pattern-suggestions.ts` (never add `server-only`) vs `lib/services/regex-discovery.ts` (always has `server-only`).

---

## Minimal Testable Cut — What to Add vs Leave

### New additions (Phase 51 scope)

| Artifact | Type | Status |
|----------|------|--------|
| `lib/dal/regex-discovery.ts` — `getUncategorizedExpensesForDiscovery(userId, platformId)` | New file | Create |
| `lib/utils/pattern-suggestions.ts` — `PatternDetectorRowWithMeta`, `PatternSuggestionWithMeta`, `detectPatternSuggestionsWithMeta` | Extend existing file | Extend |
| `lib/services/regex-discovery.ts` — `discoverRegexCandidates({ userId, scope })`, `DiscoveryScope`, `DiscoveryResult` | New file | Create |

### Left untouched

| Artifact | Why |
|----------|-----|
| `lib/services/import.ts` lines 298–322 | Dead-but-harmless; leave with TODO comment; Phase 55 removes it |
| `scripts/regex-discovery.ts` | D-04: explicitly out of scope |
| `ImportAnalysisResult.patternSuggestions` | Still returned to current UI; Phase 55 removes it |
| `lib/utils/pattern-suggestions.ts` `detectPatternSuggestions` and `PatternSuggestion` | Unchanged; existing call in import.ts keeps compiling |

### Wave structure

This phase has no dependencies between the three new artifacts at the code level — the DAL query and the util extension are both independent of each other, and the service assembles them. However, to test the service in isolation, both the DAL and util extension should exist first. Natural plan order:

**Wave 1 — Independent foundation (can be parallel tasks):**
- Task A: Extend `lib/utils/pattern-suggestions.ts` with `PatternDetectorRowWithMeta`, `PatternSuggestionWithMeta`, `detectPatternSuggestionsWithMeta`
- Task B: Create `lib/dal/regex-discovery.ts` with `getUncategorizedExpensesForDiscovery`

**Wave 2 — Service assembly (depends on Wave 1):**
- Task C: Create `lib/services/regex-discovery.ts` with `discoverRegexCandidates`
- Task D: Add TODO comment to `lib/services/import.ts` lines 298–322

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Detected from package.json — check for jest/vitest config |
| Quick run command | `yarn test` or `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Notes |
|--------|----------|-----------|-------|
| PIPE-01 | Set A (categorized) never appears in discovery input | Unit | Mock `getUncategorizedExpensesForDiscovery` to return only subCategoryId=null rows; assert no categorized rows pass through |
| PIPE-01 | `detectPatternSuggestionsWithMeta` skips `covered: false` rows (coverage filter) | Unit | Mock `loadActivePatterns` with a pattern that matches DoD; assert DoD excluded from candidates when covered |
| PIPE-02 | `discoverRegexCandidates` callable with no file bytes / no import in progress | Unit | Call with userId + platformId only; assert no dependency on fileId or parsed rows |
| PIPE-03 | Strip normalization applied before clustering | Unit | Pass Fineco expense with " Carta N. 1234" suffix in title; assert `residualVariablePart` does not contain "carta n" |
| SC-4 (DoD) | Fineco "Bonifico Andrea Bernardini causale stipendio marzo/maggio/giugno" → one candidate | Unit | Three expense rows with this pattern (different months); mock `loadActivePatterns` returning empty list; assert one candidate with `stablePrefix` containing "bonifico andrea bernardini causale stipendio" |

### Wave 0 Gaps

- Unit test file for `lib/utils/pattern-suggestions.ts` — check if `__tests__/pattern-suggestions.test.ts` exists
- Unit test file for `lib/services/regex-discovery.ts` — will be new

---

## Environment Availability

Step 2.6: SKIPPED — this phase is code/config changes only. No external CLI tools, services, or runtimes beyond the existing project stack are needed.

---

## Open Questions (RESOLVED)

1. **`strippedByNormalization` semantics for D-05**
   - What we know: `expense.title` for Fineco rows already has the strip applied at import time (normalizeTransactionRow runs at importFile time). Re-applying the strip in the service is idempotent.
   - What's unclear: Should `strippedByNormalization` mean "the strip *would* change the raw input" (always `false` for Fineco post-import) or "this platform has a non-null strip pattern" (always `true` for Fineco)? The first is technically accurate; the second is more useful for the Phase 55 UX.
   - Recommendation: Planner decides; both are defensible. The second ("platform has strip pattern") is recommended for UX clarity — document the semantic in a comment.
   - **RESOLVED (51-01 plan):** per-candidate `strippedByNormalization` is computed at the row level as `stripped !== rawTitle` (true when the strip actually changed the input), rolled up to the candidate as "any member row stripped". Documented in 51-01-T1 action/behavior.

2. **uncategorized filter — status '4'**
   - What we know: `getExpenses` treats statuses '1' and '4' as uncategorized for the UI filter. `applyNewPatternToExpenses` uses `isNull(expense.subCategoryId)` (which covers any status including '4').
   - What's unclear: Should discovery include status '4' expenses? Status '4' is not documented in the schema comments.
   - Recommendation: Use `isNull(expense.subCategoryId)` as the primary filter — this is what `applyNewPatternToExpenses` uses and is the most semantically correct signal for "has not been classified".
   - **RESOLVED (51-02 plan):** the DAL query uses `isNull(expense.subCategoryId)` as the Set B filter (no `status` predicate). Documented in 51-02-T1 action + acceptance_criteria.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `expense.title` stores the post-strip, pre-lowercase description (as set by `normalizeTransactionRow`) | Normalization section | If title stores raw pre-strip text, re-applying strip in service is not idempotent but still correct |
| A2 | `expense.status = '4'` indicates a form of uncategorized state (based on DAL expense filter using `['1','4']`) | Set B section | Low risk — using `isNull(subCategoryId)` as primary filter covers all cases |

---

## Sources

### Primary (HIGH confidence — verified by direct codebase inspection)

- `lib/services/import.ts` — analyzeFile pattern suggestion block (lines 298–322), importFile categorizePipeline call (lines 555–560), expense upsert logic (lines 563–602)
- `lib/utils/pattern-suggestions.ts` — all types and the full `detectPatternSuggestions` implementation
- `lib/utils/import.ts` — `normalizeTransactionRow` (lines 195–252), `normalizeDescription` (lines 67–72), `ImportPlatformConfig.descriptionStripPattern` (line 12)
- `lib/services/categorization.ts` — `loadActivePatterns` (lines 22–52), `categorizePipeline` (lines 86–118)
- `lib/services/categorization-match.ts` — server-only split pattern (lines 1–8), `applyTier1Regex` (lines 28–52)
- `lib/db/schema.ts` — `expense` table (lines 371–406), `platform.descriptionStripPattern` (line 274), `expenseStatusEnum` (line 26), join chain (lines 289–406)
- `lib/dal/expenses.ts` — platform join chain pattern (lines 183–185), uncategorized status filter (`['1','4']`, lines 108–113)
- `lib/dal/import-formats.ts` — `ImportFormatRow.platformDescriptionStripPattern` (line 33), join chain implementation (lines 149–190)
- `lib/services/pattern-application.ts` — `isNull(expense.subCategoryId)` as uncategorized filter (line 38)
- `scripts/seed-extras.ts` — Fineco `descriptionStripPattern` value `'\s+Carta N\..*$'` (line 50)

### Secondary (HIGH confidence — from planning artifacts)

- `.planning/phases/51-discovery-pipeline-reorder/51-CONTEXT.md` — all locked decisions D-01 through D-05
- `.planning/REQUIREMENTS.md` — PIPE-01, PIPE-02, PIPE-03 wording
- `.planning/STATE.md` — codebase facts confirmed by prior session

---

## Metadata

**Confidence breakdown:**
- Current code signatures: HIGH — inspected directly
- Set B schema: HIGH — schema.ts read directly
- Normalization path: HIGH — normalizeTransactionRow read directly
- Server-only boundary: HIGH — all files checked
- Util extension approach: HIGH — existing util fully read; extension is additive
- DAL query shape: HIGH — mirroring verified join pattern from expenses.ts

**Research date:** 2026-06-16
**Valid until:** 2026-07-16 (stable domain; no fast-moving dependencies)
