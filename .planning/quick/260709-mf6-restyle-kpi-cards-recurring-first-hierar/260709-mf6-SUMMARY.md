---
quick_id: 260709-mf6
description: Recurring-first restyle of the dashboard KPI cards
date: 2026-07-09
status: complete
---

# Quick Task 260709-mf6 — Summary

## Goal

Make the recurring/structural values stand out on the Overview KPI cards — "they
explain the trend". Approved via a design prototype (stacked components, recurring
emphasised, total as a summary line).

## What changed

- **`kpi-card-reading.tsx`** — reworked `ReadingKpiCard` from a `value + breakdown`
  model to a **components-first** model: `components: KpiComponentRow[]`
  (`{ label?, value, tone, emphasis?, layout? }`) + optional `total` summary + optional
  `reading` + delta badge. Emphasised row = large, full-colour, leading dot; secondary =
  smaller, muted. `layout: 'stacked'` puts the label above the value (for a standalone
  hero number in a narrow card); default `inline` = label left / value right.
  `ValueTone` maps colour (allocation via arbitrary var; rest via tokens).
- **`kpi-row.tsx`** — each card builds its `components` + `total` from OverviewData
  (Decimal.js for derived Straordinarie). Bilancio/Tasso use `signTone` (green ≥0 /
  red <0) and a stacked structural label. Null breakdown fields fall back to a single
  emphasised grand-total (classic card + trend reading).
- **`tests/overview-interactions.test.tsx`** — rewrote the `ReadingKpiCard` unit tests
  for the new API (emphasis structure, total line, labelless single value, delta badge);
  KpiRow render assertions unchanged (text still present).

## Layout by card

- **Entrate**: Ricorrenti (hero, green) / Straordinarie (muted) → Totale
- **Uscite**: Essenziale (hero, red) / Discrezionale / Debiti (muted) → Totale
- **Bilancio**: Solo ricorrenti (hero, sign-coloured, stacked label) → Totale + reading
- **Tasso risparmio**: Solo ricorrenti (hero) → Totale + reading
- **Accantonato**: single value → reading

## Deviations from the mock (accepted)

- **YoY delta badges kept** (mock omitted them; they're existing data).
- **Trend reading dropped on Entrate/Uscite** (redundant with the delta badge).
- **Balance/rate now sign-coloured** instead of the old neutral `--balance` tone.

## Verification

- Full suite green (1420); `tsc --noEmit` clean on touched files; `check:language` clean.
- **Real-app visual check**: rendered `KpiRow` with mock data via a throwaway
  `app/proto/kpi-cards` route on the running dev server; screenshotted light + dark with
  Playwright, reviewed both, fixed a label-wrap issue on Bilancio/Tasso (→ stacked
  label). Proto route removed after review.

## Follow-up refinement (same session)

- Removed the coloured dot before component labels (visual noise).
- Values never wrap: `whitespace-nowrap` everywhere, and the emphasised hero value
  steps its font size down by length (`emphasisSizeClass`) so a large amount shrinks
  instead of breaking to a second line. On inline rows the value is `shrink-0` and the
  label truncates first — only bites at 7-figure amounts, a rare graceful fallback.
- Re-verified in the running app with a 7-figure stress scenario (light + dark).

## Commits

- `d347a8b` feat: recurring-first KPI card restyle
- `<refinement>` refactor: drop value dots; values never wrap (shrink instead)
