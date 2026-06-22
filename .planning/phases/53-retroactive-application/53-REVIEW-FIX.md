---
phase: 53-retroactive-application
fixed_at: 2026-06-16T17:44:33Z
review_path: .planning/phases/53-retroactive-application/53-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 53: Code Review Fix Report

**Fixed at:** 2026-06-16T17:44:33Z
**Source review:** .planning/phases/53-retroactive-application/53-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (2 Critical + 4 Warning)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: Remove divergent `normalizeDescription` mock in pattern-application tests

**Files modified:** `tests/pattern-application.test.ts`
**Commit:** 22393bb
**Applied fix:** Removed the `vi.mock('@/lib/utils/import', ...)` block that used a different
normalizer (stripping non-alphanumeric chars + `toLowerCase`) from the real implementation
(collapse whitespace + `toLocaleLowerCase('it-IT')`). The real function has no `server-only`
guard and can be imported directly in tests. Also updated the stale comment in the
numeric-stripped dual-match test that described the old mock behavior. Updated all fixture
objects in the test to include `descriptionStripPattern: null` (required by the CR-02 fix
that added this field to `UncategorizedExpenseForPlatformApply`).

---

### CR-02: Apply `descriptionStripPattern` in platform apply path to match discovery pipeline

**Files modified:** `lib/dal/regex-discovery.ts`, `lib/services/pattern-application.ts`, `tests/pattern-application.test.ts`
**Commit:** 7ca2138
**Applied fix:**
- Extended `UncategorizedExpenseForPlatformApply` type to include `descriptionStripPattern: string | null`.
- Added `descriptionStripPattern: platform.descriptionStripPattern` to the `select` in `getUncategorizedExpensesForPlatformApply`, mirroring `getUncategorizedExpensesForDiscovery`.
- Updated `applyNewPatternToPlatformExpenses` filter loop to apply `descriptionStripPattern` via `rawTitle.replace(new RegExp(...), '').trim()` before calling `normalizeDescription`, exactly mirroring the discovery pipeline. Patterns generated from Fineco-class platforms that strip boilerplate prefixes now produce consistent matches on both read (discovery) and write (apply) paths.
- Updated test fixtures to include `descriptionStripPattern: null` (null = no strip, which preserves all existing test assertions).

---

### WR-01: Remove dead `platformId` prop from `SuggestionCard` and `SuggestionSection`

**Files modified:** `components/import/suggestion-card.tsx`, `components/import/suggestion-section.tsx`, `app/(app)/import/[fileId]/suggestions/page.tsx`, `tests/suggestion-card.test.tsx`
**Commit:** 6a57549
**Applied fix:** Removed `platformId` from `SuggestionCard`'s Props type and destructuring
(the action resolves it server-side from `fileId`). Removed `platformId` from
`SuggestionSection`'s Props and its call to `SuggestionCard`. Removed the `platformId` prop
from the page's render of `SuggestionSection`. Removed `platformId: 2` from
`defaultProps` in `tests/suggestion-card.test.tsx`.

---

### WR-02: Fix stale `confidence` comment in `SuggestionPromoteForm`

**Files modified:** `components/import/suggestion-promote-form.tsx`
**Commit:** e91f829
**Applied fix:** Updated both stale comments in the JSX comment block. The `amountSign`
comment (IN-02 / info-severity — addressed as part of the same two-line block) was updated
from the removed ADR 0008 reference to reflect Phase 46 (ADR 0012, sign-agnostic).
The `confidence` comment was corrected from "hardcoded to 1 server-side (T-39-09)"
to "Server Action hardcodes 0.85 per D-01" — matching the actual behavior confirmed by
the test at `tests/pattern-actions.test.ts:358-360`.

---

### WR-03: Use `PromoteFormSchema` (no sentinel `confidence: 1`) in `promoteSuggestionAction`

**Files modified:** `lib/actions/patterns.ts`
**Commit:** b369b7a
**Applied fix:** Defined `PromoteFormSchema = CreatePatternSchema.omit({ confidence: true })`
inline in `promoteSuggestionAction` and replaced the `CreatePatternSchema.safeParse({..., confidence: 1, ...})`
call with `PromoteFormSchema.safeParse({...})` (no `confidence` field). The `createPattern`
call retains `confidence: 0.85` hardcoded as before. This eliminates the sentinel value `1`
that was never persisted and was a latent source of confusion.

---

### WR-04: Use `UpdatePatternClientSchema` in `updatePatternAction` — prevent client-controlled confidence

**Files modified:** `lib/actions/patterns.ts`, `tests/pattern-actions.test.ts`
**Commit:** 0453e80
**Applied fix:** Replaced `UpdatePatternSchema` with `UpdatePatternClientSchema` (which omits
`confidence`) in `updatePatternAction`. Removed the `confidenceRaw` formData read and the
`confidence: ...` field from the parse call. The DAL's `updatePattern` handles missing
`confidence` gracefully (partial update). Updated tests:
- Changed the "passes canonical schema output" assertion to not expect `confidence` in the DAL call.
- Changed the "returns validation errors for invalid confidence" test to confirm that client
  confidence values are silently dropped (action succeeds, DAL receives no `confidence`).

---

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-06-16T17:44:33Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
