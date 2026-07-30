---
id: 260730-n2z
title: Amort UX — Visualizza, vendita/rimborso copy, Tutti=all, transactionId filter
status: complete
date: 2026-07-30
---

# Quick Task 260730-n2z Summary

## What changed

1. **Transaction detail** — Chiudi/Rimuovi removed. Amortized txs get **Visualizza ammortamento** → `/amortizations?transactionId=<uuid>`. Collegamenti still opens `AmortizationReimburseDialog` when linking a refund to an open plan.
2. **Registry filter** — `resolveEffectiveStatusFilter`: absent/`all`/bogus → `null` (show all). `matchesAmortizationFilters` + config field `transactionId` (chip: "Transazione collegata"). Helper `amortizationsByTransactionHref`.
3. **Copy** — Table CTA and dialog radio: **Chiudi con vendita/rimborso**. Over-residual user message updated to match.
4. **Tutti** — no longer silently open-only (fixes D-C1 vs toolbar mismatch).

## Commits

- `fix(260730-n2z): amortizations Tutti shows all statuses + transactionId filter`
- `feat(260730-n2z): Visualizza ammortamento on detail + vendita/rimborso copy`

## Tests

- `tests/amortization-registry-table.test.ts` — status null/all + transactionId isolation
- `tests/amortization-lifecycle.test.ts` — over-residual message substring
- `yarn check:language` passed

## Out of scope (honored)

- Transactions table row Chiudi/Rimuovi unchanged
- No `/amortizations/[id]` page

## Deviations

- Planner agent hit API rate limit; plan written by orchestrator from locked CONTEXT.
- When a plan already exists, detail hides the disabled "Ammortizza" (already-amortized) and shows only Visualizza — clearer than stacking both.
