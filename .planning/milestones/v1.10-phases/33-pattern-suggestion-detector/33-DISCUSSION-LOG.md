# Phase 33: pattern-suggestion-detector - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in 33-CONTEXT.md — this log preserves the discussion.

**Date:** 2026-05-22
**Phase:** 33-pattern-suggestion-detector
**Mode:** discuss
**Areas analyzed:** Posizione del modulo, Input della copertura, Interfaccia input dual-source

---

## Gray Areas Presented

| Area | Options | Selected |
|------|---------|----------|
| Posizione del modulo | lib/utils/ (pure, no server-only) / lib/services/ | lib/utils/pattern-suggestions.ts |
| Input della copertura | covered: boolean per riga / ActivePattern[] come param / caller pre-filtra | ActivePattern[] come parametro (localizzato come CoveragePattern) |
| Interfaccia input dual-source | PatternDetectorRow stretta ora / NormalizedTransactionRow[] per ora | PatternDetectorRow stretta definita ora |

---

## Discussion Detail

### Posizione del modulo

Presentate due opzioni: `lib/utils/` (funzione pura, coerente con import.ts) vs `lib/services/` (accanto alla categorization ma richiederebbe server-only inutilmente).

**Selezionato:** `lib/utils/pattern-suggestions.ts`

### Input della copertura (SUG-05)

Il detector deve escludere righe già coperte da pattern attivi. Follow-up su tensione architetturale: `ActivePattern` è definito in `lib/services/categorization.ts` (server-only), ma il detector sta in `lib/utils/`.

**Selezionato:** `ActivePattern[]` come secondo parametro → risolto con interfaccia locale minima `CoveragePattern = { pattern: string; amountSign: 'positive' | 'negative' | 'any' }`. Callers passano ActivePattern[] che la soddisfa duck-typing. Zero import da services.

### Interfaccia input dual-source

ADR indica che il detector deve funzionare per pre-import (NormalizedTransactionRow) e post-import DB (fase 36). Scegliere ora vs rifattorizzare in fase 36.

**Selezionato:** `PatternDetectorRow` stretta definita in fase 33: `{ description, normalizedDescription, amount, valid, covered }`. Entrambi gli adapter (fase 34 e 36) mapperanno a questa interfaccia. Nessun refactoring futuro.

---

## Corrections Applied

None — all recommendations accepted.

## Deferred Ideas

None raised during discussion.
