---
quick_id: 260709-lj5
description: Structural savings rate on the Tasso risparmio card
date: 2026-07-09
status: complete
---

# Quick Task 260709-lj5 — Summary

Tasso risparmio card gains a recurring-only rate breakdown row.
`structuralSavingsRate = computeSavingsRate(totalInRecurring, totalOut)` — same
formula `(in − out)/in × 100` and zero-income guard, recurring income only. Null when
totalInRecurring unknown → card unchanged. Reading thresholds still evaluate the
total rate (unchanged).

**Label locked** (cross-card review 2026-07-09): "Solo ricorrenti".

Verification: full suite green, tsc clean, check:language clean.
Commit: f820be8
