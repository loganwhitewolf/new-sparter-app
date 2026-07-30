# Lens selector redesign — DECISIONS

**Status:** LOCKED 2026-07-30
**Supersedes:** Phase 80 D-01/D-03/D-04/D-05 presentation choices only. The lens *semantics*
(ADR 0019 §5, `CONTEXT.md` "Vista per cassa / Vista per competenza") are unchanged: `?lens=` stays
the source of truth, sessionStorage stays the restore layer, `resolveLedgerRowSource()` stays the
single seam. This is a presentation-layer rework.

## Problem

The Phase 80 `LensSwitch` (a bordered pill segmented control sitting next to the year `Select` in
`components/dashboard/overview/overview-header.tsx`) fails on six counts:

1. **Wrong visual weight.** Same shape as the year filter, so it reads as "another filter" while it
   actually redefines the meaning of every number on the page.
2. **No feedback outside the control.** In `competenza` the numbers change silently; the only signal
   is one pill's pressed state at the top of the page. Nothing anchors the reading once scrolled.
3. **Jargon without gloss.** "Cassa"/"Competenza" never state the consequence. No tooltip, no
   description.
4. **Noise for users with no plans.** Without amortization plans both lenses produce identical
   numbers — the control is pure cognitive cost.
5. **Dead control on `/dashboard/tags`.** Rendered `disabled` plus a caption explaining why it is
   dead, instead of not rendering it.
6. **Outside the design system.** Custom `aria-pressed:` variants rather than the shadcn primitives
   the sibling year selector uses.

## Decisions

### LSD-01 — The lens moves into the page title (direction B)

The segmented control is removed. The lens becomes a dropdown rendered *inside the page heading*:

```
Panoramica delle tue finanze · per competenza ▾    [2026 ▾]
```

The trigger is text (heading typography, dotted underline affordance), not a pill — so it no longer
mimics a filter. The year keeps its pill `Select`. Hierarchy is now legible: **the year filters, the
lens reframes**.

Consequence: the page self-labels its own lens permanently, which resolves problem 2 by construction
— no separate badge on each widget is needed.

**Rationale:** the alternative "toggle done better" (A) fixes styling but keeps a lens-shaped-like-a-
filter in the filter row; the alternative "no mode at all, overlay everywhere" (C) removes the mode
but touches every widget and doubles KPI density. B is the smallest change that fixes the root cause
(wrong information hierarchy), and it composes with a targeted overlay (LSD-03).

### LSD-02 — Dropdown items carry a description line

Two `menuitemradio` items, each label plus one muted description line:

- **per cassa** — "Ogni spesa nel mese in cui i soldi sono usciti dal conto."
- **per competenza** — "I costi ammortati spalmati sui mesi delle rate, anno intero."

Resolves problem 3 without a separate help affordance. Italian copy (product surface).

### LSD-03 — Accrual/cash overlay on the monthly chart, only when `competenza` is active

On the overview monthly chart, when the active lens is `competenza`, the cash series is drawn as a
dashed overlay line on top of the accrual bars, with its own legend entry. When the active lens is
`cassa`, **no overlay is drawn** — the chart is exactly what it is today.

**Rationale (user decision, 2026-07-30):** an always-on overlay would make the accrual lens
discoverable, but the chart already renders three grouped bar series (Entrate / Uscite / Accantonato)
— a permanent fourth mark is too dense for a benefit that only matters once the user has opted into
the accrual reading. Showing it only in `competenza` puts the comparison exactly where it is
informative.

Implementation seam: `getOverviewChart(year, ledgerRowSource)` is already parameterised by row
source, so the overlay is a second call with `resolveLedgerRowSource('cassa')`. No new query shape.
The second call happens **only** when `lens === 'competenza'` — `cassa` pays nothing.

### LSD-04 — Hide the dropdown when the user has no amortization plans

If the user has zero amortization plans (any status), the lens dropdown is not rendered and the
heading is plain (`Panoramica delle tue finanze`). Resolves problem 4.

**Rationale (user decision, 2026-07-30):** hiding makes the feature invisible to a user who has
never used it, but the accrual lens is *meaningless* without a plan — its discovery point is the
amortization flow itself (`/amortizations`, the "spalma su N mesi" action), not the dashboard header.

**Scoped non-goal:** the `?lens=` param logic is NOT changed by this. A user with a stale
`lens=competenza` (persisted or bookmarked) and no plans keeps resolving the accrual row source —
which yields numerically identical output, so there is nothing to guard. Do not add a
force-to-cassa branch; it would be dead code.

### LSD-05 — Lens-invariant surfaces hide the control instead of disabling it

`/dashboard/tags` (all-time, lens-invariant per Phase 80 D-05) stops rendering a disabled control
plus explanatory caption and simply renders no lens control. Resolves problem 5.

Consequence: the `disabled` and `note` props disappear from the component's API.

**Assumption flagged:** this treats D-05's explanation copy ("i tag sono all-time: la lente non
cambia i totali") as unnecessary — a control that was never there needs no explanation. If the tags
page needs to state its all-time nature, that belongs in the tags page's own subtitle, not in a
lens-control caption.

## Surfaces touched

| Surface | Change |
|---|---|
| `components/dashboard/lens-switch.tsx` | Replaced by the title dropdown; `disabled`/`note` props dropped |
| `components/dashboard/overview/overview-header.tsx` | Lens moves into the `h1` row as a dropdown; gated on plan existence |
| `app/(app)/dashboard/categories/page.tsx` | Same title-integrated dropdown; gated |
| `app/(app)/dashboard/categories/[id]/page.tsx` | Same; gated |
| `app/(app)/dashboard/tags/page.tsx` | No lens control at all (LSD-05) |
| `components/dashboard/overview/overview-chart.tsx` | Dashed cash overlay line, `competenza` only |
| `app/(app)/dashboard/overview/page.tsx` | Second `getOverviewChart` call when `lens === 'competenza'` |
| `lib/dal/amortization.ts` | New `hasAmortizationPlans(userId)` count query for LSD-04 |

## Unchanged (explicitly)

- `?lens=` as source of truth; `components/dashboard/lens-persistence.ts` sessionStorage restore layer
- `resolveLedgerRowSource()` as the only cash/accrual seam
- All accrual arithmetic, `ledger_entry_accrual`, instalment materialisation
- `CONTEXT.md` domain vocabulary

## Prototype

`.scratch/lens-selector-proto/index.html` — throwaway, fake data, three overlay variants compared
before locking LSD-03. Not production code; safe to delete.
