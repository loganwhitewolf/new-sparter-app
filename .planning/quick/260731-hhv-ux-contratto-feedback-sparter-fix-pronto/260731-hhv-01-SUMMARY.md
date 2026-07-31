---
phase: 260731-hhv
plan: 01
subsystem: ui
tags: [onboarding, contrast, wcag, categorizza, chips]

requires: []
provides:
  - Shared --secondary-readable token (≥4.5:1) for secondary copy and inactive chips
  - Centered onboarding stepper with ≥16px step label
  - Prominent white dashed dropzone on onboarding upload
  - Readable movement text + Seleziona categoria... placeholder in categorize UI
affects: [260731-hhv-02, 260731-hhv-03]

tech-stack:
  added: []
  patterns:
    - "text-secondary-readable maps to --secondary-readable for AA secondary copy"

key-files:
  created: []
  modified:
    - app/globals.css
    - app/(app)/onboarding/_components/step-1-upload.tsx
    - app/(app)/onboarding/_components/step-3-education.tsx
    - app/(app)/onboarding/_components/onboarding-shell.tsx
    - app/(app)/onboarding/_components/progress-dots.tsx
    - app/(app)/onboarding/_components/subcategory-combobox.tsx
    - components/categorization/subcategory-picker.tsx
    - tests/subcategory-picker.test.tsx

key-decisions:
  - "One CSS token --secondary-readable (+ Tailwind text-secondary-readable) for 1.2/1.4/2.1/2.2 instead of opacity hacks"
  - "Dropzone uses local white + #717171 dashed border (plan-allowed local exception on dark onboarding)"
  - "Chip labels stay Accantonamenti (no Abbonamenti rename)"

patterns-established:
  - "Secondary-readable: prefer --secondary-readable over text-foreground/N for AA secondary UI copy"

requirements-completed: [1.1, 1.2, 1.3, 1.4, 2.1, 2.2]

coverage:
  - id: D1
    description: Shared secondary-readable contrast on upload hint, education copy, inactive chips
    requirement: "1.2"
    verification:
      - kind: unit
        ref: "tests/subcategory-picker.test.tsx#inactive type chips use secondary-readable contrast utility"
        status: pass
    human_judgment: true
    rationale: "WCAG spot-check on onboarding dark step 1/3 and Categorizza sheet needs visual confirmation"
  - id: D2
    description: Centered stepper with ≥16px label and prominent dropzone
    requirement: "1.1"
    verification: []
    human_judgment: true
    rationale: "Layout/visual acceptance for stepper centering and dropzone prominence"
  - id: D3
    description: Movement text and Seleziona categoria... placeholder meet AA contrast intent
    requirement: "2.2"
    verification:
      - kind: unit
        ref: "tests/subcategory-picker.test.tsx"
        status: pass
    human_judgment: true
    rationale: "Placeholder/movement readability on dark onboarding + sheet is visual"

duration: 1min
completed: 2026-07-31
status: complete
---

# Phase 260731-hhv Plan 01: Contrast + onboarding + Categorizza UI Summary

**Shared `--secondary-readable` token lifts secondary copy and inactive chips to AA intent; onboarding stepper is top-centered at ≥16px with a white dashed dropzone.**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-07-31T10:46:56Z
- **Completed:** 2026-07-31T10:48:02Z
- **Tasks:** 3/3
- **Files modified:** 8

## Accomplishments

- Introduced `--secondary-readable` / `text-secondary-readable` for light, dark, and onboarding themes
- Applied shared contrast to upload hint (1.2), education secondary sentence (1.4), inactive type chips (2.1)
- Centered ProgressDots; step label `text-base`; dropzone white + `#717171` dashed border (1.1, 1.3)
- Raised categorize movement lines + `Seleziona categoria...` + search placeholder contrast (2.2)
- Kept chip labels Tutte / Entrate / Uscite / Accantonamenti / Trasferimenti (no Abbonamenti)

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Shared secondary-contrast utility + three call sites | `2779354d` | globals.css, step-1-upload, step-3-education, subcategory-picker, test |
| 2 | Stepper center + dropzone prominence | `0cb248fa` | onboarding-shell, progress-dots, step-1-upload |
| 3 | Movement text + placeholder contrast | `6005c0b2` | subcategory-combobox, subcategory-picker |

## Deviations from Plan

None - plan executed as written.

## Manual spot-check (for SUMMARY / UAT)

- Onboarding dark step 1: upload hint readable; dropzone white + dashed gray; ProgressDots centered; step name ≥16px
- Onboarding dark step 3: “Le altre N…” readable
- Categorizza sheet: inactive chips readable vs active primary; placeholder `Seleziona categoria...` / search placeholder readable

## Known Stubs

None.

## Self-Check: PASSED

- Commits present: `2779354d`, `0cb248fa`, `6005c0b2`
- Key files modified on branch as listed above
- `yarn vitest run tests/subcategory-picker.test.tsx` — 7 passed
- Branch remained `gsd/quick-260730-o82-tx-direction-multi` (no worktree / no new branch)
