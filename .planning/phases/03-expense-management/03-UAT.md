---
status: complete
phase: 03-expense-management
source: [03-00-SUMMARY.md, 03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md]
started: 2026-04-28T00:00:00Z
updated: 2026-04-28T01:00:00Z
---

## Current Test

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Run npm run db:migrate && npm run db:seed — migration prints "Migration completata.", seed prints "Seed completato." with 27 categories and 126 subcategories. Start npm run dev and navigate to http://localhost:3000/spese — page loads without crash.
result: pass

### 2. /spese page structure
expected: The /spese page shows a heading, a filter toolbar with three selects (Categoria, Stato, Periodo), a "Nuova spesa" button, and either an empty table or a list of expense rows. No JS console errors.
result: issue
reported: "Warning: Missing Description or aria-describedby for DialogContent (all dialogs). Font and CSS preload warnings also present."
severity: cosmetic

### 3. Create expense (Nuova spesa)
expected: Click "Nuova spesa" — a Dialog opens with a Titolo text input, a Categoria select (showing nested categories/subcategories), and a Note textarea. Fill in a title ("Test spesa"), pick any category, click "Salva spesa". The dialog closes, a toast confirms success, and the new expense appears as a row with an amber "Da categorizzare" or green badge.
result: issue
reported: "La select mostra solo la categoria, non la sottocategoria. Dopo la creazione la spesa appare come categorizzata anche senza aver selezionato una sottocategoria."
severity: major

### 4. Edit expense (Modifica)
expected: Click the three-dots menu (⋮) on an expense row — a dropdown appears with "Modifica" and "Elimina". Click "Modifica" — the edit Dialog opens with the title already pre-filled. Change the title, pick a different subcategory, click "Aggiorna spesa". Dialog closes, toast confirms, row updates with the new title/category.
result: issue
reported: "Funziona ma il DropdownMenu non si chiude dopo aver aggiornato la spesa — rimane visibile in sovrapposizione."
severity: minor

### 5. Delete expense (Elimina)
expected: Click ⋮ on a row → "Elimina" → a confirmation Dialog opens asking to confirm. Click confirm — the dialog closes, the expense row disappears from the table, toast confirms deletion.
result: pass

### 6. Checkbox bulk selection + floating action bar
expected: Click a row's checkbox — it gets a checkmark and a floating action bar slides up from the bottom of the page showing "1 selezionate" and a "Categorizza (1)" button. Select multiple rows — the count updates. Check the header checkbox — all visible rows select (or deselect if all are selected). Uncheck all — the bar hides.
result: pass

### 7. Bulk categorize
expected: Select 1+ rows and click "Categorizza (N)" in the bulk action bar. A Dialog opens with a category picker. Pick a subcategory, click "Conferma". Dialog closes, toast confirms, selected rows update their category badge to the green "Categorizzata" style.
result: issue
reported: "A metà — il dialog di categorizzazione bulk si apre ma non fa selezionare la sottocategoria."
severity: major

### 8. Filter state persists in URL
expected: Click the "Stato" select and choose "Da categorizzare". The URL updates to include ?status=uncategorized (or similar param) and the table filters to show only uncategorized expenses. Refresh the page — the Stato select still shows "Da categorizzare" and the table is still filtered.
result: pass

## Summary

total: 8
passed: 4
issues: 4
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "No console warnings on /spese page load — dialogs have accessible descriptions"
  status: failed
  reason: "User reported: Warning: Missing Description or aria-describedby={undefined} for DialogContent — affects all Dialog components (ExpenseFormDialog, BulkCategorizeDialog, delete confirmation)"
  severity: cosmetic
  test: 2
  artifacts: []
  missing: []

- truth: "Il dialog 'Nuova spesa' mostra la select a due livelli (categoria + sottocategoria); la spesa creata senza sottocategoria appare con badge 'Da categorizzare'"
  status: failed
  reason: "User reported: La select mostra solo la categoria, non la sottocategoria. Dopo la creazione la spesa appare come categorizzata anche senza aver selezionato una sottocategoria."
  severity: major
  test: 3
  artifacts: []
  missing: []

- truth: "Il DropdownMenu si chiude dopo che il dialog di modifica viene confermato e la riga aggiornata"
  status: failed
  reason: "User reported: Il DropdownMenu rimane visibile in sovrapposizione dopo aver aggiornato la spesa."
  severity: minor
  test: 4
  artifacts: []
  missing: []

- truth: "Il dialog di categorizzazione bulk mostra la select a due livelli (categoria + sottocategoria) e permette di selezionare una sottocategoria"
  status: failed
  reason: "User reported: Il dialog si apre ma non fa selezionare la sottocategoria."
  severity: major
  test: 7
  artifacts: []
  missing: []
