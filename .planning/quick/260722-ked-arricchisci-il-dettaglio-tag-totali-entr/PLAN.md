---
quick_id: 260722-ked
slug: arricchisci-il-dettaglio-tag-totali-entr
date: 2026-07-22
---

# Quick Task: Arricchire il dettaglio del tag

## Problem

La sezione Tag (`/tags`, `components/tags/tag-settings-panel.tsx`) mostra una lista di
tag a sinistra; selezionandone uno, la colonna di destra espone soltanto nome, intervallo
date e i pulsanti Modifica/Archivia. È troppo poco.

## Scope (locked)

Arricchire **solo** la colonna di destra del pannello con:

1. **Totali** — Entrate, Uscite, Valore finale (netto firmato).
2. **Numero di transazioni incluse**.
3. **Lista compatta** di tutte le transazioni incluse: `data · sottocategoria · importo`
   (importo firmato, colore per segno), ordinata per data desc.

### Decisioni

- **Caricamento on-demand**: al click sul tag una server action carica il dettaglio di
  quel solo tag (niente eager di tutti i tag). Breve stato di loading.
- **Semantica coerente con la dashboard** (riuso di `effectiveAmount`/`isNotSecondary`,
  esclusione `transfer`, solo `expense.status ∈ {1,2,3}`, override utente su nature):
  il "Valore finale" coincide con `getTagTotals` e con la vista transazioni filtrata per tag.
  - Entrate = Σ importi con `direction.code='in'`
  - Uscite = |Σ importi con `direction.code='out'`|
  - Valore finale = Σ di tutti gli `effectiveAmount` inclusi (comprende eventuale allocation)
- **Riga lista**: `data · sottocategoria · importo firmato`, ordine data desc, lista scrollabile.

## Tasks

1. **DAL** `lib/dal/tags.ts` — `getTagDetail(userId, tagId)` + tipi `TagDetail`,
   `TagDetailTransaction` + funzione pura `buildTagDetailData` (aggregazione con Decimal.js),
   sullo stile di `buildTagTotalsData`.
2. **Action** `lib/actions/tags.ts` — `getTagDetailAction(tagId)` (read on-demand) con
   `resolveOwnedTagId` (IDOR belt-and-suspenders).
3. **Client** `components/tags/tag-settings-panel.tsx` — sub-componente `TagDetailView`
   (fetch in `useEffect`, race-guard, key per remount), rende totali + count + lista.

## Verification

- `tsc --noEmit`, ESLint sui file toccati, `yarn check:language`.
- Decimal.js per ogni aritmetica monetaria (nessun `+`/`-` nativo sugli importi).
- Il "Valore finale" del tag == totale già mostrato nel dashboard Tag ranking.
