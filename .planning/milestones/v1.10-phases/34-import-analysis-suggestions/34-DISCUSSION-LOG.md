# Phase 34: import-analysis-suggestions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 34-import-analysis-suggestions
**Areas discussed:** Failure handling, Subscription gating

---

## Failure handling

| Option | Description | Selected |
|--------|-------------|----------|
| Fail silenzioso + log warning | Catch, logger.warn con error.message safe, patternSuggestions: [], status resta 'analyzed' | ✓ |
| Fail silenzioso senza log | Catch senza nessun log | |
| Propaga il fallimento | analyzeFile fallisce con status 'failed' | |

**User's choice:** Fail silenzioso + log warning

**Follow-up — cosa loggare:**

| Option | Description | Selected |
|--------|-------------|----------|
| Solo error.message safe | logger.warn con messaggio fisso + error.message troncato, nessun dato file/row | ✓ |
| Solo contatore di righe | logger.warn con numero di righe in input | |
| Claude decide | Applica lo stesso schema di safeImportErrorMessage | |

**User's choice:** Solo error.message safe

**Notes:** ANL-05 è la chiave: R2 keys, presigned URLs, raw rows e stack trace non devono mai apparire nei log. Il warning deve usare lo stesso pattern di sicurezza già in uso nella funzione (safeImportErrorMessage). L'analisi è non-critical per le suggestions — bloccare l'intero import per un fallimento di feature opzionale non avrebbe senso.

---

## Subscription gating

| Option | Description | Selected |
|--------|-------------|----------|
| Tutti i piani — free incluso | Nessuna modifica alla firma, loadActivePatterns as-is | ✓ |
| Solo basic+ | Aggiunge subscriptionPlan alla firma di analyzeFile | |
| Solo pro | Ancora più restrittivo | |

**User's choice:** Tutti i piani — free incluso

**Follow-up — coverage patterns:**

| Option | Description | Selected |
|--------|-------------|----------|
| Sì — stessa logica di loadActivePatterns | User + system patterns (userId IS NULL), coerente con importFile | ✓ |
| Solo pattern utente | Esclude system patterns | |
| Claude decide | Ovvio dal codice | |

**User's choice:** Sì — stessa logica di loadActivePatterns

**Notes:** La feature è discovery, non auto-categorizzazione. I free user possono già creare pattern manualmente; le suggestions accelerano quel processo senza aggiungere categorizzazione automatica. Nessuna modifica alla firma di analyzeFile.

---

## Claude's Discretion

- Naming delle funzioni helper per il NormalizedTransactionRow → PatternDetectorRow adapter
- Riuso diretto di `safeImportErrorMessage` vs. pattern inline per il warning log
- Test di fase (accettabile deferire — detector già coperto in fase 33)

## Deferred Ideas

Nessuna — la discussione è rimasta nel dominio della fase.
