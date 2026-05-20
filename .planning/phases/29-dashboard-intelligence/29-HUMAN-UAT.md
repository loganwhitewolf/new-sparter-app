---
status: partial
phase: 29-dashboard-intelligence
source: [29-VERIFICATION.md]
started: 2026-05-20T11:00:00Z
updated: 2026-05-20T11:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Sort toggle visual e URL behavior

expected: "Deviazione" button attivo di default. Cliccando "Importo" aggiunge `?sort=amount` all'URL preservando gli altri parametri. Le categorie si riordinano per importo decrescente. Tornare indietro rimuove `?sort=amount`.
result: [pending]

### 2. DeviationBadge sulla pagina categorie

expected: Ogni riga categoria mostra un badge percentuale colorato (rosso per overspend/out, verde per underspend/out, invertito per in). Categorie con importi molto piccoli (< €15 di riferimento) non mostrano badge. Categorie senza storico mostrano "Nuovo".
result: [pending]

### 3. DeviationBadge sulle sottocategorie (pagina dettaglio categoria)

expected: Ogni riga sottocategoria mostra un badge di deviazione con corretta polarità di colore basata sul tipo di categoria.
result: [pending]

### 4. EntrateUsciteChart + BilancioBarsChart rendering visivo

expected: Due sezioni di grafici impilate visibili: "Entrate e uscite per mese" (due barre raggruppate per mese) sopra "Bilancio mensile" (barre per mese in verde o rosso). Nessun toggle button, nessuna serie "Non categorizzato" o "Ignorato" nell'overview.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
