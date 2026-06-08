# Phase 44: overview-interactions - Research

**Researched:** 2026-06-08  
**Domain:** Next.js 16 App Router dashboard interactions, Recharts client chart slicing, localStorage nudge state, Radix popover/tooltip education  
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

Source: copied verbatim from `.planning/phases/44-overview-interactions/44-CONTEXT.md`. [CITED: .planning/phases/44-overview-interactions/44-CONTEXT.md]

### Locked Decisions

### Locked Model — D-01..D-05
- **D-01 — No additional user-facing decisions.** Planning should proceed from the existing model. Any residual details, such as component names, exact query-param names, chip component extraction, and minor layout mechanics, are planner discretion within this context.
- **D-02 — Nudge source and persistence are locked.** Use the selected-year `overview.uncategorizedCount` / Phase 42 count semantics for OUT-only uncategorized expenses. Render no nudge when the count is zero. Dismissal is stored in localStorage only with `lastSeenCount` semantics; it must reappear when the selected year's uncategorized count increases. Do not write dismissal state to the database.
- **D-03 — Nudge placement and tone are locked.** The nudge is inline on the title row, amber, invitational, and must not show the count in copy. It offers `Categorizza ora` and an X/icon dismiss action.
- **D-04 — Chart filters are client-side slicing of `getOverviewChart(year)`.** No extra round-trip is needed. Income chips map to `income.recurring` (`nature = 'income'`) and `income.extraordinary` (`nature = 'income_extraordinary'`). Expense chips map to `essential`, `discretionary`, `operational`, `financial`, `debt`, and `extraordinary`. KPI cards ignore chip state unconditionally.
- **D-05 — FlowNature education stays contextual.** Use a small info trigger near each filter group plus per-chip tooltips. Do not add a glossary screen or long educational block. Do not rename taxonomy labels in this phase.

### Chart Filter Behavior — D-06..D-08
- **D-06 — Default state shows everything.** On initial load all income types and all expense natures are included, preserving Phase 43's unfiltered grouped bars.
- **D-07 — Filters are inclusive toggles.** Toggling a chip includes/excludes that bucket from the corresponding bar total. The chart remains two bars per month: one green Entrate bar and one red Uscite bar. Do not reintroduce nature stacking or a balance series.
- **D-08 — Empty filtered bars are acceptable, empty chart state is not.** If the user disables all chips in a group, that side's bar total can be zero while the chart still renders. Planner may either prevent all-off per group or provide a lightweight reset affordance, but must not create a separate empty-state panel that competes with the chart.

### URL / State — D-09
- **D-09 — Filter state persistence is planner discretion, but year remains canonical in `?year=`.** The locked requirement does not require shareable filter state. Prefer a simple client-state implementation unless planner sees a strong reason to encode chip state in the URL. Do not use localStorage for chart filters unless a future requirement asks for sticky filters; localStorage is reserved here for nudge dismissal.

### Navigation Target — D-10
- **D-10 — `Categorizza ora` lands on uncategorized transactions.** Reuse the existing `/transactions` filtering contract (`status=uncategorized`). Preserve selected-year scope where practical via the canonical transactions month filter (for example all `YYYY-MM` months for the selected year), but exact URL construction is planner discretion.

### the agent's Discretion
- Exact component split, prop names, and whether filter chips live inside `OverviewChart` or a sibling `OverviewChartFilters` component.
- Exact one-line Italian definitions for chip tooltips and popovers, provided they are concise, contextual, and derived from current `NATURE_LABELS` plus Phase 42's income split.
- Exact localStorage key name, as long as it is overview/year scoped enough to support `lastSeenCount` without cross-year false dismissals.
- Whether to add small focused tests at component level, DAL/utility level, or both. Test coverage should prove: chip slicing does not affect KPIs, nudge hide/show/dismiss/reappear logic, and education triggers render accessible labels/tooltips.

### Deferred Ideas (OUT OF SCOPE)
- **Per-month movers drill-down** (`MOVE-01`..`MOVE-05`) -> Phase 45.
- **FlowNature friendly display-label rename** (`EDU-FUT-01`) -> future quick task; not part of Phase 44.
- **DB-backed nudge dismissal** -> explicitly out of scope for v1.16.
- **Deviation engine migration to "last month with data"** -> previously deferred from Phase 42.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NUDGE-01 | Inline amber title-row nudge appears when selected year has uncategorized OUT expenses. | `getOverview(year)` returns `uncategorizedCount`, and `OverviewHeader` is the existing title row. [VERIFIED: codebase grep] |
| NUDGE-02 | Nudge offers `Categorizza ora` and an X dismiss action. | Use `next/link` for `/transactions?...`, `Button` with lucide icon for dismiss. [VERIFIED: codebase grep] |
| NUDGE-03 | Dismissal persists only in localStorage and reappears on higher `lastSeenCount`. | Existing sidebar uses SSR-safe localStorage read in `useEffect`; reuse that pattern. [VERIFIED: codebase grep] |
| NUDGE-04 | Nudge hidden when selected year uncategorized OUT count is zero. | Server page already fetches `overview` before rendering header/data section. [VERIFIED: codebase grep] |
| FILT-01 | User filters income bars by recurring vs extraordinary chips. | `OverviewChartPoint.income` exposes `recurring` and `extraordinary`. [VERIFIED: codebase grep] |
| FILT-02 | User filters expense bars by six OUT natures. | `OverviewChartPoint.out` exposes `essential`, `discretionary`, `operational`, `financial`, `debt`, `extraordinary`. [VERIFIED: codebase grep] |
| FILT-03 | Chart filters affect chart only, not KPIs. | `KpiRow` receives `overview` separately from `OverviewChart`; keep chip state inside chart/filter client subtree. [VERIFIED: codebase grep] |
| EDU-01 | User opens info legend popovers near Entrate/Uscite filter groups. | Existing `components/ui/popover.tsx` wraps Radix Popover primitives. [VERIFIED: codebase grep] |
| EDU-02 | Each chip has a hover/focus tooltip. | Existing `components/ui/tooltip.tsx` wraps Radix Tooltip and requires `TooltipProvider`. [VERIFIED: codebase grep] |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- Read relevant installed Next.js docs under `node_modules/next/dist/docs/` before recommending Next.js behavior because this project uses Next.js 16.2.4 with breaking changes relative to training data. [CITED: AGENTS.md] [VERIFIED: node_modules/next/package.json]
- Developer-facing code, route segments, filenames, comments, tests, logs, commit-facing docs, and agent/project rules must be English. [CITED: AGENTS.md]
- User-facing UI copy may be Italian, including localized validation messages and intentional product/domain surfaces. [CITED: AGENTS.md]
- Public app routes use English slugs; old Italian URLs may exist only as redirects isolated in `lib/routes.ts` and `next.config.ts`. [CITED: AGENTS.md]
- Run `yarn check:language` after touching routes, comments, tests, docs, or developer-facing strings. [CITED: AGENTS.md]
- Project skill discovery found no project-local `.codex/skills` or `.agents/skills` SKILL.md files. [VERIFIED: codebase grep]

## Summary

Phase 44 should be planned as a client interaction layer on top of the Phase 43 server-fetched overview shell: the server page keeps owning `getOverview(year)` and `getOverviewChart(year)`, while small client components own chip state, Radix popovers/tooltips, and localStorage nudge dismissal. [VERIFIED: codebase grep] [CITED: node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md]

The standard implementation path is to pass `overview.uncategorizedCount` and `year` into the header/nudge area, keep KPI props untouched, and make `OverviewChart` filter-aware by reducing only the selected buckets from `OverviewChartPoint`. Monetary reduction must continue using `toDecimal()` until the Recharts number boundary. [VERIFIED: codebase grep] [CITED: node_modules/decimal.js/README.md]

No new packages are needed. Existing stack support is sufficient: Next.js App Router, React client state/effects, Recharts grouped bars, Radix/shadcn popover and tooltip wrappers, lucide icons, Decimal.js, Vitest, and Playwright. [VERIFIED: package.json] [VERIFIED: node_modules package.json]

**Primary recommendation:** Plan one small Wave 0 test/utility slice, then implement nudge + chart filters/education in existing `components/dashboard/overview/` without new DAL/database work. [VERIFIED: codebase grep]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Selected year data loading | Frontend Server (RSC) | API / Backend DAL | `app/(app)/dashboard/overview/page.tsx` resolves `?year=` server-side and calls DAL functions. [VERIFIED: codebase grep] |
| Uncategorized count source | API / Backend DAL | Frontend Server (RSC) | `getOverview(year)` computes `uncategorizedCount`; the page passes it down as serialized props. [VERIFIED: codebase grep] |
| Nudge dismissal | Browser / Client | — | `localStorage` is a browser-only API, and Next.js docs classify browser APIs as Client Component work. [CITED: node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md] |
| Nudge CTA navigation | Browser / Client | Frontend Server (RSC) | CTA targets `/transactions` with existing URL filters; destination route parses query server-side. [VERIFIED: codebase grep] |
| Chart chip state | Browser / Client | — | Chip toggles are transient UI state and do not need server re-fetch. [CITED: .planning/phases/44-overview-interactions/44-CONTEXT.md] |
| Chart bucket reduction | Browser / Client | — | `OverviewChart` already reduces rich chart payload client-side before Recharts render. [VERIFIED: codebase grep] |
| KPI totals | Frontend Server (RSC) | API / Backend DAL | KPI totals come from `getOverview(year)` and should stay independent of chart chip state. [VERIFIED: codebase grep] |
| FlowNature education UI | Browser / Client | — | Popovers/tooltips are interactive Radix primitives in client components. [VERIFIED: codebase grep] [CITED: node_modules/radix-ui/README.md] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.2.4 | App Router server page, navigation hooks, Server/Client Component boundary. | Installed project framework; local docs say pages/layouts are Server Components by default and Client Components are for state, effects, event handlers, and browser APIs. [VERIFIED: node_modules package.json] [CITED: node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md] |
| `react` / `react-dom` | 19.2.5 | Client state/effects and server rendering. | Installed runtime for existing overview components. [VERIFIED: node_modules package.json] |
| `recharts` | 3.8.1 | Grouped bar chart rendering. | Existing `OverviewChart` uses `BarChart`, `Bar`, `Cell`, `LabelList`, tooltip, and legend; Recharts README describes declarative React chart components. [VERIFIED: codebase grep] [CITED: node_modules/recharts/README.md] |
| `decimal.js` | 10.6.0 | Precise money arithmetic before converting to chart numbers. | Existing chart uses `toDecimal`; Decimal README recommends strings to avoid precision loss from numeric literals. [VERIFIED: codebase grep] [CITED: node_modules/decimal.js/README.md] |
| `radix-ui` | 1.4.3 | Popover and tooltip primitive backing via local wrappers. | Existing `components/ui/popover.tsx` and `tooltip.tsx` import Radix primitives; Radix README positions primitives for accessible design systems. [VERIFIED: codebase grep] [CITED: node_modules/radix-ui/README.md] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | 1.14.0 | Info and dismiss icons. | Use `Info`/`X`-style icon buttons for nudge dismiss and education triggers. [VERIFIED: package.json] [VERIFIED: codebase grep] |
| `vitest` | 4.1.5 | Fast unit/render tests. | Use for pure chart reduction utilities, nudge visibility logic, and static render assertions. [VERIFIED: node_modules package.json] [VERIFIED: vitest.config.ts] |
| `@playwright/test` | 1.60.0 | Browser E2E and localStorage checks. | Use for end-to-end nudge dismissal/reappear if unit coverage is insufficient. [VERIFIED: node_modules package.json] [VERIFIED: playwright.config.ts] |
| `typescript` | 6.0.3 | Type checking. | Existing build/typecheck stack is TypeScript. [VERIFIED: node_modules package.json] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client state for chart filters | URL query params for filter state | URL state is allowed but not required; `?year=` remains canonical and filters do not need shareability. [CITED: .planning/phases/44-overview-interactions/44-CONTEXT.md] |
| Reusing `OverviewChart` for chips | New chart component | A new chart component would duplicate Phase 43 grouping/label/Decimal logic. [VERIFIED: codebase grep] |
| Radix Popover/Tooltip wrappers | Custom popover/tooltip | Custom implementations risk focus/positioning/a11y regressions and duplicate installed primitives. [VERIFIED: codebase grep] [CITED: node_modules/radix-ui/README.md] |
| Database-backed nudge dismissal | New user preference table/column | Explicitly out of scope; localStorage only. [CITED: .planning/phases/44-overview-interactions/44-CONTEXT.md] |

**Installation:**

No install command. This phase should add no external packages. [VERIFIED: package.json]

**Version verification:** Versions above were verified from installed `node_modules/*/package.json` and `package.json`, not from training data. [VERIFIED: node_modules package.json] [VERIFIED: package.json]

## Package Legitimacy Audit

No new external packages should be installed for this phase, so the Package Legitimacy Gate is not required. [VERIFIED: package.json] `slopcheck` was not available locally, but this does not block because there are no recommended installs. [VERIFIED: command -v slopcheck]

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| none | — | — | — | — | — | No install planned. [VERIFIED: package.json] |

**Packages removed due to slopcheck [SLOP] verdict:** none. [VERIFIED: package.json]  
**Packages flagged as suspicious [SUS]:** none. [VERIFIED: package.json]

## Architecture Patterns

### System Architecture Diagram

```text
User selects year (?year=)
        |
        v
app/(app)/dashboard/overview/page.tsx (Server Component)
        |
        +--> getOverview(year) -------------> KPI totals + uncategorizedCount
        |
        +--> getOverviewChart(year) --------> 12 rich monthly chart buckets
        |
        v
OverviewHeader / nudge client island
        |                         \
        | localStorage lastSeen    \ Link to /transactions?status=uncategorized&months=YYYY-MM,...
        v
show / hide / reappear nudge

OverviewChart client island
        |
        +--> chip state: income recurring/extraordinary
        +--> chip state: out six natures
        +--> Radix popover + tooltip education
        |
        v
Decimal bucket reduction --> Recharts grouped Entrate/Uscite bars

KpiRow receives original overview totals and never reads chip state.
```

Diagram reflects current server page and client component ownership. [VERIFIED: codebase grep] Next.js docs support passing serializable server data to Client Components. [CITED: node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md]

### Recommended Project Structure

```text
components/dashboard/overview/
├── overview-header.tsx          # existing client title/year row; attach or compose nudge here
├── overview-nudge.tsx           # recommended client island for localStorage dismissal
├── overview-chart.tsx           # existing Recharts chart; make reduction filter-aware
├── overview-chart-filters.tsx   # recommended chip groups + popovers/tooltips
├── overview-chart-utils.ts      # recommended pure filter/reduction helpers for Vitest
└── format.ts                    # existing money format helpers
```

Recommended structure follows current overview component co-location. [VERIFIED: codebase grep]

### Pattern 1: SSR-Safe localStorage Nudge State

**What:** Initialize visible state from props, read/write localStorage only after mount or user action, and store `{ lastSeenCount }` by year-scoped key. [CITED: node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md] [VERIFIED: codebase grep]

**When to use:** Use for NUDGE-03 because `localStorage` is browser-only and the dismissal must never touch the database. [CITED: .planning/phases/44-overview-interactions/44-CONTEXT.md]

**Example:**

```tsx
'use client'

import { useEffect, useState } from 'react'

type StoredDismissal = { lastSeenCount: number }

export function shouldShowNudge(count: number, stored: StoredDismissal | null) {
  if (count <= 0) return false
  return !stored || count > stored.lastSeenCount
}

// Source: Next.js localStorage must be in Client Components; project sidebar reads storage in useEffect.
```

Source verified from Next docs and `components/layout/sidebar-provider.tsx`. [CITED: node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md] [VERIFIED: codebase grep]

### Pattern 2: Filter-Aware Chart Reduction

**What:** Store included income/out keys in client state and reduce only included buckets from each `OverviewChartPoint`; return two Recharts numeric bars. [VERIFIED: codebase grep] [CITED: .planning/phases/44-overview-interactions/44-CONTEXT.md]

**When to use:** Use in `OverviewChart` or a pure helper imported by it. [VERIFIED: codebase grep]

**Example:**

```ts
const OUT_KEYS = ['essential', 'discretionary', 'operational', 'financial', 'debt', 'extraordinary'] as const
const INCOME_KEYS = ['recurring', 'extraordinary'] as const

function sumSelected(values: Record<string, string>, keys: readonly string[]) {
  return keys.reduce((acc, key) => acc.plus(toDecimal(values[key] ?? '0.00')), toDecimal('0.00'))
}

// Convert Decimal to number only where Recharts data rows are built.
```

Source verified from current `deriveBarRow` and Decimal README. [VERIFIED: codebase grep] [CITED: node_modules/decimal.js/README.md]

### Pattern 3: Radix Education Controls

**What:** Use `Popover`, `PopoverTrigger`, `PopoverContent` for group legends and `TooltipProvider` + `Tooltip` around each chip. [VERIFIED: codebase grep]

**When to use:** Use for EDU-01 and EDU-02 on filter groups/chips. [CITED: .planning/REQUIREMENTS.md]

**Example:**

```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <button type="button" aria-pressed={enabled}>Essenziale</button>
    </TooltipTrigger>
    <TooltipContent>Spese necessarie e ricorrenti.</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

Source verified from local UI wrappers and sidebar tooltip usage. [VERIFIED: codebase grep]

### Anti-Patterns to Avoid

- **Reading localStorage in a `useState` initializer:** This risks hydration mismatch; existing sidebar reads after mount in `useEffect`. [VERIFIED: codebase grep]
- **Passing `Set` from server to client:** Next.js docs require Client Component props to be serializable; keep `Set` state inside client components or pass arrays. [CITED: node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md]
- **Native number arithmetic on DECIMAL strings:** Decimal README documents precision loss with JavaScript numbers; current chart already uses `toDecimal`. [CITED: node_modules/decimal.js/README.md] [VERIFIED: codebase grep]
- **Reintroducing stacked bars or balance series:** Requirements and Phase 44 context lock two bars per month only. [CITED: .planning/REQUIREMENTS.md] [CITED: .planning/phases/44-overview-interactions/44-CONTEXT.md]
- **Persisting filter chips to localStorage:** Phase context reserves localStorage for nudge dismissal unless a future requirement asks for sticky filters. [CITED: .planning/phases/44-overview-interactions/44-CONTEXT.md]
- **Using count in nudge copy:** Phase context and requirement NUDGE-01 require no count in copy. [CITED: .planning/REQUIREMENTS.md] [CITED: .planning/phases/44-overview-interactions/44-CONTEXT.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Popover positioning/focus | Custom absolute-position popover | Existing `components/ui/popover.tsx` Radix wrapper | Radix primitives are installed and intended for accessible design systems. [VERIFIED: codebase grep] [CITED: node_modules/radix-ui/README.md] |
| Tooltip behavior | Custom hover-only tooltip | Existing `components/ui/tooltip.tsx` with `TooltipProvider` | Existing wrapper supports the project pattern and focus/hover primitive. [VERIFIED: codebase grep] |
| Money arithmetic | `Number()` sums before reduction | `toDecimal()` / Decimal.js | Decimal README documents precision loss for numeric values; project rule uses Decimal.js for money. [CITED: node_modules/decimal.js/README.md] [CITED: .planning/PROJECT.md] |
| Chart rendering | Custom SVG bar chart | Existing Recharts `OverviewChart` | Existing chart already handles grouped bars, labels, tooltip, legend, and colors. [VERIFIED: codebase grep] |
| Nudge persistence service | DB table/action/API route | localStorage client state | DB persistence explicitly out of scope. [CITED: .planning/phases/44-overview-interactions/44-CONTEXT.md] |
| Transaction URL parsing | New route contract | Existing `/transactions` `status` and `months` params | `parseTransactionFilters` already supports `status=uncategorized` and comma-separated `months`. [VERIFIED: codebase grep] |

**Key insight:** This phase is interaction wiring, not data modeling; the data layer already exposes the needed buckets and count. [CITED: .planning/phases/42-overview-data-layer/42-CONTEXT.md] [VERIFIED: codebase grep]

## Common Pitfalls

### Pitfall 1: Nudge Stays Dismissed After New Uncategorized Expenses

**What goes wrong:** The planner stores only `dismissed: true`, so new uncategorized expenses never re-trigger the nudge. [CITED: .planning/REQUIREMENTS.md]
**Why it happens:** Boolean dismissal loses the `lastSeenCount` comparison required by NUDGE-03. [CITED: .planning/REQUIREMENTS.md]
**How to avoid:** Store `lastSeenCount` and show when `count > lastSeenCount`; make the storage key include overview and year. [CITED: .planning/phases/44-overview-interactions/44-CONTEXT.md]
**Warning signs:** Tests assert dismissal once but not reappear on increased count. [VERIFIED: codebase grep]

### Pitfall 2: Chip State Accidentally Changes KPI Totals

**What goes wrong:** KPI total props are recomputed from filtered chart rows. [CITED: .planning/REQUIREMENTS.md]
**Why it happens:** Chart and KPI aggregation are collapsed into one client state owner. [VERIFIED: codebase grep]
**How to avoid:** Keep `KpiRow data={overview}` unchanged and keep filter state inside chart/filter components only. [VERIFIED: codebase grep]
**Warning signs:** `KpiRow` receives derived chart rows or chip state props. [VERIFIED: codebase grep]

### Pitfall 3: Native Arithmetic Corrupts Money Totals

**What goes wrong:** String amounts are summed with `+` or converted too early to `number`. [VERIFIED: codebase grep]
**Why it happens:** Recharts requires numbers, but DAL amounts are decimal strings. [VERIFIED: codebase grep]
**How to avoid:** Use `toDecimal().plus()` for every selected bucket and convert to `Number()` only in final chart row. [VERIFIED: codebase grep] [CITED: node_modules/decimal.js/README.md]
**Warning signs:** `Number(point.out.essential) + Number(...)` or `point.income.recurring + point.income.extraordinary`. [VERIFIED: codebase grep]

### Pitfall 4: Tooltip Tests Miss Portal Behavior

**What goes wrong:** Static render tests expect Radix portal content to appear inline. [VERIFIED: codebase grep]
**Why it happens:** Existing test comments note Popover/Dialog content does not appear in `renderToStaticMarkup` output because portals render outside the root. [VERIFIED: codebase grep]
**How to avoid:** Static tests can assert triggers and labels; use Playwright or browser-oriented tests for actual tooltip/popover content if needed. [VERIFIED: codebase grep]
**Warning signs:** Vitest assertions fail looking for `TooltipContent`/`PopoverContent` text in static markup. [VERIFIED: codebase grep]

### Pitfall 5: Broken Year-Scoped CTA

**What goes wrong:** `Categorizza ora` sends the user to all uncategorized transactions across all years. [CITED: .planning/phases/44-overview-interactions/44-CONTEXT.md]
**Why it happens:** The existing base filter is only `status=uncategorized`. [VERIFIED: codebase grep]
**How to avoid:** Include `months=YYYY-01,...,YYYY-12` when practical; `parseTransactionFilters` accepts comma-separated months. [VERIFIED: codebase grep]
**Warning signs:** CTA href lacks `months` while implementation claims selected-year scope. [CITED: .planning/phases/44-overview-interactions/44-CONTEXT.md]

## Code Examples

Verified patterns from current sources:

### Server-to-Client Data Passing

```tsx
// Source: app/(app)/dashboard/overview/page.tsx
const [overview, chart] = await Promise.all([getOverview(year), getOverviewChart(year)])

return (
  <>
    <KpiRow data={overview} year={year} />
    <OverviewChart data={chart} />
  </>
)
```

This mirrors Next.js docs that Server Components can pass serializable props to Client Components. [VERIFIED: codebase grep] [CITED: node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md]

### SSR-Safe localStorage Read

```tsx
// Source: components/layout/sidebar-provider.tsx
const [collapsed, setCollapsed] = useState(false)

useEffect(() => {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored !== null) {
    setCollapsed(stored === 'true')
  }
}, [])
```

Use the same after-mount pattern for nudge dismissal. [VERIFIED: codebase grep]

### Existing Transaction Filter Contract

```ts
// Source: lib/validations/transactions.ts
const months = parseMonths(input.months)
const status = parseStatus(input.status, ['categorized', 'uncategorized'])
```

`/transactions?status=uncategorized&months=2026-01,2026-02` matches existing parser behavior. [VERIFIED: codebase grep]

### Existing Decimal Chart Boundary

```ts
// Source: components/dashboard/overview/overview-chart.tsx
const entrate = toDecimal(point.income.recurring)
  .plus(toDecimal(point.income.extraordinary))

return {
  entrate: Number(entrate),
}
```

Keep this pattern and make the selected keys variable. [VERIFIED: codebase grep]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stacked FlowNature chart with URL-persisted legend toggles | Grouped two-bar hero chart with client-side bucket filters | v1.16 Phase 43 completed 2026-06-08 | Phase 44 must not restore stacked nature bars. [CITED: .planning/ROADMAP.md] [VERIFIED: codebase grep] |
| Five KPI cards including uncategorized | Four KPI cards plus inline title-row nudge | v1.16 requirements | Nudge replaces KPI card and must stay inline. [CITED: .planning/REQUIREMENTS.md] |
| Income categories mixed under `income`/`financial` natures | `income` = recurring and `income_extraordinary` = extraordinary | Phase 42 completed 2026-06-08 | FILT-01 maps directly to chart payload; no schema work. [CITED: .planning/phases/42-overview-data-layer/42-CONTEXT.md] [VERIFIED: codebase grep] |
| Prototype source files | Production overview components | Phase 43 cleanup | `app/proto/overview/*` files are absent; use production components as source of truth. [VERIFIED: codebase grep] |

**Deprecated/outdated:**
- `app/proto/overview/variant-a.tsx` and `mock-data.ts`: no longer present after Phase 43 cleanup. [VERIFIED: codebase grep]
- Old Italian public route slugs: only redirects may keep them, per AGENTS.md. [CITED: AGENTS.md]
- Dedicated FlowNature glossary screen: rejected; education stays in-flow. [CITED: docs/adr/0005-first-import-onboarding-gate.md]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Exact one-line Italian tooltip/popover wording can be selected by the planner from current labels and context. [ASSUMED] | Architecture Patterns / Code Examples | Low; wording may need PO copy review but behavior is unaffected. |
| A2 | Unit tests for pure nudge/filter helpers plus static render tests are sufficient unless Playwright coverage is chosen for localStorage. [ASSUMED] | Validation Architecture | Medium; interactive localStorage behavior may need browser E2E for confidence. |

## Open Questions (RESOLVED)

1. **Should all-off per filter group be allowed or prevented?**
   - What we know: Empty bars are acceptable and no chart-empty panel should appear. [CITED: .planning/phases/44-overview-interactions/44-CONTEXT.md]
   - What's unclear: Context leaves all-off prevention vs reset affordance to planner discretion. [CITED: .planning/phases/44-overview-interactions/44-CONTEXT.md]
   - RESOLVED: Allow all-off per group; no mandatory reset affordance. Discretionary item resolved in plan 44-03.

2. **Should localStorage nudge state be unit-tested or E2E-tested?**
   - What we know: Existing sidebar localStorage persistence is covered by Playwright. [VERIFIED: codebase grep]
   - What's unclear: Phase context leaves test level to planner discretion. [CITED: .planning/phases/44-overview-interactions/44-CONTEXT.md]
   - RESOLVED: `shouldShowNudge` extracted to a pure helper covered by Vitest (plan 44-01/44-02); no new Playwright path required.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Next.js, Vitest, build | yes | v25.8.1 | — [VERIFIED: node --version] |
| Yarn | Project package manager | yes | 4.14.1 | npm scripts exist but lockfile is Yarn. [VERIFIED: yarn --version] [VERIFIED: package.json] |
| npm | Script fallback / Playwright webServer command uses `npm run dev` | yes | 11.11.0 | Yarn can run scripts. [VERIFIED: npm --version] [VERIFIED: playwright.config.ts] |
| Next.js docs in `node_modules` | AGENTS.md Next.js guidance | yes | 16.2.4 docs installed | No fallback needed. [VERIFIED: node_modules/next/package.json] |
| Context7 CLI (`ctx7`) | Optional docs lookup fallback | no | — | Installed local docs were used. [VERIFIED: command -v ctx7] |
| slopcheck | Package legitimacy gate | no | — | No new packages planned, so audit is skipped. [VERIFIED: command -v slopcheck] |

**Missing dependencies with no fallback:** none for planning this phase. [VERIFIED: package.json]  
**Missing dependencies with fallback:** `ctx7` absent; installed Next/package docs and current source were used instead. [VERIFIED: command -v ctx7]

## Validation Architecture

`workflow.nyquist_validation` is absent from `.planning/config.json`, so validation architecture is enabled. [VERIFIED: .planning/config.json]

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 and Playwright 1.60.0. [VERIFIED: node_modules package.json] |
| Config file | `vitest.config.ts`, `playwright.config.ts`. [VERIFIED: codebase grep] |
| Quick run command | `yarn test tests/overview-interactions.test.tsx` or focused helper test file. [VERIFIED: package.json] |
| Full suite command | `yarn test && yarn check:language && yarn build`. [VERIFIED: package.json] |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| NUDGE-01 | Count > 0 renders inline title-row nudge. | component render | `yarn test tests/overview-interactions.test.tsx -t nudge` | no - Wave 0 [VERIFIED: tests listing] |
| NUDGE-02 | CTA href includes `status=uncategorized`; dismiss button has accessible label. | component render | `yarn test tests/overview-interactions.test.tsx -t nudge` | no - Wave 0 [VERIFIED: tests listing] |
| NUDGE-03 | Dismiss writes `lastSeenCount`; higher count reappears. | unit + optional E2E | `yarn test tests/overview-interactions.test.tsx -t lastSeenCount` | no - Wave 0 [VERIFIED: tests listing] |
| NUDGE-04 | Count 0 suppresses nudge. | unit/component render | `yarn test tests/overview-interactions.test.tsx -t nudge` | no - Wave 0 [VERIFIED: tests listing] |
| FILT-01 | Income chips include/exclude recurring/extraordinary from green bars. | unit helper | `yarn test tests/overview-interactions.test.tsx -t income` | no - Wave 0 [VERIFIED: tests listing] |
| FILT-02 | Expense chips include/exclude six OUT natures from red bars. | unit helper | `yarn test tests/overview-interactions.test.tsx -t expense` | no - Wave 0 [VERIFIED: tests listing] |
| FILT-03 | KPI totals remain independent of chip state. | render/unit boundary | `yarn test tests/overview-interactions.test.tsx -t KPI` | no - Wave 0 [VERIFIED: tests listing] |
| EDU-01 | Info popover triggers render with accessible names near groups. | component render + optional browser | `yarn test tests/overview-interactions.test.tsx -t education` | no - Wave 0 [VERIFIED: tests listing] |
| EDU-02 | Each chip is wrapped with tooltip trigger and one-line definition source exists. | component render | `yarn test tests/overview-interactions.test.tsx -t tooltip` | no - Wave 0 [VERIFIED: tests listing] |

### Sampling Rate

- **Per task commit:** `yarn test tests/overview-interactions.test.tsx` plus `yarn check:language` when docs/tests/comments/user-facing strings are touched. [VERIFIED: package.json] [CITED: AGENTS.md]
- **Per wave merge:** `yarn test && yarn check:language`. [VERIFIED: package.json] [CITED: AGENTS.md]
- **Phase gate:** `yarn build` after all interaction wiring. [VERIFIED: package.json]

### Wave 0 Gaps

- [ ] `tests/overview-interactions.test.tsx` - covers NUDGE-01..04, FILT-01..03, EDU-01..02 with pure helpers/static render tests. [VERIFIED: tests listing]
- [ ] Optional `tests/overview-interactions.spec.ts` - only if planner wants browser-level localStorage/tooltip verification. [ASSUMED]
- [ ] Extract pure helpers from `OverviewChart` if needed, because current `deriveBarRow` is private inside `overview-chart.tsx`. [VERIFIED: codebase grep]

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so security domain is enabled. [VERIFIED: .planning/config.json]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no new auth | Existing page is behind app route/session architecture; no new auth paths. [VERIFIED: codebase grep] |
| V3 Session Management | no new sessions | Do not add server actions/API routes for nudge persistence. [CITED: .planning/phases/44-overview-interactions/44-CONTEXT.md] |
| V4 Access Control | yes, via navigation target | Reuse `/transactions` route filters; do not bypass existing DAL ownership. [VERIFIED: codebase grep] |
| V5 Input Validation | yes, URL params | Existing transaction parser validates `status` and `months`; CTA should produce canonical values only. [VERIFIED: codebase grep] |
| V6 Cryptography | no | No crypto or secret handling in this phase. [VERIFIED: codebase grep] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client-side tampering with localStorage dismissal | Tampering | Treat nudge dismissal as presentation-only; never use localStorage for authorization or persisted business decisions. [CITED: .planning/phases/44-overview-interactions/44-CONTEXT.md] |
| Query-param injection into transactions URL | Tampering | Build URL with `URLSearchParams` and only known `status`/`months` values; destination parser validates allowed status/months. [VERIFIED: codebase grep] |
| Cross-user data exposure | Information Disclosure | Do not add new data fetch paths; existing DAL uses `verifySession()` and user-scoped queries. [VERIFIED: codebase grep] |
| XSS via tooltip/popover copy | Information Disclosure / Tampering | Use static React text; do not use `dangerouslySetInnerHTML`. [VERIFIED: codebase grep] |

## Sources

### Primary (HIGH confidence)

- `.planning/phases/44-overview-interactions/44-CONTEXT.md` - locked decisions, discretion, deferred scope. [CITED: .planning/phases/44-overview-interactions/44-CONTEXT.md]
- `.planning/REQUIREMENTS.md` - NUDGE/FILT/EDU requirement text and out-of-scope notes. [CITED: .planning/REQUIREMENTS.md]
- `.planning/ROADMAP.md` - Phase 44 phase goal and status. [CITED: .planning/ROADMAP.md]
- `.planning/PROJECT.md` - stack and milestone summary. [CITED: .planning/PROJECT.md]
- `AGENTS.md` - Next.js docs and language constraints. [CITED: AGENTS.md]
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` - Client Component use cases, browser APIs, serializable props. [CITED: node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md]
- `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md` - native history/search param integration. [CITED: node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md]
- `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md` - URL-derived UI state examples with router replace. [CITED: node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md]
- `components/dashboard/overview/*`, `lib/dal/overview.ts`, `lib/validations/transactions.ts`, `components/ui/popover.tsx`, `components/ui/tooltip.tsx` - current implementation seams. [VERIFIED: codebase grep]
- `node_modules/recharts/README.md`, `node_modules/radix-ui/README.md`, `node_modules/decimal.js/README.md` - package behavior and purpose. [CITED: node_modules/recharts/README.md] [CITED: node_modules/radix-ui/README.md] [CITED: node_modules/decimal.js/README.md]

### Secondary (MEDIUM confidence)

- Graphify status: graph exists but is stale by 457 hours and 462 commits; graph queries returned no useful nodes. [VERIFIED: graphify status]

### Tertiary (LOW confidence)

- None used as authoritative sources. [VERIFIED: sources audit]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified from installed package versions and current code. [VERIFIED: node_modules package.json] [VERIFIED: codebase grep]
- Architecture: HIGH - phase context and current overview page clearly define server/client boundaries. [CITED: .planning/phases/44-overview-interactions/44-CONTEXT.md] [VERIFIED: codebase grep]
- Pitfalls: HIGH - derived from locked requirements, current implementation, and existing test comments/patterns. [CITED: .planning/REQUIREMENTS.md] [VERIFIED: codebase grep]
- Validation: MEDIUM - test framework is verified, but exact interactive coverage level remains planner discretion. [VERIFIED: vitest.config.ts] [CITED: .planning/phases/44-overview-interactions/44-CONTEXT.md]

**Research date:** 2026-06-08  
**Valid until:** 2026-07-08 for current repo/package state; revisit sooner if Phase 43 files or Next.js version change. [ASSUMED]
