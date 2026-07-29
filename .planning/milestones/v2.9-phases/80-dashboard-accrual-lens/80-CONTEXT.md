# Phase 80: dashboard-accrual-lens - Context

**Gathered:** 2026-07-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Give the user a **second lens** over the entire dashboard: one global control flips
every widget between **cassa** (cash — today's behavior, unchanged) and **competenza**
(accrual — amortized costs shown as their monthly instalments instead of the purchase-day
spike). Delivers LENS-01, LENS-02, LENS-04, LENS-05.

The read-layer seam is **already built** (Phase 77, ADR 0019 §10): the `ledger_entry_cash`
and `ledger_entry_accrual` Postgres views both exist; the ten aggregation functions today
read `ledgerEntryCash` hardcoded. This phase is the **UI + wiring** work:

1. Make the ten aggregation sites select their row source by lens (swap `ledgerEntryCash` ↔
   `ledgerEntryAccrual`), driven by one lens value.
2. Add the global cassa/competenza switch and thread the lens through the four dashboard
   sub-routes.
3. Make the year/month selectors (`getYearsWithData` / `getMonthsWithData`) lens-aware so
   accrual-only future periods appear.

**Architecture is LOCKED by ADR 0019** — this discussion only settles HOW to wire and present
it, never the model. No new capabilities.

</domain>

<decisions>
## Implementation Decisions

### Lens persistence & scope
- **D-01:** The lens is **URL state** (`?lens=cassa|competenza`) as the source of truth —
  exactly like the existing `?year=` selector — with a **sessionStorage restore layer** so the
  choice survives navigation/reload. Reuse the established table-filter pattern (v1.14 / PR #41:
  URL is canonical, sessionStorage rehydrates, skeleton anti-blink). — **Reversibility:** reversible — pure view state, no schema.
- **D-02:** In the **absence of `?lens=`, default to `cassa`.** This is the LENS-03 baseline (cash
  stays byte-identical) and the safe zero-plan behavior.
- **D-03:** **One global switch, shared identically across all four dashboard sub-routes**
  (`/dashboard/overview`, `/dashboard/categories`, `/dashboard/categories/[id]`,
  `/dashboard/tags`). Switching tabs preserves the lens. Not per-route. (ADR 0019 §5: "global to
  the whole dashboard exactly like the year selector".)
- **D-04:** The switch is **always visible**, including when the user has **zero amortization
  plans** (where competenza == cassa and the lens is a no-op). No conditional gate on plan count —
  predictable behavior, less logic, no appearing/disappearing control.

### Tag surfaces under the lens
- **D-05:** `/dashboard/tags` is **lens-invariant**. Tags are all-time by model (v2.7:
  `dateRange` is a label, not a filter), so spreading a cost across months is a no-op on an
  all-time total. Implementation: the tag DAL (`getTagTotals` / `getTagDetail`) **keeps reading
  `ledgerEntryCash` regardless of the lens** — this preserves the three reconciled totals under
  both lenses (issue 07). On this sub-route the switch renders **disabled (or badged) with a short
  note** ("i tag sono all-time: la lente non cambia i totali") so the no-op does not read as a bug.
- **D-06:** `/tags/[id]` (outside the `(app)/dashboard` group, canonical all-time) receives **no
  switch at all** and stays exactly as it is.

### Movers / deviations / closure spike
- **D-07:** **No special-case logic.** Movers and deviations operate on whatever the active
  row source supplies — under competenza they read the accrual ledger's instalment amounts. A
  spread cost naturally appears as a new mover in month 1 then flattens into baseline; that is the
  intended behavior (ADR 0019 §5). The seam does all the work; no filtering of instalment rows.
- **D-08:** The **plan-closure spike is NOT suppressed.** Closing a plan collapses remaining
  instalments onto the closure month (ADR 0019 §7); under competenza that closure-month row is
  just another ledger row and appears in movers/deviations like any other movement. No code to
  distinguish or attenuate closure rows.

### Navigation selectors (horizon & cross-lens fallback)
- **D-09:** Under competenza, the year/month selectors **show every period that has at least one
  instalment**, out to the last instalment of the longest plan (no horizon cap, even +5 years).
  Honest to the materialized data (ADR 0019 §6: "instalments exist, so they are shown"); no
  arbitrary threshold constant. `getYearsWithData` / `getMonthsWithData` become lens-aware
  (LENS-05).
- **D-10:** **Cross-lens period fallback = clamp to the latest period with data in the target
  lens.** If the selected period exists only under competenza (a future instalment year) and the
  user flips to cassa, the selector falls back to the most recent year with cash data — never a
  misleading empty screen. Extends the existing `resolveYear` fallback contract
  (`components/dashboard/overview/resolve-year.ts`) to be lens-aware. — **Reversibility:** reversible.

### Claude's Discretion
- Exact switch UI (control type, labels beyond "Cassa"/"Competenza", placement next to the year
  selector) is left to planning / a follow-up `/gsd-ui-phase` (UI hint = yes on this phase). The
  substance above (always-visible, disabled+noted on tags, global) constrains it.
- Mechanics of threading the lens value from URL → server components → the ten aggregation call
  sites (row-source selection) is a planning/implementation detail; the decision is only *which
  source* each lens picks.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The locked model
- `docs/adr/0019-amortization-accrual-lens.md` — the amortization + accrual-lens model. §5 (two
  lenses / one global switch), §6 (whole selected year incl. future months; selectors become
  lens-aware), §7 (closure collapses remaining instalments onto closure month), §10 (the
  `ledger_entry` swappable row source seam), and §52 items 3/4/5 which THIS discussion resolves.
- `.scratch/amortization/assets/01-lens-seam.md` — the DAL survey: the ten aggregation sites, the
  shared join spine, the double-netting trap, and why the seam is a swappable row source. Read
  before touching any aggregation.
- `.scratch/amortization/issues/07-lens-on-tags.md` — the tags-under-lens question, resolved here
  by D-05/D-06.

### Requirements
- `.planning/REQUIREMENTS.md` — LENS-01, LENS-02, LENS-04, LENS-05 (this phase); LENS-03 (cash
  byte-identical, already Complete in Phase 77 — the regression invariant this phase must not break).

### Seam & aggregation code (built in Phase 77 — read to wire the lens)
- `lib/db/schema.ts` §"ledger_entry seam" (~line 717) — `ledgerEntryCash` and `ledgerEntryAccrual`
  pgView definitions. Both already exist; this phase selects between them.
- `lib/dal/dashboard-filters.ts` — extracted shared predicates (`dateScopedTransactions`,
  `expenseStatusIncludedInDashboardTotals`) already generalized to accept any ledger row source.
- `lib/dal/dashboard.ts`, `lib/dal/overview.ts`, `lib/dal/tags.ts` — the ten aggregation
  functions currently hardcoded to `ledgerEntryCash`.
- `lib/dal/overview.ts` `getYearsWithData`, `lib/dal/months-with-data.ts` `getMonthsWithData` —
  the navigation selectors to make lens-aware (D-09).

### UI wiring
- `app/(app)/dashboard/layout.tsx`, `app/(app)/dashboard/{overview,categories,tags}/page.tsx`,
  `app/(app)/dashboard/categories/[id]/page.tsx` — the four sub-routes; searchParams currently
  carry `?year=`.
- `components/dashboard/overview/resolve-year.ts` — pure year-resolution fallback to extend for
  cross-lens clamp (D-10).
- `.planning/table-filter-sort-DECISIONS.md` + ADR 0009/0010 — the URL-canonical +
  sessionStorage-restore pattern reused for lens persistence (D-01).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`ledgerEntryCash` / `ledgerEntryAccrual` views** — both already defined; the lens reduces to
  choosing which view a query selects `FROM`.
- **`resolveYear()`** — pure, no side effects; the natural place to add lens-aware clamp (D-10).
- **Table-filter persistence layer (PR #41)** — URL source-of-truth + sessionStorage restore +
  skeleton anti-blink; the template for lens persistence (D-01).
- **`components/ui/tabs.tsx`** — available; no dedicated segmented/switch control exists yet
  (a UI-phase choice).

### Established Patterns
- Dashboard period is server-resolved from `searchParams.year`, guaranteed to be a member of the
  data-driven `years[]`. The lens follows the same server-resolution shape.
- The seam's whole point (ADR 0019 §10): the amount is resolved *inside* the row source, so
  aggregations "read `ledger.amount` and change almost nothing else" — the lens must not
  reintroduce `effectiveAmount()`/`isNotSecondary()` at call sites (double-netting trap).

### Integration Points
- Ten aggregation sites + two selector functions are the read-layer surface; the global switch +
  URL param + sessionStorage restore is the client/route surface.
- Regression instrument: v2.8's real-Postgres byte-identical suite for the ten sites is the proof
  that **cassa stays inert** after the row source becomes lens-selectable.

</code_context>

<specifics>
## Specific Ideas

- Lens labels are Italian product surfaces: **"Cassa"** and **"Competenza"** (per ADR/domain).
- Tag no-op note copy (draft): "i tag sono all-time: la lente non cambia i totali."

</specifics>

<deferred>
## Deferred Ideas

- Visual treatment distinguishing future/committed instalment months from actuals (dashed future
  bars, KPIs stopping at "today") — **explicitly out of scope** per ADR 0019 (splitting semantics
  inside a widget). Not part of this phase.
- Configurable amortization day in settings — deferred milestone-wide (REQUIREMENTS future list).
- Query-timing measurement under the accrual lens on a realistic dataset (plain vs materialized
  view) — left in the fog by the seam survey; revisit only if performance demands it.

</deferred>

---

*Phase: 80-dashboard-accrual-lens*
*Context gathered: 2026-07-29*
