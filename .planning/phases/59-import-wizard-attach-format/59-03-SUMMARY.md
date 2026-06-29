---
phase: 59-import-wizard-attach-format
plan: "03"
subsystem: ui,page
tags: [import-wizard, platform-selection, step-ui, rsc, tests]
dependency_graph:
  requires:
    - Phase 59-01 — AttachablePlatform type and listAttachablePlatforms DAL
    - Phase 59-02 — listAttachablePlatformsAction, existingPlatformId Zod/service/action
  provides:
    - ImportFormatWizard two-step attach flow (step 1 UI + step 2 column config)
    - Configure RSC page preloads platform list server-side
    - UI test coverage for step 1, empty-list skip, onboarding regression
  affects:
    - components/import/import-format-wizard.tsx
    - app/(app)/import/[fileId]/configure/page.tsx
    - tests/import-format-wizard-ui.test.tsx
tech_stack:
  added: []
  patterns:
    - useState for multi-step client-side wizard (currentStep/selectedPlatformId)
    - Hidden inputs (existingPlatformId, platformName) carry step-1 result into form submit
    - RSC preloads list via action; falls back to [] on error (Pitfall 3 pattern)
    - renderToStaticMarkup + vi.hoisted mock pattern for RSC+client component tests
key_files:
  created: []
  modified:
    - components/import/import-format-wizard.tsx
    - app/(app)/import/[fileId]/configure/page.tsx
    - tests/import-format-wizard-ui.test.tsx
decisions:
  - "Hidden platformName input (not flag isAttach) carries platform name from step 1 so validateWizardFields needs no change (Research Pitfall 2, Assumption A1)"
  - "Empty attachablePlatforms initializes currentStep='columns' and selectedPlatformId='new' — step 1 skipped (Research Pitfall 3)"
  - "Read-only platform header in step 2 shows 'Configura il formato per <name>' (attach) or 'Nuova piattaforma: <name>' (create) — D-03"
  - "Rule 3 deviation: 'Nome piattaforma' assertion in existing test updated to 'Piattaforma' to unblock Task 1 verification"
metrics:
  duration: "8min"
  completed: "2026-06-29"
status: complete
---

# Phase 59 Plan 03: Import Wizard Attach Flow UI Summary

**One-liner:** Two-step `ImportFormatWizard` with step 1 platform selector (attach or create-new) + RSC page preloading via `listAttachablePlatformsAction`, covered by 8 UI tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add step 1 platform selection UI and step state to ImportFormatWizard | d29a10c | components/import/import-format-wizard.tsx, tests/import-format-wizard-ui.test.tsx |
| 2 | Preload attachable platforms in the configure RSC page | ec21357 | app/(app)/import/[fileId]/configure/page.tsx |
| 3 | Extend UI test suite for the two-step attach flow | dfd0f02 | tests/import-format-wizard-ui.test.tsx |

## What Was Built

### components/import/import-format-wizard.tsx

Extended the client component with the two-step attach flow:

**New prop:** `attachablePlatforms?: AttachablePlatform[]` (imported from `@/lib/dal/import-formats`; defaults to `[]`)

**New state:**
- `currentStep: 'platform' | 'columns'` — initialized to `'columns'` when list is empty (skip step 1)
- `selectedPlatformId: number | 'new' | null` — initialized to `'new'` when list is empty
- `platformNameInput: string` — controlled input for the create-new path

**Step 1 render** (when `currentStep === 'platform'`): radio list of existing platforms, always followed by "Crea una nuova platform" entry with an inline `Input` when selected. A "Continua" button advances to step 2, disabled until a valid selection is made.

**Step 2 additions:**
- Hidden `existingPlatformId` input (rendered only when `typeof selectedPlatformId === 'number'`)
- Hidden `platformName` input carrying either the selected platform's name (attach) or `platformNameInput` (create-new) — `validateWizardFields` and `readFormValues` unchanged
- Read-only platform header "Configura il formato per <name>" / "Nuova piattaforma: <name>" (D-03)

**Removed:** the free-text "Nome piattaforma" Input that was previously in the step-2 grid — replaced by hidden input above.

**Preserved:** redirect `useEffect`, `handleSubmit`, onboarding copy, back-link behaviour, `validateWizardFields`, `readFormValues`.

### app/(app)/import/[fileId]/configure/page.tsx

Added server-side preload (D-02):
- Calls `await listAttachablePlatformsAction()` after the context-load success check
- Passes `attachablePlatforms={platformsResult.data ?? []}` to `<ImportFormatWizard />`
- Error from platforms action falls back to `[]` (wizard opens in create-new mode, non-blocking)

### tests/import-format-wizard-ui.test.tsx

Extended the test suite:
- Added `listPlatforms` mock to `vi.hoisted` + `vi.mock('@/lib/actions/import')` block
- Added `samplePlatforms` fixture (Fineco id=1, Intesa SP id=2)
- **New test 1:** non-empty `attachablePlatforms` renders platform names + "Crea una nuova platform" in step 1
- **New test 2:** `attachablePlatforms=[]` skips step 1, renders "Modalità importo" (column form) directly
- **Existing onboarding test:** still asserts "Salva formato e importa" (regression green)
- Updated `ConfigureImportFormatPage` test: explicit `listPlatforms` stub on the error path

## Verification Results

```
Tests: 8 passed (8) — yarn test --run tests/import-format-wizard-ui.test.tsx
Full wave: 56 passed (56) — all 4 test files
TypeScript: no errors in modified files
check:language: violations only in pre-existing files (expenses.ts:82, transactions.ts:200)
```

## Acceptance Criteria Check

- [x] `grep -c 'attachablePlatforms' components/import/import-format-wizard.tsx` returns 4 (>= 3)
- [x] `grep -c 'currentStep\|selectedPlatformId' components/import/import-format-wizard.tsx` returns 18 (>= 4)
- [x] Hidden input `name="existingPlatformId"` rendered conditionally on numeric selection
- [x] Non-empty `attachablePlatforms` shows "Crea una nuova platform"; empty list renders column form directly
- [x] `grep -c 'listAttachablePlatformsAction' 'app/(app)/import/[fileId]/configure/page.tsx'` returns 2 (>= 1)
- [x] `grep -c 'attachablePlatforms' 'app/(app)/import/[fileId]/configure/page.tsx'` returns 1
- [x] Test asserts step 1 markup contains "Crea una nuova platform"
- [x] Test renders with `attachablePlatforms={[]}` and asserts "Modalità importo" without step 1
- [x] Onboarding regression asserts "Salva formato e importa"
- [x] All 8 tests pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Curly quote encoding in Edit tool output**
- **Found during:** Task 1 TypeScript check
- **Issue:** The Edit tool inserts Unicode curly quotes (U+2018/U+2019) instead of ASCII single quotes in TypeScript string literals. The original file used ASCII quotes (the file has Italian apostrophes as U+2019 in typographic text). After the Edit, TypeScript rejected the curly-quoted string delimiters with TS1127 "Invalid character".
- **Fix:** Python binary replace of `\xe2\x80\x98`/`\xe2\x80\x99` → `'` (ASCII 0x27), then converted the one Italian apostrophe that was now inside a single-quoted string to a double-quoted string (`"Formato salvato. Importo il file e torno all'onboarding…"`).
- **Files modified:** `components/import/import-format-wizard.tsx`, `app/(app)/import/[fileId]/configure/page.tsx`
- **Commit:** d29a10c (included in Task 1)

**2. [Rule 3 - Blocking] 'Nome piattaforma' assertion blocked Task 1 verification**
- **Found during:** Task 1 test run
- **Issue:** Existing test checked for `'Nome piattaforma'` (the old free-text Input label). After removing that Input in Task 1, the assertion failed. The plan scheduled test updates in Task 3, but Task 1's `<verify>` runs the full test file.
- **Fix:** Updated the one failing assertion from `'Nome piattaforma'` → `'Piattaforma'` (the read-only header that replaced the input). Task 3 then added the full test extension.
- **Files modified:** `tests/import-format-wizard-ui.test.tsx`
- **Commit:** d29a10c (included in Task 1)

## Known Stubs

None — all platform names and form values flow from real props and state.

## Threat Flags

No new security-relevant surface beyond what is in the plan threat model:
- T-59-06: `existingPlatformId` hidden input — validated server-side in Plan 02 (ASVS V4/V5)
- T-59-07: step 1 platform list — sourced from `listAttachablePlatformsAction` which filters by DAL WHERE clause (Plan 01)

## Self-Check: PASSED

- [x] components/import/import-format-wizard.tsx exists and modified
- [x] app/(app)/import/[fileId]/configure/page.tsx exists and modified
- [x] tests/import-format-wizard-ui.test.tsx exists and modified
- [x] 59-03-SUMMARY.md exists
- [x] Commit d29a10c exists: feat(59-03) step 1 UI
- [x] Commit ec21357 exists: feat(59-03) RSC page preload
- [x] Commit dfd0f02 exists: test(59-03) test extension
- [x] Commit 6c8cb0d exists: docs(59-03) planning artifacts
