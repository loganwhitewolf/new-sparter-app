---
phase: 260730-e6z
plan: 01
subsystem: ui
tags: [react, decimal.js, transactions, footer]

requires: []
provides:
  - "computeTransactionTotals — pure per-currency totals helper for client-side derived lists"
  - "formatSignedAmount — signed it-IT currency formatter (signDisplay: exceptZero)"
  - "Transactions table footer: compact Entrate/Uscite/Differenza summary once the full filtered set is loaded"
affects: [transactions]

tech-stack:
  added: []
  patterns:
    - "Per-currency bucketing normalizing falsy/empty currency to 'EUR' (mirrors existing getAmountFormatter/formatAbsoluteAmount convention)"
    - "Client-side derived useMemo totals over already-fetched rows, no new DAL aggregate"

key-files:
  created:
    - lib/utils/transaction-totals.ts
    - tests/transaction-totals.test.ts
    - tests/transaction-table-footer-totals.test.tsx
  modified:
    - lib/utils/format-amount.ts
    - components/transactions/transaction-table.tsx
    - tests/format-amount.test.ts

key-decisions:
  - "Footer only replaces the existing end-of-list message when hasMore is false and not loading (D-01, D-03) — no new DAL query, computed over loadedTransactions client-side (D-02)"
  - "Totals split by sign of pairedNetAmount ?? amount, never the direction lookup table, so uncategorized rows still reconcile (D-04, D-05)"
  - "Totals bucketed per transaction.currency (falsy/empty -> 'EUR'), one Entrate/Uscite/Differenza line per bucket, ordered count desc then currency code asc (D-08)"
  - "formatSignedAmount forces useGrouping: true explicitly — this Node/ICU build silently drops the thousands separator when signDisplay is set to a non-default value (exceptZero) and useGrouping is left at its 'auto' default"

patterns-established:
  - "formatSignedAmount alongside formatAbsoluteAmount in lib/utils/format-amount.ts, same getCurrencyFormatter cache pattern with a second cache keyed by currency"

requirements-completed: [TX-FOOTER-TOTALS]

coverage:
  - id: D1
    description: "computeTransactionTotals reconciles per-currency Entrate/Uscite/Differenza from pairedNetAmount ?? amount, Decimal.js only, empty-input and zero-net edge cases covered"
    requirement: "TX-FOOTER-TOTALS"
    verification:
      - kind: unit
        ref: "tests/transaction-totals.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "formatSignedAmount renders it-IT signed currency strings (+/-, exceptZero on 0)"
    requirement: "TX-FOOTER-TOTALS"
    verification:
      - kind: unit
        ref: "tests/format-amount.test.ts#formatSignedAmount"
        status: pass
    human_judgment: false
  - id: D3
    description: "Transactions table footer shows count + Entrate/Uscite/Differenza (one line per currency bucket) only when hasMore is false and not loading; button/loading states unchanged; single-currency case renders without a currency label"
    requirement: "TX-FOOTER-TOTALS"
    verification:
      - kind: unit
        ref: "tests/transaction-table-footer-totals.test.tsx"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-30
status: complete
---

# Quick Task 260730-e6z: riepilogo totali netti nel footer della tabella transazioni Summary

**Transactions table footer replaced with a compact, per-currency Entrate/Uscite/Differenza summary computed client-side from loaded rows via Decimal.js.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-30
- **Tasks:** 1 (tracer, full vertical slice)
- **Files modified:** 6

## Accomplishments
- `computeTransactionTotals` (`lib/utils/transaction-totals.ts`) groups loaded transactions by `currency` (falsy/empty normalized to `'EUR'`), splits each bucket's `pairedNetAmount ?? amount` by sign into `totalIn`/`totalOut`/`difference` — all via Decimal.js — and returns buckets ordered by count descending then currency code ascending.
- `formatSignedAmount` added to `lib/utils/format-amount.ts`: it-IT signed currency formatting (`signDisplay: 'exceptZero'`), following the file's existing formatter-cache pattern.
- `components/transactions/transaction-table.tsx` footer: the old "Tutte le transazioni disponibili sono caricate." message is replaced with a transaction-count label plus one Entrate/Uscite/Differenza line per currency bucket — rendered only when `hasMore === false` and `isLoadingMore === false`; the button and loading states are untouched.

## Task Commits

1. **Task 1: Compact net totals in the transactions table footer** - `95f3adee` (feat)

**Plan metadata:** committed separately by the orchestrator (docs commit not part of this task).

_Note: this was executed as a single tracer commit per the plan's explicit instruction to implement the full vertical slice (computation + formatting + footer wiring) in one pass, not staged RED/GREEN/REFACTOR commits._

## Files Created/Modified
- `lib/utils/transaction-totals.ts` - `computeTransactionTotals` + `CurrencyTotals`/`TransactionTotals` types
- `lib/utils/format-amount.ts` - `formatSignedAmount` addition (second formatter cache, `signDisplay: 'exceptZero'`)
- `components/transactions/transaction-table.tsx` - footer wiring (`useMemo` totals, old message replaced), `transactionCountLabel` helper
- `tests/transaction-totals.test.ts` - pure computation coverage (empty input, sign split, `pairedNetAmount` override, zero-net, multi-currency, bucket ordering, `totalCount`)
- `tests/format-amount.test.ts` - `formatSignedAmount` describe block (positive/negative/zero, non-finite fallback, currency default)
- `tests/transaction-table-footer-totals.test.tsx` - end-to-end footer render coverage (fewer than PAGE_SIZE, exactly PAGE_SIZE/hasMore, empty array, multi-currency)

## Decisions Made
- `useGrouping: true` set explicitly on the signed formatter — discovered during test-running that this Node/ICU build (`v22.22.3`) silently drops the thousands separator whenever `signDisplay` is set to a non-default value (`exceptZero`) and `useGrouping` is left at its `'auto'` default. Confirmed via a direct `node -e` repro; fixed by pinning `useGrouping: true` (not a plan deviation — a correctness requirement for D-07's "it-IT grouping/decimals" acceptance criterion, so folded directly into the implementation rather than logged as a separate Rule 1 fix).

## Deviations from Plan

None beyond the ICU grouping fix above, which is the literal fulfillment of D-07's stated acceptance criterion (grouping must render), not a scope change.

## Issues Encountered
- A JSDoc comment containing the literal sequence `*//` (from "native +/-/*// on amount strings") prematurely closed the block comment for oxc's parser, breaking the transform. Reworded to "native JS operators" — no functional change, comment-only fix.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- No blockers. Verification run: `yarn tsc --noEmit` clean, full `vitest run` suite green (167 files / 2080 tests), `yarn check:language` passed, targeted `eslint` run on touched files shows only two pre-existing warnings unrelated to this change (unused `getAmountFormatter`, a pre-existing `setState`-in-effect warning in `DeleteTransactionMenuItem`).

---
*Phase: 260730-e6z*
*Completed: 2026-07-30*
