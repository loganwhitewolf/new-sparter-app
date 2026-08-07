---
id: SEED-003
status: rejected
planted: 2026-08-05
planted_during: post-v3.0 (emersa dal grill di SEED-002)
closed: 2026-08-07
outcome: core idea (DB-driven vocabulary) REFUTED with measured evidence; the drift it complained about was harvested and fixed instead — quick task 260807-l2c, commits 8390805d + 7420b5f9
trigger_when: do NOT surface for planning. Read it before proposing again that the nature vocabulary be read from the database — the counter-evidence is in "Esito" below
scope: small-medium — a cross-cutting refactor of a shipped subsystem (16 files reference FlowNature), zero new user-facing behaviour
---

> ⚠️ **Seed chiusa il 2026-08-07 come respinta.** Non è stata implementata e non va pianificata.
> Il documento resta perché ha cambiato funzione: da proposta a **verbale di bocciatura con
> evidenza misurata**. La deriva di cui si lamentava è stata invece riparata, in una forma diversa
> da quella che proponeva. Leggi l'**Esito** in fondo prima di riproporre l'idea.

# SEED-003: Il vocabolario delle nature è duplicato tra DB e codice

## Why This Matters

Emersa da una domanda diretta durante il grill di [[SEED-002]]: *"su `NATURE_ALLOWED` non possiamo
prenderli da DB invece che averli hardcodati nel codice?"*

La risposta è che **tre dei quattro `Record` del frontend riscrivono a mano dati che il seed ha già
messo in tabella**:

| in codice (`lib/utils/nature-labels.ts`) | colonna DB già esistente |
|---|---|
| `NATURE_LABELS` | `nature.labelIt` ✓ |
| `NATURE_COLORS` | `nature.color` ✓ |
| `NATURE_ORDER` | `nature.displayOrder` ✓ |
| `NATURE_ALLOWED` (`lib/validations/transactions.ts:155-166`) | derivabile da `nature.code` ✓ |
| `NATURE_ICONS` | **no** — componenti React |
| chip + tooltip (`overview-chart-filters.tsx`) | **no** — copy e struttura UI |

E la duplicazione ha già prodotto **deriva reale**: `NATURE_ALLOWED` contiene ancora `operational`,
`financial`, `extraordinary` — codici **morti**, che `nature-labels.ts:1-2` documenta come rinominati
o dissolti in v2.0 (*"financial → investment, extraordinary → savings; operational dissolved"*).
Nessuno li ha ripuliti perché nessun compilatore li lega alla union.

## L'idea

Derivare da DB ciò che il DB già possiede — label, colore, ordine, allowlist dei filtri — mantenendo
in codice ciò che non può che stare in codice (icone e definizioni dei chip).

## Il contro-argomento, che va superato prima di procedere

Il refactor **non elimina** il cambio di codice quando si aggiunge una nature: icone e chip restano
in codice comunque. Risparmia ~1 dei ~6 punti da toccare, non il cambio.

E costa due cose reali:

1. **Si perde l'aiuto del compilatore.** Oggi `Record<FlowNature, …>` fa **fallire la build** in ogni
   punto dimenticato: la union è una checklist automatica. Con `string`, una nature aggiunta nel DB
   verrebbe renderizzata senza icona e senza chip, in silenzio, in produzione.
2. **Rompe la strategia degli alias legacy per gli URL.** L'allowlist da DB non conterrebbe più un
   codice rinominato, quindi i link salvati con il vecchio valore smetterebbero di funzionare — a
   meno di tenere comunque una mappa di alias **in codice**, cioè tornando al punto di partenza per
   il caso che conta.

Un'ipotesi da valutare: **ibrido** — la union e le icone restano in codice (contratto tipizzato),
mentre label/colore/ordine si leggono da DB con `nature.code` come chiave, e la validazione dei
filtri accetta `union ∪ alias legacy`. Così si toglie la duplicazione dei dati senza perdere
l'esaustività del compilatore.

## When to Surface

**Non** dentro una milestone che aggiunge una nature (es. Warikan): sarebbe scope creep in un
sottosistema spedito. Il sistema dei filtri di tabella ha persistenza via `sessionStorage` con l'URL
come source of truth (ADR 0009/0010) — l'area meno adatta a ricevere un refactor come effetto
collaterale di una feature.

Il momento giusto è una milestone di manutenzione, oppure quando la deriva causa un bug vero.

## Breadcrumbs

- `lib/utils/nature-labels.ts:1-11` — la union `FlowNature` e il commento sui rename di v2.0
- `lib/validations/transactions.ts:155-166` — `NATURE_ALLOWED` con i tre codici morti
- `lib/validations/category.ts:38-47` — il secondo elenco letterale, anch'esso slegato dalla union
- `components/dashboard/overview/overview-chart-filters.tsx:154-161` — i gruppi di chip
- `scripts/seed-data.ts:1397+` — le 8 righe `nature` con `labelIt`, `color`, `displayOrder`
- 16 file referenziano `FlowNature` (misurato durante il grill di SEED-002)
- Decisione di rimandare: [[SEED-002]] D30

## Esito (2026-08-07)

### Cosa è stato raccolto

Il sospetto centrale della seed — *la duplicazione ha già prodotto deriva reale* — **era vero, e
peggiore di come descritto qui**. Verificato sul codice il 2026-08-07:

- `NATURE_ALLOWED` non era duplicato in `lib/validations/category.ts` (quello, `NatureSchema`, aveva
  già gli 8 codici corretti) ma in **`lib/validations/transactions.ts`** e
  **`lib/validations/expense.ts`**, con il commento *"local const to avoid coupling"* a descrivere la
  duplicazione.
- Entrambe le copie contenevano i 3 codici morti **e non contenevano `savings` e `investment`**.
- Le *opzioni* del filtro arrivano invece da `NATURE_ORDER` (8 codici vivi), e `parseStatus`
  (`lib/utils/search-params.ts:73-80`) scarta **in silenzio** ciò che non è in allowlist.
- Quindi non era debito estetico: era un **bug visibile**. Su `/transactions` e `/expenses`
  l'utente selezionava *Risparmio* o *Investimento* e la tabella restava non filtrata, senza errore.
  Due nature su otto non filtravano.

Riparato nel quick task **`260807-l2c`** (commit `8390805d` + `7420b5f9`), ma **non** nella forma
proposta da questa seed: un unico `NATURE_FILTER_VALUES` in `lib/utils/nature-labels.ts` derivato da
`FLOW_NATURE_MEMBERS: Record<FlowNature, true>` — cioè l'**ipotesi ibrida** che questo documento
citava di sfuggita, non la lettura da DB che era la sua tesi.

### Perché la tesi è stata respinta — la misura

Il contro-argomento §1 della seed (*"si perde l'aiuto del compilatore"*) è stato **quantificato**
durante l'esecuzione, aggiungendo temporaneamente una nona nature (`sinking_fund`) alla union e
lanciando `tsc --noEmit`. La build è fallita in **più punti**, non solo nel nuovo:

- `lib/dal/dashboard.ts:863` — `Record<FlowNature | 'unclassified', string>`
- `lib/utils/nature-labels.ts:41, 65, 81` — `NATURE_LABELS`, `NATURE_COLORS`, `NATURE_ICONS`
- `lib/utils/nature-labels.ts:19` — il nuovo `FLOW_NATURE_MEMBERS`

Il vocabolario nature **era già protetto dal compilatore quasi ovunque**. L'allowlist del filtro era
**l'unico buco**, perché era l'unico array scritto a mano — ed è esattamente lì che il bug è
comparso, non altrove. Sostituire `FlowNature` con `string` per leggere da DB avrebbe smontato
**tutte** quelle guardie per risparmiare ~1 punto su ~6 da toccare quando si aggiunge una nature:
non un compromesso, un autogol. La correlazione bug↔punto-non-tipizzato è la prova diretta.

### Cosa la riaprirebbe

Solo uno scenario, e non è quello immaginato qui: se le **label** dovessero diventare
**modificabili dall'utente a runtime** (per-utente, come `userSubcategoryOverride` fa per
`natureId`), allora `NATURE_LABELS` non potrebbe più stare in codice. Ma quello sarebbe un requisito
di prodotto nuovo, non un refactor di manutenzione — e riguarderebbe **solo** le label, mai la union
né l'allowlist dei filtri, che devono restare tipizzate.

Non la riaprono invece: notare di nuovo che `NATURE_LABELS` duplica `nature.labelIt` a DB
(vero, e irrilevante: il costo è una riga per nature, il beneficio del tipo è una build rossa
automatica), né aggiungere una nature nuova (con `FLOW_NATURE_MEMBERS` il compilatore ora elenca da
sé tutti i punti da toccare).
