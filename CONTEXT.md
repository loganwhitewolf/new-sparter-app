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
Un istituto bancario o servizio di pagamento (es. Intesa SP, Revolut, Fineco) con il proprio formato di import.
_Avoid_: banca, conto

**DescriptionStripPattern** (Pattern di pulizia descrizione):
Regex nullable configurata per Platform. Quando presente, viene applicata alla descrizione grezza estratta dal CSV prima di `normalizeDescription` e del calcolo degli hash. Rimuove boilerplate prevedibile (es. suffissi con numero carta e data operazione) che altrimenti impedisce l'aggregazione delle transazioni dello stesso esercente e la categorizzazione automatica. Il valore originale è sempre preservato in `rawRow`.
_Avoid_: regex di normalizzazione, filtro descrizione

### Categorizzazione

**Category** (Categoria):
Raggruppamento di primo livello per classificare le transazioni, di tipo `in` o `out` (es. "Alimentari", "Stipendio").
_Avoid_: gruppo, tipo

**Subcategory** (Sottocategoria):
Classificazione di secondo livello all'interno di una categoria (es. "Caffè & Bar" dentro "Alimentari & Ristorazione").
_Avoid_: tag, voce

**Categorization** (Categorizzazione):
L'atto di categorizzare una transazione assegnandole **una Subcategory**. La Category non viene mai assegnata in modo indipendente: è derivata dalla Subcategory scelta. L'unità di categorizzazione è quindi sempre la Subcategory, mai una Category "nuda". Può avvenire automaticamente (regex, storico) o manualmente. Tutti i punti di selezione sottocategoria nel prodotto richiedono obbligatoriamente una Subcategory.

**Uncategorized** (Non categorizzato):
Transazione senza categoria e sottocategoria assegnate. È un segnale d'azione, non uno stato definitivo.

**FlowNature** (Natura del flusso):
Classificazione economica applicata a ogni sottocategoria. Ogni sottocategoria ha esattamente una natura (o è non classificata). Valori canonici:
- `essential` — spesa necessaria e ricorrente (affitto, bollette, spesa alimentare, salute)
- `discretionary` — consumo opzionale (ristoranti, intrattenimento, shopping)
- `operational` — reddito da lavoro ordinario (stipendio, freelance)
- `financial` — risparmio e investimenti, e le relative entrate (ETF, dividendi, conto deposito)
- `debt` — rimborso di debiti (rate mutuo quota capitale, finanziamenti)
- `extraordinary` — eventi non ricorrenti (bonus, rimborso fiscale, eredità, vendita beni usati)
- `transfer` — movimentazione interna tra conti propri; non modifica il patrimonio netto (trasferimenti, ricariche, prelievi ATM, addebiti carta di credito)

Le sottocategorie di sistema escono dal seed con una natura predefinita ragionevole. L'utente può sovrascrivere la natura dalle impostazioni. Una sottocategoria senza natura assegnata è visibile nel grafico come segmento "non classificato".
_Avoid_: tipo di spesa, carattere, tag economico
_Avoid_: da classificare

**Trasferimenti** (categoria, type: `transfer`):
Categoria di sistema per movimenti interni tra conti propri dell'utente. Non è né entrata né uscita: non modifica il patrimonio netto dell'utente se tutti i conti sono importati. Tutte le sottocategorie hanno `excludeFromTotals = true` e `nature = transfer`. Non compare nei totali della dashboard né nei grafici di analisi. Sottocategorie canoniche:
- **Trasferimento tra conti** — bonifici interni, ricariche, giroconti; direction-agnostic (copre sia in che out tramite `categorizationPattern.amountSign`)
- **Addebito carta di credito** — pagamento mensile CC dal conto corrente
- **Prelievo contante** — prelievo ATM; le spese cash vengono tracciate come transazioni manuali separate
Migrazione: cat 32 "ignore" viene rinominata e riproposta come "Trasferimenti" (type `system` → `transfer`). Cat 28 "movimenti di liquidità" viene disattivata; le sue transazioni vanno ricategorizzate manualmente.
_Avoid_: movimenti di liquidità (termine precedente, deprecato), ignore (termine tecnico dismesso)

**Rimborsi, cashback e bonus** (categoria, type: `in`):
Rinominata da "sconti, rimborsi e cashback". Copre accrediti derivanti da rimborsi istituzionali o personali, cashback e bonus commerciali. Sottocategorie canoniche:
- **rimborso spese lavorative** — rimborso spese da datore di lavoro
- **rimborso spese sanitarie** — rimborso da assicurazione o SSN
- **rimborso spese viaggi** — rimborso trasferte
- **rimborso ordine online** — reso/rimborso da merchant e-commerce
- **rimborso da persona** — rimborso per spesa condivisa da amici, familiari, partner
- **cashback carta di credito** — cashback da carta
- **cashback acquisti online** — cashback da piattaforme e-commerce
- **cashback programmi fedeltà** — punti/cashback da programmi fedeltà
- **rimborso abbonamento e canoni** — accredito su subscription o canone (es. rimborso canone banca, credito Netflix)
- **bonus promozionale** — bonus una-tantum da promozioni commerciali (es. €50 di benvenuto da Revolut)
_Avoid_: sconti, rimborsi e cashback (nome precedente, deprecato)

**PatternSuggestion** (Suggerimento di pattern):
Candidato regex rilevato automaticamente durante la fase di analisi dell'import, a partire da descrizioni di transazioni non coperte da pattern esistenti che condividono un prefisso comune (≥2 token, ≥2 occorrenze nel file). Campi: `pattern` (prefisso estratto), `matchCount` (occorrenze nel file/import), `detectedAmountSign`, `sampleDescriptions` (max 3 descrizioni originali). Non è un `CategorizationPattern` finché l'utente non assegna una sottocategoria e lo salva. Può essere prodotto sia pre-import (da righe parse) sia post-import su transazioni già persistite (per rianalisi per `fileId`). Al massimo 5 per analisi, ordinate per `matchCount` discendente.
_Avoid_: pattern suggerito, candidato, hint

### Onboarding e primo import

**Onboarding**:
Il flusso di accesso riservato agli utenti con zero transazioni. Attivo finché `count(transaction) === 0`. Composto da 5 step: upload → overview → educazione → categorizzazione → outro. Termina quando l'utente esce verso la dashboard o le impostazioni.
_Avoid_: wizard di registrazione, setup iniziale

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
