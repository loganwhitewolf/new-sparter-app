---
status: complete
phase: 44-overview-interactions
source: [44-VERIFICATION.md]
started: 2026-06-08T16:30:00Z
updated: 2026-06-08T16:50:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Nudge ambra visibile con spese non categorizzate
expected: Apri /dashboard/overview con un anno che ha spese OUT non categorizzate — banner ambra compare sopra i KPI con link "Categorizza ora" e pulsante X
result: pass

### 2. Dismiss persiste tra reload
expected: Dopo aver cliccato X, ricarica — il nudge non riappare; chiave sparter-overview-nudge-{year} presente in localStorage
result: pass

### 3. Nudge ricompare con nuovi non categorizzati
expected: Dopo dismiss con count=5, se il count sale a 8 il nudge riappare al prossimo reload
result: pass

### 4. CTA link naviga a URL corretto
expected: Link "Categorizza ora" naviga a /transactions?status=uncategorized&months=YYYY-MM,... con 12 token YYYY-MM dell'anno selezionato
result: pass

### 5. Chip Entrate isolano solo la barra verde
expected: Deselezionando un chip income, la barra Entrate si riduce; i KPI (Totale entrate, Totale uscite, Bilancio, Tasso risparmio) restano invariati
result: issue
reported: "il grafico non compare, vedo i chip che posso selezionare o deselezionare ma non cambia nulla e il grafico non viene caricato"
severity: major

### 6. Chip Uscite isolano solo la barra rossa
expected: Deselezionando chip uscite, la barra Uscite si riduce/azzera; la barra Entrate è indifferente ai chip Uscite e viceversa
result: issue
reported: "il grafico non compare, non verificabile (stessa causa del test 5)"
severity: major

### 7. All-off non mostra empty-state
expected: Deselezionando tutti i chip Uscite, il grafico rimane visibile con barra a 0 (nessun empty-state alternativo)
result: issue
reported: "il grafico non compare, non verificabile (stessa causa del test 5)"
severity: major

### 8. Popover ⓘ gruppo Entrate e Uscite
expected: Ogni popover mostra una riga descrittiva del gruppo in italiano; i due popover hanno contenuti distinti
result: pass

### 9. Tooltip per-chip con definizioni
expected: Hovering su ciascun chip mostra tooltip con definizione in italiano di una riga da NATURE_LABELS
result: pass

### 10. Layout responsive a viewport mobile
expected: Chip si wrappano correttamente a <768px; popover e tooltip accessibili senza overflow orizzontale
result: pass

## Summary

total: 10
passed: 7
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Il grafico a barre viene renderizzato e i chip filtrano le barre client-side"
  status: failed
  reason: "User reported: il grafico non compare, i chip sono visibili e cliccabili ma il grafico non viene caricato"
  severity: major
  test: 5
  artifacts: []
  missing: []
