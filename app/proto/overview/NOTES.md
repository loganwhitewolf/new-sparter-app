# PROTOTYPE — overview redesign · NOTES

> Throwaway. Delete this whole folder once the verdict is captured.

## Domanda

Il nuovo design del primo tab `/dashboard/overview` (emerso dal grill-me) è **leggibile e non confuso**,
a differenza della versione attuale (barre stacked che mescolavano entrate+uscite con 8 segmenti colorati)?

## Come provarlo

### In locale
```
PROTOTYPES_ENABLED=1 yarn dev
```
Poi apri: `/proto/overview` (senza l'env la rotta è 404).

### Per stakeholder esterni (Vercel Preview)
- La rotta `/proto/*` vive **fuori** dall'area autenticata: niente login, niente onboarding gate.
- È abilitata **solo** dove esiste l'env `PROTOTYPES_ENABLED`, che va settata **scoped su Preview** in Vercel → in Production la rotta è 404.
- `robots: noindex` impostato, quindi non viene indicizzata.
- Condividi al PO l'URL del **preview deployment** del branch `prototype/dashboard-overview` + `/proto/overview`.

### Interazioni
- Cambia variante: barra fluttuante in basso, o frecce ← →.
- Cambia anno: selettore in alto a destra (2026 = anno in corso gen→mag · 2025 = anno completo).
- Filtra entrate (ricorrenti/straordinarie) e uscite (per nature): chip sopra il grafico. Le KPI restano sui totali reali.

## Le 5 varianti del grafico hero

- **A — Barre raggruppate**: il design deciso alla lettera. Entrate/Uscite affiancate per mese, movers in lista sotto.
- **B — Barre divergenti**: entrate sopra lo zero, uscite sotto → il bilancio del mese si legge come distanza dallo zero. Movers in colonna laterale.
- **C — Righe per mese**: niente recharts, ogni mese è una riga con due mini-barre orizzontali + bilancio a destra. Movers promossi in cima.
- **D — Due tab**: grafico (tab "Andamento") e movers (tab "Variazioni") separati in due tab sotto le KPI, così ognuno prende tutta l'altezza disponibile invece di impilarsi.
- **E — Affiancato + barre su**: layout a due colonne di B (grafico | movers) ma con il grafico di A — barre raggruppate entrambe verso l'alto, niente divergenza.

## Decisioni bloccate (grill-me 2026-05-29)

Queste sono LOCKED — input diretto del plan GSD. Non riaprirle, salvo nuova discussione.

- **Guida temporale = selettore ANNO** (2026, 2025…), non più preset. Tutta la tab parla dell'anno scelto.
- **KPI** (le 5 attuali restano): totali dell'**anno selezionato** (gen→mese corrente se in corso, gen–dic se passato); delta = **YTD vs stesso arco dell'anno precedente**.
- **Grafico hero "Entrate e uscite per mese"**: barre **raggruppate** Entrate (verde) / Uscite (rosso) per mese. NIENTE stack-by-nature (era la causa della confusione). NIENTE bilancio nel grafico (vive nelle KPI).
- **Filtri**: chip che filtrano i **totali** (barre piene, non stack):
  - Entrate per **tipo**: Ricorrente (stipendio) / Straordinaria (vendita azioni).
  - Uscite per **nature** (essential, discretionary, operational, financial, debt, extraordinary).
  - Le KPI restano sui **totali reali** (ignorano i filtri del grafico).
- **Blocco "Variazioni mese-su-mese"**: **ultimi due mesi completi** dell'anno (es. "Apr vs Mar"), **solo uscite**, ordinate per **variazione assoluta in €**, soglia rumore **15€**, mostra aumenti (▲) e cali (▼), top 5, righe cliccabili → drill-down categoria.
- **Dati (per il plan)**: `getMonthlyTrendByNature` esistente da splittare in/out + entrate per tipo; nuove `getOverview(year)` con confronto YTD-vs-YTD, `getMonthOverMonthCategoryChanges(year, limit)`, `getYearsWithData()`.

## Domande aperte (da chiudere prima del PLAN)

1. **Split entrate ricorrente/straordinaria**: mappa sulle `nature` esistenti lato `in` (`income` vs `extraordinary`) o serve un campo dedicato? (impatta schema/DAL)
2. **Label delta KPI**: confermare "vs anno prec." al posto di "vs periodo prec.".
3. **Sorgente selettore anno**: nuova query `getYearsWithData()` (anni con transazioni).

## Verdetto

_(da compilare dopo la review nel browser / scelta del PO)_

- Variante scelta:
- Perché:
- Pezzi da rubare da altre varianti:
- Note:
