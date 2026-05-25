---
phase: 33-pattern-suggestion-detector
reviewed: 2026-05-22T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - lib/utils/pattern-suggestions.ts
  - tests/pattern-suggestion-detector.test.ts
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 33: Code Review Report

**Reviewed:** 2026-05-22
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Two files reviewed: the `detectPatternSuggestions` utility (`lib/utils/pattern-suggestions.ts`) and its Vitest test suite. The implementation is clean, imports only `decimal.js`, correctly applies Decimal.js for amount-sign inference, and follows project conventions (no `server-only`, no `lib/services/` imports, empty-catch per convention).

One correctness bug: when a bucket contains an outlier row that collapses the global prefix below 2 tokens, the entire bucket is silently discarded — including valid subgroups of 2+ rows that share a qualifying prefix. This is a logic gap against the ADR contract ("a suggestion is emitted when ≥2 descriptions share a common prefix of ≥2 tokens"). The tests do not cover this case, so the failure is invisible to the suite.

One secondary logic issue: `amountSignMatches` returns `true` on a null amount regardless of the coverage pattern's `amountSign`, which means a null-amount row is never excluded by coverage — it always passes through. This is documented intent in a comment but is semantically incorrect: a null-amount row cannot confirm it belongs to a pattern with `amountSign: 'negative'`, yet it is never filtered out.

One test reliability gap: `ANL-02` does not assert that the 3 sample descriptions are distinct.

---

## Critical Issues

### CR-01: Bucket outlier silently discards valid subgroup suggestions

**File:** `lib/utils/pattern-suggestions.ts:126-133`

**Issue:** The grouping loop computes the longest common prefix across ALL members of a first-token bucket. If any single outlier row reduces the global prefix below 2 tokens, the entire bucket is dropped with `continue` — including valid subgroups of 2+ rows that share a qualifying 2-token prefix.

Concrete example: bucket `"pagamento"` contains rows with stripped tokens:
- A: `["pagamento", "pos", "market"]`
- B: `["pagamento", "pos", "supermarket"]`
- C: `["pagamento", "spesa", "farmacia"]`

After intersecting all three, `prefix = ["pagamento"]` (length 1). The bucket is discarded. No suggestion is emitted for the A+B pair, which legitimately shares `"pagamento pos"`.

The ADR contract states: "a suggestion is emitted when ≥2 uncategorized descriptions share a common prefix of ≥2 tokens." This guarantee is violated when a bucket contains a divergent outlier.

The fix is to detect valid subgroups rather than discarding the whole bucket. One correct approach: after the global prefix falls below 2, identify the prefix that applies to the maximal qualifying subgroup (the prefix computed before the outlier was encountered), emit that subgroup's suggestion, and drop outliers from it.

```ts
// Replace Step 3 loop body with subgroup-aware emission:
for (const group of buckets.values()) {
  if (group.length < 2) continue

  let prefix = group[0].tokens
  let qualifyingCount = 1

  for (let i = 1; i < group.length; i++) {
    const candidate = longestCommonPrefix(prefix, group[i].tokens)
    if (candidate.length >= 2) {
      prefix = candidate
      qualifyingCount++
    }
    // else: this member diverges — stop extending; remaining members may still share
    // the current prefix, but the simple single-pass algorithm stops here.
  }

  if (qualifyingCount < 2 || prefix.length < 2) continue

  const prefixString = prefix.join(' ')
  const escaped = escapeRegex(prefixString)
  // Collect only members that actually share the emitted prefix
  const matching = group.filter(c =>
    c.tokens.length >= prefix.length &&
    prefix.every((t, idx) => c.tokens[idx] === t)
  )
  if (matching.length < 2) continue

  const amounts = matching.map(g => g.row.amount)
  const sampleDescriptions = matching.slice(0, 3).map(g => g.row.description)

  suggestions.push({
    pattern: escaped,
    matchCount: matching.length,
    detectedAmountSign: inferAmountSign(amounts),
    sampleDescriptions,
  })
}
```

Note: a fully correct fix that emits ALL qualifying subgroups (not just the maximal one) is more complex. The above gives at minimum the correct primary suggestion per bucket. The ADR does not specify subgroup exhaustion — it says "a suggestion is emitted when ≥2 descriptions share a common prefix", implying one suggestion per group is sufficient.

---

## Warnings

### WR-01: `amountSignMatches` treats null amount as always-covered, bypassing sign-specific coverage

**File:** `lib/utils/pattern-suggestions.ts:36`

**Issue:** `amountSignMatches` returns `true` when `amount === null`, regardless of the `amountSign` filter (`'positive'` or `'negative'`). This means a row with a null amount is always excluded from suggestion grouping by any coverage pattern — even a sign-specific one that should logically not apply.

```ts
// Current:
if (amount === null) return true   // line 36

// Consequence: a coverage pattern { pattern: 'pagamento', amountSign: 'negative' }
// will exclude rows where amount is null, even though null amount gives no
// evidence the row belongs to the negative-sign category.
```

The comment says "defensive: do not lose row to bad data", but the effect is the opposite for null — it loses rows that should surface as suggestions. The correct defensive behavior for `null` is to NOT match a sign-specific pattern: if we cannot determine the sign, we cannot confirm coverage.

```ts
// Fix: treat null as non-matching for sign-specific patterns
function amountSignMatches(
  amountSign: 'positive' | 'negative' | 'any',
  amount: string | null,
): boolean {
  if (amountSign === 'any') return true
  if (amount === null) return false  // cannot confirm sign — do not claim coverage
  try {
    const d = new Decimal(amount)
    if (amountSign === 'positive') return d.greaterThanOrEqualTo(0)
    if (amountSign === 'negative') return d.lessThan(0)
  } catch {
    return false  // unparseable — same logic: cannot confirm coverage
  }
  return false
}
```

Note: this change also affects the `catch` path (currently `return true`, which has the same problem as `null` — an unparseable amount is treated as matching any coverage pattern). The fix returns `false` in the catch block for the same reason.

### WR-02: `amountSignMatches` catch path returns `true`, treats unparseable amounts as always-covered

**File:** `lib/utils/pattern-suggestions.ts:41-44`

**Issue:** When `new Decimal(amount)` throws (unparseable amount string), the function returns `true`. This causes `isCoveredByPatterns` to report a false-positive match for any sign-specific coverage pattern, excluding the row from suggestion grouping.

```ts
// Current:
  } catch {
    // unparseable amount — treat as match (defensive: do not lose row to bad data)
  }
  return true   // line 44 — reached after catch, causes false-positive coverage
```

The comment is misleading: "do not lose row to bad data" would mean NOT claiming coverage (return `false`), so the row remains in suggestion grouping. Returning `true` does the opposite — it removes the row from suggestions under a false coverage claim.

```ts
// Fix: return false after catch so unparseable amounts do not suppress suggestions
  } catch {
    // unparseable amount — cannot confirm coverage, do not exclude row
    return false
  }
```

Note: this is the same root issue as WR-01 and the fix is the same function change. Combined, both WR-01 and WR-02 should be resolved in a single edit to `amountSignMatches`.

---

## Info

### IN-01: Test `ANL-02` does not assert sample descriptions are distinct

**File:** `tests/pattern-suggestion-detector.test.ts:126-130`

**Issue:** The test iterates `sampleDescriptions` and checks each against a set of 5 valid values, but does not verify the 3 samples are distinct. An implementation that returns `['PAGAMENTO POS A', 'PAGAMENTO POS A', 'PAGAMENTO POS A']` would pass all assertions.

```ts
// Current (does not catch duplicates):
for (const desc of s.sampleDescriptions) {
  expect([...]).toContain(desc)
}

// Fix: add uniqueness assertion
expect(new Set(s.sampleDescriptions).size).toBe(s.sampleDescriptions.length)
```

---

_Reviewed: 2026-05-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
