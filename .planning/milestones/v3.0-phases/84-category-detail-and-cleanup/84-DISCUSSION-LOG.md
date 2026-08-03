# Phase 84: category-detail-and-cleanup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-03
**Phase:** 84-category-detail-and-cleanup
**Areas discussed:** Finestra: URL e default, Anatomia della pagina, Tabella: stati e parole, Meccanica del ritiro

---

## Finestra: URL e default

### Encoding

| Option | Description | Selected |
|--------|-------------|----------|
| `?months=6&from=2026-04` | Two params mirroring the two prototype controls; additive on the existing `?year=&type=` contract | ✓ |
| `?from=&to=` | Explicit interval; admits 7-month windows the UI cannot represent, needs normalising at parse | |
| `?window=2026-04:6` | Single compact param; custom format, hand-parsed, harder to debug | |

**User's choice:** `?months=` + `?from=`, `months ∈ {12,9,6,3}` (absent = whole year), `from = YYYY-MM` (absent = January).

### Preselected start month on a reduced window

| Option | Description | Selected |
|--------|-------------|----------|
| Window ending on the current month | 6 months → feb–jul in July; on a closed year ends on December | ✓ |
| Always January | Simplest rule, but excludes the recent months the user usually wants | |
| Last N covered months | Anchored to the last month with data; unpredictable, reintroduces a query-derived anchor like the one D-12 extinguished | |

### Year boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Start months restricted so the window fits the year; out-of-range URL clamped | Keeps the year the container; pace and homologous window stay well-defined | ✓ |
| Window may cross into the next year | Would leave pace anchored to one year while the table shows another | |
| Window shortened to fit | Control says "6 mesi" while showing 2; denominator changes silently | |

### Changing year with an active window

| Option | Description | Selected |
|--------|-------------|----------|
| Window preserved, re-anchored to the new year | Comparing the same window across two years is the gesture the window exists for | ✓ |
| Window reset to whole year | More predictable, but forces reselection on every year-over-year comparison | |

**Notes:** The back-link to the list never carries `months`/`from` — the list has no window (DECISIONS D17).

---

## Anatomia della pagina

### `topTransactions`

| Option | Description | Selected |
|--------|-------------|----------|
| Stays, below the subcategories, window-scoped | The only bridge to real transactions; answers "what was it?" after an anomalous month | ✓ |
| Removed | Less surface to port, but the user cannot explain a spike without leaving the page | |
| Becomes a per-month drill-down | More powerful and coherent with the table, but a new capability | |

### Direction filter

| Option | Description | Selected |
|--------|-------------|----------|
| Disappears; direction derived from the category | Copy/colour from `resolveCategoryDirectionCopy`; back-link uses that direction; `?type=` no longer read | ✓ |
| Control gone but `?type=` kept as passthrough | Equivalent in practice, one more param to defend from dirty input | |
| Control stays | Nothing to filter on a single-category page | |

### Summary and trend chart

| Option | Description | Selected |
|--------|-------------|----------|
| Both removed, subsumed by the table | Summary column = summary, month rows = chart, plus deltas in clear | |
| The chart stays above the table | A glance before the numeric detail | ✓ |
| The summary stays as a KPI header | Duplicates the summary column | |

**Notes:** Flagged that the chart must consume the same series object the table renders, never its own query, or the divergence D13 closes reopens.

### What the chart plots

| Option | Description | Selected |
|--------|-------------|----------|
| Two series (current + previous year) | The "am I above or below last year" glance | |
| Current year only | Closest to the existing `CategoryDetailTrendChart` | |
| Month-by-month difference only | Isolates the signal; flagged as in tension with D13 (no signs in the UI) | ✓ |

### Reconciling the difference chart with D13

| Option | Description | Selected |
|--------|-------------|----------|
| No signs: position + colour + words | Bars above/below zero, colour per direction via `resolveComparisonJudgement`, absolute axis, worded tooltip, legend explaining above/below | ✓ |
| Amend D13 for this widget | Explicit +/− on the chart; would require writing the exception into the ADR | |

**Notes:** The tension was raised explicitly before locking: D13 / ADR 0020 §10 forbids signs in the UI because no single sign convention survives the inclusion of `allocation`. Position and colour do the work the sign would have done, so the choice stands without amending the ADR.

---

## Tabella: stati e parole

### Reduced denominator

| Option | Description | Selected |
|--------|-------------|----------|
| Stated in the summary column | "su 11 mesi coperti" on the average, a note naming the uncovered month on the total | ✓ |
| Hatching is enough | The hatched cell is twelve columns from the number it affects | |
| Only the total is qualified | Formally more precise, but leaves the average's basis unexplained | |

### Previous-year row on short windows

| Option | Description | Selected |
|--------|-------------|----------|
| Always shown, even empty | Stable reading across windows | |
| Only on long windows | The 3-month window is exactly where the comparison is wanted | |
| Only when it has at least one Covered Month, otherwise a line stating why | Follows D18 ("not an absent number, a line saying why") | ✓ |

### Name of the comparison

| Option | Description | Selected |
|--------|-------------|----------|
| "Differenza" | Already used in the prototype, the requirements and D16 | |
| "Rispetto al 2025" | Names the compared period explicitly | ✓ |
| "Confronto" | Neutral, matches the Phase 82 code names | |

### Subcategory column label and glossary term

| Option | Description | Selected |
|--------|-------------|----------|
| Same label everywhere, glossary `Confronto` | "Rispetto al {anno-1}" in the UI; `Confronto` in glossary and code, already in use since Phase 82 | ✓ |
| Column called "Contributo", glossary `Confronto` | Shorter, but reads as "contribution to the total" — which is the Peso column beside it | |
| Glossary `Differenza` | Two words for the same thing, one in code and one on screen | |

---

## Meccanica del ritiro

### Deletion strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Hard deletion, files removed | ROADMAP's criterion is literally "a repo grep confirms zero dead references"; history lives in git | ✓ |
| `@deprecated` first, delete later | Makes sense for a public API with external consumers; here the callers reach zero in this phase | |

### Keeping the regression suites green

| Option | Description | Selected |
|--------|-------------|----------|
| Shared DAL moves to an explicit date range | Only the preset→range translation disappears; suites pass the same range and keep their expected values untouched | ✓ |
| Suites rewritten onto the year contract | Changes the period covered and therefore the expected values — loses the property the baselines exist for | |
| Before/after snapshot | Strong as a one-off proof, but a redundant artefact over suites that already cover those surfaces | |

### `CONTEXT.md` glossary

| Option | Description | Selected |
|--------|-------------|----------|
| Rewritten in this phase | Terms removed and added, example dialogue rewritten, debt D-12 marked extinguished | ✓ |
| Terms now, example dialogue later | Would leave canonical documentation describing a product that no longer exists | |
| Glossary out of scope | Downstream agents read that glossary for domain language | |

### Ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Build first, delete second, in separate plans | Removals-only diff, verifiable grep-at-zero, revertable without touching the feature | ✓ |
| One combined plan | A broken suite would not say which half broke it | |
| Delete first | Leaves the detail page broken mid-phase; ROADMAP says the opposite | |

---

## Claude's Discretion

- Exact Italian copy for the reduced-denominator notes, the missing-previous-year-row line, the
  uncovered-month cell text, the difference-chart legend and the CDET-07 stated reason.
- Visual treatment of the three month states and of uncovered months (prototype as reference).
- Rendering "non importato" in a cell without breaking column alignment.
- Mobile behaviour of the table, including whether the sticky summary column survives narrow viewports.
- Whether the table is a new component or a reshaping of `category-detail-trend-chart.tsx`.
- DAL shape for the window + previous-year series, and whether `getCategoryDetail` is reshaped or replaced.
- Test placement and fixture strategy.
- Plan decomposition inside the build-then-delete ordering.

## Deferred Ideas

- Acceleration ordering (projection ÷ total) as a third sort option on the list — open since Phase 83.
- Per-month drill-down from a table cell — raised while deciding the fate of `topTransactions`.
- Slow-drift detection (CDET-F01) — the accepted loss of the Deviation retirement, recorded not planned.
- Amending D13 to allow explicit signs on charts — considered and rejected in favour of the
  position + colour + words treatment.
