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

## Decisioni bloccate (grill-me 2026-06-03 — review PO)

- **Titolo + selettore anno**: il selettore anno esce dall'angolo in alto a destra e diventa più vicino al titolo. 5 trattamenti in prova via `?header=1..5` (switcher dedicato nella barra flottante):
  - H1 — pill inline accanto al titolo (stessa riga)
  - H2 — anno grande (3xl) sopra, titolo come sottotitolo muted
  - H3 — titolo a sinistra, anno grande muted a destra
  - H4 — tab-pills per anno sotto il titolo
  - H5 — frecce ‹ anno › stile calendario
  - Anni derivati dai dati (`AVAILABLE_YEARS` → futura `getYearsWithData()`). **Variante header scelta = TBD (PO)**.

- **Blocco movers umanizzato** (era "Variazioni mese-su-mese" con righe `+220€ (+∞%) 0€→220€`):
  - Split in **due mini-sezioni**: **"Dove hai speso di più"** (delta > 0, importi rossi) e **"Dove hai risparmiato"** (delta < 0, importi verdi). Sezione nascosta se vuota.
  - Riga = frase umana: `{categoria}  ·  {importo} {in più|in meno}`. Niente `%`, niente schema `prev→curr`.
  - Caso `prev = 0` (spesa nuova): qualifier diventa **"spesa nuova"** invece di "in più".
  - Context label in cima: **"{Mese} rispetto a {mese prec.}"** (es. "Aprile rispetto a marzo"), mesi per esteso.
  - Tab di variant-D rinominato "Variazioni" → **"Cambiamenti"**.

  **Glossario**: questo blocco confronta gli ultimi due mesi completi (mese-su-mese), NON è una `Deviation` (che è vs Baseline 3 mesi). La parola **"variazione" resta da evitare** (riservata-deprecata in CONTEXT.md). Termine canonico interno candidato: **`MonthOverMonthChange`** (query `getMonthOverMonthCategoryChanges`). Copy utente: "Rispetto al mese scorso" / "Dove hai speso di più" / "Dove hai risparmiato". → da promuovere in CONTEXT.md quando il design è locked.

- **KPI ridotte a 4 + banner "da categorizzare"**:
  - In alto restano **solo 4 KPI card**: Totale entrate, Totale uscite, Bilancio, Tasso risparmio. La 5ª card "Da categorizzare" è **eliminata**.
  - Il conteggio non-categorizzato diventa un **banner ambra (tono invito, non errore)** sopra le KPI: icona + *"Hai {N} spese da categorizzare. Rendi il tuo report più preciso."* + CTA **"Categorizza ora"**.
  - **Condizionale**: il banner appare solo se `count > 0` (coerente con `Uncategorized` = segnale d'azione, non stato permanente). Su anno senza non-categorizzati (mock 2025) sparisce.
  - **Caveat glossario per la feature vera**: copy dice "spese" (scelta PO) → il contatore deve contare **solo le uscite non categorizzate** (`out`), NON le entrate, altrimenti il numero contraddice `Expense = type out` del CONTEXT.md. Nel prototipo si usa il numero mock as-is.
  - CTA reale punterà alle transazioni filtrate su non categorizzate (`APP_ROUTES.transactions`); nel prototipo è inerte.

  **AGGIORNAMENTO 2026-06-03 — il banner full-width rubava una riga e schiacciava il grafico.** Sostituito da un **nudge inline ambra sulla riga del titolo** (a destra del blocco header, qualunque sia la variante H1–H5):
  - Non è un box-banner: testo ambra leggero, icona + frase **"Hai delle spese da categorizzare, rendi il tuo report più preciso"** (visibile, NON tooltip) + link **"Categorizza ora"** + **X**. Va a capo su ~2 righe → stessa altezza del blocco titolo+anno, niente riga rubata.
  - Senza numero nel testo (scelta copy PO: "hai delle spese", non "hai 14 spese").
  - **X = nascondi**. Layout header: `flex flex-wrap items-start justify-between` con header `flex-1` a sinistra e nudge `max-w-xs shrink-0` a destra; su mobile il nudge va sotto (flex-wrap).

  **Semantica "nascondi definitivamente" — DECISA: opzione A + localStorage (NO DB).**
  - A = dismiss intelligente: il nudge **riappare quando arrivano nuove spese da categorizzare**.
  - Persistenza **solo `localStorage`**, nessun valore su DB (decisione utente).
  - Trigger client-side: salvare in localStorage un **`lastSeenCount`**; alla apertura, se `countAttuale > lastSeen` → nuove spese arrivate → riappare (flag azzerato), altrimenti resta nascosto. Confronto sull'ultimo visto (non sul valore al dismiss) così regge anche dopo aver categorizzato e poi re-importato.
  - **Prototipo**: dismiss booleano semplice in `localStorage` (`proto-uncat-dismissed`) — il count mock è statico e lo switch anno falserebbe un reappear count-based. Per ri-mostrare in demo: pulire la key da devtools.

- **Movers → drill-down per-mese sulle barre del grafico** (supera il blocco fisso "ultimi due mesi completi"):
  - I "cambiamenti di spesa" non sono più un blocco statico Apr-vs-Mar: sono il **"di cui" di ogni barra mensile delle Uscite**. **Clic su un mese** → il pannello mostra i **top movers di quel mese vs il mese precedente** (▲ in più / ▼ in meno / "spesa nuova").
  - Contenuto = **solo top movers** del mese (non la composizione completa: scelta esplicita PO). Riusa le due mini-sezioni "Dove hai speso di più / risparmiato".
  - Posizione pannello: **variant A → sotto il grafico** (accordion); **variant E → colonna destra** (più spazio, `limit=8` voci vs 5 di A). Costruito **solo su A ed E** (le due varianti in testa al verdetto PO).
  - Barre cliccabili via recharts `activeTooltipIndex`; mese selezionato evidenziato (uscite a piena opacità, gli altri a 0.4).
  - **Default mese selezionato = ULTIMO MESE CON TRANSAZIONI** (`lastMonthIndex`), non "ultimo mese completo". Primo mese (nessun precedente) → empty state.
  - Dati: aggiunto `CATEGORIES_2026/2025` (uscite per-categoria per-mese); `getMovers(year, monthIndex?, limit?)` ora parametrico.

  **Tensione di glossario da risolvere (CONTEXT.md):** il PO ha osservato che **non si può sapere se un mese è "completo"** — si conosce solo ciò che è stato importato. Questo confligge con `Reference Period` = *"ultimo mese di calendario completato... mai il mese in corso parzialmente importato"*. → **rivedere la definizione di Reference Period** in fase di PLAN: forse "ultimo mese con dati" in tutta la dashboard, o un modo esplicito per marcare un mese come completo.

- **Educazione in-context per le label `FlowNature`** (PO: "Essenziale, Discrezionale, Straordinario… sono label da utente avanzato, non comprese alla prima lettura"):
  - **Decisione**: NON educare nell'onboarding (one-shot, dimenticabile, overload nel momento sbagliato) ma **al punto d'uso**. Aggiunto al prototipo nei chip filtro **sia Entrate che Uscite**:
    - icona **ⓘ accanto a "Entrate" e "Uscite"** → **popover-legenda** (componente `Legend` generico) con tutti i tipi + spiegazione di una riga (discoverable, funziona anche su touch);
    - `title` per-chip (tooltip hover desktop). `NATURE_DESCRIPTIONS` + `INCOME_DESCRIPTIONS` in mock-data.
  - **→ va nel PLAN di questa milestone** (vive nel componente del grafico che si costruisce comunque).
  - **DEFERRED → quick task futuro (NON questa milestone)**: eventuale **rinomina della tassonomia `FlowNature`** verso nomi più piani (es. "Discrezionale" → "Sfizi/Extra"). Impatto cross-cutting: `CONTEXT.md`, seed, `SubcategoryNatureSelect` (impostazioni), grafici nature, override utente. Da valutare a parte: mantenere i termini economici canonici come valore interno e introdurre solo **label di display** più amichevoli, vs rinomina piena.

- **Letture qualitative per ogni KPI card** (PO: "Tasso risparmio 32% → è buono? altrimenti è un tool troppo tecnico"):
  - Ogni card mostra una **riga di lettura** sotto il valore, colorata per sentiment (verde good / ambra warn / rosso bad / muted neutral), oltre al delta badge.
  - **Tipo di lettura diverso per card** (non tutte hanno un metro assoluto):
    - **Tasso risparmio** = benchmark (euristica 50/30/20): ≥20% "Ottimo, sopra il 20% consigliato" · 10–20% "Buono, puoi puntare al 20%" · 0–10% "Migliorabile" · <0 "Attenzione: spendi più di quanto guadagni".
    - **Bilancio** = segno: >0 "Spendi meno di quanto guadagni" · <0 "Spendi più di quanto guadagni" · =0 "Sei in pareggio".
    - **Entrate / Uscite** = **trend vs anno prec.** (no verdetto assoluto: non esiste un "buono" universale per quanto guadagni/spendi). Es. "Più entrate del 2025", "Spendi meno del 2025", "In linea con il 2025".
  - **Caveat (a verbale per il PLAN)**: è **guida gentile, NON consulenza finanziaria**. Tono incoraggiante/osservazionale, mai colpevolizzante (un risparmio basso può essere corretto, es. rientro da debito). Le soglie risparmio sono opinabili → tenerle configurabili/riviste con il dominio.
  - Implementazione prototipo: `ReadingKpiCard` locale (clone del reale `KpiCard`, che resta shipped/intatto) + helper `savingsReading/balanceReading/trendReading` in `kpi-row.tsx`. Delta badge rietichettato "vs {anno prec.}" (coerente con KPI = YTD-vs-YTD).

- **Cifre sempre visibili sulle barre** (PO: "leggere entrate/uscite per mese sempre, non solo in hover"):
  - Aggiunte `LabelList` sopra le barre Entrate e Uscite (variant A ed E), formato **compatto k-notation** (`eurCompact`, es. "2,5k") per non affollare con 12 mesi. Valore esatto resta nel tooltip.
  - **RIFIUTATO — scomporre le barre per nature** (idea PO "colori diversi per nature sulla barra"): è **esattamente il pasticcio che il redesign ha eliminato** (decisione LOCKED 2026-05-29: "NIENTE stack-by-nature, era la causa della confusione"; fino a 8 segmenti/mese × N mesi = zuppa). E non serve: la composizione per nature è già servita da (a) chip filtro + legenda ⓘ, (b) pannello drill-down al clic sul mese. Barra resta a 2 colori (entrate/uscite). → niente da fare, decisione confermata.

## Decisioni bloccate (grill-me 2026-05-29)

Queste sono LOCKED — input diretto del plan GSD. Non riaprirle, salvo nuova discussione.

- **Guida temporale = selettore ANNO** (2026, 2025…), non più preset. Tutta la tab parla dell'anno scelto.
- **KPI** (le 5 attuali restano): totali dell'**anno selezionato** (gen→mese corrente se in corso, gen–dic se passato); delta = **YTD vs stesso arco dell'anno precedente**.
- **Grafico hero "Entrate e uscite per mese"**: barre **raggruppate** Entrate (verde) / Uscite (rosso) per mese. NIENTE stack-by-nature (era la causa della confusione). NIENTE bilancio nel grafico (vive nelle KPI).
- **Filtri**: chip che filtrano i **totali** (barre piene, non stack):
  - Entrate per **tipo**: Ricorrente (stipendio) / Straordinaria (vendita azioni).
  - Uscite per **nature** (essential, discretionary, operational, financial, debt, extraordinary).
  - Le KPI restano sui **totali reali** (ignorano i filtri del grafico).
- **Blocco "Variazioni mese-su-mese"**: ~~**ultimi due mesi completi** dell'anno (es. "Apr vs Mar")~~ → **SUPERATA il 2026-06-03** (vedi sotto): non più un blocco fisso, ma un drill-down per-mese agganciato alle barre del grafico. Restano validi: solo uscite, soglia rumore 15€, top movers per Δ€ assoluto, righe cliccabili → drill-down categoria.
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
