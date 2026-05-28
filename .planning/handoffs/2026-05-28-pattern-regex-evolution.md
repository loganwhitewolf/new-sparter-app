# Handoff — Evoluzione PatternSuggestion / CategorizationPattern (regex v2)

**Data**: 2026-05-28
**Origine**: Sessione `/grill-with-docs` su feedback Product Owner (Sessione A — Onboarding).
**Motivo dell'handoff**: durante il grilling sull'onboarding flow è emerso che la feature pattern regex attuale è troppo prematura per essere inclusa nello Step di categorizzazione. Estratta come sessione separata per non saturare il contesto della Sessione A.

## Scopo di questo documento

Fornire a una nuova sessione `/grill-with-docs` tutto il contesto necessario per produrre un ADR (probabilmente `0005-pattern-regex-v2.md`) che definisca la prossima evoluzione del sistema pattern. Non è una specifica, è un *brief*: la sessione deve grillare per arrivare alle decisioni.

## Stato attuale della feature

### Cosa esiste oggi (riferimento `docs/adr/0002-pattern-suggestion-detection.md`)

- **PatternSuggestion**: candidato regex rilevato durante `analyzeImportFile`.
  - Algoritmo: token-prefix con numeric stripping. Tokenizza la `description` per whitespace, scarta token puramente numerici (reference, date, importi), estrae il **longest common prefix**. Emette una suggestion se ≥2 descrizioni uncategorized condividono un prefisso di ≥2 token.
  - Scope: solo transazioni uncategorized, solo intra-file (≥2 occorrenze nello stesso file/import).
  - Cap UI: max 5 suggestion per analisi, ordinate per `matchCount` desc.
  - Effimero: dismissed suggestions non persistite, ricalcolate ad ogni analisi.

- **CategorizationPattern** (`lib/db/schema.ts:418`): la regex *promossa* dall'utente. Persistita per-utente, applicata in Tier 1 della categorizzazione.

- **Pagine UI esistenti**:
  - `app/(app)/import/[fileId]/suggestions/page.tsx` — review e promozione pre-import
  - Re-analysis post-import su transazioni persistite filtrate per `fileId`

### Limiti riconosciuti dal PO

L'attuale algoritmo cattura **solo** il caso "stesso prefisso, parte variabile in coda" all'interno **dello stesso file**. Due categorie di pattern reali non sono coperte:

#### Caso 1 — Pattern con data inline (auto-approvabile)

Descrizioni in cui l'unica parte variabile è una data:

```
MACELLAIO SPESA DEL 20/05/2025
MACELLAIO SPESA DEL 22/05/2025
MACELLAIO SPESA DEL 28/05/2025
```

Comportamento desiderato dal PO:
- Quando l'utente categorizza una di queste transazioni (es. come `Alimentari · Freschi`), il sistema dovrebbe **auto-promuovere** un pattern che esclude la data e ri-applicarsi a tutte le transazioni storiche/future con stessa "forma".
- Implica un meccanismo di **date-stripping nell'hashing**: l'hash deve essere calcolato sulla descrizione *senza* le porzioni-data riconosciute.
- Domanda aperta per il grilling: cosa significa "auto-approvato"? Crea silenziosamente un `CategorizationPattern` senza mostrare nulla all'utente? O lo conferma con un toast tipo _"hai categorizzato 1 transazione, ne ho categorizzate altre 12 simili"_?

#### Caso 2 — Pattern con identifier variabili (stesso significato)

Descrizioni che si riferiscono allo **stesso evento concettuale** ma contengono identificativi diversi che oggi le rendono "diverse":

```
PAGAMENTO POS CARTA **1234 ESSELUNGA
PAGAMENTO POS CARTA **5678 ESSELUNGA
```

oppure bonifici con causale variabile ma significato omogeneo:

```
BONIFICO DA MARIO ROSSI — RIMBORSO CENA
BONIFICO DA MARIO ROSSI — REGALO COMPLEANNO
```

Comportamento desiderato:
- Il sistema deve riconoscere che la parte "Esselunga" o "da Mario Rossi" è il **token significativo**, e che `**1234`, `**5678`, e la causale sono token rumorosi da ignorare.
- Implica un'estensione del numeric-stripping a una nozione più ampia di "identifier-stripping": codici carta mascherati, causali libere, codici riferimento.

## Modello mentale del PO

> _"Dovremo evolverla per gestire due tipi di pattern: le spese che contengono al loro interno solo la data e che devono essere trattate come pattern regex auto approvati (escludere la parte data dall'hash), oppure le spese che sono riferite alla stessa cosa ma hanno dentro identificativi diversi (codici carte diverse oltre alla data oppure bonifici che mostrano la causale che rende la spesa diversa ma che ha lo stesso significato)."_

Due tipi distinti:
1. **Auto-pattern** (date-only varianti) — l'utente non deve confermare nulla
2. **Suggested pattern esteso** (identifier varianti) — il sistema lo suggerisce all'utente che conferma

## Decisioni emerse e fuori scope

- **Pattern regex NON è in onboarding**. Sessione A ha deciso che lo Step di categorizzazione iniziale usa solo categorizzazione manuale 1-a-1 con autocomplete. La pagina `/import/[fileId]/suggestions` continuerà a esistere per gli utenti già onboarded, ma in onboarding non si vede.
- **Quando l'evoluzione v2 sarà completa**, si può riconsiderare l'inserimento di uno step pattern in onboarding.

## Vincoli del progetto da non dimenticare

- Operazione di scoperta pattern resta **sincrona** dentro `analyzeImportFile` (no async, no ML/LLM — vedi ADR 0002 "alternatives considered").
- `descriptionHash` è oggi usato per Tier 2 (history-based categorization) — cambiarne il calcolo ha impatto su `expense.descriptionHash` (vedi `lib/db/schema.ts:359`) e su tutta la logica history. Domanda critica: il date-stripping è un **nuovo hash** (es. `normalizedDescriptionHash`) o **sostituisce** quello esistente?
- L'ADR 0002 dichiara esplicitamente "literal duplicates only suppressed" — il nuovo schema deve articolare come questa regola evolve.
- Schema attuale rilevante: `categorizationPattern` (`lib/db/schema.ts:418`), `expense` con `descriptionHash` (`lib/db/schema.ts:359`), `transaction` (`lib/db/schema.ts:388`).

## Domande aperte da grillare nella sessione futura

Da risolvere in ordine (dipendenze):

1. **Nomenclatura**: il "pattern auto-approvato" è una variante del `CategorizationPattern` esistente (con un flag `autoApproved`) o una nuova entità? Quali termini canonici usiamo? (`CONTEXT.md` da aggiornare)
2. **Date detection**: come riconosciamo "una data" in una descrizione? Lista di regex (`dd/mm/yyyy`, `dd-mm-yy`, `dd.mm`, "del 20 maggio")? Una sola pattern o multi-format? Italian-only o internazionale?
3. **Hashing**: il date-stripping crea un secondo hash o sostituisce quello attuale? Cosa succede a `descriptionHash` esistente (migration + backfill)?
4. **Auto-promotion UX**: silenzioso, con toast, con summary post-import? Cosa fare se l'auto-promotion crea un pattern errato (rollback semplice?)?
5. **Identifier-stripping**: lista whitelist di rumori da ignorare (codici carta `**\d{4}`, causali tra trattini, ecc.) o un classificatore? Quali sono i casi reali nei file Poste/Intesa/Fineco/Unicredit/Revolut?
6. **Retroattività**: quando un nuovo pattern viene creato, ri-categorizza le transazioni storiche già persistite? (Riferimento: REVAL-01 in PROJECT.md, candidato v1.11.)
7. **Conflitti**: cosa succede se due pattern auto-approvati matchano la stessa transazione? Priorità per specificità?
8. **Tier ordering**: dove cade il "pattern auto-approvato" nei tier — è ancora Tier 1 o un nuovo Tier 0?

## Punti di partenza per il grilling

- Chiedere al PO di fornire **20-30 descrizioni reali** dai suoi file (Poste, Intesa, Fineco, Revolut, Satispay) per concretizzare i casi limite di date-detection e identifier-stripping. Sessione C (robustezza import platforms) ha bisogno degli stessi file — coordinare.
- Verificare se la fase v1.10 (Pattern Suggestions appena shippata) ha già intercettato esempi reali utili.
- Cross-reference con `phases/37-flow-nature-chart/` (ultime SUMMARY) — verificare che decisioni precedenti su FlowNature non vincolino questa evoluzione.

## Output atteso dalla sessione futura

- `docs/adr/0005-pattern-regex-v2.md` (o numero successivo libero)
- Aggiornamento di `CONTEXT.md` con eventuali nuovi termini (es. `AutoPattern`, `NormalizedDescription`, `DateToken`)
- Eventuale `docs/adr/0006-` separato se "auto-promotion UX" emerge come decisione hard-to-reverse a sé stante
- Task GSD per pianificare la phase implementativa (questa NON è una phase plan — è solo il design contract).

## Non includere in questa sessione

- UX dell'onboarding (è la Sessione A, in corso)
- Robustezza dei parser di platform (Poste fallisce, Satispay frizione) — è la Sessione C
- Tassonomia categorie — è la Sessione B
- Manual expense entry — è la Sessione D
