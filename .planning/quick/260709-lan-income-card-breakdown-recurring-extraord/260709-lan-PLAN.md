# Quick Task 260709-lan: Entrate card breakdown (totale + ricorrenti + straordinarie)

## Goal

Follow-up of 260709-kp1: the "Totale entrate" KPI card shows only the aggregate. Show
the composition: headline stays the total, with a compact breakdown underneath —
Ricorrenti X € / Straordinarie Y €. Gives the user the "why" that the structural
Bilancio warn refers to.

## Tasks

### 1. Expose totalInRecurring on OverviewData
- `buildOverviewData` already receives `totalInRecurring` (added in kp1 for
  structuralBalance) — propagate it: `OverviewData.totalInRecurring: string | null`
  (null when the aggregate row lacks it).

### 2. ReadingKpiCard optional breakdown slot
- `breakdown?: Array<{ label: string; value: string }>` rendered under the value:
  text-xs, muted label + tabular-nums amount per row. No layout change when absent.

### 3. Entrate card wiring (kpi-row.tsx)
- When `totalInRecurring !== null`: breakdown rows Ricorrenti = totalInRecurring,
  Straordinarie = totalIn − totalInRecurring (Decimal.js, never native arithmetic).
- Null → no breakdown (card renders exactly as today).

### 4. Tests
- dashboard-dal: buildOverviewData propagates totalInRecurring (value + null case).
- overview-interactions: static render of ReadingKpiCard with breakdown → rows present;
  without breakdown → markup unchanged shape.

## Verify
- Affected suites green, full run green; tsc clean on touched files; check:language clean
  (breakdown labels are product surface → Italian correct).

## Out of scope
- No breakdown on other cards; no chart/DAL query changes (field already aggregated).
