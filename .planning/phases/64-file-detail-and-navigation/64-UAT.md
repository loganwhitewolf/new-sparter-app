---
status: testing
phase: 64-file-detail-and-navigation
source: [64-VERIFICATION.md]
started: 2026-07-06T15:10:00Z
updated: 2026-07-06T15:10:00Z
---

## Current Test

number: 1
name: Smart-back navigation (history-preserving + static fallback)
expected: |
  History-based back (filters/sort/scroll preserved) when arriving from the entity's own table;
  static-route fallback when there's no usable in-app history (direct load / external referrer).
  Repeat for all three detail pages: /transactions/[id], /expenses/[id], /import/[fileId].
awaiting: user response

## Tests

### 1. Smart-back navigation (history-preserving + static fallback)
expected: Open a transaction row from the /transactions table with an active filter (e.g. a month filter), click into its detail page, then click "Indietro" — confirm the table re-appears with the same filter/scroll position still applied. Then open the same detail page URL directly by pasting it in a new tab and click "Indietro" — confirm it lands on the static /transactions route (no filter, top of list) instead of leaving a blank history or navigating away from the app. Repeat for /expenses/[id] and /import/[fileId].
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
