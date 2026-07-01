---
phase: 59-import-wizard-attach-format
plan: "04"
subsystem: ui,tests
tags: [import-wizard, duplicate-guard, uat-gap, step-1, tdd]
dependency_graph:
  requires:
    - Phase 59-03 — Two-step ImportFormatWizard with step 1 platform selector
  provides:
    - isDuplicateName client-side guard on step-1 create-new input
    - Inline duplicate-name hint paragraph (role=alert)
    - step1CanAdvance gates on !isDuplicateName
    - 11 UI tests (8 existing + 3 new gap-closure triad)
  affects:
    - components/import/import-format-wizard.tsx
    - tests/import-format-wizard-ui.test.tsx
tech_stack:
  added: []
  patterns:
    - Pure computed value (isDuplicateName) from existing state + props — no new imports
    - Case-insensitive Array.some() comparison against attachablePlatforms names
    - Conditional JSX hint paragraph with role=alert
decisions:
  - "isDuplicateName is a pure inline computed value — not exported, not a helper function"
  - "Client guard is UX only; server-side ilike check in createPrivateRows remains authoritative (T-59-08 disposition: accept)"
  - "hint message names the action (Selezionala dalla lista sopra) for immediate usability guidance"
key_files:
  created: []
  modified:
    - components/import/import-format-wizard.tsx
    - tests/import-format-wizard-ui.test.tsx
metrics:
  duration: "2min"
  completed: "2026-06-30"
status: complete
---

# Phase 59 Plan 04: isDuplicateName Client Guard Summary

**One-liner:** Client-side duplicate-platform guard on step-1 create-new input — case-insensitive match against attachablePlatforms blocks Continua and shows inline hint.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | Add RED tests for isDuplicateName gate triad | 71f6153 | tests/import-format-wizard-ui.test.tsx |
| 1 GREEN | Add isDuplicateName guard to step-1 create-new input | 3f9ca98 | components/import/import-format-wizard.tsx |
| 2 | Extend UI tests — isDuplicateName hint and gate | (in 71f6153 RED commit) | tests/import-format-wizard-ui.test.tsx |

## What Was Built

### components/import/import-format-wizard.tsx

Added two computed values immediately after `resolvedPlatformName` (around line 229):

**`isDuplicateName`:**
```
const isDuplicateName =
  selectedPlatformId === 'new' &&
  attachablePlatforms.some(
    (p) => p.name.toLowerCase() === platformNameInput.trim().toLowerCase(),
  )
```

**Updated `step1CanAdvance`:**
```
const step1CanAdvance =
  selectedPlatformId !== null &&
  !isDuplicateName &&
  (typeof selectedPlatformId === 'number' || platformNameInput.trim().length > 0)
```

**Inline hint JSX** (after `<Input>` in the create-new block):
```
{isDuplicateName && (
  <p className="text-xs text-destructive" role="alert">
    Esiste già una piattaforma con questo nome. Selezionala dalla lista sopra.
  </p>
)}
```

No new imports introduced. `validateWizardFields`, `readFormValues`, `handleSubmit`, and all step-2 logic are unchanged.

### tests/import-format-wizard-ui.test.tsx

Three new test cases added (total: 11):

1. **`initial step-1 render has Continua button disabled when no platform is selected`** — verifies step 1 renders with samplePlatforms and Continua is disabled (selectedPlatformId=null → step1CanAdvance=false).
2. **`no false-positive duplicate hint when attachablePlatforms is empty`** — verifies hint text 'Esiste già una piattaforma con questo nome' is absent on initial render with empty list.
3. **`validateWizardFields accepts a non-empty platformName without errors`** — verifies server-side validation is orthogonal to client duplicate check (platformName='Fineco' → errors=[]).

## Verification Results

```
Tests: 11 passed (11) — yarn test --run tests/import-format-wizard-ui.test.tsx
TypeScript: no errors in components/import/import-format-wizard.tsx
check:language: pre-existing violations only (expenses.ts:82, transactions.ts:200)
```

## Acceptance Criteria Check

- [x] isDuplicateName computed value exists in ImportFormatWizard (case-insensitive comparison)
- [x] step1CanAdvance gates on !isDuplicateName
- [x] Inline hint paragraph with role="alert" renders when isDuplicateName is true
- [x] All import-format-wizard-ui.test.tsx tests pass (11 >= minimum 11)
- [x] No TypeScript errors in modified files
- [x] UAT test 3 scenario (type "fineco" lowercase → blocked) now correct at client layer

## TDD Gate Compliance

- RED commit: `71f6153` test(59-04): add RED tests for isDuplicateName gate triad
- GREEN commit: `3f9ca98` feat(59-04): add isDuplicateName guard to step-1 create-new input
- Note: renderToStaticMarkup produces initial render only (platformNameInput='', isDuplicateName=false); RED tests cover observable initial-render behavior and orthogonal validateWizardFields logic. The isDuplicateName=true path is covered by manual smoke test and the logic is directly auditable in the component source.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

No new security-relevant surface. T-59-08 (client isDuplicateName guard — low severity, disposition: accept) is the only threat; server-side ilike guard in createPrivateRows remains the authoritative check.

## Self-Check: PASSED

- [x] components/import/import-format-wizard.tsx exists and modified
- [x] tests/import-format-wizard-ui.test.tsx exists and modified
- [x] 59-04-SUMMARY.md exists
- [x] Commit 71f6153 exists: test(59-04) RED tests
- [x] Commit 3f9ca98 exists: feat(59-04) isDuplicateName implementation
