---
phase: 35-import-review-promotion
reviewed: 2026-05-23T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - app/(app)/import/[fileId]/analyze/page.tsx
  - components/import/import-preview.tsx
  - components/import/suggestion-card.tsx
  - components/import/suggestion-promote-form.tsx
  - components/import/suggestion-section.tsx
  - lib/actions/patterns.ts
  - tests/__mocks__/server-only.ts
  - tests/import-analyze-page.test.tsx
  - tests/import-preview-ui.test.tsx
  - tests/pattern-actions.test.ts
  - tests/suggestion-card.test.tsx
  - tests/suggestion-promote-form.test.tsx
findings:
  critical: 3
  warning: 3
  info: 2
  total: 8
status: issues_found
---

# Phase 35: Code Review Report

**Reviewed:** 2026-05-23
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 35 introduces the pattern-suggestion promotion flow: `SuggestionSection`, `SuggestionCard`, `SuggestionPromoteForm`, `promoteSuggestionAction`, and the wiring of `getCategories` into `AnalyzePage`. The security model (confidence hardcoded server-side, userId from session only) is correctly implemented and well-tested. The auth guard structure in all four Server Actions is sound.

Three critical issues were found: a broken "promoted" state that can be bypassed via keyboard (form button is not actually disabled after promotion), a potential pattern-string misparse when transaction descriptions start with a forward slash, and a missing unique constraint on `userId` in the DB schema that causes opaque cross-user errors. Three warnings cover an unstable callback reference that creates a subtle race condition, a test coverage gap on `refresh()`, and an incorrect duplicate-pattern error message surfaced to the user.

---

## Critical Issues

### CR-01: Promoted state does not disable the submit button — keyboard re-submission possible

**File:** `components/import/suggestion-card.tsx:68`, `components/import/suggestion-promote-form.tsx:112`

**Issue:** After a successful promotion, `SuggestionCard` wraps the form in `opacity-50 pointer-events-none`. This prevents mouse clicks but has **no effect on keyboard users**. The submit button inside `SuggestionPromoteForm` is `disabled={isPending || !subCategoryId}`. After promotion completes, `isPending` is `false` and `subCategoryId` still holds the last selected value (non-empty string), so the button is **not disabled**. A user can Tab to the button and press Space/Enter to re-submit the form.

The DB unique constraint on `(pattern, subCategoryId, amountSign)` will catch the duplicate, but without `userId` in that constraint (see CR-03), it also means two users with the same pattern selection would fail with the same opaque generic error.

**Fix:** Pass a `disabled` prop from `SuggestionCard` into `SuggestionPromoteForm` and apply it to the button:

```tsx
// suggestion-promote-form.tsx
type Props = {
  suggestion: PatternSuggestion
  categories: CategoryWithSubCategories[]
  onPromoted: () => void
  disabled?: boolean          // <-- add
}

// button line:
<Button
  type="submit"
  size="sm"
  className="self-start"
  disabled={isPending || !subCategoryId || disabled}  // <-- add disabled
>
```

```tsx
// suggestion-card.tsx
<SuggestionPromoteForm
  suggestion={suggestion}
  categories={categories}
  onPromoted={() => setPromoted(true)}
  disabled={promoted}          // <-- pass promoted state
/>
```

This makes the `pointer-events-none` wrapper redundant (keep it for visual polish, but the button is now actually inoperable).

---

### CR-02: Pattern strings starting with `/` are silently misparsed by `normalizePatternInput`

**File:** `lib/utils/pattern-suggestions.ts:137`, `lib/validations/pattern.ts:15-26`

**Issue:** `detectPatternSuggestions` constructs patterns by joining stripped tokens with a space and running `escapeRegex`. `escapeRegex` does **not** escape the forward slash character `/` (it is not in the character class `[.*+?^${}()|[\]\\]`). If any transaction description produces a first token that begins with `/` (e.g., `/transfer`, `/payment`), the joined prefix string starts with `/`.

`normalizePatternInput` has special handling for strings that start with `/` — it looks for the last `/` to parse the string as a regex literal. If the string is `/transfer something`, `lastIndexOf('/')` returns `0`, so the condition `closingSlashIndex > 0` is `false` and the branch is skipped. The full string including the leading `/` is used as the regex source. The resulting regex matches only descriptions that literally start with `/`, which is wrong — the leading slash was part of the description token, not a regex delimiter.

The result: the promoted pattern in the DB is incorrect and will never match anything.

**Fix:** Add `/` to the `escapeRegex` character class in `pattern-suggestions.ts`:

```ts
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')
}
```

This escapes any literal `/` in a description token, producing `\/transfer` which correctly matches the literal slash in the source text, and `normalizePatternInput` will not misinterpret it as a regex delimiter.

---

### CR-03: Unique constraint on `categorization_pattern` is missing `userId` — cross-user creation fails with a generic error

**File:** `lib/actions/patterns.ts:167-172` (catch block in `promoteSuggestionAction`)

**Issue:** The DB schema defines `unique("categorization_pattern_unique").on(table.pattern, table.subCategoryId, table.amountSign)` — `userId` is absent. This makes the uniqueness constraint **global across all users**. If User A has already created (or a system pattern matches) the same `(pattern, subCategoryId, amountSign)` triple, User B's `promoteSuggestionAction` call will throw a Postgres unique-violation error. The catch block in `promoteSuggestionAction` only special-cases `/invalid/i`; a unique-violation message (`duplicate key value violates unique constraint`) does not match that regex, so User B sees:

> "Si è verificato un errore. Riprova tra qualche secondo."

This is misleading — the user would assume a transient infrastructure failure and keep retrying, but the operation can never succeed.

The missing `userId` in the constraint also means system patterns (`userId IS NULL`) and user patterns share the same uniqueness space, which is likely unintentional.

**Fix (action layer — independent of the schema fix):** Detect the unique violation explicitly so the user receives an actionable message:

```ts
} catch (err) {
  if (err instanceof Error && /invalid/i.test(err.message)) {
    return { error: "Pattern regex non valido." }
  }
  if (err instanceof Error && /unique.*constraint|duplicate key/i.test(err.message)) {
    return { error: "Un pattern identico esiste già." }
  }
  return { error: "Si è verificato un errore. Riprova tra qualche secondo." }
}
```

Apply the same fix to `createPatternAction`. The schema's unique constraint should also be revised to include `userId` to scope uniqueness per user (schema change out of scope for this action file, but the action-layer guard is in scope).

---

## Warnings

### WR-01: `onPromoted` callback recreated on every render creates a subtle effect-trigger race

**File:** `components/import/suggestion-card.tsx:72`, `components/import/suggestion-promote-form.tsx:37-42`

**Issue:** `SuggestionCard` passes `onPromoted={() => setPromoted(true)}` as an inline arrow function. This creates a new function reference on every render. `SuggestionPromoteForm`'s `useEffect` lists `[state, onPromoted]` as dependencies. If `SuggestionCard` re-renders for any reason (e.g., parent state update in `ImportPreview`) between the moment `submittedRef.current = true` is set (form submission) and the moment the Server Action response arrives, the effect fires with the new `onPromoted` reference. At that point `submittedRef.current` is `true` and `state.error` is still `null` (initial value, not yet updated by the action). The guard fires incorrectly: `onPromoted()` is called with stale initial state, setting `promoted = true` before the action has actually succeeded.

**Fix:** Stabilize the callback with `useCallback` in `SuggestionCard`:

```tsx
import { useCallback, useState } from 'react'

const handlePromoted = useCallback(() => setPromoted(true), [])

// ...
<SuggestionPromoteForm
  suggestion={suggestion}
  categories={categories}
  onPromoted={handlePromoted}
/>
```

---

### WR-02: `refresh()` call in `revalidateCategorizationSurfaces` is never asserted in tests

**File:** `tests/pattern-actions.test.ts:19-22`, `lib/actions/revalidation.ts:11`

**Issue:** The `vi.mock('next/cache')` factory provides `refresh: vi.fn()` as an anonymous mock (not stored in the `mocks` object). No test asserts that `refresh()` was or was not called. The `expectExactCategoryRevalidationRoutes()` helper only checks `revalidatePath` calls. If `refresh()` were accidentally removed from `revalidateCategorizationSurfaces`, all tests would continue to pass.

**Fix:** Add `refresh` to the `mocks` object and assert it was called in the success paths:

```ts
const mocks = vi.hoisted(() => ({
  // ...
  refresh: vi.fn(),
}))

vi.mock('next/cache', () => ({
  refresh: mocks.refresh,
  revalidatePath: mocks.revalidatePath,
}))

// In expectExactCategoryRevalidationRoutes or a separate helper:
expect(mocks.refresh).toHaveBeenCalledOnce()
```

---

### WR-03: Unique-violation on duplicate pattern promote produces misleading generic error

**File:** `lib/actions/patterns.ts:169-173`

**Issue:** This overlaps with CR-03 but the warning aspect is separate from the schema gap: even if the schema is fixed to include `userId`, a user who double-submits the same suggestion form (which CR-01 permits via keyboard) will get `"Si è verificato un errore. Riprova tra qualche secondo."` instead of a meaningful message like "Hai già creato questo pattern." The catch block's `/invalid/i` check is too narrow; unique-violation errors from Postgres/Drizzle contain `duplicate key value violates unique constraint` which does not match.

**Fix:** See fix listed under CR-03.

---

## Info

### IN-01: `result.data &&` redundant guard after notFound() already enforces non-null

**File:** `app/(app)/import/[fileId]/analyze/page.tsx:76`

**Issue:** At line 72-74, `if (!result.data) { notFound() }` already guarantees `result.data` is non-null below that point. Line 76 still reads `Boolean(result.data && isUnknownFormatAnalysis(result.data))`. The `result.data &&` part is dead code.

**Fix:**
```tsx
const isUnknownFormat = isUnknownFormatAnalysis(result.data)
```

---

### IN-02: Test fixture `baseResult` in `import-preview-ui.test.tsx` includes fields not in `ImportAnalysisResult`

**File:** `tests/import-preview-ui.test.tsx:26-27`

**Issue:** `baseResult` includes `createdCount: 0` and `skippedCount: 0`. These fields do not exist in `ImportAnalysisResult` (which has `rowCount` and `duplicateCount` only). TypeScript in strict mode should flag this if the fixture were typed as `ImportAnalysisResult`, but because `createElement(ImportPreview, { result: baseResult, ... })` uses structural typing at the call site, it may pass. The extra fields are noise that could mislead future maintainers about the actual type shape.

**Fix:** Remove the two extra fields from `baseResult`:
```ts
const baseResult = {
  fileId: '11111111-1111-4111-8111-111111111111',
  formatVersionId: null,
  platformName: null,
  rowCount: 12,
  duplicateCount: 0,
  warnings: [],
  errors: [],
  sampleRows: [],
  patternSuggestions: [],
}
```

Optionally annotate: `const baseResult: ImportAnalysisResult = { ... }` to get compile-time shape verification.

---

_Reviewed: 2026-05-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
