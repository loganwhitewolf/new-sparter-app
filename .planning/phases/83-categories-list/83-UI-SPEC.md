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

| Option | Label |
|--------|-------|
| Primary (default) | "Totale" |
| Secondary | "Proiezione" |

**Note:** Replaces retired "Deviazione" option. Reuses existing `SortToggle` component shape.

### Single-Covered-Month State

**Nudge heading:** "Con un secondo mese importato"

**Nudge body:** "vedrai il ritmo mensile e la proiezione di fine anno. Serve almeno un mese concluso oltre a quello in corso."

**Styling:** Dashed border, muted background, 13px body text. Reuses `OverviewNudge` component pattern.

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

| Category | Element(s) | Status | Resolution |
|----------|------------|--------|------------|
| empty-state | Direction filter + year selector result in no categories | ✅ covered | Empty state render per copywriting contract; nudge for single-Covered-Month case distinct |
| loading | Ranking query in progress | ✅ covered | Skeleton rows render via `category-ranking-skeleton.tsx` |
| zero-one-many | Sparkline with 1 data point (single-Covered-Month state) | ✅ covered | Single bar rendered at appropriate month position; projection label+value pair absent; nudge explains what is missing |
| zero-one-many | Sparkline with all 12 months covered | ✅ covered | All 12 bars rendered; mix of fact/current/estimated visual states |
| zero-one-many | Row list length (3–50 categories) | ✅ covered | Grid scrolls vertically; no special handling needed |
| long-text | Category name truncation | 🧪 backstop | Row layout uses `minmax(0, 1fr)` in grid; name truncates with ellipsis on overflow. Verification: CSS `text-overflow: ellipsis; white-space: nowrap; overflow: hidden;` applied to `.name` |
| overflow | Monetary value overflow (e.g., €999,999.99) | ✅ covered | Monospace font + tabular-nums ensures alignment; column width (150px) adequate for 99,999.99 format |
| partial-data | Below 2 Covered Months (no projection) | ✅ covered | Projection label + value pair absent from row; sparkline contains only covered months' data; nudge below list explains threshold and next step (D-15 + D-14) |

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
