# Quick Task 260730-n2z: Amort UX — Context

**Gathered:** 2026-07-30
**Status:** Ready for planning

<domain>
## Task Boundary

Amortization UX polish on the same branch as 260730-m2x (`gsd/quick-260730-m2x-amort-dashboard-fixes`):

1. Transaction detail: when a plan exists, replace "Chiudi ammortamento" + "Rimuovi ammortamento" with a single "Visualizza ammortamento" link that navigates to `/amortizations?transactionId=<uuid>`.
2. Amortizations registry: add `transactionId` URL filter (precise, UNIQUE plan per transaction).
3. Copy: rename "Realizza con vendita" / "Chiudi per vendita" → "Chiudi con vendita/rimborso" (dialog still offers realize vs partial-refund intents).
4. Status filter: "Tutti" must show open + closed plans (fix D-C1 mismatch where absent/`all` still resolved to open-only).

</domain>

<decisions>
## Implementation Decisions

### Detail actions (locked — Option A)
- Replace both Chiudi and Rimuovi on transaction detail with only "Visualizza ammortamento".
- Lifecycle actions (chiudi / rimuovi / vendita-rimborso) live only on the amortizations registry (and existing dialogs there).
- Keep "Ammortizza" on detail for eligible non-amortized transactions unchanged.

### Deep-link filter (locked — Option 1)
- Add `transactionId` query param support on `/amortizations`.
- Filter client-side (same pattern as `q` / `status`) — registry already loads full plan list.
- Link from detail: `/amortizations?transactionId=${transaction.id}` (or plan's transaction id — same UNIQUE).

### Copy (locked)
- Table button: "Realizza con vendita" → "Chiudi con vendita/rimborso".
- Dialog radio label: "Chiudi per vendita" → "Chiudi con vendita/rimborso".
- Keep "Rimborso parziale (ridistribuisci)" as the other intent label.
- Update user-facing error strings that say "chiudi per vendita" if they surface in UI (e.g. over-residual message) for consistency.

### Status "Tutti" (locked)
- Change `resolveEffectiveStatusFilter` so absent / null / `all` → show all statuses; `open` → open only; `closed` → closed only.
- Update unit tests in `tests/amortization-registry-table.test.ts` accordingly.
- Update the outdated D-C1 comment that called the Tutti≠all mismatch an "accepted tradeoff".

### Claude's Discretion
- Whether to also remove Chiudi/Rimuovi from the transactions **table** row menu (out of scope unless trivial and same UX inconsistency — prefer leave table as-is unless plan says otherwise; user only mentioned detail).
- Chip label for active `transactionId` filter in toolbar (e.g. short "Transazione" / truncated id) — keep minimal.
- Whether transaction-table row actions stay; user scoped to detail page.

</decisions>

<specifics>
## Specific Ideas

- Branch to continue: `gsd/quick-260730-m2x-amort-dashboard-fixes` (do NOT fork a new branch from main — stacks on m2x).
- Related prior fix: 260730-m2x linked refund via `createPairTx` and fixed remove-amortization client state.

</specifics>

<canonical_refs>
## Canonical References

- `components/transactions/transaction-detail-client.tsx` — detail actions
- `components/amortizations/amortization-table.tsx` — `resolveEffectiveStatusFilter`, row actions, filters
- `lib/utils/amortizations-table-config.ts` — toolbar config
- `components/transactions/amortization-reimburse-dialog.tsx` — realize/reduce copy
- `lib/routes.ts` — `APP_ROUTES.amortizations`
- Phase 79 D-C1 docs (to be overridden by this quick task for Tutti semantics)

</canonical_refs>
