# Quick Task 260709-lkw: Uscite card breakdown (essenziali / discrezionali / debiti)

## Goal

Same treatment as the other KPI cards: the Uscite card shows the spending split by
nature under the total. User asked for essential/discretionary; Debiti is included as
the third OUT nature so the rows reconcile with the headline (same trio as the chart's
Uscite chip group).

**Labels provisional** — cross-card label review follows.

## Tasks

### 1. DAL aggregate (lib/dal/dashboard.ts)
- `getOverviewAmountTotals`: add per-nature OUT sums (abs of algebraic sum per nature,
  mirroring totalOut semantics):
  `totalOutEssential`, `totalOutDiscretionary`, `totalOutDebt`
  (`nature.code = 'essential' | 'discretionary' | 'debt'`).
- `OverviewAggregateRow`: optional nullable fields; update both fallback literals here
  and in overview.ts.
- `buildOverviewData` → `OverviewData.outByNature: { essential: string; discretionary:
  string; debt: string } | null` (null when any field is absent). No deltas.

### 2. kpi-row.tsx
- Uscite card: breakdown rows Essenziali / Discrezionali / Debiti (formatEur) when
  `outByNature !== null`.

### 3. Tests
- dashboard-dal: fixture propagation (values + null case).
- overview-interactions KpiRow render: rows present / absent.

## Verify
- Full suite green; tsc clean on touched files; check:language clean.

## Out of scope
- Final label wording (cross-card review next).
- No reading changes on the Uscite card.
