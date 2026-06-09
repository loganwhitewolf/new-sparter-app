---
phase: 260609-fru
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/dashboard/overview/overview-movers-format.ts
  - components/dashboard/overview/overview-movers-panel.tsx
  - components/dashboard/overview/overview-chart.tsx
  - components/dashboard/overview/overview-chart-utils.ts
  - components/dashboard/overview/overview-header.tsx
  - components/dashboard/overview/overview-nudge.tsx
  - components/dashboard/overview/kpi-row.tsx
  - app/(app)/dashboard/overview/page.tsx
  - tests/overview-movers.test.tsx
  - tests/overview-interactions.test.tsx
autonomous: true
requirements: [FRU-FIX-01, FRU-FIX-02, FRU-FIX-03, FRU-FIX-04, FRU-FIX-05, FRU-FIX-06]

must_haves:
  truths:
    - "Movers panel shows at most 5 entries total per month"
    - "Each mover amount is colored red for increases/new spend and green for savings"
    - "The 'in più / in meno / spesa nuova' qualifier text is visually muted (secondary)"
    - "Movers section titles ('Dove hai speso di più' / 'Dove hai risparmiato') are white/foreground colored"
    - "Hovering a chart bar shows a tooltip breaking down entrate and uscite by nature"
    - "The chart legend lists income natures on one row and out natures on a second row, each with a colored dot matching its series color"
    - "Selecting a month no longer draws a green/muted highlight rectangle around bars on hover"
    - "The 'spese da categorizzare' nudge sits on the title row aligned right, not on its own row"
    - "The Entrate and Uscite KPI cards reflect the real prior-period comparison, not always 'in linea con il {anno}'"
  artifacts:
    - path: "components/dashboard/overview/overview-movers-format.ts"
      provides: "top-5 selection + amount-color + label-split pure helpers"
      contains: "export function"
    - path: "components/dashboard/overview/overview-movers-panel.tsx"
      provides: "movers rendering with colored amounts, muted qualifiers, white titles"
    - path: "components/dashboard/overview/overview-chart.tsx"
      provides: "per-nature tooltip, two-row nature legend with dots, no cursor rect"
    - path: "components/dashboard/overview/overview-header.tsx"
      provides: "title row with inline right-aligned nudge slot"
    - path: "components/dashboard/overview/kpi-row.tsx"
      provides: "conditional Entrate/Uscite reading text reflecting real deviation"
  key_links:
    - from: "components/dashboard/overview/overview-chart.tsx"
      to: "lib/utils/nature-labels (NATURE_COLORS, NATURE_LABELS)"
      via: "import for legend dots and tooltip breakdown"
      pattern: "NATURE_COLORS|NATURE_LABELS"
    - from: "app/(app)/dashboard/overview/page.tsx"
      to: "components/dashboard/overview/overview-header.tsx"
      via: "uncategorizedCount/year passed into the header title row"
      pattern: "OverviewHeader|OverviewNudge"
---

<objective>
Correct six overview-dashboard discrepancies where the shipped v1.16 implementation diverged from the locked prototype. All six fixes are scoped corrections to existing components under `components/dashboard/overview/` plus the overview page. No new subsystems, no DAL/schema changes — the per-nature data the tooltip and legend need already exists on `OverviewChartPoint`.

Purpose: Bring the live dashboard overview back in line with the agreed prototype so the UI reads correctly (accurate KPI text, top-5 movers, per-nature chart breakdown, correct nudge placement).
Output: Updated overview components + extended unit tests covering the new pure logic.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@CONTEXT.md

# Source files under correction (read each before editing)
@components/dashboard/overview/overview-movers-format.ts
@components/dashboard/overview/overview-movers-panel.tsx
@components/dashboard/overview/overview-chart.tsx
@components/dashboard/overview/overview-chart-utils.ts
@components/dashboard/overview/overview-header.tsx
@components/dashboard/overview/overview-nudge.tsx
@components/dashboard/overview/kpi-row.tsx
@components/dashboard/overview/kpi-card-reading.tsx
@app/(app)/dashboard/overview/page.tsx
@lib/dal/overview.ts
@lib/utils/nature-labels.ts
@components/dashboard/overview/format.ts

# Test patterns to extend
@tests/overview-movers.test.tsx
@tests/overview-interactions.test.tsx

# Domain semantics: OUT increases (spesa in più / nuova) are negative for the user;
# OUT decreases (spesa in meno) are savings. Confirm against splitMovers() which
# already partitions delta>0 || isNew into "increases" and delta<0 into "savings".
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Movers panel — top 5, colored amounts, muted qualifiers, white titles (FRU-FIX-01)</name>
  <files>components/dashboard/overview/overview-movers-format.ts, components/dashboard/overview/overview-movers-panel.tsx, tests/overview-movers.test.tsx</files>
  <behavior>
    In overview-movers-format.ts add pure helpers (unit-tested in overview-movers.test.tsx):
    - A `takeTopMovers(movers, limit = 5)` helper that returns at most `limit` entries from an already-|delta|-desc-sorted array. Test: 7 inputs → 5 outputs; 3 inputs → 3 outputs; preserves input order.
    - A `moverAmountTone(m)` helper returning `'increase'` for `m.isNew || Number(m.delta) > 0`, else `'decrease'`. Test: positive delta → 'increase'; isNew with negative delta → 'increase'; negative delta non-new → 'decrease'.
    - A `moverQualifier(m)` helper returning ONLY the trailing qualifier text in Italian: `'spesa nuova'` when isNew, else `'in più'` / `'in meno'` by delta sign. Test each branch. (formatMoverAmount stays as-is for back-compat; do not break its existing tests.)
  </behavior>
  <action>
    Add the three pure helpers above to overview-movers-format.ts. Keep existing exports (formatMoverLine, formatMoverAmount, splitMovers) unchanged — extend, do not rewrite. Use display-only Number()/Math.abs conversions consistent with the existing file comment (presentation layer, Decimal.js not required here per CLAUDE.md).

    In overview-movers-panel.tsx (FRU-FIX-01 a–d):
    (a) Top 5: before calling splitMovers, slice the incoming movers to the top 5 via takeTopMovers (movers arrive already sorted |delta| desc from the DAL). The 5 cap is applied across both columns combined — splitMovers then partitions the capped list.
    (b) Colored amount: render each row's amount split into the euro figure plus the qualifier. The euro figure uses the tone from moverAmountTone: 'increase' → red `text-[var(--total-out)]`, 'decrease' → green `text-[var(--total-in)]`. Reuse formatEur for the euro figure (import from ./format) — do not concatenate the qualifier into the colored span.
    (c) Muted qualifier: render moverQualifier(m) in a separate span with `text-muted-foreground` and a smaller/secondary weight (e.g. `text-xs text-muted-foreground`), visually de-emphasized relative to the amount.
    (d) White section titles: change the two `<p>` headers ("Dove hai speso di più", "Dove hai risparmiato") from `text-[var(--total-out)]` / `text-[var(--total-in)]` to `text-foreground` (white in dark theme). The red/green semantic now lives on the per-row amount, not the column title.

    Keep all UI copy Italian. Keep code/comments English. Do not change splitMovers semantics.
  </action>
  <verify>
    <automated>cd /Users/andreabernardini/ai-projects/new-sparter-app && yarn vitest run tests/overview-movers.test.tsx</automated>
  </verify>
  <done>takeTopMovers caps at 5; moverAmountTone and moverQualifier return correct branches (all covered by passing tests). Panel slices to top 5, amounts are red for increase/new and green for decrease, qualifier text is muted, and both column titles use text-foreground. Existing overview-movers.test.tsx assertions still pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Chart — per-nature tooltip, two-row legend with dots, remove highlight rect (FRU-FIX-02, FRU-FIX-05, FRU-FIX-06)</name>
  <files>components/dashboard/overview/overview-chart.tsx, components/dashboard/overview/overview-chart-utils.ts, tests/overview-interactions.test.tsx</files>
  <behavior>
    In overview-chart-utils.ts add a pure helper (unit-tested in overview-interactions.test.tsx):
    - `deriveNatureBreakdown(point, includedIncome, includedOut)` returning an object with two ordered arrays — `income: { key, label, color, amount }[]` and `out: { key, label, color, amount }[]` — where amount is a number summed only over included keys, label comes from NATURE_LABELS, and color from NATURE_COLORS. Income keys map: recurring → nature 'income', extraordinary → nature 'income_extraordinary'. Out keys map 1:1 to their FlowNature. Tests: with the existing FIXTURE, income has recurring=1000 / extraordinary=200 with correct labels+colors; out lists the six natures with their fixture amounts; excluding a key drops it from the returned array (or zeroes it — pick one and assert consistently).
  </behavior>
  <action>
    FRU-FIX-02 (per-nature tooltip): Build a custom tooltip content component inside overview-chart.tsx (not the shared shadcn ChartTooltipContent, which only shows entrate/uscite totals). On hover over a month, it must list the per-nature amounts that compose that month's entrate and uscite. Source the breakdown from deriveNatureBreakdown using the current includedIncome/includedOut sets and the hovered point. The Recharts Tooltip payload gives the active index/label; resolve the matching `data[index]` OverviewChartPoint to feed deriveNatureBreakdown (the derived bar rows only carry totals, so read from the original `data` prop). Render two short sections (Entrate / Uscite), each line: colored dot (NATURE_COLORS) + nature label (NATURE_LABELS) + formatEur(amount). Skip zero-amount natures. Keep tooltip copy Italian.

    FRU-FIX-05 (remove green/muted highlight rectangle): the rect is the Recharts tooltip cursor — `components/ui/chart.tsx` styles `.recharts-rectangle.recharts-tooltip-cursor` with `fill-muted`, which renders the highlight box behind the hovered category. Disable it locally by passing `cursor={false}` to the `<ChartTooltip>` in overview-chart.tsx. Do NOT edit the shared components/ui/chart.tsx. Verify no other reference-area/rectangle is drawn on month selection; the per-Cell opacity dimming (selected month full, others 0.4) stays as the selection affordance.

    FRU-FIX-06 (two-row legend with per-nature dots): replace the current `<ChartLegend content={<ChartLegendContent />} />` (which shows only Entrate/Uscite) with a custom legend rendered outside the Recharts BarChart (a plain div under the chart, or a custom legend content). Row 1 = income natures, Row 2 = out natures. Each item: a small colored dot using NATURE_COLORS for that nature + its NATURE_LABELS text, so the user can match each nature to its chart color at a glance. Respect the current included sets if practical (dim/strike excluded ones to stay consistent with the filter chips) — at minimum render all natures with correct dots. Keep labels Italian.

    Implementation notes: import NATURE_COLORS and NATURE_LABELS from '@/lib/utils/nature-labels'. Number() conversions for Recharts stay confined to the util boundary (deriveNatureBreakdown / deriveFilteredBarRow) per the existing file convention; no native arithmetic on DECIMAL strings (use toDecimal().plus()). Keep the existing bar rendering, labels, and per-Cell opacity untouched except for the cursor and legend changes.
  </action>
  <verify>
    <automated>cd /Users/andreabernardini/ai-projects/new-sparter-app && yarn vitest run tests/overview-interactions.test.tsx</automated>
  </verify>
  <done>deriveNatureBreakdown returns correctly-labeled, correctly-colored, correctly-summed income and out arrays for the FIXTURE and respects exclusions (tests pass). Chart tooltip lists per-nature amounts for entrate and uscite on hover; legend shows income natures on one row and out natures on a second row, each with a NATURE_COLORS dot; no highlight rectangle appears on hover (cursor={false}); shared components/ui/chart.tsx is unchanged.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Nudge on title row + conditional KPI reading (FRU-FIX-03, FRU-FIX-04)</name>
  <files>app/(app)/dashboard/overview/page.tsx, components/dashboard/overview/overview-header.tsx, components/dashboard/overview/overview-nudge.tsx, components/dashboard/overview/kpi-row.tsx, tests/overview-interactions.test.tsx</files>
  <behavior>
    KPI reading (FRU-FIX-04) is the testable unit. Extract the Entrate/Uscite reading-selection into a pure exported helper and test it in tests/overview-interactions.test.tsx:
    - Export `trendReading(delta, prevYear, kind)` from kpi-row.tsx (it currently exists as a private function) OR add a thin exported wrapper `resolveTrendReading(delta: number | null, prevYear, kind)` that returns the "no prior-year comparison" reading when delta is null and otherwise delegates to trendReading. Tests: delta=null → text is NOT "In linea con il {prevYear}" (e.g. "Nessun confronto con il {prevYear}" or similar neutral copy) and sentiment 'neutral'; delta=0 (within ±1) → "In linea con il {prevYear}"; delta=+10, kind='in' → "Più entrate del {prevYear}", sentiment 'good'; delta=+10, kind='out' → "Spendi più del {prevYear}", sentiment 'warn'.
  </behavior>
  <action>
    FRU-FIX-04 (conditional KPI reading): In kpi-row.tsx the Entrate and Uscite cards currently fall back to a hardcoded `{ text: 'In linea con il {prevYear}' }` whenever `data.deltas.totalIn` / `totalOut` is null — which prints "in linea con" even when there is no real comparison or when the real delta differs. Fix so the reading reflects the actual deviation:
    - When the delta is non-null, use trendReading (already correct: ±1 → "In linea con il", >+1/-1 → more/less entrate or spendi più/meno).
    - When the delta is null (no prior-year data), do NOT say "in linea con"; render a truthful neutral reading such as "Nessun confronto con il {prevYear}" (Italian). Introduce a small exported helper (resolveTrendReading) wrapping this null-vs-non-null branch so it is unit-testable, and call it from both the Entrate and Uscite cards. Export trendReading if needed for the test. Leave the Bilancio and Tasso risparmio readings unchanged.

    FRU-FIX-03 (nudge on title row, right-aligned): Today OverviewNudge renders as its own full-width row inside OverviewDataSection, above KpiRow; the prototype wants it inline on the "Panoramica delle tue finanze" title row, aligned right. Implement:
    - In overview-header.tsx, make the title row a flex container that pushes a right-side slot to the end (e.g. `justify-between` or an `ml-auto` wrapper). Render the nudge in that right slot. Accept the data the nudge needs (uncategorizedCount, year) as props, or accept a `nudge` ReactNode slot prop — pick whichever keeps the header a clean presentational component.
    - The header is rendered eagerly in page.tsx (outside Suspense) and only has `years`; uncategorizedCount comes from the streamed data section. Resolve this by moving the nudge into the header row WITHOUT blocking the eager header: pass uncategorizedCount into the header. Since uncategorizedCount requires the data fetch, EITHER (a) move OverviewHeader render to inside OverviewDataSection so it receives uncategorizedCount (keeping a lightweight header-shell/skeleton in the Suspense fallback), OR (b) keep the eager header and render the nudge in its right slot via a small client wrapper that fetches/receives the count. Prefer the simplest correct option (a): render the title+year+nudge together once the data is available, and ensure the year selector still works (year stays a server-resolved prop, the Select still updates ?year=). Keep the existing nudge localStorage/lastSeenCount behavior and OUT-only count intact — only its placement changes. The nudge styling can stay the amber inline pill but must now sit on the title row at the right; tighten it (e.g. drop the full-width `flex-1`) so it reads as a compact right-aligned badge rather than a banner.
    - Remove the standalone full-width OverviewNudge row from its previous position so it no longer occupies its own row.

    Keep UI copy Italian, code/comments English. After string changes, run yarn check:language.
  </action>
  <verify>
    <automated>cd /Users/andreabernardini/ai-projects/new-sparter-app && yarn vitest run tests/overview-interactions.test.tsx && yarn check:language</automated>
  </verify>
  <done>resolveTrendReading returns a truthful neutral reading (not "in linea con") when delta is null, and the correct more/less reading otherwise (tests pass). Entrate/Uscite cards no longer always say "in linea con il {anno}". The nudge renders inline on the "Panoramica delle tue finanze" title row aligned right (no longer its own full-width row), the year selector still updates ?year=, and the nudge's localStorage/lastSeenCount/OUT-only behavior is unchanged. yarn check:language passes.</done>
</task>

</tasks>

<verification>
- `yarn vitest run tests/overview-movers.test.tsx tests/overview-interactions.test.tsx` passes (new pure helpers + existing assertions).
- `yarn check:language` passes (UI copy Italian, code/comments English).
- `yarn build` (or `yarn lint`) succeeds — no type errors from the new helper signatures or the header prop change.
- Shared `components/ui/chart.tsx` is unchanged (the cursor rect is disabled locally via `cursor={false}`).
- Manual smoke (developer, optional): on /dashboard/overview the movers panel shows ≤5 rows with red/green amounts + muted qualifiers + white titles; hovering a bar shows a per-nature tooltip with no highlight rectangle; the legend has two rows of dotted natures; the nudge sits right-aligned on the title row; Entrate/Uscite KPI readings reflect the real comparison.
</verification>

<success_criteria>
All six prototype discrepancies are corrected with minimal, scoped diffs:
1. Movers panel: top 5 only, amounts colored red/green by type, qualifier muted, titles white.
2. Chart: hover tooltip lists per-nature breakdown of entrate and uscite.
3. Nudge: inline on the title row, right-aligned, not its own row.
4. KPI Entrate/Uscite readings reflect the real prior-period deviation (no false "in linea con").
5. No green/muted highlight rectangle on bar hover/selection.
6. Two-row nature legend (income / out) with per-nature colored dots.

No DAL/schema changes. No shared UI component edits. CLAUDE.md rules respected (Decimal.js for any monetary math, Italian only for product copy, English code/comments, yarn check:language run).
</success_criteria>

<output>
Create `.planning/quick/260609-fru-dashboard-prototype-fixes-movers-top5-co/260609-fru-SUMMARY.md` when done.
</output>
