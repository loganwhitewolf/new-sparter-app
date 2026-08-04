---
id: SEED-001
status: dormant
planted: 2026-08-04
planted_during: v3.0 (post-ship, quick task 260804-br9)
trigger_when: any milestone touching manual expense classification, the subcategory picker, or dashboard category/subcategory aggregation
scope: medium — touches taxonomy (done), a per-user mode setting, the manual-classify UI, and category/subcategory aggregation in the dashboard
---

# SEED-001: Modalità Semplice / Avanzata per la classificazione delle spese

## Why This Matters

Nato da un caso reale: una transazione "ottica principe" (occhiali da vista per lavorare al
computer) non aveva una sottocategoria ovvia sotto `salute`. Da lì la domanda "serve una
sottocategoria generica/altro per ogni categoria come rete di sicurezza?" — risposta di partenza:
no, in blocco diventerebbe il posto dove finisce tutto ciò che non si ha voglia di classificare, e
la sua massa crescerebbe monotonicamente azzerando il valore del drill-down per sottocategoria che
la dashboard fa (v3.0, Categories Year View).

Da lì è emersa un'idea più grande, che sposta il problema da "tassonomia" a "complessità percepita
dall'utente": due modalità d'uso sullo stesso motore di categorizzazione, non un secondo modello
dati.

## L'idea

**Il motore di categorizzazione resta invariato.** Categoria → sottocategoria → nature → direction
non cambia, né lo storage né le regole regex Tier 1/2/3 (`CONTEXT.md` root: regex → history → AI,
gate di subscription in `CLAUDE.md` root). Il motore continua **sempre** a scrivere la
sottocategoria più specifica che sa individuare, indipendentemente dalla modalità — questo è il
punto che rende l'idea sicura: non si butta mai via segnale già dedotto dall'algoritmo.

Due modalità:

- **Avanzata (oggi):** l'utente classifica manualmente scegliendo la sottocategoria specifica
  tramite il picker unico esistente (bottom sheet, riusato in 7 punti — vedi memoria
  `project_unified_subcategory_picker`). La dashboard mostra/drilla per sottocategoria come oggi.

- **Semplice (nuova):** quando l'utente classifica **manualmente**, il flusso scrive direttamente
  la sottocategoria `<categoria> generica` — l'utente non vede né sceglie tra le sottocategorie
  specifiche, vede solo la categoria. La dashboard aggrega tutte le sottocategorie (comprese le
  `generica`) a livello di categoria per la sola presentazione — nessun dato toccato, è
  un'aggregazione in lettura.

**Perché semplice → avanzato non perde nulla:** le spese auto-categorizzate si ritrovano già fini
(l'algoritmo non è mai stato bypassato); quelle classificate a mano in modalità semplice restano su
`<categoria> generica` finché l'utente non le raffina — nessun backfill automatico, è lavoro
opzionale e progressivo dell'utente.

**Perché avanzato → semplice è reversibile senza perdita:** la dashboard in modalità semplice è
pura aggregazione di lettura sopra dati che restano fini sotto — tornare indietro non richiede
migrazioni, solo cambiare il rendering.

### Cosa NON è "solo frontend" (punto centrale da chiarire quando si pianifica)

L'intuizione di partenza era "cambia solo il frontend". Non è vero fino in fondo — quattro
superfici toccate, peso diverso:

1. **Seed/tassonomia** — GIÀ FATTO (vedi Breadcrumbs). Bassa complessità, chiuso.
2. **Impostazione di modalità** — dove vive il flag "semplice/avanzato"? Presumibilmente per utente
   (colonna su `user`, o riga in una tabella settings dedicata se altre preferenze simili sono già
   previste). Da decidere: booleano semplice o enum per lasciare spazio a modalità intermedie
   future?
3. **Flusso di classificazione manuale** — il picker unico attuale deve, in modalità semplice, non
   offrire la scelta di sottocategoria e scrivere direttamente la `generica` della categoria
   scelta. Cambio di comportamento in un componente condiviso riusato in 7 punti: prop/variante sul
   componente, o biforcazione a monte nella action/service che riceve la scelta dell'utente?
4. **Aggregazione dashboard** — lista categorie, dettaglio categoria (v3.0 + quick task
   260804-br9), e probabilmente il breakdown per sottocategoria vanno tutte adattate a "sommare le
   sottocategorie a livello di categoria quando la modalità è semplice". Non un solo componente:
   almeno `category-ranking-list`, `category-detail-year-window` (DAL), e
   `category-subcategory-breakdown`.

Punti (2) e (4) sono via via più "backend" di quanto l'idea iniziale suggerisse, anche se il
modello dati e il motore di categorizzazione restano invariati.

## When to Surface

**Trigger:** qualunque milestone che tocchi la classificazione manuale delle spese, il picker
sottocategoria, o l'aggregazione categoria/sottocategoria nella dashboard.

Questa seed emergerà durante `/gsd-new-milestone` quando lo scope della nuova milestone combacia.

## Scope Estimate

**Medio.** La tassonomia (parte 1) è già fatta. Il resto è: uno schema change piccolo (flag
modalità per utente), una modifica UI in un componente condiviso critico (picker), e una modifica
di aggregazione che tocca almeno 3 punti della dashboard. Da stimare con precisione in fase di
discussione/pianificazione — le domande aperte sotto vanno chiuse prima di poter stimare i task.

## Breadcrumbs

- **Tassonomia già seedata** (commit `078e14a8` su branch `gsd/quick-category-detail-chart`,
  quick task `260804-br9`): una sottocategoria `<categoria> generica` per ognuna delle 23
  categorie di sistema attive, `natureId` allineato alla direzione reale della categoria
  (verificato su Postgres). Anche la sottocategoria `dispositivi medici` sotto `salute` è stata
  aggiunta nello stesso quick task (commit `7619c101`) — nata dallo stesso caso reale che ha
  originato questa seed.
- Motore di categorizzazione: `CONTEXT.md` (root) — Tier 1 regex, Tier 2 history, Tier 3 AI (solo
  piano `pro`). Gate di subscription in `CLAUDE.md` root, sezione "Subscription Feature Gates".
- Picker unico sottocategoria: memoria `project_unified_subcategory_picker`, Phase 39.
- Bulk categorizzazione massiva: quick task `260630-gy0` — da valutare se in modalità semplice
  debba offrire solo categorie o restare a livello sottocategoria (è un flusso "avanzato" per
  natura).
- Dettaglio categoria (chart + view YTD/Proiezione, appena riscritto): quick task `260804-br9`,
  stesso branch di questa seed. La logica di aggregazione per sottocategoria da estendere vive in
  `lib/dal/category-detail-year-window.ts` e `lib/dal/dashboard.ts`
  (`buildCategoryYearRankingData`).
- Bug corretto nello stesso quick task: la risoluzione della direzione categoria
  (`getCategoryDetailMeta` / `getCategoryDetail`) aveva una correlazione SQL rotta
  (`sc2.category_id = ${category.id}` risolta senza qualificazione dentro un template `sql` a
  tabella singola) che faceva risultare `type: null` → fallback `'out'` per ogni categoria.
  Fissato in `bdefb995`. Rilevante qui perché qualunque nuova query di aggregazione per la
  modalità semplice deve riusare la stessa risoluzione di direzione corretta, non reinventarla.
- Sottocategorie utente-private: `user_subcategory_override` e categorie/sottocategorie con
  `userId` non nullo — vedi domanda aperta sotto.

## Open Questions (da chiudere in discussione/grill prima di pianificare)

- **Scope della modalità semplice sull'auto-categorizzazione**: confermato che l'auto-categorizzazione
  scrive sempre la sottocategoria specifica indipendentemente dalla modalità (mai la `generica`)?
  Questa seed assume di sì — è la base di sicurezza di tutta l'idea.
- **Onboarding**: un utente nuovo parte in semplice o avanzato di default? La classificazione
  manuale in onboarding è proprio il caso d'uso che ha motivato l'idea.
- **Import massivo / bulk categorizzazione** (`260630-gy0`): in modalità semplice offre solo
  categorie, o resta a livello sottocategoria sempre?
- **Sottocategorie utente-private**: in modalità semplice sono ancora selezionabili da qualche
  parte, o strettamente nascoste come le sottocategorie di sistema?
- **Le `generica` sono visibili in modalità avanzata?** Un utente in avanzato che guarda il
  breakdown per sottocategoria vedrebbe righe `<categoria> generica` per le spese classificate
  quando era in modalità semplice — fatto naturale del design, o va nascosto/rietichettato (es.
  "non ancora specificato")?
- **Impatto sul pattern discovery**: il workflow `yarn regex:discover` → `/regex-label` intercetta
  pattern ricorrenti (es. "ottica principe" → `dispositivi medici`). Con la modalità semplice
  attiva, l'utente medio smette di vedere/correggere sottocategorie sbagliate a mano — riduce il
  segnale umano che oggi alimenta il pattern discovery?
- **Nome e posizione della UI toggle**: dove si attiva/disattiva (impostazioni utente? onboarding?
  entrambi)?

## Notes

Catturata durante il quick task `260804-br9` (rework grafico dettaglio categoria). Solo la
tassonomia (`<categoria> generica` × 23 + `dispositivi medici`) è stata effettivamente costruita
in quel quick task — tutto il resto qui sopra è materiale grezzo per `/gsd-grill-me` e la
milestone futura che ne nascerà. Non pianificata, non stimata in dettaglio.
