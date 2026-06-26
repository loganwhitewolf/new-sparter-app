---
status: complete
phase: 57-pdf-import-trade-republic
source: [57-01-SUMMARY.md, 57-02-SUMMARY.md, 57-03-SUMMARY.md, 57-04-SUMMARY.md]
started: 2026-06-26T10:33:17Z
updated: 2026-06-26T10:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. File input accetta .pdf
expected: Aprire la pagina di import file. Cliccare sul campo di selezione file: il file dialog deve mostrare i file .pdf come selezionabili (non grayed out). Selezionare un file .pdf valido (≤5 MB): nessun errore MIME/formato deve apparire e il flusso procede verso il caricamento.
result: pass

### 2. PDF >5 MB bloccato pre-upload
expected: Selezionare un file .pdf superiore a 5 MB nell'uploader. L'UI deve mostrare un errore di validazione ("file troppo grande" o simile) prima che qualsiasi upload parta — nessuna chiamata di rete, il campo si resetta.
result: pass

### 3. Import E2E Trade Republic PDF
expected: Caricare un estratto conto PDF di Trade Republic (formato italiano). Il detector deve riconoscere il formato come "Trade Republic". Le transazioni devono essere importate con: crediti come importi positivi, debiti come importi negativi, date corrette (gg mmm aaaa → data ISO). L'import deve completarsi senza errori.
result: pass

### 4. Righe Cash Dividend importate con descrizione
expected: Dopo l'import E2E, verificare che le righe di tipo "Cash Dividend" (e.g. "Cash Dividend for ISIN US0378331005") siano presenti nell'elenco transazioni con una descrizione non vuota. In precedenza queste righe venivano scartate con "missing description".
result: pass

### 5. PDF non-Trade Republic non causa crash
expected: Caricare un PDF generico (non un estratto TR — ad es. qualsiasi PDF che non contenga i marker "TRADE REPUBLIC" + "TRANSAZIONI SUL CONTO"). L'import deve fallire in modo controllato con un messaggio di errore leggibile ("formato non riconosciuto" o simile) senza crash o 500.
result: issue
reported: "Mostra: 'This does not appear to be a Trade Republic bank statement. Missing document markers: TRADE REPUBLIC, TRANSAZIONI SUL CONTO.' — messaggio troppo tecnico, espone marker interni. Desiderato: messaggio user-friendly in italiano tipo 'Questo file non è stato riconosciuto. Al momento supportiamo solo queste piattaforme con formato PDF: [lista da query platforms con PDF]'"
severity: minor

## Summary

total: 5
passed: 4
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Errore PDF non riconosciuto deve essere user-friendly e in italiano, con lista delle piattaforme PDF supportate"
  status: failed
  reason: "User reported: messaggio attuale 'This does not appear to be a Trade Republic bank statement. Missing document markers: TRADE REPUBLIC, TRANSAZIONI SUL CONTO.' è troppo tecnico ed espone marker interni. Voluto: messaggio italiano con lista piattaforme da query su platforms con formato PDF"
  severity: minor
  test: 5
  artifacts: []
  missing: []
