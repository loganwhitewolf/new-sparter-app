# Phase 52: regex-validity-and-dedup - Pattern Map

**Mapped:** 2026-06-16
**Files analyzed:** 5 (all MODIFIED — purely additive on Phase 51)
**Analogs found:** 5 / 5 (every analog is an existing function in the same file or a sibling Phase 51 file)

> All five targets already exist. Phase 52 adds code in place. There are **no new files**, no migration, no new packages. The "analog" for each modification is an existing same-role function the planner mirrors line-for-line in style.

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `lib/utils/pattern-suggestions.ts` | utility (pure, no `server-only`) | transform | `detectPatternSuggestionsWithMeta` / `isCoveredByPatterns` (same file) | exact (self) |
| `lib/dal/regex-discovery.ts` | DAL query (`server-only`) | request-response (DB read) | `applyTier2History` join in `lib/services/categorization.ts:54-82` + `getUncategorizedExpensesForDiscovery` (same file) | exact (role + join shape) |
| `lib/services/regex-discovery.ts` | service (`server-only`, orchestration) | transform / orchestration | `discoverRegexCandidates` (same file, Phase 51 body) | exact (self) |
| `tests/regex-discovery-service.test.ts` | test (service unit) | n/a | existing Phase 51 service test (same file) | exact (self) |
| `tests/regex-discovery-dal.test.ts` | test (DAL unit) | n/a | existing Phase 51 DAL test (same file) | exact (self) |

---

## Pattern Assignments

### `lib/utils/pattern-suggestions.ts` (utility, transform)

**Analog:** `detectPatternSuggestionsWithMeta` (this file, lines 163-230) for the additive-passthrough pattern; `isCoveredByPatterns` (lines 40-61) for the Check-1 matcher.

**CRITICAL constraint:** This module must NOT gain `import 'server-only'` — the header comment (lines 1-8) states it is imported by plain tsx scripts. Both additions below must stay pure.

**Additive-field passthrough template — how Phase 51 added meta fields** (lines 137-153). Phase 52 mirrors this exactly to add `descriptionHashes: string[]`:
```typescript
export interface PatternDetectorRowWithMeta extends PatternDetectorRow {
  rawTitle: string
  strippedByNormalization: boolean
  // Phase 52 adds: descriptionHash: string | null  ← carried per row
}

export interface PatternSuggestionWithMeta extends PatternSuggestion {
  stablePrefix: string
  strippedByNormalization: boolean
  residualVariablePart: string
  sampleNormalized: string
  // Phase 52 adds: descriptionHashes: string[]  ← collected per group
}
```

**Where to collect member hashes** — inside the per-group block where `group` is in scope (lines 199-226). Mirror how `sampleDescriptions` and `strippedByNormalization` already collect across the group:
```typescript
const sampleDescriptions = group.slice(0, 3).map(g => g.row.description)
const strippedByNormalization = group.some(g => g.row.strippedByNormalization)
// Phase 52 — same group-collect shape:
// const descriptionHashes = group
//   .map(g => g.row.descriptionHash)
//   .filter((h): h is string => h !== null)
```

**Check 1 matcher fidelity — mirror `isCoveredByPatterns`** (lines 40-61). The new `candidateCoveredByExistingPattern` helper MUST reuse this exact dual-test (full + numeric-stripped, case-insensitive, try/catch swallow):
```typescript
function isCoveredByPatterns(row: PatternDetectorRow, coveragePatterns: CoveragePattern[]): boolean {
  const strippedDescription = stripNumericTokens(row.normalizedDescription).join(' ')
  for (const p of coveragePatterns) {
    try {
      const regex = new RegExp(p.pattern, 'i')
      if (regex.test(row.normalizedDescription) || regex.test(strippedDescription)) {
        return true
      }
    } catch { /* invalid regex pattern — skip and continue */ }
  }
  return false
}
```
The new helper tests `candidate.sampleNormalized` (and its numeric-stripped form) against `coveragePatterns` using the identical compile + dual-test + try/catch. Reuse the existing private `stripNumericTokens` (line 63) rather than re-inlining the filter, for fidelity. Do NOT use string-subset matching (RESEARCH §Check 1, anti-pattern).

---

### `lib/dal/regex-discovery.ts` (DAL query, DB read)

**Analog:** `applyTier2History` in `lib/services/categorization.ts:54-82` (the `expenseClassificationHistory` → `expense` innerJoin with `source='manual'`); plus `getUncategorizedExpensesForDiscovery` (same file, lines 28-50) for the file's local conventions (`'server-only'` header, `userId` plain param, no `cache()`, no `DbOrTx`, doc-comment style).

**Join + filter shape to mirror** (`categorization.ts:54-82`) — the new `getManuallyCategorizedHashes` reuses this `innerJoin` on `expenseId` + `source='manual'` filter, but returns the hash set instead of a subcategory:
```typescript
const rows = await database
  .select({ ... })
  .from(expenseClassificationHistory)
  .innerJoin(expense, eq(expenseClassificationHistory.expenseId, expense.id))
  .where(
    and(
      eq(expenseClassificationHistory.userId, userId),       // ← IDOR guard (V4) — keep
      eq(expense.descriptionHash, descriptionHash),
      eq(expenseClassificationHistory.source, 'manual'),     // ← the 'manual' marker
    ),
  )
```

**Local file conventions to copy** (lines 1-4, 28-31): `import 'server-only'` at top; import `db` from `@/lib/db`; import operators from `drizzle-orm` (add `inArray`, `isNotNull` to the existing `and, eq, isNull` import); `userId: string` plain param; return a typed result; no `cache()`, no `DbOrTx` (discovery is post-commit, read-only).

**New query body** (from RESEARCH §Check 2, lines 188-206) — `selectDistinct` over the history→expense join, `inArray(expense.descriptionHash, descriptionHashes)`, `isNotNull(expense.descriptionHash)` guard, early-return `new Set()` when the input array is empty (Pitfall 4 — null safety). Returns `Set<string>`.

---

### `lib/services/regex-discovery.ts` (service, orchestration)

**Analog:** `discoverRegexCandidates` (this file, lines 49-90 — the Phase 51 body being extended). Keep steps 1-3 (Set B fetch, `loadActivePatterns`, detector-row build) intact; extend.

**Detector-row build to extend** (lines 65-78) — add `descriptionHash` carry, mirroring how `rawTitle`/`strippedByNormalization` are already set:
```typescript
const detectorRows: PatternDetectorRowWithMeta[] = expenses.map((e) => {
  const rawTitle = e.title
  const stripped = applyStrip(rawTitle, stripPattern)
  return {
    description: rawTitle,
    normalizedDescription: normalizeDescription(stripped),
    amount: null,           // amount not needed — description-only (keep)
    valid: true,
    covered: false,
    rawTitle,
    strippedByNormalization: stripped !== rawTitle,
    // Phase 52: descriptionHash: e.descriptionHash ?? null,
  }
})
```
`e.descriptionHash` is already returned by the Phase 51 DAL (`UncategorizedExpenseForDiscovery.descriptionHash: string | null`) — no DAL change needed for the read side.

**Result-shape extension** (lines 14-18) — add the second list additively, NOT a discriminated union (CONTEXT decision, RESEARCH §Output Shape):
```typescript
export type DiscoveryResult = {
  candidates: PatternSuggestionWithMeta[]                              // regex families (RDISC-01)
  singleCategorizationSuggestions: SingleCategorizationSuggestion[]    // identical groups (RDISC-02) — NEW
  totalUncategorized: number
  platformId: number
}
```
Add a lightweight `SingleCategorizationSuggestion` type (no `pattern`, no `residualVariablePart`) — see RESEARCH lines 235-244.

**Orchestration order** — cluster → split-on-residual → Check 1 → Check 2 (RESEARCH §Service Orchestration, lines 264-321). Replace the single `.sort().slice(10)` at lines 81-83 with:
1. `clustered.filter(s => s.residualVariablePart.trim() !== '')` → regexFamilies (RDISC-01); `=== ''` → identicalGroups (RDISC-02). Use `.trim()` (Pitfall 5).
2. `regexFamilies.filter(s => !candidateCoveredByExistingPattern(s, activePatterns))` — Check 1 (RDISC-03).
3. `getManuallyCategorizedHashes(userId, allHashes)` then drop any suggestion with a member hash in the set — Check 2 (RDISC-04), **any-member → skip** (CONTEXT decision).

Keep `.sort((a,b) => b.matchCount - a.matchCount).slice(0, 10)` per list.

---

### `tests/regex-discovery-service.test.ts` (service unit test)

**Analog:** this file (lines 1-169). Mirror its exact harness — do NOT introduce a new style.

**Mock setup to reuse** (lines 6-30): `vi.hoisted` mocks for the DAL + `loadActivePatterns`; `vi.mock('server-only', () => ({}))`; `vi.mock('@/lib/db', () => ({ db: {} }))`; **real** util + `normalizeDescription` (never mock clustering). Phase 52 adds a hoisted mock for the new DAL `getManuallyCategorizedHashes` to the existing `@/lib/dal/regex-discovery` mock object.

**Fixture style to reuse** (lines 46-65): inline arrays of `{ id, title, descriptionHash, descriptionStripPattern }`. The existing `finecoExpenses` fixture IS the RDISC-01 DoD case — extend assertions to `candidates.length===1 && singleCategorizationSuggestions.length===0`.

**New cases to add** (RESEARCH Test Map, lines 543-549):
- RDISC-02: multi-token identical fixture (`"Macellaio Da Mario"` ×3) → `candidates.length===0`, `singleCategorizationSuggestions.length===1`.
- RDISC-03: reuse Fineco fixture + `loadActivePatterns` returning a covering pattern → candidate dropped (mirror the existing `PIPE-01: coverage filter` test, lines 154-168).
- RDISC-04: mock `getManuallyCategorizedHashes` to return a hash present in the group → candidate dropped.

---

### `tests/regex-discovery-dal.test.ts` (DAL unit test)

**Analog:** this file (lines 1-153). Mirror the Drizzle-chain mock + structural WHERE assertion style.

**Chain mock to extend** (lines 31-35, 82-96): the `drizzle-orm` mock currently exposes `and`, `eq`, `isNull`. Phase 52 adds `inArray` and `isNotNull` to it, and the query chain mock needs an `innerJoin` method (the new query uses `innerJoin`, not `leftJoin`). Mirror the existing `leftJoin` mock fn shape.

**Schema mock to extend** (lines 37-58): add `expenseClassificationHistory: { expenseId, userId, source }` to the `@/lib/db/schema` mock.

**WHERE-assertion style to reuse** (lines 119-152): assert the `and` op contains the expected `{ op:'eq', left, right }` entries. Phase 52 asserts `getManuallyCategorizedHashes` WHERE contains `source='manual'`, the `userId` eq (IDOR guard T-51-03), and the `inArray`/`isNotNull` on `descriptionHash`.

---

## Shared Patterns

### Matcher fidelity (Check 1)
**Source:** `lib/utils/pattern-suggestions.ts:40-61` (`isCoveredByPatterns`), same dual-test as `applyTier1Regex`.
**Apply to:** `candidateCoveredByExistingPattern` only.
Dual `new RegExp(p, 'i')` test on full + numeric-stripped form, try/catch swallowing invalid patterns. Never re-implement; never use string-subset matching.

### IDOR / cross-user isolation
**Source:** `lib/services/categorization.ts:68-73` and `lib/dal/regex-discovery.ts:43-49` — every DAL WHERE filters `eq(...userId, userId)`.
**Apply to:** the new `getManuallyCategorizedHashes` query (assert in DAL test, mirrors T-51-03).

### server-only boundary
**Source:** file headers — `lib/utils/pattern-suggestions.ts:1-8` (NO server-only) vs `lib/dal/regex-discovery.ts:1` and `lib/services/regex-discovery.ts:1` (`import 'server-only'`).
**Apply to:** keep `candidateCoveredByExistingPattern` pure in the util; `getManuallyCategorizedHashes` stays in the DAL with `server-only`.

### Additive passthrough (descriptionHashes)
**Source:** Phase 51 WithMeta extension, `lib/utils/pattern-suggestions.ts:137-153, 199-226`.
**Apply to:** carrying `descriptionHash` per row → `descriptionHashes[]` per suggestion, collected in the per-group block.

### Manual-history join (Check 2)
**Source:** `lib/services/categorization.ts:54-82` (`applyTier2History`).
**Apply to:** `getManuallyCategorizedHashes` — same `innerJoin` on `expenseId` + `source='manual'`; query `expenseClassificationHistory`, NEVER current `expense` rows (unique-constraint trap, RESEARCH Pitfall 2).

### No-Decimal / amount:null invariant
**Source:** `lib/services/regex-discovery.ts:72` (`amount: null`).
**Apply to:** all detector rows — discovery is description-only, no monetary arithmetic.

---

## No Analog Found

None. Every modification has an exact same-role analog in the same file or a sibling Phase 51 file.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | All five targets are additive extensions of existing Phase 51 code. |

---

## Metadata

**Analog search scope:** `lib/utils/`, `lib/dal/`, `lib/services/`, `tests/` (all targets pre-identified by the orchestrator and confirmed by RESEARCH §Sources).
**Files scanned:** 5 read in full (`pattern-suggestions.ts`, `regex-discovery.ts` service + DAL, `categorization.ts` head, both test files).
**Pattern extraction date:** 2026-06-16
