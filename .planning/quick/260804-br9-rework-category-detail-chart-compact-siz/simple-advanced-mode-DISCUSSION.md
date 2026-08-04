# Modalità Semplice / Avanzata — discussione da grillare

**Stato:** idea grezza, catturata durante il quick task 260804-br9. Non pianificata, non stimata.
Non farla qui — questo documento è l'input per un `/gsd-grill-me` (o equivalente) che dovrà
diventare la base di una milestone futura.

**Seed già fatto in questo quick task** (commit `078e14a8`): una sottocategoria
`<categoria> generica` per ognuna delle 23 categorie di sistema attive, `natureId` allineato alla
direzione reale della categoria (verificato su Postgres). Questo è l'unico pezzo di questa idea
già costruito — tutto il resto sotto è ancora da decidere e progettare.

## Il problema di partenza

Una transazione reale — "ottica principe", occhiali da vista per lavorare al computer — non aveva
una sottocategoria ovvia sotto `salute`. Da lì la domanda: vale la pena avere una sottocategoria
`altro`/generica per ogni categoria come rete di sicurezza?

Risposta di partenza: no, non in blocco — una `altro` per ognuna delle ~20 categorie diventerebbe
il posto dove finisce tutto ciò che non si ha voglia di classificare, e la sua massa cresce
monotonicamente, azzerando il valore del drill-down per sottocategoria che la dashboard fa (vedi
`260804-br9`, il rework appena fatto sul grafico/tabella di dettaglio categoria). Lo stato onesto
per "non ho ancora deciso" è già "da categorizzare" — trasformarlo in una sottocategoria generica
lo renderebbe "deciso" mentendo.

Da lì è emersa un'idea diversa e più grande, che sposta il problema da "tassonomia" a
"UX/complessità percepita dall'utente".

## L'idea: due modalità di utilizzo, stesso motore

**Non è un cambio di modello dati.** Il sistema di categorizzazione (categoria → sottocategoria →
nature → direction) resta esattamente com'è oggi, sia per le regole regex sia per lo storage. Il
motore Tier 1/2/3 (`README`/`CONTEXT.md`: regex → history → AI) continua a scrivere la
sottocategoria più specifica che sa individuare, **indipendentemente dalla modalità**. Questo è il
punto che rende l'idea sicura: non si butta mai via segnale che l'algoritmo ha già dedotto.

Le due modalità:

- **Avanzata (oggi):** l'utente classifica manualmente scegliendo la sottocategoria specifica
  (`farmaci`, `dispositivi medici`, ecc.) tramite il picker unico esistente (bottom sheet, riusato
  in 7 punti — vedi memoria `project_unified_subcategory_picker`). La dashboard mostra/drilla per
  sottocategoria come fa oggi.

- **Semplice (nuova):** quando l'utente classifica **manualmente**, il flusso scrive direttamente
  la sottocategoria `<categoria> generica` — l'utente non vede né sceglie tra le sottocategorie
  specifiche, vede solo la categoria. La dashboard, in questa modalità, aggrega tutte le
  sottocategorie (comprese le `generica`) a livello di categoria per la sola presentazione — nessun
  dato viene toccato, è un'aggregazione in lettura.

**Perché il passaggio semplice → avanzato non perde nulla:**
- le spese che l'algoritmo ha già auto-categorizzato in modo specifico si ritrovano già fini,
  perché l'algoritmo non è mai stato bypassato;
- le spese classificate a mano in modalità semplice restano su `<categoria> generica` finché
  l'utente non decide di raffinarle — nessun backfill automatico necessario, è un lavoro che
  l'utente fa "piano piano" se e quando vuole.

**Perché avanzato → semplice è reversibile senza perdita:** la dashboard in modalità semplice è
pura aggregazione di lettura sopra dati che restano fini sotto — tornare indietro non richiede
nessuna migrazione, solo cambiare il rendering.

## Cosa NON è "solo frontend" (punto centrale da chiarire nel grill)

L'intuizione di partenza era "cambia solo il frontend". Non è vero fino in fondo — ci sono almeno
quattro superfici toccate, di peso diverso:

1. **Seed/tassonomia** — fatto in questo quick task. Bassa complessità, già chiuso.
2. **Impostazione di modalità** — dove vive il flag "semplice/avanzato"? Presumibilmente per utente
   (colonna su `user`, o riga in una tabella settings dedicata se altre preferenze simili sono già
   previste altrove). Da decidere: è un flag booleano semplice o serve un enum per lasciare spazio
   a modalità intermedie future?
3. **Flusso di classificazione manuale** — il picker unico attuale deve, in modalità semplice, non
   offrire la scelta di sottocategoria e scrivere direttamente la `generica` della categoria scelta.
   Questo è un cambio di comportamento in un componente condiviso e riusato in 7 punti: va capito se
   si introduce una prop/variante o se si biforca il flusso a monte (nella action/service che
   riceve la scelta dell'utente).
4. **Aggregazione dashboard** — la lista categorie, il dettaglio categoria (appena riscritto in
   260804-br9), e probabilmente le sottocategorie/breakdown vanno tutte adattate a "sommare le
   sottocategorie a livello di categoria quando la modalità è semplice". Non è un solo componente:
   tocca almeno `category-ranking-list`, `category-detail-year-window` (DAL), e
   `category-subcategory-breakdown`.

Punto (2) e (4) sono via via più "backend" di quanto l'idea iniziale suggerisse, anche se il
modello dati e il motore di categorizzazione restano invariati.

## Domande aperte per il grill

- **Scope della modalità semplice sull'auto-categorizzazione**: è confermato che l'auto-categorizzazione
  scrive sempre la sottocategoria specifica indipendentemente dalla modalità (mai la `generica`)?
  Questo documento assume di sì — è la base di sicurezza di tutta l'idea.
- **Onboarding**: un utente nuovo parte in semplice o avanzato di default? La classificazione
  manuale in fase di onboarding (spesso il primo contatto con l'app) è proprio il caso d'uso che
  ha motivato l'idea.
- **Import massivo / bulk categorizzazione**: la bulk categorizzazione massiva esistente
  (`260630-gy0`) in modalità semplice deve offrire solo categorie, o restare a livello sottocategoria
  sempre (perché è un flusso "avanzato" per natura)?
- **Sottocategorie utente-private**: l'utente può creare le proprie sottocategorie (vedi
  `user_subcategory_override` e categorie/sottocategorie con `userId` non nullo). In modalità
  semplice, queste sono ancora selezionabili da qualche parte, o strettamente nascoste come le
  sottocategorie di sistema?
- **Le `generica` sono visibili in avanzato?** Un utente in modalità avanzata che guarda il
  breakdown per sottocategoria vedrebbe comunque righe `<categoria> generica` per le spese
  classificate quando era in modalità semplice — è un fatto naturale del design o va nascosto/
  rietichettato in qualche modo (es. "non ancora specificato")?
- **Impatto sul motore regex/pattern discovery**: il workflow `yarn regex:discover` → `/regex-label`
  esiste per intercettare pattern ricorrenti (es. "ottica principe" → `dispositivi medici`). Con la
  modalità semplice attiva, l'utente medio smetterà di vedere/correggere sottocategorie sbagliate
  a mano — riduce il segnale umano che oggi alimenta il pattern discovery?
- **Nome e posizione della UI toggle**: dove si attiva/disattiva la modalità (impostazioni utente?
  onboarding? entrambi)?

## Contesto tecnico di riferimento (per chi pianifica dopo)

- Motore di categorizzazione: `CONTEXT.md` (root) — Tier 1 regex, Tier 2 history, Tier 3 AI (solo
  piano `pro`). Gate di subscription in `CLAUDE.md` root, sezione "Subscription Feature Gates".
- Picker unico sottocategoria: `project_unified_subcategory_picker` (memoria), Phase 39.
- Bulk categorizzazione: quick task `260630-gy0`.
- Dettaglio categoria appena riscritto (chart + view YTD/Proiezione): quick task `260804-br9`,
  stesso branch di questo documento — la logica di aggregazione per sottocategoria da estendere
  vive in `lib/dal/category-detail-year-window.ts` e `lib/dal/dashboard.ts`
  (`buildCategoryYearRankingData`).
- Bug corretto nello stesso quick task: la risoluzione della direzione categoria
  (`getCategoryDetailMeta` / `getCategoryDetail`) aveva una correlazione SQL rotta che faceva
  risultare `type: null` → fallback `'out'` per ogni categoria. Fissato in `bdefb995`. Rilevante
  qui perché qualunque nuova query di aggregazione per la modalità semplice deve riusare la stessa
  risoluzione di direzione corretta, non reinventarla.
