---
phase: 260731-hhv
plan: 03
subsystem: taxonomy-ui
tags: [seed-extras, seed-patterns, categorization, amortizations, italian-copy]

requires:
  - phase: 260731-hhv-02
    provides: prior UX contract waves on same branch
provides:
  - Carburante + Ricarica auto elettrica taxonomy split (D-04)
  - System patterns fuel vs EV
  - Pattern UI without user-facing "regex" (D-03)
  - Spese dilazionate consumer rename (D-02)
affects: [categorization, patterns, amortizations, seeds]

tech-stack:
  added: []
  patterns:
    - additive seed-extras STEP before sync-category-serial-sequences
    - additive subcategory slugs validated in pattern tests without editing seed-data.ts shapes

key-files:
  created: []
  modified:
    - scripts/seed-extras.ts
    - scripts/seed-patterns-data.ts
    - tests/seed-extras-steps.test.ts
    - tests/seed-patterns.test.ts
    - components/patterns/create-pattern-dialog.tsx
    - components/patterns/pattern-actions.tsx
    - components/categories/category-pattern-panel.tsx
    - app/(app)/patterns/page.tsx
    - lib/validations/pattern.ts
    - lib/actions/patterns.ts
    - components/layout/sidebar.tsx
    - app/(app)/amortizations/page.tsx
    - components/amortizations/amortization-table.tsx
    - components/transactions/*

key-decisions:
  - "D-04: ambiguity defaults to carburante; EV keywords → ricarica-auto-elettrica; never restore elettricita-per-auto"
  - "D-03: Regole automatiche / Testo da riconoscere; examples show plain netflix"
  - "D-02: UI Spese dilazionate; APP_ROUTES.amortizations stays /amortizations"

patterns-established:
  - "Pattern slug validation unions seed-data + ADDITIVE_SYSTEM_SUBCATEGORY_SLUGS"

requirements-completed: [2.3, 3.4, 3.10]

coverage:
  - id: D1
    description: Split carburante-e-ricarica into carburante + ricarica-auto-elettrica via seed-extras
    requirement: "2.3"
    verification:
      - kind: unit
        ref: tests/seed-extras-steps.test.ts#registers split-carburante-e-ricarica
        status: pass
      - kind: other
        ref: yarn db:seed-extras (local)
        status: pass
    human_judgment: false
  - id: D2
    description: System patterns point at fuel vs EV slugs
    requirement: "2.3"
    verification:
      - kind: unit
        ref: tests/seed-patterns.test.ts#splits fuel vs EV
        status: pass
      - kind: other
        ref: yarn db:seed-patterns (local)
        status: pass
    human_judgment: false
  - id: D3
    description: Pattern surfaces use natural Italian without user-facing regex
    requirement: "3.4"
    verification:
      - kind: unit
        ref: tests/pattern-validation.test.ts + tests/patterns-page.test.tsx
        status: pass
      - kind: other
        ref: yarn check:language
        status: pass
    human_judgment: false
  - id: D4
    description: Ammortamenti renamed to Spese dilazionate in consumer UI; route unchanged
    requirement: "3.10"
    verification:
      - kind: unit
        ref: tests/sidebar-sections.test.tsx + tests/amortization-registry-table.test.ts
        status: pass
    human_judgment: false

duration: 36min
completed: 2026-07-31
status: complete
---

# Phase 260731-hhv Plan 03: Taxonomy split + pattern copy + amort UI rename Summary

**Additive split of carburante-e-ricarica into Carburante + Ricarica auto elettrica, natural-IT pattern copy without "regex", and Spese dilazionate UI rename with `/amortizations` unchanged.**

## Performance

- **Duration:** ~36 min
- **Started:** 2026-07-31T10:59:57Z
- **Completed:** 2026-07-31T11:35:40Z
- **Tasks:** 4/4
- **Files modified:** ~25

## Accomplishments

- Additive `split-carburante-e-ricarica` seed-extras STEP creates `carburante` + `ricarica-auto-elettrica` (essential, category 7), migrates FKs, deactivates `carburante-e-ricarica`.
- System patterns: fuel stations → `carburante`; new EV pattern → `ricarica-auto-elettrica`.
- Pattern UI/nav/validation copy: "Regole automatiche", "Testo da riconoscere", plain `netflix` examples; no user-facing "regex".
- Consumer amort UI: "Spese dilazionate" / "Dilaziona…"; `APP_ROUTES.amortizations` still `/amortizations`.

## Task Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `7488842a` | feat(260731-hhv-03): split carburante-e-ricarica into fuel + EV (2.3) |
| 2 | `56cc07e3` | feat(260731-hhv-03): split system patterns fuel vs EV (2.3) |
| 3 | `86d234c3` | feat(260731-hhv-03): natural Italian pattern UI copy (3.4) |
| 4 | `a92ef98a` | feat(260731-hhv-03): rename Ammortamenti UI to Spese dilazionate (3.10) |

## Migration counts (2.3 / local `yarn db:seed-extras`)

From first successful run of `split-carburante-e-ricarica` on local DB:

| Bucket | Count |
|--------|------:|
| expenses → `ricarica-auto-elettrica` (EV keywords) | 0 |
| expenses → `carburante` (default) | 2 |
| expense_groups → EV | 0 |
| expense_groups → fuel | 0 |
| patterns → EV | 0 |
| patterns → fuel | 1 |
| classification history `from` → fuel | 0 |
| classification history `to` → fuel | 7 |
| refund snapshots → fuel | 0 |
| user overrides → fuel | 0 |
| deactivate `carburante-e-ricarica` | 1 |

IDs after insert: `carburante`=93, `ricarica-auto-elettrica`=94, old=17.

**Idempotency note:** older v2 merge STEPs still remap `carburante` → `carburante-e-ricarica` earlier in the same run; `split-carburante-e-ricarica` runs after and re-converges final state (both new slugs active, old inactive).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Pattern slug validation for additive extras**
- **Found during:** Task 2
- **Issue:** `tests/seed-patterns.test.ts` validates pattern slugs only against `seed-data.ts`; new additive slugs failed the suite. Editing `seed-data.ts` is forbidden for this split.
- **Fix:** Union `ADDITIVE_SYSTEM_SUBCATEGORY_SLUGS` (`carburante`, `ricarica-auto-elettrica`) into the known-slug set; add D-04 assertion that old slug is absent from patterns data.
- **Files modified:** `tests/seed-patterns.test.ts`
- **Commit:** `56cc07e3`

## Auth Gates

None.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or schema migrations; taxonomy data migration only via existing seed-extras runner.

## Self-Check: PASSED

- [x] `scripts/seed-extras.ts` contains `split-carburante-e-ricarica`
- [x] `scripts/seed-patterns-data.ts` has no `carburante-e-ricarica`
- [x] Commits `7488842a`, `56cc07e3`, `86d234c3`, `a92ef98a` exist on branch
- [x] `lib/routes.ts` still exports `/amortizations`
- [x] SUMMARY written with `status: complete`
