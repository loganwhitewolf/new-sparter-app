# Phase 37: flow-nature-chart - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 37-flow-nature-chart
**Areas discussed:** Toggle UI nel grafico, Etichette italiane nature, Editing natura in settings

---

## Toggle UI nel grafico

### Meccanismo toggle

| Option | Description | Selected |
|--------|-------------|----------|
| Legenda cliccabile | Clic su item della legenda Recharts nasconde/mostra quel segmento. Pattern nativo Recharts, zero UI aggiuntiva, label colorate che si grigeano al click. | ✓ |
| Pills toggle sotto il grafico | Badge/pill cliccabili sotto il chart. Più visibili su mobile, ma aggiunge blocco UI separato. | |
| Checkbox nella legenda | Legenda con checkbox espliciti. Più verbose ma semanticamente chiaro. | |

**User's choice:** Legenda cliccabile
**Notes:** Nessuna UI aggiuntiva, pattern nativo Recharts.

### Sincronizzazione URL

| Option | Description | Selected |
|--------|-------------|----------|
| Sincronizzata con URL | router.replace aggiorna ?hidden= ad ogni click. Persiste su back/forward, condivisibile come link. | ✓ |
| Solo in-memory | useState locale. Più semplice, ma si azzera navigando via e tornando al dashboard. | |

**User's choice:** Sincronizzata con URL

### URL quando tutte visibili

| Option | Description | Selected |
|--------|-------------|----------|
| Assente dall'URL | Stato default = nessun ?hidden= nell'URL. Come preset 'last-month' che viene rimosso (pattern OverviewFilters). | ✓ |
| Presente ma vuoto (?hidden=) | Sempre nell'URL anche quando vuoto. | |

**User's choice:** Assente dall'URL

---

## Etichette italiane nature

### Proposta etichette

| Option | Description | Selected |
|--------|-------------|----------|
| Proposta A — termini diretti | essential→Essenziale, discretionary→Discrezionale, operational→Operativo, financial→Finanziario, debt→Debiti, extraordinary→Straordinario | ✓ |
| Proposta B — termini colloquiali | Necessità, Svago, Casa e utenze, Risparmi, Rate e mutui, Imprevisti | |

**User's choice:** Proposta A — termini diretti

### Etichetta null-nature

| Option | Description | Selected |
|--------|-------------|----------|
| Non classificato | Neutro, indica che la classificazione manca. Coerente con ADR 0003. | ✓ |
| Altro | Generico, meno informativo. | |
| Senza natura | Tecnico, meno friendly. | |

**User's choice:** Non classificato

### Posizione mappa etichette

| Option | Description | Selected |
|--------|-------------|----------|
| lib/utils/nature-labels.ts | Modulo dedicato condiviso tra chart e settings Select. | ✓ |
| Inline nel componente chart | Const direttamente in entrate-uscite-chart.tsx. | |

**User's choice:** lib/utils/nature-labels.ts

---

## Editing natura in settings

### Meccanismo edit sottocategorie esistenti

| Option | Description | Selected |
|--------|-------------|----------|
| Select inline nella riga | Select shadcn/ui nella riga subcategory, salvataggio on-change. Nessun dialog aggiuntivo. | ✓ |
| Estendi dialog Rename a 'Edit' | RenameSubcategoryDialog diventa EditSubcategoryDialog con nome + natura. | |
| Dialog separato 'Imposta natura' | Nuovo bottone + dialog solo per natura. | |

**User's choice:** Select inline nella riga

### Scope del Select inline

| Option | Description | Selected |
|--------|-------------|----------|
| Entrambe — sistema e personali | L'utente può impostare natura anche sulle sottocategorie di sistema. Override per-user. | ✓ |
| Solo sottocategorie personali | Sistema mantiene natura del seed, non modificabile. | |

**User's choice:** Entrambe — sistema e personali

### Storage override natura sistema

| Option | Description | Selected |
|--------|-------------|----------|
| user_subcategory_override, nuova colonna nature | Estende tabella override esistente. null=usa default sistema. Stesso pattern del nome personalizzato. | ✓ |
| Nuova tabella user_subcategory_nature | Tabella separata solo per override natura. | |

**User's choice:** user_subcategory_override, nuova colonna nature

---

## Claude's Discretion

- Palette colori per le 6 nature nel chart
- Colore e visibilità del segmento "Non classificato"
- Assegnazione specifica delle nature alle ~120 sottocategorie di sistema nel seed

## Deferred Ideas

- Pagina breakdown per natura — vista dedicata con dettaglio spese per natura (potenziale v1.12)
- Segmento "Non classificato" sempre visibile anche a zero (possibile evoluzione futura)
