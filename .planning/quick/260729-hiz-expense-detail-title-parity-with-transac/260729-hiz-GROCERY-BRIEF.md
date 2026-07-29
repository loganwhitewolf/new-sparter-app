# Grocery pattern hardening — agent brief (LOCKED)

> Documento autosufficiente. Ogni match riportato è stato **verificato eseguendo la regex**.
> Raccolta evidenze: 2026-07-29.

## 0. Mandato

Il pattern di sistema `spesa-quotidiana` contiene alternative che sono abbreviazioni, sigle, parole generiche o cognomi e producono falsi positivi.

**Obiettivo**: rendere l'insieme **consistente e difendibile**. Lavoro chirurgico — non riscrivere da zero.

**Vincolo**: modifica via GSD quick; pattern di sistema che tocca tutti gli utenti.

## 1. Caso trigger (Fineco SEPA)

```
Ben: TRAVEL SPECIALIST Ins: 24/07/2026 14:41:44 Da: INTERNET
Iban: IT68Y0200801109000105119318 TransID: 2607243291974987 480320046200IT
Cau: SALDO PRATICA VIAGGIO NUMERO 25/000164 - Viaggio thailandia — Bonifico SEPA Italia
```

Catena: `Ins:` field label → Fineco strip only `Carta N.` → matcher `'i'` → `\bins\b` / `\bin'?s\b` match → priority 10 wins. Also: no travel-agency pattern exists.

**Both** `\bins\b` and `\bin'?s\b` must be fixed (`\bins\b` is redundant with `\bin'?s\b`).

## 2. Files

| File | Role |
|---|---|
| `scripts/seed-patterns-data.ts` | pattern `spesa-quotidiana` + `validateSystemCategorizationPatterns()` |
| `scripts/seed-patterns.ts` | full replace system patterns — **do not run as deploy** |
| `lib/services/categorization-match.ts` | `applyTier1Regex` SoT |
| `scripts/audit-pattern-overlaps.ts` | extend; keep using production matcher |
| `tests/seed-patterns.test.ts`, `tests/categorization-match.test.ts`, `tests/import-service.test.ts` | tests |

## 3. Problematic alternatives (only these — leave other ~correct ones intact)

### Tier A — abbreviations / bank boilerplate

| Alt | Intended | Verified match | Issue |
|---|---|---|---|
| `\bins\b` | IN'S Mercato | `Ins: 24/07/2026` | bug; redundant w/ `\bin'?s\b` |
| `\bin'?s\b` | IN'S Mercato | `Ins: 24/07/2026` | same |
| `\bmd\b` | MD Discount | `RIF MD 4471 PAGAMENTO` | 2-char |
| `\bu2\b` | U2 Unes | `BIGLIETTI CONCERTO U2` | band |
| `\bu!\b` | U! Unes | none | **dead** — never matches |
| `\ba&o\b` | A&O | — | re-evaluate |
| `\bdpi[ùu]\b` | DPiù | — | low risk |

### Tier B — generic words

| Alt | Verified | Issue |
|---|---|---|
| `\bcoop\b` | `COOP SOCIALE LA SPERANZA`, `Coop. Agricola Rossi` | any cooperativa |
| `\bsuper\b` | `PAGAMENTO SUPER BOLLO AUTO` | generic |
| `\bmarket\b` | `FLOWER MARKET SRL` | any market |
| `\bprix\b` | `GRAND PRIX MONZA` | + makes `prix quality` redundant |
| `\biper\b` | `IPER TESORO` | Italian prefix |
| `\bagor[aà]\b` | `FARMACIA AGORA` | common brand name |
| `\bsigma\b` | `SIGMA ALDRICH SRL` | |
| `\bselex\b` | — | vs Selex ES |
| `\bsisa\b` | — | 4-char |
| `\bpenny\b` | — | vs proper name |
| `\btigre\b` | — | common word |
| `\bsimply\b` | — | English common |
| `\bforno\b` | `PIZZERIA AL FORNO` | beats ristoranti (p30) |

### Tier C — Italian surnames

| Alt | Verified |
|---|---|
| `\bpaladini\b` | `Ben: PALADINI MARIO` |
| `\bgabrielli\b` | `Ben: GABRIELLI LUCA` (+ makes magazzini gabrielli redundant) |
| `\brossetto\b` | `ROSSETTO GIULIA` (+ cosmetic meaning) |
| `\bgulliver\b` | `GULLIVER VIAGGI` |
| `\bvisotto\b` · `\btosano\b` · `\bbennet\b` · `\bcastoro\b` · `\bcadoro\b` | surnames/places |

### Tier D — structural

- `mercato.*local` — only alt without `\b` and with unbounded `.*`; bridges unrelated fields: `MERCATO SRL Cau: SERVIZIO LOCALE`.
- Redundancies (left covered by right) — resolve **together** with Tier B/C decisions:

  | Redundant | Covered by |
  |---|---|
  | `\bins\b` | `\bin'?s\b` |
  | `\bortofrutta\b` | `\bortofrutt[ai]\b` |
  | `\blatticini\b` | `\blatticin[io]\b` |
  | `\bprix quality\b` | `\bprix\b` |
  | `\bnova coop\b` | `\bcoop\b` |
  | `\bmagazzini gabrielli\b` | `\bgabrielli\b` |
  | `\bal[iì] super\b` | `\bsuper\b` |

  Note: `\bsupermercati al[iì]\b` is **not** redundant with `\bsuper\b`.

- Flag `\brisparmio casa\b` (drugstore chain in grocery) — out of scope to move.

## 4. Deliverables

### 4.1 Per-alternative action
For each §3 item: **RESTRINGI** (preferred) | **RIMUOVI** | **MANTIENI** + one-line rationale.
Prefer restrict forms like `\bin'?s\s+mercato\b`, `\bmd\s+discount\b`, `\bu2\s+supermercat\w*\b`, `\bmagazzini\s+gabrielli\b`, `\bsupermercat\w*\s+rossetto\b`.

### 4.2 Consistency rule
Write as comment above the pattern in `seed-patterns-data.ts`:
> An alternative ≤4 chars, or matching a common Italian word, or a surname, must carry disambiguating context (`mercato`, `supermercat\w*`, `discount`, `market`) and cannot stand alone.

### 4.3 Extend audit
Extend `scripts/audit-pattern-overlaps.ts` (do not rewrite; keep `applyTier1Regex`). Flag risky alts on **any** system pattern:
- literal alts ≤4 chars
- alts matching Italian bank boilerplate bait: `Ben:`, `Ins:`, `Da:`, `Iban:`, `TransID:`, `Cau:`, `Carta N.`, `Bonifico SEPA`, `Bonifico Italia`, `Rif.`, `Op.`
- alts without `\b` or with unbounded `.*`

Readable, repeatable output.

### 4.4 Regression tests (English names)

1. Fineco §1 description does **not** match `spesa-quotidiana`.
2. Verified FPs no longer match: `COOP SOCIALE`, `Coop. Agricola`, `SUPER BOLLO AUTO`, `FLOWER MARKET`, `GRAND PRIX`, `FARMACIA AGORA`, `SIGMA ALDRICH`, `RIF MD 4471`, `CONCERTO U2`, `Ben: PALADINI MARIO`, `Ben: GABRIELLI LUCA`, `ROSSETTO GIULIA`, `GULLIVER VIAGGI`, `MERCATO SRL Cau: SERVIZIO LOCALE`.
3. True positives still match: `ESSELUNGA`, `COOP LIGURIA`, `IN'S MERCATO`, `MD DISCOUNT`, `LIDL ITALIA`, `CARREFOUR EXPRESS`, `SUPERMERCATO IL GIGANTE`, `PENNY MARKET`, `TIGROS`, `NATURASI`, `MACELLERIA ROSSI`, `PANIFICIO CENTRALE`, `ORTOFRUTTA DA MARIO` + a true positive for every RESTRINGI form.
4. `validateSystemCategorizationPatterns()` green.

### 4.5 Travel agency pattern
Add pattern: `travel specialist`, `agenzia viaggi`, `\bviaggi\b`, `booking`, `expedia`, `\btour operator\b` → `subCategorySlug: "alloggio"` (locked in CONTEXT; Vacanze; no invent slug).
After grocery fix, verify no collision; reconsider priority **explicitly** if still colliding.

### 4.6 Report
Write `.planning/grocery-pattern-hardening-REPORT.md` with:
- table `alternativa | azione | motivazione | prima → dopo`
- consistency rule
- audit output before/after
- out-of-scope findings (§5)

## 5. Out of scope — report only

- Fineco SEPA `descriptionStripPattern` (touches descriptionHash / ADR 0007)
- Retroactive re-categorization
- Other correct grocery alts
- Fixing other system patterns flagged by audit
- Moving `\brisparmio casa\b`

## 6. Definition of done

- [ ] Every §3 item decided + motivated in report
- [ ] Fineco §1 does not match grocery (test)
- [ ] Both `\bins\b` and `\bin'?s\b` addressed
- [ ] Dead `\bu!\b` removed or fixed
- [ ] Tier D redundancies resolved coherently
- [ ] No true-positive regressions (§4.4.3)
- [ ] Consistency rule comment above pattern
- [ ] Audit extended + green; output in report
- [ ] Travel agency pattern added; no grocery collision
- [ ] validateSystemCategorizationPatterns + lint + typecheck + tests + `yarn check:language` green
- [ ] Report written
- [ ] **No production DB seed**; propose `yarn db:seed-patterns` for operator
