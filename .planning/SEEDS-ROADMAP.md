# Roadmap operativa dei seed

> Snapshot del **2026-08-07**, dopo `v3.1.1`. Copre i cinque seed piantati fino al 2026-08-06
> (`SEED-001` … `SEED-005`, tutti `status: dormant`). Non è un impegno: è l'ordine che
> massimizza beneficio su costo **allo stato attuale del codice**. Da rileggere ogni volta che
> si pianta un seed nuovo o che una milestone cambia le carte.

## Come è stata costruita

Due assi, applicati leggendo i cinque seed per intero e verificando le loro affermazioni sul codice:

- **Utilità** — quante domande reali dell'utente sblocca, e se colma un buco di **dato mancante**
  (peggiore) o di **analisi mancante** (meno grave).
- **Semplicità** — superficie toccata, e soprattutto se tocca **codice già spedito**. Una feature
  additiva grande batte una feature piccola che riapre il read layer della dashboard.

Un fatto che ha spostato la classifica: `v3.1.1` (quick task `260806-lod`) ha allineato il path
manuale al get-or-create per `descriptionHash`, **pagando in anticipo il prerequisito più rischioso
di SEED-005**. `insertManualTransactionTx` è ora `userId`-esplicito, tx-composable e con semantica di
aggregazione unica: un secondo canale di scrittura lo consuma così com'è, quindi l'estrazione di
`lib/services/manual-entry.ts` (SEED-005 D18) **non è più un prerequisito** — diventa opzionale.

## Valutazione

| Seed | Utilità | Semplicità | Nota che decide il punteggio |
|---|---|---|---|
| **[[SEED-005]]** Bot Telegram | Alta | Media | L'unico che chiude un buco di **dato mancante**: il contante oggi non esiste nel modello (`contante` è sottocategoria `transfer`, esclusa dai totali). Zero modifiche al read layer, parser deterministico, prerequisito già pagato da `v3.1.1` |
| **[[SEED-004]]** Abbonamenti | Alta | Media | «La Expense **è già** l'abbonamento» — `unique(user_id, description_hash)`: nessun codice di riconoscimento del rinnovo, nessun detach, **nessuna modifica al seam `ledger_entry`** né ai siti di aggregazione. Grande in superficie, economico in profondità |
| ~~**[[SEED-003]]** Vocabolario nature da DB~~ | — | — | **Chiusa il 2026-08-07 (`rejected`).** Il sottoinsieme che valeva è stato raccolto (quick task `260807-l2c`, era un bug visibile); la tesi DB-driven è stata confutata con una misura sul compilatore |
| **[[SEED-001]]** Modalità semplice/avanzata | Media | Media | Ottimizza l'onboarding di utenti **che non esistono ancora**; per un utente avanzato il valore è ~0. Collide con 004 (tipologie) e 002 (categorizzazione della quota imputata) |
| **[[SEED-002]]** Warikan | Alta | Bassa | 6 tabelle, 2 nature nuove + 1 rename, terzo branch nella view accrual, e un sottosistema di propagazione cross-user con una Open Question architetturale **ancora aperta** (OQ1) |

## Sequenza

### 1. ~~Quick task — pulizia dei codici nature morti~~ — ✅ FATTO il 2026-08-07

> Eseguito come quick task **`260807-l2c`** (commit `8390805d` + `7420b5f9`). Si è rivelato **un bug
> visibile**, non debito estetico: `?nature=savings` e `?nature=investment` erano scartati in
> silenzio su `/transactions` e `/expenses`, quindi due nature su otto non filtravano. Risolto con
> `NATURE_FILTER_VALUES` derivato da `FLOW_NATURE_MEMBERS: Record<FlowNature, true>` (esaustività a
> compile-time provata: una nona nature fa fallire `tsc`), le due copie locali cancellate, matrice di
> test 9 accettati × 2 parser + 4 rifiutati × 2 parser.
>
> **[[SEED-003]] è chiusa come `rejected`**: la sua tesi (vocabolario da DB) è stata confutata con
> una misura — aggiungendo una nona nature, `tsc` falliva già in `dashboard.ts:863` e in tre
> `Record<FlowNature, …>`, cioè il compilatore proteggeva già quasi tutto e l'array scritto a mano
> era l'unico buco. Il documento resta come verbale della bocciatura, non va pianificato.

<details>
<summary>Descrizione originale del passo (per storia)</summary>

**Cosa:** rimuovere `operational` / `financial` / `extraordinary` da `NATURE_ALLOWED`
(`lib/validations/transactions.ts:155-166`) e dal secondo elenco letterale
(`lib/validations/category.ts:38-47`), **mantenendo** gli alias legacy per gli URL già salvati.

**Cosa NON fare:** il refactor DB-driven completo di SEED-003. Il seed stesso dimostra che risparmia
~1 punto su 6 da toccare quando si aggiunge una nature, e in cambio si perde l'esaustività del
compilatore — una nature nuova verrebbe renderizzata senza icona e senza chip, **in silenzio, in
produzione**.

**Perché primo:** sia 004 (legge `nature` per il raggruppamento essenziale/discrezionale) sia 002
(aggiunge 2 nature + 1 rename) toccano quelle liste. Aggiungere voci a un elenco che contiene già tre
codici morti è costruire su un pavimento sporco.

**Entry point:** `/gsd-quick` · **Stima:** mezza giornata

</details>

---

### 2. Milestone v3.2 — Bot Telegram (SEED-005) ← **prossimo**

**Ordine interno:**
1. Migration: `transaction.source` (`import|manual|telegram`) + backfill `fileId IS NULL → 'manual'`, `telegram_account`, `telegram_draft`
2. Servizio bot puro: parser deterministico, cascata dei suggerimenti, gestione bozze — unit-testabile senza HTTP
3. Route webhook sottile + client `fetch` a 4 metodi (`sendMessage`, `editMessageText`, `answerCallbackQuery`, `setWebhook`)
4. Screen di collegamento e revoca in `/settings`
5. ADR 0021 + le due voci `CONTEXT.md` (allegati A e B del seed, testo già pronto)

**Perché prima di 004:** il payoff è immediato e personale (registri il caffè e l'app smette di
mentire sul contante), il perimetro è chiuso da 22 decisioni già bloccate, e **non tocca nessuna
superficie condivisa** — è il rischio di regressione più basso del gruppo su ciò che è già spedito.

**Da chiudere prima di pianificare:** le 11 Open Questions del seed. Le due che possono cambiare
delle scelte: il fallback quando `user.timezone` è `null` (la data della spesa dipende da quello) e
la registrazione del webhook per ambiente (dev/staging/prod hanno URL diversi).

**Entry point:** `/gsd-new-milestone` · **Stima:** ~3-4 fasi

---

### 3. Quick task — rename `user.subscriptionPlan` → `user.accountTier`

**Cosa:** 58 occorrenze in ~20 file, di cui **12 sono test** (sostituzione meccanica), più una
migration di rename e il campo custom in `auth.ts`. La superficie di produzione è piccola:
`lib/db/schema.ts`, `lib/dal/users.ts`, `lib/actions/*`, due pagine.

**Perché separato dalla milestone 004:** è il prerequisito bloccante di quella milestone, ma non ha
nulla a che vedere con il dominio abbonamenti. Mescolare un rename meccanico con decisioni di
prodotto rende ambiguo ogni conflitto di merge e impossibile una revert chirurgica.

**Vincolo sul nome:** non usare `plan` — **Piano** è già un termine di glossario (il piano di
ammortamento, `CONTEXT.md:248`).

**Entry point:** `/gsd-quick` · **Stima:** un giorno

---

### 4. Milestone v3.3 — Abbonamenti (SEED-004)

Chiude `SUBS-VIEW`, deferred dal 2026 (`STATE.md:567,696`, origine ADR 0016).

**Da verificare PRIMA di pianificare** — è la cosa che può far crescere lo scope:
- **OQ3, re-ancoraggio quando una Expense entra in un gruppo.** Il seed sospetta che sia **un bordo
  già rotto nel codice spedito** su `reimbursement` (nessun codice trovato che ri-ancori). Se è
  rotto lì, `subscription` lo eredita copiando il pattern XOR: va accertato prima, non durante.
- **OQ5, tipologia nullable.** Se lo è, "Senza tipologia" diventa il bucket più grande e il
  raggruppamento perde senso. Serve un default suggerito dalla sottocategoria dell'ancora, oppure
  `NOT NULL` con una voce "Altro".

**Tensione da mettere in un ADR, non da far scivolare dentro:** la tipologia è un **secondo asse di
classificazione**, locale alla sezione e deliberatamente non riconciliato col budget. Sarà ~90%
ridondante con la sottocategoria e riseparerà distinzioni che v2.0 aveva fuso di proposito
(`streaming-video` / `streaming-musica`). Guadagna davvero solo dentro `app-e-software` e sui quattro
orfani (editoria digitale, Amazon Prime multi-scopo, membership a un creator, dating).

**Entry point:** `/gsd-new-milestone` · **Stima:** ~4-5 fasi · **Prerequisito:** passo 3

---

### 5. Warikan locale — SEED-002 parte (a), solo se lo si vuole davvero

Il seed si divide già da sé: punti **1-4** (tassonomia, schema + terzo branch, UI lato pagante, quota
imputata) sono utili e coerenti **da soli**; punti **5-6** (amicizia, inbox, propagazione cross-user)
sono "il vero rischio", con la OQ1 architetturale ancora aperta.

**Fare solo (a).** E **solo dopo 004**: è il seed di 004 a imporlo — se un abbonamento condiviso
passa dai saldi interpersonali di Warikan **e** dal rimborso ADR 0018, si **doppio-conta**. La
decisione va presa con la sezione Abbonamenti già in mano, non prima.

**Entry point:** `/gsd-new-milestone` (dopo aver riletto SEED-004) · **Stima:** milestone grande

## Cosa resta fuori, e perché

- **SEED-001 adesso.** È l'unico la cui utilità dipende da utenti che non esistono: risolve la
  complessità percepita da un principiante. Peggio: se arriva prima del bot, si riscrive la tastiera
  a 6 scorciatoie di SEED-005 (la modalità semplice cambia *come* si categorizza) e si riapre
  l'aggregazione dashboard in almeno 3 punti (`category-ranking-list`,
  `lib/dal/category-detail-year-window.ts`, breakdown per sottocategoria). Resta dormant fino al
  primo utente reale che si lamenta del picker.
- **SEED-003 nella forma completa.** Vale il ~10% (passo 1); il resto costa più di quanto rende.
- **Il ponte cross-user di Warikan** (SEED-002 punti 5-6). È un prodotto sociale dentro un'app di
  finanza personale, e nessuna delle altre quattro voci ne dipende.

## Cosa farebbe cambiare questa classifica

- **Il primo utente reale non-Andrea si lamenta del picker** → SEED-001 sale davanti a 004.
- **Arriva un canale che scrive senza un umano che possa ripetere** (API pubblica, inserimento in
  blocco) → sale il fix della finestra di gara sul get-or-create dell'Expense, oggi limite noto
  accettato in SEED-005 (`onConflictDoNothing` + re-select, mai try/catch né retry).
- **Si adotta il billing** (`@better-auth/stripe`, oggi non installato) → il rename del passo 3
  diventa urgente e va fatto **prima** che lo schema di Better Auth introduca la sua tabella
  `subscription`.
- **Si pianifica Warikan prima di Abbonamenti** → prima va deciso quale dei due meccanismi possiede
  gli abbonamenti condivisi, altrimenti il doppio conteggio è strutturale, non un bug.

## Riferimenti

- Seed: `.planning/seeds/SEED-001-simple-advanced-expense-mode.md` · `SEED-002-warikan-spese-condivise.md` · `SEED-003-nature-vocabulary-db-driven.md` · `SEED-004-abbonamenti.md` · `SEED-005-telegram-capture-bot.md`
- `v3.1.1` (merge commit `4335a315`, quick task `260806-lod`) — l'allineamento del path manuale che ha ridotto lo scope di SEED-005
- `.planning/STATE.md:567,696` — `SUBS-VIEW`, il deferred che SEED-004 sostituisce
- ADR 0016 (netting per sottocategoria) · 0017 (Expense Group) · 0018 (rimborsi 1:N) · 0019 (ammortamento e lente competenza) — i quattro ADR con cui ogni seed di questa lista deve fare i conti
