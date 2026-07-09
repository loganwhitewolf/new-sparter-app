---
quick_id: 260709-kp1
description: Structural balance reading on the Bilancio KPI card (decision B+)
date: 2026-07-09
status: complete
---

# Quick Task 260709-kp1 — Summary

## Decision (B+, discussed 2026-07-09)

The Bilancio card's headline stays `totalIn − totalOut` (reconciles with the
Entrate/Uscite cards); the **reading** becomes structural-aware and carries its
evidence. Structural balance = recurring income only (`nature.code = 'income'`,
excludes `income_extraordinary`) minus totalOut. Domain basis: extraordinary income is
only new non-recurring money (refunds net inside OUT, divestments are negative
allocation), so excluding it is semantically sound.

Reading matrix:

| totale | strutturale | reading | sentiment |
|---|---|---|---|
| > 0 | ≥ 0 | Spendi meno di quanto guadagni | good |
| > 0 | < 0 | Senza le entrate straordinarie saresti a −X € | warn |
| < 0 | any | Spendi più di quanto guadagni | bad |
| = 0 | any | Sei in pareggio | neutral |

## What changed

- **`lib/dal/dashboard.ts`** — `getOverviewAmountTotals` gains `totalInRecurring`
  (override-aware nature join already in place; same effectiveAmount/netting semantics).
  `OverviewAggregateRow.totalInRecurring` is optional (absent → unknown).
  `buildOverviewData` derives `structuralBalance: string | null`; no delta (feeds the
  reading, not a trend chip). Fallback literals updated.
- **`lib/dal/overview.ts`** — catch-fallback literals carry the new field.
- **`components/dashboard/overview/kpi-row.tsx`** — `balanceReading(balance, structural)`
  per the matrix; `structural === null` degrades to legacy behavior. Both `getOverview`
  variants (year + preset) flow through the shared pipeline, so the old dashboard route
  benefits too.

## Verification

- Full suite: **1415/1415 green** (includes new `balanceReading` matrix tests and
  `buildOverviewData` structural fixtures: extraordinary-heavy year → balance +2400 /
  structural −1100; all-recurring → structural = balance; missing field → null).
- `tsc --noEmit` clean on touched files; `check:language` clean (reading strings are
  product surface → Italian).

## Deferred / flagged

- **Tasso risparmio** still computed on total income — explicitly unchanged this round.
- **Freelance/variable-income profile**: most income lands in `income_extraordinary`
  (CONTEXT.md line 129) → the warn will fire chronically for that profile. Honest but
  noisy; future work if needed (recurrence flag or user profile), noted in discussion.

## Commits

- `bc082e0` feat: structural balance in overview DAL
- `2a2094d` feat: Bilancio reading exposes extraordinary-income masking (B+)
