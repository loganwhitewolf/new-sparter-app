# Phase 79: amortizations-registry - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-28
**Phase:** 79-amortizations-registry
**Areas discussed:** Close-from-registry scope, Columns & summary, Open vs closed view, Row navigation

---

## Close-from-registry scope (REG-02)

### Q1 — What can the registry "Chiudi" action do?

| Option | Description | Selected |
|--------|-------------|----------|
| Solo scrap-close dal registro | Collapse remaining onto closure month; realize-via-sale stays on tx detail; reuses `CloseAmortizationDialog`; no synthetic tx | ✓ |
| Chiusura completa dal registro | Dialog also links/creates a real sale tx (realizePlanTx) inline | |
| Scrap + campo valore opzionale | Literal ROADMAP wording; scalar value would violate D-02 (never synthetic) | |

**User's choice:** Solo scrap-close dal registro.
**Notes:** Respects Phase 78 D-02 (realization = real transaction, never synthetic) and reuses the existing dialog as-is → **D-A1**.

### Q2 — Also a shortcut to realize-via-sale?

| Option | Description | Selected |
|--------|-------------|----------|
| Solo 'Chiudi', niente scorciatoia | Only scrap-close in the registry; sale via row navigation to tx detail | |
| 'Chiudi' + link 'Realizza con vendita' | Row offers scrap-close AND a link to the tx detail realization flow | ✓ |
| Solo su piani aperti | Actions only on open plans; no sale shortcut | |

**User's choice:** 'Chiudi' + link 'Realizza con vendita' → **D-A2**. Corollary captured: actions only on open plans (**D-A3**).

---

## Columns & summary (REG-01)

### Q1 — Aggregate summary header?

| Option | Description | Selected |
|--------|-------------|----------|
| Sì: netto residuo aperto | Single total: net still-to-amortize across open plans | ✓ |
| Sì: più metriche | Multi-KPI strip (open count, initial, consumed, net) | |
| No, solo tabella | No header aggregate, like /reimbursements | |

**User's choice:** Sì: netto residuo aperto (single figure) → **D-B1**.

### Q2 — How to show plan progress in the row?

| Option | Description | Selected |
|--------|-------------|----------|
| Mesi 'X/N' + barra | consumed/total (e.g. 11/20) + light progress bar | ✓ |
| Solo mesi rimanenti (numero) | Single remaining-months number | |
| Mesi 'X/N', senza barra | consumed/total text, no bar | |

**User's choice:** Mesi 'X/N' + barra → **D-B2**.

---

## Open vs closed view (REG-03)

### Q1 — Default filter for open vs closed?

| Option | Description | Selected |
|--------|-------------|----------|
| Default 'Aperti' + toggle | Open only by default; status filter reveals closed (reuses /reimbursements pattern) | ✓ |
| Tutti insieme + badge stato | Single list, open+closed, status badge/column | |
| Due sezioni separate | Open on top, closed below/tab | |

**User's choice:** Default 'Aperti' + toggle → **D-C1**.

### Q2 — Default sort (open plans)?

| Option | Description | Selected |
|--------|-------------|----------|
| Mesi rimanenti crescenti | Plans closest to completion on top | ✓ |
| Data transazione decrescente | Most recent first | |
| Netto residuo decrescente | Highest remaining cost first | |

**User's choice:** Mesi rimanenti crescenti → **D-C2**. Closed-vs-open badge styling left to UI-phase (**D-C3**).

---

## Row navigation

### Q1 — What happens on row click?

| Option | Description | Selected |
|--------|-------------|----------|
| Va al dettaglio transazione | Links to amortized transaction detail (hosts Phase 78 lifecycle); no new page | ✓ |
| Nuova pagina dettaglio piano | Build /amortizations/[id] with schedule/history | |
| Nessuna navigazione | Rows not clickable; inline actions only | |

**User's choice:** Va al dettaglio transazione → **D-D1**. Consistent with D-A2 target.

---

## Claude's Discretion

- Nav/menu entry for `/amortizations`, `EmptyState` copy, `lib/routes.ts` constants — follow `/reimbursements` conventions.
- DAL list-query shape deriving initial/consumed/net/remaining (Decimal.js) — planner/pattern-mapper against live schema.
- Closed-plan badge styling (D-C3).

## Deferred Ideas

- Dedicated `/amortizations/[id]` plan detail page — deferred; tx detail is the plan detail (D-D1).
- Inline sale-value / sale-linking in the registry — deferred to tx detail flow (ADR 0019 §8 "never synthetic").
- Phase 80 lens work (LENS-01/02/04/05).
- Plan re-open after close — still out of scope.
