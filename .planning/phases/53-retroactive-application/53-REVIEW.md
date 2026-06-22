---
phase: 53-retroactive-application
reviewed: 2026-06-16T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - tests/pattern-application.test.ts
  - lib/dal/regex-discovery.ts
  - lib/dal/files.ts
  - lib/services/pattern-application.ts
  - tests/regex-discovery-dal.test.ts
  - lib/validations/pattern.ts
  - lib/actions/patterns.ts
  - tests/pattern-actions.test.ts
  - app/(app)/import/[fileId]/suggestions/page.tsx
  - components/import/suggestion-section.tsx
  - components/import/suggestion-card.tsx
  - components/import/suggestion-promote-form.tsx
  - tests/suggestion-card.test.tsx
  - tests/suggestion-promote-form.test.tsx
  - tests/import-suggestions-page.test.tsx
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 53: Code Review Report

**Reviewed:** 2026-06-16
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

This phase adds a platform-scoped retroactive pattern apply path (`applyNewPatternToPlatformExpenses`) invoked from `promoteSuggestionAction`, along with the `SuggestionSection`/`SuggestionCard`/`SuggestionPromoteForm` UI components and the suggestions page. The feature is architecturally sound — auth is enforced before platform resolution, the `promoteSuggestionAction` never reads `confidence` from FormData, and the apply failure path is correctly non-fatal. However, two critical correctness defects exist: a normalizer mismatch between the test mock and the production code that silently under-tests the regex match loop, and a `descriptionStripPattern` gap in the new apply path that means Fineco-class platforms will produce different results in discovery vs. retroactive apply. Several warnings cover stale comments, a dead component prop, an unused exported schema, and a double platform resolution in the suggestions page.

## Critical Issues

### CR-01: Test mock for `normalizeDescription` diverges from production — match-count assertions are unreliable

**File:** `tests/pattern-application.test.ts:55-61`

**Issue:** The test file mocks `normalizeDescription` as:

```ts
(title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9\s*]/g, '')
    .trim()
```

The real implementation at `lib/utils/import.ts:67-72` is:

```ts
return String(description ?? '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLocaleLowerCase('it-IT')
```

The key differences:
- The mock **strips all non-alphanumeric characters** (the `replace(/[^a-z0-9\s*]/g, '')` call). The real function does **not** strip them; it only collapses whitespace.
- The mock uses `toLowerCase()`; the real function uses `toLocaleLowerCase('it-IT')`.

Impact: any title containing characters like `-`, `.`, `(`, `)`, `'`, accented letters, or similar will normalize differently. The filter in `applyNewPatternToPlatformExpenses` operates on `normalizeDescription(e.title)`, so the mock produces a different candidate string than production does. The numeric-stripped dual-match test (`exp-num-1` / `exp-num-2`) passes only because the test fixtures happen to consist of ASCII alphanumerics that are unchanged by both normalizers. A real bank title such as `"Bonif. SEPA - Netflix S.r.l."` would produce `"bonif sepa  netflix srl"` via the mock vs. `"bonif. sepa - netflix s.r.l."` via production. A pattern like `netflix s.r.l.` that should match in production would not match under the mock, and vice versa.

**Fix:** Remove the mock and let `normalizeDescription` run as the real implementation. Since `lib/utils/import.ts` does not have a `server-only` guard, it can be imported directly in tests. Add a `vi.unmock` call for that module or simply remove the module from the `vi.mock` block:

```ts
// Remove this entire vi.mock block from pattern-application.test.ts
// vi.mock('@/lib/utils/import', () => ({ ... }))
// The real normalizeDescription has no server dependencies.
```

---

### CR-02: `applyNewPatternToPlatformExpenses` ignores `descriptionStripPattern` — match behavior diverges from discovery for Fineco-class platforms

**File:** `lib/services/pattern-application.ts:168-178`

**Issue:** The discovery pipeline (`lib/services/regex-discovery.ts:85-101`) applies `descriptionStripPattern` from the platform before calling `normalizeDescription`, producing the normalized form that becomes the basis for generated patterns. The apply path in `applyNewPatternToPlatformExpenses` does **not** apply `descriptionStripPattern` — it normalizes raw `e.title` directly:

```ts
// Current (lines 168-178) — no strip applied:
const normalized = normalizeDescription(e.title)
const stripped = normalized.split(/\s+/).filter(t => ...)...
return regex.test(normalized) || regex.test(stripped)
```

`getUncategorizedExpensesForPlatformApply` selects only `{ id, title, totalAmount }` — it does **not** fetch `platform.descriptionStripPattern`. A pattern like `"data operazione"` generated from a Fineco title `"***** INTESA SP 114 data operazione"` only matches because the strip removes the Intesa-SP boilerplate before discovery clustering. During retroactive apply, the raw title is tested directly, and the pattern will also match (because the numeric-token stripping in the apply loop coincidentally removes `114`), but if the platform strip pattern removes a *prefix* rather than a numeric token, the apply-side match will fail for expenses that were correctly suggested during discovery.

The legacy `applyNewPatternToExpenses` has the same gap, but it predates the suggestion pipeline. Since `applyNewPatternToPlatformExpenses` is explicitly positioned as the write-path mirror of the discovery read path, the gap is a correctness defect on the promoted path.

**Fix:** Extend `getUncategorizedExpensesForPlatformApply` to also select `platform.descriptionStripPattern` (matching the `getUncategorizedExpensesForDiscovery` projection), then apply it in `applyNewPatternToPlatformExpenses` before `normalizeDescription`:

```ts
// In getUncategorizedExpensesForPlatformApply — add to select:
descriptionStripPattern: platform.descriptionStripPattern,

// In applyNewPatternToPlatformExpenses — apply before normalize:
const rawTitle = e.title
const preStripped = e.descriptionStripPattern
  ? rawTitle.replace(new RegExp(e.descriptionStripPattern, 'i'), '').trim()
  : rawTitle
const normalized = normalizeDescription(preStripped)
const stripped = normalized.split(/\s+/).filter(t => t.length > 0 && !/^\d+$/.test(t)).join(' ')
return regex.test(normalized) || regex.test(stripped)
```

---

## Warnings

### WR-01: `platformId` prop accepted by `SuggestionCard` but silently discarded

**File:** `components/import/suggestion-card.tsx:20`

**Issue:** The component signature accepts `platformId` and immediately aliases it to `_platformId`:

```ts
export function SuggestionCard({ suggestion, categories, fileId, platformId: _platformId, ... }: Props)
```

`platformId` is not forwarded to `SuggestionPromoteForm`. The action resolves `platformId` server-side from `fileId` (via `getPlatformIdForUserFile`), so this does not currently break anything. However, the prop flowing from `SuggestionSection` → `SuggestionCard` creates a false expectation in the reader that the card is doing something with it. If a future developer assumes `platformId` is passed to the form (as a hidden input for speed), they will be wrong.

**Fix:** Remove `platformId` from the `Props` type and the destructuring parameter in `SuggestionCard`, and from `SuggestionSection`'s call site. If platform display is needed in the future, re-introduce it with explicit intent.

---

### WR-02: Stale comment in `SuggestionPromoteForm` — claims `confidence` is hardcoded to `1` server-side

**File:** `components/import/suggestion-promote-form.tsx:61`

**Issue:** The comment reads:
```
confidence is NOT sent — hardcoded to 1 server-side (T-39-09).
```

The server action (`lib/actions/patterns.ts:256,273`) uses `confidence: 1` only as a placeholder to pass `CreatePatternSchema` validation (which requires `min(0).max(1)`), then immediately overrides it with `confidence: 0.85` in the `createPattern` call. The effective stored value is `0.85`, not `1`. The test at `tests/pattern-actions.test.ts:358-360` correctly asserts `0.85`. The comment misleads any reader of the component.

**Fix:** Update the comment to accurately state what happens:
```ts
// confidence is NOT sent — Server Action hardcodes 0.85 per D-01 (ignores any client value)
```

---

### WR-03: `promoteSuggestionAction` passes `confidence: 1` to `CreatePatternSchema` as a workaround, creating an unnecessary schema bypass

**File:** `lib/actions/patterns.ts:252-258`

**Issue:** `CreatePatternSchema.safeParse` is called with `confidence: 1` — a sentinel value chosen to satisfy the `z.number().min(0).max(1)` constraint. The actual business rule (D-01) is that confidence on promoted suggestions is `0.85`. This means:
1. The schema validates a value (`1`) that will never be persisted.
2. The pattern `confidence: 1` in the parse call is a latent source of confusion if anyone reads it and assumes `1` is the intended value.

The cleaner fix is to omit confidence from the parse object entirely (use a schema that does not require it) or to pass `0.85` directly to both the schema and the `createPattern` call.

**Fix:** Parse only the trusted client fields using a dedicated schema that omits `confidence`:

```ts
const PromoteFormSchema = CreatePatternSchema.omit({ confidence: true })
const parsed = PromoteFormSchema.safeParse({
  pattern: formData.get("pattern"),
  subCategoryId: subCategoryIdRaw,
  description: undefined,
})
// Then createPattern with confidence: 0.85 hardcoded
```

---

### WR-04: `UpdatePatternClientSchema` is exported from `lib/validations/pattern.ts` but never consumed

**File:** `lib/validations/pattern.ts:73-79`

**Issue:** `UpdatePatternClientSchema` and its inferred type `UpdatePatternClientInput` are defined and exported but not imported anywhere in `lib/actions/patterns.ts` or in any other reviewed or visible file. The `updatePatternAction` uses `UpdatePatternSchema` (not the client variant). Dead exports increase the maintenance surface and mislead future readers into thinking this schema is the standard update path.

**Fix:** Either use `UpdatePatternClientSchema` in `updatePatternAction` (replacing `UpdatePatternSchema`) as the schema clearly documents the intent, or remove the export if there is no planned consumer.

---

## Info

### IN-01: Dead function `makeQueryChain` in `tests/regex-discovery-dal.test.ts`

**File:** `tests/regex-discovery-dal.test.ts:25-43`

**Issue:** The function `makeQueryChain(finalValue)` is defined at line 25 but never called. The file uses `makeQueryChainWithFixture` (defined at line 92) for all actual chains. `makeQueryChain` is unreachable dead code.

**Fix:** Remove `makeQueryChain` (lines 25-43).

---

### IN-02: `suggestion-promote-form.tsx` comment references removed ADR (ADR 0008)

**File:** `components/import/suggestion-promote-form.tsx:60`

**Issue:** The comment `amountSign is intentionally NOT sent — the Server Action derives it server-side (ADR 0008)` references a decision that was superseded by ADR 0012 (Phase 46: patterns are sign-agnostic; `amountSign` field removed entirely). `amountSign` is no longer derived anywhere server-side — it simply does not exist. The comment now describes phantom behavior.

**Fix:** Replace with:
```ts
// amountSign removed — Phase 46: patterns are sign-agnostic (ADR 0012, supersedes ADR 0008)
// confidence is NOT sent — Server Action hardcodes 0.85 per D-01
```

---

### IN-03: `suggestions/page.tsx` calls `getPlatformIdForUserFile` twice (once directly, once via `getFileForUser` indirect chain is fine — but explicit double call is wasteful)

**File:** `app/(app)/import/[fileId]/suggestions/page.tsx:23-31`

**Issue:** The page calls `getFileForUser` to validate ownership + status, then calls `getPlatformIdForUserFile` separately. Both make a DB round-trip for overlapping data (the file record is fetched twice through different projections). The `platformId` is not available on `FileRow` directly, but this pattern means two queries hit the same file row within the same request with no caching.

This is a performance observation (explicitly out of v1 scope), raised here only because `getPlatformIdForUserFile` is also called at the action layer (inside `promoteSuggestionAction`) for each form submission. The data flow is correct; the duplication is a quality concern.

**Fix (optional):** Extend `getFileForUser` to optionally join the platform chain and return `platformId` alongside the file row, or accept that two queries is acceptable for this page.

---

_Reviewed: 2026-06-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
