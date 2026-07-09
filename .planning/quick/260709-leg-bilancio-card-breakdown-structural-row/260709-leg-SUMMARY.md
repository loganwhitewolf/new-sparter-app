---
quick_id: 260709-leg
description: Bilancio card breakdown (totale + ricorrente)
date: 2026-07-09
status: complete
---

# Quick Task 260709-leg — Summary

## Goal

Parity with the Entrate card (260709-lan): the Bilancio card shows the structural
(recurring-only) balance as a breakdown row under the total headline — the number the
kp1 warn reading refers to.

## What changed

- **`kpi-row.tsx`** — Bilancio `ReadingKpiCard` gets
  `breakdown=[{ label: 'Ricorrente', value: formatEur(structuralBalance) }]` when
  `structuralBalance !== null`, else no breakdown (card as before). One row only:
  "Straordinarie" already lives on the Entrate card, repeating it here would be
  cross-card redundancy.
- **`tests/overview-interactions.test.tsx`** — static `KpiRow` render: fixture with
  structural −1100 / recurring 1500 → Entrate shows Ricorrenti+Straordinarie, Bilancio
  shows Ricorrente, amounts rendered; null fields → no breakdown rows anywhere.

Everything reused: `OverviewData.structuralBalance` (kp1) + `ReadingKpiCard.breakdown`
slot (lan). No DAL or reading-logic changes.

## Verification

- Full suite **1419/1419 green**; `tsc --noEmit` clean on touched files;
  `check:language` clean.

## Commits

- `20e7021` feat: Bilancio card shows structural (recurring-only) balance row
