# Phase 79: amortizations-registry - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a dedicated **`/amortizations` registry**: one place that lists **every** amortization
plan (open and closed) with its derived values, lets the user **close a plan from the registry**,
and **visually distinguishes open from closed** plans.

Requirements: **REG-01, REG-02, REG-03**.

This is a **UI + read-path** phase on top of the Phase 78 lifecycle. The write services already
exist (`closePlanTx` / `realizePlanTx` / `reducePlanTx` in `lib/services/amortization-lifecycle.ts`)
and the dialogs already exist (`components/transactions/close-amortization-dialog.tsx`,
`amortization-reimburse-dialog.tsx`). Phase 79 adds: a **DAL list query**, the **`/amortizations`
page**, an **interactive registry table**, a summary header, and the reuse/wiring of the existing
close flow from this new surface.

**Not in this phase:**
- The global cassa/competenza dashboard switch, accrual widgets, whole-year accrual view, and
  lens-aware year/month selectors → **Phase 80** (LENS-01/02/04/05).
- A new `/amortizations/[id]` plan detail page — the plan's detail is the **transaction detail
  page** (D-D1), which already hosts the full Phase 78 lifecycle UI.
- Any new realization/close **mechanics** — Phase 79 only surfaces the Phase 78 services; it does
  not change close/realize/re-spread semantics.

</domain>

<decisions>
## Implementation Decisions

### Close from the registry (REG-02)
- **D-A1:** The registry's **"Chiudi"** action does **scrap-close only** — it collapses the
  remaining value onto the closure month (Phase 78 D-01), **no sale value entered inline**. It
  **reuses `CloseAmortizationDialog` as-is** (which already calls `closePlanAction({ planId })`).
  This deliberately does **not** honour the ROADMAP's literal "optionally enter a sale/realization
  value" as an inline scalar field, because Phase 78 **D-02** locked realization = link a **real**
  transaction (never synthetic). A bare scalar value would have no real transaction to net against.
  — **Reversibility:** reversible (surfacing an existing service/dialog on a new page).
- **D-A2:** The registry row also offers a **"Realizza con vendita"** entry point that **navigates
  to the transaction detail page** with the realization flow (existing Phase 78 surface), rather
  than reimplementing sale-linking inside the registry. Keeps the "never synthetic" invariant and
  avoids duplicating the transaction picker/creation UI in the registry.
- **D-A3:** **Actions appear only on open plans.** Closed plans are read-only rows in the registry
  (no "Chiudi" / "Realizza"). — **Reversibility:** reversible (a per-row conditional).

### Columns & summary header (REG-01)
- **D-B1:** The page shows a **summary header with a single aggregate: total open net residual** —
  the sum of the net value still to amortize across all **open** plans (Decimal.js). One number,
  the most actionable at-a-glance metric; not a multi-KPI strip.
- **D-B2:** The **months column reads "X/N"** (consumed / total instalments, e.g. `11/20`) with a
  **light progress bar**. The other REG-01 columns stay as mandated: description, transaction date,
  initial amount, consumed amount, net value.

### Open vs closed (REG-03)
- **D-C1:** The registry **defaults to showing open plans only**, with a **status filter** that
  reveals closed plans — reusing the v2.8 `/reimbursements` table pattern (client-side
  search + status filter + sort, URL-backed). Less noise; closed plans stay reachable.
- **D-C2:** **Default sort = remaining months ascending** (plans closest to completion on top),
  surfacing what is about to finish/close.
- **D-C3 (Claude's discretion / UI-phase):** exact **closed-vs-open badge/visual treatment** is
  left to the UI design contract — the distinction must be unambiguous at a glance (REG-03), but
  the specific badge/color/row styling is not locked here.

### Row navigation
- **D-D1:** Clicking a registry row **navigates to the amortized transaction's detail page**, which
  already hosts the full Phase 78 lifecycle (realize, reimburse, remove amortization). **No new
  plan detail page** is built. Consistent with the D-A2 "Realizza con vendita" target.

### Claude's Discretion
- Navigation/menu entry for `/amortizations` (where it appears in the app nav), the `EmptyState`
  copy for the no-plans account, and route/href constants in `lib/routes.ts` — implement following
  the established `/reimbursements` conventions.
- The DAL query shape (single list query deriving initial/consumed/net/remaining from
  `amortizationPlan.totalAmount` snapshot + `amortizationInstalment` rows) — planner/pattern-mapper
  decides against the live schema; must use Decimal.js and stay consistent with the cash lens.
- Closed-plan badge styling (D-C3).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked model (read first)
- `docs/adr/0019-amortization-accrual-lens.md` — **§7** (scrap-close collapses remaining onto the
  closure month, past instalments untouched) and **§8** (realization = reimbursement netting against
  the closure month via a real transaction; never write a synthetic transaction). Constrains D-A1/D-A2.
- `.planning/REQUIREMENTS.md` — **REG-01/02/03** are this phase.
- `.planning/ROADMAP.md` — Phase 79 goal, success criteria, "UI hint: yes".
- `.planning/phases/78-plan-lifecycle-and-reconciliation/78-CONTEXT.md` — the lifecycle decisions
  (D-01 close/collapse, D-02 realize-via-sale, D-03 reimburse-and-redistribute) this registry surfaces.

### Phase 77/78 foundation (build directly on these)
- `lib/services/amortization-lifecycle.ts` — `closePlanTx` (scrap-close, D-A1), `realizePlanTx`
  (real `saleTransactionId`, the D-A2 target flow), `reducePlanTx`; `ClosePlanResult` shapes.
- `lib/actions/amortization-lifecycle.ts` — `closePlanAction` (already wired into the dialog).
- `components/transactions/close-amortization-dialog.tsx` — reused as-is by the registry (D-A1).
- `lib/db/schema.ts` — `amortizationPlan` (`status` open/closed, `totalAmount` snapshot, `months`,
  `startDate`, `transactionId` UNIQUE) and `amortizationInstalment` (`planId`, `instalmentNumber`
  1..N, `amount`, `occurredAt`). Source for the DAL derived columns.
- `tests/reimbursement-regression.test.ts` — the byte-identical cash-lens gate (LENS-03) stays green;
  a read-only registry must not perturb it.

### List-page pattern to mirror (v2.8 `/reimbursements`)
- `app/(app)/reimbursements/page.tsx` — RSC page → `verifySession` → DAL → `EmptyState` vs table.
- `components/reimbursements/reimbursement-table.tsx` — search + status filter + sort interactive
  table; the structural analog for the amortizations registry table (D-C1).
- `lib/dal/reimbursement.ts` (`getReimbursementList`) — the DAL list-query analog for the new
  amortizations list query.
- `lib/routes.ts` — `reimbursements` route + `reimbursementHref` pattern to mirror for
  `/amortizations`.

### Domain vocabulary
- `CONTEXT.md` (repo root) — Transaction vs Expense, Standalone Expense, cassa/competenza,
  "residuo". Italian product surfaces, English dev code/docs.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `/reimbursements` is a **direct structural analog**: RSC list page + interactive table
  (search/status filter/sort) + DAL list query + `EmptyState`. The registry mirrors this stack.
- `CloseAmortizationDialog` (scrap-close) is **reused verbatim** from the registry (D-A1) — it only
  needs a `planId` + `onSuccess`.
- The Phase 78 lifecycle services and the transaction detail lifecycle UI already exist; the
  registry is a new **entry surface**, not new mechanics.

### Established Patterns
- Money is `Decimal.js` via `@/lib/utils/decimal`; `DECIMAL`/`numeric` columns are strings
  (`toDbDecimal`). The summary aggregate (D-B1) and every derived per-row value must use Decimal.
- List pages: RSC fetches via DAL, renders `EmptyState('no-data')` when empty, else mounts the
  interactive table which owns its own filtered-to-zero `EmptyState('no-result')`.
- Table filter/sort is the unified URL-backed system (search + status + sort), persisted per v1.14.

### Integration Points
- New `/amortizations` route under the authenticated `(app)` group; add nav entry + route constant.
- Registry rows link to `transactions/[id]` (D-D1); the "Realizza con vendita" action targets the
  same detail page's Phase 78 realization flow (D-A2).

</code_context>

<specifics>
## Specific Ideas

- **Summary header:** a single figure — "netto residuo aperto" = Σ net-still-to-amortize over open
  plans. Not a KPI strip.
- **Months cell:** `11/20` + a light progress bar.
- **Default view:** open plans only, sorted by remaining months ascending; a status filter reveals
  closed plans in the same table.
- **Close semantics from registry:** scrap-close (collapse), matching the existing dialog's copy
  ("Le rate future verranno raggruppate in un'unica rata nel mese corrente. Le rate già passate non
  verranno modificate."). Sale realization is a deep-link to the transaction detail, not inline.

</specifics>

<deferred>
## Deferred Ideas
- A dedicated `/amortizations/[id]` **plan detail page** (full instalment schedule, history, all
  actions in one place) — not built; the transaction detail page is the plan's detail (D-D1). Note
  for a future phase if plan-centric detail is ever wanted.
- Inline sale-value entry / inline sale-linking in the registry — deliberately deferred to the
  transaction detail flow to preserve ADR 0019 §8 "never synthetic" (D-A1/D-A2).
- Global cassa/competenza switch, accrual widgets, whole-year accrual view + year-end spillover,
  lens-aware year/month selectors — **Phase 80** (LENS-01/02/04/05).
- Plan re-open after close — still out of scope (carried from Phase 78).

None new outside phase scope beyond the above.

</deferred>

---

*Phase: 79-amortizations-registry*
*Context gathered: 2026-07-28*
