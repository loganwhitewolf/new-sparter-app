# Phase 43: overview-shell - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-08
**Phase:** 43-overview-shell
**Areas discussed:** Component strategy, Chart interactivity boundary, Year default & no-data handling, Empty/cold-start states

---

## Component strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Porta il proto 1:1 | Promote PO-approved proto components to production, strip P44/P45 bits, delete old shipped components in cleanup | ✓ |
| Adatta gli esistenti | Extend shipped KpiCard/EntrateUsciteChart in place; more reuse but risks diverging from approved proto | |

**User's choice:** Porta il proto 1:1
**Notes:** All current overview components (KpiCards, EntrateUsciteChart, BilancioBarsChart, OverviewFilters) verified used only by overview/page.tsx → safe to delete.

---

## Chart interactivity boundary (P43)

| Option | Description | Selected |
|--------|-------------|----------|
| Barre statiche pulite | Only grouped bars + labels + tooltip in P43; interactions added later | |
| Scaffold interattivo pronto | Build clickable/filter scaffold now to reduce P44/P45 rework | ✓ |

**User's choice:** Scaffold interattivo pronto — clarified to "Struttura interna, niente UI inerte"
**Notes:** Follow-up resolved the tension: build internal hooks (selectedMonth state, per-bar Cell opacity, onClick wiring, optional props for chips/panel) but render NOTHING non-functional in P43 — no visible chips, no visible highlight until the P45 movers panel exists. Disabled/placeholder UI was explicitly rejected as looking broken.

---

## Year default & no-data handling

| Option | Description | Selected |
|--------|-------------|----------|
| Default = anno più recente con dati | First entry of getYearsWithData() | |
| Default = anno corrente | Current calendar year even without data | ✓ (refined) |

**User's choice:** Default = anno corrente — refined to "Corrente se ha dati, altrimenti più recente"
**Notes:** Follow-up resolved the HEAD-03 tension (selector lists only years with data): default to current year when it appears in getYearsWithData(), else fall back to most recent year with data, so the selected year is always present in the selector. Invalid `?year=` resolves the same way. Year via `?year=` + router.replace, scroll:false.

---

## Empty / cold-start states

| Option | Description | Selected |
|--------|-------------|----------|
| Empty state espliciti | Curated placeholders for no-data year, no-years account, zero months; delta badge hidden when null | ✓ |
| Minimo, rendi i dati grezzi | Plain zeros/empty bars, refine later | |

**User's choice:** Empty state espliciti
**Notes:** Onboarding RSC gate redirects zero-transaction users, but sparse-data and edge cases still get curated copy/placeholders.

---

## Claude's Discretion

- Currency/number formatting helper (proto's `eur`/`eurCompact` are throwaway → production `Intl.NumberFormat` + compact k-notation).
- Suspense/streaming boundary granularity and skeleton shapes.
- Reading-line thresholds ported verbatim from proto unless data shape forces a change.
- Component file names / co-location under `components/dashboard/`.

## Deferred Ideas

- Filter chips + ⓘ legend + per-chip tooltips (FILT/EDU) → Phase 44.
- Inline amber uncategorized nudge (NUDGE) → Phase 44.
- Per-month movers drill-down (MOVE) → Phase 45 — builds on the P43 chart scaffold seam (D-03).
- FlowNature friendly display-labels rename (EDU-FUT-01) → future quick task.
- Align Deviation engine to "last month with data" → tracked follow-up from Phase 42 D-12.
