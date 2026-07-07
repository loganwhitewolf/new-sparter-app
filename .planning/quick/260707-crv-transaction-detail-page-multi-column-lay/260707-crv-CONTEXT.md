# Quick Task 260707-crv: Transaction detail page multi-column layout and visible actions box - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

<domain>
## Task Boundary

Improve the `/transactions/[id]` detail page layout on desktop: use horizontal space
with a multi-column card grid instead of full-width stacked cards, and replace the
`⋯` overflow menu with a dedicated visible **Azioni** card.

Scope is **transaction detail only** in this quick task. Expense and import file
detail pages stay on the current single-column shell until a follow-up.

This intentionally revisits Phase 63 locked decisions **D-01** (single column) and
**D-09** (overflow menu) for the transaction page only.

</domain>

<decisions>
## Implementation Decisions

### Layout (desktop ≥ lg)
- **Claude's discretion:** 2-column grid — `Dati` card spans the left (~3/5 width);
  right column (~2/5) stacks `Categoria`, `Collegamenti`, and `Azioni` cards vertically.
- **Mobile (< lg):** unchanged single-column stack (mobile-first preserved).
- **Rationale:** `Dati` is the tallest card (4 fields + bank description block); the
  right column cards are compact and read as a contextual sidebar.

### Actions exposure
- **Dedicated `Azioni` card** in the right column replaces `overflowMenu` entirely.
- All actions render as full-width outline buttons (destructive styling for Elimina).
- Actions list (conditional):
  - Cerca su internet (external link)
  - Collega rimborso / Scollega rimborso (mutually exclusive by pair state)
  - Spesa a sé (only when `expenseId` present)
  - Elimina (destructive, bottom of card)
- Remove `primaryAction` + `overflowMenu` props usage from transaction detail client;
  shell may gain an optional `azioniCard` slot or actions move into page-level composition.

### Shell changes
- Extend `DetailPageShell` with responsive `lg:grid lg:grid-cols-5` (or equivalent)
  for card section, without breaking expense/file detail pages (they keep stacked layout
  until scoped later).
- Prefer a layout prop or slot-based approach so expense page is unaffected in this task.

### Scope
- **Transaction detail page only** (`transaction-detail-client.tsx` + shell layout hook).
- No expense/file detail changes in this quick task.

### Claude's Discretion
- Exact grid fractions, card internal spacing, button variants.
- Whether `Cerca su internet` stays in header vs moves entirely into Azioni card
  (leaning: all in Azioni card for consistency with user request).
- Shell API shape (`azioniCard` slot vs restructuring existing slots).

</decisions>

<specifics>
## Specific Ideas

User screenshot (2026-07-07): wide viewport with ~70% empty horizontal space;
three-dot menu hides infrequent but important actions (pair, detach, delete).
User preference: visible action box instead of hidden menu.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/phases/63-detail-pages-tx-expense/63-CONTEXT.md` — original D-01/D-09
  (superseded for tx page by this quick task)
- `components/detail-pages/detail-page-shell.tsx` — shared shell
- `components/transactions/transaction-detail-client.tsx` — primary edit target

</canonical_refs>
