---
id: SEED-002
status: dormant
planted: 2026-08-05
planted_during: post-v3.0 (grill-me-with-docs su proposta esterna)
trigger_when: any milestone touching the accrual lens (ledger_entry views), the nature/direction taxonomy, cross-user features, or interpersonal debt tracking
scope: large — new domain (interpersonal balances), 6 new tables, a third branch in the accrual ledger view, 2 new natures + 1 nature rename, and a cross-user propagation subsystem
source: /Users/andreabernardini/Downloads/spesecondiviseproposta.md (proposta di un collega, stile Splitwise)
---

# SEED-002: Warikan — spese condivise tra amici

> **Warikan — 割り勘**
> Facciamo alla romana.
> Ripartisce le spese tra amici in modo semplice ed equo.

## Why This Matters

Il motivo non è sociale, è **contabile**. Frase che ha originato tutto:

> "io utente ho 100€ di spesa ma il mio amico non mi ha ancora mandato i soldi — che sia
> utente registrato o meno, i 100€ analizzati per competenza non sono 100 ma sono 50."

Cioè: **lo split è una dichiarazione di competenza, non un'attesa di cassa.** Riduce il costo
nell'istante in cui viene dichiarato, indipendentemente dal fatto che i soldi tornino mai. E questo
è precisamente ciò che v2.8 (Rimborsi 1:N) **non** fa: il residuo di un rimborso si muove solo
quando arriva un'entrata vera collegata.

ADR 0018 cita letteralmente *"Dinner split among friends"* come caso motivante ed è implementato —
ma copre solo il **lato di chi ha pagato**, e solo a rimborso avvenuto. Warikan aggiunge le tre cose
che mancano: la competenza corretta **prima** del rimborso, l'identità dell'amico come entità, e il
**saldo continuo** tra due persone che sopravvive alle singole spese.

## Il nome

**Warikan** (割り勘) è il termine giapponese per dividere il conto tra i presenti. Scelto dopo
ricerca sui concorrenti: il mercato è saturo di "split" (Splitwise, Splid, Splitty, Splital,
SplitMyExpenses, SplitPatron, Splitterup, Kittysplit) — qualunque nome con quella radice legge come
clone. I nomi che funzionano nominano l'oggetto o la domanda, non la meccanica (`Plates`,
`Are We Even`, `Settle Up`). Warikan + il ponte culturale "facciamo alla romana" dà il livello brand
e il livello funzionale.

Nota: *"alla romana"* significa **parti uguali** — combacia con l'MVP (solo divisione paritaria), ma
il payoff diventa leggermente falso il giorno che arrivano le quote personalizzate. Il payoff è
legato allo scope dell'MVP, non al modello dati.

Termini: la parte di ciascuno è una **quota**. La quota di chi non ha nessuna transazione è una
**quota imputata** (in codice `imputed share` — termine contabile per un costo attribuito senza
movimento di cassa). Va in `CONTEXT.md`: è la prima entità di **sola competenza** del sistema.

---

## Decisioni bloccate

Tutte prese e motivate durante il grill. Non riaprirle in fase di discussione senza una ragione
nuova — ognuna ha già un contro-argomento considerato e scartato.

### Modello di dominio

1. **L'unità è la Transazione, non la Expense.** Identico a ADR 0019 §1 e per la stessa ragione: le
   Expense aggregano per `descriptionHash`, quindi due cene allo stesso ristorante finirebbero nella
   stessa Expense.
2. **Mutua esclusività a tre: rimborso · dilazione · warikan.** Una transazione può stare in **uno**
   solo dei tre meccanismi. Non è ordine, è correttezza — vedi *Guardia dell'esclusività* sotto.
3. **Cassa onesta, competenza scalata.** La cassa mostra l'importo pieno nel mese vero; la
   competenza mostra la quota. Questo è **Mondo Cash**, che ADR 0018 §4 aveva esplicitamente
   rigettato in favore di Mondo Netto. Divergenza deliberata: Mondo Netto è stato inventato quando
   esisteva **una sola lente** ed era un modo di simulare la competenza dentro la cassa. Da v2.9 la
   lente di competenza esiste davvero, quindi per il caso condiviso non serve più.
4. **Saldo a livello di amico, all-time. Nessuno stato di saldo sul singolo warikan.** Forzato dal
   §5 del documento: se il pareggio non è legato a una spesa specifica, non esiste modo di dire
   quale warikan un bonifico cumulativo ha saldato — i soldi sono fungibili, e un'attribuzione FIFO
   sarebbe precisione inventata. Il documento si contraddice su questo (§4 chiede uno stato per
   movimento, §9 lo vieta): **§9 ha ragione**.
   → Divergenza deliberata dalla sorella: ADR 0018 §5 ha un residuo **per àncora**, Warikan ha un
   residuo **per persona**.
5. **Un warikan = un pagante + un insieme di partecipanti.** `payerId` scalare rende
   strutturalmente impossibile il doppio pagante. Multi-pagante = più warikan **raggruppati da un
   tag** — che è anche il modello reale di Splitwise (ogni spesa ha un pagante, il gruppo sta sopra).
   Non obbliga a separare: mesi diversi, categorie diverse, importi diversi, N transazioni.
6. **Credito inesigibile: il saldo resta aperto per sempre.** Nessuna chiusura a perdita. Un saldo a
   zero dopo un condono **mentirebbe** ("con Marco siete pari" quando Marco ti ha fregato 50).
   Prodotto collaterale non ovvio: un registro permanente **"quanto mi devono"**, all-time, che
   nessun'altra parte di Sparter produce (tutto è period-scoped tranne i tag).
   Costo accettato: sommando anni, la competenza sottostima i costi reali di quanto gli amici non
   hanno mai restituito — errore silenzioso ma quantificato e visibile nella somma dei saldi aperti.

### Identità e cross-user

7. **Specchio privato, mai co-proprietà.** Non è una preferenza: è **forzato dallo schema**. La
   tassonomia è per-utente in due modi già in produzione — `subCategory.userId` è nullable
   (`schema.ts:176`, con indice unico dedicato alle private `:193-195`) e
   `userSubcategoryOverride` (`:199-226`) permette di cambiare `natureId`, che determina la
   direzione (ADR 0012). Quindi **la categorizzazione non è un fatto condivisibile**: la stessa
   sottocategoria di sistema può avere natura diversa per due utenti. La copia di X deve avere la
   **sua** Expense con la **sua** sottocategoria.
   Prezzo accettato: **i saldi possono divergere** tra i due utenti (Splitwise non può). Si scopre
   al pareggio, che è un evento concreto e si risolve parlando.
8. **Il ponte è nella base, non in fase 2.** Il ponte è **propagazione** (scrivere una riga privata
   nel database dell'altro), non condivisione di un oggetto. Averlo nella base elimina il problema
   di riconciliazione "40 warikan locali → collega Marco → quali corrispondono a quali?".
   Il contatto locale non è una fase precedente: è il caso `linkedUserId IS NULL` della stessa
   tabella, servito dallo stesso codice.
9. **I contatti locali NON vivono in `user`.** Valutato e scartato (fantasmi in `user` +
   `role: 'local'`). Tre blocchi: `user.email` è `notNull().unique()` (`schema.ts:53`) e un contatto
   locale spesso non ha email; se metti l'email vera, **blocchi la registrazione della persona
   reale**, se ne metti una finta torni al problema di merge; e una riga in `user` è **globale**,
   quindi due utenti finirebbero per condividere un contatto (leakage cross-user).
   `roleEnum` è `["user","admin"]` (`schema.ts:26`) e vive sul confine di auth: `local` lì
   conflaterebbe autorizzazione e ciclo di vita.
   **La proprietà che rende la rivendicazione gratuita è un'altra:** `warikan_participant` punta a
   `friend.id`, non a un user id. Collegare = `UPDATE` di **una colonna**, zero migrazione di dati
   contabili.
10. **Accettazione obbligatoria prima che un costo entri nei numeri di X.** Senza, qualunque utente
    può iniettare costi nella dashboard di un altro. Nell'accettazione X **categorizza col proprio
    vocabolario**; la sottocategoria di Anna viaggia come **pre-selezione suggerita solo se di
    sistema**, mai applicata.
    Corollario: *accettare un warikan propagato = categorizzare una quota imputata.* Stesso atto.
11. **Le modifiche successive di Anna propongono, non applicano.** Se serve il consenso per entrare,
    serve anche per cambiare. Costo: X può restare disallineato per sempre se ignora la proposta →
    serve un indicatore "Anna ha modificato questo warikan, rivedi".
12. **Nessuna infrastruttura email.** Verificato: zero occorrenze di `resend`/`nodemailer`/
    `sendgrid`/`postmark`/`sendEmail` in `lib/`, `app/`, `auth.ts` **e `package.json`** — non è da
    configurare, non c'è la dipendenza. (`auth.ts:88-92` forza `emailVerified: true` proprio per
    questo.) Conseguenza: **si collega solo a utenti già registrati**, ricerca per **email esatta**.
    Se non lo trovi, crei un contatto locale.
    Accettato consapevolmente: la ricerca rivela se un indirizzo è registrato su Sparter (oracolo di
    esistenza account) — standard nel settore.
    **Al lancio il percorso locale è quello dominante**, non un ripiego: nessun amico di nessun
    utente sarà registrato. Va costruito come cittadino di prima classe.
13. **Gratis su tutti i piani nell'MVP**, a pagamento in futuro. Un gate romperebbe una feature a
    due lati: se l'amico è su `free` e non può accettare, **il tuo** saldo resta disallineato per il
    piano di un altro. È l'unico caso nel modello in cui il piano altrui degrada la tua contabilità.

### Numeri e lente di competenza

14. **Il rapporto di scala è `quota mia / quanto ho pagato io`** (`S/P`), applicato a ciascuna mia
    transazione collegata. **Non** `quota / totale`.
    Vacanza: pago hotel 400, Marco paga voli 300, totale 700, mia quota 350. Con `S/totale` = 0,5 la
    mia transazione da 400 darebbe 200 — **sbagliato di 150**. Con `S/P` = 350/400 = 0,875 dà
    esattamente 350, nel mese vero dell'hotel.
    Conseguenza pulita: **nessuna riga aggiuntiva serve quando ho pagato qualcosa.** La riga
    inventata dal nulla serve **solo** quando `P = 0`.
    Costo contenuto: in quel caso tutti i 350 finiscono sotto la categoria dell'hotel anche se parte
    del costo erano voli. Per fare meglio servirebbe conoscere le categorie di ciò che ha pagato
    Marco — fuori MVP.
15. **`M = 0` non è il caso marginale: è il lato ricevente di OGNI warikan.** La copia propagata a X
    ha per costruzione zero transazioni di X. L'unica differenza tra "propagato" e "inserito a mano"
    è **chi digita**. Quindi quota imputata + sottocategoria obbligatoria sono **portanti**, non
    rifiniture di un angolo.
    (La superficie di serie B è solo la **form di creazione manuale** di un debito verso un
    non-utente: può essere spartana.)
16. **La quota imputata è portata da una Expense dedicata con zero transazioni**
    (`warikan.imputedExpenseId`), **non** da una `subCategoryId` sulla warikan.
    Motivo strutturale: `ledger_entry_accrual` è una **`pgView`** con cinque colonne —
    `id · userId · occurredAt · expenseId · amount` (`schema.ts:843-871`) — e **nessuna
    `subCategoryId`**. Le aggregazioni risolvono la categoria con un join
    `ledger.expenseId → expense.subCategoryId`. Una colonna sulla warikan non sarebbe leggibile
    dalla lente senza allargare la view e mettere un `COALESCE` in ~10 siti di aggregazione — cioè
    esattamente ciò che ADR 0019 §10 ha lavorato per non toccare.
    Precedente identico: `amortizationInstalment.expenseId` punta alla Standalone Expense creata dal
    detach forzato (ADR 0019 §1).
    Benefici: la lente **cassa** legge `FROM transaction`, quindi una Expense senza transazioni le è
    invisibile per costruzione (ADR 0019 §8 rispettato: nessuna transazione sintetica); e si
    **riusa il picker unico di sottocategoria** senza UI nuova, perché categorizzare una quota
    imputata *è* categorizzare una Expense. `expense.descriptionHash` è nullable (`:395`) e in
    Postgres i `NULL` non collidono nell'unique `(userId, descriptionHash)` (`:420`), quindi N quote
    imputate convivono senza hash finti.
17. **Sottocategoria obbligatoria per la quota imputata.** `DASHBOARD_TOTAL_EXPENSE_STATUSES` è
    `['1','2','3']` (`lib/dal/dashboard-filters.ts:12`) e `'1'` è lo status di una Expense **non
    categorizzata**, che **rientra nei totali**. Una quota imputata senza categoria gonfierebbe il
    totale della competenza senza stare in nessuna categoria → **totale ≠ Σ categorie**, il bug che
    erode la fiducia nei numeri. E a differenza delle spese importate, **non esiste nessun backlog**
    che la ripeschi per farla categorizzare dopo.
    Il motore non può aiutare: Tier 1 lavora sulla descrizione bancaria, Tier 2 sul
    `descriptionHash`, Tier 3 sul testo — una quota imputata **non ha descrizione bancaria**.
    (Opzionale, resa probabilmente bassa: far girare Tier 1 sul titolo digitato come suggerimento.)
18. **Le quote sono persistite, il totale è derivato.** Nessun `totalAmount` sulla warikan: sarebbe
    lo stesso numero scritto due volte (§3.2: Σ debiti = Σ crediti) con un invariante **non
    verificabile** da un `CHECK` (Postgres non controlla somme tra righe).
    Precedente giusto: `expenseGroup` **non persiste i totali** deliberatamente (`schema.ts:464-485`
    + commento `:461-463`). Precedente scartato: `amortizationPlan.totalAmount` è uno snapshot
    (`:657-658`) perché il piano *deriva* da una transazione — un warikan invece **dichiara** un
    fatto sociale.
    E l'arrotondamento va persistito comunque: 100 / 3 = 33,34 · 33,33 · 33,33. Se le quote fossero
    derivate in lettura, cambiare la regola del resto **riscriverebbe la storia in silenzio**.
19. **Resto al pagante** (100 tra tre → pagante 33,34, gli altri 33,33). Simmetrico alla dilazione,
    che mette il resto sulla **prima** rata (ADR 0019 §3). Decimal.js obbligatorio.
20. **Mutazione retroattiva accettata.** Togliere Piero da un warikan di luglio cambia la mia quota
    da 33,33 a 50: un mese chiuso cambia. Precedente esplicito in ADR 0018 §4 (*"a past month can
    change retroactively… this is already the behavior of today's 1:1 pairing"*). Warikan eredita la
    dottrina già accettata, non ne inventa una.
21. **Comportamento noto da segnalare in UI, non un difetto:** con le quote persistite e il rapporto
    `S/P`, la competenza resta **sempre** pari alla quota dichiarata anche se correggi l'importo di
    una transazione collegata (hotel 400→420: il viaggio vale 920 ma la quota resta 450 invece di
    460). Le quote sono un fatto dichiarato e non seguono le correzioni contabili. Serve un
    **indicatore di scostamento** tra Σ transazioni collegate e Σ quote.

### Pareggio (settlement)

22. **Il pareggio è `in`/`out`, non `transfer`.** `transfer` (direzione 4) è
    `hidden: true, shownSeparately: false` (`seed-data.ts:1381-1390`) — **progettato per essere
    invisibile**, giustamente, perché uno spostamento tra conti miei compare due volte nell'import.
    Un pareggio con Marco non è quello, e nasconderlo produrrebbe un danno concreto: la cassa di
    Marco mostrerebbe **−100 a luglio e mai il +50**, sovrastimando la sua spesa di 50 per sempre.
23. **Condizione obbligatoria: la view accrual deve escludere i pareggi.** Con `in`/`out` il
    pareggio ha `includedInTotals: true` e quindi entrerebbe in **entrambe** le lenti: Giulio
    avrebbe −50 a luglio (quota imputata) **più** −50 a settembre = **100**, costo raddoppiato.
    La clausola gemella di quella già presente a `schema.ts:858-860`:
    ```sql
    AND NOT EXISTS (SELECT 1 FROM warikan_settlement ws WHERE ws.transaction_id = <tx>.id)
    ```
    Stesso ragionamento della dilazione: *"il suo costo è rappresentato dalle rate"* →
    *"il suo costo è già rappresentato dalla quota imputata"*.
24. **`warikan_settlement.transactionId` è nullable.** Il pareggio in **contanti** non genererà mai
    nessuna transazione. Se il pareggio richiedesse una transazione, ogni debito saldato in contanti
    resterebbe aperto per sempre e il registro "quanto mi devono" si riempirebbe di debiti falsi,
    distruggendo l'unica cosa che deve garantire.
    Conseguenza coerente: un pareggio in contanti **non compare nella lente cassa**, perché quella
    lente è l'estratto conto. È la stessa asimmetria della quota imputata, nell'altra direzione.
25. **Il collegamento ri-categorizza la transazione, con snapshot per lo scollegamento.** Precedente
    esatto: in v2.8 collegare un rimborso muta titolo/hash/sottocategoria/status della sua expense,
    e `reimbursementRefundSnapshot` (`schema.ts:625-650`) esiste solo per ripristinarli. Senza
    ri-categorizzazione il bonifico resta un **costo** e gonfia le uscite due volte.
26. **Un solo punto d'ingresso:** dentro il warikan scegli *"gli ho dato contanti"* oppure
    *"questa è la transazione che salda"*. Il collegamento alla transazione è un'opzione dentro
    quel punto, non un flusso separato.

### Tassonomia (consegna di seed vera)

27. **Due nature nuove + rinomina di una esistente.**
    Motivo per cui il pareggio **non** può riusare `debt`: `debt` è la nature di **tutta** la
    categoria 14 `rate e finanziamenti` (`seed-data.ts:921-947` — mutuo casa, finanziamenti auto,
    altri finanziamenti, generica). E rata auto e pareggio **non sono la stessa cosa**: il
    discriminante è **quando si riconosce il costo**. La rata *è* l'evento di costo (CONTEXT.md:
    l'intera rata è OUT, capitale e interessi non separabili dall'import). Il pareggio è il
    pagamento di un costo **già riconosciuto altrove**.
    → Proprietà che definisce la nuova nature senza arbitrio: **`payable` è la sola nature `out`
    esclusa dalla lente competenza.**
    Argomento pratico decisivo: se il pareggio usasse `debt`, spegnere il chip "Debiti"
    nasconderebbe **anche mutuo e rata auto** — cioè la filtrabilità che è il motivo per cui si
    aggiungono le nature diventerebbe irraggiungibile.

    ```
    MODIFICA (riga già seedata → step nuovo in seed-extras.ts)
      nature 5   code  debt → financing     labelIt "Debiti" → "Finanziamenti"

    NUOVE (righe nuove → seed-data.ts: onConflictDoNothing le rende additive)
      nature     code  receivable   directionId 1 (in)    labelIt "Crediti"
      nature     code  payable      directionId 2 (out)   labelIt "Debiti"
      category   crediti  type "in"   + 1 sottocategoria (nature receivable)
      category   debiti   type "out"  + 1 sottocategoria (nature payable)
    ```

    `sub_category.natureId` non va toccata: è una FK per id, il codice è solo chiave di display e di
    filtro.
    Codici `receivable`/`payable` e non `credit`/`debit`: in inglese contabile `debit`/`credit` sono
    i due lati della partita doppia (dare/avere), non "debiti/crediti verso terzi".
    Guadagno collaterale: dopo la modifica "Debiti" nella dashboard significa **una cosa sola**, e i
    mutui stanno sotto "Finanziamenti", che è quello che sono.

28. **Due categorie e non una.** `categoryType` nella dashboard è in realtà `direction.code`
    (`lib/dal/dashboard.ts:1065`), derivato dalla nature. Una sola categoria con due nature di
    direzione diversa comparirebbe **in entrambi i ranking** e renderebbe ambigua la risoluzione di
    direzione in `getCategoryDetailMeta` — il punto dove SEED-001 documenta un bug già corretto una
    volta (`type: null` → fallback `'out'` per ogni categoria).

29. **Il macchinario di filtro esiste già.** `overview-chart-filters.tsx:154-161`: i chip di
    **Entrate e Uscite sono toggleable** (quelli degli Accantonamenti sono display-only). Le due
    nature nuove diventano due chip nei gruppi che già sanno accendersi e spegnersi — quindi le
    Entrate gonfiate dei pareggi sono un segmento che l'utente può **spegnere**.
    ⚠️ Da verificare in fase di piano: i chip filtrano le **barre**; se seguano anche i **KPI** non è
    stato verificato. Se non li seguono, la mitigazione è parziale.

30. **Il vocabolario delle nature resta hardcoded.** Valutato e rimandato (→ **SEED-003**).
    `FlowNature` è una union TS (`lib/utils/nature-labels.ts:3-11`) con tre
    `Record<FlowNature|'unclassified', …>`: aggiungere una nature è un cambio di contratto tipizzato
    in ~6 punti, **ma il compilatore te li elenca tutti** e il fallimento della build È la
    checklist. Icone e chip non possono venire dal DB (componenti React e copy).
    Più due elenchi letterali **non** legati al compilatore: `NATURE_ALLOWED`
    (`lib/validations/transactions.ts:155-166`, allowlist dei filtri da URL) e
    `lib/validations/category.ts:38-47`.
    **`debt` va tenuto in `NATURE_ALLOWED` come alias legacy** così i link salvati non si rompono —
    precedente in casa: quella lista contiene ancora `operational`, `financial`, `extraordinary`,
    codici morti dai rename di v2.0.

### Guardia dell'esclusività a tre

31. **Guardia applicativa + test di invariante su Postgres reale** (opzione scelta).
    **Non è ordine, è correttezza.** Se il vincolo salta:
    - *Warikan + dilazione:* il branch 1 della view esclude le transazioni dilazionate e il branch 2
      emette le rate, che **non sanno nulla della quota** → la competenza mostra il **costo pieno**
      spalmato sui mesi.
    - *Warikan + rimborso:* il netting è cucito in `ledgerEntryCashAmountSql()` → una transazione
      sia scalata sia nettata riceve **due volte** lo stesso beneficio.

    Postgres **non può** esprimere l'esclusività tra tabelle diverse: ogni `unique(transactionId)`
    garantisce solo "al massimo uno dentro la propria feature".
    → Una funzione tipo `assertTransactionMechanismFree()` chiamata dai tre percorsi di attivazione,
    **più** un test nella suite real-Postgres che asserisce che le tabelle di link non condividono
    mai un `transactionId` (la suite esiste: è quella di v2.8 che prova i dieci siti di aggregazione
    byte-identical). Non è un vincolo, ma trasforma la regola in un fallimento di CI.
    **Hardening futuro scartato per ora:** tabella di occupazione condivisa
    `transaction_mechanism (transactionId PK, mechanism enum)` — dottrinalmente corretta
    (impossibilità strutturale) ma richiede un backfill **e** la modifica dei percorsi di scrittura
    di **due feature già spedite**, cioè rischio di regressione proprio nelle feature i cui numeri
    si vogliono proteggere.

### Amicizia e inbox

32. **L'amicizia non serve alla tua contabilità, serve solo alla propagazione.** Non serve il
    consenso di Marco per registrare nei **miei** libri che ho diviso una cena con lui: serve solo
    per scrivere nei **suoi**. Quindi **il contatto è utilizzabile dal secondo zero** e
    l'accettazione sblocca soltanto la propagazione. Non si aspetta mai nessuno per tenere in ordine
    i propri numeri.
33. **Nessuno stato su `friend`. La verità dello stato accettato è `linkedUserId`** che passa da
    `NULL` a un valore — un puntatore invece di un flag, quindi porta gratis anche *a chi*.
    La negoziazione vive in `friend_link_request` con i quattro stati che il documento §9 chiede.
    Un booleano su `friend` è insufficiente per due ragioni: non distingue *rifiutata* da
    *annullata* da *mai inviata* — e **il rifiuto va registrato**, altrimenti si può re-invitare la
    stessa persona all'infinito e si costruisce un canale di spam; e sarebbe **privo di significato
    per la maggioranza delle righe**, perché un contatto locale (`linkedUserId IS NULL`) non ha
    nessuno che debba accettare, e al lancio è il caso dominante (D12).
    **Amicizia simmetrica:** all'accettazione il sistema valorizza il `linkedUserId` del richiedente
    **e crea la riga `friend` speculare** del destinatario che punta indietro (con `name`
    precompilato da `user.name`) — senza, il destinatario non potrebbe vedere il saldo né propagare
    a sua volta. Simmetrica per evitare mezzi stati incomprensibili.
34. **Due gate, due scopi, nessuno ridondante.**

    | gate | protegge |
    |---|---|
    | amicizia accettata | **la casella** — chi non è amico non può nemmeno proporti niente |
    | warikan accettato (D10) | **i numeri** — quel costo entra solo col tuo consenso |

    Il secondo difende la contabilità ma non l'inbox: senza il primo, chiunque conosca la tua email
    può inondarti di proposte.
    → Siccome entrambi producono un "in attesa", esiste **una sola inbox nella sezione `/warikan`**
    con due tipi di pendenza (richieste di amicizia e proposte di warikan). **Basta un badge con il
    conteggio**: nessun sottosistema di notifiche. Non nella dashboard, che è la superficie
    analitica — in `/warikan`, come `/reimbursements` e `/amortizations`.
35. **Sciogliere un'amicizia: unilaterale, azzera `linkedUserId` su ENTRAMBE le righe, storia
    intatta.** Decisione **derivata**, non una preferenza:
    - *Unilaterale* perché se servisse il consenso di entrambi, chi non acconsente terrebbe l'altro
      in ostaggio con un canale aperto verso la sua inbox — cioè proprio ciò che D34 protegge.
    - *Su entrambe le righe* perché azzerare solo la propria lascerebbe l'altro **ancora collegato e
      quindi ancora in grado di propagare**: lo scioglimento non proteggerebbe nulla. Non è
      simmetria estetica, è la condizione perché la funzione funzioni.
    - *Storia intatta:* i due `friend` tornano contatti locali, warikan, quote, pareggi e saldi
      restano dove sono. Coerente con D9 (cancellazione bloccata con partecipazioni) e con D20 (mai
      riscrivere la competenza passata per un'azione amministrativa).
    Effetto collaterale voluto: il registro "quanto mi devono" (D6) **sopravvive allo scioglimento**
    — che è precisamente il caso in cui serve di più.

---

## Schema proposto

Convenzioni rispecchiate dalle tabelle sorelle: `serial("id")` per le tabelle di meccanismo
(`reimbursement:524`, `amortizationPlan:659`), `userId text notNull cascade`, `createdAt timestamptz
defaultNow notNull`, vincoli **nel database** (`check()` con SQL raw, `uniqueIndex().where()`).

```ts
// L'anagrafica dei miei contatti. Vive oltre Warikan → nessun prefisso.
friend
  id            serial       PK
  userId        text         notNull → user.id  cascade      // il contatto è MIO
  name          varchar(80)  notNull                          // allineato a user.firstName/lastName (:56-57)
  email         varchar(255) null                             // gancio per il collegamento futuro
  linkedUserId  text         null    → user.id  set null      // ≠ NULL = collegamento ACCETTATO (D33)
  createdAt     timestamptz  notNull default now()

  uniqueIndex("friend_userId_email_unique").on(userId, email).where(sql`email IS NOT NULL`)
  // NIENTE unique(userId, name): due Marco esistono nella vita reale. L'anomalia la segnala il
  // frontend, non un constraint che costringe a inventare "Marco B.".
  // NIENTE status: la verità dello stato accettato è linkedUserId (D33). Un contatto è sempre
  // usabile nei propri libri, con o senza collegamento.

// La negoziazione del collegamento a un utente reale. I quattro stati del documento §9 (D33).
friend_link_request
  id            serial       PK
  friendId      integer      notNull → friend.id  cascade    // la MIA riga contatto
  targetUserId  text         notNull → user.id    cascade    // trovato per email esatta (D12)
  status        enum         notNull   'sent' | 'accepted' | 'rejected' | 'cancelled'
  createdAt     timestamptz  notNull default now()
  respondedAt   timestamptz  null

  uniqueIndex("friend_link_request_open_unique").on(friendId).where(sql`status = 'sent'`)
  // una sola richiesta aperta per contatto; le rifiutate restano come memoria anti-spam
  index(targetUserId, status)   // la inbox del destinatario

// Il costo condiviso: un fatto sociale ("questa cosa costava X, l'abbiamo divisa così").
warikan
  id                serial       PK
  userId            text         notNull → user.id     cascade
  title             text         notNull                        // come expenseGroup:471 / reimbursement:528
  occurredAt        timestamptz  notNull                        // data dell'EVENTO condiviso
  payerId           integer      null    → friend.id   restrict  // null = ho pagato io
  imputedExpenseId  text         null    → expense.id  set null  // solo quando M = 0
  createdAt         timestamptz  notNull default now()
  updatedAt         timestamptz  notNull default now() $onUpdate  // ce l'ha expenseGroup:476, non reimbursement

  // NIENTE totalAmount (= Σ quote, vedi D18) · NIENTE status (saldo per-amico, vedi D4)
  // NIENTE currency (multi-valuta fuori scope; additiva) · NIENTE notes (title basta)
  index(userId) · index(payerId) · index(userId, occurredAt)   // la lista si ordina per data

// Chi partecipa e con quale quota. Io sono sempre una riga.
warikan_participant
  id           serial        PK
  warikanId    integer       notNull → warikan.id  cascade
  friendId     integer       null    → friend.id   restrict     // null = io
  shareAmount  numeric(12,2) notNull   CHECK (share_amount > 0)
  createdAt    timestamptz   notNull default now()

  unique(warikanId, friendId)
  uniqueIndex("warikan_participant_self_unique").on(warikanId).where(sql`friend_id IS NULL`)
  // ⚠️ Il secondo è indispensabile: in Postgres i NULL non collidono, quindi il primo NON
  // impedirebbe due righe "io". Stessa forma di reimbursement:545-550.

// Quali MIE transazioni hanno pagato questo warikan. 0..M righe.
warikan_transaction
  id             serial       PK
  warikanId      integer      notNull → warikan.id     cascade
  transactionId  text         notNull → transaction.id cascade
  createdAt      timestamptz  notNull default now()

  unique(warikanId, transactionId)
  unique(transactionId)   // ← questo è quello che conta: una transazione in UN solo warikan.
                          //   Pattern di expenseGroupMembership:504 e del suo commento.

// Il pareggio: un evento tra me e una PERSONA, non legato a un warikan (D4).
warikan_settlement
  id             serial        PK
  userId         text          notNull → user.id     cascade
  friendId       integer       notNull → friend.id   restrict
  amount         numeric(12,2) notNull                          // + ricevuto, − pagato
  occurredAt     timestamptz   notNull
  transactionId  text          null    → transaction.id set null  // nullable: contanti (D24)
  note           text          null                             // §5 la chiede esplicitamente
  createdAt      timestamptz   notNull default now()

  uniqueIndex(transactionId).where(sql`transaction_id IS NOT NULL`)
```

**`restrict` invece di `cascade` su `friendId`** è deliberato e diverso dal resto dello schema: è la
guardia DB della decisione "non puoi cancellare un amico dentro un warikan". Con `cascade`,
cancellare Marco cancellerebbe la sua quota e **riscriverebbe la competenza di luglio**.

### Terzo branch della view accrual

```
sorgente cassa      = transazioni, importo pieno (netting rimborsi già dentro)
sorgente competenza = transazioni né dilazionate né warikan né pareggi
                    ∪ rate di dilazione
                    ∪ transazioni warikan, importo × (quota mia / pagato da me)
                    ∪ quote imputate (M = 0), expenseId = imputedExpenseId
```

La dashboard **non cambia di una riga**: continua a leggere `ledger.amount` e a fare il join su
`expenseId`. L'architettura del seam è documentata come **LOCKED**
(`lib/dal/dashboard-filters.ts:43-47`): la lente scambia quale VIEW si legge, mai un parametro
`lens` infilato nella logica di un'aggregazione.

### Verifica: vacanza da 900

Hotel 400 + volo 300 + cene 200, diviso in due con un amico.

**Caso A — pago tutto io.** Un warikan (un pagante, un insieme di partecipanti), tre transazioni.
Quote 450/450. Rapporto `S/P` = 450/900 = 0,5.

| | cassa | competenza |
|---|---|---|
| hotel 400 | −400 | −200 |
| volo 300 | −300 | −150 |
| cene 200 | −200 | −100 |
| bonifico 450 | **+450** (Crediti) | — (escluso, D23) |
| **totale** | −450 netto | **−450** |

**Caso B — le cene le paga lui.** Due warikan (cambia il pagante), raggruppati da un tag
"Vacanza Sardegna". W1: pagante io, hotel+volo = 700, quote 350/350. W2: pagante lui, `M = 0`,
totale 200, quote 100/100, `imputedExpenseId` categorizzata da me.

| | cassa | competenza |
|---|---|---|
| hotel 400 | −400 | −200 (scalata 350/700) |
| volo 300 | −300 | −150 (scalata) |
| cene (paga lui) | **niente** | **−100** (quota imputata) |
| **totale** | −700 | **−450** |

Saldo: W1 lui mi deve 350, W2 io gli devo 100 → **netto 250**, e **un solo bonifico da 250 chiude
entrambi** perché il saldo vive sull'amico. Se ne mandasse 350 il saldo si inverte a −100 a suo
favore — che §5 chiede esplicitamente.

---

## Open Questions (da chiudere in discuss/plan)

1. **Dove vive lo stato "in attesa" di una proposta di warikan?** ⚠️ *La più importante rimasta.*
   Con lo specchio privato, la dichiarazione di Anna deve creare qualcosa di **pending** dal lato di
   X — ma X non possiede ancora nessuna riga.
   **Il pattern è già deciso per l'amicizia (D33) e si applica quasi certamente identico:** una
   tabella `warikan_proposal` con lo stato, *non* uno `status` di lifecycle sulla warikan speculare —
   così la warikan di X nasce solo all'accettazione, già categorizzata da lui, e resta pulita come
   `friend`.
   Resta da decidere il **riferimento tra le due righe private** dei due utenti
   (`sourceWarikanId`), necessario per far viaggiare le modifiche di D11: un riferimento che
   **attraversa il confine `userId`** senza trasferire ownership. Va verificato che non apra letture
   cross-user oltre il minimo.
   *(Risolta invece la vecchia OQ2 — come X scopre la propagazione: l'inbox unica di D34 con badge,
   senza sottosistema di notifiche.)*
2. **Effetti collaterali della prima Expense a zero transazioni del sistema:** va esclusa
   esplicitamente da `/expenses` (comparirebbe con totale 0 e 0 transazioni), e va verificato
   l'impatto sulla **storia Tier 2** della categorizzazione, che impara dalle Expense.
3. **I chip di filtro seguono i KPI o solo le barre?** (D29) Decide se la mitigazione sulle Entrate
   gonfiate è totale o parziale.
4. **Modifica/cancellazione di un warikan quando esistono già pareggi** (§3.3 del documento): errore
   bloccante o conferma con annullamento a cascata? Per il lato propagato D11 risponde; per il
   proprio warikan no.
5. **Da dove si attiva un warikan** (riga transazione, pagina dettaglio, inserimento manuale)?
   Modello: ADR 0019 §9 per la dilazione.
6. **Rinominare "Debiti" → "Finanziamenti" tocca copy di una feature spedita** — va deciso se in
   scope della stessa milestone o separato.
7. **Route e naming UI:** `/warikan` (nome proprio, non italiano né inglese) — coerente con la
   convenzione di linguaggio? Le sorelle sono `/reimbursements` e `/amortizations`.

### Limiti noti (non blocchi)

- **Una transazione che paga due warikan diversi** (conto unico al ristorante per due gruppi) non è
  esprimibile: `unique(transactionId)`. Si risolverebbe dividendo la transazione, che Sparter non fa.
- **Multi-valuta** fuori scope, anche se `transaction.currency` esiste (default EUR): un saldo tra
  due persone in valute diverse richiede una decisione sul tasso di cambio.
- **Quote personalizzate** (percentuali/importi) fuori MVP — la colonna `shareAmount` per
  partecipante le supporta già, manca solo la UI e la validazione `Σ quote = totale dichiarato`.
- **Abbonamenti condivisi ricorrenti** restano fuori: ADR 0018 §6 li ha rimandati alla "Subscriptions
  view" perché richiedono fan-out temporale, non linking. Warikan non li copre.

## Scope Estimate

**Grande.** Non è una feature contabile: è una feature contabile **più** un sottosistema di
propagazione cross-user. Le parti, in ordine di rischio:

1. **Tassonomia + seed** (basso): 2 nature, 2 categorie, 2 sottocategorie in `seed-data.ts`; 1 step
   in `seed-extras.ts` per il rename; ~6 punti tipizzati + 2 elenchi letterali nel frontend.
2. **Schema + terzo branch della view** (medio): 6 tabelle, la clausola `NOT EXISTS`, la guardia di
   esclusività e il suo test di invariante. Il seam è LOCKED, quindi il perimetro è noto.
3. **UI del lato pagante** (medio): sezione `/warikan`, creazione, collegamento transazioni,
   pareggio, saldo per amico, registro "quanto mi devono".
4. **Quota imputata + form manuale** (medio-basso): riusa il picker unico; la form è spartana.
5. **Amicizia + inbox** (medio): ricerca per email esatta, `friend_link_request`, riga speculare
   all'accettazione, inbox unica con badge (D33/D34). Progettato.
6. **Propagazione dei warikan** (alto — il vero rischio): proposte, accettazione con
   categorizzazione, proposte di modifica (D11), e la **Open Question 1** che è l'unico pezzo
   architetturale ancora non chiuso.

Candidata a essere spezzata in due milestone: **(a)** Warikan locale completo — punti 1–4, già
interamente utile e coerente da solo; **(b)** il ponte cross-user, punti 5–6. Nota che D8 dice che il
ponte va nella base *concettualmente* (il modello dati è lo stesso, `friend.linkedUserId` esiste da
subito) — spezzare l'**implementazione** in due fasi non riapre il problema di riconciliazione,
perché i warikan puntano a `friend.id` in entrambi i casi.

## Breadcrumbs

- **Proposta originale:** `/Users/andreabernardini/Downloads/spesecondiviseproposta.md` — con
  executive summary per PO. Da archiviare in repo se la milestone parte.
- **ADR 0018** (Rimborsi 1:N): cita *"Dinner split among friends"* come caso motivante; §4 Mondo
  Netto (da cui Warikan diverge), §5 residuo per àncora, §6 abbonamenti fuori scope.
- **ADR 0019** (Ammortamento/lente competenza): §1 unità = transazione, §3 resto sulla prima rata,
  §8 mai transazioni sintetiche, §10 il seam `ledger_entry` — **l'architettura su cui Warikan si
  innesta**.
- **ADR 0012** direzione derivata dalla nature · **ADR 0003** nature a livello di sottocategoria.
- **SEED-001** (modalità semplice/avanzata): stesso terreno — categorizzazione manuale e picker
  unico. Se le due milestone si incrociano, la modalità semplice cambierebbe **come** si categorizza
  una quota imputata (categoria invece di sottocategoria).
- **SEED-003** (nature vocabulary DB-driven): generata da questo grill, vedi D30.
- Codice chiave: `lib/db/schema.ts:819-871` (le due view), `lib/dal/dashboard-filters.ts:43-47`
  (seam LOCKED), `lib/utils/nature-labels.ts`, `components/dashboard/overview/overview-chart-filters.tsx`,
  `scripts/seed-data.ts:1347-1391` (direzioni) e `:921-947` (nature `debt`).

## Notes

Catturata il 2026-08-05 da un `/grilling` con verifica sul codice (nessuna decisione presa senza
prima leggere lo schema o il seed corrispondente). Nulla è stato costruito: questo documento è
materiale per `/gsd-new-milestone` o `/gsd-spec-phase`.

Tre premesse del documento originale sono state **falsificate** durante il grill e non vanno
riprese: (a) l'invito via email — non esiste infrastruttura; (b) *"la spesa è già categorizzata,
l'altro non deve fare nulla"* — la tassonomia è per-utente; (c) lo stato di saldo per singolo
movimento (§4) — incompatibile con il pareggio non ancorato (§5), e §9 dello stesso documento lo
vieta.
