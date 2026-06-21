---
status: testing
phase: 55-import-summary-ux
source: [55-VERIFICATION.md]
started: 2026-06-21T14:51:00Z
updated: 2026-06-21T14:51:00Z
---

## Current Test

number: 1
name: ImportPreview mostra max 10 righe senza SuggestionSection
expected: |
  Aprire /import/[fileId] con un file che ha >10 righe sample.
  La tabella mostra esattamente 10 righe. Nessuna sezione SuggestionSection visibile.
awaiting: user response

## Tests

### 1. ImportPreview 10-row cap + no SuggestionSection
expected: Aprire /import/[fileId] con un file che ha >10 righe. La tabella mostra max 10 righe; nessuna SuggestionSection visibile nella pagina analyze.
result: [pending]

### 2. Suggestions page visual check (SUMUI-02, SUMUI-03, single-cat read-only)
expected: Aprire /import/[fileId]/suggestions. Verificare: (a) paragrafo SUMUI-03 sotto l'h1 con copy piattaforma, (b) heading "Pattern proposti" con intro text, "Transazioni identiche (N)" con intro text, (c) card single-cat senza CTA clickabile.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
