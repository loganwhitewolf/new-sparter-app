---
quick_id: 260630-fdt
slug: unifica-cta-step-4-onboarding-un-solo-pu
status: ready
---

# Quick Plan: Unifica CTA step 4 onboarding

## Goal

Step 4 sticky footer shows two buttons ("Categorizza il resto dopo" ghost + "Continua" primary) that both navigate to `?step=5`. Replace with a single primary (green) CTA.

## UI copy decision

**Label:** `Categorizza il resto dopo` + ArrowRight icon (same pattern as steps 2–3).

Rationale: communicates deferral without awkward "X o Y" phrasing; the arrow supplies forward affordance that "Vai avanti" / "Continua" used to provide.

## Tasks

### Task 1: Simplify StickyCta step 4

- **files:** `app/(app)/onboarding/_components/sticky-cta.tsx`
- **action:** Remove dual-button branch; add step 4 to `CTA_LABELS`; reuse single primary button layout.
- **verify:** `grep -c "variant=\"ghost\"" sticky-cta.tsx` → 0; step 4 uses one `Button` with default variant.
- **done:** One green CTA linking to `?step=5`.

### Task 2: Update tests

- **files:** `tests/onboarding-page.test.tsx`
- **action:** Rename D-07 test to assert single skip CTA (no duplicate "Continua" in sticky bar for step 4).
- **verify:** `yarn test tests/onboarding-page.test.tsx`
- **done:** Tests pass.
