# Prompt / Brief — Landing page pubblica di Sparter

> Documento autosufficiente da passare all'agent che costruirà la landing page.
> Contiene: mandato, vincoli tecnici, inventario feature verificato sul codice, differenziatori,
> struttura di pagina consigliata, design system, e regole di copy con lista nera dei termini.
>
> Fonti verificate: `CONTEXT.md`, `CLAUDE.md`, `.planning/PROJECT.md`, `.planning/MILESTONES.md`,
> `.planning/REQUIREMENTS.md`, `docs/adr/0001…0019`, `app/(app)/**`, `app/globals.css`,
> `scripts/seed-data.ts`, `lib/config/categorization.ts`, `proxy.ts`.
> Data di raccolta: 2026-07-28.

---

## 0. Mandato

Costruisci la **landing page pubblica di Sparter**: una pagina marketing long-form, in italiano,
che presenta il prodotto a un visitatore non autenticato e lo porta alla registrazione.

- **Formato**: route Next.js dentro questo repo, coerente col design system esistente (Tailwind v4 + shadcn/ui).
- **CTA primaria**: `/register` ("Crea il tuo account" / "Inizia gratis").
- **CTA secondaria**: `/login` per chi ha già un account.
- **Ampiezza**: long-form — hero, problema, feature per area, differenziatori, come funziona, piani, FAQ, CTA finale.
- **Pricing**: mostra i tre piani e le differenze funzionali, **senza prezzi** (vedi §7 — la monetizzazione non è implementata).

Non modificare l'app autenticata. La landing è additiva.

---

## 1. Vincoli tecnici (leggere prima di scrivere codice)

### 1.1 Routing — c'è un conflitto da risolvere

Oggi `app/page.tsx` è solo `redirect('/dashboard')` e `proxy.ts` protegge tutto tranne
`PUBLIC_ROUTES = ['/login', '/register']` e `/proto/*`. Quindi:

1. La landing va servita su `/` (raccomandato) come route group non autenticato, es. `app/(marketing)/page.tsx`.
   Rimuovi/sostituisci l'attuale `app/page.tsx` di redirect.
2. **`proxy.ts` va aggiornato** per rendere `/` una rotta pubblica (aggiungila a `PUBLIC_ROUTES`),
   altrimenti un visitatore anonimo viene rediretto a `/login` e la landing non si vede mai.
3. **Utente già loggato su `/`**: fai `redirect('/dashboard')` lato server nella page
   (usa lo stesso helper di sessione già in uso in `app/(app)/layout.tsx`), così non perdi il
   comportamento attuale per chi è autenticato. Non replicare il check nel proxy.
4. La landing **non deve** entrare nel gruppo `(app)`: quel layout richiede sessione, monta la
   sidebar e applica il gate onboarding. Serve un layout marketing proprio.

### 1.2 Regole di progetto non negoziabili che ti riguardano

- **Slug di route in inglese.** Se la landing avrà sotto-pagine o anchor, usa slug inglesi
  (`/pricing`, `#features`). Il copy è italiano, gli URL no.
- **Nessun asset esterno.** Non aggiungere dipendenze, font o immagini remote. Font disponibili:
  Geist e Geist Mono già configurati in `app/fonts.ts`.
- **Niente screenshot inventati.** In `public/` non esiste nessuna immagine di prodotto e non
  esiste un logo: c'è solo il **wordmark testuale "Sparter"** e i default di Next
  (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`). Le illustrazioni vanno
  costruite in CSS/SVG inline o come mock statici in JSX (numeri finti realistici, formattati
  in `it-IT`). **Non promettere una UI che non esiste** e non fabbricare recensioni, loghi di
  banche partner o testimonial.
- **Metadata**: aggiungi `title` + `description` + Open Graph. Non esiste immagine OG: se ne
  vuoi una, generala con `next/og` (ImageResponse) partendo dal wordmark e dai token colore.
- **`yarn check:language`** deve passare: identificatori, nomi file, commenti e nomi dei test in
  inglese; l'italiano vive solo nelle stringhe di copy rivolte all'utente.
- **Aritmetica monetaria**: se mostri numeri di esempio, sono stringhe di copy statiche — non
  serve Decimal.js, ma formatta come `it-IT` (`1.234,56 €`).
- **Workflow**: questa è una feature nuova. Prima di scrivere codice, passa da un entry point GSD
  (`/gsd-plan-phase` per la versione completa, `/gsd-quick` se il lavoro viene ridotto a una
  singola pagina). Vedi `CLAUDE.md` § Workflow enforcement.

### 1.3 Accessibilità e responsive

- Mobile-first. La sidebar non esiste in landing: navigazione marketing propria (header sticky
  leggero con wordmark + link ancora + CTA).
- Tema chiaro/scuro: **entrambi obbligatori**. Il dark mode è class-based (`next-themes`,
  `defaultTheme="system"`). Usa **solo token CSS** (`bg-background`, `text-foreground`,
  `border-border`, `text-primary`…) — nessun colore hardcoded, nessun `slate-*` letterale.
  Regola già in vigore nel repo.
- Contrasto AA, focus ring visibile (il Button shadcn usa già `focus-visible:ring-[3px] ring-ring/50`),
  heading hierarchy corretta, `prefers-reduced-motion` rispettato per qualunque animazione.

---

## 2. Chi è l'utente e qual è la promessa

### 2.1 Core value (da `.planning/PROJECT.md`)

> "L'utente può importare in sicurezza transazioni bancarie reali, vedere dove vanno i suoi soldi
> categorizzati per mese, e individuare immediatamente le deviazioni rispetto alla sua spesa di riferimento."

Tre promesse in ordine — **la landing deve seguire questa progressione**:
**importare senza paura** → **capire dove vanno i soldi** → **accorgersi subito di cosa è cambiato**.

### 2.2 Target

Un utente italiano, **finanziariamente alfabetizzato**, che:

- ha **più conti e più carte** (Intesa SP, Revolut, Fineco, Satispay, Trade Republic, Crypto.com);
- **investe** (ETF, PAC, cripto, fondo pensione);
- **condivide spese** con amici (abbonamenti, cene divise, vacanze);
- fa **acquisti grossi occasionali** (il portatile da €2.400);
- è **infastidito dall'imprecisione** delle app esistenti — non cerca gamification o badge,
  cerca numeri che tornano.

### 2.3 Cosa Sparter non è (fuori scope dichiarato — non prometterlo)

Account multi-utente/famiglia · app mobile nativa · modalità offline · SSO/SAML ·
**open banking / sincronizzazione automatica dei conti**.

### 2.4 Il punto più delicato del posizionamento

Sparter è **import-based, non open-banking**: i dati riflettono l'ultimo file caricato.
`CONTEXT.md` è categorico e **vieta la parola "sincronizzazione"**.

**Gira il vincolo in vantaggio**, non nasconderlo:
> "Nessuna credenziale bancaria, nessun accesso ai tuoi conti. Scarichi l'estratto dalla tua banca
> e lo carichi qui. I tuoi soldi restano dove sono."

---

## 3. I differenziatori — la spina dorsale del copy

Questi sono i cinque angoli su cui la pagina si gioca. Non sono feature, sono **posizioni**.
Ognuno nasce da un ADR reale, quindi è difendibile.

### 3.1 "Il + sul conto non è un guadagno" (ADR 0012, 0004)

Le app classiche dividono il mondo in due colonne: positivo = entrata, negativo = uscita.
È una scorciatoia sbagliata. Il segno è un dato grezzo della banca; il **significato economico**
è un'altra cosa. Sparter ragiona su **quattro direzioni**, dedotte dallo scopo della sottocategoria:

| Direzione (label UI) | Effetto sul patrimonio | Trattamento |
|---|---|---|
| **Entrate** | aumenta | tra le entrate |
| **Uscite** | diminuisce (consumo reale) | tra le uscite |
| **Accantonato / Investito** | neutro, ma comportamento da misurare | blocco a parte, **fuori dalle uscite** |
| **Trasferimenti** | neutro e rumore analitico | escluso e nascosto |

Tabella pronta per un'infografica (da `CONTEXT.md`, "direzione ≠ segno"):

| Movimento | Segno | Direzione | Perché |
|---|---|---|---|
| Stipendio | + | Entrata | denaro nuovo |
| Reso di una spesa | + | Uscita | spesa annullata, non guadagno |
| Vendita di un tuo ETF | + | Accantonato | asset → liquidità, neutro |
| Accredito da un tuo conto | + | Trasferimento | era già tuo, rumore |

**Claim**: *Sparter non ti gonfia le uscite.* Mettere 500 € in un deposito non è una spesa —
il tuo patrimonio non è cambiato. Le app che lo contano come spesa ti raccontano una bugia
sistematica su quanto consumi davvero.

**Aneddoto citabile** (ADR 0012): nelle versioni precedenti la vendita di un proprio ETF compariva
**tra le uscite**, perché il modello aveva due assi che si contraddicevano. La risposta non è stata
una pezza: la direzione non è un dato in più, è una proprietà della natura del flusso. Una sola
fonte di verità.

### 3.2 "La quarta direzione": misurare le cose buone (ADR 0012)

Un giroconto e un accantonamento sono contabilmente identici (entrambi neutri). Ma il giroconto è
**rumore da nascondere**, l'accantonamento è **un comportamento positivo che vuoi vedere**.
Nessuna app fa questa distinzione in modo esplicito. Da qui il blocco **"Accantonato / Investito"**,
mai confuso col consumo.

Corollario elegante: **disinvestire non è guadagnare.** Investi 800 e disinvesti 300 → allocazione
netta +500. Solo il denaro **nuovo dall'esterno** (bonus, eredità, vincite, cashback) è
un'entrata straordinaria.

### 3.3 "La vita non è 1:1" (ADR 0017, 0018, 0016)

| Caso reale | Uscite | Rientri | Come lo risolve Sparter |
|---|---|---|---|
| Ordine online con reso | 1 | 1 | rimborso collegato, netta sulla spesa |
| **Cena divisa tra amici** | 1 | **N** | rimborsi 1:N con **residuo** ("ti devono ancora 25 €") |
| **Vacanza divisa** | **N** | M | gruppo di spese come ancora |
| **Lo stesso bar visto da 3 carte** | 3 righe | — | **Unisci** in un gruppo di spese, i dati restano intatti |
| **Un portatile pagato ad agosto e usato 3 anni** | 1 | — | ammortamento + lente per competenza |

Tre scelte forti sui rimborsi:
1. **L'ancora è sempre l'uscita** — è una regola di *ruolo*, non di tempo: un amico che ti anticipa i
   soldi *prima* della spesa si attacca comunque all'uscita.
2. **L'ancora può essere una spesa o un gruppo di spese** — una cena è una spesa, una vacanza è un gruppo.
3. **Il residuo è un concetto di prima classe** — mostrato finché è negativo, e **calcolato al volo, mai memorizzato**.

### 3.4 "Riconciliabile con l'estratto conto, sempre"

Questa è la promessa di fiducia più potente per una landing di finanza personale:

- **Nessuna transazione inventata.** Nemmeno chiudendo un ammortamento con una vendita.
- **Nessuna descrizione riscritta.** Rinominare crea un titolo personalizzato; il dato bancario
  originale resta immutato, e il re-import continua a riconoscere il duplicato.
- **Nessun aggregato scrivibile.** Unire spese, taggare, ammortizzare, collegare rimborsi sono
  **letture** diverse, non riscritture. Sciogli un gruppo e torni esattamente allo stato precedente
  **per costruzione**, non per attenzione.
- **Aritmetica esatta al centesimo** su ogni importo.

### 3.5 "Preferiamo il gesto esplicito all'euristica che sbaglia"

- **Nessuna unione automatica all'import**: un falso positivo (unire due esercenti diversi) costa più
  del gesto manuale.
- **Nessuna soglia automatica di ammortamento**: decidi tu cosa spalmare e su quanti mesi.
- **Nessuna regola permanente per mittente**: la stessa descrizione bancaria significa
  legittimamente cose diverse in mesi diversi — nessuna regola singola sarebbe corretta.
- **La deviazione non grida al lupo**: baseline sui **3 mesi precedenti** (la finestra più corta che
  smussa gli outlier restando recente) e **soglia di rumore a 15 €** sotto la quale una
  sottocategoria è esclusa, così le micro-spese non generano percentuali assurde.

---

## 4. Inventario feature — verificato sul codice

Legenda: **SHIPPED** = in produzione · **IN CORSO** = milestone v2.9 attiva · **PIANIFICATO** = non ancora costruito.

> **Regola per la landing**: descrivi al presente **solo le voci SHIPPED**. Le voci PIANIFICATO
> possono comparire, se vuoi, in una sezione "In arrivo" chiaramente separata — mai nel corpo delle feature.

### 4.1 Dashboard e analisi — SHIPPED

- **Overview annuale** (`/dashboard/overview`): grafico a barre raggruppate Entrate/Uscite mese per
  mese + 4 KPI: **Entrate**, **Uscite**, **Bilancio** (con sparkline del netto mensile e
  "Tasso X% · obiettivo 20%"), **Accantonato**. Ogni KPI mostra il delta sull'anno precedente e una
  "riga di lettura" in italiano che interpreta il numero. Selettore anno in testa.
  *Beneficio*: capire in un colpo d'occhio se quest'anno va meglio dell'anno scorso e quanto resta davvero da parte.
- **Chip di filtro per natura del flusso**: lato entrate (**Entrate ricorrenti**, **Straordinaria**),
  lato uscite (**Essenziale**, **Discrezionale**, **Debiti**), con popover ⓘ educativi.
  *Beneficio*: separa l'inevitabile dalla scelta — la leva su cui si può davvero agire.
- **Drill-down "Dove hai speso di più" / "Dove hai risparmiato"**: clicchi una barra e vedi gli
  scostamenti principali rispetto al mese precedente, con copy umanizzato e la dicitura
  **"spesa nuova"** quando prima era zero. Da lì salti alla lista transazioni già filtrata.
  *Beneficio*: trasforma un grafico in una spiegazione.
- **Deviazione**: badge con la differenza percentuale tra la spesa dell'ultimo periodo di riferimento
  e la **baseline** (media dei 3 mesi precedenti).
  *Beneficio*: le anomalie si segnalano da sole, senza confrontare colonne a mano.
- **Categorie** (`/dashboard/categories`, `/dashboard/categories/[id]`): classifica per spesa, barra di
  composizione, sparkline, breakdown per sottocategoria, principali transazioni. Ordinamento di
  default per deviazione.
- **Tag** (`/dashboard/tags`): totali indipendenti per ogni tag, all-time.
- **Nudge non categorizzati**: banner quando esistono transazioni senza categoria; chiudibile, ma
  ricompare se il numero cresce. *Beneficio*: i numeri valgono solo se i dati sono categorizzati.

### 4.2 Transazioni — SHIPPED

- **Lista** (`/transactions`): Data, Transazione, Importo, Categoria, Sorgente, Spesa collegata.
  Ricerca libera (che matcha anche il titolo di un gruppo), filtri per mese, intervallo di importo,
  categoria, stato di categorizzazione, tag; ordinamento su ogni colonna. **Filtri e ordinamento
  vivono nell'URL** (link condivisibili) e **si ripristinano tornando indietro** da una pagina di dettaglio.
- **Azioni di riga**: Dettagli · Categorizza · Collega rimborso · Spesa a sé · Ammortizza ·
  Cerca su internet · Elimina. **Selezione multipla** per tag, categorizzazione ed eliminazione in blocco.
- **Pagina di dettaglio** (`/transactions/[id]`): importo, data, titolo, categoria, note — tutto
  modificabile **a matita in linea**, senza dialog. Rimandi incrociati a spesa, file di origine,
  rimborso e tag.
- **Guardia di integrità**: modificare un importo che romperebbe un rimborso collegato viene
  **bloccato con messaggio esplicito**, mai scollegato in silenzio.
- **Inserimento manuale** di una transazione (contanti, o spese da ammortizzare non presenti in estratto).

### 4.3 Spese — SHIPPED

- **Lista** (`/expenses`): le transazioni in uscita raggruppate automaticamente per esercente —
  invece di 40 righe "ESSELUNGA" vedi una voce con totale e numero di transazioni.
  Filtri per categoria, stato (**Categorizzate** / **Da categorizzare**), periodo; ordinamento per
  totale o data. *Beneficio*: categorizzi una volta e vale per tutte.
- **Dettaglio** (`/expenses/[id]`): periodo, totale, piattaforma, file di origine, "Parte di" (gruppo),
  transazioni collegate, titolo e note in linea.
- **"Spesa a sé (non aggregare)"**: stacca una transazione dall'aggregazione per descrizione — diventa
  una spesa singola con titolo e categoria propri, esclusa anche dall'apprendimento storico.
  L'isolamento è **per quella singola transazione**.
  *Beneficio*: risolve il caso reale degli accrediti da persone — lo stesso mittente ti paga
  l'abbonamento condiviso un mese e la cena l'altro; la descrizione non è una chiave affidabile.

### 4.4 Gruppi di spesa — SHIPPED

**Unisci / Scomponi** (`/expenses/groups/[groupId]`): selezioni più spese che sono **lo stesso
esercente visto da carte diverse** (`Cherasco 57` / `CHERASCO 57` / `Cherasco 57 SRL`) e le unisci in
un gruppo con titolo proprio e **una sola categoria**. Il gruppo è l'unità di categorizzazione:
ricategorizzi una volta e vale per tutti i membri. **Scomponi** scioglie il gruppo; un gruppo con un
solo membro si scioglie da sé.

*Beneficio*: un esercente = un numero, anche pagato con tre strumenti. Le spese membro restano
intatte, il re-import continua a deduplicare, e **i totali della dashboard non cambiano mai** per
effetto di un raggruppamento.

### 4.5 Import di file bancari — SHIPPED

- **Flusso** (`/import`): carichi l'estratto, Sparter **riconosce la banca dalle intestazioni**, mostra
  un'anteprima (**Righe trovate**, **Duplicati**, **Piattaforma**, **Confidenza**) e scrive i movimenti
  **solo dopo conferma esplicita**. Lo storico traccia ogni file con stato, statistiche e mesi coperti
  (es. "Apr–Giu 2026").
- **Formati accettati**: `.csv`, `.xlsx`, `.pdf` — **max 5 MB**.
  ⚠️ Nel copy usa **5 MB**: lo step 1 dell'onboarding dice ancora "max 10 MB", è una discrepanza
  nota rispetto alla validazione reale (`lib/validations/import.ts`).
- **Deduplicazione automatica**: ogni riga ha un'impronta stabile — ricaricare un estratto che si
  sovrappone al precedente non crea duplicati, e l'impronta non cambia nemmeno se modifichi importo,
  data o titolo.
- **Wizard formato privato** (`/import/[fileId]/configure`): se il formato non è riconosciuto, mappi a
  mano le colonne (data, descrizione, descrizione secondaria opzionale, **una colonna importo** oppure
  **entrate e uscite separate**, separatore: virgola / punto e virgola / tabulazione / barra verticale).
  *Beneficio*: **nessuna banca è "non supportata"** — chi ha un tracciato esotico se lo configura una
  volta. Il formato personale resta **privato** anche su una piattaforma condivisa da tutti.
- **Import PDF**: template per-banca; legge solo la sezione dei movimenti del conto e scarta le
  sezioni-specchio per non doppio-contare; **valida la catena dei saldi** e blocca l'import con errore
  esplicito se qualcosa non torna. *Attualmente supportato per PDF: solo **Trade Republic**.*
  *Beneficio*: copre chi non offre un CSV, con una scelta deliberata — meglio nessun import che un
  import "quasi giusto" su dati finanziari.
- **Dettaglio file** (`/import/[fileId]`): nome modificabile, statistiche, anteprima transazioni,
  download dell'originale, eliminazione **con riepilogo di impatto** ("cosa spariscerà"), rilancio
  della scoperta regex.

**Piattaforme preconfigurate** — 8 piattaforme, 9 contratti di formato. Usa **questi nomi esatti**:

| Piattaforma | Formato preconfigurato |
|---|---|
| **Intesa SP** | CSV |
| **Intesa SP Carta Credito** | CSV |
| **Revolut** | CSV |
| **Fineco** | CSV (pulizia automatica del suffisso "Carta N. …") |
| **Satispay** | CSV |
| **Trade Republic** | **PDF** + CSV |
| **Crypto.com** | CSV |
| **General** | CSV generico catch-all |

### 4.6 Categorizzazione — SHIPPED

- **Tre livelli in cascata**: **Tier 1** regex sulle descrizioni (libreria di pattern di sistema già
  inclusa) → **Tier 2** storico personale (se hai già categorizzato quella descrizione, lo rifà) →
  **Tier 3** AI. Soggetti a gate di piano (§7).
  *Narrativa da usare*: **prima le regole, poi la tua storia, l'AI solo dove serve** — non
  "AI-powered" a spruzzo.
- **Selettore unificato di sottocategoria**: un unico controllo (bottom sheet trascinabile, chip per
  tipo, master-detail, ricerca, sezione "più usate") presente in **tutti e 7** i punti dell'app in cui
  si scegli una categoria. *Beneficio*: lo impari una volta e funziona ovunque.
- **Tassonomia inclusa**: **23 categorie**, **~87 sottocategorie**, 4 direzioni, 8 nature —
  già con una natura economica sensata, quindi **il grafico è utile al primo import, senza
  configurare niente**. L'utente può sovrascrivere.
- **Gestione categorie** (`/settings/categories`): tab **Entrate / Uscite / Accantonamenti /
  Trasferimenti**, badge **Sistema** / **Personale**; crei categorie e sottocategorie proprie,
  rinomini, sovrascrivi la natura economica di una sottocategoria.
- **Pattern personalizzati** (`/patterns`): crei una regola (espressione + descrizione +
  sottocategoria) che categorizza per sempre ogni movimento corrispondente.
- **Scoperta automatica di pattern** (`/import/[fileId]/suggestions`): dopo l'import Sparter analizza
  ciò che è rimasto senza categoria e propone (a) **famiglie di descrizioni ricorrenti** da cui nasce
  un pattern riutilizzabile e (b) **gruppi di transazioni identiche** da categorizzare in blocco.
  Accettando una proposta, **categorizza retroattivamente** tutto lo storico non categorizzato di
  quella piattaforma e ti dice quante righe ha sistemato.
  *Beneficio*: il sistema si insegna da solo guardando i tuoi dati; ogni "sì" ripulisce mesi di arretrato.

### 4.7 Tag — SHIPPED

- **Tag** (`/tags`): un secondo asse **ortogonale** alle categorie. Un viaggio a Lisbona include volo,
  cene, museo e farmacia — categorie diverse, un solo tag. Creazione, assegnazione in blocco,
  archiviazione (mai eliminazione).
  *Beneficio*: risponde a "quanto mi è costato **quell'evento**?", domanda che le categorie da sole
  non possono soddisfare.
- **Suggerimenti tag**: alla creazione di un tag e a ogni import, Sparter propone le transazioni cadute
  nell'intervallo di date del tag, da confermare in blocco. *Beneficio*: taggare un viaggio di 10
  giorni è un clic, non 40.
- **Pagina dedicata** (`/tags/[id]`): report **all-time** (un evento non ha "questo mese") con
  **Entrate**, **Uscite**, **Valore finale**, conteggio transazioni, breakdown **Per categoria** a barre,
  lista movimenti. *Beneficio*: un tag mostra **un solo set di numeri** in tutta l'app.
- **Filtro tag** nella lista transazioni + chip sulla riga con popover.

### 4.8 Rimborsi — SHIPPED

**Rimborsi** (`/reimbursements`, `/reimbursements/[id]`): colleghi **una spesa in uscita** a **uno o
più accrediti** che la rimborsano, con selettore ricercabile multi-selezione. Il netto atterra nel
mese del costo e Sparter mostra il **residuo** ancora da saldare con badge di stato
(da saldare / saldato / eccedenza). Pagina dedicata per ogni rimborso: titolo modificabile, netto e
stato in testa, link alla spesa ancorata, aggiunta/rimozione in loco.

*Beneficio*: la cena da 120 € anticipata per quattro amici non risulta più come 120 € di spesa tua:
vedi i 90 € rientrati e i 30 € che qualcuno deve ancora. **Un rimborso non è mai un'entrata** —
non gonfia il reddito.

Comportamenti fini da citare come prova di serietà:
- Il netto si distribuisce **proporzionalmente** su tutte le transazioni della spesa ancorata
  (non tutto sulla prima), quindi il breakdown per categoria resta onesto.
- L'**eccedenza** (ti hanno restituito più del dovuto) è uno stato reale mostrato, non un errore bloccato.
- **Reversibilità**: scollegare un rimborso ripristina lo stato precedente al collegamento,
  compresa la categorizzazione.
- Esiste anche il **netting senza collegamento**: un accredito categorizzato sotto la stessa
  sottocategoria della spesa netta per somma algebrica (10 ordini −1000 € + 4 resi +300 € su
  "shopping online" = −700 €). In lista vedi l'importo reale, nel grafico vedi il netto.
- **Onestà da dichiarare** (opzionale, in FAQ): il netto cade nel mese del costo, quindi collegare un
  rimborso in ritardo può cambiare retroattivamente un mese passato. È una scelta dichiarata.

⚠️ **Non citare**: l'ancoraggio di un rimborso su un **gruppo di spese** esiste nel motore ma
**non è esposto in UI**. Nel copy la vacanza-divisa va presentata come caso che il modello copre, non
come flusso cliccabile oggi.

### 4.9 Ammortamento — SHIPPED per l'attivazione e il ciclo di vita, PIANIFICATO per registro e lente

**SHIPPED**:
- **Ammortizza**: su una transazione in uscita scegli un numero di mesi e il costo viene ripartito in
  **N rate mensili uguali** a partire dal **mese dell'acquisto** (sul giorno-calendario della spesa,
  con aggancio a fine mese per i mesi corti; il resto di arrotondamento va sulla prima rata).
  Attivarlo stacca automaticamente la transazione in "spesa a sé", così un acquisto futuro con la
  stessa descrizione non finisce nel piano. Attivabile da riga, dettaglio, o inserimento manuale
  ("Crea e ammortizza"). Reversibile.
- **Chiudi ammortamento**: chiudi un piano prima della scadenza (tipicamente perché hai venduto il
  bene): le rate residue **collassano sul mese di chiusura**, quelle passate restano dove sono. Se
  c'è una vendita, colleghi la transazione reale di incasso e il **realizzo** netta sul mese di
  chiusura; chiudere senza transazione collegata = bene rottamato. Collegare un rimborso a un piano
  aperto riduce la base e ri-spalma proporzionalmente le rate rimanenti.
- **Garanzie**: la chiusura **non scrive mai una transazione finta**, e l'esistenza di piani
  **non altera di un centesimo** i numeri storici in vista per cassa. Modificare importo o data di
  una transazione ammortizzata è bloccato o riconciliato — un piano non può desincronizzarsi
  dalla sua spesa.

*Il problema in una frase, usabile come hook*: **un portatile da 2.400 € comprato ad agosto fa
esplodere agosto** — spara un alert "spesa nuova", distorce la deviazione del mese — anche se quel
valore lo consumi per anni, non ad agosto.

*Cosa NON è* (rilevante perché il termine è ambiguo): non è accantonamento verso una spesa futura,
non è il piano di ammortamento di un mutuo, non è deprezzamento di un asset.

**PIANIFICATO — non descrivere come esistente**:
- **Registro `/amortizations`**: ogni piano, aperto o chiuso, con importo iniziale, consumato, valore
  netto e mesi residui; chiusura direttamente dal registro.
- **Lente "Vista per cassa / Vista per competenza"**: un **unico switch globale** (accanto al selettore
  anno) commuta **tutti** i widget della dashboard — grafico, KPI, breakdown, movers, deviazioni —
  tra cassa (ogni movimento nel mese in cui la banca l'ha registrato) e competenza (costi ammortizzati
  spalmati sui mesi delle rate, anno intero incluse le rate future). Non è un filtro di un widget:
  è una **dimensione trasversale**.
  ⚠️ "cassa"/"competenza" sono **working label**: se la usi in una sezione "In arrivo", non trattarle
  come naming definitivo.

### 4.10 Onboarding — SHIPPED

Percorso guidato in **5 step** per chi non ha ancora nessuna transazione:
**1.** "Il tuo primo estratto conto" (trascina o sfoglia) → **2.** "Il tuo estratto" (transazioni
importate, entrate, uscite) → **3.** spiegazione del modello → **4.** "Categorizza le spese principali"
(le 15 più rilevanti, spunta verde su quelle fatte, **"Tutto categorizzato!"** alla fine) →
**5.** "Benvenuto in Sparter!".

*Beneficio da vendere in landing*: **arrivi in dashboard con dati veri e già categorizzati** —
l'app funziona al primo colpo, non ti accoglie con un cruscotto vuoto. Lo step 4 insegna il modello
mentale facendolo, non spiegandolo. Se il formato del file non è riconosciuto, entri nel wizard di
configurazione e torni all'onboarding senza perdere il flusso.

### 4.11 Account e interfaccia — SHIPPED

- **Accesso**: email e password, **Google**, **GitHub**. Più provider collegabili allo stesso account
  (con guardia che impedisce di rimanere senza alcun metodo di accesso).
- **Profilo** (`/settings/profile`): email, **Piano** (sola lettura: Free / Basic / Pro), ruolo,
  account collegati, tema **chiaro o scuro**.
- **Barra laterale comprimibile**: 8 voci — Dashboard · Transazioni · Spese · Rimborsi · Importazioni ·
  Categorie · Tag · Pattern — riducibile a rail di sole icone, stato ricordato tra le sessioni.
  Su mobile barra inferiore con 5 voci.
- **Filtri e ordinamento unificati** su Transazioni, Spese, Importazioni e Rimborsi: stessa
  meccanica, filtri nell'URL, nessuna perdita di filtri tornando indietro.

---

## 5. Struttura di pagina consigliata

Puoi discostarti se hai una ragione, ma la progressione narrativa (§2.1) va rispettata.

1. **Header sticky leggero** — wordmark "Sparter" · link ancora (Funzionalità · Come funziona ·
   Piani · FAQ) · CTA "Accedi" (ghost) + "Inizia gratis" (primary → `/register`).

2. **Hero** — un titolo che prende posizione, non una descrizione generica.
   Direzione consigliata: la tesi centrale di §3.1.
   Esempi di angolo (da riscrivere, non copiare alla lettera):
   - *"Il + sul conto non è un guadagno."* — sottotitolo che spiega le quattro direzioni.
   - *"Le tue spese, senza le bugie che ti raccontano le altre app."*
   Sottotitolo: il core value in una frase. CTA primaria + microcopy di rassicurazione
   ("Nessuna credenziale bancaria. Carichi tu l'estratto.").
   Visual: mock statico in JSX del grafico Entrate/Uscite + le 4 KPI, con numeri realistici
   formattati `it-IT`. Deve funzionare in light e dark.

3. **Il problema** — 3-4 scenari concreti che l'utente riconosce, ognuno con la riga
   "cosa fa la tua app di budgeting oggi" vs "cosa fa Sparter":
   il reso contato come reddito · il PAC contato come spesa · il giroconto che sporca i totali ·
   il portatile che fa esplodere il mese.

4. **Le quattro direzioni** — la sezione concettuale forte. Usa la tabella
   "movimento / segno / direzione / perché" di §3.1 come infografica. È il differenziatore che
   nessun competitor ha, e va spiegato prima delle feature.

5. **Feature per area** — 6-8 blocchi, ognuno con titolo-beneficio (non titolo-funzione),
   2-3 frasi, e un micro-visual o una lista di dettagli concreti. Ordine consigliato:
   1. Dashboard e deviazione (§4.1)
   2. Import da qualsiasi banca (§4.5) — con la griglia delle 8 piattaforme
   3. Categorizzazione a tre livelli + scoperta automatica dei pattern (§4.6)
   4. Rimborsi 1:N e residuo (§4.8)
   5. Gruppi di spesa: unisci senza distruggere (§4.4)
   6. Tag: quanto mi è costato quell'evento (§4.7)
   7. Ammortamento: i costi grossi non sfondano il mese (§4.9, solo la parte SHIPPED)
   8. Spesa a sé: una persona non è un negozio (§4.3)

6. **Come funziona** — 3 step numerati: *Scarica l'estratto dalla tua banca* →
   *Caricalo (CSV, Excel o PDF, fino a 5 MB)* → *Sparter categorizza e ti mostra dove vanno i soldi*.
   Aggancia l'onboarding 5-step (§4.10) come promessa: non parti da un cruscotto vuoto.

7. **Fiducia e privacy** — la sezione che chiude le obiezioni. Contenuto da §3.4 + §2.4:
   nessuna credenziale bancaria, nessun accesso ai conti, nessuna transazione inventata,
   nessuna descrizione riscritta, aritmetica esatta al centesimo, i tuoi dati sono solo tuoi.

8. **Piani** — tre colonne Free / Basic / Pro, **senza prezzi**. Vedi §7 per il contenuto esatto
   e i vincoli di onestà.

9. **FAQ** — 6-8 domande. Candidate (le risposte sono già tutte in questo documento):
   - Sparter si collega alla mia banca? (no, e perché è un vantaggio — §2.4)
   - Quali banche sono supportate? (le 8 preconfigurate + il wizard: nessuna banca è esclusa — §4.5)
   - Cosa succede se ricarico lo stesso estratto? (deduplicazione — §4.5)
   - Perché il mio investimento non compare tra le spese? (§3.1, §3.2)
   - Come gestisco una cena divisa tra amici? (§4.8)
   - Posso correggere una transazione importata male? (sì, e il dato originale resta — §3.4)
   - Devo configurare categorie prima di iniziare? (no: 23 categorie e ~87 sottocategorie incluse — §4.6)
   - È un'app per famiglie o coppie? (no, single-user — §2.3)

10. **CTA finale** — ripeti la CTA primaria con una riga che chiude il cerchio con l'hero.

11. **Footer** — wordmark, link ancora, `/login`, `/register`. Nessun link a pagine che non esistono
    (non inventare Privacy/Termini se non ci sono: se li metti, creali come stub o omettili).

---

## 6. Design system — valori esatti

Non esiste `tailwind.config.*`: è **Tailwind v4**, tutto in `app/globals.css`. Dark mode class-based
(`@custom-variant dark (&:is(.dark *))`) via `next-themes` (`attribute="class"`, `defaultTheme="system"`).
`components.json`: style `new-york`, baseColor `zinc`, icone `lucide-react`.

**Font**: Geist (`--font-sans`, `--font-heading`) e Geist Mono (`--font-mono`), già in `app/fonts.ts`.
Numeri: `font-mono tabular-nums`.

**Radius**: `--radius: 0.5rem`; `sm = r-4px`, `md = r-2px`, `lg = r`, `xl = r+4px`.
Card usa `rounded-xl`, Button `rounded-md`.

**Token light (`:root`)**:

```
--background: oklch(1 0 0)                --foreground: oklch(0.211 0.026 264.88)
--card / --popover: oklch(1 0 0)
--primary: oklch(0.515 0.154 153.85)      (verde)   --primary-foreground: oklch(1 0 0)
--secondary / --muted / --accent: oklch(0.966 0.002 247.84)
--muted-foreground: oklch(0.556 0.013 265.64)
--destructive: oklch(0.637 0.237 25.33)
--border / --input: oklch(0.929 0.007 264.53)   --ring: oklch(0.515 0.154 153.85)
--success: oklch(0.515 0.154 153.85)
```

**Token dark (`.dark`)**:

```
--background: oklch(0.147 0.004 285.75)   --foreground: oklch(0.985 0.002 247.84)
--card / --popover: oklch(0.211 0.026 264.88)
--primary: oklch(0.696 0.17 153.85)       --primary-foreground: oklch(0.147 0.004 285.75)
--secondary / --muted / --accent: oklch(0.279 0.031 264.88)
--muted-foreground: oklch(0.704 0.013 265.64)
--destructive: oklch(0.704 0.191 22.22)
--border: oklch(1 0 0 / 10%)   --input: oklch(1 0 0 / 15%)   --ring: oklch(0.696 0.17 153.85)
```

**Token semantici di finanza** — usali per qualunque numero o barra che rappresenti denaro,
così i mock della landing parlano la stessa lingua visiva dell'app:

```
--total-in:         light oklch(0.515 0.154 153.85)  ·  dark oklch(0.696 0.17 153.85)
--total-out:        light oklch(0.637 0.237 25.33)   ·  dark oklch(0.704 0.191 22.22)
--balance:          light oklch(0.372 0.033 264.39)  ·  dark oklch(0.704 0.013 265.64)
--total-allocation: #a78bfa   (invariato)
--total-transfer:   #94a3b8   (invariato)
```

Nota: **non esistono** token `--chart-1..5`; i grafici (recharts) usano direttamente
`var(--total-in)` / `var(--total-out)`.

**Componenti shadcn disponibili** in `components/ui/`: alert, avatar, badge, button, card, chart,
checkbox, command, dialog, dropdown-menu, input, popover, select, separator, sheet, table, tabs,
tooltip. Toast = `sonner`. **Riusali** invece di scrivere componenti nuovi.
Button varianti: default / destructive / outline / secondary / ghost / link; size default h-9, sm h-8, lg h-10.
Card: `rounded-xl border bg-card py-6 shadow-sm`, padding `px-6`.

**Riferimenti visivi interni da cui prendere il tono** (non partire da zero):
- **Onboarding** (`app/(app)/onboarding/_components/`) — è il pezzo più "marketing-like" esistente:
  contenuto centrato, numeri giganti (`text-7xl font-black`), sottotitoli `text-xl text-muted-foreground`,
  card informative `rounded-2xl bg-foreground/10 border border-foreground/10 p-5`, CTA sticky in basso,
  outro con cerchio `h-24 w-24 rounded-full bg-foreground/10` + icona di conferma.
- **Login/register** (`app/(auth)/`): shell centrata, wordmark `text-2xl font-semibold tracking-tight`,
  input senza label visibili, divisore "Oppure". La landing deve sembrare la stessa famiglia.

**Formattazione numeri** (locale `it-IT` in tutta l'app):
`formatAbsoluteAmount` → `12,50 €` (valore assoluto, il segno lo veicola il colore);
`formatEur` → `1.235 €` (0 decimali); `formatEurCompact` → `2,5k`;
mesi abbreviati capitalizzati senza punto, range con en-dash: `Apr–Mag 2026`.

---

## 7. Piani — contenuto e vincoli di onestà

Esistono **tre piani**: **Free**, **Basic**, **Pro** (enum a DB, default `free`, visibili in
`/settings/profile`). I gate reali sono tre soglie configurabili da variabile d'ambiente in
`lib/config/categorization.ts`, oggi tutte a default `free`:

| Capacità | Variabile | Copy di blocco reale |
|---|---|---|
| Categorizzazione automatica **regex (Tier 1)** | `CATEGORIZATION_REGEX_MIN_PLAN` | — |
| Categorizzazione automatica da **storico personale (Tier 2)** | `CATEGORIZATION_HISTORY_MIN_PLAN` | — |
| **Pattern personalizzati** (`/patterns`) | `CATEGORIZATION_CUSTOM_PATTERNS_MIN_PLAN` | "I pattern personalizzati richiedono un piano Basic o Pro." · "Il tuo piano Basic non include i pattern personalizzati. Passa al piano Pro." |

Differenziazione intesa (dal contratto delle capacità in `.planning/PROJECT.md`):

| | Free | Basic | Pro |
|---|---|---|---|
| Import CSV / Excel / PDF, dedup, wizard formato | ✓ | ✓ | ✓ |
| Dashboard, deviazione, tag, rimborsi, gruppi, ammortamento | ✓ | ✓ | ✓ |
| Categorizzazione automatica: **regex** (Tier 1) | — | ✓ | ✓ |
| Categorizzazione automatica: **storico personale** (Tier 2) | — | ✓ | ✓ |
| **Pattern personalizzati** | — | ✓ | ✓ |
| Categorizzazione **AI** (Tier 3) | — | — | ✓ |

**Vincoli di onestà — importanti**:

- **Nessun prezzo.** Nel repo non esiste listino, checkout, integrazione di pagamento né pagina di
  upgrade. Usa "Prezzi presto disponibili" o equivalente, con la CTA che porta comunque a `/register`.
- **Nessun limite quantitativo** (numero di import, di transazioni, di conti) è codificato:
  non inventarne.
- Il **Tier 3 AI** è previsto nel contratto delle capacità ma **non è costruito**: presentalo come
  "in arrivo sul piano Pro", non come funzionalità attiva.
- Non usare scadenze, countdown, "offerta limitata", contatori di utenti o social proof inventato.

---

## 8. Copy — tono e lista nera

### 8.1 Tono

Seconda persona singolare, **colloquiale ma asciutto**, orientato all'azione, **senza gergo contabile**.
Il registro giusto è quello del copy UI già scritto — non il tono da fintech istituzionale:

> "Rispetto al mese scorso" · "Dove hai speso di più" · "Dove hai risparmiato" · "spesa nuova" ·
> "Tutto categorizzato!" · "spesa a sé (non aggregare)" · "ti devono ancora 25 €" ·
> "Scollega prima il rimborso"

### 8.2 Terminologia da usare (label italiane di prodotto)

Entrate · Uscite · Bilancio · Accantonato / Investito · Trasferimenti · Tasso di risparmio ·
Deviazione · Baseline · Periodo di riferimento · Spesa · Transazione · Gruppo di spese ·
Unisci / Scomponi · Spesa a sé · Rimborsi · Residuo · Ammortamento · Rata · Realizzo ·
Piattaforma · Pattern · Tag · Categoria / Sottocategoria ·
Nature: Essenziale · Discrezionale · Debiti · Entrate ricorrenti · Straordinaria · Risparmio ·
Investimento · Trasferimento · Non classificato.

I nomi inglesi dei concetti (`Transaction`, `Expense`, `Deviation`, `FlowNature`, `Direction`)
vivono nel codice e negli ADR: **nel copy usa l'italiano** e riserva il termine inglese solo se
vuoi dare un nome proprio a un meccanismo. **Non mischiare le lingue nella stessa etichetta.**

### 8.3 Lista nera — termini vietati nel copy

Vengono dai campi `_Avoid_` di `CONTEXT.md`: sono vincoli, non preferenze.

| Non dire | Di' invece |
|---|---|
| movimento, record, riga (per una transazione) | **transazione** |
| uscita come sinonimo di spesa | **spesa** |
| **sincronizzazione**, upload (per l'import) | **import**, caricare un file |
| banca, conto (per una Platform) | **piattaforma** |
| merchant / esercente come se fosse un'anagrafica | descrizione, spesa |
| scostamento, variazione, **delta** (per la deviazione) | **deviazione** |
| variazione (per il mese-su-mese) | "rispetto al mese scorso" |
| media storica (per la baseline) | **baseline** |
| mese corrente, periodo attuale | **periodo di riferimento** |
| rateizzazione, spalmatura, deprezzamento | **ammortamento** |
| filtro (per la lente di competenza) | **lente**, **vista** |
| merge fisico, spesa fusa | **gruppo di spese**, **unisci** |
| categoria "assicurazioni" / "abbonamenti" / "famiglia" | sono **viste trasversali**: si classificano per scopo |
| "spesa manuale", "spesa scollegata" | **spesa a sé** |
| AI-powered (a spruzzo) | "prima le regole, poi la tua storia, l'AI solo dove serve" |

### 8.4 Cosa non affermare mai

- Che Sparter si collega ai conti o si aggiorna in tempo reale.
- Che esiste un'app mobile, un piano famiglia, la modalità offline o l'SSO.
- Che il registro degli ammortamenti o la lente per competenza sono disponibili oggi.
- Che si può ancorare un rimborso a un gruppo di spese dall'interfaccia.
- Prezzi, sconti, numeri di utenti, testimonial, loghi di banche partner, certificazioni.

### 8.5 Un dettaglio di prodotto da correggere nel copy

`lib/validations/import.ts` impone **5 MB** e accetta `.csv`, `.xlsx`, `.pdf`.
Lo step 1 dell'onboarding dice ancora "CSV, XLS, XLSX · max 10 MB": è una discrepanza nota.
**La landing usa 5 MB e i tre formati corretti.**

---

## 9. Definition of done

- [ ] La landing è raggiungibile su `/` da un visitatore **non autenticato** (`proxy.ts` aggiornato).
- [ ] Un utente **autenticato** che apre `/` viene rediretto a `/dashboard` (comportamento attuale preservato).
- [ ] Nessuna modifica al comportamento del gruppo `(app)` o al gate onboarding.
- [ ] Resa corretta in **light e dark**, con soli token CSS.
- [ ] Responsive da 320px in su; nessuno scroll orizzontale.
- [ ] CTA primaria → `/register`, secondaria → `/login`, entrambe funzionanti.
- [ ] Metadata: title, description, Open Graph (immagine via `next/og` o assente, mai rotta).
- [ ] Zero nuove dipendenze; solo componenti già in `components/ui/`.
- [ ] `yarn check:language` verde · lint e typecheck verdi · build verde.
- [ ] Nessuna affermazione della §8.4 presente nel copy.
- [ ] Ogni feature descritta al presente è nella lista **SHIPPED** della §4.
