# Direction is derived from FlowNature; `allocation` is a fourth direction

Economic **direction** (`in` / `out` / `transfer` / `allocation`) is a property of the `FlowNature`, not an independent axis. Each nature maps to exactly one direction, and a transaction's direction is derived from the nature of its subcategory. The legacy `category.type` field is deprecated and will be removed. A fourth direction, `allocation`, is introduced for net-worth-neutral money movements that are nonetheless worth tracking (savings + investments), distinct from `transfer` (net-worth-neutral movements that are analytical noise).

## Context

The model had two overlapping classification axes: `category.type` (`in`/`out`/`transfer`/`system`) on the category, and `nature` on the subcategory (ADR 0003). They are redundant — every nature already implies a direction — but nothing kept them consistent. A subcategory could be under an `in`-typed category while carrying an `out` nature (e.g. `vendita-investimenti`: category type `in`, nature `financial` → OUT). Because the dashboard groups by nature (ADR 0003/0004), such rows landed on the wrong side of the chart. This was the root cause of the "investment sale shows in uscite" bug — a conceptual modelling error, not just stale data.

## Considered Options

- **Two independent axes + a consistency constraint.** Keep `category.type` and `nature`, add a check that they agree. Rejected: stores the same fact twice and adds enforcement machinery to defend an invariant that disappears entirely if direction is simply a property of nature.

- **Type as the direction source; nature as direction-agnostic flavour.** Make the dashboard split IN/OUT by `category.type`, nature only sub-segments within a direction. Rejected: contradicts ADR 0003/0004 (grouping is by nature) and doesn't match how nature is actually used; the user reasons in terms of nature, not category type.

- **Direction derived from nature; drop `category.type` (chosen).** Nature is the single source of truth. Direction becomes a fixed property of each nature. `category.type` carries no information nature doesn't and is deprecated.

And, separately, for savings/investments:

- **Treat savings/investments as `out` (spending).** The historical model: putting €500 in a deposit or buying an ETF counted as an expense. Rejected: it is not consumption — net worth is unchanged — and it inflates reported spending.

- **Fold savings/investments into `transfer`.** Also net-worth-neutral. Rejected: `transfer` is excluded and hidden from the dashboard, but allocations are a positive behaviour the user wants to **see and measure** ("how much did I put aside this month?"). Same accounting effect, opposite analytical value.

- **A dedicated `allocation` direction (chosen).** Net-worth-neutral like transfer, but surfaced as its own block ("Accantonato / Investito"), outside spending totals.

## Consequences

- **Nature renames + dissolution.** `financial` → `investment`; `extraordinary` (which the seed applied to savings) → `savings`. `operational` is **dissolved** into `essential`/`discretionary`: it mixed two axes (need/want + recurring/fixed) into a catch-all spanning subscriptions, insurance, taxes, and education — the very anti-pattern ADR 0003 warned against. Final nature set (8): `income`, `income_extraordinary` (IN); `essential`, `discretionary`, `debt` (OUT); `transfer` (TRANSFER); `savings`, `investment` (ALLOCATION). No `extraordinary` OUT nature remains — one-off expenses fall under their consumption nature. The "recurring spend / subscriptions" insight, if wanted, is an orthogonal cut (flag/view), not a nature.
- **`category.type` removal is a migration**, touching the schema, seed (`seed-extras.ts` nature buckets), `cascade-options.ts`, the overview DAL (`OUT_NATURES` + income split → now four direction buckets), KPI/dashboard (new allocation block), and the recently shipped nature/type filters. The cascade filters built on derivation already align with "direction from nature".
- **Divestment nets, it is not income.** Selling one's own asset or withdrawing from savings is recorded with the same `investment`/`savings` nature, contributing negatively and netting within the allocation segment (extends ADR 0004's algebraic-sum refund logic). Only new external money (inheritance, gifts, winnings) is `income_extraordinary`. `vendita-investimenti` becomes a divestment (allocation); inheritances get a dedicated IN subcategory ("eredità e donazioni ricevute").
- **`debt` stays OUT** as its own nature: the principal portion is net-worth-neutral, but principal and interest cannot be split from a single bank debit, and a loan instalment is a fixed commitment to budget as an outflow.
- **Refunds net at subcategory level, no transaction-linking.** A credit that cancels a specific expense (online-order return, reimbursement from a person, tracked medical/travel reimbursement) is categorized under the **same subcategory as the expense** and nets by algebraic sum within that OUT segment (ADR 0004) — there is deliberately no transaction↔transaction correlation entity. Only new external money (cashback, loyalty rewards, promotional bonuses, inheritance, winnings) is `income_extraordinary`. Decidable rule: "cancels a specific expense → net; new money not tied to an expense → income_extraordinary." Display consequence: a transaction's amount sign may oppose its nature's direction (a `+` refund under an OUT subcategory) — shown by real amount in the list, netted in the chart.
- **Known limitation (deferred):** employer expense reimbursements bundled into the monthly salary credit cannot be split from salary; that month shows an inflated `income` and un-netted expenses. Not handled now.
- Amends ADR 0003 (nature on subcategory — still valid) and builds on ADR 0004 (algebraic sum — now also governs allocation netting).
- The dashboard moves from a 2-way (entrate/uscite) split to a 4-direction view; `transfer` remains excluded and hidden, `allocation` becomes visible-but-separate.

## Status

accepted — implementation deferred to a dedicated phase (`NATURE-TABLE-01` / nature-direction realignment). Until then, direction is derived in application code from the existing nature→direction mapping.
