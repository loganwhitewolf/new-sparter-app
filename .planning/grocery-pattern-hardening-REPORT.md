# Grocery pattern hardening report (260729-hiz)

Surgical harden of system `spesa-quotidiana` + travel-agency → `pacchetto-vacanze` pattern.
Principle: a false positive costs more than an uncategorized transaction.

Language: product/merchant strings may be Italian; code, tests, comments, and this report body are English.

**Operator next steps (not run in this task):**
1. `yarn db:seed-extras` — inserts `pacchetto-vacanze` on already-seeded DBs (staging/prod).
2. `yarn db:seed-patterns` — full replace of system patterns (`userId = null`), remapping travel away from `alloggio`.

Do not run against production without a deploy window. Expenses already auto-categorized to `alloggio` by the interim travel→alloggio mapping (if any on staging) are **not** auto-remapped (Phase 67 D-12) — review manually or leave until next human categorization pass.

---

## Travel mapping correction (post-review)

| Before | After | Why |
|---|---|---|
| travel-agency → `alloggio` | travel-agency → `pacchetto-vacanze` | Package ≠ lodging; D-12 forbids best-effort subcategory inventing |

New subcategory: Vacanze > `pacchetto-vacanze` (`seed-data.ts` + additive `seed-extras` step `insert-pacchetto-vacanze`). Trip identity remains a Tag (CONTEXT.md).

---

## Consistency rule (§4.2)

Placed as an English comment above the grocery pattern in `scripts/seed-patterns-data.ts`:

> A **new** alternative ≤4 chars, or matching a common Italian/English word, or a surname, must carry disambiguating context (`mercato`, `supermercat\w*`, `discount`, `market`) and cannot stand alone.

Scoped to new alternatives, with the grandfathered exceptions named in the comment: `pam`, `crai`, `lidl`, `aldi`, `unes`, `dec[oò]`, `dpi[ùu]`, `a&o` stay bare as unambiguous chain brands on POS descriptors. Stating the rule unqualified would have made it a false claim about the pattern directly below it.

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

## Travel-agency pattern (D-12 → B correction)

| Field | Value |
|---|---|
| Alternatives | `travel specialist`, `agenzia viaggi`, `viaggi e turismo`, `booking\.com`, `expedia`, `tour operator` |
| `subCategorySlug` | **`pacchetto-vacanze`** (new Vacanze subcategory — package/agency object of spend; not `alloggio`) |
| Priority | **9** (ASC load order; beats grocery 10, stays far below trasporto/hotel 100) |
| Collision check | Fineco §1 → `pacchetto-vacanze` via `travel specialist`; grocery alone returns null after Ins restrict; hotels still win via lodging pattern → `alloggio` |

Taxonomy: `seed-data.ts` row + additive `seed-extras` step `insert-pacchetto-vacanze`. CONTEXT.md Vacanze list updated. Phase 67 D-12: no best-effort remap of packages onto lodging.

### Review correction (post-review) — bare viaggi/booking + priority

The first version shipped bare `\bviaggi\b` / `\bbooking\b` at priority **5**. Since `applyTier1Regex` returns on the first hit over patterns loaded ASC by priority, that placed the pattern in the highest-precedence tier and made it shadow the Phase 67 travel-only `trasporto` pattern and `\bhotel\b` (both priority 100). Verified misroutes (then fixed by restricting alts + priority 9):

| description | was (bad) | now |
|---|---|---|
| `RYANAIR BOOKING REF X7K2P9` | swallowed by travel | `trasporto` |
| `EASYJET ONLINE BOOKING` | swallowed by travel | `trasporto` |
| `AUTONOLEGGIO HERTZ BOOKING` | swallowed by travel | `trasporto` |
| `HOTEL BOOKING FEE` | travel → wrong | `alloggio` (hotel pattern) |
| Fineco TRAVEL SPECIALIST SEPA | grocery / then wrongly `alloggio` | `pacchetto-vacanze` |

Bare `\bviaggi\b` and `\bbooking\b` are exactly the generic-word class this task removed from grocery — the same rule applies. Locked by regression tests in `tests/categorization-match.test.ts`.

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
    "count": 56
  }
}
```

The risky-alt count went 107 → 56 after review: 58 of the original findings were `missing-word-boundary` fired at the `sport-e-fitness` pattern, which matches substrings **by design** (compounds like `GPadel`, `SuperFitness`). That pattern now carries an explicit `substringMatch: true` flag — audit-only metadata, never inserted into the DB — and the check skips it. A section that is 60% known-false is a section nobody reads.

Reason codes now emitted:

| reason | count | meaning |
|---|---|---|
| `short-literal-le-4` | 44 | literal ≤4 chars (mostly grandfathered chain brands) |
| `missing-word-boundary` | 10 | no `\b`, on a pattern that did not opt into substring matching |
| `unbounded-dot-star` | 9 | `.*` can bridge unrelated description fields |
| `standalone-generic-word` | 0 | bare common word with no disambiguating context |
| `bank-boilerplate-bait` | 0 | alternative matches a bank field label (`Ins:`, `Ben:`, …) |

`standalone-generic-word` is the check added in response to the review: a word boundary alone does not make `booking` or `viaggi` safe. Verified against a throwaway probe row — it flags `\bsuper\b`, `\bmarket\b`, `\bbooking\b`, `\bviaggi\b` and correctly ignores `\bpenny\s+market\b`, `\bbooking\.com\b`, `\brisparmio casa\b`.

**Known limitation:** `regexConflicts` builds witness strings from single literal alternatives, so a two-token collision like `RYANAIR` + `BOOKING` is invisible to it. That is why the priority-5 misroute above passed a green audit. Cross-pattern witness composition is not implemented.

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
