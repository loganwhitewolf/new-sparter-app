---
status: testing
phase: 64-file-detail-and-navigation
source: [64-VERIFICATION.md]
started: 2026-07-06T22:35:00Z
updated: 2026-07-06T22:35:00Z
---

## Current Test

number: 1
name: Visual hover-reveal of inline-edit pencil on all three detail pages
expected: |
  Open /transactions/[id], /expenses/[id], and /import/[fileId] for an owned entity (any id).
  Hover over the title/displayName on each page — confirm the pencil icon fades in from
  invisible to visible on each. Click the pencil on each and confirm inline edit opens and
  saves exactly as before (no regression). Then navigate to a row in any of the three tables
  and hover — confirm the pencil still fades in on the table rows exactly as it did before
  this plan (unaffected by the ancestor .group additions).
awaiting: user response

## Tests

### 1. Visual hover-reveal of inline-edit pencil on all three detail pages
expected: Open /transactions/[id], /expenses/[id], and /import/[fileId] for an owned entity (any id). Hover over the title/displayName on each page — confirm the pencil icon fades in from invisible to visible on each. Click the pencil on each and confirm inline edit opens and saves exactly as before (no regression). Then navigate to a row in any of the three tables and hover — confirm the pencil still fades in on the table rows exactly as it did before this plan (unaffected by the ancestor .group additions).
result: [pending]

### 2. Smart-back filter/scroll preservation from external-referrer tab
expected: Open a detail-page URL (e.g. /transactions/[id]) in a fresh browser tab by pasting the URL (simulating an external referrer or a direct link). Navigate the app: go to /transactions with a month filter applied, click into another row's detail page via the title link, click "Indietro" — confirm the table re-renders with the same filter + scroll position preserved (in-app back used, not static fallback). The fixed smart-back heuristic (hasInAppHistory) should prefer in-app back whenever window.history.length > 1, regardless of the tab's original document.referrer.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
