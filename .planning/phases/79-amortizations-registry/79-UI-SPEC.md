---
phase: 79
phase_name: amortizations-registry
milestone: v2.9
status: draft
created: 2026-07-28
design_system: shadcn/ui (new-york, zinc base, Tailwind CSS variables)
tool: shadcn/ui preset
rsc: true
---

# Phase 79: Amortizations Registry — UI Design Contract

**Requirements covered:** REG-01, REG-02, REG-03  
**Upstream decisions pre-populated from:** 79-CONTEXT.md (D-A1 through D-D1)  
**Design analog:** `/reimbursements` registry (v2.8 Phase 76, live)

---

## Page Structure

### `/amortizations` — RSC List Page

**Metadata:**
- Page title: `Ammortamenti`
- Meta description: Canonical amortization plans registry

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [Sidebar]  Ammortamenti                                   │
│            Tutte le rate dei tuoi ammortamenti.             │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Netto residuo aperto: €X.XXX,XX                       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  [Toolbar: Search | Status Filter | Sort Indicator]       │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐│
│  │ Description  │ Date  │ Initial │ Consumed │ Net │ Rate ││
│  ├────────────────────────────────────────────────────────┤│
│  │ [Row]                                      [Actions]   ││
│  │ [Row]                                      [Actions]   ││
│  │ ...                                                     ││
│  └────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Page flow:**
1. RSC calls `verifySession()` to obtain `userId` (auth boundary)
2. RSC calls `getAmortizationPlanList(userId)` (DAL read-only, IDOR-scoped)
3. Conditionally render:
   - If `plans.length === 0`: `EmptyState('no-data')` with contextual copy
   - Else: Mount the interactive `AmortizationTable` component + summary header

---

## Summary Header (D-B1)

**Contract:**
- **Single KPI metric:** "Netto residuo aperto" (total open net residual)
- **Computed value:** Sum of `.netValue` across all plans with `.status === 'open'`, using `Decimal.js`
- **Visual treatment:** Card with label + large number, styled consistently with other KPI headers in the app (e.g., dashboard overview cards)
- **Currency:** EUR, it-IT locale format: `€X.XXX,XX` (e.g., `€5.234,56`)
- **Placement:** Immediately above the toolbar/table

**Component structure:**
```tsx
<div className="rounded-lg border bg-card p-4">
  <p className="text-sm text-muted-foreground">Netto residuo aperto</p>
  <p className="text-2xl font-semibold tracking-tight">
    {formatCurrency(totalOpenResidual)}
  </p>
</div>
```

**Fallback behavior:**
- If no open plans exist (all closed or empty): display `€0,00`
- If Decimal arithmetic fails (upstream bug): display the raw value suffixed with `EUR` (mirrors reimbursement pattern)

---

## Empty State

**No plans in account (variant: `no-data`):**
- **Message:** "Nessun ammortamento"
- **Hint:** "Non hai ancora nessun ammortamento attivo. Quando ammortizzerai una spesa, vedrai qui tutte le tue rate."
- **Placement:** Full page, centered

**Filter/search yields no results (variant: `no-result`):**
- **Message:** "Nessun ammortamento trovato"
- **Hint:** "Prova a modificare i filtri o la ricerca."
- **Placement:** Below toolbar, where table would render

---

## Registry Table

### Toolbar (URL-backed filter/sort)

**Controls:**
1. **Search input** (client-side, case-insensitive, against `.description`)
   - Placeholder: "Cerca per descrizione..."
   - Query param: `q`
   - Debounced via standard DataTableToolbar behavior

2. **Status filter** (client-side dropdown)
   - Label: "Stato"
   - Options:
     - "Aperto" → `status=open`
     - "Chiuso" → `status=closed`
   - Default (no param): Show all plans (both open and closed)
   - Query param: `status`
   - **Note:** Per D-C1, the registry defaults to open-only view. The filter ALLOWS viewing closed plans, but the table itself applies the open-only default filter client-side if no `status` param is present.

3. **Sort control** (via sortable column headers)
   - Default sort: `remainingMonths` ASC (plans closest to completion on top, per D-C2)
   - Query params: `sort={key}` + `dir={asc|desc}`
   - Reuses `useToolbarSort()` hook and `DataTableToolbar` component

**Styling:**
- Follows the unified table toolbar pattern (v1.14, ADR 0010)
- Flex row layout, gap-2
- All controls inherit Tailwind + shadcn/ui defaults (button, input, select variants)

---

### Table Structure & Columns

**Header row:**
- All text headers except where sortable (use `HeaderSortButton`)
- Sort-enabled columns: Description, Transaction Date, Initial Amount, Consumed Amount, Net Value, Remaining Months

**Columns (left to right):**

1. **Description** (sortable)
   - Header label: "Descrizione"
   - Value: `transaction.description` (from DAL join)
   - Width: Flex (absorbs remainder)
   - Truncation: `max-w-0 w-full` + inner `truncate` (standard no-horizontal-scroll pattern)
   - Link target: `transactionDetailHref(transactionId)` (D-D1)
   - Font: `text-sm` (regular weight, link affordance from color and hover underline)
   - Styling: Hover underline

2. **Transaction Date** (sortable)
   - Header label: "Data"
   - Value: `occurredAt.toLocaleDateString('it-IT')` (e.g., `28/07/2026`)
   - Width: `whitespace-nowrap`
   - Font: `text-sm text-muted-foreground`
   - Align: Left

3. **Initial Amount** (sortable)
   - Header label: "Importo iniziale"
   - Value: `plan.totalAmount` (from DAL)
   - Width: `whitespace-nowrap`
   - Currency format: EUR, it-IT, absolute value (no sign)
   - Font: `font-mono tabular-nums text-sm text-right`
   - Align: Right
   - Color: Neutral (no tone class, as this is always positive)

4. **Consumed Amount** (sortable)
   - Header label: "Consumato"
   - Value: Sum of past instalments (from DAL aggregation)
   - Width: `whitespace-nowrap`
   - Currency format: EUR, it-IT, absolute value
   - Font: `font-mono tabular-nums text-sm text-right`
   - Align: Right
   - Color: Neutral

5. **Net Value** (sortable)
   - Header label: "Netto"
   - Value: `initialAmount - consumedAmount` (computed per-plan in DAL)
   - Width: `whitespace-nowrap`
   - Currency format: EUR, it-IT, **signed** (negative if amount remains)
   - Font: `font-mono tabular-nums text-sm text-right`
   - Align: Right
   - **Color:** `amountToneClass(netValue)` — applies semantic color based on sign/magnitude:
     - Positive (consumed more than planned): muted
     - Negative (residual still to amortize): warning/destructive tone
     - Zero: neutral

6. **Remaining Months** (sortable, D-B2)
   - Header label: "Rate rimanenti"
   - Value: Rendered as `X/N` (e.g., `11/20`), where:
     - X = count of future instalments (occurredAt >= TODAY)
     - N = total months (plan.months)
   - Width: `whitespace-nowrap`
   - Progress bar: Light background bar filling proportionally to `(totalMonths - remainingMonths) / totalMonths`, positioned below or inside the cell
   - Font: `text-sm text-center`
   - Styling: `[X/N progress bar below/adjacent]`

7. **Status Badge** (not sortable)
   - Header label: "Stato"
   - Value: Status badge (D-C3, see below)
   - Width: `whitespace-nowrap`
   - Align: Center

8. **Actions** (not sortable, D-A1/D-A2/D-A3)
   - Header: Empty or icon-only
   - Rendering: **Only for open plans** (`.status === 'open'`)
   - Closed plans: No actions rendered

**Row styling:**
- Hover effect: Standard table row hover (slight background lift)
- Font sizes: Consistent `text-sm` throughout
- Padding: Standard Tailwind table cell padding
- Borders: Standard table cell borders

---

### Status Badge (D-C3)

**Contract (Claude's Discretion Decision):**

The closed-vs-open distinction must be unambiguous at a glance (REG-03). Following the reimbursement pattern, use `Badge` component with status-specific styling:

**Open plan:**
- Badge text: "Aperto"
- Badge variant: `"default"` (or omitted, defaults to primary)
- Color: Neutral/default (no tone class)
- Example: `<Badge>Aperto</Badge>`

**Closed plan:**
- Badge text: "Chiuso"
- Badge variant: `"secondary"` or `"outline"`
- Color: Muted/secondary tone
- Example: `<Badge variant="secondary">Chiuso</Badge>`

**Implementation:**
```tsx
<Badge variant={row.status === 'open' ? 'default' : 'secondary'}>
  {row.status === 'open' ? 'Aperto' : 'Chiuso'}
</Badge>
```

**Visual intent:** The badge is a clear status indicator; closed plans visually recede (secondary styling) while open plans stand out (default/primary).

---

### Row Actions (D-A1, D-A2, D-A3)

**Applies only to open plans** (`.status === 'open'`); closed plans render an empty actions cell.

**Actions rendered as a button group or dropdown menu:**

1. **"Chiudi"** (D-A1)
   - Semantic: Close/complete the plan (scrap-close: collapse remaining instalments onto closure month)
   - Action: Click → opens `CloseAmortizationDialog` (existing from Phase 78)
   - Dialog props: `planId`, `onSuccess` callback (refetches list via route revalidation)
   - Button styling: `Button variant="outline" size="sm"`
   - Icon: Optional (e.g., `X` or `Check` icon)

2. **"Realizza con vendita"** (D-A2)
   - Semantic: Realize via a sale transaction (navigates to the transaction detail page to enter sale/realization info)
   - Action: Click → navigate to `transactionDetailHref(transactionId)` (the anchor transaction's detail page)
   - Button styling: `Button variant="outline" size="sm"`
   - Icon: Optional (e.g., `ExternalLink` icon)
   - **Note:** The transaction detail page already hosts the full Phase 78 realization UI; no new form here.

**Action layout:**
- Inline buttons (2 buttons side-by-side) or a row menu (three-dot icon → dropdown with both options)
- Preferred: Inline buttons if space permits (less visual complexity)
- Fallback: Row menu dropdown if space is constrained (mobile/tablet)

**Button sizing:**
- Size: `sm` (compact, consistent with other table row actions)
- Font: `text-xs` or `text-sm`

---

### Table Sorting

**Default sort (D-C2):**
- Key: `remainingMonths`
- Direction: `asc` (ascending)
- Rationale: Plans closest to completion appear first, surfacing what's about to finish/close

**Sort key mapping:**
| Header Label | Sort Key | Data Type | Comparison |
|---|---|---|---|
| Descrizione | `description` | string | `localeCompare()` |
| Data | `transactionDate` | Date | numeric (milliseconds) |
| Importo iniziale | `initialAmount` | Decimal | `Decimal.comparedTo()` |
| Consumato | `consumedAmount` | Decimal | `Decimal.comparedTo()` |
| Netto | `netValue` | Decimal | `Decimal.comparedTo()` |
| Rate rimanenti | `remainingMonths` | number | numeric |

**Sort implementation:**
- Pure sort helper function `sortAmortizationRows(rows, sortKey, dir)` exported from the table component
- Unit-testable without jsdom (mirrors the reimbursement pattern)
- Tie-breaking: Preserve input order (stable sort)

---

## Row Navigation (D-D1)

**Behavior:**
- Clicking the description text (link) → navigates to `/transactions/[id]` for the amortized transaction
- Clicking anywhere else in the row → no default action (buttons/actions are explicit)

**Link implementation:**
```tsx
<Link
  href={transactionDetailHref(row.transactionId)}
  className="block truncate text-sm font-medium hover:underline"
  title={row.description}
>
  {row.description}
</Link>
```

**Breadcrumb/back navigation:**
- The transaction detail page uses standard back-button logic (browser back or `/transactions` link)
- The amortizations registry is a new entry point; no explicit breadcrumb to the registry is required from the detail page
- If back-navigation is added later, the transaction detail page's existing pattern will handle it

---

## Styling & Tokens

### Typography

**Font sizes:**
- Page title: `text-2xl` (`32px`)
- Subtitle/description: `text-sm` (`14px`), `text-muted-foreground`
- KPI header label: `text-sm` (`14px`), `text-muted-foreground`
- KPI number: `text-2xl` (`32px`), `font-semibold tracking-tight`
- Column headers: `text-sm` (`14px`), default weight
- Table rows: `text-sm` (`14px`), default weight

**Font weights:**
- Title and KPI number: `font-semibold` (600)
- All other text: regular (400)

**Line height:**
- Prose: `leading-relaxed` (1.625) or default
- Inline text: default

### Spacing

**8-point scale (4, 8, 16, 24, 32, 48, 64):**
- Page padding: `p-6` (24px)
- Section gaps: `gap-6` (24px) between header/KPI/toolbar/table
- Toolbar items: `gap-2` (8px)
- Table rows: Standard cell padding (12px, via shadcn/ui defaults)
- Summary KPI card: `p-4` (16px)

### Color

**Color ratio (60/30/10 split):**
- **60% — Dominant neutral surfaces and text:** Zinc base (`bg-card`, `text-foreground`, `border`). Page background, table cells, paragraph text, open-status badges (primary variant).
- **30% — Secondary/muted for closed rows and chrome:** Muted secondary tones (`text-muted-foreground`, `variant="secondary"` badges for closed plans), borders, toolbar backgrounds.
- **10% — Accent reserved for visual emphasis:** The open-status badge (primary/default variant) and the summary KPI number (`text-2xl font-semibold`). Use sparingly for unambiguous focus.

**Palette:**
- Base: Zinc (shadcn/ui new-york preset)
- Background (cards, table): `bg-card`
- Text: `text-foreground` (default), `text-muted-foreground` (secondary)
- Links: `hover:underline` (no explicit color, inherits from link semantics)
- Borders: `border` (default border color)

**Semantic colors:**
- Amount tone class: `amountToneClass(value)` (defined in `lib/utils/amount-tone.ts`)
  - Positive or zero: muted
  - Negative (residual): warning/destructive tone
- Status badge:
  - Open: `variant="default"` (primary)
  - Closed: `variant="secondary"` (muted)

**Dark mode:**
- All styling uses CSS variables; no hardcoded colors
- Automatically inverted by Tailwind dark mode + shadcn/ui theming

### Icon Library

**Tool:** Lucide icons (as per components.json)

**Icons used:**
- Row actions: Optional
  - "Chiudi" button: X or Check icon (optional, can be text-only)
  - "Realizza con vendita" button: ExternalLink icon (optional)
- Sortable column headers: Caret up/down icon (rendered by `HeaderSortButton` component, no manual work)

---

## Currency Formatting

**Function:** `formatAbsoluteAmount(value: string) → string` (from `lib/utils/format-amount.ts`) **OR** inline `Intl.NumberFormat`

**Contract:**
- Locale: `it-IT`
- Style: `currency`
- Currency: `EUR`
- Output examples:
  - `1234.56` → `€1.234,56`
  - `0.00` → `€0,00`
  - `12345678.99` → `€12.345.678,99`

**Special case (non-finite input):**
- If `Number.isFinite(value)` is false (upstream bug), return `${value} EUR` to surface the issue

**Implementation:**
```tsx
const amountFormatter = new Intl.NumberFormat('it-IT', { 
  style: 'currency', 
  currency: 'EUR' 
})

function formatCurrency(value: string): string {
  const amount = Number(value)
  if (!Number.isFinite(amount)) {
    return `${value} EUR`
  }
  return amountFormatter.format(amount)
}
```

---

## Copywriting (Italian, product surface)

| Element | Copy | Context |
|---------|------|---------|
| Page title | `Ammortamenti` | Page heading |
| Page subtitle | `Tutte le rate dei tuoi ammortamenti.` | Description under title |
| Summary KPI label | `Netto residuo aperto` | Above the total residual KPI |
| Toolbar search placeholder | `Cerca per descrizione...` | Search input |
| Status filter label | `Stato` | Filter dropdown label |
| Status filter option 1 | `Aperto` | Badge text + filter value |
| Status filter option 2 | `Chiuso` | Badge text + filter value |
| Table header: Description | `Descrizione` | Column header |
| Table header: Date | `Data` | Column header |
| Table header: Initial Amount | `Importo iniziale` | Column header |
| Table header: Consumed Amount | `Consumato` | Column header |
| Table header: Net Value | `Netto` | Column header |
| Table header: Remaining Months | `Rate rimanenti` | Column header |
| Table header: Status | `Stato` | Column header |
| Action button: Close | `Chiudi` | Button label (D-A1) |
| Action button: Realize | `Realizza con vendita` | Button label (D-A2) |
| Empty state (no data) message | `Nessun ammortamento` | Bold message |
| Empty state (no data) hint | `Non hai ancora nessun ammortamento attivo. Quando ammortizzerai una spesa, vedrai qui tutte le tue rate.` | Contextual hint |
| Empty state (no result) message | `Nessun ammortamento trovato` | Bold message (after filter/search) |
| Empty state (no result) hint | `Prova a modificare i filtri o la ricerca.` | Contextual hint |

---

## Navigation & Routes

### Route Constants (to add to `lib/routes.ts`)

```typescript
export const APP_ROUTES = {
  // ... existing ...
  amortizations: '/amortizations',
}

export function amortizationDetailHref(planId: string) {
  return `${APP_ROUTES.amortizations}/${encodeURIComponent(planId)}`
}
```

**Note:** The `/amortizations/[id]` plan detail page is deferred (D-D1); row clicks navigate to the transaction detail page, not a plan-specific page. Href function is provided for future use or consistency.

### Sidebar Navigation Entry

**Location:** Primary left sidebar (authenticated app nav)

**Entry:**
```typescript
{
  href: APP_ROUTES.amortizations,
  label: 'Ammortamenti',
  icon: lucide.Wallet2 | lucide.DollarSign | lucide.TrendingUp  // or other relevant icon
}
```

**Placement:** Near `/reimbursements` entry (both are financial planning surfaces)

---

## Component Inventory

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| AmortizationsPage (RSC) | `app/(app)/amortizations/page.tsx` | New | Page entry point; renders title + summary KPI + table or empty state |
| AmortizationSummaryHeader | `components/amortizations/amortization-summary-header.tsx` | New | Client component; computes total open net residual (D-B1) |
| AmortizationTable | `components/amortizations/amortization-table.tsx` | New | Client component; search/filter/sort + table rendering |
| sortAmortizationRows | `components/amortizations/amortization-table.tsx` (export) | New | Pure sort helper; unit-testable |
| getAmortizationPlanList | `lib/dal/amortization.ts` | New | Server function; fetches all plans with derived values (consumed/net/remaining) |
| AMORTIZATIONS_TABLE_CONFIG | `lib/utils/amortizations-table-config.ts` | New | Table configuration (default sort, filter options) |
| CloseAmortizationDialog | `components/transactions/close-amortization-dialog.tsx` | Reuse | Existing Phase 78 component; opened by the "Chiudi" action |

---

## Accessibility & Internationalization

### Accessibility

**Color contrast:**
- All text meets WCAG AA contrast ratios (shadcn/ui baseline)
- Amount tone classes (positive/negative) supported by additional text context (not color alone)

**Keyboard navigation:**
- Links and buttons are tab-accessible
- Table rows are not independently focusable (actions are explicit buttons)
- Dialog (CloseAmortizationDialog) is keyboard-navigable (existing)

**Screen reader:**
- Table headers are properly scoped with `<th scope="col">`
- Links have descriptive text (transaction description)
- Badge text is readable ("Aperto" / "Chiuso")

**Semantic HTML:**
- Table uses `<table>`, `<thead>`, `<tbody>`, `<th>`, `<tr>`, `<td>`
- Links use `<a href>` (native navigation)
- Buttons use `<button>` or `<Link>` as appropriate

### Internationalization

**Language:**
- All user-facing copy: Italian (product surface)
- All developer-facing code: English (comments, variable names, etc.)
- Running checks: `yarn check:language`

**Locale-specific formatting:**
- Date: `toLocaleDateString('it-IT')` (e.g., `28/07/2026`)
- Currency: `Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })`

**No hardcoded English strings** in the component tree (all copy in copywriting table above).

---

## Responsive Behavior

### Breakpoints

**Desktop (>= 768px):**
- Full table with all columns visible
- Inline action buttons (side-by-side)
- Search input takes full available width in toolbar

**Tablet/Mobile (< 768px):**
- Description column still visible; other columns may wrap or condense
- Table uses the shared `table-fixed` pattern to prevent horizontal scroll
- Action buttons may collapse into a row menu (three-dot dropdown) if space is constrained
- Progress bar in months column simplifies to text-only `X/N` if needed

**Stacking:**
- Toolbar items stack vertically on very small screens (search above filter)
- Summary KPI card remains full-width

---

## Error Handling & Edge Cases

### Error states

**Empty list:**
- Handled by RSC; renders `EmptyState('no-data')`

**Filter yields no results:**
- Handled by `AmortizationTable`; renders `EmptyState('no-result')`

**Close action fails:**
- `CloseAmortizationDialog` handles the error; shows a toast with the error message
- Table does not auto-refresh until success

**Non-finite amounts (upstream bug):**
- Currency formatter returns `${value} EUR` instead of silently coercing to €0.00
- This surfaces the bug visibly

### Edge cases

**Plan with zero remaining months:**
- Months cell displays `0/20` with progress bar full
- Plan is still open (closure is a separate action)

**Closed plan displays zero net residual:**
- Months cell displays `N/N` (all instalments consumed)
- Net value is `€0,00`
- Status badge shows "Chiuso"

**Very long transaction description:**
- Truncated in the table cell with `truncate` + tooltip (`title` attribute)
- Full description visible on hover or on the transaction detail page

**High-precision decimal amounts:**
- All arithmetic uses `Decimal.js` (no floating-point errors)
- Display rounds to 2 decimal places (EUR cents)

---

## Browser Support

**Target:**
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari (iOS 14+)

**Compatibility notes:**
- `Intl.NumberFormat`: Supported in all targets
- CSS variables: Supported in all targets
- `Array.prototype.sort` stable: Guaranteed in ES2019+
- `URLSearchParams`: Supported in all targets

---

## Performance Considerations

### Client-side filtering & sorting

All filtering and sorting happens client-side (in `AmortizationTable`):
- Filter by `q` (search) and `status`
- Sort by any column (via `sortAmortizationRows`)
- No additional server round-trips

**Assumption:** List is reasonably sized (< 500 plans per user). If pagination is needed in the future, this contract does not address it.

### Server-side rendering

- RSC page fetches the full list once per page load (no pagination, no streaming)
- DAL query is efficient: one SQL query with explicit JOINs and aggregations
- Decimal arithmetic on the server (not client) for summary KPI

---

## Testing & Validation

### Unit tests

- `sortAmortizationRows()`: Pure sort logic (no jsdom needed)
- `getAmortizationPlanList()`: DAL query correctness, Decimal precision, IDOR-safety
- Summary KPI aggregation: Correct filtering (open only) and Decimal arithmetic

### Component tests

- Table rendering: columns, cells, styling
- Filter/search: client-side filtering logic
- Row actions: buttons render only on open plans
- EmptyState variants: no-data vs no-result

### Regression

- LENS-03 gate (reimbursement-regression.test.ts): amortizations registry must not perturb cash-lens aggregations

### Manual UAT

- Close action works: dialog opens, plan closes, list refreshes
- Realizza link works: navigates to correct transaction detail page
- Filter works: open-only default, filter reveals closed
- Sort works: default remaining-months ascending, can sort by other columns
- Currency formatting: correct locale and rounding

---

## Prior Phase Dependencies

- **Phase 77 (schema + activation):** Provides `amortizationPlan` + `amortizationInstalment` schema, core lifecycle services
- **Phase 78 (lifecycle + reconciliation):** Provides `closePlanTx`, `realizePlanTx`, `reducePlanTx` services and `CloseAmortizationDialog` component
- **v2.8 (reimbursements registry):** Design pattern (RSC → DAL → table) to mirror structurally

---

## Deferred to Phase 80

- Global cassa/competenza switch and accrual lens UI (LENS-01/02/04/05)
- `/amortizations/[id]` plan detail page with full instalment schedule (D-D1 explicitly defers)
- Lens-aware year/month selectors

---

## UI Considerations

> Shape-rooted STATE coverage from the UI-consideration probe (`--auto`, 6 surfaces / 39 applicable considerations). `covered` = a concrete acceptance truth the planner lifts into `must_haves.truths`. `backstop` = a held-out UI-state check the planner must wire, else the honest-verifier routes it to `human_needed` at verify time (never a silent pass). `unresolved` = the planner must treat it as an explicit assumption. Empty/error COPY lives in `## Copywriting (Italian, product surface)` — referenced here, not restated (de-dup).

### E1 — Summary header KPI ("Netto residuo aperto")
- Populated: renders the formatted EUR sum of `netValue` across `status === 'open'` plans, computed with Decimal.js.
- Empty / zero-one-many: shows `€0,00` when there are no open plans (the aggregate is a single figure regardless of plan count).
- Error: on non-finite / failed Decimal arithmetic, shows the raw value suffixed with `EUR` (surfaces the bug; never silently coerces to `€0,00`).
- { statement: "KPI card has a defined loading/skeleton treatment during the RSC fetch", verification: backstop }
- { statement: "KPI figure remains correct under partial/inconsistent upstream aggregate data", verification: backstop }
- { statement: "KPI number does not overflow or clip its card at very large magnitudes", verification: backstop }

### E2 — Registry table
- Empty: renders `EmptyState('no-data')` when the account has no plans (copy per `## Copywriting`).
- Populated: renders all REG-01 columns (description link, date, initial, consumed, signed net w/ tone class, months `X/N` + progress bar, status badge, actions) at typical volume.
- Partial: zero-remaining-months plan shows `0/N` (bar full) and stays open; a fully-consumed closed plan shows `N/N` with `€0,00` net.
- Overflow: description cell uses the no-horizontal-scroll truncate pattern (`max-w-0 w-full` + inner `truncate`); numeric/date/status cells `whitespace-nowrap`.
- Long-text: overly long descriptions truncate with a `title` tooltip; full text on the transaction detail page.
- Error: an RSC/data failure and a failed close both surface visibly (close failure → toast, table not refreshed until success).
- { statement: "Table has a defined loading/skeleton treatment during the RSC fetch", verification: backstop }
- { statement: "Row/count copy reads correctly at zero, one, and many plans (no singular/plural mismatch)", verification: backstop }

### E3 — Toolbar (search + status filter + sort)
- Empty (unfilled): search input shows the placeholder `Cerca per descrizione...`; no filter applied beyond the open-only default.
- Populated / default: open-only view sorted by `remainingMonths` ascending (D-C1/D-C2), URL-backed (`q`, `status`, `sort`, `dir`).
- { statement: "Toolbar controls have a defined loading/disabled state while the underlying list is not ready", verification: backstop }
- { statement: "A filter/sort combination that can produce no client-side error is confirmed (client-side filtering cannot throw on user input)", verification: backstop }
- { statement: "Toolbar reflows/stacks without clipping when controls exceed the container width (mobile/tablet)", verification: backstop }
- { statement: "A very long search query is handled (input scroll/truncation) without breaking the toolbar layout", verification: backstop }
- { statement: "Partial/one-of controls (e.g. only search, only status) behave correctly in combination", verification: backstop }
- { statement: "Reads correctly at zero/one/many available filter options", verification: backstop }

### E4 — Row actions (open plans only)
- Empty: closed plans render an empty actions cell (D-A3) — no "Chiudi" / "Realizza con vendita".
- Populated: open plans render "Chiudi" (opens the existing `CloseAmortizationDialog`) and "Realizza con vendita" (navigates to the transaction detail page).
- Overflow: inline buttons when space permits, falling back to a row (three-dot) dropdown when constrained.
- Error: a failed close surfaces via the dialog's error toast; the list is not refreshed until success.
- { statement: "Action buttons have a defined pending/disabled state while the close server action is in flight", verification: backstop }
- { statement: "Actions behave correctly for a plan in a partial/edge lifecycle state (e.g. zero remaining months, still open)", verification: backstop }
- { statement: "Action group reads correctly whether a row has one or both actions available", verification: backstop }
- { statement: "Action labels/buttons do not overflow the actions cell under narrow layouts", verification: backstop }

### E5 — Status badge ("Aperto" / "Chiuso")
- ⚠ unresolved — the probe left this element `unclassified`. It is a trivial stateless display indicator (`<Badge variant={open?'default':'secondary'}>`); the planner must treat its state coverage as an explicit assumption (the only variation is the open-vs-closed variant already specified under `### Status Badge (D-C3)`).

### E6 — Empty-state surface
- Empty: two variants — `no-data` (account has zero plans) and `no-result` (search/filter yields nothing); copy per `## Copywriting`.
- Populated: renders the correct variant's message + hint centered in the table region.
- Zero-one-many: distinguishes zero plans (`no-data`) from zero-after-filtering (`no-result`), so the user is not told they have no plans when a filter is hiding them.
- { statement: "Empty-state surface has a defined treatment while the list is still loading (does not flash the no-data state before data arrives)", verification: backstop }
- { statement: "Empty-state surface degrades gracefully on a data-load error (distinct from no-data)", verification: backstop }
- { statement: "Empty-state layout does not overflow/clip on small viewports", verification: backstop }
- { statement: "Empty-state handles partial data (e.g. some rows filtered) without mis-rendering", verification: backstop }

---

## Sign-off

**Design contract locked:** 2026-07-28  
**Ready for planning:** Yes  
**Ready for execution:** Yes (awaiting /gsd-plan-phase)  

This contract specifies the complete visual and interaction surface for Phase 79. All decisions from 79-CONTEXT.md (D-A1 through D-D1) are incorporated. The design mirrors `/reimbursements` (v2.8) structurally. D-C3 (closed-plan badge styling) is resolved per the reimbursement pattern.

---

*Next step: `/gsd-plan-phase 79` to create detailed PLAN.md*
