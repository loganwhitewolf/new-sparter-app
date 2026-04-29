---
status: complete
phase: 04-dashboard-kpi
source: 04-00-SUMMARY.md, 04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md
started: 2026-04-28T15:00:00Z
updated: 2026-04-28T15:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Dashboard page loads with KPI sections
expected: Aprendo /dashboard (autenticato), la pagina mostra 5 card KPI, sezione Breakdown e sezione Trend mensile. Nessun errore nella console, nessun placeholder.
result: pass
notes: "Card vuote su 'ultimo mese' (nessuna expense nel mese corrente — atteso). Dati visibili su 'ultimi 3 mesi'. Trend vuoto — atteso, nessuna Transaction ancora (Phase 5). Comportamento corretto."

### 2. KPI cards layout e valori
expected: Le 5 card mostrano label, valore numerico (0.00 o dato reale se ci sono expense) e un delta badge +/-% rispetto al mese precedente. Su mobile (<768px) si dispongono su 2 colonne (2+2+1).
result: pass
notes: "Valori a 0 attesi (no transazioni). Layout mobile 2 colonne confermato."

### 3. Dashboard filters — tab tipo e preset data
expected: Sopra il breakdown c'è una toolbar con 3 tab (Uscite | Entrate | Tutti) e un Select con i preset (Questo mese, Ultimi 3 mesi, ecc.). Cliccando un tab o scegliendo un preset, l'URL cambia (?type=in&period=last-3-months) e il breakdown si aggiorna.
result: issue
reported: "Le spese manuali compaiono nel breakdown Uscite anche senza transazioni importate. Il breakdown dovrebbe essere vuoto/zero finché non ci sono Transaction con importi reali — il valore di un'uscita dipende dalle Transaction, non dall'esistenza dell'Expense."
severity: major

### 4. Category breakdown chart con drill-down
expected: Il breakdown mostra barre orizzontali per categoria. Cliccando su una categoria si espandono le subcategorie sotto con le loro barre, importo e percentuale. Il filtro tipo (Uscite/Entrate/Tutti) cambia le categorie mostrate.
result: pass
notes: "Drill-down sembra funzionare correttamente. Test parzialmente limitato dall'issue #3 (dati errati senza transazioni)."

### 5. Trend mensile — barre grouped e toggle serie
expected: Il grafico trend mostra barre grouped per mese con 4 serie (Entrate, Uscite, Non categorizzato, Ignorato). I bottoni legenda permettono di mostrare/nascondere ogni serie. Le barre cambiano quando una serie viene disattivata.
result: pass

## Summary

total: 5
passed: 4
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Il breakdown categorie Uscite deve essere vuoto/zero finché non esistono Transaction con importi reali importate dal file bancario"
  status: failed
  reason: "User reported: Le spese manuali (Expense records senza Transaction) compaiono nel breakdown Uscite con valori conteggio. Il valore di un'uscita dipende dalle Transaction, non dall'esistenza dell'Expense."
  severity: major
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
