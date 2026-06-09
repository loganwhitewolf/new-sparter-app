---
phase: 43-overview-shell
plan: "01"
subsystem: dashboard/overview
tags: [dashboard, overview, kpi, formatting, components]
dependency_graph:
  requires:
    - lib/dal/dashboard.ts (OverviewData type)
    - lib/dal/overview.ts (getYearsWithData shape)
    - components/ui/card.tsx
    - components/ui/badge.tsx
    - components/ui/select.tsx
  provides:
    - components/dashboard/overview/format.ts (formatEur, formatEurCompact)
    - components/dashboard/overview/kpi-card-reading.tsx (ReadingKpiCard, Reading)
    - components/dashboard/overview/kpi-row.tsx (KpiRow)
    - components/dashboard/overview/overview-header.tsx (OverviewHeader)
  affects: []
tech_stack:
  added: []
  patterns:
    - Intl.NumberFormat module-scoped instances for currency formatting
    - Port proto components verbatim, rewire mock-data to real DAL types
key_files:
  created:
    - components/dashboard/overview/format.ts
    - components/dashboard/overview/kpi-card-reading.tsx
    - components/dashboard/overview/kpi-row.tsx
    - components/dashboard/overview/overview-header.tsx
  modified: []
decisions:
  - "formatEur uses maximumFractionDigits:0 — matches proto eur and codebase convention"
  - "formatEurCompact: >=1000 => k-notation (1 decimal it-IT), <1000 => rounded integer"
  - "KpiRow reading helpers: when delta is null, fallback to neutral reading (In linea con il {prevYear})"
  - "OverviewHeader renders years from prop (not mock AVAILABLE_YEARS); aria-label=Anno present"
metrics:
  duration: "6 minutes"
  completed: "2026-06-08T10:06:02Z"
  tasks_completed: 3
  files_created: 4
  files_modified: 0
---

# Phase 43 Plan 01: overview-shell — Production formatters + KPI components + OverviewHeader

**One-liner:** Ported PO-approved proto KPI row (ReadingKpiCard + reading helpers), production EUR formatters, and inline year-selector header into `components/dashboard/overview/` wired to real `OverviewData` DAL types.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Production number formatters | 069168f | components/dashboard/overview/format.ts |
| 2 | ReadingKpiCard + KpiRow | 72af265 | components/dashboard/overview/kpi-card-reading.tsx, kpi-row.tsx |
| 3 | OverviewHeader | 12c2fb2 | components/dashboard/overview/overview-header.tsx |

## What Was Built

### format.ts
- `formatEur(value: string | number): string` — Intl.NumberFormat it-IT currency EUR, 0 decimals; accepts DAL DECIMAL strings via `Number()`.
- `formatEurCompact(value: string | number): string` — values >=1000 render as "2,5k" (it-IT, 1 decimal max); below 1000 as rounded integer.
- Both formatters use module-scoped instances (matches codebase pattern in category-ranking-list.tsx).

### kpi-card-reading.tsx
- `Reading` type: `{ text: string; sentiment: 'good' | 'warn' | 'bad' | 'neutral' }`.
- `ReadingKpiCard`: Card with label, value, sentiment-colored reading line, and conditional Badge (`delta !== null` guard per D-06/KPI-02). Badge hidden when delta is null.
- Helpers `sentimentColor`, `valueColor`, `deltaColor`, `formatDelta` co-located.
- No PROTOTYPE comment; no FilterBar/MoversList.

### kpi-row.tsx
- `KpiRow({ data, year }: { data: OverviewData; year: number })` — typed to real DAL shape.
- Reading helpers ported verbatim: `savingsReading` (>=20/>=10/>=0/else), `balanceReading` (sign), `trendReading` (|delta|<=1 = neutral, else YoY trend).
- Four cards: Totale entrate, Totale uscite, Bilancio, Tasso risparmio — each using `formatEur` for monetary values and pulling `deltas.*` from `OverviewData`.
- Null-delta fallback: neutral reading "In linea con il {prevYear}" when delta is null (no crash on first-year data).

### overview-header.tsx
- `'use client'` component typed `{ year: number; years: string[] }`.
- Title "Panoramica delle tue finanze" + inline year-pill Select on same flex row (HEAD-01).
- Year change calls `router.replace` with `?year=` and `{ scroll: false }` (D-05).
- Options come from `years` prop (real `getYearsWithData()` output — HEAD-03).
- `aria-label="Anno"` on trigger.

## Deviations from Plan

### Auto-added: null-delta reading fallback in KpiRow

- **Found during:** Task 2
- **Issue:** `trendReading(delta, prevYear, kind)` requires a non-null delta. OverviewData defines `deltas.*` as `number | null` — calling trendReading with null would produce NaN/crash for first-year data.
- **Fix (Rule 2 — missing null check):** KpiRow passes a neutral fallback reading when delta is null rather than calling trendReading. The `ReadingKpiCard` already hides the badge when `delta === null`; the reading line also falls back gracefully.
- **Files modified:** components/dashboard/overview/kpi-row.tsx
- **Commit:** 72af265

## Verification

- `npx tsc --noEmit` — clean, no errors from any of the 4 new files.
- `yarn check:language` — could not run in worktree (node_modules not linked); manual review confirms: all identifiers/comments in English, Italian strings are intentional product copy only — compliant with CLAUDE.md Language Convention.
- All 4 files confirmed present on disk; all 3 commits confirmed in git log.

## Known Stubs

None — all four components are wired to real DAL types.

## Threat Flags

No new network endpoints, auth paths, or file access patterns introduced. The `?year=` write is constrained to the `years` prop values (T-43-01 mitigated as planned).

## Self-Check: PASSED

- FOUND: components/dashboard/overview/format.ts
- FOUND: components/dashboard/overview/kpi-card-reading.tsx
- FOUND: components/dashboard/overview/kpi-row.tsx
- FOUND: components/dashboard/overview/overview-header.tsx
- FOUND commit: 069168f
- FOUND commit: 72af265
- FOUND commit: 12c2fb2
