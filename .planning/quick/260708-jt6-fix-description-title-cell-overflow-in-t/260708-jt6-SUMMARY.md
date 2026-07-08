---
quick_id: 260708-jt6
slug: fix-description-title-cell-overflow-in-t
status: complete
completed: 2026-07-08
---

# Quick Task 260708-jt6: Fix description/title cell overflow — Summary

**One-liner:** Fixed two CSS structural bugs that let long transaction/expense
titles visually overflow their table cell and overlap adjacent columns —
became visible after the na4 milestone task stopped truncating `expense.title`
at write time (commits c3b39af/19143a8), which produced much longer strings
than the CSS truncation chain had ever been exercised with.

## Root cause (traced, not hypothesized) — two rounds

**Round 1 (container-level):**

1. **Transactions table** — `table-fixed` + wrapper `overflow-hidden` +
   `TableCell className="max-w-0 w-full"` were already correct. But the `<div
   className="flex flex-col gap-1">` directly wrapping `TransactionTitleEdit`
   was missing `min-w-0`. A flex item defaults to `min-width: auto`
   (content-based sizing) unless reset — without that reset at this level,
   the div could grow to its content's natural width regardless of the
   correct `min-w-0` chain further down inside `TransactionTitleEdit` itself,
   letting text spill into the `Importo`/`Data` columns.

2. **Expenses table** — the `<Table>` had no `table-fixed` class, and its
   wrapper `<div>` had no `overflow-hidden`. Every other column already had
   an explicit width and the title `TableCell` already used the same
   `max-w-0 w-full` trick as the (working) transactions table — but without
   `table-fixed` on the `<table>` element, `table-layout: auto` sizes columns
   from content, so the trick had no effect and long titles bled into
   `Totale`/`Data`/`Piattaforma`.

**Round 2 (element-level, found after round 1 alone didn't fix it):**

3. The innermost `<span className="truncate" ...>{title}</span>` — and the
   `<Link>` wrapping it — are `display: inline` by default (`span`/`a`).
   `text-overflow`/`overflow`/`width` do not apply to non-replaced inline
   boxes per the CSS spec: a `white-space: nowrap` inline box simply grows to
   its content's natural width regardless of any ancestor's `min-w-0` chain,
   because there is no width being constrained on the inline box itself to
   begin with. `truncate` alone (`overflow: hidden; text-overflow: ellipsis;
   white-space: nowrap`) silently does nothing on an inline element. The one
   place `truncate` already worked in this codebase before this task
   (`expense-table.tsx:292`, `<TableCell className="truncate">`) worked
   *because* `<td>` is `display: table-cell`, not inline — that's the tell.

**Round 3 (visual polish — real screen confirmed the fix works, but left a gap):**

4. After rounds 1-2, the title truncated correctly but left visible empty
   space between the ellipsis and the start of the next column. The title
   `Link` sits in a **row**-direction flex container
   (`<div className="flex min-w-0 items-center gap-1">`, alongside the pencil
   button) with no `flex-grow` — flex items default to `flex-grow: 0`, so the
   Link only claimed as much horizontal space as its own shrink-to-fit
   calculation produced, not the full remaining row width. (The default
   `align-items: stretch` that made earlier `min-w-0` fixes work only
   stretches items along the **cross** axis — vertical in a row-direction
   flex container — so it never applied here.) Adding `flex-1` to the Link
   makes it explicitly claim all available horizontal space in that row, and
   since its child `span` is `block` (width defaults to 100% of its
   containing block), the truncated text now fills the column edge-to-edge.

## Changes

| File | Change |
|------|--------|
| `components/transactions/transaction-table.tsx` | `min-w-0` added to the div wrapping `TransactionTitleEdit` |
| `components/expenses/expense-table.tsx` | wrapper div gains `overflow-hidden`; `<Table>` gains `table-fixed w-full` |
| `components/transactions/transaction-title-edit.tsx` | `block` on the title `Link` + both `span`s (main + "Originale:" line); `flex-1` added to the title `Link` |
| `components/expenses/expense-title-edit.tsx` | `block` on the title `Link` + `span`; `flex-1` added to the title `Link` |

No new component, no new truncation mechanism — the existing `truncate` +
native `title=""` tooltip pattern (already correct in both
`TransactionTitleEdit` and `ExpenseTitleEdit`) now actually takes effect,
since both structural CSS bugs preventing it are fixed, and the title column
now claims its full allocated width.

## Verification

- `npx tsc --noEmit` — no new errors in either touched file (35 pre-existing
  errors elsewhere, unchanged)
- `yarn lint` — no new warnings in either touched file (2 pre-existing
  set-state-in-effect warnings, documented as unrelated in the na4 task)
- `yarn vitest run` — 115 files / 1368 tests green, no regressions
- `yarn check:language` — clean
- **Round 3 was user-confirmed on the live app**: rounds 1-2 fixed the
  overflow (user: "ora va meglio"); round 3 addresses the follow-up report of
  excess gap before the next column.
