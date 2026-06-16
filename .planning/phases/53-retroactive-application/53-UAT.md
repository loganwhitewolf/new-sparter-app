---
status: testing
phase: 53-retroactive-application
source: [53-VERIFICATION.md]
started: 2026-06-16T15:50:36Z
updated: 2026-06-16T15:50:36Z
---

## Current Test

number: 1
name: Browser apply feedback — useEffect → onPromoted → re-render after Server Action
expected: |
  Dopo aver promosso un suggerimento, la card mostra il count "N categorizzate · M ancora senza match"
  senza sparire dalla lista. Il ciclo useEffect si attiva quando state.applyResult è non-null.
awaiting: user response

## Tests

### 1. Browser apply feedback
expected: Dopo la promozione, la SuggestionCard mostra inline il risultato apply (es. "3 categorizzate · 1 ancora senza match") senza che la card venga rimossa dalla lista
result: [pending]

### 2. Cross-platform DB isolation
expected: Promuovere un suggerimento Fineco non categorizza transazioni Revolut. Solo le spese uncategorized della stessa piattaforma vengono aggiornate.
result: [pending]

### 3. notFound HTTP response quando platform chain è mancante
expected: Se il fileId non ha una piattaforma risolvibile, la pagina /import/[fileId]/suggestions risponde 404 nel browser (non crash 500)
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
