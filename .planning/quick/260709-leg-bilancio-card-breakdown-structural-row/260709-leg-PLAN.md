# Quick Task 260709-leg: Bilancio card breakdown (totale + ricorrente)

## Goal

Parity with the Entrate card (260709-lan): the Bilancio card shows the structural
(recurring-only) balance as a breakdown row under the total headline. Everything needed
already exists: `OverviewData.structuralBalance` (kp1) and the `ReadingKpiCard.breakdown`
slot (lan).

## Design

- Headline: `balance` (unchanged, reconciles with neighbors).
- Breakdown row: `Ricorrente: {formatEur(structuralBalance)}` — one row only (the
  "Straordinarie" amount already lives on the Entrate card; repeating it here would be
  cross-card redundancy).
- `structuralBalance === null` → no breakdown (card as before).
- The kp1 warn reading stays: the row gives the number, the reading gives the
  interpretation/sentiment.

## Tasks

### 1. kpi-row.tsx
- Bilancio `ReadingKpiCard` gains
  `breakdown={data.structuralBalance !== null ? [{ label: 'Ricorrente', value: formatEur(data.structuralBalance) }] : undefined}`.

### 2. Test (tests/overview-interactions.test.tsx or dashboard suite)
- Static render of KpiRow (or targeted assertion) with structuralBalance present →
  "Ricorrente" row rendered; null → absent. If KpiRow needs too much fixture plumbing,
  assert via ReadingKpiCard composition already covered + a small KpiRow static render.

## Verify
- Affected suites + full run green; tsc clean; check:language clean.

## Out of scope
- No changes to reading logic, other cards, or DAL.
