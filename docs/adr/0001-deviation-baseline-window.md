# 3-month window for deviation baseline

The dashboard deviation feature compares a Reference Period (last completed month) against a Baseline computed as the average of the 3 preceding calendar months, not 1 month (point-to-point) or 6+ months.

A single month comparison is too volatile: one exceptional month makes the next look abnormal regardless of behavior. A 6-month window is more stable but reflects habits that may be 6 months stale, and requires more import history before producing meaningful signals. 3 months is the shortest window that smooths individual outliers while remaining recent enough to reflect current spending patterns.

## Considered Options

- **1 month (point-to-point):** simple but volatile — a cheap March makes April always look expensive.
- **3 months:** chosen — stable enough to smooth outliers, recent enough to reflect current habits.
- **6 months:** more stable but requires 6+ months of import history and may reflect outdated patterns.

## Consequences

If fewer than 3 months of data precede the Reference Period, the Baseline is computed from however many months are available. The Deviation is still shown — callers must not require exactly 3 data points.
