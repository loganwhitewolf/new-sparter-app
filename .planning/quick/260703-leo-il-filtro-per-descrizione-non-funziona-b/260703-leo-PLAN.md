---
quick_id: 260703-leo
slug: il-filtro-per-descrizione-non-funziona-b
status: ready
---

# Quick Plan: Fix description search filter (expenses + transactions)

## Root cause

1. **Substring UX**: DAL already uses `%term%` ILIKE — not prefix-only. Transactions omitted `expense.title` (shown in table when `customTitle` is empty).
2. **Focus loss**: `DataTableToolbar` remounts the search `<Input>` on every URL `q` change via `key={searchParams.get('q')}` and disables it while `isPending` — typing (especially spaces between words) loses focus before the query completes.

## Tasks

1. **DataTableToolbar** — controlled local draft state, remove `key` remount, keep search enabled during transitions, debounce 500ms, trim only on URL commit.
2. **transactions DAL** — include `expense.title` in name/q OR clause (matches displayed label).
3. **Tests** — assert `%substring%` pattern and expense.title in transaction name filter.
