---
status: testing
phase: 43-overview-shell
source: [43-VERIFICATION.md]
started: 2026-06-08T12:40:00Z
updated: 2026-06-08T12:40:00Z
---

## Current Test

number: 1
name: Rendering completo KPI + chart con dati reali
expected: |
  Aprire /dashboard/overview — la pagina mostra il titolo con il pill anno inline,
  4 KPI card (Totale entrate, Totale uscite, Bilancio, Tasso risparmio) con delta badge
  e reading line colorata, e il grafico a barre raggruppate verde/rosso per mese.
awaiting: user response

## Tests

### 1. Rendering completo
expected: KPI row (4 card con delta badge e reading line) + grafico a barre raggruppate Entrate/Uscite visibili con dati reali
result: [pending]

### 2. Re-scope anno (HEAD-02)
expected: Selezionare un anno diverso dal pill aggiorna KPIs e chart insieme senza reload; Suspense skeleton visibile durante il fetch
result: [pending]

### 3. Fallback D-04 (?year= invalido)
expected: Navigare su /dashboard/overview?year=9999 risolve all'anno corrente (se ha dati) o al più recente con dati, non mostra errore
result: [pending]

### 4. Empty states (D-06)
expected: Un account senza transazioni vede "no-years" message; selezionando un anno senza dati vede "no-data-for-year" message (non zeri raw)
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
