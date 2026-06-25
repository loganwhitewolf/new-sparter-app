# Phase 52: regex-validity-and-dedup — Research

**Researched:** 2026-06-16
**Domain:** Backend deterministic discovery refactor — regex vs single-categorization classification, dedup against existing patterns + manual history, Drizzle DAL, server-only boundary
**Confidence:** HIGH (all findings from direct codebase inspection of the Phase 51 output and surrounding services)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RDISC-01 | A regex is proposed only when, after normalization, ≥2 transactions share a common prefix/substring but **differ in a residual variable part**. *(Fineco salary → 1 regex.)* | The existing clustering already computes the longest-common-prefix and (in the WithMeta variant) `residualVariablePart`. RDISC-01 = "emit a regex candidate only when `residualVariablePart` is non-empty." See §SC-1 vs SC-2 Distinction. |
| RDISC-02 | When ≥2 transactions are **identical after normalization**, surface them as a **single-categorization suggestion**, not a regex. *(Repeated "Macellaio" → single categorization.)* | When all grouped members are identical, the longest-common-prefix equals the full token list → `residualVariablePart === ''`. Route these groups to a new `singleCategorizationSuggestions` list instead of `candidates`. See §SC-1 vs SC-2 Distinction + §Output Shape. |
| RDISC-03 | Check 1 — skip a candidate when the **regex it would generate** is already matched/covered by an existing pattern in the regex table. | The Phase 51 `isCoveredByPatterns` row-filter already removes input rows whose **description** matches an active pattern. Check 1 is the *generated-regex-vs-existing-pattern* overlap — a **distinct, additional** check needed on the emitted candidate. See §Check 1 (RDISC-03). |
| RDISC-04 | Check 2 — skip a candidate when that transaction type is **already covered by an existing manual categorization for the same `descriptionHash`** (Set A). | Detect via the `expenseClassificationHistory` table (`source = 'manual'`) joined to `expense.descriptionHash`, OR via a categorized `expense` row sharing the candidate group's `descriptionHash`. New DAL query needed. See §Check 2 (RDISC-04). |
</phase_requirements>

---

## Summary

Phase 52 takes the standalone `discoverRegexCandidates` service shipped in Phase 51 and adds **correctness gates** to its output. Phase 51 already extracts Set B, applies platform normalization, clusters by prefix, and carries D-05 per-candidate metadata (`stablePrefix`, `residualVariablePart`, `strippedByNormalization`, `sampleNormalized`). It does **not yet** distinguish a genuine regex family from an identical-group, nor does it dedup the *generated regex* against existing patterns or against manual history. This phase plugs those four gates in.

The single most important finding: **the SC-1 vs SC-2 distinction is already computable from the existing `residualVariablePart` field with zero new clustering logic.** A genuine prefix+variable family (Fineco salary) has a non-empty residual; an identical-after-normalization group (repeated Macellaio) has an empty residual because the longest-common-prefix consumes the entire token list. The current `detectPatternSuggestionsWithMeta` collapses both into the same `PatternSuggestionWithMeta[]` output — Phase 52 must split them: non-empty residual → regex candidate; empty residual → single-categorization suggestion (no regex).

Checks 1 and 2 are **dedup gates**, not clustering changes. Check 1 (RDISC-03) is subtly different from the Phase 51 coverage filter: that filter removes *input rows* whose description matches an active pattern; Check 1 removes a *surviving candidate* whose **generated regex** would overlap an existing pattern (e.g. the candidate's prefix is a superstring/substring of an existing pattern that the raw-row filter did not catch because no individual row's full description matched). Check 2 (RDISC-04) is a new DAL query: for each candidate group's `descriptionHash` set, has the user already manually categorized an expense with that same hash? If so, the type is "known" and re-proposing is noise.

**Primary recommendation:** Keep the pure util's clustering untouched. Add (a) a pure post-classification split (regex vs single) keyed on `residualVariablePart`, (b) a generated-regex overlap check against the active pattern set (pure, in the util or a small helper), and (c) a new server-only DAL query for manual-history dedup. Wire all three into `discoverRegexCandidates`, returning an extended `DiscoveryResult` with a second `singleCategorizationSuggestions` list. Mirror the Phase 51 test style exactly: real util + `normalizeDescription`, mocked DAL + `loadActivePatterns`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Classify candidate as regex-family vs identical-group (SC-1/SC-2) | Pure util (`lib/utils/pattern-suggestions.ts`) | — | Deterministic from `residualVariablePart`; must stay script-safe and unit-testable, no DB |
| Generated-regex vs existing-pattern overlap (Check 1) | Pure util / pure helper | — | Pure regex reasoning on `candidate.pattern` vs `CoveragePattern[]`; no DB, no server-only |
| Manual-categorization dedup by descriptionHash (Check 2) | Database / DAL (`lib/dal/regex-discovery.ts`) | — | Requires querying `expense` / `expenseClassificationHistory`; server-only |
| Orchestration (cluster → split → Check 1 → Check 2 → result) | Service (`lib/services/regex-discovery.ts`) | — | Already server-only; stitches DAL + util; extends the Phase 51 service in place |
| Calling the service | Actions layer (Phase 54) | — | Out of scope for Phase 52 |
| Rendering regex vs single-categorization lists | UI (Phase 55) | — | Out of scope; SUMUI-02 consumes the two-list `DiscoveryResult` shape this phase defines |

---

## SC-1 vs SC-2 Distinction — The Core Algorithmic Finding

This is research question #1, and it resolves cleanly against existing code.

### How the clustering already separates the two cases

`detectPatternSuggestionsWithMeta` (lib/utils/pattern-suggestions.ts:163–230):

1. Strips numeric tokens (`stripNumericTokens`), drops rows with `< 2` tokens.
2. Buckets by the first 2 stripped tokens.
3. For each bucket with ≥2 members, intersects down to the **longest common prefix** across all members.
4. Computes `residualVariablePart` = tokens of the first member **beyond** the shared prefix (line 207–210):
   ```ts
   const firstTokens = stripNumericTokens(firstNormalized)
   const residualTokens = firstTokens.slice(prefix.length)
   const residualVariablePart = residualTokens.join(' ')
   ```

### The decisive signal: `residualVariablePart` empty vs non-empty `[VERIFIED: lib/utils/pattern-suggestions.ts inspection]`

| Scenario | Normalized members | Longest common prefix | `residualVariablePart` | Correct outcome |
|----------|--------------------|-----------------------|------------------------|-----------------|
| **SC-1 Fineco family** | `bonifico andrea bernardini causale stipendio marzo` / `…maggio` / `…giugno` | `bonifico andrea bernardini causale stipendio` (5 tokens) | `marzo` (non-empty) | **Regex candidate** |
| **SC-2 Macellaio identical** | `macellaio da mario` (×3, identical) | `macellaio da mario` (full token list, 3 tokens) | `` (empty — `slice(prefix.length)` of an equal-length list is `[]`) | **Single-categorization suggestion, NO regex** |

When all members are byte-identical after normalization, the longest-common-prefix equals each member's full token list, so `firstTokens.slice(prefix.length)` is `[]` and `residualVariablePart === ''`. When members differ in a trailing token (months, progressives, causali), the prefix stops short and the residual is non-empty.

**This is the signal. RDISC-01 = "non-empty residual → regex"; RDISC-02 = "empty residual → single categorization".** No new clustering math, no `matchCount` heuristic, no separate identical-detection pass.

### Two edge cases the planner must handle explicitly

1. **Single-token identical merchant ("Macellaio" alone, 1 token).** The current util drops rows with `< 2` stripped tokens (line 174–176, `if (tokens.length < 2) continue`). A bare one-word repeated merchant **never reaches the bucketing stage** and is silently dropped — it produces neither a regex nor a single-categorization suggestion today. The DoD test case says "repeated identical Macellaio → single categorization." The planner must decide:
   - **Option A (recommended):** The realistic bank descriptor is multi-token ("Macellaio Da Mario", "Pagamento POS Macellaio …"), so it has ≥2 tokens and the empty-residual path handles it. Use a **multi-token identical** fixture for the DoD test. This requires **no change** to the `< 2` token guard.
   - **Option B:** Lower the single-categorization path's token floor to 1 so a bare one-word merchant also surfaces as a single-categorization suggestion. This is a behavior change to the util and risks noise (every one-off single-word descriptor would surface). **Not recommended** unless the DoD explicitly demands the 1-token case.
   - **Recommendation:** Option A. Confirm the exact Macellaio fixture wording in discuss/plan; if the real data is genuinely one token, escalate to the user (this is an `[ASSUMED]` — see Assumptions Log A1).

2. **A group with ≥2 distinct members where SOME are identical and some differ.** The residual is computed from the **first** member only (`group[0]`). If member ordering puts an identical pair first, the residual could mislead. In practice the longest-common-prefix is computed across ALL members, so if any member differs, the prefix is shortened for the whole group and the residual is non-empty — the group is correctly a regex family. The "first member" only affects *which sample text* is shown, not the empty/non-empty classification. Safe.

### Implementation shape (Claude's Discretion — recommended)

Do the split **after** clustering, keyed on residual emptiness. Two equally valid placements:

- **Placement A (in the util):** `detectPatternSuggestionsWithMeta` returns the same flat list; add a tiny pure helper `splitByResidual(suggestions)` → `{ regexCandidates, singleCategorizations }`. Keeps the clustering function single-purpose.
- **Placement B (in the service):** the service partitions the util's output by `s.residualVariablePart.trim() === ''`. Simplest; no util change. **Recommended** — keeps the util's public contract stable and puts the product decision (what counts as "single") in the service where the result shape lives.

```ts
// In lib/services/regex-discovery.ts after clustering:
const clustered = detectPatternSuggestionsWithMeta(detectorRows, activePatterns)
const regexFamilies = clustered.filter(s => s.residualVariablePart.trim() !== '')
const identicalGroups = clustered.filter(s => s.residualVariablePart.trim() === '')
```

---

## Check 1 (RDISC-03) — Generated-Regex vs Existing-Pattern Overlap

Research question #2: is this already handled by the Phase 51 coverage filter? **No — it is a distinct check.**

### What the Phase 51 filter does (and does not do) `[VERIFIED: lib/utils/pattern-suggestions.ts:40–61, 173]`

`isCoveredByPatterns(row, coveragePatterns)` tests each **input row's normalized description** (and its numeric-stripped form) against every active pattern. Rows that match are dropped **before** clustering. This removes Set-A-adjacent rows that an existing regex already fires on.

**The gap:** Check 1 is about the **generated candidate regex** (`candidate.pattern`, an escaped prefix string), not the raw rows. Two ways a candidate can survive the row filter yet still be a duplicate:

1. **Existing pattern is broader than any single row's full description.** Suppose an active pattern is `bonifico andrea` and the rows are `bonifico andrea bernardini causale stipendio marzo`. The row filter's regex `/bonifico andrea/i` **does** match the row, so this case is actually caught by the row filter. So far the filter covers "existing pattern ⊆ row".

2. **Generated candidate is broader than / equal to an existing pattern that did NOT match the raw rows.** Edge case: an active pattern was authored against a *different* surface form (e.g. a stripped/aliased token) so it did not fire on the raw normalized row, yet the prefix the candidate generates is semantically the same regex. Also: the candidate's generated pattern could be **identical** to an existing pattern string that, due to numeric-token stripping differences, didn't match a specific row but would collide on insert (`categorization_pattern_unique (pattern, sub_category_id)`).

In practice, because `isCoveredByPatterns` already tests both the full and numeric-stripped forms and patterns are sign-agnostic (ADR 0012), **most** "existing pattern covers this family" cases are caught at the row stage. Check 1 is the **belt-and-suspenders** gate the requirement explicitly mandates, and it is cheap to add.

### Recommended Check 1 implementation `[VERIFIED: applyTier1Regex matcher semantics, regex-label SKILL.md "Matcher fidelity"]`

Add a pure helper that, for each surviving regex candidate, tests whether the candidate's generated regex **overlaps** any active pattern. The cheapest faithful definition of "already covered" that matches production matching semantics:

> A candidate is covered by an existing pattern P if P, compiled as `new RegExp(P.pattern, 'i')`, matches the candidate's `sampleNormalized` (and its numeric-stripped form) — i.e. P would already fire on a representative member of this family.

```ts
// pure helper, lib/utils/pattern-suggestions.ts (no server-only)
export function candidateCoveredByExistingPattern(
  candidate: PatternSuggestionWithMeta,
  coveragePatterns: CoveragePattern[],
): boolean {
  const normalized = candidate.sampleNormalized
  const stripped = normalized.split(/\s+/).filter(t => t.length > 0 && !/^\d+$/.test(t)).join(' ')
  for (const p of coveragePatterns) {
    try {
      const re = new RegExp(p.pattern, 'i')
      if (re.test(normalized) || re.test(stripped)) return true
    } catch { /* invalid pattern — skip */ }
  }
  return false
}
```

This is intentionally the **same matcher** as `isCoveredByPatterns` / `applyTier1Regex` (dual full + numeric-stripped test, case-insensitive). The difference from the row filter is the *subject*: this tests the **candidate's representative sample** post-survival, catching any family whose representative is now covered even if the per-row pre-filter ordering missed it.

> **Note on redundancy:** because `sampleNormalized` is one of the family's normalized rows, and that row already passed `isCoveredByPatterns` (else it'd be filtered), `candidateCoveredByExistingPattern` will usually return `false` for survivors. That is acceptable — RDISC-03 is satisfied by *having* the explicit gate; the gate also future-proofs against the row-filter being relaxed and makes the skip an auditable, tested step. **Do not remove the row-level filter** — both layers are wanted. The planner should add a test that proves a candidate IS skipped when an existing pattern covers it (mock `loadActivePatterns` with a pattern matching the family), mirroring the existing `PIPE-01: coverage filter` test.

**An alternative, stricter Check-1 interpretation** ("the generated regex is a substring/superstring of an existing pattern string") is more complex, prone to false positives, and not required by the matcher-fidelity rule. **Do not implement string-subset matching** — use the run-the-existing-matcher approach above.

---

## Check 2 (RDISC-04) — Manual-Categorization Dedup by descriptionHash

Research question #3. This is the only gate requiring a **new DB read**.

### How manual categorization is recorded `[VERIFIED: lib/actions/expenses.ts:240–264, 283–305; schema.ts:493–524]`

When a user manually categorizes an expense (single or bulk):
1. `expense.subCategoryId` is set and `expense.status` → `'3'` (categorized). → that expense leaves Set B.
2. A row is written to `expenseClassificationHistory` with `source: 'manual'`, `toSubCategoryId`, `toStatus: '3'`, linked by `expenseId`.

`expenseClassificationHistory.source` enum: `['system_pattern', 'user_pattern', 'manual', 'override', 'import_default']` (schema.ts:40–46). **`'manual'` is the marker** that distinguishes a hand-set categorization from an auto (regex/history) one.

### Two valid definitions of "already covered by a manual categorization"

The candidate group is a set of uncategorized expenses sharing a normalized-description family. Each member expense has a `descriptionHash` (SHA-256 of its normalized description, `computeDescriptionHash`, lib/utils/import.ts:74–76). "Already covered by an existing manual categorization for the same `descriptionHash`" can mean:

- **(2a) History-based:** there exists a row in `expenseClassificationHistory` with `source = 'manual'` whose linked expense has a `descriptionHash` in the candidate group's hash set. This is the literal RDISC-04 wording and aligns with the existing `applyTier2History` query shape (categorization.ts:54–82, which joins `expenseClassificationHistory` → `expense` on `descriptionHash` and filters `source = 'manual'`).
- **(2b) Current-state-based:** there exists a **categorized** `expense` (`subCategoryId IS NOT NULL`) for the same user sharing one of the candidate group's `descriptionHash` values. Simpler — one table, no history join — and catches manual categorizations even if history writing failed (it is non-fatal, expenses.ts:253–255).

> **Important nuance:** the `expense` table has `unique (userId, descriptionHash)` (schema.ts:404). So **one** expense per unique descriptionHash per user. A candidate-group member (uncategorized, `subCategoryId IS NULL`) and a categorized Set-A expense **cannot share the same descriptionHash** — the unique constraint forbids two expense rows with the same hash. Therefore (2b) "find a categorized expense with the SAME hash as an uncategorized group member" returns **nothing by construction**.

This is a critical finding. Re-read RDISC-04: "that **transaction type** is already covered." The intent is broader than exact-hash-of-the-group-member. The dedup is across **history**, not current expense rows. So:

- **(2a) is the correct interpretation.** Manual classification *history* persists `source='manual'` rows even after the underlying expense's hash changed or the expense was re-categorized/deleted. The query must look at **history**, joining to whatever expense still carries that hash, OR the candidate group's hashes must be matched against the hashes of expenses that *were* manually categorized.

### Recommended Check 2 implementation — new DAL query `[VERIFIED: categorization.ts:54–82 query pattern; schema.ts join]`

Mirror the `applyTier2History` join, but return the **set of descriptionHashes** that have a manual classification, scoped to the user (and ideally the platform, consistent with D-03):

```ts
// lib/dal/regex-discovery.ts (server-only) — NEW query
import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import { expense, expenseClassificationHistory } from '@/lib/db/schema'

/**
 * Returns the subset of the given descriptionHashes that already have at least one
 * MANUAL classification in history for this user. Used to skip discovery candidates
 * whose transaction type the user has already hand-categorized (RDISC-04 / Check 2).
 */
export async function getManuallyCategorizedHashes(
  userId: string,
  descriptionHashes: string[],
): Promise<Set<string>> {
  if (descriptionHashes.length === 0) return new Set()
  const rows = await db
    .selectDistinct({ descriptionHash: expense.descriptionHash })
    .from(expenseClassificationHistory)
    .innerJoin(expense, eq(expenseClassificationHistory.expenseId, expense.id))
    .where(
      and(
        eq(expenseClassificationHistory.userId, userId),
        eq(expenseClassificationHistory.source, 'manual'),
        isNotNull(expense.descriptionHash),
        inArray(expense.descriptionHash, descriptionHashes),
      ),
    )
  return new Set(rows.map(r => r.descriptionHash).filter((h): h is string => h !== null))
}
```

Then in the service: collect the candidate group's member hashes, fetch the manual set, and **skip any candidate all (or any) of whose members are in that set**. The "all vs any" policy is a product decision:
- **any member manually categorized → skip the candidate** (conservative; recommended — if the user has hand-classified one of this family, they likely know the type).
- **all members manually categorized → skip** (laxer).

**Recommendation:** "any → skip" for regex families; for single-categorization suggestions, the same gate applies (don't re-suggest a single categorization the user already made manually). Confirm in discuss/plan (`[ASSUMED]` A2).

> **Caveat on hash availability:** `expense.descriptionHash` is **nullable** (schema.ts:379) and the Phase 51 DAL `UncategorizedExpenseForDiscovery.descriptionHash` is typed `string | null`. The candidate util currently does **not** carry `descriptionHash` through to the suggestion — it clusters on normalized text. To run Check 2 the service must map each candidate back to its member expenses' hashes. Two options:
> - **Carry `descriptionHash` on `PatternDetectorRowWithMeta`** and have the util collect member hashes per suggestion (additive field, mirrors how `rawTitle` was added in Phase 51). Cleanest.
> - **Recompute the hash in the service** from `sampleNormalized` via `computeDescriptionHash` for the representative member, and match that single hash. Simpler but only checks one member, not all. Acceptable for "any → skip" if combined with checking each member, but the util doesn't expose all members today.
> **Recommendation:** add `descriptionHashes: string[]` to `PatternSuggestionWithMeta` (the hashes of all grouped members), computed in the util where the group is in scope. This is the same additive-passthrough pattern Phase 51 established and makes Check 2 a clean set-membership test in the service.

---

## Output Shape (Research Question #4)

The result must distinguish proposed regex candidates from single-categorization suggestions (and SUMUI-02 in Phase 55 renders them separately). Two designs:

| Design | Shape | Verdict |
|--------|-------|---------|
| **A — Second list (recommended)** | `DiscoveryResult { candidates: PatternSuggestionWithMeta[]; singleCategorizationSuggestions: SingleCategorizationSuggestion[]; totalUncategorized; platformId }` | **Recommended.** Backward-compatible-ish (existing `candidates` field keeps meaning "regex candidates"); Phase 55 maps cleanly to SUMUI-02's two visual sections; each list can have its own type. |
| B — Discriminated union | `candidates: (RegexCandidate \| SingleCategorization)[]` with a `kind` field | More uniform but forces every consumer to switch on `kind`; harder for Phase 55 to render two sections; changes the meaning of the existing `candidates` field. Not recommended. |

### Recommended types (additive to the Phase 51 `DiscoveryResult`)

```ts
// lib/services/regex-discovery.ts
export type SingleCategorizationSuggestion = {
  /** The normalized description shared by all identical members */
  normalizedDescription: string
  /** Sample raw titles (max 3, mirrors PatternSuggestion.sampleDescriptions) */
  sampleDescriptions: string[]
  /** How many identical transactions share this description */
  matchCount: number
  /** descriptionHashes of the identical members (for downstream apply) */
  descriptionHashes: string[]
}

export type DiscoveryResult = {
  candidates: PatternSuggestionWithMeta[]            // regex families (RDISC-01)
  singleCategorizationSuggestions: SingleCategorizationSuggestion[] // identical groups (RDISC-02)
  totalUncategorized: number
  platformId: number
}
```

`PatternSuggestionWithMeta` already carries `residualVariablePart` (used to route) — a single-categorization suggestion has no residual and no escaped regex `pattern`, so a distinct lightweight type is cleaner than reusing the regex type. `SingleCategorizationSuggestion` deliberately omits `pattern` (there is no regex) and `stablePrefix`/`strippedByNormalization`/`residualVariablePart` (the residual is empty by definition).

> **Phase 54/55 awareness (do not implement here):** Phase 54 will call this service from two entry points; Phase 55 renders both lists with SUMUI-02 separation. The two-list shape is the contract both downstream phases consume — lock it here.

---

## Service Orchestration — End-to-End (Recommended)

The Phase 52 `discoverRegexCandidates` extends the Phase 51 body. Pipeline order matters: cluster → split → Check 1 → Check 2.

```ts
export async function discoverRegexCandidates(input: {
  userId: string
  scope: DiscoveryScope
}): Promise<DiscoveryResult> {
  const { userId, scope } = input

  // 1. Set B + active patterns (unchanged from Phase 51)
  const expenses = await getUncategorizedExpensesForDiscovery(userId, scope.platformId)
  const activePatterns = await loadActivePatterns(db, userId)

  // 2. Build detector rows with strip normalization (unchanged) + carry descriptionHash
  const stripPattern = expenses[0]?.descriptionStripPattern ?? null
  const detectorRows: PatternDetectorRowWithMeta[] = expenses.map((e) => {
    const rawTitle = e.title
    const stripped = applyStrip(rawTitle, stripPattern)
    return {
      description: rawTitle,
      normalizedDescription: normalizeDescription(stripped),
      amount: null,
      valid: true,
      covered: false,
      rawTitle,
      strippedByNormalization: stripped !== rawTitle,
      descriptionHash: e.descriptionHash ?? null, // NEW — for Check 2
    }
  })

  // 3. Cluster (existing util; now also emits descriptionHashes per suggestion)
  const clustered = detectPatternSuggestionsWithMeta(detectorRows, activePatterns)

  // 4. RDISC-01/02 split on residual emptiness
  let regexFamilies = clustered.filter(s => s.residualVariablePart.trim() !== '')
  const identicalGroups = clustered.filter(s => s.residualVariablePart.trim() === '')

  // 5. RDISC-03 Check 1 — drop families whose generated regex an existing pattern already covers
  regexFamilies = regexFamilies.filter(s => !candidateCoveredByExistingPattern(s, activePatterns))

  // 6. RDISC-04 Check 2 — drop families/groups already manually categorized (same descriptionHash)
  const allHashes = [...regexFamilies, ...identicalGroups].flatMap(s => s.descriptionHashes)
  const manualHashes = await getManuallyCategorizedHashes(userId, allHashes)
  const notManuallyCovered = (s: { descriptionHashes: string[] }) =>
    !s.descriptionHashes.some(h => manualHashes.has(h)) // "any member manual → skip"

  return {
    candidates: regexFamilies
      .filter(notManuallyCovered)
      .sort((a, b) => b.matchCount - a.matchCount)
      .slice(0, 10),
    singleCategorizationSuggestions: identicalGroups
      .filter(notManuallyCovered)
      .map(toSingleCategorization)
      .sort((a, b) => b.matchCount - a.matchCount)
      .slice(0, 10),
    totalUncategorized: expenses.length,
    platformId: scope.platformId,
  }
}
```

> The `amount: null` / no-Decimal.js invariant from Phase 51 is preserved — discovery is description-only. No monetary arithmetic anywhere in this phase.

---

## Standard Stack

No new npm packages. All building blocks exist.

| Asset | Location | Role in Phase 52 |
|-------|----------|-------------------|
| `detectPatternSuggestionsWithMeta`, `PatternSuggestionWithMeta`, `PatternDetectorRowWithMeta` | `lib/utils/pattern-suggestions.ts` | Clustering + D-05 metadata (extend to carry `descriptionHashes`) |
| `isCoveredByPatterns` (private) | `lib/utils/pattern-suggestions.ts:40` | Existing row-level coverage filter — keep; mirror its matcher for Check 1 |
| `loadActivePatterns` | `lib/services/categorization.ts:22` | Supplies `CoveragePattern[]` for both filters |
| `applyTier2History` query shape | `lib/services/categorization.ts:54–82` | Template for the Check 2 history join (`source='manual'`, join on `descriptionHash`) |
| `expenseClassificationHistory` table | `lib/db/schema.ts:493–524` | Source of truth for manual categorizations (`source='manual'`) |
| `expense.descriptionHash` | `lib/db/schema.ts:379` | The dedup grain (nullable `varchar(64)`) |
| `computeDescriptionHash` / `normalizeDescription` | `lib/utils/import.ts:67–76` | Canonical hash + normalization (it-IT locale) |
| `getUncategorizedExpensesForDiscovery` | `lib/dal/regex-discovery.ts` | Phase 51 Set B fetch — already returns `descriptionHash` |
| `db`, `DbOrTx` | `lib/db/index.ts` | Drizzle client |
| `vitest` ^4.1.5 | `package.json` | Test framework |

**Installation:** None required.

---

## Package Legitimacy Audit

No external packages introduced in this phase.

| Package | Verdict | Disposition |
|---------|---------|-------------|
| (none) | — | — |

---

## Architecture Patterns

### System Architecture Diagram

```
discoverRegexCandidates({ userId, scope: { platformId } })   ← lib/services/regex-discovery.ts [EXTEND]
   |
   ├─ getUncategorizedExpensesForDiscovery(userId, platformId)   ← lib/dal/regex-discovery.ts (Phase 51, returns descriptionHash)
   ├─ loadActivePatterns(db, userId)                             ← lib/services/categorization.ts
   |
   ├─ build PatternDetectorRowWithMeta[] (strip → normalizeDescription, + descriptionHash)   [EXTEND: carry hash]
   |
   ├─ detectPatternSuggestionsWithMeta(rows, activePatterns)     ← lib/utils/pattern-suggestions.ts [EXTEND: emit descriptionHashes]
   |        returns PatternSuggestionWithMeta[] (each carries residualVariablePart + descriptionHashes)
   |
   ├─ SPLIT on residualVariablePart:
   |     non-empty → regexFamilies   (RDISC-01)
   |     empty     → identicalGroups (RDISC-02 → singleCategorizationSuggestions)
   |
   ├─ CHECK 1 (RDISC-03): regexFamilies.filter(!candidateCoveredByExistingPattern(s, activePatterns))   [NEW pure helper]
   |
   ├─ CHECK 2 (RDISC-04): getManuallyCategorizedHashes(userId, allHashes)   ← lib/dal/regex-discovery.ts [NEW query]
   |     drop any suggestion with a member hash in the manual set
   |
   └─ DiscoveryResult { candidates, singleCategorizationSuggestions, totalUncategorized, platformId }   [EXTEND shape]
```

### Recommended File Layout

```
lib/
├── dal/
│   └── regex-discovery.ts        # EXTEND — add getManuallyCategorizedHashes()
├── services/
│   └── regex-discovery.ts        # EXTEND — split + Check1 + Check2 wiring; new DiscoveryResult shape + SingleCategorizationSuggestion type
└── utils/
    └── pattern-suggestions.ts    # EXTEND — carry descriptionHashes through to PatternSuggestionWithMeta; add candidateCoveredByExistingPattern()
```

All three files already exist (Phase 51). This phase is purely additive extension — no new files strictly required, though the planner may split `candidateCoveredByExistingPattern` into its own pure module if preferred (must stay non-`server-only`).

### Anti-Patterns to Avoid

- **Adding `import 'server-only'` to `lib/utils/pattern-suggestions.ts`.** It must stay script-safe (offline CLI `scripts/regex-discovery.ts` imports pure utils). The new `candidateCoveredByExistingPattern` helper, if placed here, must be pure. `[VERIFIED: pattern-suggestions.ts:1–8 header comment]`
- **Re-implementing the regex matcher for Check 1.** Reuse the exact dual full-+-numeric-stripped, case-insensitive test that `isCoveredByPatterns` / `applyTier1Regex` use (matcher fidelity, regex-label SKILL.md). A divergent matcher would skip/keep candidates inconsistently with production categorization.
- **Using current-state `expense` rows for Check 2.** The `unique(userId, descriptionHash)` constraint means an uncategorized group member and a categorized expense cannot share a hash — querying current expenses returns nothing by construction. Check 2 MUST query `expenseClassificationHistory` (`source='manual'`). `[VERIFIED: schema.ts:404]`
- **Treating the Phase 51 row coverage filter as Check 1.** They are different subjects (input rows vs generated candidate). Keep both.
- **String-subset matching for Check 1** (e.g. "candidate.pattern contains existing pattern"). Prone to false positives; use the run-the-matcher approach.
- **Running discovery inside `db.transaction`.** Discovery is post-commit, read-only (Phase 51 invariant). The new Check 2 query is also a plain read.
- **Decimal.js / amount logic.** None needed — description-only. `amount: null` throughout.
- **Lowering the `< 2` token guard in `detectPatternSuggestionsWithMeta` to catch 1-token merchants** without confirming the DoD fixture needs it — risks flooding single-categorization suggestions with one-off descriptors.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Identical-vs-variable detection | Custom string-equality clustering pass | `residualVariablePart` from existing `detectPatternSuggestionsWithMeta` | Already computed by the longest-common-prefix; empty ⇔ identical |
| Generated-regex coverage test (Check 1) | New regex engine / subset matcher | Same dual full+numeric-stripped `new RegExp(p, 'i')` test as `isCoveredByPatterns` | Matcher fidelity with production `applyTier1Regex` |
| Manual-categorization lookup (Check 2) | Scanning `expense` current state | `expenseClassificationHistory` join on `descriptionHash` with `source='manual'` (mirror `applyTier2History`) | Unique constraint makes current-state lookup return nothing; history is the source of truth |
| Description normalization / hashing | Custom lowercase/trim/sha | `normalizeDescription` + `computeDescriptionHash` | Canonical it-IT-aware; same hash used at import time |
| Set B fetch | Inline SQL | `getUncategorizedExpensesForDiscovery` (Phase 51) | Already returns `descriptionHash` + platform-scoped |

**Key insight:** Phase 52 adds **zero new clustering or matching algorithms.** Every gate reuses an existing, tested primitive — the work is *routing* the util's output (split on residual) and *one new read query* (manual-history hashes).

---

## Common Pitfalls

### Pitfall 1: Confusing the Phase 51 row coverage filter with Check 1 (RDISC-03)
**What goes wrong:** Assuming `isCoveredByPatterns` already satisfies RDISC-03 and adding no explicit Check 1, so the requirement is unverifiable.
**Why it happens:** Both involve "coverage by existing patterns." But the row filter tests *input descriptions*; Check 1 tests the *generated candidate*.
**How to avoid:** Add an explicit `candidateCoveredByExistingPattern` gate with its own test that proves a surviving candidate IS dropped when an active pattern covers its representative sample. Keep the row filter too.

### Pitfall 2: Querying current `expense` rows for Check 2 (returns nothing)
**What goes wrong:** Writing Check 2 as "find a categorized expense with the same descriptionHash as a group member" — always empty because `unique(userId, descriptionHash)` forbids two expense rows sharing a hash.
**Why it happens:** The requirement says "for the same descriptionHash," which reads like an expense-table lookup.
**How to avoid:** Query `expenseClassificationHistory` (`source='manual'`) joined to `expense.descriptionHash`. History persists the manual classification independently of the live expense row. `[VERIFIED: schema.ts:404 unique constraint]`

### Pitfall 3: The single-token Macellaio case is silently dropped
**What goes wrong:** A bare one-word repeated merchant ("Macellaio") never reaches bucketing (`tokens.length < 2` guard) and produces no single-categorization suggestion, so DoD test case 2 fails if the fixture is literally one token.
**Why it happens:** The `< 2` token floor exists to avoid noise; it predates the single-categorization concept.
**How to avoid:** Use a realistic **multi-token identical** fixture ("Macellaio Da Mario" ×3) for the DoD test — then the empty-residual path handles it with no util change. If the user insists on the 1-token case, escalate (it's a deliberate behavior change). See §SC-1 vs SC-2 edge case 1.

### Pitfall 4: `descriptionHash` nullability breaks Check 2
**What goes wrong:** `expense.descriptionHash` is nullable; passing `null` into `inArray` or building a hash set from nulls causes wrong matches or query errors.
**Why it happens:** Schema allows null (legacy/edge rows).
**How to avoid:** Filter nulls before the `inArray`, and guard the candidate-side hash list. The recommended DAL query includes `isNotNull(expense.descriptionHash)`. `[VERIFIED: schema.ts:379]`

### Pitfall 5: Residual emptiness check on un-trimmed string
**What goes wrong:** `residualVariablePart` could in theory be a whitespace-only string; `=== ''` then misclassifies an identical group as a regex family.
**Why it happens:** `residualTokens.join(' ')` of `[]` is `''`, but defensive trimming avoids any edge.
**How to avoid:** Route on `s.residualVariablePart.trim() === ''`. (Current util produces clean `''` for empty residual, but trim is cheap insurance.)

### Pitfall 6: Member-hash collection only uses the first sample
**What goes wrong:** Computing one hash from `sampleNormalized` and checking only that misses other members the user manually categorized → a candidate that should be skipped survives.
**Why it happens:** The current util exposes `sampleDescriptions` (max 3) and one `sampleNormalized`, not all member hashes.
**How to avoid:** Carry `descriptionHashes: string[]` (all members) through the util to each suggestion, and check the full set against the manual set. See §Check 2 caveat.

---

## Code Examples

### Routing regex vs single-categorization (in the service)
```ts
// Source: derived from lib/utils/pattern-suggestions.ts:207-210 residual computation
const clustered = detectPatternSuggestionsWithMeta(detectorRows, activePatterns)
const regexFamilies   = clustered.filter(s => s.residualVariablePart.trim() !== '') // RDISC-01
const identicalGroups = clustered.filter(s => s.residualVariablePart.trim() === '') // RDISC-02
```

### Check 1 — generated-regex coverage (pure helper, no server-only)
```ts
// Source: mirrors lib/utils/pattern-suggestions.ts:40-61 isCoveredByPatterns matcher
export function candidateCoveredByExistingPattern(
  candidate: PatternSuggestionWithMeta,
  coveragePatterns: CoveragePattern[],
): boolean {
  const normalized = candidate.sampleNormalized
  const stripped = normalized.split(/\s+/).filter(t => t && !/^\d+$/.test(t)).join(' ')
  return coveragePatterns.some(p => {
    try { const re = new RegExp(p.pattern, 'i'); return re.test(normalized) || re.test(stripped) }
    catch { return false }
  })
}
```

### Check 2 — manual-history dedup (server-only DAL)
```ts
// Source: mirrors lib/services/categorization.ts:54-82 applyTier2History join shape
export async function getManuallyCategorizedHashes(
  userId: string,
  descriptionHashes: string[],
): Promise<Set<string>> {
  if (descriptionHashes.length === 0) return new Set()
  const rows = await db
    .selectDistinct({ descriptionHash: expense.descriptionHash })
    .from(expenseClassificationHistory)
    .innerJoin(expense, eq(expenseClassificationHistory.expenseId, expense.id))
    .where(and(
      eq(expenseClassificationHistory.userId, userId),
      eq(expenseClassificationHistory.source, 'manual'),
      isNotNull(expense.descriptionHash),
      inArray(expense.descriptionHash, descriptionHashes),
    ))
  return new Set(rows.map(r => r.descriptionHash!).filter(Boolean))
}
```

---

## State of the Art

| Old Approach (pre-52) | Current Approach (Phase 52) | Impact |
|-----------------------|------------------------------|--------|
| Every ≥2-member prefix group → a regex candidate | Empty-residual groups → single-categorization, non-empty → regex | Identical merchants no longer get a meaningless full-string regex |
| Only row-level coverage filter | Row filter + explicit generated-candidate coverage gate (Check 1) | RDISC-03 verifiable; future-proof against filter relaxation |
| No manual-history dedup | `expenseClassificationHistory` (`source='manual'`) hash dedup (Check 2) | Stops re-proposing types the user already hand-classified |
| Single `candidates` list | Two-list `DiscoveryResult` (`candidates` + `singleCategorizationSuggestions`) | SUMUI-02 (Phase 55) renders the visual separation; Phase 54 consumes both |

**Deprecated/outdated:** none new. ADR 0012 (sign-agnostic patterns) remains the matching contract — Check 1 inherits it.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.5 `[VERIFIED: package.json]` |
| Config file | `vitest.config.ts` (alias `@` → root; `server-only` mocked to `tests/__mocks__/server-only.ts`) |
| Quick run command | `yarn test` (`vitest run`) |
| Full suite command | `yarn test` |
| Single file | `yarn test tests/regex-discovery-service.test.ts` |

### Test style to mirror (from Phase 51) `[VERIFIED: tests/regex-discovery-service.test.ts, tests/pattern-suggestion-detector-meta.test.ts, tests/regex-discovery-dal.test.ts]`
- **Service tests:** `vi.hoisted` mocks for the DAL + `loadActivePatterns`; **real** util + `normalizeDescription` (do NOT mock clustering); `vi.mock('server-only', () => ({}))`; `vi.mock('@/lib/db', () => ({ db: {} }))`. Fineco DoD fixtures are inline arrays of `{ id, title, descriptionHash, descriptionStripPattern }`.
- **Pure util tests:** import `detectPatternSuggestionsWithMeta` directly with `rowMeta()` helper; no mocks; assert `stablePrefix`/`residualVariablePart` exactly.
- **DAL tests:** mock the Drizzle chain (`from`/`leftJoin`/`innerJoin`/`where`) and assert the WHERE args structurally (`{ op: 'eq', left, right }`), mock `drizzle-orm` operators.

### Phase Requirements → Test Map
| Req ID | Behavior | Type | Command | Fixture / mock |
|--------|----------|------|---------|----------------|
| RDISC-01 | Fineco salary (marzo/maggio/giugno) → exactly 1 **regex** candidate, 0 single-categorizations | unit (service) | `yarn test tests/regex-discovery-service.test.ts` | Existing Fineco fixture; assert `candidates.length===1`, `singleCategorizationSuggestions.length===0`, residual non-empty |
| RDISC-02 | 3× identical "Macellaio Da Mario" → 0 regex candidates, 1 single-categorization | unit (service + util) | same | Multi-token identical fixture; assert `candidates.length===0`, `singleCategorizationSuggestions.length===1` |
| RDISC-02 | util: identical members → empty `residualVariablePart` | unit (util) | `yarn test tests/pattern-suggestion-detector-meta.test.ts` | 3 identical `normalizedDescription`; assert `residualVariablePart===''` |
| RDISC-03 | Candidate whose generated regex an active pattern covers → skipped | unit (service) | service test | Fineco fixture + `loadActivePatterns` returns a pattern matching the family; assert candidate dropped |
| RDISC-03 | `candidateCoveredByExistingPattern` helper true/false | unit (util) | util test | direct calls with covering / non-covering patterns |
| RDISC-04 | Family whose member hash has a manual history row → skipped | unit (service) | service test | mock `getManuallyCategorizedHashes` returning a hash present in the group |
| RDISC-04 | DAL `getManuallyCategorizedHashes` builds correct WHERE (`source='manual'`, `inArray(descriptionHash)`) | unit (DAL) | `yarn test tests/regex-discovery-dal.test.ts` | mocked Drizzle chain + operators; assert WHERE args |

### Wave 0 Gaps
- [ ] No new framework install — vitest present.
- [ ] Extend `tests/regex-discovery-service.test.ts` with RDISC-01/02/03/04 service cases (two-list assertions).
- [ ] Extend `tests/pattern-suggestion-detector-meta.test.ts` with the identical-group empty-residual case + `descriptionHashes` passthrough.
- [ ] Extend `tests/regex-discovery-dal.test.ts` with `getManuallyCategorizedHashes` WHERE-clause assertions (add `innerJoin` + `inArray`/`isNotNull` to the mocked `drizzle-orm`).
- [ ] Add a `candidateCoveredByExistingPattern` unit test (in the detector-meta test or a new pure test file).

*(Test infrastructure exists; all gaps are extensions, not new harness.)*

---

## Security Domain

`security_enforcement` not explicitly disabled — included. This is a single-user, read-only, post-commit discovery path with no new external input.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Discovery service trusts caller; auth at the Phase 54 action (`verifySession`) per Phase 51 contract |
| V3 Session Management | no | — |
| V4 Access Control (IDOR) | yes | Both new/extended DAL queries MUST filter `eq(...userId, userId)`; cross-user leakage is the main risk (mirrors Phase 51 T-51-03/06) |
| V5 Input Validation | partial | `descriptionHashes` passed to `inArray` are internal-derived (sha256 hex), not user free-text; still cap list size |
| V6 Cryptography | no | `descriptionHash` is content addressing, not a security primitive |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user manual-history leakage in Check 2 | Information Disclosure | `eq(expenseClassificationHistory.userId, userId)` in the new DAL WHERE (assert in test) |
| ReDoS via candidate/existing pattern regex compile | Denial of Service | Existing patterns are seed/operator-controlled (T-51-07 accepted); candidate patterns are escaped prefixes (`escapeRegex`); wrap `new RegExp` in try/catch (already the convention) |
| server-only boundary breach (pure util importing DB) | Tampering | Keep `candidateCoveredByExistingPattern` pure; `server-only` only in service + DAL |
| Unbounded `inArray` hash list | DoS | Set B is platform-scoped + small in practice; optionally cap or chunk if a platform's uncategorized history is large |

---

## Environment Availability

Step 2.6: SKIPPED — code/config changes only. No external CLI tools, services, or runtimes beyond the existing stack (Next.js 16, Drizzle/Postgres, vitest).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The DoD "Macellaio" identical case is **multi-token** in real bank data (≥2 tokens), so the empty-residual path handles it with no change to the `< 2` token guard | SC-1 vs SC-2 edge case 1; Pitfall 3 | If the real merchant is genuinely one token, the single-categorization suggestion won't surface — requires lowering the token floor (a behavior change). Confirm fixture wording with user in discuss/plan. |
| A2 | "Any member manually categorized → skip the whole candidate" is the desired Check 2 policy (vs "all members") | Check 2 (RDISC-04) | If "all members" is intended, conservatively-skipped candidates would wrongly disappear. Low risk; confirm in plan. |
| A3 | Check 1 is satisfied by an explicit "run existing matcher on the candidate's representative sample" gate (not string-subset matching) | Check 1 (RDISC-03) | If RDISC-03 intends literal pattern-string overlap, the matcher approach may differ at the margins. The matcher-fidelity rule (regex-label SKILL.md) supports the chosen approach. |
| A4 | Carrying `descriptionHashes: string[]` on `PatternSuggestionWithMeta` (additive) is acceptable to the planner over recomputing hashes in the service | Output Shape / Check 2 caveat | If the planner prefers service-side recompute, Check 2 may only check one member unless looped — slightly weaker dedup. |

**These four assumptions are the items discuss/plan should confirm before locking decisions.** A1 (Macellaio token count) is the highest-leverage — it determines whether any util change is needed at all.

---

## Open Questions (RESOLVED)

> All three resolved during plan-phase decision capture (2026-06-16) and locked in `52-CONTEXT.md`.

1. **Macellaio fixture token count (drives A1).** — **RESOLVED: multi-token, guard unchanged.**
   - Known: realistic bank descriptors are multi-token; the `< 2` guard drops single tokens.
   - Decision: real repeated merchants are always multi-token → use a multi-token identical fixture (`"Macellaio Da Mario"`); the `< 2` token guard stays unchanged, zero util behavioral change.

2. **Check 2 platform scoping.** — **RESOLVED: entire user manual history, platform-agnostic.**
   - Known: discovery is platform-scoped (D-03). The manual-history query is naturally user-scoped.
   - Decision: dedup across the user's whole manual history (hash is platform-agnostic content addressing); a manual categorization of the same descriptionHash on any platform suppresses the candidate.

3. **Should single-categorization suggestions also run Check 1?** — **RESOLVED: no — Check 1 is regex-families only.**
   - A single-categorization has no generated regex, so Check 1 (generated-regex coverage) is moot for them. An existing pattern that already categorizes that exact description would have filtered the row at the row-coverage stage and it would never reach clustering.
   - Decision: Check 1 applies only to regex families; single-categorization groups are already protected by the row coverage filter + Check 2. No extra gate.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `lib/utils/pattern-suggestions.ts` — full clustering, `isCoveredByPatterns`, `detectPatternSuggestionsWithMeta`, residual computation (lines 40–61, 163–230)
- `lib/services/regex-discovery.ts` — Phase 51 service body (the extension target)
- `lib/dal/regex-discovery.ts` — `getUncategorizedExpensesForDiscovery` (returns `descriptionHash`)
- `lib/services/categorization.ts` — `loadActivePatterns`, `applyTier2History` (Check 2 query template, lines 22–82)
- `lib/actions/expenses.ts` — manual categorization write path (`source:'manual'`, lines 240–264, 283–305)
- `lib/dal/classification-history.ts` — `writeClassificationHistory`, source enum usage
- `lib/services/pattern-application.ts` — `isNull(subCategoryId)` Set B filter + dual-test matcher (lines 35–101)
- `lib/utils/import.ts` — `normalizeDescription`, `computeDescriptionHash` (lines 67–76)
- `lib/db/schema.ts` — `expense` (371–406, `unique(userId,descriptionHash)` line 404), `categorizationPattern` (466–491), `expenseClassificationHistory` (493–524), `classificationSourceEnum` (40–46)
- `tests/regex-discovery-service.test.ts`, `tests/pattern-suggestion-detector-meta.test.ts`, `tests/regex-discovery-dal.test.ts` — exact test style to mirror
- `vitest.config.ts` — framework config

### Secondary (HIGH confidence — planning artifacts)
- `.planning/phases/51-discovery-pipeline-reorder/51-CONTEXT.md` — D-01…D-05 (carried constraints)
- `.planning/phases/51-discovery-pipeline-reorder/51-RESEARCH.md`, `51-03-SUMMARY.md` — the service this phase extends
- `.planning/REQUIREMENTS.md` — RDISC-01…04 wording
- `.planning/ROADMAP.md` §Phase 52 — success criteria 1–4 + DoD test cases
- `CONTEXT.md` — Categorization vocabulary, CategorizationPattern / PatternSuggestion definitions
- `.claude/skills/regex-label/SKILL.md` — matcher-fidelity rule (Check 1 semantics)
- `CLAUDE.md` — layered architecture, server-only, Decimal.js (n/a here), English-dev-code constraints

---

## Project Constraints (from CLAUDE.md)

- **Layers:** queries in `lib/dal/` (new `getManuallyCategorizedHashes`), logic in `lib/services/` (the split + checks orchestration), pure util in `lib/utils/`. No inline SQL in services.
- **server-only:** `lib/utils/pattern-suggestions.ts` must NOT gain `server-only` (offline CLI imports it). Service + DAL keep `server-only`.
- **Monetary arithmetic:** N/A — discovery is description-only, `amount: null`. No Decimal.js needed.
- **Language:** dev code/comments/tests in English; Italian only in user-data fixtures (merchant tokens, sample descriptions). Run `yarn check:language` after touching tests/comments.
- **Migrations:** none — this phase adds no schema. (`expenseClassificationHistory` already exists.)
- **GSD execution:** follow the locked `52-*-PLAN.md`; no re-opening approach between tasks.

---

## Metadata

**Confidence breakdown:**
- SC-1/SC-2 distinction (residual emptiness): HIGH — derived directly from the inspected util
- Check 1 semantics: HIGH (code) / MEDIUM on exact requirement intent (A3)
- Check 2 (manual-history dedup + unique-constraint nuance): HIGH — schema + `applyTier2History` confirmed
- Output shape: HIGH — additive two-list, consumed by Phase 54/55
- Test strategy: HIGH — three existing Phase 51 tests are exact templates

**Research date:** 2026-06-16
**Valid until:** 2026-07-16 (stable domain; no fast-moving dependencies)
