---
id: SEED-005
status: dormant
planted: 2026-08-06
planted_during: post-v3.0 (grill-with-docs su idea interna)
trigger_when: any milestone touching the manual entry path (insertManualTransactionTx / TransactionFormDialog), the Expense aggregation-by-descriptionHash contract, SEED-001 simple/advanced mode, or adding any external write channel (bot, public API, mobile client)
scope: medium-large — refactor of a shipped write path (with the amortization composition hanging off it), 2 new tables, 1 new column with backfill, 1 public webhook route, 1 settings screen; no new domain entities beyond provenance
---

# SEED-005: Bot Telegram — cattura rapida delle spese fuori estratto

## Why This Matters

Due buchi, uno di dominio e uno di prodotto.

**Il buco di dominio.** `contante` è una sottocategoria di direzione `transfer` (prelievi e
versamenti): neutra al patrimonio, esclusa dai totali, nascosta dalla dashboard. Corretto — il
prelievo *è* un giroconto tra la banca e il portafoglio. La conseguenza però è che **le spese in
contanti non esistono da nessuna parte nel modello**: il prelievo è rumore, e ciò che compri con
quei soldi non è mai stato osservato da nessun estratto. Il caffè, il mercato, la mancia, il
parcheggio a monete: un intero segmento di consumo reale invisibile alla dashboard che l'app esiste
per produrre.

**Il buco di prodotto.** L'alternativa per chiudere il primo buco è un'app mobile ottimizzata per la
cattura in piedi, alla cassa. Un bot Telegram la evita: la chat *è già* la superficie mobile
ottimizzata che non devi progettare, distribuire, aggiornare su due store.

Il bot fa **una** cosa e la fa in 5 secondi: registrare una spesa che nessun import porterà mai.
Non fa dashboard, non fa import, non fa gestione. Vedi D2.

## Decisioni bloccate

Diciassette, tutte prese e motivate durante il grill del 2026-08-06. Non riaprirle in fase di
discussione senza una ragione nuova: ognuna ha già un contro-argomento considerato e scartato.

### Perimetro

1. **Solo movimenti fuori estratto.** Il bot registra spese che **non compariranno mai** in un file
   bancario: contante, mancia, il pagato-a-mano. Non è una restrizione arbitraria: l'alternativa
   (cattura immediata di qualunque spesa, carta inclusa) obbliga a costruire un sottosistema di
   riconciliazione manuale↔import (match per importo+data±giorni, conferma, merge o scarto),
   perché **oggi non esiste alcun meccanismo che impedisca il doppio conteggio** — l'hash è lo
   stesso algoritmo, ma la descrizione digitata da un umano e quella della banca non coincidono mai.
   Scartata: introdurrebbe una **seconda sorgente di verità concorrente sullo stesso movimento**,
   esattamente il problema che il modello a hash+dedup esiste per evitare. Il perimetro scelto è
   invece un insieme **disgiunto** da quello degli import.
2. **Solo scrittura, con conferma parlante.** Il bot non ha viste, riepiloghi, `/mese`, `/ultime`.
   Motivo: 26 categorie × ~120 sottocategorie in inline keyboard sono **peggio** del
   `SubcategoryPicker` che esiste già, e la dashboard v3.0 (asse anno, drill-down, ritmo e
   proiezione) in chat diventa ASCII. L'unica lettura ammessa è quella **al servizio della
   scrittura**: il messaggio di conferma che dice cosa è stato capito. I riepiloghi sono la trappola
   — la parte facile da scrivere e quella che ti incastra a mantenere due front-end per sempre.
   Corollario onesto: se il vero problema fosse "la web app non si usa da telefono", la risposta
   giusta sarebbe una PWA responsive, **non** un bot.
3. **Solo uscite.** Nessun segno nella grammatica: ogni numero è un'uscita. Un `+50` non viene
   interpretato — il bot chiede.
   Motivo: un'entrata in contanti **mal classificata è più dannosa di una spesa non registrata**.
   `+50 rimborso cena` classificato come `income_extraordinary` invece di nettare sotto la
   sottocategoria della cena gonfia **entrate e uscite dello stesso mese**: due errori invece di
   uno. La distinzione "denaro nuovo dall'esterno vs annullamento di una spesa specifica" è
   dichiarata da `CONTEXT.md` come decidibile **solo dall'utente**, e sei bottoni in chat non sono
   lo spazio per farla. Il caso "rimborso da persona" è inoltre già territorio di *Standalone
   Expense* + rimborsi 1:N (v2.8, ADR 0018): un bot che ci mette le mani senza quel contesto
   produce dati da ripulire a mano.
4. **Ammortamento: mai.** Non "non in v1" — **mai**. Il bot è cattura rapida; l'ammortamento è una
   decisione di competenza (ADR 0019) che vive nell'app, sulla transazione già creata. Un caffè non
   si spalma su 12 mesi.
5. **Warikan: non in v1.** Il bot è la superficie *naturale* per "pizza 25 diviso 2", ed è
   precisamente per questo che il confine va scritto: [[SEED-002]] è un dominio non ancora
   modellato (6 tabelle, saldi interpersonali, propagazione cross-user) e infilarlo dentro il parser
   di un bot sarebbe la scorciatoia da smontare dopo. Rinvio, non esclusione: da riaprire quando
   SEED-002 verrà pianificato.

### Identità

6. **Linking per utente, non allowlist in env.** Nuova tabella `telegram_account`
   (`userId`, `telegramUserId` unique, `linkedAt`, `revokedAt`), token monouso con TTL generato da
   `/settings`, deep link `t.me/<bot>?start=<token>`. Il webhook risolve `telegramUserId → userId`;
   nessuna corrispondenza → risposta "non collegato" e **zero scritture**.
   Scartata l'allowlist di chat id in env (`TELEGRAM_ALLOWED_CHAT_IDS`) per tre ragioni: non scala
   a migliaia di utenti; `telegramUserId` unique a DB è l'unica sede in cui esprimere l'invariante
   "una chat ↔ un account"; e il **deep link con token** è l'unica prova che il proprietario della
   chat sia anche il titolare della sessione web — un chat id incollato in una env non prova nulla.
   La revoca serve dal day-one, non dopo: telefono perso = scritture sul conto da parte di chi lo
   tiene in mano.
7. **Il bot non chiama mai `verifySession()`.** Non è una preferenza: `lib/dal/auth.ts` legge
   `headers()` e fa `redirect('/login')` — dentro una route webhook lancerebbe `NEXT_REDIRECT`,
   Telegram riceverebbe un errore e **riproverebbe in loop**. Ogni funzione DAL che serve al bot
   deve avere un ingresso con `userId` esplicito. E il bypass staging (`x-staging-key` →
   `stagingUserId()`) **non** va riusato come scorciatoia: legherebbe le scritture a un userId fisso
   da env, cioè l'allowlist già scartata in D6.

### Grammatica e interazione

8. **Grammatica deterministica, non LLM.** Una regola: *primo numero = importo, il resto =
   descrizione*. `12,50 caffè` e `caffè 12,50` sono equivalenti. Prefissi temporali riconosciuti
   letteralmente: **`oggi`** e **`ieri`**. Data implicita = adesso nel timezone dell'utente
   (`user.timezone`). Riuso diretto di `parseItalianAmount` (virgola decimale, `€`, formato
   italiano) e `normalizeDescription`.
   Scartato il parsing LLM: comprerebbe pochissimo. Il suggerimento di sottocategoria **non** viene
   dal parsing ma dall'aggregazione per hash (D12) e da `applyTier1Regex`; l'unico delta reale
   sarebbe la data in linguaggio naturale arbitrario e la divisione tra amici — che è [[SEED-002]].
   Prezzo evitato: latenza su ogni messaggio, costo per messaggio, non determinismo (lo stesso testo
   con due importi in due giorni), una dipendenza esterna nel write path, i movimenti finanziari che
   transitano da un terzo, e un feature gate `pro` da progettare. Nessun SDK AI è oggi nello stack.
9. **Il testo nudo possiede la chat.** `12 caffè` avvia una registrazione; i comandi restano solo
   per il controllo (`/start` linking, `/aiuto`). Un comando esplicito su ogni cattura sarebbe
   cerimonia senza informazione in una chat privata monoscopo.
   Due paletti non negoziabili: **solo chat private** (`chat.type === 'private'` — in un gruppo ogni
   messaggio diventerebbe un tentativo di scrittura sul conto di chi ha aggiunto il bot) e
   **nessuna scrittura silenziosa** (parse fallito → il bot lo dice, non indovina e non tace).
10. **Conferma prima di scrivere, sempre.** Il bot mostra cosa ha capito (importo, descrizione, data,
    sottocategoria suggerita) e scrive **solo** dopo il tap. Nessun percorso scrive al primo
    messaggio.
11. **Lo stato intermedio vive in tabella, non nel `callback_data`.** Tabella `telegram_draft`
    (`id` uuid, `userId`, `amount`, `description`, `occurredAt`, `suggestedSubCategoryId`, `status`,
    `expiresAt`); il `callback_data` porta **solo** l'uuid.
    Motivo tecnico: il `callback_data` di un `InlineKeyboardButton` è limitato a **64 byte** —
    `-12.50|2026-08-06|spesa al mercato di via roma|41` lo sfonda con una descrizione normale; e
    ri-parsare il testo del messaggio di conferma scritto dal bot stesso renderebbe **il formato di
    una stringa di UI un contratto dati**. Motivo di dominio: la tabella dà idempotenza (D14),
    scadenza, e il **tracciato di cosa il parser aveva capito vs cosa è stato confermato** — l'unico
    dataset con cui migliorare la grammatica invece di indovinare.
    Postille: **TTL 1 ora**; `occurredAt` **congelato al momento del parse** (il momento della
    spesa, non del tap); scadenza pigra (`expiresAt` verificato alla conferma + cancellazione
    opportunistica delle bozze vecchie dello stesso utente quando ne nasce una nuova → **nessuno
    scheduler**); **bozze multiple concorrenti ammesse** (mandi `12 caffè` e `8 pane` di fila,
    ognuna ha i suoi bottoni — in chat è il comportamento naturale).
12. **Sei scorciatoie di sottocategoria, solo quando manca il suggerimento.**
    `getMostUsedSubcategories(['out'])` ritorna **max 6** righe già filtrate per direzione uscita:
    sei bottoni, una schermata, **zero paginazione**, più `Lascia da categorizzare`.
    Motivo: dalla seconda volta il suggerimento è certo (D13), ma la **prima** volta di ogni
    descrizione nuova nascerebbe non categorizzata — e ripararla richiede di aprire l'app, cioè il
    gesto che il bot esiste per evitare. La prima volta è anche quella in cui **insegni** al
    sistema: è il tap che ripaga più di tutti, perché dalla seconda è gratis per sempre. Scartato un
    bottone `Cambia` sempre visibile: il suggerimento da Expense esistente è quello che l'utente
    stesso ha scelto l'ultima volta, correggerlo è l'eccezione e l'app è il posto delle eccezioni.
    Non è l'albero in chat scartato in D2: è un insieme chiuso e piccolo, e il contante vive in
    3-4 sottocategorie (bar, spesa, parcheggi, regali).
13. **Annulla dopo la scrittura: finestra breve di 10 minuti.** Il bottone resta sul messaggio di
    conferma e cancella la transazione appena creata, poi scade.
    Motivo: l'errore di battitura sull'importo (`12` invece di `1,20`) è **l'errore più probabile di
    tutta la feature** — telefono, in piedi, di fretta — e senza questo bottone l'unica riparazione
    è aprire l'app. È l'unica cancellazione che si paga da sola. La finestra deve restare **breve**:
    un bottone permanente trasformerebbe la chat in una superficie di gestione, cioè la deriva
    "bot = app mobile" scartata in D2.
    Vincolo di implementazione: cancellare con `deleteTransactionsAndReconcileExpenses`, **non** con
    un DELETE diretto — altrimenti l'aggregato dell'Expense (`totalAmount`, `transactionCount`)
    resta sporco.

### Modello dei dati

14. **Get-or-create dell'Expense per `descriptionHash`, come l'import.** Il primo `caffè` crea
    l'Expense "caffè"; dal secondo in poi la transazione entra in quella esistente e ne accumula
    `totalAmount` / `transactionCount` / `lastTransactionAt` — esattamente `lib/services/import.ts:680-728`.
    È la decisione **più importante del seed**, per tre ragioni:
    - **Ripara un bug reale** (vedi *Il difetto da riparare* sotto) come *conseguenza*, non come
      pezza: non si aggiunge un `onConflict`, si allinea il path manuale a quello canonico.
    - **Rende vero il suggerimento.** I pattern di sistema sono nomi di esercente presi dagli
      estratti (`amazon`, `farmacia`, `uber`, `deliveroo`, `condominio`) e la regola di consistenza
      in testa a `seed-patterns-data.ts` vieta alle parole italiane comuni di stare da sole: quindi
      `caffè`, `pane`, `parcheggio`, `mancia` — il vocabolario del contante — **non matcheranno
      quasi mai** il Tier 1. Il suggerimento migliore non è la regex, è *"come le volte precedenti"*.
      Il canale manuale è il caso in cui l'aggregazione per hash funziona **meglio** che sull'import:
      l'utente scrive `caffè` allo stesso modo ogni giorno, la banca scrive `PAG.POS CAFFETTERIA X
      VIA…` sempre diverso.
    - **È il modello già dichiarato.** `CONTEXT.md` definisce l'Expense come aggregato per
      `descriptionHash`: l'inserimento manuale odierno è l'anomalia, non l'import.
    Scartate: Expense standalone per voce (hash sintetico stile `detachTransactionToDedicatedExpense`
    → 30 caffè = 30 Expense in lista, nessun apprendimento, solo rumore) e un contenitore unico
    "Contante" (distrugge il drill-down per sottocategoria, cioè il valore centrale della v3.0).
    Il lock manuale non viene sfiorato: il bot **legge** la sottocategoria dell'Expense e non la
    sovrascrive mai — non riclassifica, propone ciò che l'Expense già dice.
15. **Cascata del suggerimento:** Expense esistente con quell'hash → `applyTier1Regex` →
    Tier 2 storico → non categorizzata.
16. **Colonna esplicita `transaction.source`** (`'import' | 'manual' | 'telegram'`), backfill delle
    righe con `fileId IS NULL` → `'manual'`.
    Motivo operativo, non estetico: il giorno in cui un utente dice *"questi 40 € non li ho mai
    spesi"*, la prima domanda è **da dove è entrato questo numero** — un file bancario (allora è la
    banca o il parser), il dialog web (l'ha digitato al computer), una chat (l'ha digitato dal
    telefono, o qualcuno con il suo telefono). Oggi la provenienza è implicita in `fileId IS NULL`,
    che con il bot diventa ambigua: la stessa assenza di foreign key per due cause diverse. Su
    un'app dove la fiducia nei numeri *è* il prodotto, la tracciabilità della sorgente vale una
    colonna. Secondo motivo: senza la colonna, l'insieme "scritto dal bot" non è più interrogabile a
    posteriori — l'informazione non è persa, non è mai stata scritta, e il backfill retroattivo è
    impossibile.
17. **Vocabolario: due voci separate, non una.** *Transazione manuale* = termine canonico di
    **provenienza** (superordinato: dialog web + bot), decidibile al 100% (`source ≠ 'import'`).
    *Fuori estratto* = **convenzione d'uso documentata** con postilla del limite noto, perché è una
    **promessa dell'utente e non un'invariante**: niente impedisce di scrivere al bot una spesa
    fatta con la carta e importarla il giorno dopo.
    Motivo: un glossario deve essere fatto di termini **decidibili** (mettere "fuori estratto" come
    entità significherebbe mettere in `CONTEXT.md` un'affermazione che il sistema non può
    verificare), ma il vincolo che regge l'intera feature — *nessuna riconciliazione perché gli
    insiemi sono disgiunti per convenzione* — deve restare scritto, non diventare folklore orale.
    Il termine sta sull'asse **Transaction**, non Expense: `CONTEXT.md` già scoraggia "spesa
    manuale" come `_Avoid_` di *Standalone Expense*, e riusarlo riaprirebbe un'ambiguità chiusa.
    Testo pronto in *Allegato B*.

### Architettura e distribuzione

18. **Write path condiviso, non duplicato.** Estrarre il cuore — *get-or-create Expense per hash →
    accumula → inserisci Transaction* — in un servizio con `userId` esplicito
    (`lib/services/manual-entry.ts`), consumato **sia** dalla Server Action web **sia** dal bot.
    Motivo: con due write path la stessa azione ("registro 12 € di caffè") produrrebbe **due
    semantiche diverse a seconda di dove è stata digitata** — divergenza sullo stesso concetto di
    dominio, la classe di bug più costosa perché non si manifesta come errore ma come **numeri
    diversi in dashboard**.
    Prezzo esplicito: si passa sopra la composizione con l'ammortamento (`activatePlanTx` dentro
    `db.transaction`, `lib/actions/transactions.ts:73-90`) e i suoi test. È un refactor con la rete
    dei test verdi prima e dopo, **non** un ritocco: va isolato come primo task, non annegato dentro
    "costruisci il bot".
19. **Idempotenza dalla transizione di stato della bozza, niente tabella di dedup.**
    `pending → confirmed` dentro `db.transaction` con `WHERE status = 'pending'`: il secondo
    tentativo aggiorna zero righe e non scrive nulla.
    Motivo: Telegram **rispedisce** un update se la risposta non arriva o non è 2xx, e i due scenari
    hanno danno molto diverso — retry di un `message` → seconda bozza → due messaggi di conferma
    (fastidio, le bozze non sono spese); retry di un `callback_query` → **tentativo di scrivere due
    volte la stessa spesa**. La transizione di stato protegge **il denaro**, e lo fa come invariante
    di database. Il dedup su `update_id` (che i doc indicano come meccanismo previsto) protegge solo
    l'estetica della chat, al prezzo di una tabella che cresce col traffico e va potata: è
    l'escalation **se** si osservano retry reali nei log, non un requisito d'ingresso.
    Effetto collaterale utile: se `sendMessage` fallisce **dopo** una scrittura riuscita, il ri-tap
    dell'utente trova la bozza già `confirmed`, non riscrive, e può ri-mandare la conferma.
20. **Nessuna libreria Telegram.** `fetch` diretto su `api.telegram.org` per 4 metodi
    (`sendMessage`, `editMessageText`, `answerCallbackQuery`, `setWebhook`). `grammY`/`telegraf`
    porterebbero polling, middleware e sessioni mai usati per sostituire ~50 righe.
    Il trucco documentato del `method` nel body della risposta al webhook **non basta**: gestire un
    tap richiede due chiamate (`answerCallbackQuery` obbligatoria + `editMessageText`) e i doc
    avvertono che *"il successo o il risultato di queste richieste non può essere verificato"*.
21. **Gate aperto ma configurabile.** `TELEGRAM_MIN_PLAN=free` di default, alzabile per env come
    `CATEGORIZATION_*_MIN_PLAN`. In alpha serve **uso**, non ricavo: il bot è la feature che genera i
    dati con cui scoprire se la grammatica funziona e quali sottocategorie servono al contante —
    chiuderlo dietro un piano ridurrebbe proprio quel campione. La decisione di prezzo resta
    reversibile **senza deploy di codice**.
22. **Protezione all'ingresso: minima e sufficiente.** Verifica dell'header
    `X-Telegram-Bot-Api-Secret-Token` → `SELECT` indicizzato su `telegram_account` → se non
    collegato, risposta neutra con link alle impostazioni e **zero scritture**. Più un **tetto di
    bozze `pending` per utente** (~20).
    Motivo: il bot è trovabile da chiunque (gli username dei bot sono pubblici), ma un utente **non
    collegato non può scrivere nulla** — al massimo costa un SELECT indicizzato per messaggio, che
    non è un vettore di carico credibile. L'unico attore che crea righe è una chat **già
    collegata**: contro quello un rate limit non protegge (spenderebbe le sue quote), mentre un
    tetto sulla risorsa sì. Scartato il token bucket persistito: stato e complessità per un rischio
    che il modello di identità ha già chiuso.

## Il difetto da riparare (blocca la feature, non è opzionale)

`insertManualTransactionTx` (`lib/dal/transactions.ts:738`) **inserisce sempre una nuova Expense**,
con `descriptionHash = computeDescriptionHash(description)`. Ma `lib/db/schema.ts:420` impone
`unique("expense_userId_descriptionHash_unique")`.

Conseguenza: il **secondo** inserimento manuale con la stessa descrizione va in violazione PG 23505,
il `catch` generico la ingoia e l'utente vede *"Si è verificato un errore. Riprova tra qualche
secondo."* — un messaggio che suggerisce un problema transitorio per un errore permanente.

Il contante è ripetitivo per natura (`caffè`, `pane`, `mercato`): **il bot sbatterebbe su questo bug
al secondo messaggio**. D14 lo risolve allineando il path manuale al get-or-create dell'import.

Nota: il bug esiste **già oggi** nel dialog web. Non è stato introdotto dal bot — il bot lo rende
impossibile da ignorare.

## Schema proposto

```
telegram_account
  userId          text FK user (cascade)
  telegramUserId  bigint UNIQUE          -- una chat ↔ un account (D6)
  linkedAt        timestamptz
  revokedAt       timestamptz nullable   -- revoca dalle impostazioni

telegram_draft
  id                     uuid PK         -- va nel callback_data (36 byte < 64) (D11)
  userId                 text FK user (cascade)
  amount                 numeric(12,2)   -- già negativo (D3)
  description            text
  occurredAt             timestamptz     -- congelato al parse (D11)
  suggestedSubCategoryId integer FK sub_category nullable
  status                 enum pending|confirmed|cancelled
  createdAt / expiresAt  timestamptz     -- TTL 1h, scadenza pigra
  writtenTransactionId   text FK transaction nullable  -- per l'annulla a 10 min (D13)

transaction
  + source  enum import|manual|telegram   -- backfill fileId IS NULL → 'manual' (D16)
```

## Vincoli di piattaforma (verificati sui doc ufficiali)

- `setWebhook` accetta **`secret_token`**, rispedito in ogni richiesta come header
  `X-Telegram-Bot-Api-Secret-Token`: **è la sola autenticazione del webhook**, e prova solo che il
  chiamante è Telegram — non che l'utente sia autorizzato (da cui D6).
- `allowed_updates` permette di ricevere **solo** `message` e `callback_query`.
- Dopo ogni `CallbackQuery` **è obbligatorio** chiamare `answerCallbackQuery`, altrimenti il client
  resta con l'indicatore di caricamento attivo.
- `callback_data` di `InlineKeyboardButton`: **1-64 byte**.
- `update_id` incrementa sequenzialmente ed è il meccanismo previsto per ignorare i duplicati
  (rilevante solo se D19 va in escalation).
- Webhook: **solo HTTPS**, porte 443/80/88/8443; `max_connections` 1-100.
- Limiti in uscita: ~30 messaggi/secondo globali per bot, ~1/secondo per chat. Con traffico 1:1
  iniziato dall'utente non è un vincolo, ma è il tetto oltre cui i `sendMessage` iniziano a fallire.
- `getWebhookInfo` per la diagnostica.

## Open Questions (da chiudere in discuss/plan)

1. **TTL del token di linking** e sua unicità d'uso (proposta: monouso, 15 minuti).
2. **Dove vive lo screen di collegamento** (`/settings/...`), copy italiano, e cosa mostra quando
   l'account è già collegato (revoca + data).
3. **Cosa succede se lo stesso `telegramUserId` prova a collegare un secondo account Sparter** —
   errore, o sostituzione con revoca del primo?
4. **Formato esatto del messaggio di conferma** (copy italiano, formattazione importo/data).
5. **`user.timezone` nullable** → fallback da decidere (`Europe/Rome`?). La data della spesa dipende
   da questo.
6. **Valuta**: la grammatica assume EUR (default della colonna). Contante non-EUR non affrontato.
7. **Registrazione del webhook**: passo operatore manuale o script (`yarn telegram:set-webhook`),
   e come si gestisce per ambiente (dev/staging/prod hanno URL diversi).
8. **Comportamento se il piano dell'utente scende sotto il gate** dopo il collegamento.
9. **Osservabilità**: log `pino` dei parse falliti — è il dataset con cui migliorare la grammatica
   (vedi D11), va deciso cosa si logga senza registrare importi/descrizioni in chiaro.
10. **Strategia di test del webhook**: nessuna sessione, quindi serve un harness che parli HTTP alla
    route con secret token e update sintetici. Vale anche come e2e?
11. **Il tetto di 20 bozze pending**: cosa risponde il bot quando è raggiunto.

## Limiti noti (non blocchi)

- **Le entrate in contanti restano invisibili** (D3). Non è una regressione: oggi lo sono anche le
  uscite, quindi il bot è comunque un guadagno netto.
- **Il doppio conteggio non è impedito** (D1/D17): se l'utente registra al bot una spesa con carta e
  poi importa l'estratto, il movimento è contato due volte e la correzione è manuale. È una
  convenzione, non un'invariante — e va scritta come postilla in `CONTEXT.md`.
- **La chat Telegram è una credenziale bearer permanente**: nessun cookie, nessuna scadenza, nessuna
  MFA. Chi ha il telefono sbloccato può scrivere spese. L'unica leva è la revoca (D6). Il danno
  massimo è comunque limitato: solo uscite, cancellabili.
- **Il Tier 2 storico scatterà raramente** per le voci del bot: richiede ≥3 classificazioni manuali
  sullo stesso hash, mentre con l'aggregazione di D14 l'Expense è **una** e già categorizzata —
  quindi il Tier 2 non serve, il livello 1 della cascata (D15) lo precede sempre. Resta come rete
  innocua.
- **Nessun OCR / foto dello scontrino.** Fuori perimetro.

## Scope Estimate

Medio-grande, con un ordine obbligato:

1. **Refactor del write path manuale** (D18 + fix 23505 di D14) — isolato, test verdi prima e dopo,
   include la composizione con l'ammortamento. *Questo è il rischio vero della feature, non il bot.*
2. Migration: `transaction.source` + backfill (D16), `telegram_account`, `telegram_draft`.
3. Varianti `userId`-esplicite delle DAL che servono (`getMostUsedSubcategories`).
4. Servizio bot puro (parser, cascata suggerimenti, bozze) — unit-testabile senza HTTP.
5. Route webhook sottile + client `fetch` a 4 metodi.
6. Screen di collegamento + revoca in `/settings`.
7. `CONTEXT.md` (Allegato B) + ADR 0021 (Allegato A).

## Allegato A — testo pronto per ADR 0021

> Da creare al momento del build come `docs/adr/0021-manual-entry-aggregates-like-import.md`.
> Numero verificato libero il 2026-08-06 (ultimo esistente: 0020).

**Titolo:** Il path manuale aggrega per `descriptionHash` come l'import

**Contesto.** `insertManualTransactionTx` inserisce sempre una nuova Expense, mentre l'import fa
get-or-create per `descriptionHash` e accumula. Con `expense_userId_descriptionHash_unique` a DB, il
secondo inserimento manuale della stessa descrizione fallisce con PG 23505 sotto un messaggio
d'errore generico. L'apertura di un canale di cattura esterno (bot Telegram, [[SEED-005]]) rende il
caso ripetitivo la norma anziché l'eccezione.

**Decisione.** Il cuore della scrittura manuale — get-or-create Expense per hash, accumulo degli
aggregati, insert della Transaction — vive in un servizio con `userId` esplicito, condiviso tra la
Server Action web e ogni canale esterno. La semantica di aggregazione diventa **una** per tutti i
canali. `transaction.source` (`import|manual|telegram`) registra la provenienza. Nessuna
riconciliazione tra scritture manuali e import: gli insiemi sono disgiunti **per convenzione
d'uso**, non per invariante.

**Alternative scartate.** (a) `onConflict` sul solo path manuale: cura il sintomo e lascia due
semantiche di aggregazione. (b) Expense standalone per ogni voce manuale (hash sintetico): elimina
il conflitto ma produce N Expense per la stessa descrizione, azzera l'apprendimento e riempie di
rumore la lista spese. (c) Write path dedicato al canale esterno: la stessa azione dell'utente
produrrebbe numeri diversi in dashboard a seconda di dove è stata digitata.

**Conseguenze.** Il refactor passa sopra la composizione con l'ammortamento
(`activatePlanTx` in `db.transaction`) e va eseguito con i test come rete. I dati aggregati non si
riseparano facilmente: la decisione è di fatto irreversibile sui dati già scritti. `source` è
un'informazione che, se non scritta ora, non è backfillabile in seguito.

## Allegato B — voci `CONTEXT.md` da applicare al build

> Da inserire nella sezione *Transazioni e movimenti*, dopo *Standalone Expense*.

**Transazione manuale** (Manual Transaction):
Una Transaction creata digitandola, non importandola da un file: `source` diverso da `import`
(`manual` dal dialog web, `telegram` dal bot di cattura rapida). Come ogni Transaction entra
nell'Expense che condivide il suo `descriptionHash`, creandola se non esiste — quindi dieci `caffè`
digitati in dieci giorni sono **una** Expense con dieci transazioni, non dieci Expense.
_Avoid_: spesa manuale (già `_Avoid_` di Standalone Expense), transazione a mano, voce

**Fuori estratto** (convenzione d'uso, non entità):
Un movimento che **nessun import porterà mai**: contante, mancia, il pagato-a-mano. È l'unico
perimetro per cui la registrazione manuale è sicura, perché non esiste un secondo osservatore dello
stesso movimento. Le Transazioni manuali sono destinate a questo insieme.
> ⚠️ **Limite noto:** è una **convenzione dell'utente, non un'invariante del sistema**. Nulla
> impedisce di registrare a mano una spesa con carta che arriverà anche via import: in quel caso il
> movimento è contato **due volte** e la correzione è manuale. Non esiste riconciliazione tra
> scritture manuali e import — gli insiemi sono disgiunti per convenzione. Vedi ADR 0021.

## Breadcrumbs

- `lib/dal/transactions.ts:738-790` — `insertManualTransactionTx` / `insertManualTransaction`: il
  path da rifattorizzare (già `userId`-esplicito, quindi pronto per il bot)
- `lib/db/schema.ts:420` — `expense_userId_descriptionHash_unique`: il vincolo che oggi rompe il
  secondo inserimento manuale
- `lib/db/schema.ts:387-453` — tabelle `expense` e `transaction`
- `lib/services/import.ts:680-728` — get-or-create + accumulo + rispetto di `isManuallyLocked`: il
  comportamento canonico da riusare
- `lib/utils/import.ts:166-180` — `computeTransactionHash` (`userId | occurredAt ISO | amount |
  normalizeDescription`); `:75-77` — `computeDescriptionHash`
- `lib/dal/auth.ts` — `verifySession()` con `headers()` + `redirect('/login')`: inutilizzabile da un
  webhook; contiene anche il bypass staging da **non** riusare
- `lib/dal/subcategory-usage.ts:18` — `getMostUsedSubcategories(allowedDirections?)`, max 6, filtro
  per direzione via nature→direction
- `lib/services/categorization.ts:86` — `categorizePipeline` (Tier 1 + Tier 2, gate per piano)
- `scripts/seed-patterns-data.ts:20-25` — la regola di consistenza che spiega perché `caffè` non
  matcherà mai il Tier 1
- `lib/actions/transactions.ts:48-107` — `createTransaction`; `:73-90` la composizione con
  `activatePlanTx`
- `components/transactions/transaction-form-dialog.tsx` — il dialog web, secondo consumatore del
  write path condiviso
- `lib/services/transaction-deletion.ts:20` — `deleteTransactionsAndReconcileExpenses`, obbligatorio
  per l'annulla di D13
- `lib/config/categorization.ts` + `.env.example` (sezione *Categorization gates*) — la forma da
  imitare per `TELEGRAM_MIN_PLAN`
- `CONTEXT.md:128,171` — `contante` come sottocategoria `transfer`: il buco che questa feature chiude
- `tests/amortization-manual-entry.test.ts` — la rete di test del refactor di D18
- Confini: [[SEED-001]] (la tastiera a 6 scorciatoie è un assaggio di modalità semplice — quando
  SEED-001 verrà pianificato, questa feature va rivista), [[SEED-002]] (warikan, rinviato in D5)

## Notes

Grill del 2026-08-06 (`/grill-with-docs` + `domain-modeling`), 17 decisioni, zero riaperture.
Vincoli di piattaforma verificati sui doc ufficiali Telegram via Context7, non da memoria.

Tre letture alternative considerate e scartate all'inizio della sessione, registrate perché
torneranno: **(1)** bot come cattura di *qualunque* spesa → richiede riconciliazione
manuale↔import, è una milestone a sé; **(2)** bot come strumento di *categorizzazione* delle
transazioni già importate → è un altro prodotto, e l'inline keyboard è peggio del picker esistente;
**(3)** PWA responsive invece del bot → è la risposta giusta **se** il problema vero è "la web app
non si usa da telefono", ma non copre il gesto in 5 secondi alla cassa.
