# Month as the temporal filter unit (no free date range)

All table filters that are temporal filter by **calendar month(s)**, not by arbitrary date ranges. The domain is month-quantized end to end (Reference Period, Baseline, Months Covered, expense period presets), and intra-month ranges like "10–20 May" have no real personal-finance use case. The month picker is multi-select over `(year, month)` pairs, offers **only months that actually contain data** (derived like Months Covered), and relative presets ("last 3 months") are optional shortcuts that resolve to concrete month selections so the user always sees *which* months are active.

The same month primitive is rendered in two places: as the temporal filter control, and as the month tags shown on the Files table — the file's coverage *is* its set of months, replacing any "coverage date range" field.

## Considered Options

- **Free date range (`from`/`to`)** — rejected. Already the current model on Transactions/Files; flexible but unaligned with a month-grained domain, and the flexibility is never used.
- **Single contiguous month range (month-from → month-to)** — rejected. Simpler SQL (one `BETWEEN`) but can't express non-contiguous comparisons (April vs June).
- **Multi-select month set** — chosen. Matches how users think ("April, May, June"); compiles to an OR of per-month ranges.

## Consequences

- URL param format changes from `from`/`to` dates to a month-set encoding (e.g. `months=2026-04,2026-05`).
- Filtering transactions by month = OR of per-month `[start, end)` ranges on `occurredAt` (transactions have no month column).
- The month picker must query distinct months-with-data per table; cheap but a new query.
- **Expenses have no temporal filter at all** — an Expense is a live aggregate whose covered range expands on every new import, so no date is meaningful for it. This is a deliberate, domain-justified omission, not an inconsistency.
