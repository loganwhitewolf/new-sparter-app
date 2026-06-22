---
quick_id: 260615-oiq
status: complete
completed: 2026-06-15
commit: d5b590c
---

# Summary: Onboarding Private Platform Creation Flow

## Completed

- Added an explicit onboarding destination after private platform creation: `/onboarding?step=2`.
- Added `completeOnboardingPrivateImportAction`, which requires the newly created `selectedFormatVersionId`, analyzes the uploaded file with pattern suggestion detection disabled, imports with that same format, and revalidates import, expenses, and onboarding surfaces.
- Added `skipPatternSuggestions` to `analyzeFile` so the onboarding branch can skip regex suggestion discovery without changing normal import analysis.
- Updated the import format wizard so `from=onboarding` stays in the onboarding flow: the wizard saves the private format, imports immediately, and routes back to onboarding instead of rendering the generic analyze/suggestions preview.
- Adjusted onboarding wizard copy/back navigation to stay inside onboarding.

## Verification

- `yarn test tests/import-service.test.ts tests/import-actions.test.ts tests/import-format-wizard-ui.test.tsx` — pass, 94 tests.
- `yarn build` — pass.
- `git diff --check` — pass.
- `yarn check:language` — fail on pre-existing unrelated developer-facing comments:
  `components/dashboard/overview/overview-movers-panel.tsx`,
  `tests/fixtures/v2-taxonomy-manifest.ts`,
  `tests/subcategory-picker.test.tsx`,
  `tests/suggestion-promote-form.test.tsx`.
- `yarn lint` — fail on pre-existing unrelated lint errors in
  `components/dashboard/overview/overview-nudge.tsx`,
  `components/layout/sidebar-provider.tsx`,
  `tests/sidebar-provider.test.tsx`.
