# Sparter

App di finanza personale per il mercato italiano. Permette agli utenti di importare movimenti bancari, categorizzarli, e analizzare le proprie abitudini di spesa nel tempo.

## Language

### Transazioni e movimenti

**Transaction** (Transazione):
Un movimento di denaro importato da un file bancario, classificato come entrata (`in`), uscita (`out`), o ignorato (`ignored`).
_Avoid_: movimento, record, riga

**Expense** (Spesa):
Una transazione di tipo `out`. Non usare "spesa" per indicare genericamente una transazione.
_Avoid_: uscita (come sinonimo di expense nel codice)

**Import**:
Il processo con cui l'utente carica un file CSV/Excel di estratto conto e lo trasforma in transazioni persistite. I dati **non sono aggiornati in tempo reale** — riflettono l'ultimo import eseguito.
_Avoid_: upload, sincronizzazione

**Platform** (Piattaforma):
Un istituto bancario, broker o servizio di pagamento (es. Intesa SP, Revolut, Fineco, Trade Republic) da cui proviene un estratto. La Platform è **identità del fornitore** (nome, slug, paese), non contratto di formato: il come-si-parsa il file appartiene all'**Import Format**. Una Platform può fornire estratti in formati diversi (CSV, XLSX, PDF). La Platform **non è mai posseduta da un utente**: un'identità-fornitore posseduta da uno solo è una contraddizione. Ha invece un ciclo di **review**: una Platform proposta da un utente nasce `pending` ed è visibile **solo al proponente**; una volta approvata diventa `approved` e **condivisa con tutti** ("Fineco" è la stessa identità per ogni utente). Ciò che un utente può possedere è solo un **Import Format** privato (vedi sotto).
_Avoid_: banca, conto, platform privata

**Import Format** (Contratto di import):
Il contratto **versionato** che descrive come il file di una Platform si mappa in Transaction: quali colonne sono data/descrizione/importo, il segno, l'eventuale `descriptionStripPattern`, e il tipo di sorgente (CSV/XLSX/PDF). Appartiene alla Platform (1:N) ma è proprietà dell'Import Format, non della Platform — più versioni convivono per gestire cambi di tracciato. A differenza della Platform, un Import Format **può essere privato**: posseduto da un singolo utente (`ownerUserId`) e recuperabile solo da lui, **anche quando è appeso a una Platform globale/approvata**. È il livello dove vive la personalizzazione: es. un file Fineco rielaborato a mano in Excel con un tracciato proprio dell'utente diventa un Import Format privato sotto la Fineco condivisa, senza duplicare la Platform. Per le sorgenti PDF (parsing per-banca via template) le "colonne" sono **sintetiche**: nomi-contratto prodotti dall'estrattore, non intestazioni presenti nel file.
_Avoid_: tracciato (come sinonimo del solo header), formato file

**Sezione canonica dei movimenti** (regola di dominio per estratti multi-sezione):
Un estratto — tipicamente PDF — può contenere più tabelle con numeri (riepilogo saldi, posizioni, movimenti interni). **Solo la sezione dei movimenti del conto** è fonte di Transaction. Le **sezioni-specchio** (es. acquisti/vendite interni del fondo di liquidità di un broker, che riflettono gli stessi importi già presenti tra i movimenti del conto) si **scartano** per non doppio-contare. Esempio: in Trade Republic si importa "TRANSAZIONI SUL CONTO"; "PANORAMICA TRANSAZIONI" (movimenti del fondo monetario) e "PANORAMICA DEL SALDO" si ignorano.
_Avoid_: importare tutte le righe del file

**DescriptionStripPattern** (Pattern di pulizia descrizione):
Regex nullable configurata per Import Format (campo `description_strip_pattern` su `import_format_version`, ADR 0013). Quando presente, viene applicata alla descrizione grezza estratta dal CSV prima di `normalizeDescription` e del calcolo degli hash. Rimuove boilerplate prevedibile (es. suffissi con numero carta e data operazione) che altrimenti impedisce l'aggregazione delle transazioni dello stesso esercente e la categorizzazione automatica. Il valore originale è sempre preservato in `rawRow`.
_Avoid_: regex di normalizzazione, filtro descrizione

### Categorizzazione

**Category** (Categoria):
Raggruppamento di primo livello per classificare le transazioni (es. "Alimentari", "Stipendio").
> ⚠️ Il campo `category.type` (`in`/`out`/`transfer`/`system`) è **deprecato** (grill 2026-06-09): la direzione si deriva dalla **FlowNature** della sottocategoria, non dal type della categoria. `type` verrà rimosso al termine della feature di riallineamento nature.
_Avoid_: gruppo, tipo

**Subcategory** (Sottocategoria):
Classificazione di secondo livello all'interno di una categoria (es. "Caffè & Bar" dentro "Alimentari & Ristorazione").
_Avoid_: tag, voce

**Categorization** (Categorizzazione):
L'atto di categorizzare una transazione assegnandole **una Subcategory**. La Category non viene mai assegnata in modo indipendente: è derivata dalla Subcategory scelta. L'unità di categorizzazione è quindi sempre la Subcategory, mai una Category "nuda". Può avvenire automaticamente (regex, storico) o manualmente. Tutti i punti di selezione sottocategoria nel prodotto richiedono obbligatoriamente una Subcategory.

**Principi di categorizzazione** (la "regola madre", grill 2026-06-09):
1. **Per scopo / dominio di vita**, non per tipo di transazione, canale, esercente o beneficiario. *Cosa serve quel denaro?*
2. **Eccezione pragmatica:** uno scontrino che mescola scopi e **non è separabile** → catch-all dello scopo dominante (es. la spesa settimanale al supermercato con dentro anche detersivi → `spesa-quotidiana`, essential — non si insegue ciò che non è osservabile nello scontrino).
3. **Wrapper distribuiti per oggetto:** le spese che sono solo un *tipo di prodotto finanziario/contratto* (assicurazioni, abbonamenti) non formano categorie proprie; si distribuiscono nel dominio che servono (assicurazione auto → Trasporti, streaming → Cultura). I totali "assicurazioni"/"abbonamenti" sono viste trasversali, non categorie. **Eccezione:** tasse e debiti restano categorie proprie perché la loro essenza È l'obbligo, non un dominio di consumo.
4. **Il regalo/donazione è uno scopo** e prevale sull'oggetto: una TV regalata → `regali`, non `elettronica`. Diverso dal **beneficiario**: una spesa per il bisogno di un familiare si classifica per il bisogno (corso del figlio → Formazione, non "famiglia").

Esempi-guida: libro comprato al supermercato → Cultura · cibo per animali → Animali · tuta da corsa → Benessere/sport · TV regalata → Regali.

**Uncategorized** (Non categorizzato):
Transazione senza categoria e sottocategoria assegnate. È un segnale d'azione, non uno stato definitivo.

**Direction** (Direzione): `in` | `out` | `allocation` | `transfer`

Concetto chiave. La direzione risponde a: **"che effetto ha questo movimento sul patrimonio, e come va trattato nell'analisi?"**. Non è il verso del denaro sul conto (quello è il *segno*); è il **ruolo economico** del movimento. **Si deriva dalla FlowNature** della sottocategoria — non è un campo separato, non è il deprecato `category.type`. Ogni nature appartiene a esattamente una direzione.

Le quattro direzioni, per **effetto sul patrimonio netto**:
- `in` — lo **aumenta** (guadagni). → Entrate.
- `out` — lo **diminuisce** (consumo reale). → Uscite.
- `allocation` — **non lo cambia** (sposti denaro da liquido ad accantonato/asset) ma è un **comportamento da misurare** (risparmio, investimenti). → mostrato a parte ("Accantonato/Investito"), fuori dalle uscite.
- `transfer` — **non lo cambia** (movimenti tra conti propri) ed è **rumore analitico**. → escluso e nascosto.

Distinzione `allocation` vs `transfer`: stesso effetto contabile (neutro), valore analitico opposto — l'allocation è segnale da tracciare, il transfer è rumore da nascondere.

**Direzione ≠ segno (due assi indipendenti).** Il **segno** dice se il cash entra (+) o esce (−) dal conto (dato grezzo della banca). La **direzione** dice cosa significa per le finanze. Sono disaccoppiati: lo stesso segno può avere direzioni diverse.

| Movimento | Segno | Direzione | Perché |
|---|---|---|---|
| Stipendio | + | `in` | denaro nuovo |
| Reso di una spesa | + | `out` | spesa annullata, non guadagno (netta in OUT) |
| Vendita di un proprio ETF | + | `allocation` | asset → liquidità, neutro |
| Accredito da un proprio conto | + | `transfer` | era già tuo, rumore |

Conseguenza: i totali si calcolano per **somma algebrica** dentro ogni direzione (ADR 0004), non splittando per segno. Una transazione non categorizzata non ha nature → non ha direzione: lì il segno è l'unico fallback.
_Avoid_: tipo, segno (come sinonimo di direzione)

**FlowNature** (Natura del flusso):
Classificazione economica applicata a ogni sottocategoria. Ogni sottocategoria ha esattamente una natura (o è non classificata). Ogni nature ha esattamente una **Direction**: la nature è la fonte di verità della direzione. Valori canonici (9), raggruppati per direzione:

**IN** (aumenta il patrimonio netto)
- `income` — reddito ricorrente da lavoro o rendita (stipendio, freelance ricorrente, dividendi, canoni di locazione).
- `income_extraordinary` — **denaro nuovo** dall'esterno, non ricorrente, che aumenta il patrimonio: bonus, **eredità e donazioni ricevute**, vincite, premi (cashback, fedeltà), bonus promozionali, entrate una-tantum. _Non_ include il disinvestimento di asset propri (→ `investment`) né il rimborso di una spesa specifica (→ netting, vedi sotto).

**OUT** (riduce il patrimonio netto — consumo reale). Asse unico: **bisogno vs voglia**.
- `essential` — consumo necessario/non-negoziabile (affitto, bollette, spesa alimentare, salute, telecom, RC-auto, imposte, bolli, commissioni bancarie).
- `discretionary` — consumo opzionale (ristoranti, intrattenimento, shopping, streaming, assicurazioni non obbligatorie, formazione facoltativa).
- `debt` — rimborso di prestiti (mutuo, finanziamenti). L'intera rata è OUT: capitale e interessi non sono separabili dall'import bancario, e la rata è un impegno fisso da budgetare come uscita.

> `operational` è stato **sciolto** (grill 2026-06-09): mescolava due assi (bisogno/voglia + ricorrente/fisso) accorpando abbonamenti, assicurazioni, imposte e formazione in un catch-all — l'anti-pattern che l'ADR 0003 voleva evitare. Ogni sua sottocategoria va riassegnata a `essential` o `discretionary`. L'eventuale insight "spese ricorrenti/abbonamenti" è un taglio ortogonale (flag/vista), non una nature.

**TRANSFER** (neutro al patrimonio, rumore analitico — escluso e nascosto)
- `transfer` — movimentazione interna tra conti propri liquidi (giroconto, ricarica, prelievo ATM, pagamento saldo carta). Non dice nulla sull'andamento finanziario.

**ALLOCATION** (neutro al patrimonio, ma comportamento tracciato — vedi Direction `allocation`)
- `savings` — accantonamento liquido a basso rischio (conto deposito, fondo emergenze, accantonamenti per obiettivi).
- `investment` — allocazione in asset a rischio/rendimento (azioni, obbligazioni, ETF, fondi comuni, criptovalute, immobili, fondo pensione).

**Disinvestimento e netting.** Vendere un proprio asset o prelevare da un risparmio **non è un'entrata**: è un'allocazione al contrario. Si registra con la stessa nature (`investment`/`savings`) ma contribuisce in negativo, e **netta** dentro il segmento allocation (coerente con ADR 0004, somma algebrica). Esempio: investi 800 e disinvesti 300 nello stesso periodo → allocation netta +500. Solo il denaro nuovo dall'esterno (eredità, vincite) è `income_extraordinary`.

**Rimborso (refund) — netting per sottocategoria, senza correlazione.** Un accredito che **annulla una spesa specifica** (reso ordine online, rimborso da persona per una spesa condivisa, rimborso sanitario/viaggio di una spesa tracciata) **non è un'entrata**: si categorizza sotto la **stessa sottocategoria della spesa** e **netta per somma algebrica** dentro quel segmento OUT (ADR 0004). **Non esiste alcuna correlazione transazione↔transazione** né un modello di linking: una sottocategoria contiene semplicemente transazioni di entrambi i segni e il totale netta. Esempio: 10 ordini −1000 + 4 resi +300 sotto "shopping online" → −700. Distinzione decidibile: _"annulla una mia spesa specifica → netta; è denaro nuovo non legato a una spesa → `income_extraordinary`"_. Conseguenza display: una transazione può avere segno opposto alla direzione della sua nature (un reso `+` sotto una sottocategoria OUT) — in lista si mostra per l'importo reale, nel grafico netta.

> ⚠️ **Limite noto (postilla, grill 2026-06-09):** il **rimborso spese lavorative incluso nello stipendio** non è separabile dall'accredito stipendio. Quel mese risulteranno uno stipendio più alto (`income`) e spese extra non nettate. Non gestito per ora — da affrontare in futuro (eventuale split manuale o sottocategoria dedicata).

> Rinominazioni rispetto al modello storico (grill 2026-06-09): `financial` → `investment`; `extraordinary` (che il seed applicava ai risparmi) → `savings`. I valori `income`/`income_extraordinary` (split Phase 42) sono ora documentati. Non esiste una nature "spesa straordinaria" lato OUT: le uscite one-off ricadono nella loro nature di consumo.

Le sottocategorie di sistema escono dal seed con una natura predefinita ragionevole. L'utente può sovrascrivere la natura dalle impostazioni. Una sottocategoria senza natura assegnata è visibile nel grafico come segmento "non classificato".
_Avoid_: tipo di spesa, carattere, tag economico
_Avoid_: da classificare

**Trasferimenti** (categoria, direzione `transfer`):
Categoria per movimenti interni tra conti/strumenti propri dell'utente. Non è né entrata né uscita: non modifica il patrimonio netto (se tutti i conti sono importati i due lati nettano). Esclusa dai totali e nascosta dalla dashboard (direzione `transfer`, vedi "Categoria TRANSFER" sotto per le sottocategorie canoniche `trasferimento-tra-conti`, `addebito-carta-di-credito`, `contante`).
> Nota storica: nasce dalla cat 32 "ignore"; la cat 28 "movimenti di liquidità" è deprecata. La direzione si deriva dalla nature `transfer`, non dal vecchio `category.type` (deprecato).
_Avoid_: movimenti di liquidità (deprecato), ignore (dismesso)

**Categorie IN (entrate)** — definite nel grill 2026-06-09 (dettaglio sottocategorie in `.planning/nature-remapping-WORKING.md`). Quattro categorie:
- **Income da lavoro** — reddito da attività lavorativa: `stipendio-base`, `indennita` (nature `income`); `bonus`, `freelance`, `consulenze`, `progetti-occasionali`, `commissioni` (nature `income_extraordinary`, variabili). Rimossa `overtime` (rumore, di solito dentro l'accredito stipendio).
- **Pensioni e sussidi** — prestazioni ricorrenti non da lavoro attivo: `pensione`, `sussidi-statali` (assegno unico, NASpI, bonus statali). Nature `income`.
- **Rendite** _(era "Income finanziari")_ — reddito passivo ricorrente da asset posseduti: `dividendi`, `interessi-attivi`, `canone-di-locazione`. Nature `income`. Il canone di locazione è income (rendita), non transfer: un bonifico in entrata si classifica per la sua origine, non per il mezzo.
- **Entrate straordinarie** _(merge di "sconti, rimborsi e cashback" + "vendite e dismissioni")_ — denaro nuovo dall'esterno non legato a una spesa: `cashback`, `bonus-promozionale`, `vendita-beni-usati`, `eredita-e-donazioni`. Nature `income_extraordinary`.

**Rimborsi — non sono una categoria IN.** Le ex sottocategorie `rimborso-*` sono rimosse: un rimborso si categorizza sotto la sottocategoria della spesa e **netta** (vedi "Rimborso (refund)" sopra). Disinvestimenti (`vendita-investimenti`, `immobili-vendita`) → `allocation`; movimenti tra conti propri (`bonifico-in-entrata`, `ricariche-conti`) → `transfer`.
_Avoid_: sconti, rimborsi e cashback (nome deprecato), movimenti di liquidità

**Categorie OUT (uscite)** — definite nel grill 2026-06-09 (dettaglio + nature per sottocategoria in `.planning/nature-remapping-WORKING.md`). 16 categorie; nature `essential` (E), `discretionary` (D) o `debt`. Sciolte rispetto al modello storico: **Famiglia** (beneficiario), **Assicurazioni** e **Abbonamenti** (wrapper → distribuite per oggetto/scopo), **Risparmio**/**Investimenti** (→ allocation), **Bonifici e rimborsi** (→ transfer/netting). Nature `operational` sciolta in E/D.

- **Trasporti** — carburante-e-ricarica, manutenzione-auto, mezzi-pubblici, taxi-e-ride-sharing, pedaggi-e-parcheggi, assicurazione-veicoli (tutte E)
- **Spesa** — spesa-quotidiana (E), casalinghi-e-non-alimentari (E), bio-vino-e-gourmet (D)
- **Salute** — visite-mediche (E), trattamenti-medici (E), farmaci (E), assicurazione-salute (D)
- **Utenze** _(era Bollette e utilità)_ — energia-elettrica, gas, acqua, rifiuti, telefono-e-internet (tutte E)
- **Casa** — affitto, spese-condominiali, manutenzione-casa (idraulico/elettricista/giardiniere), servizi-domestici (colf/badante/baby-sitter), assicurazione-casa (tutte E)
- **Imposte e oneri** _(era Tasse, imposte e commissioni)_ — imposte, bolli-auto, multe-e-sanzioni, commissioni-e-canone-conto (tutte E)
- **Servizi professionali** — spese-legali-notarili (E)
- **Formazione** — universita (E), spese-scolastiche (E), corsi (D)
- **Vacanze** — alloggio, trasporto, attivita-e-intrattenimento, cibo-e-bevande, assicurazione-viaggio (tutte D)
- **Regali e donazioni** — regali (D), donazioni-beneficenza (D)
- **Ristorazione** — ristoranti, bar-caffe-e-snack, take-away-e-delivery (tutte D)
- **Shopping** — elettronica, abbigliamento-e-accessori, prodotti-per-la-casa, giocattoli, cartoleria-e-oggettistica (tutte D). `cartoleria-e-oggettistica` _(agg. 2026-06-15)_ è la casa dei negozi "tuttofare" — cartolerie, cancelleria, oggettistica/regalistica varia (Tiger, Flying Tiger, Søstrene Grene). `abbigliamento-e-accessori` resta solo capi + accessori d'abbigliamento (cinture/scarpe/sciarpe); i variety-store multi-scopo non hanno un pattern Tier-1 "corretto" e di norma vanno qui di default o categorizzati a mano per acquisto.
- **Cultura e tempo libero** _(merge Tempo libero + Libri e media)_ — cinema-ed-eventi, libri-e-audiolibri, streaming, app-e-software, videogiochi (tutte D)
- **Benessere** — sport-e-fitness, attrezzatura-e-abbigliamento-sportivo, cura-della-persona (estetista/parrucchiere/cosmetici/massaggi/spa/terme), psicologia (tutte D)
- **Animali** — cura-animali (cibo+veterinario+toelettatura), assicurazione-animali (tutte D)
- **Rate e finanziamenti** — mutuo-casa, finanziamenti-auto, altri-finanziamenti (tutte `debt`)
_Avoid_: assicurazioni come categoria, abbonamenti come categoria, famiglia come categoria, spesa online (canale)

**Categorie ALLOCATION** — definite nel grill 2026-06-09. Direzione `allocation` (neutro al patrimonio ma tracciato). Versamenti (+) e disinvestimenti (−) nettano sotto la stessa sottocategoria; il reddito generato (dividendi/cedole/interessi) non è allocation ma IN/Rendite.
- **Risparmio** → nature `savings`: `conto-risparmio` (liquidità/deposito/libretti/buoni postali), `fondo-emergenze`, `accantonamenti-obiettivi`.
- **Investimenti** → nature `investment`: `titoli-e-fondi` (azioni/obbligazioni/ETF/BTP/fondi/PAC), `criptovalute`, `immobili` (acquisto e vendita nettano qui), `previdenza-complementare` (fondo pensione + PIP), `polizze-vita` (ramo I/III), `oro-e-beni-rifugio`.

**Categoria TRANSFER** — definita nel grill 2026-06-09. Direzione `transfer` (neutro al patrimonio, rumore → escluso e nascosto, `excludeFromTotals`). Una categoria **Trasferimenti**, nature `transfer`, **agnostica al segno**:
- `trasferimento-tra-conti` (giroconti, bonifici tra conti propri in/out, ricariche wallet propri, cambio valuta tra conti propri)
- `addebito-carta-di-credito` (pagamento saldo CC — escluso per non doppio-contare le spese carta)
- `contante` (prelievi e versamenti)

Discriminante: **la controparte, non lo strumento**. Controparte = te stesso → `transfer` (qualsiasi segno). Controparte = altri → categorizza per scopo (un bonifico in uscita verso un altro è la spesa sottostante; un accredito da un altro è income o rimborso). Lo **storno bancario** non è transfer: netta sotto la transazione originale.
_Avoid_: movimenti di liquidità, ignore

**CategorizationPattern** (Pattern di categorizzazione):
Regex che mappa una descrizione a una Subcategory (Tier 1). I pattern di **sistema** (`userId = null`) vivono in un'unica lista canonica in `scripts/seed-patterns-data.ts`. L'aggiornamento è un **full replace**, non una migrazione incrementale: `yarn db:seed-patterns` **cancella tutte le righe di sistema e le ricrea da zero** dalla lista canonica (i pattern utente non vengono mai toccati). Quando `yarn regex:discover` scopre nuovi pattern da estratti conto reali, li si aggiunge alla lista in `seed-patterns-data.ts` e si rilancia `db:seed-patterns`: la tabella di sistema si riallinea interamente alla lista. La lista è quindi la **singola fonte di verità**; il DB ne è una proiezione rigenerabile.
_Avoid_: migrazione pattern, aggiornamento incrementale dei pattern di sistema

**PatternSuggestion** (Suggerimento di pattern):
Candidato regex rilevato automaticamente durante la fase di analisi dell'import, a partire da descrizioni di transazioni non coperte da pattern esistenti che condividono un prefisso comune (≥2 token, ≥2 occorrenze nel file). Campi: `pattern` (prefisso estratto), `matchCount` (occorrenze nel file/import), `detectedAmountSign`, `sampleDescriptions` (max 3 descrizioni originali). Non è un `CategorizationPattern` finché l'utente non assegna una sottocategoria e lo salva. Può essere prodotto sia pre-import (da righe parse) sia post-import su transazioni già persistite (per rianalisi per `fileId`). Al massimo 5 per analisi, ordinate per `matchCount` discendente.
_Avoid_: pattern suggerito, candidato, hint

### Onboarding e primo import

**Onboarding**:
Il flusso di accesso riservato agli utenti con zero transazioni. Attivo finché `count(transaction) === 0`. Composto da 5 step: upload → overview → educazione → categorizzazione → outro. Termina quando l'utente esce verso la dashboard o le impostazioni.
_Avoid_: wizard di registrazione, setup iniziale

**Step 4 (Categorizzazione) — invarianti** _(260615-n3t)_. Tre regole stabili, garantite da test di regressione (companion eseguibile di questa nota; vedi `onboardingThemeForStep` e `getTopExpensesForOnboarding`):
1. **Tema.** Lo step 4 è l'unico step a tema chiaro (`light`); gli altri quattro sono `dark`. Il mapping vive in `onboardingThemeForStep(step)` (`lib/validations/onboarding.ts`), unica fonte di verità — `page.tsx` non deriva il tema inline.
2. **Lista stabile + check persistente.** Lo step mostra un set stabile di 15 spese (`getTopExpensesForOnboarding`, senza filtro `IS NULL`). Una spesa già categorizzata resta visibile con la spunta verde e **non sparisce** dopo il salvataggio (`revalidatePath('/onboarding')`) né dopo un refresh manuale: lo stato categorizzato è seminato sul primo render server (`initialCategorized`).
3. **Done-state.** Il messaggio "Tutto categorizzato!" appare quando **non resta alcuna spesa non categorizzata** nel set recuperato (`remaining === 0`), non quando la lista è vuota.

**Months Covered** (Mesi coperti):
Label derivata on-the-fly dalle date delle transazioni di un file (es. "Apr–Giu 2026"). Non è una proprietà persistita sul file. Calcolata da `DATE_TRUNC('month', MIN/MAX(transaction.date))` per quel `fileId`. Usata solo a fini di display nella lista file e nell'overview di onboarding.
_Avoid_: periodo del file, mese assegnato

### Dashboard e analisi

**Reference Period** (Periodo di riferimento):
L'ultimo mese per cui esistono transazioni importate per l'utente. Viene determinato dalla query, non dal calendario — corrisponde al `MAX(TO_CHAR(occurred_at, 'YYYY-MM'))` sulle transazioni dell'utente per l'anno selezionato. _Nota_: il motore Deviation (`getDeviationDateRanges`) usa ancora "ultimo mese di calendario completo" — deriva documentale in attesa di migrazione (deferred, D-12).
_Avoid_: mese corrente, periodo attuale

**Baseline**:
La media mensile di spesa per una categoria o sottocategoria calcolata sui 3 mesi di calendario precedenti il Reference Period. Usata per calcolare la Deviation.
_Avoid_: media storica, riferimento

**Deviation** (Deviazione):
La differenza percentuale tra la spesa del Reference Period e la Baseline per una data categoria o sottocategoria. Positiva = speso di più della media, negativa = speso di meno.
_Avoid_: scostamento, variazione, delta (riservato ai confronti KPI periodo-su-periodo)

**MonthOverMonthChange** (Variazione mese su mese):
Variazione della spesa di una categoria rispetto al mese di calendario precedente. Distinto dalla Deviation (che confronta vs la Baseline su 3 mesi). Query: `getMonthOverMonthCategoryChanges`. Copy UI: "Rispetto al mese scorso" / "Dove hai speso di più" / "Dove hai risparmiato". Campi: `{ categoryId, name, delta, isNew }` — `isNew = true` quando la spesa precedente era zero e quella attuale è positiva.
_Avoid_: "variazione" (riservato-deprecato per evitare confusione con Deviation)

**Noise Threshold** (Soglia di rumore):
Importo minimo di spesa nel Reference Period (€15) sotto il quale una sottocategoria è esclusa dalla vista Deviation. Evita che micro-spese occasionali generino deviazioni percentuali fuorvianti.

**Preset**:
Filtro temporale della dashboard selezionabile dall'utente (es. `last-month`, `last-3-months`). `last-month` indica il mese di calendario precedente a quello corrente — un periodo completato.
_Avoid_: periodo, filtro, intervallo

## Relationships

- Una **Platform** definisce il formato di un **Import**
- Un **Import** produce zero o più **Transaction**
- Una **Transaction** è o **non categorizzata** (nessuna Subcategory) o ha **esattamente una Subcategory**; la **Category** è sempre derivata dalla Subcategory, mai assegnata da sola
- Una **Category** contiene zero o più **Subcategory**
- Una **Subcategory** ha zero o una **FlowNature** (null = non classificata)
- La **Deviation** di una **Subcategory** è calcolata rispetto alla sua **Baseline**
- La **Baseline** si calcola solo se esistono dati nei 3 mesi precedenti il **Reference Period**

## Example dialogue

> **Dev:** "Nella pagina Categorie mostro le categorie ordinate per Deviation — ma se l'utente non ha dati del mese scorso?"
> **Domain expert:** "Se il Reference Period non ha transazioni, non c'è nulla da mostrare. La Deviation non è calcolabile senza il Reference Period. Mostra uno stato vuoto."

> **Dev:** "La Baseline usa 3 mesi — ma cosa succede se l'utente ha dati solo da 1 mese?"
> **Domain expert:** "Calcoli la Baseline sui mesi disponibili. Se c'è solo 1 mese, la Baseline è quel mese. La Deviation è comunque significativa."

## Flagged ambiguities

- `last-month` nel codice restituiva dati del mese corrente (bug): risolto — `last-month` deve restituire il mese di calendario precedente, non quello in corso.
- "delta" era usato sia per variazioni KPI periodo-su-periodo sia per scostamento dalla media: risolto — **delta** = variazione KPI, **deviation** = scostamento dalla Baseline.
