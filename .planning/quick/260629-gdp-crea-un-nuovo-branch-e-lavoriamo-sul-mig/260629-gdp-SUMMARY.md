---
status: complete
---

# Quick Task 260629-gdp — Summary

## Done

- Branch `quick/pattern-suggestions-nav` created from `origin/main`.
- Suggestions page (`/import/[fileId]/suggestions`) now always shows **Torna alle importazioni** linking to `/import`.
- After the last regex pattern is promoted, the user is redirected automatically to the import list.
- Single-categorization suggestions (read-only) do not trigger auto-redirect.

## Files changed

- `app/(app)/import/[fileId]/suggestions/page.tsx` — back link in header
- `components/import/suggestion-section.tsx` — redirect logic + `shouldRedirectToImportList` helper
- `components/import/suggestion-card.tsx` — `onRegexPromoted` callback
- `tests/import-suggestions-page.test.tsx` — back link + `useRouter` mock
- `tests/suggestion-section.test.tsx` — redirect helper unit tests

## Verification

- `yarn vitest run tests/import-suggestions-page.test.tsx tests/suggestion-section.test.tsx` — 16 passed
