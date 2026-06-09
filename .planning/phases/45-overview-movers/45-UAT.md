---
status: passed
phase: 45-overview-movers
source: [45-VERIFICATION.md]
started: 2026-06-09T08:30:00Z
updated: 2026-06-09T08:30:00Z
---

## Current Test

number: 1
name: Bar click highlights both bars and updates movers panel (MOVE-01)
expected: |
  Clicking any month's bar sets that month to full opacity (Entrate + Uscite), dims all others to ~40%, and panel content changes to that month's movers
awaiting: user response

## Tests

### 1. Bar click highlights both bars and updates movers panel
expected: Clicking any month's bar sets that month to full opacity (Entrate + Uscite), dims all others to ~40%, and panel content changes to that month's movers
result: [pending]

### 2. Panel defaults to last month with data on initial load
expected: On first paint, movers panel is populated and highlighted bars correspond to the last month with transaction activity (not necessarily the last calendar month)
result: [pending]

### 3. Empty section hiding — only one section shows when all movers are in one direction
expected: If a month has only increases, "Dove hai risparmiato" is absent; if only savings, "Dove hai speso di più" is absent
result: [pending]

### 4. Empty state for first available month
expected: Clicking the leftmost month bar shows the empty-state message and no mover lists
result: [pending]

### 5. Humanized copy: no percentages, "spesa nuova" for new spend
expected: Each row renders "{Categoria} | €X in più" / "€X in meno" / "€X spesa nuova" — no % symbols, no arrows
result: [pending]

### 6. URL is unaffected by bar clicks
expected: Clicking different months does NOT change the ?year= URL param
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
