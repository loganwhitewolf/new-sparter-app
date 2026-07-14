---
quick_id: 260711-gfd
description: Dashboard-wide filter chips + sustainability default (option B)
date: 2026-07-11
status: complete
---

# Quick Task 260711-gfd — Summary

## Goal

Make the nature chips drive the WHOLE dashboard (KPI cards + chart) instead of the
chart only, with a default selection that answers "do recurring incomes cover all
spending?" (Straordinarie excluded). Chosen from 3 proposals (A: global chips all-on
default · B: global chips + sustainability default · C: preset switcher) — user
picked **B**.

## Key insight

The chart points carry the exact same nature buckets as the KPI aggregate, so KPIs
are derivable client-side by summing filtered points. This closes the structural-
variants saga: the hardcoded "Solo ricorrenti" heroes removed in 260711-cbr come back
**via the filter** — under the default selection Bilancio's hero IS the structural
balance and Tasso's hero IS the structural rate. One mechanism, one story.

## What changed

- **`overview-kpi-derive.ts`** (new, pure) — `deriveFilteredKpis(points, prevPoints,
  sets…)`: Decimal sums per selection, per-key sums for composition bars, savings rate
  via `computeSavingsRate`, YoY deltas via `computeDeltaPercent` against prior-year
  points **under the same selection**, structural balance for the Bilancio reading.
  `DEFAULT_EXCLUDED_CHIPS = { income: ['extraordinary'], out: [], allocation: [] }`.
- **`overview-dashboard-section.tsx`** (new client wrapper) — owns the chip sets +
  sessionStorage persistence (260709-gfz mechanism reused; absence of a stored value
  now means the sustainability default, NOT all-on). Renders chips **above the KPI
  cards**, then KpiRow, then the movers section. Reset → default (not all-on).
- **`kpi-row.tsx`** — props are now `points + prevPoints + included sets + year`.
  Composition bars render only included segments (single key → honest "Ricorrenti
  100%" bar). Structural warn on Bilancio only while `extraordinary` is included
  (otherwise tautological). Removed the null-breakdown fallback and
  `trendReading`/`resolveTrendReading` (dead code).
- **`kpi-card-reading.tsx`** — dominant legend = largest segment (not first), dot uses
  the segment's own ramp shade (first key can now be excluded).
- **`overview-chart.tsx`** — fully controlled: filter state/persistence/chips render
  moved out; receives sets via props (through `overview-movers-section.tsx`).
- **`overview-chart-filters.tsx`** — Reimposta shows when selection ≠ **default**
  (all-on is now itself a non-default state offering reset).
- **`page.tsx`** — fetches `getOverviewChart(year - 1)` in the existing `Promise.all`;
  renders `OverviewDashboardSection`. `getOverview` stays for empty-check + nudge.
- **Tests** — `deriveFilteredKpis` units (all-on parity, sustainability default =
  structural numbers, same-selection deltas, empty prior year → null deltas, empty
  selections guarded); KpiRow wiring rewritten on chart-point fixtures; dead
  trendReading tests dropped.

## Verification

- Full suite green (**1421 passed**); tsc clean on touched files (21 pre-existing
  errors in unrelated tests); eslint clean (one deliberate setState-in-effect disable,
  documented — SSR-parity restore pattern); `check:language` clean.
- **In-browser check** via throwaway `app/proto/kpi-cards` (real
  `OverviewDashboardSection`, light+dark): default state shows recurring-only
  everywhere (Entrate 17.100 = Σ recurring, bar "Ricorrenti 100%", Bilancio −2320
  structural, no tautological warn); clicking Straordinarie updates **cards and chart
  together** (Entrate 19.240, bar 89%, Bilancio −180, deltas recomputed). Reimposta
  visible only off-default. Proto + scratch scripts removed.
- Note: two earlier "empty chart" screenshots were a Playwright fullPage artifact
  (ResponsiveContainer re-measure restarts bar animation), not an app bug — DOM
  inspection + viewport screenshots confirmed correct rendering.

## Follow-ups (flagged, not done)

- DAL cleanup: `OverviewData.structuralBalance/totalInRecurring/structuralSavingsRate/
  outByNature` are no longer read by the cards — candidates for a later sweep.
- Possible UX iteration: a visible "basis" tag on cards when selection ≠ default.

## Follow-up refinements (same task, 2026-07-11 — Entrate/Uscite cards)

Analysed one concern at a time on the two composition cards:

1. **Delta credibility guardrail.** A partial/near-zero prior year gave explosive YoY
   percentages (+770%). `credibleDelta()` in `overview-kpi-derive.ts` suppresses any
   `|Δ| > MAX_CREDIBLE_DELTA_PERCENT` (300) to null — same treatment as a zero base;
   applied dashboard-side only (`computeDeltaPercent` untouched). Rate deltas (savings
   rate, a bounded %) stay credible and still show. Chosen policy A (suppress) over
   B (cap ">300%") / C (denominator-based).
2. **Icon legend + chip icons.** The legend now shows EVERY included segment as a
   coloured nature icon + its share (was dominant-only); full name in the hover title +
   sr-only label. The SAME glyph tints the filter chips (replaced the colour dot) →
   learnable symbol, chip↔legend association. `nature-icons.tsx` centralises icon +
   colour per chart key. Icons: Ricorrenti Repeat · Straordinarie Sparkles · Essenziale
   Home · Discrezionale ShoppingBag · Debiti CreditCard · Risparmio PiggyBank ·
   Investimento TrendingUp. Chosen A (icons, replace dot) over B (icon + dot) / C (text).

Verified in-browser (light+dark + partial-prior-year panel): chips and legend share the
glyph; guardrail suppresses Entrate/Uscite/Bilancio deltas while keeping the rate delta.

3. **Hero alignment.** Dropped `justify-between` on the card content so all hero values sit
   at the same height; a card without a bar lets its reading fall into the bar's slot
   instead of bottom-aligning and dropping the hero.
4. **Merged Bilancio + Tasso risparmio → one card (5→4).** They shared a numerator
   (savings rate = balance / income). The € net is the hero; one reading (balance
   structural warn ▸ savings-rate tier). Grid → grid-cols-4.
5. **Bilancio visual: progress bar → sparkline.** The progress-toward-20% bar was
   redundant (rate + benchmark already in the reading) with an arbitrary scale. Replaced
   by a per-month net sparkline (trajectory — the dimension all cards lacked), computed
   from `balanceSeries` (monthly points already client-side, zero new queries). The
   `progress` CardBar variant + ProgressBar were removed.
6. **Sparkline polish (4 sub-steps).** (a) zero baseline (dashed) so positive months read
   above / negative below; (b) restored the savings rate as a caption ("Tasso N% ·
   obiettivo 20%") via a generic `caption` slot on ReadingKpiCard; (c) two-colour line —
   split at zero, green above / red below; (d) neutral dead-zone — near-break-even months
   render neutral grey, split generalised to the band boundaries. Threshold tuned to
   **±100 €** (500 greyed out meaningful months). `NEUTRAL_BALANCE_THRESHOLD` in kpi-row.
7. **Accantonato composition bar (last card).** Gained the Entrate/Uscite visual language:
   a composition bar of the included allocation natures + icon legend (🐷 Risparmio / 📈
   Investimento). This gives the allocation chips a visible purpose — they now slice the
   card in front of the user. Kept under the filters (exempting → chart-only chips, more
   inconsistent). YoY reading dropped (redundant with the delta chip). `allocationByKey`
   added to deriveFilteredKpis; `allocationReading` removed.

Net result: **4 consistent cards** — Entrate/Uscite/Accantonato are composition bars +
icon legends; Bilancio is the € hero + two-colour sparkline (±100 dead-zone) + rate
caption. All driven by the dashboard-wide chips.

## Commits

- `2af669f` feat(260711-gfd): dashboard-wide filter chips + sustainability default
- `1924074` feat(260711-gfd): delta guardrail + icon legend on Entrate/Uscite cards
- `8a59c4d` fix(260711-gfd): align KPI hero values; Bilancio reading at bar level
- `7b4ff94` feat(260711-gfd): merge Bilancio + Tasso risparmio into one card
- `9769196` feat(260711-gfd): replace Bilancio progress bar with a monthly sparkline
- `c248c8d` feat(260711-gfd): Bilancio sparkline — zero baseline + restored rate caption
- `dba92c0` feat(260711-gfd): two-colour Bilancio sparkline (green above / red below zero)
- `6288fca` feat(260711-gfd): neutral dead-zone on the Bilancio sparkline (±500 €)
- `ce44585` tweak(260711-gfd): lower Bilancio sparkline dead-zone to ±100 €
- `09caaa7` feat(260711-gfd): Accantonato composition bar (Risparmio / Investimento)
