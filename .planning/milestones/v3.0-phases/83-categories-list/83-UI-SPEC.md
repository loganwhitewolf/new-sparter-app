---
phase: 83
slug: categories-list
status: draft
shadcn_initialized: true
preset: default
created: 2026-07-31
---

# Phase 83 — UI Design Contract

> Visual and interaction contract for the Categories list rewrite. Categories ranked by year-scoped total, each row carrying share, sparkline, and inline projection.
>
> **Design locked:** Prototype validated 2026-07-30 (`.scratch/dashboard-categories/list-row.html`).
> **Decisions locked:** ADR 0020, Phase 83-CONTEXT.md (D-01…D-15).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui (installed) |
| Preset | default |
| Component library | Radix UI (via shadcn) |
| Icon library | Lucide React |
| Font | System UI stack (ui-sans-serif, system-ui, -apple-system, "Segoe UI") |

**Tailwind CSS enabled.** All spacing, typography, and colour derived from project tokens via Tailwind config. Existing dashboard CSS custom properties (`--total-in`, `--total-out`, etc.) remain the single source of truth for direction-scoped colors.

---

## Spacing Scale

Inherited from project baseline (8-point grid):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon inline gaps, minimal padding |
| sm | 8px | Compact spacing (controls, badges) |
| md | 16px | Default element padding and row gaps |
| lg | 24px | Section padding |
| xl | 32px | Major section breaks |
| 2xl | 48px | Top-level layout margins |

**Exceptions:** None. All measurements multiples of 4.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Label (all control labels, uppercase) | 12px | 500 | 1.3 |
| Body | 14px | 400 | 1.5 |
| Heading (section, row name) | 16px | 600 | 1.2 |
| Display (page heading) | 20px | 600 | 1.2 |

**Special applications:**
- **Rank badge:** 12px weight 600, line-height 1
- **Numeric (monetary):** 16px weight 600 (or 500 for subordinate projection), tabular-nums, `ui-monospace, Menlo, monospace`

**Projection hierarchy:** Projection subordination (D-06) is achieved via **weight and colour**, not size — both total and projection render at 16px, but projection uses weight 500 + muted-fg colour while total uses weight 600 + foreground colour. The inner figure `<strong>` uses weight 600 + foreground to emphasize the amount within the subordinate context.

**Monospace (numeric):** `ui-monospace, Menlo, monospace` for monetary values to maintain digit alignment.

---

## Color

| Role | Hex | Usage |
|------|-----|-------|
| Dominant surface (60%) | #ffffff / #09090b | Page background |
| Secondary surface (30%) | #ffffff / #0c0c0e | Row cards, headers |
| Border | #e4e4e7 / #27272a | Row dividers, control borders |
| Muted background | #f4f4f5 / #27272a | Badges, control groups |
| Muted text | #71717a / #a1a1aa | Secondary labels, metadata |
| Foreground | #0a0a0a / #fafafa | Body text |
| Primary (interactive) | #18181b / #fafafa | Focus, links |
| Outflows (`--total-out`) | #f97316 (orange) | Uscite rows, sparklines, bars |
| Inflows (`--total-in`) | #34d399 (green) | Entrate rows, sparklines, bars |
| Allocations (`var(--total-allocation)`) | #a78bfa (purple, already in `app/globals.css`) | Accantonamenti rows, sparklines, bars |
| Destructive | #dc2626 | Not in scope for Phase 83 |
| Good (positive movement) | #16a34a | Not in scope for Phase 83 |

**Surface allocation (60/30/10):**
- **60% Dominant:** Neutral surfaces (white/dark background)
- **30% Secondary:** Row cards, header backgrounds
- **10% Accent:** Interactive states only (hover borders on rows, pressed button states in direction/sort toggles)

**Implementation note:** `--total-allocation` (#a78bfa) is already defined in `app/globals.css` for both light and dark modes. Phase 83 does not need to add this token; it is ready to use.

---

## Copywriting Contract

### Page Heading and Direction

| Element | Uscite (Outflows) | Entrate (Inflows) | Accantonamenti (Allocations) |
|---------|---|---|---|
| Page heading | "Categorie" | "Categorie" | "Categorie" |
| Subheading | "Dove spendi di più nel {year}, e dove arrivi a questo ritmo." | "Dove entrano i soldi nel {year}, e dove arrivi a questo ritmo." | "Dove destini risorse nel {year}, e dove arrivi a questo ritmo." |

### Row Metadata

| Element | Uscite | Entrate | Accantonamenti |
|---------|---|---|---|
| Movement count label | "{N} movimenti" | "{N} movimenti" | "{N} movimenti" |
| Share label | "· {P}% del totale" | "· {P}% del totale ricevuto" | "· {P}% del totale destinato" |

### Numeric Labels (Row)

| Element | Copy | Font | Weight | Color |
|---------|------|------|--------|-------|
| Total label | "Totale" | 12px | 500 | muted-fg |
| Total value | "{formatted amount}" | 16px | 600 | foreground |
| Projection label (≥2 Covered Months) | "A questo passo" | 12px | 500 | muted-fg |
| Projection value (≥2 Covered Months) | "{formatted amount}" with inner `<strong>` | 16px | 500 (label) / 600 (inner) | muted-fg (label) / foreground (strong) |
| Projection label + value (<2 Covered Months) | *entire pair absent; not even em-dash* | — | — | — |

**Rationale for absent projection:** D-15 requires that no numeric field renders when coverage is insufficient — the engine deliberately returns no projection value. An em-dash would re-introduce a "value-shaped slot" the type system was designed to hold back. The explanation lives in the Single-Covered-Month nudge below the list, which explicitly states what is missing and how to get it.

### Sort Toggle Options

| Option | Label | State |
|--------|-------|-------|
| Primary (default) | "Totale" | Always enabled |
| Secondary | "Proiezione" | Enabled at ≥2 Covered Months; **disabled with a stated reason** below that |

**Disabled-state copy (<2 Covered Months):** the "Proiezione" option stays visible but is not
selectable, and carries the reason — `title` / `aria-describedby`:
"Serve un secondo mese importato per calcolare la proiezione."

The option is **never hidden** and **never silently degrades to sorting by total**: hiding it means
the user never discovers the projection exists, and a silent degrade makes the control lie about
what it is doing. Both are rejected under D-14 (a figure or control that changes without
explanation reads as a bug).

**Note:** Replaces retired "Deviazione" option. Reuses existing `SortToggle` component shape.

### Year With No Imported Data (zero Covered Months)

Distinct from the per-direction empty state below — this is "the whole year is empty", where
advising the user to try another direction would be misleading.

| Element | Copy |
|---------|------|
| Heading (20px 600) | "Nessun dato per il {year}" |
| Body (14px 400) | "Non hai ancora importato movimenti per questo anno. Importa un estratto conto per vedere le tue categorie." |
| Action | Link to the import surface — the way out is importing, not changing filter |

**Precedence:** when a year has zero Covered Months this state replaces the list entirely, whatever
direction is selected. The per-direction empty state (`## Empty State`) applies only when the year
*does* have data but the selected direction has none.

### Single-Covered-Month State

**Nudge heading:** "Con un secondo mese importato"

**Nudge body:** "vedrai il ritmo mensile e la proiezione di fine anno. Serve almeno un mese concluso oltre a quello in corso."

**Styling:** Dashed border, muted background, 14px body text (see `## Nudge (Single-Covered-Month State)` below for the full spec — this row must not diverge from it). Reuses `OverviewNudge` component pattern.

### Direction Filter Button Labels

| Direction | Label |
|-----------|-------|
| Outflows | "Uscite" |
| Inflows | "Entrate" |
| Allocations | "Accantonamenti" |

---

## Sparkline Visual States

The 12-month sparkline bar chart carries four distinct visual states, each representing a different kind of data:

| State | Visual | Height | Opacity/Pattern | Usage |
|-------|--------|--------|---|---|
| **Covered/Fact** | Solid bar | Normalized to max | 45% opacity `var(--total-{direction})` | Past months with imported data |
| **Current month** | Solid bar, opaque | Normalized to max | 100% opacity `var(--total-{direction})` | Calendar month containing today; only value that changes mid-view |
| **Estimated** | Striped bar | Normalized to max | `repeating-linear-gradient(135deg, color-family 0 3px, transparent 3px 6px)` | Future months (projection) |
| **Uncovered/Gap** | Diagonal pattern | 100% (full height) | `repeating-linear-gradient(45deg, transparent 0 3px, rgba(muted, 0.2) 3px 6px)` | Month inside the year with no imported data; explicitly marked to prevent silent reading as €0 |

**Implementation notes:**
- All bars rendered at same x-axis scale (12 equal-width columns per row)
- Sparkline height: 32px total; bars gap: 2px between each
- Bar radius: 1px for crisp edges (visual detail, exempt from 4-multiple grid)
- Uncovered months show full 100% height to provide visual contrast from zero-data months within covered range

---

## Row Structure and Layout

**Primary focal point per row:** Rank badge + category name (leftmost), read first in left-to-right order.

### Desktop (780px+)

**Grid columns (5):** 30px · flexible · 150px · 150px · 150px

| Column | Content | Notes |
|--------|---------|-------|
| 1 | Rank badge (28px circle, bg muted, center-aligned) | Rank number, 12px font weight 600 |
| 2 | Category name, metadata, % bar | Name (16px 600), metadata line (12px muted), horizontal bar showing share |
| 3 | 12-month sparkline (150px width for ~12 equal bars + gaps) | Bars render at 32px height |
| 4 | Total monetary value | Label "Totale" (12px uppercase muted), value (16px 600 monospace) |
| 5 | Projection monetary value (≥2 Covered Months only) | Label "A questo passo" (12px uppercase muted), value (16px weight 500 monospace, amount in `<strong>` 600) |
| 5 | Empty cell (<2 Covered Months) | Reserved; stays empty to maintain grid stability when projection pair is absent |

**Row padding:** 16px (top/bottom) × 16px (left/right)

**Row border:** 1px solid `var(--border)`, 12px radius

**Row background:** `var(--card)`

**Row hover state:** Border color lightens to `color-mix(in srgb, var(--primary) 45%, var(--border))`

### Mobile (<780px)

**Grid columns (3):** 30px · flexible · 120px

| Column | Content | Notes |
|--------|---------|-------|
| 1 | Rank badge | Same as desktop |
| 2 | Category name, metadata, % bar | Same as desktop |
| 3 | Total monetary value | Same as desktop |

**Hidden:** Sparkline, Projection (moved below on own line)

**Projection (below row, ≥2 Covered Months):** Full width, 2 columns (label + value), left-aligned, 8px baseline alignment

**Projection (<2 Covered Months):** Not rendered; the nudge below the list provides the explanation.

---

## Allocation (Savings) Sparkline Color

On `allocation` direction rows:

| State | Color Token | Value |
|-------|---|---|
| Covered/Fact | `var(--total-allocation)` | #a78bfa |
| Current month | `var(--total-allocation)` | #a78bfa |
| Estimated | Striped `#a78bfa` family | e.g. `repeating-linear-gradient(135deg, #d6bcfa 0 3px, transparent 3px 6px)` |

**Negative values (divestments):** Admit negative domain (do not clamp). On a month with net divestment (e.g., sold ETF > deposits), the bar renders inverted or with a distinct visual marker (e.g., opacity inversion, reversed gradient). Exact rendering deferred to executor's discretion, but the visual must distinguish a negative month from a zero month.

---

## Loading and Skeleton States

**Component:** `category-ranking-skeleton.tsx` (new — does not exist; must be created)

**Structure:** Render N skeleton rows matching the locked row shape (5 columns on desktop, 3 on mobile).

| Element | Placeholder |
|---------|---|
| Rank badge | Rounded square, muted, 28px |
| Category name | Line, 16px height, 60% width, muted |
| Metadata line | Line, 12px height, 50% width, muted |
| % bar | Thin line, 6px height, 40% width, muted |
| Sparkline (12 bars) | 12× thin vertical line, 32px height, 2px gap, muted |
| Total label | Invisible or very short line (label is small) |
| Total value | Line, 16px height, 40% width (enough for a number), muted |
| Projection label | Invisible or very short line |
| Projection value | Line, 16px height, 40% width, muted (note: may be absent on mobile <2 Covered Months) |

**Animation:** Use Tailwind's pulse animation (fade-in/out at 2s interval) or the project's existing skeleton animation.

**Count:** Render skeleton for 5–7 rows (typical list length on first load).

---

## Empty State

**Condition:** No categories in the selected year for the chosen direction.

**Content:**
- Heading (20px 600): "Nessuna spesa" [for Uscite], "Nessuna entrata" [for Entrate], "Nessun accantonamento" [for Accantonamenti]
- Body (14px 400): "Non ci sono transazioni importate per questa direzione in {year}. Prova un altro anno o un'altra direzione." (or user's chosen direction label)

**Styling:** Center-aligned, `var(--muted-fg)` text, 32px (xs·2×) top margin, large icon (Lucide, 32px, muted).

---

## Nudge (Single-Covered-Month State)

**Condition:** Year has exactly 1 Covered Month (the only month with imported data).

**Placement:** Below the row list, before empty state (if applicable).

**Structure:**
- Dashed 1px border, `var(--border)`
- 8px radius (smaller than row radius, visual distinction)
- 16px padding (top/bottom) × 16px (left/right)
- Background: `var(--muted)`
- Text color: `var(--muted-fg)`
- Font: 14px body, line-height 1.5

**Content:** Bold prefix + body
- **Bold prefix** (color: `var(--fg)`, weight 600): "Con un secondo mese importato"
- **Body:** "vedrai il ritmo mensile e la proiezione di fine anno. Serve almeno un mese concluso oltre a quello in corso."

**Implementation:** Reuse `components/dashboard/overview/overview-nudge.tsx` pattern (component exists; adapt for this content).

---

## UI Considerations

> Produced by the ui-consideration-probe over 8 described surfaces (E1 row · E2 sparkline ·
> E3 direction filter · E4 year selector · E5 sort toggle · E6 skeleton · E7 empty state ·
> E8 nudge), 51 applicable considerations. Resolved against this spec's own prose, with three
> genuinely open questions answered by the developer on 2026-07-31 (marked ⟵ *developer decision*).
> Empty-state and error COPY lives in `## Copywriting Contract`; this section covers STATE
> coverage and references those rows rather than restating them.

**How the planner must read this section:** `covered` rows are plain truths to lift into
`must_haves.truths`. `backstop` rows lift as `{ statement, verification: backstop }` — at verify
time a backstop the verifier cannot confirm with explicit evidence abstains to `human_needed`
rather than silently passing. `unresolved` rows are explicit assumptions the planner must surface,
never drop.

### E1 — Category ranking list row

| Category | Status | Resolution |
|----------|--------|------------|
| empty | ✅ covered | No categories for the selected year+direction → the `## Empty State` surface renders in place of the list. Distinct from the zero-Covered-Months state below. |
| loading | ✅ covered | `category-ranking-skeleton.tsx` renders 5–7 placeholder rows matching the locked row shape. |
| error | ✅ covered | ⟵ *developer decision*: the ranking query keeps `getCategoryRanking`'s existing `try/catch → rows = []`, so a failed load degrades to the empty state. **Accepted cost, recorded deliberately:** a query failure is visually indistinguishable from "you have no data in this direction". No error surface, no retry affordance ships in this phase. A future reader must not treat the absence of an error state as an oversight. |
| populated | ✅ covered | 5-column desktop grid / 3-column mobile per `## Row Structure and Layout`; rank + name is the declared focal point. |
| partial | ✅ covered | Below 2 Covered Months the projection label+value pair is entirely absent from the row (D-15); column 5 stays reserved and empty for grid stability; the nudge is the sole explanation (D-14). |
| overflow | ✅ covered | Monetary values use monospace + tabular-nums in fixed 150px columns; the row list scrolls vertically. |
| zero-one-many | ✅ covered | Reads correctly at 0 rows (empty state), 1 row, and 3–50 rows; no singular/plural copy varies per row count. |

### E2 — 12-month sparkline

| Category | Status | Resolution |
|----------|--------|------------|
| empty | ✅ covered | A category with no movements in any Covered Month renders €0-and-counts months (D-02), not an absent sparkline — the bar series is always 12 slots wide. |
| loading | ✅ covered | Skeleton renders 12 placeholder bars at 32px with 2px gaps. |
| error | ✅ covered | Inherits E1's degrade-to-empty behaviour; no per-sparkline error state. |
| populated | ✅ covered | Four visual states per `## Sparkline Visual States`: covered/fact, current month (hybrid), estimated, uncovered/gap. |
| partial | ✅ covered | An uncovered month inside the year renders the explicit diagonal gap marker at full height — it must never read as a month of zero spending (CONTEXT.md Risk Summary). |
| overflow | ✅ covered | Twelve equal-width bars are laid out to the fixed 150px column; the count is constant so the series cannot overflow. |
| zero-one-many | ✅ covered | A single Covered Month renders one bar (CLIST-06); the existing component's single-point circle branch is the precedent. |
| negative domain | 🧪 backstop | `{ statement: "On the allocation direction a net-divestment month renders visually distinct from a zero month — the existing parseAmount Math.max(parsed, 0) clamp must not survive", verification: backstop }` — the exact negative rendering is left to the executor, but a clamped-to-zero divestment month is a failure, not a styling choice. |

### E3 — Direction filter (Uscite / Entrate / Accantonamenti)

| Category | Status | Resolution |
|----------|--------|------------|
| populated | ✅ covered | Three options, labels per `## Copywriting Contract`; selection swaps the copy set AND the colour mapping together (D-11). |
| empty / partial | ✅ covered | A direction with no data still renders its own option; selecting it yields E7's per-direction empty state, never a disabled option. |
| loading | ✅ covered | The filter renders immediately; only the list below it is skeletonised. |
| error | ✅ covered | Inherits E1's degrade-to-empty behaviour. |
| overflow / long-text | ✅ covered | Three fixed Italian labels, longest is "Accantonamenti"; no dynamic text. |
| zero-one-many | ✅ covered | Option count is fixed at three — not data-driven. |

### E4 — Year selector

| Category | Status | Resolution |
|----------|--------|------------|
| loading | ✅ covered | Renders immediately alongside the direction filter. |
| error | ✅ covered | Inherits E1's degrade-to-empty behaviour. |
| overflow / long-text | ✅ covered | Fixed 4-digit labels. |
| zero Covered Months | ✅ covered | ⟵ *developer decision*: a year with **no imported data at all** gets its own dedicated state, separate from E7's per-direction empty state. Its copy must point at importing, **not** at "try another direction" — that advice is misleading when the whole year is empty. Copy strings for this state are specified in `## Copywriting Contract`. |

### E5 — Sort toggle (Totale / Proiezione)

| Category | Status | Resolution |
|----------|--------|------------|
| populated | ✅ covered | Two options; Totale is the default (open on a fact, D-08). |
| partial | ✅ covered | ⟵ *developer decision*: below 2 Covered Months the **Proiezione option stays visible but is disabled, carrying a stated reason** (a second imported month is needed). Rejected: hiding it (the user never discovers the projection exists) and silently degrading it to sort-by-total (the control would lie about what it is doing). Consistent with D-14 — never a control that changes shape without explanation. |
| empty | ✅ covered | With zero rows the toggle still renders; ordering nothing is not an error state. |
| loading | ✅ covered | Renders immediately; the list below is skeletonised. |
| error | ✅ covered | Inherits E1's degrade-to-empty behaviour. |
| overflow / long-text | ✅ covered | Two fixed Italian labels. Neither may be called *delta* (reserved for KPI period-over-period) nor *deviazione* (retired vocabulary). |
| zero-one-many | ✅ covered | Option count is fixed at two. |

### E6 — Loading skeleton

| Category | Status | Resolution |
|----------|--------|------------|
| populated | ✅ covered | 5–7 rows matching the locked row shape, per `## Loading and Skeleton States`. |
| partial | 🧪 backstop | `{ statement: "The skeleton reserves the projection column so the layout does not shift when real rows resolve with the projection absent (<2 Covered Months)", verification: backstop }` — an anti-blink property that is easy to lose and invisible in a static screenshot. |
| zero-one-many / overflow / empty / loading / error | ✅ covered | The skeleton is a fixed-count placeholder; it does not vary with data and is replaced wholesale on resolve. |

### E7 — Empty state

| Category | Status | Resolution |
|----------|--------|------------|
| overflow / long-text | ✅ covered | Fixed per-direction heading and body strings; the interpolated `{year}` is 4 digits. |
| relationship to E4 | ✅ covered | E7 means "this direction has nothing in a year that does have data". The whole-year-empty case is E4's dedicated state. The two must not collapse into one surface. |

### E8 — Single-Covered-Month nudge

| Category | Status | Resolution |
|----------|--------|------------|
| populated | ✅ covered | Dashed-border panel below the list; heading + body copy per `## Copywriting Contract`; reuses the `OverviewNudge` pattern. |
| partial | ✅ covered | It IS the partial-data explanation — the sole account of the projection's absence from every row (D-14 + D-15). |
| empty | ✅ covered | Not rendered when the year has 0 Covered Months (that is E4's state) or ≥2. |
| loading | ✅ covered | Appears with the resolved list, never during skeleton. |
| error | ✅ covered | Inherits E1's degrade-to-empty behaviour. |
| overflow / long-text / zero-one-many | ✅ covered | Fixed copy, single instance, no data interpolation. |

### Coverage summary

| Status | Count | Note |
|--------|-------|------|
| ✅ covered | 48 | Lift into `must_haves.truths` as plain strings |
| 🧪 backstop | 3 | Lift as `{ statement, verification: backstop }` — sparkline negative domain, skeleton column reservation, row name truncation (see `long-text` in `## Row Structure and Layout`) |
| ⚠ unresolved | 0 | — |

---

## Locked Decisions Referenced

| Decision | Description | Locked By |
|----------|---|---|
| D-04 | Row carries exactly: name · year total · % of total · 12-month sparkline · year-end projection (no Deviation badge) | 83-CONTEXT.md |
| D-06 | Projection visually subordinate to total, explicitly labelled (label + value hierarchy) | 83-CONTEXT.md |
| D-09 | Direction filter: Uscite / Entrate / Accantonamenti (predicate: `direction.hidden = false`) | 83-CONTEXT.md |
| D-11 | One copy set per direction (heading, share label, projection label), resolved centrally | 83-CONTEXT.md |
| D-14 | Single-Covered-Month state: show certain figures + explicit nudge (follow OverviewNudge pattern) | 83-CONTEXT.md |
| D-15 | Below 2 Covered Months: entire projection label+value pair absent from row (not even em-dash, not even placeholder). Engine returns no numeric field; UI cannot render a fragile value. Explanation lives in nudge only. | 83-CONTEXT.md |
| D-19 | Row prototype validated and locked (`.scratch/dashboard-categories/list-row.html`, 2026-07-30) | Prototype sign-off |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|---|---|
| shadcn official | Button (sort toggle, direction filter), Select (year), Card (row), Skeleton (loading state) | not required |
| lucide-react | Icons (direction labels, optional) | not required |

**Third-party registries:** None declared.

---

## Checker Sign-Off

- [ ] **Dimension 1 Copywriting:** All Italian copy defined; per-direction strings explicit; retired vocabulary (Deviation, Baseline, Preset) absent; D-15 projection absence resolved (nudge provides explanation, no em-dash).
- [ ] **Dimension 2 Visuals:** Row layout locked (prototype); sparkline 4-state system defined; projection subordination explicit (weight + colour hierarchy, no size step); focal point declared; grid column stability when projection pair absent confirmed (reserved empty cell).
- [ ] **Dimension 3 Colour:** Direction-scoped tokens defined (`--total-out`, `--total-in`, `--total-allocation`); all three tokens verified present in `app/globals.css` (light + dark); 60/30/10 surface allocation declared; dark mode compatibility verified.
- [ ] **Dimension 4 Typography:** Type scale consolidated to 4 unique sizes (12, 14, 16, 20px); projection weight+colour hierarchy survives size consolidation; monospace for numbers; all font-size references updated throughout spec.
- [ ] **Dimension 5 Spacing:** 8-point grid; row padding 16×16; sparkline 32px height + 2px gap; nudge 16×16 padding; all values confirmed multiples of 4 (or documented exemptions: bar-radius 1px, gap 2px as visual details).
- [ ] **Dimension 6 Registry Safety:** shadcn components listed; no third-party registries; safety gate N/A.

**Approval:** pending
