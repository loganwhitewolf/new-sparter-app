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

### Categorizzazione

**Category** (Categoria):
Raggruppamento di primo livello per classificare le transazioni, di tipo `in` o `out` (es. "Alimentari", "Stipendio").
_Avoid_: gruppo, tipo

**Subcategory** (Sottocategoria):
Classificazione di secondo livello all'interno di una categoria (es. "Caffè & Bar" dentro "Alimentari & Ristorazione").
_Avoid_: tag, voce

**Categorization** (Categorizzazione):
L'atto di assegnare categoria e sottocategoria a una transazione. Può avvenire automaticamente (regex, storico) o manualmente.

**Uncategorized** (Non categorizzato):
Transazione senza categoria e sottocategoria assegnate. È un segnale d'azione, non uno stato definitivo.
_Avoid_: da classificare

**PatternSuggestion** (Suggerimento di pattern):
Candidato regex rilevato automaticamente durante la fase di analisi dell'import, a partire da descrizioni di transazioni non coperte da pattern esistenti che condividono un prefisso comune (≥2 token, ≥2 occorrenze nel file). Campi: `pattern` (prefisso estratto), `matchCount` (occorrenze nel file/import), `detectedAmountSign`, `sampleDescriptions` (max 3 descrizioni originali). Non è un `CategorizationPattern` finché l'utente non assegna una sottocategoria e lo salva. Può essere prodotto sia pre-import (da righe parse) sia post-import su transazioni già persistite (per rianalisi per `fileId`). Al massimo 5 per analisi, ordinate per `matchCount` discendente.
_Avoid_: pattern suggerito, candidato, hint

### Dashboard e analisi

**Reference Period** (Periodo di riferimento):
L'ultimo mese di calendario completato analizzato nella dashboard (es. aprile). È sempre un mese chiuso — mai il mese in corso parzialmente importato.
_Avoid_: mese corrente, periodo attuale

**Baseline**:
La media mensile di spesa per una categoria o sottocategoria calcolata sui 3 mesi di calendario precedenti il Reference Period. Usata per calcolare la Deviation.
_Avoid_: media storica, riferimento

**Deviation** (Deviazione):
La differenza percentuale tra la spesa del Reference Period e la Baseline per una data categoria o sottocategoria. Positiva = speso di più della media, negativa = speso di meno.
_Avoid_: scostamento, variazione, delta (riservato ai confronti KPI periodo-su-periodo)

**Noise Threshold** (Soglia di rumore):
Importo minimo di spesa nel Reference Period (€15) sotto il quale una sottocategoria è esclusa dalla vista Deviation. Evita che micro-spese occasionali generino deviazioni percentuali fuorvianti.

**Preset**:
Filtro temporale della dashboard selezionabile dall'utente (es. `last-month`, `last-3-months`). `last-month` indica il mese di calendario precedente a quello corrente — un periodo completato.
_Avoid_: periodo, filtro, intervallo

## Relationships

- Una **Platform** definisce il formato di un **Import**
- Un **Import** produce zero o più **Transaction**
- Una **Transaction** appartiene a esattamente una **Category** e zero o una **Subcategory**
- Una **Category** contiene zero o più **Subcategory**
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
