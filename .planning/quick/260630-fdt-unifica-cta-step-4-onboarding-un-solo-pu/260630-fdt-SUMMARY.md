---
quick_id: 260630-fdt
status: complete
---

# Quick Task 260630-fdt — Summary

## Done

- Created branch `feat/gsd-quick-batch` from `origin/main` for batched quick tasks.
- Merged step 4 dual sticky CTAs into one primary button: **Categorizza il resto dopo** → `?step=5`.
- Removed ghost + primary duplicate; step 4 now uses the same single-button pattern as steps 2–3.

## UI copy

Chose **Categorizza il resto dopo** (with ArrowRight) over literal "categorizza dopo o vai avanti": clearer deferral message, arrow supplies forward affordance, consistent with steps 2–3.

## Commits

- Code: sticky-cta simplification + test update

## Verification

- `yarn test tests/onboarding-page.test.tsx` — 13 passed
