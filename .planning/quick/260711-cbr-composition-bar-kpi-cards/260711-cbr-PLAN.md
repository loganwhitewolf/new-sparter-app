# Quick Task 260711-cbr: Composition-bar KPI cards (option B)

## Context

The 260709-mf6 "recurring-first" restyle (stacked component rows, recurring emphasised,
total demoted below a divider) still didn't satisfy the user. Re-analysed the cards
against KPI-card best practices and competitor patterns, produced 2/3 proposals, the
user chose **option B (composition bar)** with legend variant **B1 (dominant + hover)**.

## Diagnosis (why mf6 fell short)

1. Density too high — up to 3 rows + total + reading + delta badge per card × 5.
2. No sense of trajectory — a static snapshot + one YoY %, zero visual/trend.
3. Three internal models across 5 cards (additive / filtered-hero / single value).
4. Inverted hero — the expected total was demoted; a sub-component became the hero.

## Competitor / best-practice input (web research)

- **Copilot** cash-flow: income/spending/net rendered as bar charts; spending is a
  **stacked bar** per category; prior period as a dotted overlay.
- KPI-card canon: label / large headline value / one comparison / **one** visual
  (sparkline OR bar OR arrow — not three); 4–6 cards; green good / red bad.
- Progress bars are the idiomatic "distance to a target/benchmark" visual.

Sources: help.copilot.money cash-flow tab; nastengraph "Anatomy of the KPI Card";
tabulareditor KPI best practices; eleken + onething budget-app design.

## Approved design (B1)

- **Total = hero** again on Entrate/Uscite; the mix becomes a **composition bar**
  (single-hue ramp: dominant segment solid, secondaries lighter opacities) with a
  **dominant-segment legend line**; the other segments surface on the bar's hover.
- **Tasso risparmio** → savings-rate hero + **progress bar** toward the 20% benchmark
  (fill + target tick).
- **Bilancio / Accantonato** → hero + reading only (no bar). The recurring-only
  ("structural") signal stays inside the Bilancio reading.
- **YoY delta** → compact top-right chip (arrow + signed %), prevYear on hover title.
- Hero shrinks by length (never wraps); header label truncates so it never collides
  with the delta chip.

## Tasks

1. Rework `kpi-card-reading.tsx` API: `hero` + `CardBar` (composition | progress) +
   `reading` + delta chip. Bar ramp + dominant legend + progress tick.
2. Rewire `kpi-row.tsx`: total-as-hero composition for Entrate/Uscite; progress for
   Tasso; hero+reading for Bilancio/Accantonato; null-field fallbacks preserved.
3. Rewrite `ReadingKpiCard` unit tests; fix KpiRow wiring assertions (drop the removed
   "Solo ricorrenti" row and structural-rate hero).

## Verify

- Full suite green; tsc clean on touched files; check:language clean.
- Screenshot the **real** KpiRow (mock OverviewData) light + dark + 7-figure stress via
  a throwaway `app/proto/kpi-cards` route; remove the route after review.

## Out of scope

- No DAL/query changes (all fields already exist; `structuralSavingsRate` now unused
  by the card but left in `OverviewData`).
- No copy changes beyond the layout shift.
