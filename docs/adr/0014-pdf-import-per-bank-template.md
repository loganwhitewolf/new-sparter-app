# Import PDF per-banca via template, normalizzato a `ParsedImportFile`

## Status

accepted

## Contesto

Alcune Platform (es. Trade Republic) forniscono l'estratto come **PDF** anziché CSV/XLSX. Un PDF non dichiara la propria struttura: non ha header machine-readable, ogni banca ha un layout grafico proprio, e una stessa cifra può comparire in più sezioni-specchio dello stesso documento. L'intero pipeline esistente (detector, `normalizeTransactionRow`, dedup per hash, preview, regex-discovery) assume invece righe tabellari con colonne nominate.

## Decisione

1. **Per-banca, non generico.** Niente "parser PDF universale": per ogni banca un template deterministico che riconosce il documento per marker (es. "TRADE REPUBLIC" + "TRANSAZIONI SUL CONTO") ed estrae solo la **sezione canonica dei movimenti**, scartando riepiloghi, posizioni e sezioni-specchio. L'astrazione generica emergerà da più casi concreti, non da uno.
2. **Normalizzazione a `ParsedImportFile`.** Il parser PDF produce la stessa struttura intermedia `{headers, rows}` di CSV/XLSX, con header **sintetici** (contratto interno dell'estrattore, non testo presente nel file). Tutto il pipeline a valle resta invariato: il detector ri-riconosce la Platform matchando gli header sintetici contro l'Import Format seminato.
3. **Segno via posizione + validazione col saldo.** Le coordinate X dei token (libreria `unpdf`, serverless-ready) attribuiscono ogni importo alla colonna entrata/uscita corretta; la catena dei saldi progressivi (`saldo_prec + importo == saldo_corr`) certifica che nessuna riga sia stata persa o fusa. Disallineamento → errore esplicito, **mai** import silenzioso di numeri sbagliati.

## Considerato e scartato

- **Parser PDF generico/euristico**: su dati finanziari un'estrazione "quasi giusta" è peggio di nessun import; layout mai visti rompono silenziosamente.
- **Percorso PDF che bypassa il detector**: duplica il pipeline e perde il riuso di preview/scoring/wizard.
- **Segno dal solo flusso testuale**: la colonna vuota scompare nell'appiattimento → ogni uscita verrebbe importata come entrata.
- **`pdf-parse`**: dà solo testo piatto, niente coordinate → incompatibile con l'approccio posizionale.

## Conseguenze

- Data e importo TR sono già coperti da `parseBankDate` (mesi italiani) e `parseItalianAmount` (€, `1.006,85`) + `amountType: 'separate'`.
- Le parti seriali variabili nelle descrizioni (es. `quantity: <num>` nei savings plan) si neutralizzano con `descriptionStripPattern` minimale, così le ricorrenti aggregano in una sola Expense. Ampliabile per-Platform; agisce solo sui **nuovi** import (gli hash sono persistiti).
- La categorizzazione automatica delle descrizioni TR è un follow-up separato (regex-discovery + seed-patterns), fuori dallo scope dell'import.
