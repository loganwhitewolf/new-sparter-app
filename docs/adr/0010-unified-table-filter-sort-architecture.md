# Unified table filter & sort architecture (harmonize, not a filter engine)

All app tables (Transactions, Expenses, Files) share one filtering/sorting **behaviour and UI**; only the **declared fields** differ per table. We deliberately chose a *harmonize* model — a shared toolbar + per-table declarative config — over an operator-rich filter engine (`{field, operator, value}[]` with `contains/gt/between/in`, AND/OR). The engine is rejected: there is no domain evidence justifying a query builder in a single-user personal-finance app, and it would break the "read the URL and understand it" property the app already relies on.

State stays in the **URL** as the single source of truth (filters are ephemeral, no localStorage), filtering/sorting runs **server-side** in the DAL, and pagination keeps the existing **offset + infinite-scroll** model (offset is client state, not in the URL).

## The coherence contract

Coherence = identical system behaviour, and identical fields **where the domain makes them meaningful**. A field is omitted only when it is *meaningless* for that entity, never out of laziness. Worked examples:

- **Expenses have no date filter** — an Expense is a live aggregate whose covered range expands on every import; no date is meaningful. Justified omission.
- **Expenses gain an amount filter** — `totalAmount` exists and is meaningful; its prior absence was an accidental gap, not a rule.
- **"Status" differs by table** — categorization (Transactions/Expenses) vs processing (Files). Same control, different declared field.

## Considered Options

- **Operator-rich filter engine** — rejected (over-engineering, breaks URL legibility, no domain driver).
- **Three bespoke components (status quo)** — rejected; the inconsistency *is* the problem being solved (different search keys, missing reset/sort, divergent date paradigms).
- **Shared UI + per-table declarative config** — chosen.

## Explicit non-goals (v1)

- No saved/named views (design keeps a saved view = a stored querystring, addable later).
- No CSV export of filtered data (trivial later — the server already holds the filtered query).
- No per-field operators, no AND/OR.

## Consequences

- A shared `DataTableToolbar` + filter panel + active-chip row + header-driven sort, driven by a per-table `TableConfig`.
- URL param normalization across tables (e.g. search key unified to `q`; free date ranges and the expenses `period` preset replaced by the month multi-select — see ADR 0009).
- Every DAL `orderBy` must end with a stable `id` tiebreaker, otherwise offset windows duplicate/skip rows on non-unique sorts (acute for amount sort). This is a pre-existing latent bug fixed as part of this work.
