# Phase 63: detail-pages-tx-expense - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 63-detail-pages-tx-expense
**Areas discussed:** Layout pagina dettaglio, Meccanica edit inline, Azioni e post-azione, Transizione dai dialog (DET-07)

---

## Layout pagina dettaglio

| Option | Description | Selected |
|--------|-------------|----------|
| Card impilate | Single column: header + Dati/Categoria/Collegamenti cards, mobile-first | ✓ |
| Due colonne | Main column + right sidebar for actions/cross-refs | |
| Definition-list | Single card, label→value rows, pencils on editable fields | |

**User's choice:** Card impilate (recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| Shell condivisa | `DetailPageShell` reused by both pages (and file page in Phase 64) | ✓ |
| Pagine indipendenti | Same visual conventions, no shared component | |
| Decidi tu | Planner decides | |

**User's choice:** Shell condivisa (recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| Description visibile, hash nascosti | Lock badge + tooltip on description; hashes never shown | ✓ |
| Tutto visibile, anche gli hash | Collapsed "Dati tecnici" section with hashes | |
| Solo testo normale | No badge; absence of pencil communicates readonly | |

**User's choice:** Description visibile con lucchetto, hash nascosti (recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| Tabella inline in card | Mini-table of linked transactions, rows link to tx pages; totals in Riepilogo | ✓ |
| Lista compatta espandibile | First 3-5 visible, "mostra tutte" expands | |
| Decidi tu | Planner decides by typical volume | |

**User's choice:** Tabella inline in card (recommended).

---

## Meccanica edit inline

| Option | Description | Selected |
|--------|-------------|----------|
| Per-campo immediato | Enter/blur saves via server action, same as existing title-edits | ✓ |
| Edit-mode con Salva | Whole card enters edit mode, single Save | |
| Misto | Per-field for title/notes, edit-mode for amount+date | |

**User's choice:** Per-campo immediato (recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| Input libero con segno | One text input accepting `-12,99`/`12,99`; Zod server-side | ✓ |
| Toggle segno + valore assoluto | Entrata/Uscita toggle + positive input | |
| Decidi tu | Follow form-dialog pattern | |

**User's choice:** Input libero con segno (recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| Inline sotto il campo | Italian service message in red under the field; field stays in edit | ✓ |
| Toast | Sonner error toast; field reverts | |
| Inline + toast | Inline for validation/pair-guard, toast for unexpected errors | |

**User's choice:** Inline sotto il campo (recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| Refresh silenzioso | `router.refresh()`, no extra message about reconciliation | ✓ |
| Toast informativo | "Spesa collegata aggiornata" toast | |
| Decidi tu | Planner decides | |

**User's choice:** Refresh silenzioso (recommended).

---

## Azioni e post-azione

| Option | Description | Selected |
|--------|-------------|----------|
| Bottoni + menu overflow | 1-2 frequent actions visible, rest in "⋯"; Elimina in menu, red | ✓ |
| Tutte visibili | Full action bar in header | |
| Tutto in un menu | Single "Azioni ▾" dropdown | |

**User's choice:** Bottoni + menu overflow (recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| Riuso pieno | Existing dialogs invoked from page as-is; `router.refresh()` on completion | ✓ |
| Riuso con adattamenti | Same components with page-specific variants | |
| Decidi tu | Planner evaluates per component | |

**User's choice:** Riuso pieno (recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| Alla tabella di origine | Redirect to /transactions or /expenses with toast | ✓ |
| Indietro (history back) | `router.back()` | |
| Decidi tu | Planner picks safest | |

**User's choice:** Alla tabella di origine (recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| Solo campo in card + CTA se da categorizzare | Categoria card opens picker; amber header CTA only when uncategorized | ✓ |
| Entrambi sempre | Header button + card field always | |
| Solo azione header | Card is display-only | |

**User's choice:** Solo campo in card, CTA ambra quando da categorizzare (recommended).

---

## Transizione dai dialog (DET-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Una sola voce 'Dettagli' → pagina | "Modifica" removed; form-dialog kept for create; transactions-dialog deleted | ✓ |
| Rimuovi entrambe, solo click su riga | No menu entries at all | |
| Decidi tu | Planner checks all three tables | |

**User's choice:** Una sola voce 'Dettagli' che naviga alla pagina (recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| Solo voce menu, wiring in Fase 64 | Row-title click/breadcrumb/back stay in DET-09 scope | ✓ |
| Anche click su titolo riga | Anticipate row-click in this phase | |
| Decidi tu | Planner draws the line | |

**User's choice:** Solo voce menu; wiring completo in Fase 64 (recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| Restano tutti | Inline title-edit, quick categorize, bulk, spesa a sé all stay in tables | ✓ |
| Solo bulk e categorizza | Remove inline title-edits from tables | |
| Decidi tu | Planner evaluates redundancy | |

**User's choice:** Restano tutti (recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| Tabella filtrata, come oggi | File cross-ref → `/import?file=…`; Phase 64 repoints via route constant | ✓ |
| Già /import/[fileId] | Point at the Phase 64 route now (broken/stub until then) | |
| Decidi tu | Planner decides by delivery order | |

**User's choice:** Tabella filtrata come oggi (recommended).

---

## Claude's Discretion

- Date editing control (native vs calendar popover).
- Card naming/ordering, loading/skeleton states.
- 404/ownership handling pattern for the new dynamic routes.
- Collega/scollega rimborso as menu toggle matching pair-popover semantics.
- How the tx page surfaces category-through-expense when the expense holds multiple transactions.

## Deferred Ideas

- Row-title click navigation, breadcrumbs, back behavior → Phase 64 (DET-09).
- `/import/[fileId]` page + repointing file cross-ref → Phase 64 (DET-08).
- Description editing, bulk edit, revision history, SPLIT-01 → milestone-level deferred.
