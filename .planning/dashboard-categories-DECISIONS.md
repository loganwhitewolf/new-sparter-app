# Dashboard Categories — Design Decisions

Locked design from the grill-with-docs session of 2026-07-30. Source of truth for `/gsd-plan-phase`.
See also: `docs/adr/0020-categories-year-view-retires-deviation.md`, `CONTEXT.md` (Dashboard e analisi).

## Problem being fixed

The dashboard had three tabs with three unrelated temporal models:

- `/dashboard/overview` — `?year=` plus an in-page month selection (client state, never in the URL).
- `/dashboard/categories` — `?preset=` (default `last-3-months`), a rolling window anchored to `new Date()`, no year at all.
- `/dashboard/tags` — all-time, no period.

Worse, inside Categories the ranking was filtered by the preset while the Deviation badge — **the default sort key** — was anchored to a period the page never named: `getCategoryDeviations` called `getDeviationDateRanges()` with no arguments, i.e. always "previous calendar month vs the 3 months before it" regardless of `?preset=`. Combined with the documented D-12 drift (Reference Period = last month *with data* vs the Deviation engine's last *calendar* month), the page went empty whenever the user had not imported for two months while Overview still showed data.

## Goal

Categories answers two questions and nothing else:

- **List** — "where am I spending the most this year?"
- **Detail** — "how is this category going, month by month, and where does it land by year end?"

## Locked decisions

### D1 — Structure and default reading

The year is the container (aligned with Overview so `?year=` is shared); the list reads the whole year; the month-level reading lives in the detail page. Rejected: month-diagnosis as the list's primary reading (superseded by D8 once the list turned out to carry no month selection at all).

### D2 — Baseline/comparison periods may cross the year boundary

The year is a container for what you *see*, never for what a computation may *read*. A comparison anchored to January 2026 is free to read October–December 2025.

### D3 — "How it is going" = pace, not prediction

The page states a **rhythm** projected forward ("at this pace: €4.080"), never a forecast ("you will close at €4.080"). Year-over-year comparison is a progressive enhancement that appears when history exists — never the backbone, because it would leave the page mute for a new user's entire first year.

### D4 — The pace is the average of Covered Months

`Ritmo` = average over the **Covered Months** of the selected year. Rejected: last-3-months average (a single annual expense — car insurance in March — swings it by 4×) and calendar-elapsed months (would punish the user for not importing). Below **2 Covered Months** no estimate is produced at all: no fragile number.

### D5 — Instalment-aware projection: not needed here

Dropped as a consequence of D6. `ledger_entry_accrual` exposes 5 columns (`id, user_id, occurred_at, expense_id, amount`) with **no discriminator** between a transaction row and an instalment row, so "pace on ordinary rows + known future instalments" was not expressible without adding a `source` column to the views — which would reintroduce exactly the per-lens branching ADR 0019's seam exists to prevent.

### D6 — Categories is lens-invariant; the lens switch lives only on Overview

Categories always reads **cassa**. The competenza switch is removed from Categories *and* Tags: it renders only on Overview. Rationale: amortization is a property of a single Transaction (`CONTEXT.md`, Ammortamento), not a way of reading a category's spending; and pace is by definition a cash reading — spreading a cost over 24 months makes the rhythm *less* legible. Amends LENS-01 of ADR 0019 ("one switch flips every widget"). Accepted cost: a category containing an amortization shows €2.400 in August here and €100/month in Overview-competenza. Recorded in ADR 0020 so a future reader does not "fix" it.

### D7 — Only `year` is shared across tabs

`month` never enters the URL — the list has no month selection (D8) and the detail shows every month, so Overview's chip/month client state is **not touched**. Cleanup: `buildDashboardTabHref` currently propagates `preset`, `type`, `sort`, `tag`, `lens` but **not** `year`; `tag` has been dead since v2.7. Open: whether the tab nav keeps carrying `?lens=` invisibly (recommended — otherwise Overview-competenza → Categories → back lands in cassa).

### D8 — What a list row carries

Name · year total · % of total · 12-month sparkline · **year-end projection**. The Deviation badge is gone from the row. The projection is inline (not detail-only) because "where do I spend the most" is already known — rent and groceries, every year — while "which category is accelerating" is the information the user does not have, and burying it one click down 26 times makes it unreachable. Accepted cost: two monetary figures per row; mitigated by visual hierarchy (projection attenuated, explicitly labelled), not eliminated.

### D9 — Three directions, not two

Filter offers **Uscite / Entrate / Accantonamenti**. Today `getCategoryRanking` filters `eq(direction.includedInTotals, true)` and `allocation` is seeded `includedInTotals: false`, so Risparmio and Investimenti are invisible on this page. The correct predicate is **`eq(direction.hidden, false)`** — true for `in`/`out`/`allocation`, false for `transfer` (`scripts/seed-data.ts`, `directions`). Rationale: `CONTEXT.md` calls allocation "a behaviour to be measured", and the projection has its highest value there — savings is the one flow whose target the user actually decides.

Two consequences accepted: the pace is more fragile on allocation (deposits and divestments net under the same subcategory, so selling an ETF drags a month negative), and the copy cannot be reused — "where I spend the most", "% of total spent" and the outflow-coloured bar are wrong words on Risparmio. One copy set per direction.

### D10 — Year-over-year: superseded by D14

Resolved by the window rule: the comparison is **always against the homologous window of the previous year**. With window = full year that is the full previous year; with window = Jan–Mar it is Jan–Mar of the previous year. One rule, no special case.

### D11 — Coverage: a two-level rule

- **Mese Coperto** — a month with at least one Transaction for the user, in *any* category. This is the denominator of every average.
- A month with no transactions at all **does not exist** — it is excluded from the denominator, it is not a zero.
- Inside a Covered Month, a category with no movements is worth **€0 and counts**. Without this, every seasonal or occasional category (Salute, Regali) produces a projection inflated 3–6×.
- **Mese Parziale** — the current calendar month, excluded from averages. Operationally: if today is 30 July and data ends on the 28th, July is partial. If data stops in May and today is July, May is **not** partial — it is covered and concluded; the user simply stopped importing.

No presumption in either direction: one transaction is enough to know a month fully; an empty month tells us nothing. It is the user's job to give the dashboard valid data.

Accepted cost: the period **total** may be incomplete (uncovered months missing) while the average and projection are correct — two figures on the same row with different bases. Uncovered months therefore need an explicit visual signal, never a silent gap.

### D12 — The current month is worth `max(spent so far, pace)`

Rejected: plain pace (could display a projection **below** an already-observed fact — €300 shown while €480 is already spent), and `spent + pace × remaining-days` (assumes uniform daily spend, which is false precisely for rent/instalments/utilities concentrated at the start of the month, so it overstates systematically). `max()` is conservative and explainable in one sentence. Consequence: the current month is a **hybrid** — neither fact nor pure estimate — and needs a third visual state, distinct from past (facts) and future (estimates).

### D13 — Totals and signs

- **The period total is the sum of the displayed series.** No separate projection formula to keep in sync: the big number is the sum of the numbers above it, and if it does not add up that is a visible bug.
- **In the data, always `current − previous`** — the app's single existing convention (`lib/dal/overview.ts`: "negative = spent less (saved money)").
- **In the UI, never a sign**: magnitude plus a word — "€180 **in meno** dell'anno scorso". Nobody says "my annual delta is minus one hundred eighty". Decisive reason: sign conventions invert between directions (on `out` more is worse, on `allocation` more is better), so no single convention survives D9 — while the words stay correct in both cases.
- Colour therefore carries the judgement and must be mapped **per direction**, centrally, not per widget.
- **Average-vs-average is robust to coverage gaps** (previous year with 5 covered months → total/5, comparable); **total-vs-total is not**. So the coverage threshold on the previous year gates only the total difference; the averages always show.

### D14 — The window redefines every number

Detail window: full year, or 9/6/3 months with a chosen start month. Everything on the page refers to **the selected window**, including the final column (window average vs the same window of the previous year; total difference over the same months). A figure referring to a period the page does not display is the original bug of this page, generalised — not a feature.

**Corollary (the non-obvious half):** the window selects what you *see and sum*, **not** what the pace is computed on. Counter-example: it is July and the window is Oct–Dec 2026 — no Covered Month exists inside it, so a window-scoped pace would have nothing to read. Therefore the pace is always the average of the Covered Months **of the selected year**, window or no window.

Accepted cost: in January the selected year has at most one partial month → no estimate, the view is nearly mute. Rejected the alternative (pace reading the last 12 months across the year boundary) because "current-year average" in the final column and "pace for future months" would become two different numbers and the series would stop summing to the total. In January the useful reading is the closed previous year, which is complete.

### D15 — The Deviation is retired from the product

Not moved, not re-anchored: removed. Replaced by the month-over-month delta inside the series and the homologous-window year comparison. Reasons: the Deviation is **not verifiable by eye** (it compares against a 3-month average drawn nowhere, so the user must trust it); keeping it would first require paying down D-12, i.e. fixing the anchor of a concept being replaced; and the €15 Noise Threshold exists only to stop its percentages from exploding on micro-amounts, so it goes with it.

**Accepted loss, not masked:** slow drift. A category rising 12% a month for three months shows three small, innocuous deltas while the cumulative deviation against baseline is 40%. The 12-month series makes the climb visible to the eye and the homologous-window comparison catches it in aggregate — a mitigation, not a wash.

### D16 — Subcategory "influence" = weight, plus contribution to the difference

Default ordering by **weight** (share of the window total) because it is always defined — an ordering that disappears when the previous year is uncovered is not an ordering. Second figure per row: **contribution to the difference** vs the homologous window of the previous year ("Alimentari is €180 more: €150 from `spesa-quotidiana`, €30 from `caffè-bar`").

The contributions **sum exactly** to the parent category's difference — the verifiability property this whole design is built on, and it returns part of what D15 gave up, in a more actionable form than "deviates 40% from baseline".

**Arithmetic trap to respect:** a subcategory present in only one of the two periods contributes its whole amount with the right sign, and the sum only keeps adding up if **disappeared subcategories stay in the list** with their negative contribution. The list therefore cannot show only the current period's subcategories, or verifiability — the sole reason for choosing this measure — breaks.

### D17 — List controls and ordering

List: **year + direction only**. No window; the window is the detail's analysis tool. The coherence test that distinguishes this from the incoherence being fixed: **clicking a row must not change the numbers** — a full-year list opens a full-year detail. Had the window lived on both, it would need URL propagation and would immediately re-raise D14 across 26 rows; and "projection to year end" loses meaning on a 3-month window.

Ordering: default **period total** (open on a fact), alternative **projection**. Reuses the existing `SortToggle`, replacing the retired "Deviazione" option — same component, same pattern, two options as today.

### D18 — First import (one Covered Month)

Not an edge case: it is what **every new user** sees first. Show what is certain (total, share, one-point series) **and state explicitly what is missing and how to get it** — "with a second imported month you will see the monthly pace and the year-end projection". Rejected: silent suppression (the user does not read "I am missing a month", they read "this page does nothing", with no way to discover otherwise) and an empty state (throws away real data for a threshold rule). The product already has this pattern in `OverviewNudge`.

Same treatment for the annual total difference when the previous year is uncovered: not an absent number, a line saying why. A number that vanishes without explanation reads as a bug.

## What gets retired

**Code.** `getCategoryDeviations`, `getDeviationDateRanges`, `buildDeviationDataset`, `buildDeviationMap`, `DEVIATION_NOISE_THRESHOLD`, `DeviationBadge` — referenced only by the two Categories pages and `category-subcategory-breakdown.tsx`, nowhere else in the app. Plus the whole Preset machinery (`parseDashboardFilters`, `dashboardPresetToDateRange`, `DashboardPreset`, `dashboard-filters.tsx`, the preset helpers in `lib/routes.ts` and `lib/utils/date.ts`), used only by the same two pages — Overview works on `?year=`. Plus the dead `tag` parameter in `buildDashboardTabHref`.

**Vocabulary.** Deviation, Baseline, Noise Threshold, Preset, and Reference Period in its sense of "the Deviation's anchor". `CONTEXT.md`'s *Example dialogue* was built entirely on Deviation and Baseline and is rewritten. Debt **D-12** is extinguished rather than paid.

## Deliberately left open (plan / UI phase)

- Coverage threshold on the previous year for the total difference (proposed: ≥6 Covered Months).
- Copy set and colour mapping per direction, `allocation` included.
- The name of the "annual estimate vs closed year" comparison — it cannot be called *delta* (reserved for KPI period-over-period) nor *deviation* (retired).
- Visual treatment of the three month states (fact / current hybrid / estimate) and of uncovered months — an explicit signal, not a gap.
- URL shape of the detail window (start month + length).
- Whether the tab nav preserves `?lens=` invisibly (recommended: yes).
- Fate of the detail page's current `topTransactions` block.
- Whether the list also offers an **acceleration** ordering (projection ÷ total) alongside total and projection — see the prototype finding below.

## D19 — Prototype outcome: the detail series is a table (chosen 2026-07-30)

**Variant A (12-month table) is locked.** Prototypes in `.scratch/dashboard-categories/` (`detail-table.html` chosen, `detail-chart.html` rejected, `list-row.html` validated).

Shape: months as columns, a 2026 row and a 2025 row (same window), month-over-month delta inside each cell as a second text line, and a sticky summary column at the right end carrying total, monthly average and the comparison. First column sticky left, horizontal scroll below ~1040px.

The deciding argument surfaced while building the prototypes, not during the grill: **the chart cannot honour D13**. "24,30 in meno" does not fit above a 60px bar, so variant B had to fall back to ▲/▼ glyphs — reintroducing exactly the sign convention D13 removes — or push the deltas into tooltips, where they stop being readable at a glance. The table is the only shape that keeps month-over-month deltas visible without interaction, and it additionally makes the previous-year comparison legible **per month** rather than only in aggregate.

Carried over from the table prototype, for the UI phase: the total and the average have denominator 11 in the reference scenario (March uncovered) — decide whether that is stated in words or carried by the hatching alone; the 2025 row is nearly empty on a 3-month window (always shown, or only on long windows?); "non importato" written inside a cell is wider than a value and disturbs column alignment.

**Second prototype finding — ordering.** In the sample data, Cultura & Tempo libero visibly accelerates (rising sparkline, projection 2.4× its total) yet still sorts below Trasporti under *projection* ordering, because Trasporti simply spends more in absolute terms. The figure that isolates acceleration is **projection ÷ total**, not the projection. Whether that becomes a third ordering option is open (see above).
