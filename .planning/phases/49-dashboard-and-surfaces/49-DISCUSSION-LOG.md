# Phase 49: dashboard-and-surfaces - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-12
**Phase:** 49-dashboard-and-surfaces
**Areas discussed:** Allocation chart + drill-down, KPI cards + savings rate, Direction chips (picker + filters), Remove exclude_from_totals

---

## Allocation in the overview chart + drill-down

First framing (rejected by user, who wanted to think it through): plain choice
between a summary block, a 3rd grouped bar, or a stacked allocation bar.

User insight: a 3rd bar feels right, but selecting it should also surface the
allocation trend vs the previous month in the drill-down (e.g. how investments
moved). This coupled the chart form with the drill-down behaviour, so the
question was reformulated.

| Option | Description | Selected |
|--------|-------------|----------|
| 3rd bar + direction-aware drill-down | Accantonato = clickable 3rd grouped bar; clicking a bar selects month + direction (Entrate→IN movers, Uscite→OUT movers, Accantonato→allocation movers, each Δ vs prev month) | ✓ |
| 3rd bar, drill-down stays OUT-only | Accantonato is a 3rd bar but clicking a month always shows OUT movers as today | |
| No 3rd bar, summary block + Δ | Chart unchanged; allocation in a block below with totals + Δ vs prior period | |

**User's choice:** 3rd bar + direction-aware drill-down (full version of their idea).

Follow-up — allocation movers grain:

| Option | Description | Selected |
|--------|-------------|----------|
| Per nature (Risparmio/Investimento) | Allocation panel shows the 2 natures with Δ€; IN/OUT stay per category | ✓ |
| Per category (like IN/OUT) | Uniform with OUT but usually 1-2 rows for allocation | |
| Per subcategory | Max detail, breaks uniformity with IN/OUT | |

Follow-up — empty allocation month:

| Option | Description | Selected |
|--------|-------------|----------|
| Zero bar + empty-state panel | 3rd bar always present (even 0); click shows "Nessun accantonamento" | ✓ |
| Hide bar if 0 | Cleaner but uneven month groups (2 vs 3 bars) | |

**Notes:** Enabling IN movers is new behaviour (IN drill-down didn't exist before).

---

## KPI cards + savings rate

| Option | Description | Selected |
|--------|-------------|----------|
| 5th card "Accantonato" | Dedicated card (Risparmio+Investimento) with YTD Δ | ✓ |
| Replaces "Tasso risparmio" | Allocation takes the savings-rate slot, keeps 4 cards | |
| Reading line on Bilancio | 4 cards stay; allocation as "di cui accantonato €X" | |

| Option | Description | Selected |
|--------|-------------|----------|
| (in − out)/in, allocation excluded | Existing formula; out = spending only; allocation+transfer out of totals | ✓ |
| allocation/in (accantonamento rate) | Reinterprets the metric; changes existing semantics | |
| Keep both | savings rate + accantonamento rate; risks confusing two similar metrics | |

**User's choice:** 5th card "Accantonato" + savings rate unchanged.

---

## Direction chips: picker + table filters

| Option | Description | Selected |
|--------|-------------|----------|
| All 4 (In/Out/Accantonato/Trasferimento) | Picker exposes 4 direction chips; user can assign any direction | ✓ |
| 3 chips, Trasferimento de-emphasised | In/Out/Accantonato primary; Transfer secondary | |

| Option | Description | Selected |
|--------|-------------|----------|
| 4 directions filterable + nature dependsOn direction | type→direction (4 values); nature cascade fed by nature→direction; transfer/allocation filterable | ✓ |
| 4 directions + label review | Same logic, extra attention to IT chip labels | |

**User's choice:** All 4 chips in picker; 4-direction filter + nature cascade in tables.

---

## Remove exclude_from_totals

Pre-question verification: the 3 slugs with `exclude_from_totals = true`
(`trasferimento-tra-conti`, `addebito-carta-di-credito`, `contante`) all map to
nature `transfer` → direction `transfer` → `included_in_totals = false`, and the
column is not user-editable. `direction.included_in_totals` covers it with no gap.

| Option | Description | Selected |
|--------|-------------|----------|
| Drop now (dedicated migration) | Stop reading + drop column; closes ADR intent; extra guarded migration | ✓ |
| Stop reading, drop later | Switch aggregation now, leave dead column for future cleanup | |
| Keep as redundant AND | Double safety net for a release, then remove | |

**User's choice:** Drop now via dedicated migration, following Phase 48 operator caution (dump + guarded apply).

---

## Claude's Discretion

- Plan slicing, SQL/helper naming, and direction-join expression (reusable fragment vs inline).
- Allocation bar/segment colors may use seeded `direction.color` / `nature.color`; visual tuning is a UI concern.

## Deferred Ideas

- Explicit transaction↔opposite pairing — Phase 50 (TX-PAIRING-01).
- Employer reimbursements bundled in salary credit — known ADR 0012 limitation.
- "Recurring spend / subscriptions" orthogonal view — a flag/view, not a nature; not this phase.
