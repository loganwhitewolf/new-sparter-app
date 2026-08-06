---
id: SEED-004
status: dormant
planted: 2026-08-06
planted_during: post-v3.0 (grill-with-docs, sessione dedicata)
trigger_when: any milestone touching recurring-cost analysis, the Expense aggregation model, the accrual lens, or the SaaS tier column on user; also re-read before planning SEED-002 (Warikan), which overlaps on shared costs
scope: medium-large — una milestone da ~4-5 fasi. Non tocca il read layer della dashboard (nessuna modifica al seam `ledger_entry` né ai 10 siti di aggregazione), ed è questo che la tiene sotto v2.9.
supersedes: SUBS-VIEW (deferred da v2.4, ADR 0016) — `.planning/STATE.md:567,696`
---

# SEED-004: Abbonamenti

> Sapere quali abbonamenti hai attivi, quali incidono di più, quando scadono e quanto stai
> spendendo — senza toccare la dashboard del budget.

## Why This Matters

`SUBS-VIEW` è deferred dal 2026 (`STATE.md:567`, origine ADR 0016): *"normalized Subscriptions view
showing net cost per covered month for shared/recurring expenses"*. È rimasto fermo perché sembrava
richiedere normalizzazione temporale, cioè v2.9. **Non è così**: il grill ha stabilito che la
normalizzazione può vivere in lettura, dentro la sezione, e che la dashboard del budget resta per
cassa — esattamente come SUBS-VIEW aveva già deciso e nessuno aveva riletto.

Il fatto che rende la feature economica è che **la Expense è già l'abbonamento**. `expense` ha
`UNIQUE (user_id, description_hash)` (`lib/db/schema.ts:420`), quindi Netflix è già **una riga sola**
con `transactionCount`, `totalAmount`, `firstTransactionAt`, `lastTransactionAt`. Le quote future ci
atterrano da sole all'import, per via dell'hash. Non serve scrivere nessun codice di riconoscimento
del rinnovo, e **non serve nessun detach**: a differenza dell'ammortamento (ADR 0019 §1, dove l'unità
è l'acquisto e due portatili condividono una Expense), qui è proprio la Expense che *è* l'oggetto.

## Il nome

**UI: "Abbonamenti".** **Codice: `subscription`.**

Prerequisito bloccante della milestone: **rinominare `user.subscriptionPlan` → `user.accountTier`**.
Oggi quella colonna è il piano SaaS di Sparter (`free` / `basic` / `pro`, vedi i feature gate in
`CLAUDE.md`) e una tabella `subscription` accanto a una colonna `subscriptionPlan` che significa
tutt'altro è una trappola permanente.

Costo misurato: **58 occorrenze in ~20 file**, di cui **12 file sono test** — sostituzione meccanica.
La superficie di produzione è piccola: `lib/db/schema.ts`, `lib/dal/users.ts`, `lib/actions/*`, due
pagine, e il campo custom di Better Auth in `auth.ts`. Serve una migration di rename.

Vincoli sul nome scelto:
- **Non usare `plan`** per la colonna SaaS: **`Piano` è già un termine di glossario** (il piano di
  ammortamento, `CONTEXT.md:248`).
- `@better-auth/stripe` definisce una tabella `subscription`, ma **non è installato**
  (`better-auth@1.6.9`, nessun `subscription` nei plugin core). Se un giorno adottate il billing,
  Better Auth permette di rimappare i nomi delle tabelle: sarà quello schema a spostarsi, non il
  dominio.

## Decisioni bloccate

### Modello di dominio

**D01 — Un Abbonamento è una riga `subscription` ancorata a Expense XOR Expense Group.**
Stessa forma di `reimbursement` (`lib/db/schema.ts:521`, ADR 0018 D-03): `expenseId` XOR
`expenseGroupId` con `CHECK` a DB. Le transazioni dell'abbonamento sono quelle della sua Expense —
il legame `transaction.expenseId` esiste già, nessuna tabella di membership da scrivere.

**D02 — Nessun detach, mai.** L'unità è la Expense, non la transazione. Attivare un abbonamento non
tocca `descriptionHash`, non crea Standalone Expense, non altera l'aggregazione.

**D03 — Cambio carta / descrizione bancaria diversa → Expense Group, non un join dedicato.**
*Respinta* la tabella `subscription_expense` (N Expense per subscription): avrebbe creato un
**secondo meccanismo** per dire "queste N Expense sono la stessa cosa", accanto all'Expense Group di
ADR 0017. I due potrebbero contraddirsi (una Expense nel Group X mappata a una subscription che linka
anche Expense del Group Y) e **nessun CHECK a DB può impedirlo** —
`expense_group_membership` ha `unique(expenseId)`, una Expense sta in al massimo un gruppo.

Il gesto esiste già: **Unisci** (ADR 0017 §4). Il gate "stessa sottocategoria" (§2) passa banalmente
per Netflix vecchia/nuova carta, entrambe `streaming`.

**D04 — Una sola tipologia per abbonamento.** *Respinta* la cardinalità N (tag-like): con Amazon
Prime contato in "video" *e* "delivery" la somma dei gruppi supererebbe il totale della sezione, e
questo progetto difende esplicitamente la proprietà opposta (`CONTEXT.md:222`: *"i contributi sommano
esattamente alla differenza della categoria padre — proprietà verificabile dall'utente, che è la
ragione per cui questa misura esiste"*). Amazon Prime sceglie il suo scopo dominante, come già fa per
la sottocategoria.

**D05 — Le tipologie sono seedate + estendibili dall'utente**, con il modello già in uso per
`subCategory` (`lib/db/schema.ts:172`): righe di sistema con `userId IS NULL` + righe utente, unique
index parziali distinti. Nessun pattern nuovo da inventare, e `createSubcategoryAction`
(`lib/actions/categories.ts:193`) è il precedente d'uso.

**Seedare stretto (~10-12 voci).** Vedi "Tensione accettata" più sotto: una lista larga verrà
riscritta dagli utenti con le parole della sottocategoria e i due assi divergeranno per noia.

### Nascita e morte

**D06 — Scoperta assistita, non proposta automatica.** La sezione elenca le Expense con **≥2
transazioni**, ordinate per **regolarità della cadenza** (deviazione standard degli intervalli), con
cadenza e importo stimati accanto; l'utente **spunta in blocco**.

Il sistema **non asserisce** che qualcosa è un abbonamento. Conseguenze: zero falsi positivi
persistiti, e **nessuna memoria dei rifiuti da costruire** — che invece servirebbe con una proposta
automatica, per non ri-proporre gli stessi candidati a ogni import.

È la dottrina di ADR 0017 §4 (*"false positives are costlier than the manual bulk gesture, which is
already Sparter's natural post-import flow"*) applicata a un problema diverso, e corrisponde
letteralmente alla richiesta originale: *"un metodo per riconoscere quali **potrebbero** essere
abbonamenti"*.

*Respinte*: proposta automatica post-import stile ADR 0002 (richiede memoria dei rifiuti); soglia
modulata da un flag `subscriptionLike` sulle sottocategorie (~110 righe da seedare e mantenere per un
guadagno marginale); attivazione solo manuale stile ADR 0019 §9 (con 15-30 abbonamenti a testa il
registro resta vuoto — la cardinalità è diversa da quella dell'ammortamento e il precedente non
vincola).

**Punto cieco noto e non risolvibile:** un abbonamento **annuale nuovo è indistinguibile da una spesa
una tantum** finché non si ripete. Servono due anni di storico. Non è un difetto del rilevatore, è
una proprietà del segnale.

**D07 — Lo stato "cessato" si deduce sui Mesi Coperti, mai dal calendario.**
N cicli attesi caduti **dentro Mesi Coperti** senza addebito → "probabilmente cessato". Se quei mesi
non sono coperti, **non si dice niente**.

Vincolo che lo impone, `CONTEXT.md:206`: *"Un mese senza nessuna transazione non esiste… non sappiamo
se non hai speso o non hai importato. **Nessuna presunzione in nessuna delle due direzioni**"*.
Dedurre "cessato" dall'assenza di addebiti nel calendario dichiarerebbe morto un abbonamento che
l'utente sta ancora pagando e che semplicemente non ha importato. Se invece il mese **è** Coperto
(esistono altre transazioni) e l'abbonamento non ha addebitato, quell'assenza **è un fatto**.

Override manuale sempre disponibile.

### La sezione

**D08 — La dashboard classifica abbonamenti, non categorie.** Totale mensile + annuo, top per costo
annuo ("quali incidono di più"), prossimi rinnovi, attivi vs cessati. L'unità è l'abbonamento.

**D09 — Tre assi di raggruppamento: tipologia, sottocategoria dell'ancora, nature.**
Sottocategoria e nature sono **derivate, costo zero**. In particolare *"quanto spendo all'anno in
abbonamenti discrezionali vs essenziali"* è `nature.discretionary` / `nature.essential` (id 4 e 3 in
`scripts/seed-data.ts`), che vivono a livello sottocategoria (ADR 0003) — nessun dato nuovo.

**La sezione aggrega sulle `subscription`, non sulle sottocategorie.** È il punto che ha sbloccato il
grill: il timore che `sport-e-fitness` mescolasse la palestra con una partita di padel è infondato,
perché il padel non è una riga subscription e non compare. **La tabella `subscription` *è* il
filtro**; la sottocategoria è solo l'etichetta di raggruppamento.

| | dashboard Budget | sezione Abbonamenti |
|---|---|---|
| `sport-e-fitness` | €80 (palestra + padel) | **€50** — solo la palestra |
| `videogiochi` | €512 (Xbox + Game Pass) | **€12,99** — solo Game Pass |

**D10 — Filtri e ordinamento riusano il sistema unificato** (ADR 0009/0010, URL come source of truth
+ restore da `sessionStorage`).

### Numeri

**D11 — L'annuale si normalizza in lettura, solo dentro la sezione.**
Nuovo termine: **Costo mensile equivalente** — €120/anno → €10/mese. Calcolato con Decimal.js, mai
persistito. **La dashboard del budget resta per cassa**: marzo mostra €120.

Non chiamarlo **Ritmo**: è già preso (`CONTEXT.md:213`, media mensile di una categoria sui Mesi
Coperti).

*Respinta per ora* la lente competenza — vedi "Vincoli per il futuro".

**D12 — Condiviso: netto grande, lordo barrato accanto.**
Il netting è **già calcolato**: un rimborso ADR 0018 si ancora alla Expense, la *stessa* a cui si
ancora l'abbonamento, quindi `effectiveAmount()` dà il costo netto senza codice nuovo. La
presentazione riusa il pattern già spedito nella **Fase 81** (netto + importo iniziale barrato + badge
"riduzione di" sul counterpart).

Il totale della sezione somma i **netti** — cioè quanto ti costano davvero gli abbonamenti.

Conseguenza da comunicare in UI: **Mondo Netto netta al tempo del costo**. €120 a marzo, rimborso €60
a dicembre → marzo diventa €60 *retroattivamente*, e il Costo mensile equivalente passa da €10 a €5
anche per i mesi già visti. Coerente con tutto il resto dell'app, ma sorprendente se non detto.

### Identità visiva

**D13 — `subscription.icon` è una chiave: slug Simple Icons, oppure emoji.**
[Simple Icons](https://github.com/simple-icons/simple-icons) — **oltre 3.400 icone SVG di brand in
CC0-1.0** (pubblico dominio), pacchetto npm `simple-icons`, import per slug con tree-shaking, ogni
icona porta il colore hex ufficiale del brand.

**Nessuna anagrafica esercenti.** Era la mina: `CONTEXT.md:23`, riga `_Avoid_` della voce Expense
Group, dice esplicitamente *"merchant/esercente (**non è un'anagrafica**)"*. Con l'icona come colonna
scelta da libreria, quella tabella non nasce mai.

**Nota legale — la CC0 copre il file SVG, non il marchio.** Il disclaimer di Simple Icons è esplicito:
*"Simple Icons cannot be held responsible for any legal activity raised by a brand, or users of the
package. We ask that our users seek the correct permissions to use the icons relevant to their
project."* L'uso previsto qui è il più difendibile che esista — **uso nominativo**: il logo Netflix
identifica *l'abbonamento Netflix dell'utente* dentro la sua lista privata, non è brand nostro, non
implica partnership. **Diventa rischioso altrove**: landing page, screenshot promozionali, listing
sugli app store. Lì è marketing e cambia il regime.

**Vincolo tecnico**: 3.400 icone sono ~5MB. Import per slug singolo (tree-shaking) o sottoinsieme
curato (~60-100 servizi) spedito nel bundle. Fallback emoji / iniziale colorata per la coda lunga.

*Respinte*: icona derivata dalla tipologia (Netflix e Disney+ diventerebbero due righe identiche —
perde esattamente il riconoscimento a colpo d'occhio che era l'obiettivo); default da tipologia con
override (due sorgenti per lo stesso pixel = una regola di precedenza da ricordare ovunque si renderizzi
un'icona); upload utente su R2 (peso, dimensionamento, cache, immagine arbitraria in una vista core).

## Schema proposto

Indicativo — colonne, indici e sintassi dei constraint restano a plan-phase
(`gsd-pattern-mapper` contro lo schema vivo).

```
subscription
  id, userId
  expenseId       ─┐ XOR, CHECK subscription_anchor_xor
  expenseGroupId  ─┘
  subscriptionTypeId  → subscription_type (NOT NULL, vedi D04)
  label               text nullable — etichetta libera ("Netflix famiglia", "Adobe lavoro")
  icon                text — slug Simple Icons oppure emoji
  cadence             enum/varchar — monthly | quarterly | yearly | custom
  expectedAmount      numeric(12,2) nullable
  status              varchar — active | cancelled  (+ deduzione D07 in lettura)
  cancelledAt         timestamptz nullable
  createdAt, updatedAt
  UNIQUE(expenseId), UNIQUE(expenseGroupId)   -- un'ancora = al più un abbonamento

subscription_type
  id, userId (nullable → riga di sistema)
  name, slug, displayOrder, isActive
  unique index parziale su (slug) dove userId IS NULL
  unique index parziale su (userId, slug) dove userId IS NOT NULL
```

Migrations previste: le due tabelle sopra + il rename `user.subscription_plan` → `user.account_tier`.
Seed delle tipologie: **step additivo**, mai colonne nuove in `seed-data.ts` (regola di progetto).

## Tensione accettata (da scrivere in ADR, non da far scivolare dentro)

**La tipologia è un secondo asse di classificazione, deliberatamente locale alla sezione e
deliberatamente non riconciliato col budget.**

Perché è accettabile: la sezione Abbonamenti non è il budget. Risponde ad altre domande su un insieme
già filtrato. `CONTEXT.md:60` (*"per scopo, non per… esercente o beneficiario"*) è una regola sulla
**categorizzazione per il budget**, non un divieto universale.

Perché va comunque scritto:

1. **Sarà ~90% ridondante con la sottocategoria.** "streaming video" → `streaming`, "palestra" →
   `sport-e-fitness`, "delivery" → `take-away-e-delivery`. Guadagna davvero solo dentro
   `app-e-software` (AI vs cloud vs produttività vs sicurezza — distinzioni che il budget non chiederà
   mai) e sui quattro orfani qui sotto.

2. **Ricostruisce in parte una tassonomia che v2.0 ha smontato di proposito.**
   `nature-remapping-WORKING.md:114` — *"Merges: … **streaming** …"*: `streaming-video` e
   `streaming-musica` **erano** sottocategorie separate e sono state fuse. La tipologia le riseparerà,
   ma **solo dentro la sezione**. Idem `libri-e-audiolibri` (ebook vs audiolibri). Su questi due
   gruppi i due assi daranno risposte diverse alla stessa domanda, e nessuno li terrà allineati.

3. **Copre quattro casi che la tassonomia non ha** (verificato mappando lo spazio reale degli
   abbonamenti del mercato italiano contro le 110 sottocategorie di `seed-data.ts`): **editoria
   digitale** (Corriere/Repubblica/Substack) non ha casa; **Amazon Prime** è multi-scopo
   (spedizioni + video + musica) e non è categorizzabile onestamente; **membership a un creator**
   (YouTube/Patreon) sta fra `streaming` e `donazioni`; **dating** non ha casa. Nota che questi
   quattro sono difficili **anche per il budget** — la tipologia li risolve in un posto solo.

Copertura misurata, per riferimento: Netflix/Disney+/NOW/DAZN → `streaming` · Spotify/Apple Music →
`streaming` · Claude/ChatGPT/Adobe/M365/iCloud/VPN → `app-e-software` · Kindle/Audible →
`libri-e-audiolibri` · palestra → `sport-e-fitness` · Game Pass/PS Plus → `videogiochi` ·
Deliveroo Plus → `take-away-e-delivery` · HelloFresh/NaturaSì → `bio-vino-e-gourmet` · beauty box →
`cura-della-persona` · ATM/Trenord → `mezzi-pubblici` · fibra → `telefono-e-internet` · 5
`assicurazione-*` · canone conto → `commissioni-e-canone-conto` · Duolingo/MasterClass → `corsi` ·
box animali → `cura-animali`.

## Vincoli per il futuro — la lente competenza

Desiderata: un giorno l'annuale spalmato **anche nella dashboard**, sotto la lente competenza di v2.9.
Costo stimato durante il grill, leggendo lo schema:

| pezzo | costo |
|---|---|
| Seam `ledger_entry` (rate in `UNION ALL`) | **zero** — fatto in v2.9 (ADR 0019 §10) |
| I 10 siti di aggregazione | **zero** — leggono `ledger.amount` |
| Selettore anno/mese lens-aware | **zero** — fatto in v2.9 |
| Suite di regressione byte-identical | **zero** — esiste (v2.8) |
| Eccezione al detach di ADR 0019 §1 (discriminante `origin` sul piano) | piccolo |
| Creazione automatica del piano al rinnovo, dentro l'import | medio |
| Audit del codice che assume "l'Expense di un piano è Standalone" (`amortization-guards.ts`) | medio — **è il rischio vero** |

**L'80% costoso è già pagato da v2.9.** Il reperto che lo rende possibile:
`amortization_instalment.expenseId` ha in schema il commento *"always points at the plan's Standalone
Expense — category derives via that Expense"*. Se un piano da abbonamento **non stacca**, quell'
`expenseId` punterebbe alla Expense condivisa di Netflix e **la categoria deriverebbe correttamente lo
stesso**; le rate di tutti gli anni atterrerebbero sulla stessa Expense. Lo schema regge già così.

**VINCOLO BLOCCANTE per chi implementa SEED-004:** se un giorno servirà la lente, le rate dovranno
essere righe **`amortization_instalment`**. **Non costruire una tabella di rate parallela.** Se lo
fai, quello zero in colonna diventa un porting.

Dettaglio da annotare: v2.9 mette il resto di arrotondamento sulla **prima** rata (€1000/3 → 333,34 ·
333,33 · 333,33); il Costo mensile equivalente in lettura fa una divisione secca. Passando alla lente,
i centesimi si spostano.

## Open Questions (da chiudere in discuss/plan)

1. **Cadenza dichiarata o stimata?** Il rilevatore la stima dagli intervalli; l'utente la conferma o
   la corregge? E cosa succede se gli addebiti reali smettono di rispettarla?
2. **Cambio prezzo** (Netflix aumenta da €17 a €19): stesso abbonamento con `expectedAmount`
   aggiornato, o serve uno storico del prezzo per rendere onesto il totale annuo retrospettivo?
3. **Re-ancoraggio quando una Expense entra in un gruppo.** Non è stato trovato codice che ri-ancori
   un `reimbursement` in quel caso — **è un bordo già aperto nel codice spedito** (verificare in
   plan-phase) e `subscription` lo erediterebbe copiando il pattern XOR.
4. **La sezione segue la lente cassa/competenza?** ADR 0019 lasciò identica domanda aperta per
   `/tags` e `/dashboard/tags` (Consequences, punto 4). Probabile risposta: lens-invariant, dato che
   il Costo mensile equivalente è già una normalizzazione sua.
5. **Tipologia obbligatoria alla creazione**: se nullable, il bucket "Senza tipologia" diventerà il
   gruppo più grande e il raggruppamento perde senso. Serve un default suggerito dalla sottocategoria
   dell'ancora, oppure NOT NULL con una voce "Altro".
6. **Quali ~60-100 icone spedire**, e il fallback per la coda lunga.
7. **Quante tipologie di sistema seedare** e quali (la lista stretta di D05).

## Interazione con gli altri seed

- **[[SEED-002]] (Warikan)** — sovrapposizione reale sugli abbonamenti condivisi. Qui il condiviso è
  modellato via rimborso ADR 0018 (D12). Se Warikan arriva prima, va deciso se un abbonamento diviso
  con gli amici passa dai saldi interpersonali di Warikan invece che dal rimborso — **non entrambe**,
  o si doppio-conta. Leggere questo seed prima di pianificare Warikan.
- **[[SEED-003]] (vocabolario nature da DB)** — nessun conflitto diretto, ma D09 legge `nature` per
  il raggruppamento essenziale/discrezionale: se SEED-003 viene eseguito, verificare che l'allowlist
  resti valida.
- **[[SEED-001]] (modalità semplice/avanzata)** — nessuna interazione nota.

## Breadcrumbs

- `lib/db/schema.ts:387-423` — `expense`, con `UNIQUE (user_id, description_hash)` a riga 420
- `lib/db/schema.ts:424` — `transaction`, **senza** `subCategoryId`: la categorizzazione vive sulla Expense
- `lib/db/schema.ts:464-508` — `expense_group` + membership con `unique(expenseId)`
- `lib/db/schema.ts:521` — `reimbursement`, il pattern d'ancora XOR da copiare
- `lib/db/schema.ts:659,692` — `amortization_plan` / `amortization_instalment` (nota il commento su `expenseId`)
- `lib/db/schema.ts:172` — `sub_category` con `userId` nullable: il modello sistema+utente da copiare per `subscription_type`
- `lib/actions/categories.ts:193` — `createSubcategoryAction`, precedente d'uso
- `CONTEXT.md:23` — *"merchant/esercente (non è un'anagrafica)"*
- `CONTEXT.md:60` — regola madre della categorizzazione (per scopo, non per esercente)
- `CONTEXT.md:206` — Mese Coperto, il vincolo che governa D07
- `CONTEXT.md:213` — Ritmo, il nome da **non** riusare
- `CONTEXT.md:222` — i contributi sommano esattamente: il vincolo che governa D04
- `CONTEXT.md:248` — Piano (ammortamento), il nome da **non** riusare per il tier SaaS
- `.planning/STATE.md:567,696` — SUBS-VIEW, il deferred che questo seed sostituisce
- `.planning/nature-remapping-WORKING.md:26,91,114,119` — la categoria "abbonamenti" dissolta in v2.0 e il merge di `streaming`
- `scripts/seed-data.ts:817,825,745,513` — `streaming`, `app-e-software`, `take-away-e-delivery`, `telefono-e-internet`
- ADR 0002 (pattern suggestion), 0003 (nature a livello sottocategoria), 0009/0010 (filtri tabella),
  0015 (platform moderata), 0016 §2-§4 (Standalone Expense), 0017 §2/§4 (Expense Group),
  0018 (rimborsi 1:N), 0019 §1/§7/§9/§10 (ammortamento)

## Notes

Sessione di grill del 2026-08-06 (`/grill-with-docs`, 11 decisioni messe all'utente una per volta).
Due riformulazioni richieste dall'utente hanno cambiato materialmente l'esito: la prima ha stabilito
che la sezione Abbonamenti è uno spazio analitico **fuori dal contesto del budgeting** (che è ciò che
rende accettabile il secondo asse), la seconda ha chiesto la ricerca sullo spazio reale degli
abbonamenti, il cui risultato ha invece **confermato** che la tassonomia copre 19 casi su 23.

L'errore che ha richiesto più lavoro a smontare — e che vale la pena non rifare — è stato assumere
che la sezione aggregasse **sulle sottocategorie**. Aggrega **sulle subscription**: la tabella è il
filtro, la sottocategoria è solo l'etichetta.
