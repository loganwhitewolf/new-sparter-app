---
quick_id: 260709-lkw
description: Uscite card breakdown (essenziali / discrezionali / debiti)
date: 2026-07-09
status: complete
---

# Quick Task 260709-lkw — Summary

Uscite card shows the spending split by nature under the total: Essenziali /
Discrezionali / Debiti (user asked essential/discretionary; Debiti included so rows
reconcile with the headline — same trio as the chart's Uscite chip group).

DAL: per-nature OUT sums in the shared aggregate (abs of algebraic sum per nature,
mirroring totalOut netting semantics); `OverviewData.outByNature` nullable object.
Null → card unchanged.

**Labels locked** (cross-card review 2026-07-09): rows read from NATURE_LABELS
(Essenziale / Discrezionale / Debiti) — same lexicon as the chart chips.

Verification: full suite 1419/1419 green, tsc clean, check:language clean.
Commit: c671da1
