---
status: testing
phase: 38-first-import-onboarding
source: [38-01-SUMMARY.md, 38-02-SUMMARY.md, 38-03-SUMMARY.md]
started: 2026-05-29T00:00:00Z
updated: 2026-05-29T10:00:00Z
---

## Current Test

number: 1
name: Redirect Guard — utente senza transazioni
expected: Accedi come utente con 0 transazioni e naviga verso /dashboard (o qualsiasi route app). Il server reindirizza a /onboarding prima che la pagina venga renderizzata.
fix_applied: "Ripristinato middleware.ts (export { proxy as middleware, config } from './proxy') — cancellato per errore in commit cad605f"
awaiting: user response (ri-testa dopo il fix)

## Tests

### 1. Redirect Guard — utente senza transazioni
expected: Accedi come utente con 0 transazioni e naviga verso /dashboard (o qualsiasi route app). Il server reindirizza a /onboarding prima che la pagina venga renderizzata.
result: issue
reported: "continuo redirect tra pagine (loop infinito)"
severity: blocker
fix_applied: "Ripristinato middleware.ts — era stato cancellato in cad605f. Senza di esso x-pathname non veniva mai impostato, isExempt sempre false, redirect a /onboarding in loop."

### 2. Bypass Guard — utente con transazioni esistenti
expected: Accedi come utente che ha già transazioni importate. Naviga verso /dashboard. La pagina del dashboard si carica normalmente, senza alcun redirect a /onboarding.
result: [pending]

### 3. Onboarding Shell e Progress Dots
expected: Naviga su /onboarding. Vedi una pagina full-screen con tema scuro, logo/titolo dell'app, e i 5 progress dots nella parte superiore con il primo dot evidenziato (step 1 attivo). Non c'è la navigazione laterale dell'app.
result: [pending]

### 4. Step 1 — Upload file CSV/Excel
expected: Sul Step 1 dell'onboarding, seleziona un file CSV o Excel bancario. Il file viene caricato automaticamente (senza premere un pulsante separato), passa per la pipeline analyze/confirm. Vedi feedback visivo dello stato upload.
result: [pending]

### 5. Step 2 — Overview con dati reali
expected: Dopo aver confermato l'upload, arrivi allo Step 2. Vedi il riepilogo del file importato: numero di transazioni, totale entrate/uscite in formato italiano (€ con Decimal.js), e il periodo coperto in italiano (es. "gen–mag 2025"). I dati corrispondono al file che hai caricato.
result: [pending]

### 6. Step 3 — Schermata educativa giroconto
expected: Prosegui allo Step 3. Vedi la spiegazione del giroconto con i conteggi dinamici presi dal file importato (non valori fittizi). Hai un CTA per continuare allo Step 4.
result: [pending]

### 7. Step 4 — Wizard di categorizzazione
expected: Arrivi allo Step 4. Vedi fino a 15 spese non categorizzate (le più grandi per importo). Ogni riga ha un combobox per scegliere la sottocategoria. Il CTA in basso ha due pulsanti: "Categorizza il resto dopo" e "Continua", entrambi portano allo Step 5.
result: [pending]

### 8. Step 4 — Categorizzare una spesa
expected: Nello Step 4, apri il combobox di una spesa e seleziona una sottocategoria. La selezione viene salvata (server action). La riga si aggiorna o la spesa scompare dalla lista. Non c'è reload di pagina.
result: [pending]

### 9. Step 5 — Outro e CTA finali
expected: Arrivi allo Step 5 (tramite "Continua" dallo Step 4 o "Categorizza il resto dopo"). Vedi due pulsanti: "Vai alla dashboard" (porta a /dashboard) e "Personalizza le categorie" (porta a /settings/categories). Il tema è scuro come il resto dell'onboarding.
result: [pending]

### 10. Prototype rimosso
expected: Naviga verso /prototype/onboarding o qualsiasi sotto-route del vecchio prototipo. Ottieni un 404 o un redirect — la route non esiste più. Anche il PrototypeSwitcher non è più visibile nell'UI.
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0
blocked: 0

## Gaps

[none yet]
