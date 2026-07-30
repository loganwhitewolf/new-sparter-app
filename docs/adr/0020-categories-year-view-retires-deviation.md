# The Categories view reads a year of pace, is cash-only, and retires the Deviation

## Status

accepted (amends **LENS-01** of [ADR 0019](./0019-amortization-accrual-lens.md) — the lens is no longer global across all four dashboard sub-routes; retires the Deviation / Baseline / Noise Threshold / Preset vocabulary from [CONTEXT.md](../../CONTEXT.md); locked design in [.planning/dashboard-categories-DECISIONS.md](../../.planning/dashboard-categories-DECISIONS.md))

## Context

The dashboard carried three unrelated temporal models across its three tabs: Overview on `?year=` plus an in-page month selection held in client state, Categories on `?preset=` (a rolling window anchored to `new Date()`, with no year at all), Tags all-time.

Inside Categories the incoherence was sharper than a mere mismatch. The ranking was filtered by the preset, but the Deviation badge — which was also the **default sort key** — called `getDeviationDateRanges()` with no arguments, so it always meant "previous calendar month vs the 3 months before it" no matter what `?preset=` said. With `?preset=this-year` the list and the badge described different periods, and the list was ordered by the one the page never named.

That anchor was also already known to be wrong. `CONTEXT.md` defines the Reference Period as the last month *with data* (query-derived), while the Deviation engine used the last *calendar* month — the drift tracked as deferred debt **D-12**. Its user-visible symptom: a user who had not imported for two months saw an empty Categories page while Overview still showed data.

Two further facts shaped the decision. First, the Deviation machinery (`getCategoryDeviations`, `getDeviationDateRanges`, `buildDeviationDataset`, `DeviationBadge`) and the entire Preset machinery (`parseDashboardFilters`, `dashboardPresetToDateRange`, `DashboardPreset`, `dashboard-filters.tsx`) are referenced **only** by the two Categories pages — nothing else in the app depends on either. Second, `ledger_entry_accrual` exposes five columns (`id, user_id, occurred_at, expense_id, amount`) with no discriminator between a transaction row and an instalment row, so any calculation needing to separate "ordinary spending" from "amortization instalments" would require adding a `source` column to the lens views — reintroducing precisely the per-lens branching that ADR 0019's one-row-source-per-lens seam exists to prevent.

## Decision

**1. The year is the container; the pace is the reading.** The Categories list answers "where am I spending the most this year" over a full year, with no month selection and no rolling preset. The detail page answers "how is this category going" as a month-by-month series with month-over-month deltas, over the full year or a 9/6/3-month window with a chosen start month. Only `?year=` is shared with Overview — `month` never enters the URL, so Overview's chip/month client state is untouched.

**2. Every figure refers to the selected window.** Including the final comparison column: window average vs the **homologous window of the previous year**, and the total difference over the same months. With window = full year this degenerates to the full previous year, so it is one rule with no special case. A figure describing a period the page does not display is the original defect of this page, generalised.

**3. The pace is the average of Covered Months of the selected year** — not of the window. A window can legitimately contain no covered month at all (it is July and the window is Oct–Dec), so a window-scoped pace would have nothing to read.

**4. Coverage is a property of the month on the account, not of the category.** A month with at least one Transaction for the user — in any category — is a Covered Month, and inside it a category with no movements is worth **€0 and counts**. A month with no transactions at all is excluded from the denominator: it is not a zero, it does not exist. This is the load-bearing rule of the whole design: without it every seasonal category (Salute, Regali) yields a projection inflated three- to sixfold, because its average would be computed only over the months in which it happened to fire. The only assumption the product makes is that the current and future months are incomplete; everything else follows from what was imported.

**5. The current month is worth `max(spent so far, pace)`.** A projection must never display less than an already-observed fact. Per-day pro-rating was rejected because it assumes uniform daily spending, which is false exactly for the concentrated fixed items (rent, instalments, utilities) and therefore overstates systematically.

**6. The period total is the sum of the displayed series.** There is no separate projection formula to keep aligned with the chart: the large number is the sum of the numbers above it, and any divergence is a visible bug rather than a silent one.

**7. Categories is lens-invariant, and the lens switch renders only on Overview** — removed from Categories and from Tags. Amortization is a property of a single Transaction, not a way of reading a category's spending, and pace is by construction a cash reading: spreading a €2.400 laptop over 24 months makes the monthly rhythm *less* legible, not more. This also dissolves the instalment/pace double-counting problem instead of engineering around it — with no future instalment rows in view, there is nothing to double count, and the `source` column on the lens views is not needed.

**8. The Deviation, the Baseline, the Noise Threshold and the Preset are retired from the product** — code and vocabulary. They are replaced by the month-over-month delta inside the series, the homologous-window year comparison, and per-subcategory contribution to the difference. The decisive argument is verifiability: the Deviation compares against a three-month average that is drawn nowhere on screen, so the user can only trust it, whereas a month-over-month delta and a year comparison can both be checked against the series above them. Keeping the Deviation would also have required first paying down D-12 — fixing the anchor of a concept being replaced.

**9. Direction coverage widens to three.** The filter offers Uscite / Entrate / **Accantonamenti**: the predicate becomes `eq(direction.hidden, false)` (true for `in`/`out`/`allocation`, false for `transfer`) instead of `eq(direction.includedInTotals, true)`, which silently excluded allocation. Savings and investments are the one flow whose target the user actually decides, which makes them the highest-value place for a projection.

**10. Signs live in the data, words live in the UI.** Stored comparisons keep the app's single existing convention (`current − previous`, negative = spent less). The UI shows no sign at all: magnitude plus a word — "€180 in meno dell'anno scorso". With allocation included (decision 9) no single sign convention can be correct on one screen, since on `out` more is worse and on `allocation` more is better; the words stay correct in both, and the colour carries the judgement, mapped per direction in one place.

## Consequences

A category containing an amortization now reads differently in two tabs of the same dashboard: €2.400 in August under Categories (always cash), €100/month under Overview-competenza. This is the price of decision 7 and it is deliberate — recorded here because a future reader would otherwise see it as a bug and "fix" it by re-threading the lens.

The lens stops being a dashboard-global control and becomes an Overview control. LENS-01's wording ("one switch flips every widget across all four dashboard sub-routes") no longer describes the product; Tags was already a de facto exception (all-time totals make the lens a no-op).

Slow drift loses its dedicated detector. A category climbing 12% a month for three months produces three small month-over-month deltas while its cumulative deviation from baseline would have been 40%. The 12-month series makes the climb visible and the homologous-window comparison catches it in aggregate, but this is a mitigation, not an equivalence — it is the one capability the retirement in decision 8 gives up.

Two figures on a page can rest on different bases: with an uncovered month in the middle of a window, the **total** is incomplete while the average and the projection are correct. Uncovered months therefore require an explicit visual signal; a silent gap would read as a month of zero spending.

The current month becomes a third visual state — neither a fact like past months nor an estimate like future ones — and is the only month whose value can change while it is being looked at.

Debt D-12 is extinguished rather than paid: the drift between "last month with data" and "last calendar month" disappears with the engine that had it.

New users see the page in its degenerate state (one Covered Month, no pace, no projection, no comparison). It is treated as a prompt to import the next month rather than as a missing feature, following the existing `OverviewNudge` pattern.
