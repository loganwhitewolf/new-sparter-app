---
quick_id: 260615-oiq
status: planned
created: 2026-06-15
---

# Onboarding Refactor Area 1: Platform Creation Flow

When a user creates a private import platform from onboarding, keep them inside the onboarding flow: skip regex/pattern suggestion discovery, import the uploaded file with the newly created format, and return to the next onboarding step.

## Tasks

1. Define the onboarding post-platform route explicitly.
   - Files: `lib/routes.ts`
   - Action: add a named constant for the onboarding destination after private platform creation.
   - Verify: callers use the constant instead of duplicating the query string.

2. Add a private-platform onboarding import action.
   - Files: `lib/actions/import.ts`, `lib/services/import.ts`
   - Action: add a server action that requires `selectedFormatVersionId`, calls `analyzeFile` with pattern suggestions disabled, then calls `importFile` with the same format.
   - Verify: malformed inputs fail before service calls; success revalidates import, expenses, and onboarding.

3. Wire the format wizard and regression tests.
   - Files: `components/import/import-format-wizard.tsx`, targeted tests
   - Action: when `from=onboarding`, run the new action after format creation and redirect to the explicit onboarding route; keep the normal import flow unchanged for non-onboarding callers.
   - Verify: focused vitest suites, language check, and build.
