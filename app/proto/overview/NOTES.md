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

## Verdetto

_(da compilare dopo la review nel browser)_

- Variante scelta:
- Perché:
- Pezzi da rubare da altre varianti:
- Note (KPI delta dice "vs periodo prec." → nel reale sarà "vs anno prec."):
