---
status: partial
phase: 03-expense-management
source: [03-VERIFICATION.md]
started: 2026-04-28T12:00:00Z
updated: 2026-04-28T12:00:00Z
---

## Current Test

[in attesa di testing manuale]

## Tests

### 1. Flusso Create Expense completo
expected: Dialog si chiude, toast "Spesa creata con successo.", nuova riga in tabella con badge corretto
result: [pending]

### 2. Edit expense con chiusura DropdownMenu (fix UAT T4)
expected: Dialog modifica si chiude E DropdownMenu padre si chiude automaticamente. Toast "Spesa aggiornata."
result: [pending]

### 3. Filtri URL-driven con persist al refresh
expected: URL diventa /spese?status=uncategorized. Dopo refresh select Stato mostra "Da categorizzare" e tabella è filtrata
result: [pending]

### 4. Bulk categorize con due Select separati (fix UAT T7)
expected: Dialog apre con due Select separati (categoria → sottocategoria filtrata). Dopo conferma righe mostrano badge emerald, FAB scompare
result: [pending]

### 5. Assenza warning DialogDescription in console (fix UAT T2)
expected: Nessun warning "Missing Description or aria-describedby" aprendo i 3 dialog (Nuova spesa, Modifica, Elimina)
result: [pending]

### 6. Filtro status URL param letto correttamente
expected: Navigando a /spese?status=uncategorized il select Stato mostra il valore corretto
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
