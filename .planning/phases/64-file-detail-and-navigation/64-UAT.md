---
status: complete
phase: 64-file-detail-and-navigation
source: [64-VERIFICATION.md]
started: 2026-07-06T15:10:00Z
updated: 2026-07-06T15:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Smart-back navigation (history-preserving + static fallback)
expected: Open a transaction row from the /transactions table with an active filter (e.g. a month filter), click into its detail page, then click "Indietro" — confirm the table re-appears with the same filter/scroll position still applied. Then open the same detail page URL directly by pasting it in a new tab and click "Indietro" — confirm it lands on the static /transactions route (no filter, top of list) instead of leaving a blank history or navigating away from the app. Repeat for /expenses/[id] and /import/[fileId].
result: issue
reported: "quando torno indietro da una pagina di dettaglio non si mantiene il filtro precedente"
severity: major

## Summary

total: 1
passed: 0
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "History-based back (filters/sort/scroll preserved) when arriving from the entity's own table"
  status: failed
  reason: "User reported: quando torno indietro da una pagina di dettaglio non si mantiene il filtro precedente"
  severity: major
  test: 1
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
