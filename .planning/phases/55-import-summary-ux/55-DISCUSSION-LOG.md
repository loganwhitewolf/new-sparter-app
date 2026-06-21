# Phase 55: import-summary-ux - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-21
**Phase:** 55-import-summary-ux
**Areas discussed:** Cue "discovery separata" (SUMUI-03), Separazione visiva regex vs single-cat (SUMUI-02), Rimozione legacy detectPatternSuggestions

---

## Cue "Discovery è un passo separato" (SUMUI-03)

### Q1: Dove vive il cue?

| Option | Description | Selected |
|--------|-------------|----------|
| Nella suggestions page | Sotto-titolo o nota in /suggestions. CTA post-import invariato. | ✓ |
| Nel CTA post-import + suggestions page | Aggiungere riga secondaria nel CTA già esistente. | |
| Nell'analyze page, prima del bottone Conferma | Nota pro-attiva prima della conferma. | |

**User's choice:** Nella suggestions page — CTA post-import lasciato invariato.

### Q2: Che tono ha il cue nella suggestions page?

| Option | Description | Selected |
|--------|-------------|----------|
| Sotto-titolo descrittivo | p.text-muted-foreground sotto h1. Nessun nuovo elemento UI. | ✓ |
| Info banner leggero | Alert info sopra i risultati. | |
| Solo nel sotto-titolo esistente | Modificare il p già presente. | |

**User's choice:** Sotto-titolo descrittivo — paragrafo aggiuntivo, non sostituzione.

---

## Separazione visiva regex vs single-cat (SUMUI-02)

### Q1: Quanto deve essere esplicita la distinzione visiva?

| Option | Description | Selected |
|--------|-------------|----------|
| Headings chiari + intro text | Rendere i titoli di sezione più espliciti con un breve descrittore. La distinzione card-pesante vs row-leggera già esiste. | ✓ |
| Icona + colore diversi per sezione | Aggiungere icona e accent di colore all'header. | |
| Solo il layout attuale | Aggiustare solo testi/label. | |

**User's choice:** Headings chiari + intro text — nessun elemento visivo aggiuntivo.

### Q2: I single-cat items devono avere un'azione?

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only, solo informativi | Nessun CTA. L'utente categorizza manualmente dalla pagina Spese. | ✓ |
| Link diretto alle spese | Link filtrato per descrizione. | |
| Quick-categorize inline | Mini subcategory picker inline. | |

**User's choice:** Read-only — solo informativi, nessuna azione.

---

## Rimozione legacy detectPatternSuggestions

### Q1: Il TODO Phase 55: remove va eseguito?

| Option | Description | Selected |
|--------|-------------|----------|
| Sì, rimuovi tutto | Rimuovi chiamata, campo tipo, SuggestionSection da ImportPreview. | ✓ |
| Rimuovi la chiamata, tieni il tipo | Campo zombie nel tipo. | |
| Lascia il TODO | Rimanda a fase futura. | |

**User's choice:** Rimozione completa — chiamata, tipo, e SuggestionSection dall'analyze page.

### Q2: Cosa fare con la funzione detectPatternSuggestions() stessa?

| Option | Description | Selected |
|--------|-------------|----------|
| Elimina funzione + test | Se nessun consumer rimane, eliminare funzione e test. | ✓ |
| Tieni, ma non esportare | Downgrade a funzione interna. | |
| Lascia la decisione al planner | Claude discretion via grep. | |

**User's choice:** Elimina funzione + test — con verifica grep preventiva sui consumer.

---

## Claude's Discretion

- Exact Italian copy per il sotto-titolo SUMUI-03 nella suggestions page
- Exact heading labels per le due sezioni in SuggestionSection
- 1-line descriptor sotto ogni heading di sezione
- Dove applicare il cap 10 sampleRows (render time vs service/type)
- Se `detectPatternSuggestionsWithMeta()` va anche eliminata (dipende da grep)

## Deferred Ideas

- Link da single-cat items alla pagina Spese filtrata per descrizione
- Quick-categorize inline per single-cat items
- Bulk "ricontrolla tutto" re-check (già deferred in Phase 54)
- Dismissal suggestions (DISM-01 — REQUIREMENTS.md Future Requirements)
