# Phase 4: Dashboard KPI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 04-dashboard-kpi
**Areas discussed:** Libreria grafici, Breakdown categorie, Layout KPI cards
**Status:** Completo

---

## Libreria grafici

| Option | Description | Selected |
|--------|-------------|----------|
| Recharts (via shadcn chart) | Standard shadcn, palette CSS variables, zero config extra | ✓ |
| CSS-only / progress bar | Nessuna dipendenza, meno espressivo per trend multi-serie | |
| Tremor | Finance-oriented ma sistema di stile parallelo a shadcn | |

**User's choice:** Recharts con componente shadcn `chart`
**Notes:** Scelta immediata — standard de facto per progetti shadcn/ui

---

## Breakdown categorie

| Option | Description | Selected |
|--------|-------------|----------|
| Bar orizzontali + drill-down | Click categoria espande subcategorie; Recharts HorizontalBar | ✓ |
| Lista con progress bar CSS | Visivamente simile ma senza drill-down interattivo | |
| Donut chart + tabella | Più visivo ma complesso, duplica informazione | |

**User's choice:** Bar orizzontali con drill-down (click espande subcategorie)
**Notes:** —

---

## Filtro tipo nel breakdown

| Option | Description | Selected |
|--------|-------------|----------|
| Tabs in/out/tutti | Tre tab sopra il breakdown; Uscite default | ✓ |
| Select + preset date unico | Più compatto ma meno immediato | |

**User's choice:** Tabs Uscite | Entrate | Tutti (Uscite come default)
**Notes:** —

---

## Layout KPI cards

| Option | Description | Selected |
|--------|-------------|----------|
| Griglia 3+2 con delta badge | Prima riga 3 card, seconda riga 2 card | |
| 5 card in fila orizzontale | 1 riga, 5 colonne su desktop | ✓ |
| 2+2+1 con balance hero | Balance card grande in cima, poi 2+2 sotto | |

**User's choice:** 5 card in fila orizzontale su desktop

---

## KPI mobile layout

| Option | Description | Selected |
|--------|-------------|----------|
| 2 colonne, 3 righe | 2+2+1 centrata su mobile, nessun scroll orizzontale | ✓ |
| Scroll orizzontale | 5 card in riga con scroll | |

**User's choice:** 2 colonne, 3 righe su mobile (< 768px)
**Notes:** —

---

## Trend mensile — tipo grafico

| Option | Description | Selected |
|--------|-------------|----------|
| Bar grouped | 4 barre per mese, Recharts BarChart | ✓ |
| Area chart stacked | Aree impilate, composizione visibile ma confronto meno chiaro | |
| Line chart multi-serie | 4 linee, ottimo per trend ma complesso con molte serie | |

**User's choice:** Bar grouped (4 Bar per mese)
**Notes:** —

---

## Trend mensile — toggle serie

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle on/off via legenda | Click sulla legenda Recharts mostra/nasconde la serie | ✓ |
| Sempre tutte visibili | Più semplice, nessun toggle | |

**User's choice:** Toggle on/off via legenda (default tutte visibili)
**Notes:** —

---

## Claude's Discretion

- Struttura componenti React per la dashboard
- Loading skeleton design
- Delta badge design (freccia vs +/- text)
- Comportamento drill-down (accordion animato vs statico)

## Deferred Ideas

- Sparkline mini-chart nelle KPI card
- Hero card balance grande
