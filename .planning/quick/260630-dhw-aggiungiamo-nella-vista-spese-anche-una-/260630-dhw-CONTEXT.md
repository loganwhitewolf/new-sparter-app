# Quick Task 260630-dhw: CTA da categorizzare su vista Spese - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning

<domain>
## Task Boundary

Aggiungere nella vista spese una CTA per vedere subito le spese da categorizzare senza aprire i filtri. Rimuovere il filtro "Categorizzazione" dalla sezione filtri (ridondante).
</domain>

<decisions>
## Implementation Decisions

### Posizionamento CTA
- Pill inline nella riga titolo (pattern OverviewNudge), allineata a destra accanto a "Nuova spesa"

### Conteggio
- Mostrare il conteggio: "Da categorizzare (N)"

### Stato attivo
- Toggle: secondo clic rimuove `?status=uncategorized` e torna alla vista completa

### Claude's Discretion
- Stile visivo amber pill coerente con OverviewNudge; stato attivo con bordo/sfondo più marcato
- Count server-side all-time (stesso bucket status `['1','4']` di getExpenses)
- CTA nascosta quando count=0 e filtro non attivo
</decisions>

<specifics>
## Specific Ideas

Riferimento: `components/dashboard/overview/overview-nudge.tsx` e slot nudge in `overview-header.tsx`.
</specifics>

<canonical_refs>
## Canonical References

- CONTEXT.md — expense status buckets (O-01)
- expenses.table.ts — config filtri toolbar
</canonical_refs>
