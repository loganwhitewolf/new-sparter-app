# Phase 78: plan-lifecycle-and-reconciliation - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the **lifecycle** of an amortization plan on top of the Phase 77 foundation: closing a
plan, realizing it through a sale, reducing+re-spreading it on a partial reimbursement, and the
write-path invariant that stops an amortized transaction from silently desynchronizing from its
plan.

Requirements: **AMORT-04, AMORT-05, AMORT-06, AMORT-07**.

The model is locked by **ADR 0019 §7–§8** — no architecture to redo. This discussion settled the
two items ADR 0019 left "to the discuss/plan phase" (over-residual reimbursement behaviour; the
edit invariant) plus the concrete UX that disambiguates realization from partial reimbursement.

**Not in this phase:** the `/amortizations` registry (REG-01/02/03 → Phase 79) and the global
cassa/competenza dashboard switch + accrual widgets + lens-aware selectors (LENS-01/02/04/05 →
Phase 80). Phase 78 is backend lifecycle + the minimal activation surfaces to exercise it; the
dedicated registry UI is Phase 79.

</domain>

<decisions>
## Implementation Decisions

### Close & collapse (AMORT-04)
- **D-01:** Closing an open plan is an **explicit user action**. It **cancels every remaining
  (future) instalment** and collapses their summed remaining value onto a **single closure-month
  instalment**; **past (already-occurred) instalments stay exactly where they are** — never rewrite
  a closed month (ADR 0019 §7). Closing with **no linked sale transaction = scrapped asset**: the
  remaining value simply lands as a cost on the closure month. Plan `status` flips `open → closed`.
  — **Reversibility:** costly — re-materialising the original schedule to undo a close is
  non-trivial; **plan re-open is out of scope** for this phase (flag if a user later needs it).

### Realize via sale (AMORT-05)
- **D-02:** Closing a plan **with a realization value** means linking a **real transaction** (an
  existing imported one, or one created manually at closure) and **netting it against the closure
  month** — an explicit exception to ADR 0018's Mondo Netto (which nets at cost-time). The link
  **reuses the v2.8 reimbursement mechanism** (ADR 0019 §8 — not a new mechanism). Over-recovery
  (sale value **greater than** the remaining/collapsed value) correctly yields a **positive net on
  the closure month = extraordinary income**; it is **never blocked and never clamped** (consistent
  with v2.8 surplus-first-class, `lib/services/reimbursement.ts`: `surplus` is a first-class state,
  never throws). The system **never writes a synthetic transaction** — the sale is a real
  transaction so the cash lens stays reconcilable with the bank statement. — **Reversibility:**
  costly (tied to close + an external link).
  - **D-02a (plan-time mechanic, Claude's discretion):** the **closure month** = the linked sale's
    `occurredAt` when a sale is linked; a scrap (no sale) uses the **close-action month**. Implement
    consistently so cash and accrual lenses reconcile. Whether closure needs a new `closedAt` /
    realization column on `amortization_plan` vs. reusing the v2.8 pair/reimbursement link is a
    **schema-delta decision left to plan-phase** (`gsd-pattern-mapper` against the live schema).

### Reimbursement on an amortized transaction (AMORT-06)
- **D-03:** Linking a reimbursement/inflow to a transaction that has an **open** amortization plan
  **prompts the user to declare intent** — the system does not guess:
  - **"Chiudi per vendita"** → routes into the close-with-sale path (**D-01 collapse + D-02 sale
    netting**). The single closure-month instalment carries the remaining value; the linked inflow
    nets against it. This is realization; over-recovery → positive net (extraordinary income).
  - **"Rimborso parziale (ridistribuisci)"** → the plan **stays open**: reduce the base by the
    refund amount and **re-spread the remaining instalments proportionally** over the remaining
    months (Decimal.js; remainder on the **month of reduction**, ADR 0019 §8). The asset is kept.
  - **Over-residual guard on the partial-refund path → BLOCK:** if the "rimborso parziale" amount
    **exceeds the plan's residual** (remaining un-spread base), **reject with a message redirecting
    to "chiudi per vendita"** — a recovery larger than the remaining cost is a realization, not a
    partial reduction. Keeps future instalments **≥ 0** so the accrual lens never shows a negative
    cost. — **Reversibility:** the intent prompt is UI (reversible); the re-spread mutation is
    costly (deterministic from the base, but rewrites materialised rows).
  - **D-03a (boundary — do NOT loosen):** AMORT-06 is the **amortize-first-then-reimburse** order.
    The Phase 77 **D-04 activation guard** (block *amortizing* a transaction already involved in a
    reimbursement — the reverse order) **stays in force**; this phase does not need to loosen it.

### Edit invariant (AMORT-07)
- **D-04:** Editing the **amount or date** of a transaction that has an amortization plan is
  **BLOCKED** — the pair-guard model (mirrors v2.5 DET-03 / v2.8 D-02, `transaction-edit.ts`
  `buildPairGuardMessage`). The rejection message points the user to **"rimuovi ammortamento"**
  (Phase 77 D-09) as the escape hatch: remove the plan (reverts the detach, deletes instalments),
  edit, then re-amortize. Rationale: reconciling an amount edit would rewrite the purchase-month
  instalment — a past/closed month — violating ADR 0019's "never rewrite a closed month" invariant.
  **Subcategory stays editable** — it derives via the Expense (Phase 77 D-13), so it never desyncs
  instalment amounts. — **Reversibility:** reversible (a guard predicate).
  - **Implementation:** extend the existing `transaction-edit.ts` guard with an analogous
    amortization-plan branch; reuse the pair-guard pattern, do not invent a new one.
  - **Snapshot note:** `amortization_plan.totalAmount` is the plan's **authoritative base**,
    captured at activation time and independent of the (now-blocked) `transaction.amount`. It is the
    base for re-spread (D-03) and closure (D-01) math, and remains available as **drift-detection
    defense-in-depth** even though the primary invariant is the hard block.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked model (read first)
- `docs/adr/0019-amortization-accrual-lens.md` — **§7** (close collapses remaining onto closure
  month, past stay), **§8** (realization = reimbursement netting against the closure month, scrap =
  close with no link, open-plan reimbursement reduces base + re-spreads, never write a synthetic
  transaction), **§10** (the `ledger_entry` seam + double-netting trap). The two "left to
  discuss/plan" items resolved here are §Consequences items 1 (over-residual) and 2 (edit invariant).
- `.planning/REQUIREMENTS.md` — AMORT-04/05/06/07 are this phase.
- `.planning/ROADMAP.md` — Phase 78 goal, success criteria, "Open for discuss/plan" note.

### Phase 77 foundation (build directly on these)
- `lib/db/schema.ts` — `amortizationPlan` (has `status` open/closed default `open`, `totalAmount`
  snapshot, `months`, `startDate`, `transactionId` UNIQUE) and `amortizationInstalment` (`planId`,
  `instalmentNumber` 1..N, `expenseId`, `amount`, `occurredAt`) at ~L646–715; the `ledger_entry`
  seam view at ~L717+. **No closure/realization column exists yet** — plan-phase decides the delta.
- `lib/services/amortization-math.ts` — instalment materialisation + remainder-on-first math; reuse
  for the D-03 re-spread and the D-01 collapse.
- `lib/services/amortization-activation.ts` — activation + the D-09 "rimuovi ammortamento" undo
  (reverse-detach). The lifecycle services (close/realize/reimburse) live alongside these.
- `lib/services/amortization-guards.ts` — the Phase 77 D-04..D-08 eligibility guards; D-03a keeps D-04.
- `tests/reimbursement-regression.test.ts` — the v2.8 real-Postgres byte-identical suite; LENS-03
  stays green: every lifecycle write must keep the cash lens byte-identical.

### Reused-model ADRs / services
- `docs/adr/0018-reimbursement-1n-linking-supersedes-net-by-subcategory.md` — the reimbursement
  mechanism D-02/D-03 reuse for sale netting.
- `lib/services/reimbursement.ts` — `deriveResidualFromAggregates` / residual states
  (`owed`/`settled`/`surplus`), the "never blocked, never throws" surplus precedent behind D-02.
- `lib/services/transaction-pairs.ts` + `lib/dal/transaction-pairs-sql.ts` — the 1:N linking write
  path (`createPairTx`) and `effectiveAmount()`/`isNotSecondary()` fragments.
- `lib/services/transaction-edit.ts` — `buildPairGuardMessage` + the amount/date guard to extend for D-04.

### Domain vocabulary
- `CONTEXT.md` (repo root) — Transaction vs Expense, Standalone Expense, cassa/competenza,
  Reference Period, "residuo", Mondo Netto. Italian product surfaces, English dev code/docs.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Plan/instalment schema + math + activation/undo shipped in Phase 77 (see canonical refs). Phase 78
  **adds lifecycle write services** (close, realize-via-sale, reimburse-and-redistribute) and **one
  edit guard**, plus the minimal surfaces to invoke them (row/detail action; registry UI is Phase 79).
- The v2.8 reimbursement link (`transaction-pairs.ts` / `reimbursement.ts`) is the mechanism D-02/D-03
  reuse — do not build a parallel netting path (ADR 0019 §8; §10 double-netting trap).

### Established Patterns
- Money is `Decimal.js` via `@/lib/utils/decimal`; `DECIMAL`/`numeric` columns are strings
  (`toDbDecimal`). Collapse (D-01), re-spread (D-03), and closure netting (D-02) must use Decimal.
- Every multi-write lifecycle flow runs inside `db.transaction`; write helpers accept `DbOrTx`.
  Close, realize, and reimburse-redistribute are all multi-write and must be **atomic**.
- Guard model: v2.5 pair-guard / v2.8 D-02 write-path invariants are the precedent for D-04.
- Migrations: `drizzle-kit generate` + `scripts/migrate.ts` — **never** `drizzle-kit push`; any new
  closure/realization column is an additive migration.

### Integration Points
- Lifecycle actions surface from the transaction row + transaction detail page (and feed the Phase 79
  registry later). Reimbursement-linking already has v2.8 surfaces; D-03 adds the **intent prompt**
  ("chiudi per vendita" vs "rimborso parziale") when the target transaction has an open plan.
- `transaction-edit.ts` (+ its action wrapper) is the single choke point for the D-04 amount/date block.

</code_context>

<specifics>
## Specific Ideas

- **Sale worked example (D-01+D-02).** MacBook €2000 amortized over 20 months (€100/mo). At month 11:
  11 instalments consumed (€1100), 9 remaining (€900). Close **for sale** at €1000 → cancel the 9
  future instalments, create ONE closure-month instalment of **€900** (remaining value), link the
  **€1000** sale which nets against the closure month → closure-month net **−€100** (income). Life
  total = €1100 − €100 = **€1000** net cost. Sell for €2500 instead → closure month €900 − €2500 =
  **−€1600**, life total −€500 = **extraordinary income** (bought 2000, sold 2500). Correct, positive.
- **Partial-refund worked example (D-03 redistribute).** Software subscription €1200 amortized over
  12 months (€100/mo). At month 3 (€300 consumed, 9 remaining, current remaining sum €900), a €300
  credit arrives and the user keeps the subscription → choose **"rimborso parziale"**: reduce base by
  €300, re-spread the remaining **€600** over the 9 remaining months (~€66.67/mo, Decimal remainder on
  the month of reduction). Plan stays **open**.
- **Over-residual block (D-03).** Same plan, but the "rimborso parziale" amount is €1000 (> €900
  residual) → **block** with a message: "supera il residuo — usa 'chiudi per vendita'."
- **Edit block (D-04).** Editing amount/date of an amortized transaction → rejected with a pointer to
  "rimuovi ammortamento". Editing its subcategory → allowed (derives via the Expense).

</specifics>

<deferred>
## Deferred Ideas
- `/amortizations` registry: list every plan (description, tx date, initial/consumed/net, remaining
  months), close-from-registry with optional realization value, open/closed distinction — **Phase 79**
  (REG-01/02/03). Phase 78 ships the lifecycle services the registry will call.
- Global cassa/competenza switch, accrual widgets, whole-year accrual view + year-end spillover,
  lens-aware year/month selectors — **Phase 80** (LENS-01/02/04/05).
- **Plan re-open** after close — not in ADR 0019; out of scope unless the user asks.
- Plain Postgres view vs materialized view for `ledger_entry` — performance-driven, Phase 77/80
  concern; the seam shape is independent.
- Final Italian copy for the two lens labels (cassa / competenza) — parked (Phase 80).

</deferred>

---

*Phase: 78-plan-lifecycle-and-reconciliation*
*Context gathered: 2026-07-28 (inline discuss under `/gsd-plan-phase --chain`; two ADR 0019 open items resolved with the developer)*
