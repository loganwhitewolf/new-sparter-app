# Phase 35: import-review-promotion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — questo log preserva la cronologia della discussione.

**Date:** 2026-05-23
**Phase:** 35-import-review-promotion
**Mode:** discuss (default)
**Areas discussed:** Promozione — form e interazione, Subscription gate per la promozione, Layout e stile visivo della sezione suggerimenti

---

## Area 1: Promozione — form e interazione

### Q1: Come funziona la promozione di una suggestion?

**Opzioni presentate:**
| Opzione | Descrizione |
|---------|-------------|
| Form inline semplificata | Solo selector subcategoria + bottone, campi pre-compilati invisibilmente |
| Dialog dedicata semplificata | Modal con pattern readonly + selector |
| Adattamento CreatePatternDialog | Form completa con campi pre-compilati ma modificabili |

**Scelta:** Form inline semplificata

---

### Q2: Dopo una promozione riuscita — card scompare, marcata o toast?

**Opzioni presentate:**
| Opzione | Descrizione |
|---------|-------------|
| Marcata come creata (badge / stato visivo) | Card rimane con badge, form disabilitata |
| Scompare dalla lista | Card sparisce dopo promozione |
| Toast di successo, card invariata | Toast + card rimane interattiva |

**Scelta:** Marcata come creata (badge / stato visivo)

---

## Area 2: Subscription gate per la promozione

### Q3: Promuovere una suggestion a pattern deve essere gated per piano?

**Opzioni presentate:**
| Opzione | Descrizione |
|---------|-------------|
| Sì, stesso gate di createPatternAction | Utenti free vedono ma non possono promuovere |
| No, libero per tutti i piani | Nuova promoteSuggestionAction bypassa canManageCustomPatterns |

**Scelta:** No, libero per tutti i piani

**Note:** Coerente con D-03 di phase 34 (detection disponibile a tutti). La promozione è parte integrante dell'esperienza di discovery, non un'operazione premium separata.

---

## Area 3: Layout e stile visivo della sezione suggerimenti

### Q4: Dove e come appaiono le suggestion nella pagina di analisi?

**Opzioni presentate:**
| Opzione | Descrizione |
|---------|-------------|
| Sezione dedicata tra tabella anteprima e bottone conferma | Card separate per suggestion con form inline |
| Sezione collassabile / accordion | Header cliccabile che espande le card |
| Banner compatto in cima con expand | Alert/banner meno invasivo |

**Scelta:** Sezione dedicata tra la tabella anteprima e il bottone conferma

---

### Q5: Sample descriptions: sempre visibili o con toggle?

**Opzioni presentate:**
| Opzione | Descrizione |
|---------|-------------|
| Sempre visibili (pill/chip) | 3 chip grigi sempre visibili |
| Nascosti con toggle "Mostra esempi" | Default collassato, click per espandere |

**Scelta:** Nascosti con toggle "Mostra esempi"

---

## Decisioni a discrezione di Claude

- Stile esatto del badge "Pattern creato"
- Gestione errori di validazione inline
- Se usare selector a due livelli (categoria → sottocategoria) o ricerca flat

## Idee deferred

Nessuna — la discussione è rimasta nel perimetro della phase 35.
