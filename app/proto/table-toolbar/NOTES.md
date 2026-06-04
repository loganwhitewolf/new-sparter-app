# Prototype — Toolbar Filtri vs Ordinamento

**Question:** how to separate "Filtri" from "Ordinamento" so the user always knows which they're doing,
and does the active-chip model read clearly? Judged against a dense, realistic transactions table.

Route: `/proto/table-toolbar?variant=A|B|C` (needs `PROTOTYPES_ENABLED`; 404 in prod).
Switch with the floating bar or ← / → keys.

All three implement the same LOCKED decisions (`.planning/table-filter-sort-DECISIONS.md`, ADR 0009/0010):
month multi-select (only months with data), amount range, category/platform/status filters, active chips +
"Cancella tutto", transfer rows rendered neutral, `id` sort tiebreaker. They disagree only on toolbar structure.

## Variants
- **A — Sort sugli header.** Filtri in un Popover "Filtri (n)". Ordinamento SOLO cliccando gli header (Importo/Data).
  Separazione massima via affordance. Test: l'ordinamento da header è scopribile? Manca un sort esplicito su desktop?
- **B — Due sezioni etichettate.** Blocchi affiancati "FILTRI" | "ORDINAMENTO". Header non cliccabili.
  Separazione verbale esplicita. Test: l'etichetta esplicita batte l'affordance? Occupa troppo spazio?
- **C — Ingresso unico a tab.** Una barra + "Filtra e ordina" → pannello con tab Filtri/Ordina. Barra mostra
  l'ordinamento corrente + chip. Test: consolidare in un ingresso è più pulito o nasconde troppo?

Nota: il prototipo NON copre il comportamento mobile (sort detached + bottom-sheet vaul) — da valutare a parte.

**Picker mesi a scala (deciso):** griglia-per-anno. Switcher anno + griglia 12 caselle (caselle
disabilitate dove non c'è dato), "Tutto l'anno", preset relativi (Ultimi 3 mesi / Quest'anno / Anno scorso).
Mock data esteso a **3 anni** (2024–2026, con buchi) per testarlo alla scala vera. Apri "Mesi" nella variante A.

## Verdetto

**Vincitore: A — Ordinamento sugli header.** Confermato dall'utente (2026-06-04).
- Struttura: filtri nel pannello "Filtri (n)" + chip attivi; ordinamento esclusivamente sugli header.
- **Tutte** le colonne ordinabili (non solo Importo/Data): testo = alfabetico ASC/DESC con collation italiana
  (case/accento-insensitive), importo = numerico, data = cronologico; tiebreaker `id`.
- Picker mesi = griglia-per-anno + preset (validato su 3 anni di dati mock).
- B e C scartate; nessun pezzo ripreso.

Aperto: filtro importo su valore assoluto vs con segno (vedi DECISIONS open #). Mobile (sort detached +
bottom-sheet) non coperto dal proto, da fare in plan-phase.
