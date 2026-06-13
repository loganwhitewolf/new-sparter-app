---
status: complete
phase: 49-dashboard-and-surfaces
source:
  - 49-01-SUMMARY.md
  - 49-02-SUMMARY.md
  - 49-03-SUMMARY.md
  - 49-04-SUMMARY.md
  - 49-05-SUMMARY.md
  - 49-06-SUMMARY.md
started: 2026-06-13T00:00:00.000Z
updated: 2026-06-13T00:00:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server. Start the app from scratch (yarn dev). The server boots without errors, migrations are up to date (no pending migration warnings), and the dashboard loads with real data.
result: pass

### 2. KPI Accantonato card
expected: On the dashboard overview page, a 5th KPI card "Accantonato" is visible alongside Entrate / Uscite / Risparmio / Saldo. The allocation total is displayed as a positive euro amount (e.g., €500 not −€500). If there are no allocation transactions the card shows €0,00.
result: pass

### 3. Overview chart — 3 grouped bars
expected: The overview chart shows 3 grouped bars per month: Entrate (green/blue), Uscite (red/orange), and Accantonato (purple). Months with no allocation show a zero-height bar for Accantonato without errors. The tooltip on hover shows all 3 amounts including an Accantonamenti section.
result: pass

### 4. Movers panel — 3-column layout on month click
expected: Clicking a month bar in the overview chart shows the movers panel with 3 columns simultaneously: Entrate, Uscite, and Accantonamenti. Each column shows the top categories for that direction. The Accantonamenti column shows at most 2 rows (Risparmio and Investimento if data exists). No direction selector dropdown — all 3 directions show at once.
result: pass
note: Hydration warning in console — data-darkreader-inline-stroke injected by Dark Reader browser extension modifying SVG before React hydration. Browser extension artifact, not a code bug.

### 5. Transaction table — direction filter with nature cascade
expected: On the transactions page, the filter toolbar includes a "Direzione" filter with 4 options: Entrate, Uscite, Accantonamenti, Trasferimenti. Selecting a direction filters the table. A "Natura" filter (if present) shows only the nature options relevant to the selected direction (cascade dependsOn behavior).
result: issue
reported: "i filtri per direction non sembrano funzionare"
severity: major

### 6. Expense table — direction filter with nature cascade
expected: On the expenses page, the filter toolbar has the same "Direzione" filter with 4 options. Filtering by "Accantonamenti" shows only allocation-direction expenses.
result: issue
reported: "i filtri per direction non sembrano funzionare"
severity: major

### 7. SubcategoryPicker — 4 direction chips
expected: Opening the subcategory picker (e.g. when categorizing a transaction or expense) shows 4 direction chips at the top: Entrate, Uscite, Accantonamenti, Trasferimenti. Tapping "Accantonamenti" filters the subcategory list to show only savings/investment subcategories (Risparmio, Investimento).
result: pass

### 8. Category settings panel — direction grouping with Accantonamenti
expected: In Settings → Categories, the category list is grouped by direction. An "Accantonamenti" group is present alongside Entrate / Uscite. Categories whose subcategories map to the allocation direction appear in this group.
result: pass

## Summary

total: 8
passed: 6
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Direction filter in transactions table filters rows to show only the selected direction (Entrate/Uscite/Accantonamenti/Trasferimenti)"
  status: failed
  reason: "User reported: i filtri per direction non sembrano funzionare"
  severity: major
  test: 5
  artifacts: []
  missing: []

- truth: "Direction filter in expenses table filters rows to show only the selected direction"
  status: failed
  reason: "User reported: i filtri per direction non sembrano funzionare"
  severity: major
  test: 6
  artifacts: []
  missing: []
