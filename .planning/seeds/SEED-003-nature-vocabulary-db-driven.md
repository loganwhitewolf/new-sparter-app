---
id: SEED-003
status: dormant
planted: 2026-08-05
planted_during: post-v3.0 (emersa dal grill di SEED-002)
trigger_when: any milestone adding or renaming a nature, touching the overview chart filter chips, or refactoring the table-filter validation layer
scope: small-medium — a cross-cutting refactor of a shipped subsystem (16 files reference FlowNature), zero new user-facing behaviour
---

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
