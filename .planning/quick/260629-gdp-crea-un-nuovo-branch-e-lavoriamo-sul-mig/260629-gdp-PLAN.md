# Quick Task 260629-gdp: Pattern suggestions navigation UX

**Branch:** `quick/pattern-suggestions-nav`

## Goal

On `/import/[fileId]/suggestions`, users get stuck after classifying all regex patterns. Add a persistent back link to the import list and auto-redirect when every regex candidate has been promoted.

## Tasks

### 1. Back link on suggestions page
- Add `Torna alle importazioni` button (ghost/outline) in page header, matching analyze/configure pages.
- Use `APP_ROUTES.import` from `lib/routes.ts`.
- Visible in all states (empty, regex only, mixed, single-cat only).

### 2. Auto-redirect when all regex promoted
- `SuggestionCard`: optional `onRegexPromoted` callback after successful promote.
- `SuggestionSection`: track promoted regex count; when `promotedCount === suggestions.length` and length > 0, `router.push(APP_ROUTES.import)`.
- Do not redirect when only single-categorization suggestions remain (read-only section).

### 3. Tests
- `import-suggestions-page.test.tsx`: assert back link present.
- `suggestion-section.test.tsx` or extend existing tests for redirect behavior (mock router).
