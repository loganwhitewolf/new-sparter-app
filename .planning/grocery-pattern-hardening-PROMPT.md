# Prompt — Hardening del pattern regex `spesa-quotidiana`

> Documento autosufficiente da passare all'agent che eseguirà il lavoro.
> Ogni match riportato qui sotto è stato **verificato eseguendo la regex**, non dedotto.
> Raccolta evidenze: 2026-07-29.

---

## 0. Mandato

Il pattern di sistema che categorizza la spesa alimentare (`spesa-quotidiana`) contiene un
numero elevato di alternative che sono **abbreviazioni, sigle, parole generiche o cognomi**.
Alcune producono falsi positivi su descrizioni bancarie reali.

**Obiettivo**: rendere l'insieme delle alternative **consistente e difendibile** — ogni alternativa
deve identificare un esercente alimentare, non un frammento di boilerplate bancario, non una parola
generica, non un cognome.

**Non** è un mandato di riscrittura da zero: la maggior parte delle 93 alternative è corretta e va
lasciata intatta. Il lavoro è chirurgico.

⚠️ **Vincolo di processo**: passa da `/gsd-quick` prima di modificare i file. È una modifica a un
pattern di sistema che tocca la categorizzazione di tutti gli utenti.

---

## 1. Il caso che ha innescato il lavoro

Transazione reale da **Fineco**, bonifico SEPA, classificata automaticamente come `spesa-quotidiana`:

```
Ben: TRAVEL SPECIALIST Ins: 24/07/2026 14:41:44 Da: INTERNET
Iban: IT68Y0200801109000105119318 TransID: 2607243291974987 480320046200IT
Cau: SALDO PRATICA VIAGGIO NUMERO 25/000164 - Viaggio thailandia — Bonifico SEPA Italia
```

**Catena causale completa:**

1. Il token `Ins:` è l'**etichetta di campo** dell'estratto (data di inserimento), non parte della causale.
2. `descriptionStripPattern` di Fineco è `\s+Carta N\..*$` (`scripts/seed-data.ts:1067`) — taglia solo
   la coda delle transazioni con carta. **I bonifici SEPA arrivano con tutti i metadati intatti**
   (`Ben:`, `Ins:`, `Da:`, `Iban:`, `TransID:`, `Cau:`).
3. Il matcher (`lib/services/categorization-match.ts:35`) compila con flag `'i'` → case-insensitive.
   La variante "stripped" (riga 36) rimuove solo i token **puramente numerici**: le etichette di
   campo sopravvivono a entrambi i tentativi di match.
4. Il pattern `spesa-quotidiana` contiene `\bins\b` (per la catena **IN'S Mercato**). In `Ins:` il
   token è delimitato da spazio a sinistra e `:` a destra — entrambi word boundary validi. Match.
5. Il pattern ha **`priority: 10`, la più alta di tutto il set** → viene valutato per primo, prima
   di qualunque altro.
6. **Non esiste alcun pattern per le agenzie viaggi**: l'unico pattern travel-related è
   `trasporto` (priority 100) e copre voli/traghetti/autonoleggio, non `\bviaggi\b` / `travel` /
   `\bagenzia\b`. Anche senza il falso positivo, questa transazione sarebbe rimasta non categorizzata.

**Trappola da non sbagliare**: rimuovere `\bins\b` **non risolve il bug**. Esiste una seconda
alternativa, `\bin'?s\b`, con apostrofo opzionale, che matcha `ins` esattamente come la prima
(verificato). Vanno corrette **entrambe**. `\bins\b` è del tutto ridondante rispetto a `\bin'?s\b`.

---

## 2. File e strumenti coinvolti

| File | Ruolo |
|---|---|
| `scripts/seed-patterns-data.ts:15-22` | **il pattern da modificare** — unico pattern con `subCategorySlug: "spesa-quotidiana"`, `confidence: 0.9`, `priority: 10` |
| `scripts/seed-patterns-data.ts:378+` | `validateSystemCategorizationPatterns()` — valida slug esistenti, chiavi duplicate, regex invalide |
| `scripts/seed-patterns.ts` | runner: **full replace** di tutti i pattern di sistema (`userId = null`); i pattern utente sono preservati. `yarn db:seed-patterns` |
| `lib/services/categorization-match.ts` | `applyTier1Regex` — matcher di produzione, single source of truth |
| `scripts/audit-pattern-overlaps.ts` | **audit di overlap già esistente**: usa il matcher di produzione per non divergere mai dal comportamento reale. `yarn tsx scripts/audit-pattern-overlaps.ts` |
| `tests/seed-patterns.test.ts` | test sul set di pattern |
| `tests/categorization-match.test.ts` | test sul matcher |
| `tests/import-service.test.ts` | test di integrazione dell'import |

---

## 3. Inventario delle alternative problematiche

Il pattern ha **93 alternative**. Quelle sotto sono le sole da valutare — le altre sono
identificatori specifici e corretti (`esselunga`, `carrefour`, `conad`, `lidl`, `eurospin`,
`tigros`, `despar`, `naturasì`, `eataly`, `macelleria`, `pescheria`, `panificio`, `caseificio`…)
e **vanno lasciate invariate**.

### Tier A — abbreviazioni e sigle che collidono con boilerplate bancario

| Alternativa | Esercente inteso | Match verificato | Problema |
|---|---|---|---|
| `\bins\b` | IN'S Mercato | `Ins: 24/07/2026` ✅ | il bug; **ridondante** con `\bin'?s\b` |
| `\bin'?s\b` | IN'S Mercato | `Ins: 24/07/2026` ✅ | stessa collisione, apostrofo opzionale |
| `\bmd\b` | MD Discount | `RIF MD 4471 PAGAMENTO` ✅ | 2 caratteri: collide con qualsiasi sigla |
| `\bu2\b` | U2 (gruppo Unes) | `BIGLIETTI CONCERTO U2` ✅ | catena vs band |
| `\bu!\b` | U! (gruppo Unes) | *nessuno* ❌ | **alternativa morta**: `U! Supermercato` e `SPESA U!` non matchano — dopo `!` (non-word) il `\b` richiede un carattere di parola adiacente. Non ha mai funzionato |
| `\ba&o\b` | A&O | — | 3 caratteri con `&`: funziona, ma da rivalutare per coerenza |
| `\bdpi[ùu]\b` | DPiù | — | rischio basso, citata per completezza |

### Tier B — parole generiche che catturano fuori dominio

| Alternativa | Match verificato | Problema |
|---|---|---|
| `\bcoop\b` | `COOP SOCIALE LA SPERANZA` ✅ · `Coop. Agricola Rossi` ✅ | in Italia "coop" abbrevia **cooperativa** di qualunque settore |
| `\bsuper\b` | `PAGAMENTO SUPER BOLLO AUTO` ✅ | genericissima |
| `\bmarket\b` | `FLOWER MARKET SRL` ✅ | qualunque "market" non alimentare |
| `\bprix\b` | `GRAND PRIX MONZA` ✅ | e rende `\bprix quality\b` ridondante |
| `\biper\b` | `IPER TESORO` ✅ | prefisso italiano comune |
| `\bagor[aà]\b` | `FARMACIA AGORA` ✅ | "Agorà" è nome d'azienda diffusissimo (farmacie, teatri, centri culturali) |
| `\bsigma\b` | `SIGMA ALDRICH SRL` ✅ | catena vs aziende tecniche |
| `\bselex\b` | — | catena vs Selex ES / gruppo Leonardo |
| `\bsisa\b` | — | 4 caratteri, collide con sigle |
| `\bpenny\b` | — | catena vs nome proprio |
| `\btigre\b` | — | catena vs parola comune |
| `\bsimply\b` | — | catena vs parola inglese comune |
| `\bforno\b` | `PIZZERIA AL FORNO` ✅ | **collisione cross-categoria**: `priority 10` batte `ristoranti` (`priority 30`) |

### Tier C — cognomi italiani comuni

Nei bonifici il campo `Ben:` contiene un **nome di persona**. Queste alternative lo intercettano:

| Alternativa | Match verificato |
|---|---|
| `\bpaladini\b` | `Ben: PALADINI MARIO` ✅ |
| `\bgabrielli\b` | `Ben: GABRIELLI LUCA` ✅ — e rende `\bmagazzini gabrielli\b` ridondante |
| `\brossetto\b` | `ROSSETTO GIULIA` ✅ — inoltre "rossetto" è un **cosmetico** (collisione con cura personale) |
| `\bgulliver\b` | `GULLIVER VIAGGI` ✅ |
| `\bvisotto\b` · `\btosano\b` · `\bbennet\b` · `\bcastoro\b` · `\bcadoro\b` | — | cognomi o nomi di luogo |

### Tier D — problemi strutturali

- **`mercato.*local`** — l'unica alternativa senza `\b` e l'unica con `.*` non delimitato:
  `MERCATO SRL Cau: SERVIZIO LOCALE` matcha ✅ attraversando campi diversi della descrizione.
  È l'unico costrutto che può fare da ponte tra metadati non correlati.

- **Ridondanze da eliminare** (l'alternativa a sinistra è già coperta da quella a destra):

  | Ridondante | Coperta da |
  |---|---|
  | `\bins\b` | `\bin'?s\b` |
  | `\bortofrutta\b` | `\bortofrutt[ai]\b` |
  | `\blatticini\b` | `\blatticin[io]\b` |
  | `\bprix quality\b` | `\bprix\b` |
  | `\bnova coop\b` | `\bcoop\b` |
  | `\bmagazzini gabrielli\b` | `\bgabrielli\b` |
  | `\bal[iì] super\b` | `\bsuper\b` |

  ⚠️ Attenzione: se decidi di **restringere o rimuovere** l'alternativa di destra, la ridondanza
  scompare e quella di sinistra torna necessaria. Valuta le due colonne insieme, non in sequenza.
  Nota anche che `\bsupermercati al[iì]\b` **non** è ridondante con `\bsuper\b` (manca il word
  boundary dopo "super" in "supermercati").

- **Verifica anche `\brisparmio casa\b`**: Risparmio Casa è una catena casalinghi/drugstore, non
  alimentare. È una questione di *collocazione di categoria*, non di abbreviazione — segnalala
  senza risolverla se esce dallo scope concordato.

---

## 4. Cosa deve produrre l'agent

### 4.1 Criterio di decisione da applicare a ogni voce della §3

Per ciascuna alternativa, scegli **una** azione e **motivala in una riga**:

- **RESTRINGI** — aggiungi contesto disambiguante, che è l'opzione preferita quando l'esercente
  esiste davvero. Esempi di forma: `\bin'?s\s+mercato\b`, `\bmd\s+discount\b`,
  `\bu2\s+supermercat\w*\b`, `\bmagazzini\s+gabrielli\b`, `\bsupermercat\w*\s+rossetto\b`.
- **RIMUOVI** — quando il rapporto segnale/rumore non è recuperabile o l'alternativa è ridondante
  o morta (`\bu!\b`).
- **MANTIENI** — quando il rischio teorico non è realistico su descrizioni bancarie italiane.
  Va motivato, non assunto.

Principio guida da rispettare, già in vigore nel progetto: **un falso positivo costa più di una
transazione non categorizzata**. Una transazione non categorizzata è un segnale d'azione visibile
(esiste un nudge in dashboard); un falso positivo è una bugia silenziosa nei totali.

### 4.2 Regola di consistenza da stabilire ed enunciare

Il mandato include "renderli più consistenti". Deriva dal lavoro una **regola scritta** e mettila
come commento sopra il pattern in `seed-patterns-data.ts`, così le prossime aggiunte da
regex-discovery la seguono. Direzione suggerita, da confermare con l'evidenza raccolta:

> Un'alternativa di ≤4 caratteri, o che coincide con una parola italiana comune, o con un cognome,
> deve portare contesto disambiguante (`mercato`, `supermercat\w*`, `discount`, `market`) e non può
> stare da sola.

### 4.3 Estensione dell'audit

**Estendi `scripts/audit-pattern-overlaps.ts`** — non riscriverlo, e non reimplementare la logica
di match: quel file usa deliberatamente `applyTier1Regex` come single source of truth per non
divergere dal comportamento di produzione. Aggiungi un check che segnali le alternative rischiose
di **qualunque** pattern di sistema:

- alternative letterali di lunghezza ≤4 caratteri;
- alternative che matchano una lista di **descrizioni-esca** di boilerplate bancario italiano —
  almeno le etichette Fineco/Intesa: `Ben:`, `Ins:`, `Da:`, `Iban:`, `TransID:`, `Cau:`,
  `Carta N.`, `Bonifico SEPA`, `Bonifico Italia`, `Rif.`, `Op.`;
- alternative senza `\b` o con `.*` non delimitato.

L'output deve essere leggibile e ripetibile, così l'audit diventa una rete di sicurezza permanente
e non un'analisi una volta sola.

### 4.4 Test di regressione

Aggiungi test (in `tests/`, nomi in inglese) che dimostrino:

1. La descrizione Fineco completa della §1 **non** matcha `spesa-quotidiana`.
2. Ogni caso di falso positivo verificato in §3 non matcha più: `COOP SOCIALE`, `Coop. Agricola`,
   `SUPER BOLLO AUTO`, `FLOWER MARKET`, `GRAND PRIX`, `FARMACIA AGORA`, `SIGMA ALDRICH`,
   `RIF MD 4471`, `CONCERTO U2`, `Ben: PALADINI MARIO`, `Ben: GABRIELLI LUCA`, `ROSSETTO GIULIA`,
   `GULLIVER VIAGGI`, `MERCATO SRL Cau: SERVIZIO LOCALE`.
3. **Nessuna regressione sui veri positivi** — questo è il test che protegge il lavoro. Copri
   almeno: `ESSELUNGA`, `COOP LIGURIA`, `IN'S MERCATO`, `MD DISCOUNT`, `LIDL ITALIA`,
   `CARREFOUR EXPRESS`, `SUPERMERCATO IL GIGANTE`, `PENNY MARKET`, `TIGROS`, `NATURASI`,
   `MACELLERIA ROSSI`, `PANIFICIO CENTRALE`, `ORTOFRUTTA DA MARIO`.
   Per ogni alternativa che **restringi**, aggiungi il vero positivo corrispondente nella nuova forma.
4. `validateSystemCategorizationPatterns()` resta verde (nessuno slug mancante, nessuna chiave
   duplicata, nessuna regex invalida).

### 4.5 Nuovo pattern per le agenzie viaggi

Aggiungi un pattern per il caso positivo scoperto: `travel specialist`, `agenzia viaggi`,
`\bviaggi\b`, `booking`, `expedia`, `\btour operator\b` → sottocategoria da scegliere tra quelle
esistenti sotto la categoria **Vacanze** (leggi la tassonomia in `scripts/seed-data.ts`, non
inventare slug — `validateSystemCategorizationPatterns` fallirebbe).

Attenzione alla **priority**: con `priority 10` sul pattern grocery, quest'ultimo vince sempre.
Verifica che dopo il tuo fix i due non collidano più; se collidono ancora, l'ordinamento va
riconsiderato **esplicitamente**, non aggirato con una priority arbitraria.

### 4.6 Report

Scrivi `.planning/grocery-pattern-hardening-REPORT.md` con:

- una tabella `alternativa | azione | motivazione | prima → dopo`;
- la regola di consistenza enunciata in §4.2;
- l'output dell'audit esteso prima e dopo;
- l'elenco dei problemi **trovati ma lasciati fuori scope** (vedi §5), così non si perdono.

---

## 5. Fuori scope — segnalare, non risolvere

Queste cose sono emerse dall'analisi ma **non** vanno toccate in questo lavoro:

- **`descriptionStripPattern` per i bonifici SEPA.** La correzione strutturale sarebbe rimuovere i
  metadati (`Ben:`, `Ins:`, `Da:`, `Iban:`, `TransID:`, `Cau:`) prima del matching. Ma quel campo
  entra nel calcolo del `descriptionHash`: cambiarlo tocca **aggregazione delle spese e
  deduplicazione** su dati già importati (ADR 0007). Richiede una valutazione a sé, probabilmente
  con migrazione. Documentalo nel report come tech debt.
- **Ri-categorizzazione retroattiva** delle transazioni già classificate male dal pattern attuale.
  È una decisione di prodotto separata: chiedi, non decidere.
- **Le altre 20+ alternative corrette** del pattern grocery.
- **Gli altri pattern di sistema**: l'audit esteso li segnalerà, ma **non correggerli** in questo
  giro. Il report elenca cosa è emerso.
- **La collocazione di `\brisparmio casa\b`** (catena casalinghi in un pattern alimentare):
  segnalala, non spostarla.

---

## 6. Definition of done

- [ ] Ogni voce della §3 ha un'azione decisa e motivata nel report.
- [ ] La descrizione Fineco della §1 non matcha più `spesa-quotidiana`, provato da un test.
- [ ] **Entrambe** `\bins\b` e `\bin'?s\b` sono state affrontate (non solo la prima).
- [ ] L'alternativa morta `\bu!\b` è rimossa o corretta.
- [ ] Le ridondanze della §3 Tier D sono risolte coerentemente con le decisioni prese sul Tier B/C.
- [ ] Nessuna regressione sui veri positivi (§4.4 punto 3 verde).
- [ ] Regola di consistenza scritta come commento sopra il pattern.
- [ ] `scripts/audit-pattern-overlaps.ts` esteso e verde, con output nel report.
- [ ] Nuovo pattern agenzie viaggi aggiunto, con slug esistente, senza collisione col grocery.
- [ ] `validateSystemCategorizationPatterns()` verde · lint · typecheck · suite di test verde ·
      `yarn check:language` verde (identificatori, commenti e nomi dei test in inglese).
- [ ] `.planning/grocery-pattern-hardening-REPORT.md` scritto.
- [ ] **Nessun accesso al DB di produzione.** `yarn db:seed-patterns` fa full replace dei pattern
      di sistema: eseguirlo è un'operazione da operatore, non da agent. Il deploy va **proposto**
      nel report, non eseguito.
