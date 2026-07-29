# Phase 80: dashboard-accrual-lens - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-29
**Phase:** 80-dashboard-accrual-lens
**Areas discussed:** Lens persistence & scope, Tag surfaces under the lens, Movers/deviations & closure spike, Selector horizon & cross-lens fallback

---

## Lens persistence & scope

| Option | Description | Selected |
|--------|-------------|----------|
| URL + sessionStorage restore | `?lens=` source-of-truth (like `?year=`), sessionStorage restores across navigation/reload — reuses table-filter pattern (PR #41). No migration. | ✓ |
| URL only (`?lens=`) | Pure URL state, no restore; lens resets to cassa on route change without query. | |
| Durable preference (settings/DB) | Column on user/settings, remembered cross-device. Needs migration + seed-extras. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Single global switch, shared | One lens value identical across all four sub-routes; persists across tabs (ADR §5). | ✓ |
| Per-route independent | Each sub-route its own lens. Contradicts "global switch". | |

**User's choice:** URL + sessionStorage restore; single global switch shared across sub-routes.
**Notes:** Default lens with no `?lens=` = cassa (LENS-03 baseline), captured without asking.

---

## Tag surfaces under the lens

| Option | Description | Selected |
|--------|-------------|----------|
| Invariant + switch disabled with note | `/dashboard/tags` switch disabled/badged with a short note explaining the no-op. | ✓ |
| Follows switch, silent no-op | Switch active but numbers don't change — risks looking broken. | |
| Hide switch on `/dashboard/tags` | Switch absent on this route — breaks the "always present global control" promise. | |

| Option | Description | Selected |
|--------|-------------|----------|
| No switch, invariant (`/tags/[id]`) | Page unchanged; outside the dashboard, lens does not belong. | ✓ |
| Receives switch (consistency) | Adds switch as a no-op for visual uniformity. | |

**User's choice:** `/dashboard/tags` invariant with disabled+noted switch; `/tags/[id]` no switch.
**Notes:** Tag DAL keeps reading `ledgerEntryCash` regardless of lens → three reconciled totals unaffected (issue 07).

---

## Movers/deviations & closure spike

| Option | Description | Selected |
|--------|-------------|----------|
| No special logic — read accrual ledger | Movers/deviations operate on accrual row source; spread cost = new mover month 1 then flat. Seam does all (ADR §5). | ✓ |
| Suppress instalment rows from movers | Filter instalment rows so early months aren't "noisy". Contradicts ADR §5, logic outside seam. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Closure spike appears (no suppression) | Closure-month collapse (§7) shows as any other ledger row. No extra code. | ✓ |
| Suppressed/attenuated | Hide/mark closure rows — extra read-layer logic, hides a real movement. | |

**User's choice:** No special logic; closure spike appears.
**Notes:** Keeps Phase 80 lean — the seam already produces the correct rows.

---

## Selector horizon & cross-lens fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Show all years with instalments | Selector offers every year with ≥1 instalment, out to the longest plan. No cap (ADR §6). | ✓ |
| Cap at current year + N | Limit future horizon; hides committed instalments, arbitrary constant. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Clamp to latest period with data in target lens | Flipping to cassa from a future-only accrual year falls back to latest cash year. Never a misleading empty screen. | ✓ |
| Keep period, show empty-state | Stay on selected year, show existing empty-state — can look like the switch emptied the dashboard. | |

**User's choice:** Show all instalment years (no cap); clamp to latest period with data in target lens.
**Notes:** Extends `resolveYear` to be lens-aware.

---

## Zero-plan switch behavior (closing check)

| Option | Description | Selected |
|--------|-------------|----------|
| Switch always visible | Switch present even at zero plans (competenza == cassa, honest no-op). No conditional gate. | ✓ |
| Hide/disable until first plan | Switch appears only after first plan; adds a plan-count gate and appearing/disappearing UI. | |
| Explore more gray areas | Continue discussing before context. | |

**User's choice:** Switch always visible; ready for context.

## Claude's Discretion

- Exact switch control type / labels beyond "Cassa"/"Competenza" / placement — left to planning or a follow-up `/gsd-ui-phase` (UI hint = yes).
- Mechanics of threading the lens value from URL → server components → the ten aggregation call sites.

## Deferred Ideas

- Future/committed-month visual treatment (dashed bars, KPIs stopping at today) — explicitly out of scope per ADR 0019.
- Configurable amortization day in settings — deferred milestone-wide.
- Accrual-lens query-timing measurement (plain vs materialized view) — revisit only if performance demands.
