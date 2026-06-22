---
phase: 52-regex-validity-and-dedup
status: clean
reviewed_at: 2026-06-16T13:41:00Z
depth: standard
files_reviewed: 10
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
review_mode: inline
---

# Phase 52 Code Review

## Scope

Reviewed source and test files changed by Phase 52:

- `components/dashboard/overview/overview-movers-panel.tsx`
- `lib/dal/regex-discovery.ts`
- `lib/services/regex-discovery.ts`
- `lib/utils/pattern-suggestions.ts`
- `tests/fixtures/v2-taxonomy-manifest.ts`
- `tests/pattern-suggestion-detector-meta.test.ts`
- `tests/regex-discovery-dal.test.ts`
- `tests/regex-discovery-service.test.ts`
- `tests/subcategory-picker.test.tsx`
- `tests/suggestion-promote-form.test.tsx`

## Result

No open findings.

## Checks

- `descriptionHashes` passthrough is additive and preserves existing clustering guards.
- `candidateCoveredByExistingPattern` mirrors the existing full plus numeric-stripped active-pattern matcher and swallows invalid regex patterns.
- `getManuallyCategorizedHashes` is server-only, user-scoped, source=`manual`, uses `expenseClassificationHistory`, filters non-null `descriptionHash`, and short-circuits empty input.
- `discoverRegexCandidates` returns the additive two-list result shape, routes by `residualVariablePart.trim()`, applies Check 1 to regex families, and applies Check 2 to both output lists with any-member skip semantics.
- Comment-only language-gate changes do not alter runtime behavior.

## Fixed During Review

`tests/pattern-suggestion-detector-meta.test.ts` helper `rowMeta()` did not provide a default `descriptionHash`, which made the returned object incompatible with the required `PatternDetectorRowWithMeta.descriptionHash: string | null` type under `yarn tsc --noEmit`.

Fixed in commit `b807c29` by defaulting `descriptionHash` to `null`.

## Verification

- `yarn test tests/pattern-suggestion-detector-meta.test.ts` passed after the fix.
- `yarn tsc --noEmit` no longer reports any Phase 52 files; remaining errors are pre-existing in `tests/cascade-options.test.ts` and `tests/category-combobox.test.tsx`.

