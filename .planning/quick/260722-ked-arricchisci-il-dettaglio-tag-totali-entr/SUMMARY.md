---
quick_id: 260722-ked
slug: arricchisci-il-dettaglio-tag-totali-entr
date: 2026-07-22
status: complete
commit: 1cce578
branch: quick/tag-detail-enrichment
---

# Summary: Arricchire il dettaglio del tag

La colonna di destra del pannello Tag (`/tags`) ora, alla selezione di un tag, mostra:

1. **Totali** — Entrate, Uscite, Valore finale (netto firmato, colore per segno).
2. **Numero di transazioni incluse**.
3. **Lista compatta** delle transazioni incluse: `data · sottocategoria · importo firmato`,
   ordine data desc, scrollabile (`max-h-[420px]`).

## Implementazione

- **DAL** `lib/dal/tags.ts`: `getTagDetail(userId, tagId)` + `buildTagDetailData` (puro,
  aggregazione con Decimal.js) + tipi `TagDetail`/`TagDetailTransaction`. Stessa semantica
  di netting di `getTagTotals`/`getOverviewAmountTotals`: `effectiveAmount` + `isNotSecondary`,
  esclude `transfer`, `expense.status ∈ {1,2,3}`, direction via override utente. Il "Valore
  finale" coincide con il totale mostrato nel dashboard Tag ranking.
- **Action** `lib/actions/tags.ts`: `getTagDetailAction(tagId)` — read on-demand, con
  `resolveOwnedTagId` (IDOR belt-and-suspenders).
- **Client** `components/tags/tag-settings-panel.tsx`: sub-componente `TagDetailView`
  (fetch in `useEffect`, race-guard `cancelled`, `key={tag.id}` per remount), `StatCard`,
  formattazione valuta/data locali `it-IT`.

## Decisioni

- Caricamento **on-demand** via server action (non eager di tutti i tag).
- Riga lista: **data · sottocategoria · importo**, ordine data desc.

## Verifica

- `tsc --noEmit`: i file toccati sono puliti (gli errori residui sono in test pre-esistenti,
  non correlati).
- ESLint sui 3 file: 0 problemi (warning `set-state-in-effect` risolto rimuovendo i reset
  sincroni, dato il remount via `key`).
- `yarn check:language`: passa.

## Follow-up possibili

- Nessun test unitario aggiunto per `buildTagDetailData` (coerente con l'assenza di test per
  `buildTagTotalsData`); candidabile se si vuole coprire l'aggregazione Decimal.
- Non verificato in browser live (nessun harness jsdom nel repo).
