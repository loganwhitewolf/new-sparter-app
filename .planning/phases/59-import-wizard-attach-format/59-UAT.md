---
status: complete
phase: 59-import-wizard-attach-format
source:
  - 59-01-SUMMARY.md
  - 59-02-SUMMARY.md
  - 59-03-SUMMARY.md
started: 2026-06-30T00:00:00Z
updated: 2026-06-30T12:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Step 1 visibile con piattaforme esistenti
expected: |
  Naviga su /import/<fileId>/configure per un file già caricato.
  Il wizard mostra uno step 1 con la lista delle piattaforme selezionabili (es. Fineco, Intesa SP…)
  e una voce "Crea una nuova platform" in fondo alla lista.
  Il bottone "Continua" è disabilitato finché non si sceglie una voce.
result: pass

### 2. Selezione piattaforma esistente — avanzamento a step 2
expected: |
  In step 1, seleziona una piattaforma esistente dalla lista (es. "Fineco").
  Clicca "Continua".
  Il wizard passa a step 2 e mostra l'header "Configura il formato per Fineco"
  (non più un campo di testo "Nome piattaforma" libero).
result: pass

### 3. Crea nuova piattaforma — avanzamento a step 2
expected: |
  In step 1, seleziona "Crea una nuova platform".
  Appare un campo di testo inline per inserire il nome.
  Inserisci un nome (es. "MioBank") e clicca "Continua".
  Il wizard passa a step 2 con header "Nuova piattaforma: MioBank".
result: issue
reported: "Scrivendo 'fineco' (minuscolo) nel campo crea-nuova non viene avvisato che la piattaforma esiste già"
severity: major

### 4. Skip step 1 quando nessuna piattaforma disponibile
expected: |
  Se l'utente non ha ancora nessuna piattaforma approvata o pending-propria,
  il wizard apre direttamente allo step 2 (configurazione colonne) senza mostrare step 1.
  L'header mostra "Nuova piattaforma: <nome>" una volta compilato il campo nome.
result: skipped
reason: "Il seed include sempre piattaforme approvate — la condizione zero-piattaforme è irraggiungibile in pratica; coperto dai test unitari"

### 5. Submit attach branch — formato agganciato a piattaforma esistente
expected: |
  In step 1, seleziona una piattaforma esistente. Avanza a step 2.
  Compila la configurazione colonne e clicca "Salva formato e importa".
  La submission va a buon fine: non viene creata una nuova piattaforma,
  il formato è associato alla piattaforma selezionata.
  L'utente viene reindirizzato alla pagina dell'import (stesso flusso di prima).
result: pass

### 6. Submit create branch — nuova piattaforma pending creata
expected: |
  In step 1, scegli "Crea una nuova platform", inserisci un nome.
  Avanza a step 2, compila le colonne, clicca "Salva formato e importa".
  La submission va a buon fine: viene creata una nuova piattaforma con reviewStatus=pending
  e il formato è associato ad essa.
  L'utente viene reindirizzato alla pagina dell'import.
result: pass

## Summary

total: 6
passed: 4
issues: 1
pending: 0
skipped: 1

## Gaps

- truth: "Step 1 — campo 'Crea nuova platform': digitare un nome esistente (case-insensitive, es. 'fineco') dovrebbe avvisare l'utente che la piattaforma esiste già e suggerire di usare l'attach"
  status: failed
  reason: "User reported: scrivendo 'fineco' (minuscolo) non viene avvisato che la piattaforma esiste già"
  severity: major
  test: 3
  root_cause: "Nessuna validazione client-side in step 1: step1CanAdvance controlla solo che platformNameInput.trim().length > 0. Il check case-insensitive esiste solo server-side (ilike in createPrivateRows, riga 260) e lancia duplicate_platform_name dopo il submit — troppo tardi, l'utente è già in step 2. Fix: in ImportFormatWizard, quando selectedPlatformId === 'new', confrontare platformNameInput.trim().toLowerCase() con ogni attachablePlatforms[].name.toLowerCase() e bloccare il bottone Continua + mostrare un hint inline."
  artifacts:
    - path: "components/import/import-format-wizard.tsx"
      issue: "step1CanAdvance non verifica se il nome digitato collide con una piattaforma già elencata"
  missing:
    - "Aggiungere un computed isDuplicateName = attachablePlatforms.some(p => p.name.toLowerCase() === platformNameInput.trim().toLowerCase()) in ImportFormatWizard"
    - "Mostrare un messaggio inline sotto l'Input quando isDuplicateName è true"
    - "Disabilitare il bottone Continua quando isDuplicateName è true"

- truth: "Submit attach branch — inserisce importFormatVersion con version=MAX+1 per la piattaforma selezionata"
  status: fixed
  reason: "version hardcoded a 1; piattaforme esistenti (es. Fineco) hanno già version=1 → unique constraint (platformId, version) violation. Fix: MAX(version)+1 prima dell'insert"
  severity: blocker
  test: 5
  artifacts: [lib/services/import-format-wizard.ts]
  missing: [nextVersion query nel branch attach]
