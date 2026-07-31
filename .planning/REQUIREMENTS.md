# Requirements: Sparter — v3.0 Categories Year View

**Defined:** 2026-07-30
**Core Value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending.

Design source of truth: `.planning/dashboard-categories-DECISIONS.md` (19 locked decisions, D1–D19) and [ADR 0020](../docs/adr/0020-categories-year-view-retires-deviation.md). Requirement IDs below reference the decision that fixed them.

## v3.0 Requirements

### Number engine — pace, coverage, projection

- [x] **PACE-01**: A month with no transactions at all for the user is excluded from every average, while a Covered Month in which the category has no movement counts as €0 and pulls the average down (D11)
- [x] **PACE-02**: The current calendar month is excluded from every average as a Partial Month; a month whose data simply ended (import stopped) is not partial (D11)
- [x] **PACE-03**: The user sees a monthly pace and a projection only when the selected year has at least 2 Covered Months; below that threshold no estimate is produced anywhere (D4)
- [x] **PACE-04**: The current month is valued at the greater of spent-so-far and the pace, so a projection never displays less than an already-observed amount (D12)
- [x] **PACE-05**: The period total equals the sum of the displayed monthly series — no independently computed projection figure exists (D13)
- [x] **PACE-06**: Every comparison is stored as `current − previous` and rendered without a sign — magnitude plus a word ("€180 in meno") — with judgement colour resolved per direction in a single place (D13)

### Categories list

- [x] **CLIST-01**: The user sees the selected year's categories ranked by total, each with its share of the total and a 12-month sparkline (D1, D8)
- [x] **CLIST-02**: Each row shows the year-end projection alongside the total, visually subordinate to it and explicitly labelled (D8)
- [ ] **CLIST-03**: The user can re-order the list by projection instead of total (D17)
- [x] **CLIST-04**: The user can switch the list between Uscite, Entrate and **Accantonamenti**, the last of which is currently unreachable on this page (D9)
- [ ] **CLIST-05**: The selected year is shared with Overview through the URL, so moving between the two tabs preserves it (D7)
- [x] **CLIST-06**: With a single Covered Month the user sees the certain figures plus an explicit statement of what is missing and how to obtain it (D18)
- [ ] **CLIST-07**: Clicking a category opens its detail on the same period, so the total read in the row is the total read on the page (D17)

### Category detail

- [ ] **CDET-01**: The user reads the category as a 12-month table with the month-over-month difference inside each month's cell (D19, D14)
- [ ] **CDET-02**: A previous-year row lets the user compare month by month, not only in aggregate (D19)
- [ ] **CDET-03**: The user can narrow the window to 9, 6 or 3 months from a chosen start month, and every figure on the page then refers to that window (D14)
- [ ] **CDET-04**: A summary column closes the series with the period total, the monthly average, and the difference against the homologous window of the previous year (D13, D14)
- [ ] **CDET-05**: Subcategories are ordered by weight and each carries its contribution to the difference, the contributions summing exactly to the parent category's difference — including subcategories present only in the previous period (D16)
- [ ] **CDET-06**: Covered, current and estimated months are visually distinguishable from each other and from uncovered months, which are explicitly marked rather than left as gaps (D11, D12)
- [ ] **CDET-07**: When the previous year is not sufficiently covered the total difference is replaced by a stated reason, while the average comparison still shows (D13, D18)

### Retirement and cleanup

- [ ] **RETIRE-01**: The Deviation, Baseline and Noise Threshold disappear from the interface and from the codebase, with no dead references left behind (D15)
- [ ] **RETIRE-02**: The Preset temporal filter is removed from Categories together with its shared machinery, with no regression on any surface that used its helpers (D1, D15)
- [x] **RETIRE-03**: The cassa/competenza lens switch renders only on Overview; Categories always reads cassa and Tags no longer displays a disabled switch (D6)
- [x] **RETIRE-04**: Dashboard tab navigation carries only the parameters that are actually read, dropping the `tag` parameter dead since v2.7 (D7)
- [x] **RETIRE-05**: Overview and Tags produce byte-identical totals before and after the rewrite, proven by regression tests ahead of any UI work (D6, ADR 0020)

## Future Requirements

Acknowledged, deliberately not in this milestone.

### Categories

- **CLIST-F01**: Ordering by acceleration (projection ÷ total), which isolates a category rising fast from one that is merely large — the prototype showed projection ordering may not reorder enough on its own (D19)
- **CDET-F01**: Slow-drift detection, the one capability the Deviation retirement gives up: a category rising steadily for several months produces only small month-over-month deltas (D15)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Month selection on the Categories list | The list is always the whole year; month-level reading is the detail page's job (D8) |
| Window selector on the Categories list | Would force URL propagation and make "projection to year end" meaningless on a 3-month window (D17) |
| Competenza lens on Categories | Amortization is a property of a single transaction, not of a category's spending; pace is by construction a cash reading (D6) |
| `source` discriminator column on the lens views | Would reintroduce the per-lens branching ADR 0019's seam exists to prevent; made unnecessary by the cash-only decision (D5) |
| Moving Overview's month selection into the URL | Not needed — the list has no month and the detail shows all months, so Overview stays untouched (D7) |
| Predictive forecasting ("you will close at €X") | The product states a projected pace, never a prediction; seasonality and partial imports do not support the stronger claim (D3) |
| Per-day pro-rating of the current month | Assumes uniform daily spending, which is false exactly for concentrated fixed costs, and overstates systematically (D12) |
| Re-anchoring the Deviation to the last Covered Month | Would require paying down debt D-12 to keep a concept being replaced (D15) |
| Deploy to Coolify (R038 / R039 / R041) | Still pending, still the next candidate milestone — not this one |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PACE-01 | Phase 82 | Complete |
| PACE-02 | Phase 82 | Complete |
| PACE-03 | Phase 82 | Complete |
| PACE-04 | Phase 82 | Complete |
| PACE-05 | Phase 82 | Complete |
| PACE-06 | Phase 82 | Complete |
| CLIST-01 | Phase 83 | Complete |
| CLIST-02 | Phase 83 | Complete |
| CLIST-03 | Phase 83 | Pending |
| CLIST-04 | Phase 83 | Complete |
| CLIST-05 | Phase 83 | Pending |
| CLIST-06 | Phase 83 | Complete |
| CLIST-07 | Phase 83 | Pending |
| CDET-01 | Phase 84 | Pending |
| CDET-02 | Phase 84 | Pending |
| CDET-03 | Phase 84 | Pending |
| CDET-04 | Phase 84 | Pending |
| CDET-05 | Phase 84 | Pending |
| CDET-06 | Phase 84 | Pending |
| CDET-07 | Phase 84 | Pending |
| RETIRE-01 | Phase 84 | Pending |
| RETIRE-02 | Phase 84 | Pending |
| RETIRE-03 | Phase 82 | Complete |
| RETIRE-04 | Phase 82 | Complete |
| RETIRE-05 | Phase 82 | Complete |

**Coverage:**

- v3.0 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-30*
*Last updated: 2026-07-30 — roadmap created: 25/25 requirements mapped across Phases 82-84 (number-engine-and-regression-gate, categories-list, category-detail-and-cleanup), no orphans.*
