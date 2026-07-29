# Grocery pattern hardening report (260729-hiz)

Surgical harden of system `spesa-quotidiana` + new travel-agency → `alloggio` pattern.
Principle: a false positive costs more than an uncategorized transaction.

Language: product/merchant strings may be Italian; code, tests, comments, and this report body are English.

**Operator next step (not run in this task):** `yarn db:seed-patterns` — full replace of system patterns (`userId = null`). Do not run against production without a deploy window.

---

## Consistency rule (§4.2)

Placed as an English comment above the grocery pattern in `scripts/seed-patterns-data.ts`:

> An alternative ≤4 chars, or matching a common Italian word, or a surname, must carry disambiguating context (`mercato`, `supermercat\w*`, `discount`, `market`) and cannot stand alone.

---

## Per-alternative decisions (§3)

| alternativa | azione | motivazione | prima → dopo |
|---|---|---|---|
| `\bins\b` | RIMUOVI | Redundant with Ins Mercato form; matched Fineco `Ins:` | `\bins\b` → _(removed)_ |
| `\bin'?s\b` | RESTRINGI | Bare form matched Fineco `Ins:`; require merchant | `\bin'?s\b` → `\bin'?s\s+mercato\b` |
| `\bmd\b` | RESTRINGI | 2-char; matched `RIF MD 4471` | `\bmd\b` → `\bmd\s+discount\b` |
| `\bu2\b` | RESTRINGI | Matched concert tickets `CONCERTO U2` | `\bu2\b` → `\bu2\s+supermercat\w*\b` |
| `\bu!\b` | RIMUOVI | Dead — never matches; Unes covered by `\bunes\b` | `\bu!\b` → _(removed)_ |
| `\ba&o\b` | MANTIENI | Distinctive A&O brand token (`&`); low collision risk | unchanged |
| `\bdpi[ùu]\b` | MANTIENI | Low risk per brief; keep with `d[- ]?pi[ùu]` sibling | unchanged |
| `\bcoop\b` | RESTRINGI | Any cooperativa (`COOP SOCIALE`, `Coop. Agricola`) | `\bcoop\b` → drop bare; keep `\bnova coop\b`, `\bipercoop\b`, add `\bcoop\s+liguria\b` |
| `\bnova coop\b` | MANTIENI | Needed after bare coop removal (redundancy pair resolved) | unchanged |
| `\bsuper\b` | RIMUOVI | Generic; matched `SUPER BOLLO AUTO`; `supermercato` covers TPs | `\bsuper\b` → _(removed)_ |
| `\bmarket\b` | RIMUOVI | Generic; matched `FLOWER MARKET`; use `penny market` / brand forms | `\bmarket\b` → _(removed)_ |
| `\bprix\b` | RIMUOVI | Matched `GRAND PRIX`; `prix quality` covers brand | `\bprix\b` → _(removed)_ |
| `\bprix quality\b` | MANTIENI | Specific brand after bare prix removal | unchanged |
| `\biper\b` | RIMUOVI | Italian prefix FP (`IPER TESORO`); keep `iperal` / `ipercoop` | `\biper\b` → _(removed)_ |
| `\bagor[aà]\b` | RESTRINGI | Common brand/place name (`FARMACIA AGORA`) | → `\bagor[aà]\s+(?:market\|supermercat\w*)\b` |
| `\bsigma\b` | RESTRINGI | Matched `SIGMA ALDRICH` | → `\bsigma\s+(?:supermercat\w*\|conad)\b` |
| `\bselex\b` | RESTRINGI | Ambiguous vs Selex ES; require gruppo | → `\bgruppo\s+selex\b\|\bselex\s+gruppo\b` |
| `\bsisa\b` | RESTRINGI | ≤4 chars; require discount/supermarket context | → `\bsisa\s+(?:supermercat\w*\|discount)\b` |
| `\bpenny\b` | RESTRINGI | Prefer market compound (TP `PENNY MARKET`) | → `\bpenny\s+market\b` |
| `\btigre\b` | RIMUOVI | Common Italian word; `tigros` covers related chain | `\btigre\b` → _(removed)_ |
| `\bsimply\b` | RESTRINGI | Common English word | → `\bsimply\s+market\b` |
| `\bforno\b` | RIMUOVI | Beat restaurants (`PIZZERIA AL FORNO`); keep fornaio/forneria/panificio | `\bforno\b` → _(removed)_ |
| `\bpaladini\b` | RESTRINGI | Surname FP `Ben: PALADINI MARIO` | → `\bsupermercat\w*\s+paladini\b\|\bpaladini\s+supermercat\w*\b` |
| `\bgabrielli\b` | RIMUOVI | Surname FP; keep `\bmagazzini\s+gabrielli\b` | bare → _(removed)_ |
| `\bmagazzini gabrielli\b` | MANTIENI | Specific compound after bare gabrielli removal | → `\bmagazzini\s+gabrielli\b` |
| `\brossetto\b` | RESTRINGI | Surname/cosmetic FP | → `\bsupermercat\w*\s+rossetto\b` |
| `\bgulliver\b` | RESTRINGI | Matched `GULLIVER VIAGGI` | → `\bgulliver\s+(?:market\|supermercat\w*)\b` |
| `\bvisotto\b` | RESTRINGI | Surname/place; require market context | → `\bvisotto\s+(?:supermercat\w*\|market)\b\|\bsupermercat\w*\s+visotto\b` |
| `\btosano\b` | MANTIENI | Established Veneto grocery chain on POS; no verified FP in brief samples | unchanged |
| `\bbennet\b` | MANTIENI | Established grocery chain POS token; no verified FP sample in brief | unchanged |
| `\bcastoro\b` | RIMUOVI | Common noun (beaver) / place risk | `\bcastoro\b` → _(removed)_ |
| `\bcadoro\b` | MANTIENI | Established Veneto grocery chain | unchanged |
| `mercato.*local` | RESTRINGI | Unbounded `.*` bridged unrelated fields | → `\bmercato\s+local[ei]\b` |
| `\bortofrutta\b` | RIMUOVI | Redundant with `\bortofrutt[ai]\b` | → _(removed)_ |
| `\blatticini\b` | RIMUOVI | Redundant with `\blatticin[io]\b` | → _(removed)_ |
| `\bal[iì] super\b` | MANTIENI | Not redundant with bare super after super removal | unchanged |
| `\bsupermercati al[iì]\b` | MANTIENI | Not redundant with `\bsuper\b` (brief note) | unchanged |
| `\brisparmio casa\b` | _(flag only)_ | Drugstore chain in grocery — out of scope to move (§5) | unchanged |

---

## Travel-agency pattern (D-12)

| Field | Value |
|---|---|
| Alternatives | `travel specialist`, `agenzia viaggi`, `\bviaggi\b`, `booking`, `expedia`, `\btour operator\b` |
| `subCategorySlug` | `alloggio` (locked — no Vacanze agency slug invented; not `trasporto` / not `assicurazione-viaggio`) |
| Priority | **5** (ASC load order; beats grocery priority 10) |
| Collision check | Fineco §1 description → `alloggio` via `travel specialist`; grocery alone returns null after Ins restrict |

---

## Audit before / after

Command: `yarn tsx scripts/audit-pattern-overlaps.ts` (uses `applyTier1Regex` — matcher SoT unchanged).

### Before (pre-edit snapshot)

```json
{
  "patternCount": 46,
  "regexConflicts": 12
}
```

No `riskyAlternatives` section existed yet. Grocery still contained bare `\bins\b` / `\bin'?s\b` (verified against Fineco `Ins:` in the brief).

### After

```json
{
  "patternCount": 47,
  "regexConflicts": 6,
  "riskyAlternatives": {
    "count": 107
  }
}
```

Grocery residual risky alts (short brand literals left intentionally — not in §3 mandate):

| alternative | reasons |
|---|---|
| `\bpam\b` | short-literal-le-4 |
| `\bcrai\b` | short-literal-le-4 |
| `\blidl\b` | short-literal-le-4 |
| `\baldi\b` | short-literal-le-4 |
| `\bunes\b` | short-literal-le-4 |
| `\ba&o\b` | short-literal-le-4 |

Bank-boilerplate bait hits on grocery after harden: **none**.
Other system patterns still flagged by the new section are **out of scope** to fix (§5).

### Audit extension

`scripts/audit-pattern-overlaps.ts` now emits `riskyAlternatives` alongside existing conflicts/token notes:

- literal alts ≤4 chars
- alts matching bait: `Ben:`, `Ins:`, `Da:`, `Iban:`, `TransID:`, `Cau:`, `Carta N.`, `Bonifico SEPA`, `Bonifico Italia`, `Rif.`, `Op.`
- alts without `\b` or with unbounded `.*`

Match checks still go through `applyTier1Regex`.

---

## Out of scope (§5) — report only

- Fineco SEPA `descriptionStripPattern` / `descriptionHash` (ADR 0007) — not touched
- Retroactive re-categorization of existing expenses/transactions — not done
- Other system patterns flagged by audit — left as-is
- Moving `\brisparmio casa\b` out of grocery — flagged above, not moved
- **`yarn db:seed-patterns` was not run** — operator must apply when ready

---

## Verification

- `yarn vitest run tests/seed-patterns.test.ts tests/categorization-match.test.ts` — green
- `yarn check:language` — green
- `validateSystemCategorizationPatterns()` — green (tests)
