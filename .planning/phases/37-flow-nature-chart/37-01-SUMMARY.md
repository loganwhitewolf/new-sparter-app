---
plan: 37-01
phase: 37-flow-nature-chart
status: complete
completed: 2026-05-25
self_check: PASSED
key-files:
  created:
    - lib/utils/nature-labels.ts
    - tests/nature-labels.test.ts
  modified:
    - tests/dashboard-charts.test.tsx
    - tests/dashboard-dal.test.ts
    - tests/category-settings-seed.ts
    - tests/category-actions.test.ts
---

## Summary

Plan 37-01 established the shared `nature-labels` utility and placed all RED test scaffolds for Wave 2/3 plans.

## What was built

**lib/utils/nature-labels.ts** (new): exports `FlowNature` union type, `NATURE_LABELS` (7 Italian entries per D-04/D-05), `NATURE_ORDER` (6 natures + null sentinel), and `NATURE_COLORS` (hex palette, neutral gray for unclassified).

**tests/nature-labels.test.ts** (new): 20 GREEN unit tests covering all label keys, Italian strings, ordering invariant (null last), and non-empty color values for all 7 keys.

**tests/dashboard-charts.test.tsx** (rewritten): `EntrateUsciteChart` describe renamed to `(R-FN-04, R-FN-06)`, removed `Entrate`/`Uscite` assertions, added `Essenziale`/`Non classificato`/`NATURE_ORDER` assertions, mocked `next/navigation` for upcoming `useSearchParams`. BilancioBarsChart block untouched. 4 new EntrateUsciteChart tests intentionally RED.

**RED scaffolds (3 files)**:
- `tests/dashboard-dal.test.ts`: `describe('getMonthlyTrendByNature (R-FN-04, R-FN-08, R-FN-09)')` — fails with `undefined` until Plan 37-03 ships
- `tests/category-settings-seed.ts`: `describe('seed nature assignment (R-FN-03)')` — FlowNature import guard + 3 `.todo` scaffolds for Plan 37-02 activation
- `tests/category-actions.test.ts`: `describe('createSubcategoryAction nature requirement (R-FN-09)')` — `setSubcategoryNatureAction` existence and `nature` missing validation, both RED

## NATURE_COLORS palette chosen

| Nature | Color |
|--------|-------|
| essential | `#4ade80` (green) |
| discretionary | `#f97316` (orange) |
| operational | `#60a5fa` (blue) |
| financial | `#a78bfa` (purple) |
| debt | `#f87171` (red) |
| extraordinary | `#fbbf24` (amber) |
| unclassified | `#a1a1aa` (neutral gray) |

Colors chosen as hex values (not CSS vars) for simplicity and compatibility with Recharts `fill` prop. All are visually distinct and broadly consistent with shadcn/ui palette semantics.

## Deviations from Pattern 5

None. Pattern 5 (single shared label module) followed exactly. The module is pure constants with no runtime dependencies.

## RED test count entering Plan 37-02/03

- `tests/dashboard-charts.test.tsx`: 4 RED (EntrateUsciteChart nature assertions)
- `tests/dashboard-dal.test.ts`: 1 RED + 1 todo (`getMonthlyTrendByNature`)
- `tests/category-actions.test.ts`: 2 RED (`setSubcategoryNatureAction`, nature missing validation)
- `tests/category-settings-seed.ts`: 3 todo (seed nature checks, activated by Plan 37-02)

Total: 7 active RED tests + 4 todos across 4 files.

## Self-Check

- [x] `lib/utils/nature-labels.ts` exports 4 symbols (FlowNature, NATURE_LABELS, NATURE_ORDER, NATURE_COLORS)
- [x] `tests/nature-labels.test.ts` — 20 GREEN
- [x] `tests/dashboard-charts.test.tsx` — no `'Entrate'`/`'Uscite'`, has `'Essenziale'`/`'Non classificato'`, next/navigation mocked
- [x] RED scaffolds reference R-FN requirement IDs in `it()` descriptions
- [x] 6 pre-existing GREEN tests in category-actions.test.ts preserved (pre-existing failures unaffected)
- [x] `yarn tsc --noEmit` — no new errors
