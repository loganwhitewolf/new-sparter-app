# Phase 77: amortization-schema-and-activation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-28
**Phase:** 77-amortization-schema-and-activation
**Areas discussed:** Activation flow & preview, Eligibility guards, Undo / remove a plan

---

## Gray-area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Flusso attivazione + anteprima | Dialog + schedule preview + N bounds | ✓ |
| Attivazione da inserimento manuale | Inline on create form vs create-then-amortize | (delegated to Claude) |
| Guardie di idoneità | Which outflows can be amortized | ✓ |
| Annulla / rimuovi piano | Undo in Phase 77 vs teardown in Phase 78 | ✓ |

---

## Activation flow & preview

| Option | Description | Selected |
|--------|-------------|----------|
| Dialog con anteprima del piano | Enter months, see full schedule (dates + amounts, remainder on first) before confirming | ✓ |
| Dialog minimale, solo mesi | Single months field + confirm, no preview | |
| Inline sulla riga, senza dialog | Inline months field, immediate confirm | |

**User's choice:** Dialog con anteprima del piano.

| Option | Description | Selected |
|--------|-------------|----------|
| Min 2, max 60 | 60-month horizon from ADR 0019 | (initially chosen, then corrected) |
| Min 2, nessun massimo | Only N≥2, no ceiling | ✓ |
| Min 2, max 36 | 3-year cap | |

**User's choice:** Min 2, **no maximum** (corrected mid-turn from the initial "max 60").
**Notes:** Natural cap = amount in cents (each instalment ≥ 0,01), enforced as validation. Flagged
downstream: unbounded N stretches the Phase 80 lens-aware selector horizon.

---

## Eligibility guards

| Option | Description | Selected |
|--------|-------------|----------|
| Bloccata se coinvolta in rimborso | Block if anchor or secondary of an active reimbursement | ✓ |
| Consentita, gestita in Fase 78 | Allow, handle base/re-spread as AMORT-06 | |
| Decidi tu | Claude picks safe default | |

**User's choice:** Block if involved in a reimbursement.

| Option | Description | Selected |
|--------|-------------|----------|
| Già ammortizzata | One plan per transaction | ✓ |
| Dentro un Expense Group | Detach would tear it out of the group | ✓ |
| Importo troppo piccolo | Instalments would round to 0 | ✓ |

**User's choice:** All three (multi-select).
**Notes:** "Importo troppo piccolo" concretised as: every instalment must be ≥ 0,01 given N.

---

## Undo / remove a plan

| Option | Description | Selected |
|--------|-------------|----------|
| Sì, azione 'rimuovi ammortamento' | Delete plan + instalments AND revert the detach (re-attach by original descriptionHash) | ✓ |
| Sì, ma senza ri-attaccare | Delete plan + instalments, leave transaction as detached Standalone Expense | |
| No, solo via 'close' in Fase 78 | No teardown in this phase | |

**User's choice:** "Rimuovi ammortamento" action with full detach reversal.
**Notes:** Reverting the detach requires recomputing the original descriptionHash and re-linking/
merging into the shared Expense — flagged as a reconciliation concern for research/plan; the current
`transaction-detach.ts` has no reverse operation.

---

## Claude's Discretion

- **Manual-entry activation shape:** user delegated. Decided → inline "Ammortizza" checkbox + months
  field on the create-transaction form, with create + detach + plan materialisation atomic, reusing
  the same preview affordance. Keeps AMORT-01's three entry points behaviourally consistent.

## Deferred Ideas

- AMORT-04/05/06/07 (close, realization, reimbursement re-spread, edit block) → Phase 78.
- `/amortizations` registry (REG-01/02/03) → Phase 79.
- Dashboard lens switch, accrual widgets, lens-aware selectors, whole-year accrual view (LENS-01/02/04/05) → Phase 80.
- Final Italian copy for cassa / competenza labels → parked (Phase 80).
- Plain view vs materialized view for `ledger_entry` → performance-driven, plan-time decision.
