---
phase: 38-first-import-onboarding
plan: "02"
subsystem: onboarding-ui
tags: [onboarding, ui, tdd, R-OB-03, R-OB-04, R-OB-05, R-OB-06, R-OB-09, R-OB-10]
dependency_graph:
  requires:
    - getFileCoveredMonths (lib/dal/imports.ts) — Wave 1
    - formatMonthRange (lib/utils/date.ts) — Wave 1
    - APP_ROUTES.onboarding (lib/routes.ts) — Wave 1
    - onboarding redirect guard (app/(app)/layout.tsx) — Wave 1
  provides:
    - /onboarding route (steps 1–3, placeholders for 4–5)
    - getLatestImportSummaryForUser (lib/dal/imports.ts)
    - OnboardingStepSchema + parseOnboardingStep (lib/validations/onboarding.ts)
    - OnboardingShell + ProgressDots (token-based full-screen hero)
    - Step1Upload (R2 presigned PUT + analyze + confirm pipeline)
    - Step2Overview (real file aggregates with Italian month range)
    - Step3Education (giroconto tip with dynamic counts)
    - StickyCta (navigation CTA for steps 2–3)
  affects:
    - app/(app)/layout.tsx (chrome bypass for /onboarding added)
    - app/globals.css (data-theme onboarding-dark/onboarding-light token overrides added)
    - lib/dal/imports.ts (getLatestImportSummaryForUser added)
tech_stack:
  added: []
  patterns:
    - data-theme attribute CSS variable remapping for design-system token compliance (D-09)
    - async RSC tested via renderToStaticMarkup (same pattern as dashboard-charts.test.tsx)
    - pure view-model builder (buildStep2ViewModel) extracted for isolated unit testing
    - R2 presigned PUT pipeline reused verbatim from ImportUploader
    - Decimal.js validation of monetary strings before Intl.NumberFormat formatting
key_files:
  created:
    - app/(app)/onboarding/layout.tsx
    - app/(app)/onboarding/page.tsx
    - app/(app)/onboarding/_components/onboarding-shell.tsx
    - app/(app)/onboarding/_components/progress-dots.tsx
    - app/(app)/onboarding/_components/step-1-upload.tsx
    - app/(app)/onboarding/_components/step-2-overview.tsx
    - app/(app)/onboarding/_components/step-2-view-model.ts
    - app/(app)/onboarding/_components/step-3-education.tsx
    - app/(app)/onboarding/_components/sticky-cta.tsx
    - lib/validations/onboarding.ts
    - tests/onboarding-step-validation.test.ts
    - tests/onboarding-page.test.tsx
    - tests/step-2-overview.test.tsx
  modified:
    - app/(app)/layout.tsx (chrome bypass for /onboarding)
    - app/globals.css (data-theme token blocks)
    - lib/dal/imports.ts (getLatestImportSummaryForUser + LatestImportSummary type)
decisions:
  - "data-theme attribute approach chosen over direct Tailwind dark-mode classes: components reference only bg-background/text-foreground; globals.css remaps those tokens per theme block — no hardcoded colours in component files (D-09)"
  - "async RSC testing via renderToStaticMarkup: project has no @testing-library/react; same pattern as dashboard-charts.test.tsx. buildStep2ViewModel extracted as pure function for direct unit testing"
  - "step-2-view-model.ts: toDecimal() wraps monetary strings before Intl.NumberFormat — validates decimal strings without performing native arithmetic (project hard rule)"
  - "getLatestImportSummaryForUser reuses getFileCoveredMonths for month range to avoid duplicating ownership-enforcement logic (T-38-07)"
  - "Step1Upload processes upload auto-submission on file pick (no separate button), mirroring the prototype UX intent while retaining the full R2 pipeline from ImportUploader"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-28"
  tasks_completed: 3
  tests_before: 44
  tests_after: 88
---

# Phase 38 Plan 02: Onboarding Route Group + Steps 1–3 Summary

One-liner: Full-screen onboarding shell with design-system token remapping, R2 upload pipeline reuse, and three step screens (upload, overview with real DAL aggregates, education with giroconto tip) tested via async RSC + pure view-model patterns.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 RED | Zod step schema test | 2dcc5f8 | tests/onboarding-step-validation.test.ts |
| 1 GREEN | Onboarding layout + schema + shell + progress dots | 478013f | lib/validations/onboarding.ts, app/(app)/onboarding/layout.tsx, _components/onboarding-shell.tsx, _components/progress-dots.tsx, app/(app)/layout.tsx, app/globals.css |
| 2 RED | Onboarding page routing test | ace7111 | tests/onboarding-page.test.tsx |
| 2 GREEN | Page router + Step1Upload + Step3Education + StickyCta | 0ba9599 | page.tsx, step-1-upload.tsx, step-2-overview.tsx, step-2-view-model.ts, step-3-education.tsx, sticky-cta.tsx, lib/dal/imports.ts |
| 3 | Step2Overview tests + lint fixes | 28cb163 + 3949801 | tests/step-2-overview.test.tsx, progress-dots.tsx, step-2-overview.tsx |

## Token Strategy

Chose **data-theme attribute CSS variable remapping** over Tailwind opacity utilities:

```css
[data-theme="onboarding-dark"] {
  --background: oklch(0.147 0.004 285.75); /* slate-900 equivalent */
  --foreground: oklch(0.985 0.002 247.84); /* near-white */
  /* ... */
}
```

All components use `bg-background`, `text-foreground`, `text-muted-foreground`, `border-foreground/20`, etc. The `data-theme="onboarding-dark"` attribute on `OnboardingShell` causes the CSS variable block to activate, propagating the dark palette to all descendant components without any hardcoded colour in component files (D-09 compliant).

`text-success` and `text-destructive` tokens are used for income/expenses tinting in Step 2. `--success` is declared in `:root` as a new token (green-400 equivalent).

## Async RSC Testing Approach

`@testing-library/react` is not in the project's devDependencies. The project pattern (dashboard-charts.test.tsx) uses `renderToStaticMarkup` from `react-dom/server`.

For `Step2Overview` and `OnboardingPage` (async RSCs), the strategy is:
1. Mock all server-side dependencies (DAL, auth, next/navigation)
2. Call the async function directly: `const element = await OnboardingPage({ searchParams: ... })`
3. Serialise via `renderToStaticMarkup(element)` and assert on HTML strings

For the pure `buildStep2ViewModel` helper, direct function calls without any React rendering are sufficient.

## TDD Gate Compliance

- Task 1: RED commit `2dcc5f8` → GREEN commit `478013f` — gate satisfied
- Task 2: RED commit `ace7111` → GREEN commit `0ba9599` — gate satisfied
- Task 3: Tests committed at `28cb163` — tests passed immediately because implementation existed from Task 2 (buildStep2ViewModel and Step2Overview were required to make Task 2 tests compile). Deviation documented below.

## Deviations from Plan

### Auto-fixed Issues

None from the plan's intent.

### Implementation Notes

**[Plan sequencing] Task 3 Step2Overview pre-implemented in Task 2**
- **Found during:** Task 2 execution
- **Issue:** Task 2's `page.tsx` required importing `Step2Overview`. The mock in the test was sufficient for Task 2 tests, but the RSC + view-model needed to exist for TypeScript compilation.
- **Resolution:** `step-2-overview.tsx` and `step-2-view-model.ts` were created fully during Task 2 GREEN. Task 3 tests confirmed correctness but did not fail RED (implementation already existed).
- **Impact:** No functional difference — all Task 3 acceptance criteria met, 8 additional tests passing.

**[Rule 2 - Missing utility] step-2-view-model.ts extracted as pure helper**
- **Found during:** Task 3 test design
- **Issue:** Async RSC cannot be rendered in Vitest without jsdom/RTL; plan suggested either RTL or view-model extraction.
- **Fix:** Extracted `buildStep2ViewModel(summary): Step2ViewModel` as a pure function in `step-2-view-model.ts` — tested directly without React rendering.
- **Files created:** app/(app)/onboarding/_components/step-2-view-model.ts

### Pre-existing Issues (out of scope)

- `tests/production-smoke.test.ts` and `tests/set-r2-cors.test.ts` pre-existing TypeScript errors (`NODE_ENV` missing from ProcessEnv mock) — deferred (also present in Wave 1 SUMMARY)
- `app/(app)/prototype/onboarding/` has Italian developer comments causing `check:language` failures — pre-existing, not introduced by this plan

## Known Stubs

- `page.tsx` renders `<p data-testid="step-placeholder">Step {step} arriva con Plan 38-03</p>` for steps 4 and 5. This is intentional and documented — Plan 38-03 will replace them with the categorisation wizard (Step 4) and outro (Step 5).

## Threat Flags

No new threat surface beyond what the plan's threat model documents:
- T-38-06: `parseOnboardingStep` Zod validation implemented — clamps to 1..5, default 1
- T-38-07: `getLatestImportSummaryForUser` filters by `userId` from `verifySession()`, reuses `getFileCoveredMonths` which innerJoins on file table for ownership
- T-38-08: Step 3 shows only counts from the user's latest file
- T-38-09: `analyzeImportAction` and `confirmImportAction` call `verifySession()` internally (existing code)

## Self-Check: PASSED

All key files found:
- lib/validations/onboarding.ts — FOUND
- app/(app)/onboarding/layout.tsx — FOUND
- app/(app)/onboarding/page.tsx — FOUND
- app/(app)/onboarding/_components/onboarding-shell.tsx — FOUND
- app/(app)/onboarding/_components/progress-dots.tsx — FOUND
- app/(app)/onboarding/_components/step-1-upload.tsx — FOUND
- app/(app)/onboarding/_components/step-2-overview.tsx — FOUND
- app/(app)/onboarding/_components/step-2-view-model.ts — FOUND
- app/(app)/onboarding/_components/step-3-education.tsx — FOUND
- app/(app)/onboarding/_components/sticky-cta.tsx — FOUND
- tests/onboarding-step-validation.test.ts — FOUND
- tests/onboarding-page.test.tsx — FOUND
- tests/step-2-overview.test.tsx — FOUND

All commits found:
- 2dcc5f8 — test RED: onboarding step Zod schema
- 478013f — feat GREEN: route group, schema, shell, progress dots
- ace7111 — test RED: onboarding page routing
- 0ba9599 — feat GREEN: page router, step-1, step-3, sticky CTA
- 28cb163 — test: step-2-overview
- 3949801 — feat: step-2 real data + lint fixes
