---
status: complete
phase: 39-unified-subcategory-picker
source: [39-01-SUMMARY.md, 39-02-SUMMARY.md, 39-03-SUMMARY.md, 39-04-SUMMARY.md, 39-05-SUMMARY.md, 39-06-SUMMARY.md]
started: 2026-06-02T15:00:00Z
updated: 2026-06-02T16:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Picker si apre e si chiude
expected: Vai su /expenses. Clicca il pulsante per categorizzare una singola spesa. Deve aprirsi un bottom sheet dal basso — NON un dialog centrato. Clicca X o tocca fuori: il sheet si chiude senza salvare.
result: pass

### 2. Chip di tipo filtrano le sottocategorie
expected: Con il picker aperto, clicca il chip "Entrate". La lista deve mostrare solo sottocategorie di tipo entrata. Clicca "Uscite": solo uscite. Clicca "Tutte": tutto appare di nuovo. Il chip "Sistema" NON deve essere visibile.
result: pass

### 3. Sezione "Più usate"
expected: Con il picker aperto, nella parte alta della lista (o nel rail sinistro su desktop) deve apparire una sezione "Più usate" (o "Most used") con le sottocategorie usate più di frequente (fino a 6). Se non hai mai categorizzato spese, la sezione può essere assente o vuota.
result: pass

### 4. Ricerca sottocategorie
expected: Con il picker aperto, digita del testo nel campo di ricerca. La lista deve collassarsi in un elenco piatto filtrato per testo (niente master-detail, solo i risultati pertinenti). Cancella il testo: la struttura a categorie/rail torna.
result: pass

### 5. Categorizzazione singola spesa — commit-on-tap
expected: Vai su /expenses. Apri il picker per una spesa non categorizzata. Tocca/clicca una sottocategoria. Il bottom sheet deve chiudersi immediatamente e la spesa deve mostrare la nuova sottocategoria — senza premere alcun pulsante "Salva" o "Conferma".
result: pass

### 6. Categorizzazione bulk
expected: Vai su /expenses. Seleziona 2 o più spese con le checkbox. Clicca "Categorizza" (o pulsante bulk). Apre il picker. Tocca una sottocategoria: il picker si chiude e tutte le spese selezionate devono risultare categorizzate con quella sottocategoria.
result: pass

### 7. Crea spesa con picker (fill-field)
expected: Vai su /expenses, apri il dialog di creazione nuova spesa. Il campo sottocategoria deve essere un pulsante "Categorizza" (non un Select cascading Categoria+Sottocategoria). Cliccalo: apre il picker. Seleziona una sottocategoria: il picker si chiude, il campo mostra il nome della sottocategoria scelta. Premi Salva: la spesa viene creata con quella sottocategoria.
result: pass

### 8. Modifica spesa — picker pre-filled
expected: Vai su /expenses. Apri il dialog di modifica di una spesa già categorizzata. Il campo sottocategoria deve mostrare il nome della sottocategoria corrente (non un Select vuoto). Clicca per aprire il picker: la sottocategoria corrente deve essere evidenziata o selezionata. Cambia sottocategoria, salva: la spesa si aggiorna.
result: pass

### 9. Crea transazione con picker (campo opzionale)
expected: Vai su /transactions. Apri il dialog di creazione nuova transazione. Trovi un campo sottocategoria con picker (non cascading Select). È opzionale: puoi salvare anche senza selezionarlo. Se selezioni una sottocategoria tramite picker e salvi, la transazione viene creata con quella sottocategoria.
result: pass

### 10. Crea pattern — niente amountSign/confidence manuali
expected: Vai su /settings/categories (o dove si creano i pattern). Apri il dialog "Crea pattern". Devono esserci solo: campo regex, campo descrizione (opzionale) e pulsante "Categorizza" che apre il picker. NON devono esserci Select "Segno importo" né campo "Confidenza" visibili all'utente.
result: pass

### 11. Modifica pattern — picker pre-filled
expected: Nella stessa pagina pattern, apri il dialog di modifica di un pattern esistente. Il picker deve mostrare già la sottocategoria corrente del pattern (non vuoto). Puoi cambiarla aprendo il picker e selezionando un'altra voce. Salva: il pattern si aggiorna.
result: pass

### 12. Promozione suggerimento import
expected: Vai su /import (o nella sezione Import con suggerimenti). Apri il form di promozione di un suggerimento. Il campo sottocategoria usa il picker (non cascading Select). Seleziona una sottocategoria e promuovi: il pattern viene creato correttamente.
result: pass

### 13. Onboarding Step 4 — picker
expected: Avvia o riprendi l'onboarding fino allo Step 4 (categorizzazione). Per ogni spesa del campione, il controllo di scelta sottocategoria deve usare il picker bottom sheet. Seleziona una sottocategoria: la spesa viene marcata come categorizzata e si avanza.
result: pass

## Summary

total: 13
passed: 13
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
