---
phase: 260729-hiz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/expenses/expense-title-edit.tsx
  - components/expenses/expense-detail-client.tsx
  - tests/expense-title-edit.test.tsx
  - scripts/seed-patterns-data.ts
  - scripts/audit-pattern-overlaps.ts
  - tests/seed-patterns.test.ts
  - tests/categorization-match.test.ts
  - .planning/grocery-pattern-hardening-REPORT.md
autonomous: true
requirements:
  - EXPENSE-TITLE-PARITY-260729-hiz
  - GROCERY-PATTERN-HARDEN-260729-hiz
must_haves:
  truths:
    - "Expense detail shell shows only the back control — no duplicated header title/amount (D-01)."
    - "Expense title in the Dati card uses ExpenseTitleEdit variant=detail with break-words wrapping; table/list call sites keep inline truncate (D-02, D-03)."
    - "Expense amount remains visible only in Riepilogo — no new amount editor in Dati (D-04)."
    - "Fineco travel-specialist SEPA description no longer matches spesa-quotidiana; both Ins alternatives are restricted/removed (D-08, D-11)."
    - "Every §3 alternative in GROCERY-BRIEF has RESTRINGI|RIMUOVI|MANTIENI + rationale in the report; consistency-rule comment sits above the grocery pattern (D-05, D-06, D-07, D-13)."
    - "Travel-agency system pattern maps to alloggio and wins over grocery for Fineco §1 after the grocery fix (D-12)."
    - "Audit flags short/boilerplate/unbounded alts without rewriting applyTier1Regex; validateSystemCategorizationPatterns + language check green; seed-patterns is operator-only (D-10, D-14)."
  artifacts:
    - "components/expenses/expense-title-edit.tsx — variant inline|detail"
    - "components/expenses/expense-detail-client.tsx — header parity with transaction detail"
    - "scripts/seed-patterns-data.ts — hardened spesa-quotidiana + travel-agency → alloggio"
    - "scripts/audit-pattern-overlaps.ts — risky-alt flags"
    - ".planning/grocery-pattern-hardening-REPORT.md — full DoD report"
  key_links:
    - "ExpenseTitleEdit variant=detail ← ExpenseDetailClient Dati Titolo (mirrors TransactionTitleEdit)"
    - "DetailPageShell props stripped ← same pattern as transaction-detail-client.tsx"
    - "applyTier1Regex remains SoT for audit + regression tests"
    - "GROCERY-BRIEF §6 DoD ↔ report table + tests"
---

<objective>
Deliver expense-detail title layout parity with transaction detail, and surgically harden the system `spesa-quotidiana` regex (plus travel-agency → `alloggio`) per the locked grocery brief.

Purpose: remove the duplicated/truncated expense header title; stop grocery false positives (Fineco `Ins:` trigger and §3 alts) without rewriting the pattern set from scratch.

Output: UI parity on `/expenses/[id]`; updated `seed-patterns-data.ts` + audit + tests + `.planning/grocery-pattern-hardening-REPORT.md`.

**Branch constraint:** stay on `quick/260729-hiz-expense-title-grocery-harden` — do not create another branch.
</objective>

<execution_context>
@$HOME/.cursor/gsd-core/workflows/execute-plan.md
@$HOME/.cursor/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@CONTEXT.md
@.planning/quick/260729-hiz-expense-detail-title-parity-with-transac/260729-hiz-CONTEXT.md
@.planning/quick/260729-hiz-expense-detail-title-parity-with-transac/260729-hiz-GROCERY-BRIEF.md
@components/transactions/transaction-detail-client.tsx
@components/transactions/transaction-title-edit.tsx
@components/expenses/expense-detail-client.tsx
@components/expenses/expense-title-edit.tsx
@scripts/seed-patterns-data.ts
@scripts/audit-pattern-overlaps.ts
@lib/services/categorization-match.ts
@tests/expense-title-edit.test.tsx
@tests/seed-patterns.test.ts
@tests/categorization-match.test.ts

**Locked decisions (CONTEXT + BRIEF — do not revisit):**

- **D-01** Remove `title` / `amount` / `amountInline` / `amountToneClassName` from `DetailPageShell` in `expense-detail-client.tsx` (header = back only, like transaction detail / commit 80544a6).
- **D-02** Add `variant?: 'inline' | 'detail'` to `ExpenseTitleEdit`; `detail` uses `break-words` (no truncate); default `inline` keeps truncate for tables/lists.
- **D-03** Title remains only in the Dati card with `variant="detail"`.
- **D-04** Amount stays in Riepilogo only — do not add a transaction-style amount editor in Dati. Skip `group-detail-client` unless already trivial (prefer no).
- **D-05** Execute `260729-hiz-GROCERY-BRIEF.md` end-to-end — every §3 alt gets RESTRINGI | RIMUOVI | MANTIENI + one-line rationale in the report.
- **D-06** Principle: a false positive costs more than an uncategorized transaction; prefer RESTRINGI forms from brief examples.
- **D-07** Consistency rule (§4.2) as an English comment above the grocery pattern in `seed-patterns-data.ts`.
- **D-08** Fix BOTH `\bins\b` and `\bin'?s\b` (prefer IN'S Mercato form; drop redundant bare `\bins\b` once `\bin'?s\s+mercato` exists).
- **D-09** Remove or fix dead `\bu!\b`.
- **D-10** Extend `scripts/audit-pattern-overlaps.ts` only — keep `applyTier1Regex` as matcher SoT.
- **D-11** Regression tests per BRIEF §4.4 (English test names).
- **D-12** New travel-agency system pattern → `subCategorySlug: "alloggio"` only (do not invent Vacanze slugs). Priority must not lose to grocery after grocery fix. Document in report.
- **D-13** Write `.planning/grocery-pattern-hardening-REPORT.md` with §4.6 sections.
- **D-14** Do **not** run `yarn db:seed-patterns` as deploy — propose it as operator next step in the report only.

**Out of scope (report-only for grocery §5):** Fineco `descriptionStripPattern` / descriptionHash (ADR 0007), retroactive re-categorization, fixing other system patterns flagged by audit, moving `\brisparmio casa\b`.

**Discretion:** exact RESTRINGI forms within brief examples; travel pattern priority number (must be defensible vs grocery after restrict); leave group-detail alone.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Expense detail title parity (shell + ExpenseTitleEdit detail)</name>
  <files>components/expenses/expense-title-edit.tsx, components/expenses/expense-detail-client.tsx, tests/expense-title-edit.test.tsx</files>
  <behavior>
    - ExpenseTitleEdit default variant inline keeps truncate on the title span (existing table callers unchanged) (D-02)
    - variant=detail uses break-words on the title span and does not apply truncate (D-02)
    - ExpenseDetailClient DetailPageShell omits title/amount/amountInline/amountToneClassName — back + layout cards only (D-01)
    - Dati Titolo passes variant="detail" to ExpenseTitleEdit (D-03)
    - Riepilogo still shows the signed totalAmount with amountToneClass; no amount editor added under Dati (D-04)
  </behavior>
  <action>
    Mirror `TransactionTitleEdit` / `transaction-detail-client.tsx` (commit 80544a6 pattern) for expenses only (D-01–D-04).

    1. In `expense-title-edit.tsx`, add optional `variant?: 'inline' | 'detail'` defaulting to `inline`. Import `cn` from `@/lib/utils`. On the non-editing title `<span>`, use `cn(...)` so `detail` → `block break-words` (plus existing font classes) and `inline` → keep current `block min-w-0 truncate font-mono text-sm tracking-tight`. Do not invent an expense "Descrizione originale" field (expenses have no separate bank description — CONTEXT out of scope).

    2. In `expense-detail-client.tsx`: strip `title`, `amount`, `amountInline`, and `amountToneClassName` from the `DetailPageShell` call (leave `backHref`, `layout="two-column"`, and the card slots). Pass `variant="detail"` on the Dati `ExpenseTitleEdit`. Keep `amountClass` / `formatSignedAmount` for Riepilogo only (D-04). Add a short English comment above the shell call explaining why header title/amount are omitted (same rationale as transaction detail).

    3. Do not modify `group-detail-client` (discretion: prefer no).

    4. Extend `tests/expense-title-edit.test.tsx`: assert default/inline markup includes `truncate`; assert `variant="detail"` markup includes `break-words` and does not include the truncate class on the title span. Keep existing link/pencil assertions green.
  </action>
  <verify>
    <automated>yarn vitest run tests/expense-title-edit.test.tsx -x</automated>
  </verify>
  <done>Expense detail header is back-only; Dati title wraps via variant=detail; inline truncate preserved for other call sites (D-01, D-02, D-03, D-04).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Harden spesa-quotidiana + travel alloggio + audit + report</name>
  <files>scripts/seed-patterns-data.ts, scripts/audit-pattern-overlaps.ts, tests/seed-patterns.test.ts, tests/categorization-match.test.ts, .planning/grocery-pattern-hardening-REPORT.md</files>
  <behavior>
    - Fineco BRIEF §1 travel-specialist description does not match spesa-quotidiana after edits (D-08, D-11)
    - Listed §4.4.2 FP strings no longer match grocery; §4.4.3 TP strings (and every RESTRINGI form TP) still match (D-05, D-06, D-11)
    - Both Ins alternatives addressed; dead u! removed or replaced with a matching Unes form (D-08, D-09)
    - Travel-agency pattern (travel specialist, agenzia viaggi, viaggi, booking, expedia, tour operator) resolves to alloggio and beats grocery on Fineco §1 (D-12)
    - validateSystemCategorizationPatterns() stays green (D-11)
    - Audit emits readable risky-alt findings for ≤4-char literals, Fineco/boilerplate bait, and alts missing \b or using unbounded .* — still via applyTier1Regex for match checks (D-10)
  </behavior>
  <action>
    Treat `260729-hiz-GROCERY-BRIEF.md` as the full mandate — execute every §4 deliverable and §6 DoD item. Do not inline every alternative decision here; decide each §3 row in the report with RESTRINGI | RIMUOVI | MANTIENI + one-line rationale (D-05, D-13). Prefer restrict forms from BRIEF examples (D-06).

    1. **Pattern edits** in `scripts/seed-patterns-data.ts` on the `spesa-quotidiana` entry only (leave other grocery alts that are already correct): place the §4.2 consistency-rule English comment immediately above the pattern object (D-07). Address Tier A–D per BRIEF — including D-08 (both Ins alts → prefer `\bin'?s\s+mercato\b`, drop bare `\bins\b`), D-09 (dead `\bu!\b`), Tier D `mercato.*local` unbounded `.*`, and redundancy pairs resolved coherently with B/C choices. Flag `\brisparmio casa\b` in the report only — do not move it (BRIEF §5).

    2. **Travel agency** (D-12): add a new system pattern with alts covering `travel specialist`, `agenzia viaggi`, `\bviaggi\b`, `booking`, `expedia`, `\btour operator\b`, `subCategorySlug: "alloggio"`, English description. Choose priority so Fineco §1 wins travel/`alloggio` over grocery after grocery restrict (document the priority choice and collision check in the report). Do not invent Vacanze subcategory slugs.

    3. **Audit** (D-10): extend `scripts/audit-pattern-overlaps.ts` — do not rewrite the matcher; keep using `applyTier1Regex`. Add a second report section that flags risky alternatives on any system pattern: literal alts ≤4 chars; alts that match Italian bank-boilerplate bait strings from BRIEF §4.3 (`Ben:`, `Ins:`, `Da:`, `Iban:`, `TransID:`, `Cau:`, `Carta N.`, `Bonifico SEPA`, `Bonifico Italia`, `Rif.`, `Op.`); alts without `\b` or with unbounded `.*`. Keep existing conflict/token output; make the new section readable and repeatable (stdout JSON or clearly labeled block). Capture before/after audit output snippets into the report.

    4. **Tests** (D-11): add/extend cases in `tests/categorization-match.test.ts` and/or `tests/seed-patterns.test.ts` (English names) covering BRIEF §4.4.1–§4.4.4 — use the real `systemCategorizationPatterns` + `applyTier1Regex` (or validate helper) so the Fineco §1 string, FP list, TP list, travel→alloggio winner, and `validateSystemCategorizationPatterns()` are asserted. Prefer focused describe blocks over duplicating the entire pattern string in every test.

    5. **Report** (D-13, D-14): write `.planning/grocery-pattern-hardening-REPORT.md` with: table `alternativa | azione | motivazione | prima → dopo` for every §3 item; consistency rule text; audit before/after; out-of-scope findings (§5); explicit operator next step to run `yarn db:seed-patterns` (do **not** run it in this task). Also note language: product/merchant strings may be Italian; code/tests/comments English.

    6. Final gate: `yarn vitest run` on the touched test files, `yarn check:language`, and typecheck/lint as already used in the repo for pattern changes — all green. Never call `yarn db:seed-patterns` against local/production DB as part of execution (D-14).
  </action>
  <verify>
    <automated>yarn vitest run tests/seed-patterns.test.ts tests/categorization-match.test.ts -x && yarn check:language</automated>
  </verify>
  <done>BRIEF §6 DoD satisfied in code + report; Fineco §1 not grocery; travel → alloggio without inventing slugs; no db:seed-patterns run (D-05–D-14).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| system pattern seed → Tier-1 matcher | Regex alternatives categorize all users' future imports |
| audit script → stdout | Operator-facing findings only; no DB writes |
| expense detail client → updateExpenseTitle | Existing authenticated title edit; layout-only change |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-hiz-01 | Tampering | spesa-quotidiana alternatives | medium | mitigate | Prefer RESTRINGI over bare short/generic tokens; FP principle D-06; regression tests lock Fineco §1 + FP/TP lists |
| T-hiz-02 | Elevation of Privilege | travel → alloggio pattern | low | mitigate | Map only to existing active slug `alloggio`; validateSystemCategorizationPatterns enforces slug existence |
| T-hiz-03 | Information Disclosure | grocery report / audit | low | accept | Report uses synthetic/verified sample strings from BRIEF, not live user PII dumps |
| T-hiz-04 | Denial of Service | unbounded `.*` in grocery | low | mitigate | Fix `mercato.*local` per Tier D; audit flags unbounded `.*` going forward |
| T-hiz-SC | Tampering | npm/pip/cargo installs | low | accept | No new packages in this plan |
</threat_model>

<verification>
- `yarn vitest run tests/expense-title-edit.test.tsx tests/seed-patterns.test.ts tests/categorization-match.test.ts`
- `yarn check:language`
- Manual smoke (executor): open `/expenses/[id]` with a long title — header has no title/amount; Dati title wraps; Riepilogo still shows amount.
- Confirm report lists operator step `yarn db:seed-patterns` and that the command was not run during execution.
</verification>

<success_criteria>
- D-01–D-04 observable on expense detail (parity with transaction detail header/title behavior).
- D-05–D-14 satisfied per GROCERY-BRIEF §6 with report on disk.
- Branch remains `quick/260729-hiz-expense-title-grocery-harden`.
</success_criteria>

<!-- source-audit
SOURCE    | ID                         | Item                                              | Plan | Status  | Notes
--------- | -------------------------- | ------------------------------------------------- | ---- | ------- | -----
GOAL      | —                          | Title parity + grocery harden                     | 01   | COVERED | quick task goal
REQ       | EXPENSE-TITLE-PARITY       | Header remove + detail break-words                | 01   | COVERED | Task 1
REQ       | GROCERY-PATTERN-HARDEN     | BRIEF DoD                                         | 01   | COVERED | Task 2
CONTEXT   | D-01..D-04                 | Expense title parity locked decisions             | 01   | COVERED | Task 1
CONTEXT   | D-05..D-14                 | Grocery BRIEF locked decisions                    | 01   | COVERED | Task 2
BRIEF     | §3–§6                      | Alts, audit, tests, travel alloggio, report, ops  | 01   | COVERED | Task 2 points at BRIEF
BRIEF     | §5 out of scope            | stripPattern, retro, other patterns, risparmio    | —    | EXCLUDED | report-only
-->

<output>
Create `.planning/quick/260729-hiz-expense-detail-title-parity-with-transac/260729-hiz-SUMMARY.md` when done
</output>
