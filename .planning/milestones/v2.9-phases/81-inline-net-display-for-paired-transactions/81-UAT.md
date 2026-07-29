---
status: complete
phase: 81-inline-net-display-for-paired-transactions
source: [81-01-SUMMARY.md]
started: 2026-07-29T14:52:24Z
updated: 2026-07-29T17:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Riga tabella transazioni — netto anchor + badge "riduzione di" sul counterpart (D-N3)
expected: |
  Su una plan chiusa "per vendita" (o un rimborso v2.8) reale, nella tabella /transactions:
  la riga anchor mostra il netto principale con il lordo barrato/opaco sotto; la riga
  counterpart mostra il badge "riduzione di …" (link alla transazione anchor) con importo
  attenuato invece del tono da entrata.
result: pass
coverage_id: D-N3

### 2. D-N2 — anchor: netto primario + lordo barrato (copertura automatica)
expected: A paired outflow anchor renders pairedNetAmount as the primary amount-cell figure with the gross amount struck-through/opaque beneath it
result: pass
source: automated
coverage_id: D-N2

### 3. D-N1 — un solo code path per tutti i pairing (copertura automatica)
expected: The display applies to all pairings (amortization-sale AND v2.8 reimbursement) via the single reimbursement/reimbursement_refund path — one code path, no amortization-specific branch
result: pass
source: automated
coverage_id: D-N1

### 4. D-N4 — nessuna modifica a totali/netting/lens (copertura automatica)
expected: No change to effectiveAmount(), any total, or dashboard/lens figure; lib/dal/transactions.ts unmodified; LENS-03 byte-identical regression stays green
result: pass
source: automated
coverage_id: D-N4

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
