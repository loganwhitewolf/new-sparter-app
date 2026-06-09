---
phase: 260609-fru
plan: "01"
subsystem: dashboard-overview
tags: [fru-fix, overview, movers, chart, kpi, nudge, tdd]
dependency_graph:
  requires: []
  provides:
    - top-5 movers cap with colored amounts and muted qualifiers
    - per-nature chart tooltip (entrate + uscite breakdown on hover)
    - two-row nature legend with NATURE_COLORS dots
    - no highlight rectangle on bar hover (cursor={false})
    - nudge inline on title row, right-aligned
    - conditional KPI reading reflecting real prior-year deviation
  affects:
    - components/dashboard/overview/
    - app/(app)/dashboard/overview/page.tsx
tech_stack:
  added: []
  patterns:
    - TDD (RED/GREEN for each task)
    - Pure helper extraction + export for unit testing
    - ReactNode slot prop for header nudge composition
key_files:
  created: []
  modified:
    - components/dashboard/overview/overview-movers-format.ts
    - components/dashboard/overview/overview-movers-panel.tsx
    - components/dashboard/overview/overview-chart-utils.ts
    - components/dashboard/overview/overview-chart.tsx
    - components/dashboard/overview/overview-header.tsx
    - components/dashboard/overview/overview-nudge.tsx
    - components/dashboard/overview/kpi-row.tsx
    - app/(app)/dashboard/overview/page.tsx
    - tests/overview-movers.test.tsx
    - tests/overview-interactions.test.tsx
decisions:
  - "Nudge moved into OverviewDataSection (option a) so uncategorizedCount is available without blocking the eager header"
  - "NatureTooltip uses any[] for payload to avoid Recharts TooltipProps intersection type issue (Omit strips payload)"
  - "moverQualifier JSDoc rewritten in English to pass yarn check:language; Italian only in the return values"
metrics:
  duration: ~7 minutes
  completed: "2026-06-09T09:35:23Z"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 10
---

# Phase 260609-fru Plan 01: Dashboard Prototype Fixes (Movers Top-5, Chart, Nudge, KPI) Summary

Six overview-dashboard discrepancies corrected between the shipped v1.16 implementation and the locked prototype. All fixes are scoped to `components/dashboard/overview/` and the overview page — no DAL or schema changes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Movers panel — top 5, colored amounts, muted qualifiers, white titles | eb8e418 | overview-movers-format.ts, overview-movers-panel.tsx, tests/overview-movers.test.tsx |
| 2 | Chart — per-nature tooltip, two-row legend, remove highlight rect | 8162d67 | overview-chart-utils.ts, overview-chart.tsx, tests/overview-interactions.test.tsx |
| 3 | Nudge on title row + conditional KPI reading | 5ebd690 | page.tsx, kpi-row.tsx, overview-header.tsx, overview-movers-format.ts, overview-nudge.tsx, tests/overview-interactions.test.tsx |

## Fixes Delivered

1. **FRU-FIX-01 — Movers panel top-5 + visual polish**
   - Added `takeTopMovers(movers, limit=5)` pure helper; applied before `splitMovers` in the panel
   - Each row now shows euro amount colored `text-[var(--total-out)]` (red) for increases/new and `text-[var(--total-in)]` (green) for savings
   - Qualifier text (`in più` / `in meno` / `spesa nuova`) rendered in a muted `text-xs text-muted-foreground` span
   - Section titles ("Dove hai speso di più" / "Dove hai risparmiato") changed from colored to `text-foreground`

2. **FRU-FIX-02 — Per-nature chart tooltip**
   - Added `deriveNatureBreakdown(point, includedIncome, includedOut)` to `overview-chart-utils.ts`
   - Custom `NatureTooltip` component shows two sections (Entrate / Uscite), each listing nature label + colored dot + formatted amount; zero-amount natures are skipped for Uscite

3. **FRU-FIX-03 — Nudge inline on title row**
   - `OverviewHeader` now accepts an optional `nudge?: ReactNode` slot, rendered right-aligned via `justify-between`
   - `OverviewNudge` restyled as a compact inline pill (`rounded-full`, smaller text) replacing the full-width banner
   - `OverviewHeader` moved inside `OverviewDataSection` (option a) so it has access to `uncategorizedCount`; standalone `OverviewNudge` row removed

4. **FRU-FIX-04 — Conditional KPI reading**
   - Extracted and exported `resolveTrendReading(delta, prevYear, kind)` from `kpi-row.tsx`
   - When `delta` is `null`, returns `{ text: "Nessun confronto con il {prevYear}", sentiment: 'neutral' }` instead of the misleading "In linea con il"
   - Both Entrate and Uscite KPI cards now call `resolveTrendReading`

5. **FRU-FIX-05 — No highlight rectangle on hover**
   - `cursor={false}` passed to `<ChartTooltip>` in `overview-chart.tsx`; `components/ui/chart.tsx` unchanged

6. **FRU-FIX-06 — Two-row nature legend**
   - Custom `NatureLegend` component rendered below the `ChartContainer` (outside Recharts)
   - Row 1: income natures (Entrate ricorrenti, Straordinaria)
   - Row 2: out natures (Essenziale, Discrezionale, Operativo, Finanziario, Debiti, Straordinario)
   - Each item shows NATURE_COLORS dot; opacity follows the included filter state

## Test Results

- `tests/overview-movers.test.tsx`: 28 tests passing (15 existing + 13 new for takeTopMovers, moverAmountTone, moverQualifier)
- `tests/overview-interactions.test.tsx`: 34 tests passing (27 existing + 7 new for resolveTrendReading, 6 new for deriveNatureBreakdown)
- Total: 62 tests passing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TooltipProps intersection type error**
- **Found during:** Task 2 (type-check post-implementation)
- **Issue:** `TooltipProps<number, string> & { ... }` via Recharts Omit-based type caused TS2339 (payload not on intersection)
- **Fix:** Used a minimal explicit prop type `{ active?: boolean; payload?: any[] }` for NatureTooltip
- **Files modified:** overview-chart.tsx
- **Commit:** 8162d67

**2. [Rule 1 - Bug] JSDoc Italian strings in overview-movers-format.ts**
- **Found during:** Task 3 (yarn check:language)
- **Issue:** `moverQualifier` JSDoc listed Italian return values inline, flagged by language checker
- **Fix:** Rewrote JSDoc in English (the Italian strings in return statements are intentional product copy)
- **Files modified:** overview-movers-format.ts
- **Commit:** 5ebd690

## Known Stubs

None — all data sources are wired to real DAL outputs.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- [x] overview-movers-format.ts modified: `[ -f components/dashboard/overview/overview-movers-format.ts ]` — FOUND
- [x] overview-movers-panel.tsx modified: FOUND
- [x] overview-chart-utils.ts modified: FOUND
- [x] overview-chart.tsx modified: FOUND
- [x] overview-header.tsx modified: FOUND
- [x] kpi-row.tsx modified: FOUND
- [x] page.tsx modified: FOUND
- [x] Commit eb8e418: git log confirms Task 1
- [x] Commit 8162d67: git log confirms Task 2
- [x] Commit 5ebd690: git log confirms Task 3
- [x] 62 tests passing
- [x] components/ui/chart.tsx unchanged
