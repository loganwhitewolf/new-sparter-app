---
quick_id: 260709-lan
description: Entrate card breakdown (totale + ricorrenti + straordinarie)
date: 2026-07-09
status: complete
---

# Quick Task 260709-lan — Summary

## Goal

Follow-up of 260709-kp1: the "Totale entrate" KPI card shows the composition —
headline stays the total, with compact rows underneath: Ricorrenti X € /
Straordinarie Y €. Gives the user the "why" behind the structural Bilancio warn.

## What changed

- **`lib/dal/dashboard.ts`** — `OverviewData.totalInRecurring: string | null`
  propagated from the aggregate row (field already computed in kp1 for
  structuralBalance; no new query work).
- **`kpi-card-reading.tsx`** — optional `breakdown?: Array<{label, value}>` slot under
  the headline value (text-xs, muted label + tabular-nums amount). Absent/empty →
  markup identical to before.
- **`kpi-row.tsx`** — Entrate card passes Ricorrenti (from DAL) + Straordinarie
  (derived `totalIn − totalInRecurring` via Decimal.js). Null field → no breakdown.

## Verification

- Full suite **1417/1417 green** (new: DAL propagation incl. null case; static render
  of the breakdown slot present/absent, absent === empty markup).
- `tsc --noEmit` clean on touched files; `check:language` clean (row labels are product
  surface → Italian).

## Commits

- `91dbd3e` feat: Entrate card shows ricorrenti/straordinarie breakdown

## Out of scope

- No breakdown on other cards; savings-rate unchanged (per kp1 decision).
