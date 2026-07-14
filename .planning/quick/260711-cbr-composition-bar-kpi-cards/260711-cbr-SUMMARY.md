---
quick_id: 260711-cbr
description: Composition-bar restyle of the dashboard KPI cards (option B / B1)
date: 2026-07-11
status: complete
---

# Quick Task 260711-cbr — Summary

## Goal

Replace the 260709-mf6 recurring-first stacked-rows cards (which the user still
disliked) with a composition-first model chosen from 3 proposals: **option B
(composition bar)**, legend variant **B1 (dominant segment + hover)**.

## What changed

- **`kpi-card-reading.tsx`** — reworked `ReadingKpiCard` from `components[] + total`
  to `hero: { value, tone }` + optional `bar: CardBar` + optional `reading` + a
  top-right YoY **delta chip**. `CardBar` is a discriminated union:
  - `composition` — a stacked proportion bar (`BarSegment[]`) with a single-hue ramp
    (`barRamp` per tone: index 0 solid = dominant, 1+ lighter) and a **dominant-segment
    legend line** (dot + label + %); secondary segments carry a `title` for hover.
  - `progress` — a value-vs-target fill with a target **tick** (Tasso risparmio).
  Hero shrinks by length (`heroSizeClass`, never wraps); header label `truncate`s so it
  never collides with the delta chip.
- **`kpi-row.tsx`** — total is the hero again on Entrate/Uscite (neutral tone; the bar
  carries the colour). Uscite labels from `NATURE_LABELS`. Tasso risparmio = savings-rate
  hero + progress toward `SAVINGS_TARGET_RATE` (20%). Bilancio/Accantonato = hero +
  reading (structural signal stays in `balanceReading`). Null breakdown fields degrade
  to a tone-coloured hero + trend reading. Removed the `STRUCTURAL_ROW_LABEL` row model.
- **`tests/overview-interactions.test.tsx`** — rewrote the `ReadingKpiCard` units for the
  new API (composition bar + dominant legend + hover titles, progress bar + target tick,
  hero+reading, delta chip presence/absence). Updated the KpiRow wiring test: dropped the
  removed "Solo ricorrenti" row and the structural-rate hero; assert the grand savings
  rate (48%) instead. Reading-helper tests unchanged.

## Layout by card

- **Entrate**: total hero → green composition bar (Ricorrenti solid / Straordinarie light) → legend "Ricorrenti N%"
- **Uscite**: total hero → red ramp bar (Essenziale / Discrezionale / Debiti) → legend "Essenziale N%"
- **Bilancio**: balance hero (sign-coloured) → reading (quantifies structural when positive-on-extras)
- **Tasso risparmio**: rate hero → progress bar toward 20% (tick) → reading
- **Accantonato**: allocation hero → reading

## Research inputs

- Copilot cash-flow tab (stacked spending bar, dotted prior-period overlay).
- KPI-card canon: total = hero, one visual not three, 4–6 cards, green/red.
- Progress bar = idiomatic distance-to-benchmark visual.

## Verification

- Full suite green (**1421 passed**, 1 todo); tsc clean on touched files (21 pre-existing
  errors in unrelated test files only); `check:language` clean.
- **Real-app visual check**: rendered the real `KpiRow` with mock `OverviewData` via a
  throwaway `app/proto/kpi-cards` route; screenshotted light + dark + a 7-figure stress
  scenario with Playwright, reviewed both. Fixed a header label/delta-chip collision
  (added `truncate`). Proto route removed after review.

## Commits

- `dd7c017` feat(260711-cbr): composition-bar KPI cards (option B)
