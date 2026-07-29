---
phase: 81-inline-net-display-for-paired-transactions
plan: 01
subsystem: ui
tags: [nextjs, react, decimal.js, transactions-table]

# Dependency graph
requires:
  - phase: 78-plan-lifecycle-and-reconciliation
    provides: realizePlanTx -> createPairTx writes reimbursement/reimbursement_refund for amortization-sale realization (same path as v2.8 reimbursements)
  - phase: 76-reimbursements-section
    provides: ReimbursementRowIndicator, transactionListSelect pairing fields (pairedWithId/pairedNetAmount/pairedDescription/reimbursementId)
provides:
  - resolvePairRole(transaction) — pure client-side anchor|counterpart|null discriminator (pairedWithId + sign of amount)
  - transaction-table.tsx amount cell split render (net-primary + struck-through gross on anchor; attenuated amount on counterpart)
  - PairedReductionBadge — new sibling component, "riduzione di …" badge linking to the anchor transaction
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "resolvePairRole(row): single per-row pure predicate consulted by BOTH the amount-cell split and the title-row badge swap — one source of truth so the two can never disagree on a row"
    - "PairedReductionBadge as a plain sibling of ReimbursementRowIndicator (different link target/intent) rather than a branching-prop extension — keeps the existing indicator's call sites/tests untouched"

key-files:
  created:
    - components/transactions/paired-reduction-badge.tsx
    - tests/transaction-table-paired-net-display.test.tsx
  modified:
    - components/transactions/transaction-table.tsx

key-decisions:
  - "Anchor-vs-counterpart resolved purely from pairedWithId + sign of amount — safe with ZERO DAL change because assertOutflowAnchorAmount/assertInflowRefundAmount (reimbursement-invariant.ts) enforce, at write time, that every reimbursement anchor is negative and every refund positive, for both createPairTx call sites (amortization-sale + v2.8 reimbursement)"
  - "Counterpart badge links to the ANCHOR transaction (transactionDetailHref), not /reimbursements/[id] — an amortization sale does not warrant the reimbursement-management deep link; the swap is exclusive (never both badges on one row)"
  - "Purely presentational: lib/dal/transactions.ts, effectiveAmount(), and every aggregation query are untouched (D-N4)"

patterns-established:
  - "resolvePairRole(transaction: TransactionListRow): 'anchor' | 'counterpart' | null as the row-pairing display discriminator for the transactions table"

requirements-completed: [AMORT-05]

coverage:
  - id: D-N2
    description: "A paired outflow anchor renders pairedNetAmount as the primary amount-cell figure with the gross amount struck-through/opaque beneath it"
    requirement: "AMORT-05"
    verification:
      - kind: unit
        ref: "tests/transaction-table-paired-net-display.test.tsx#anchor row net-primary amount display (D-N2)"
        status: pass
    human_judgment: false
  - id: D-N3
    description: "A counterpart row swaps ReimbursementRowIndicator for a 'riduzione di …' badge linking to the anchor transaction (transactionDetailHref), with its amount rendered attenuated"
    requirement: "AMORT-05"
    verification:
      - kind: unit
        ref: "tests/transaction-table-paired-net-display.test.tsx#counterpart row reduction badge (D-N3)"
        status: pass
    human_judgment: true
    rationale: "Render-level markup + href asserted via renderToStaticMarkup; the live-browser look of the net/struck/attenuated treatment on real data is the human-UAT backstop this closure phase was created to satisfy — worth an eyeball on a real closed-for-sale plan and a reimbursed transaction before ship."
  - id: D-N1
    description: "The display applies to all pairings (amortization-sale AND v2.8 reimbursement) via the single reimbursement/reimbursement_refund path — one code path, no amortization-specific branch"
    requirement: "AMORT-05"
    verification:
      - kind: unit
        ref: "resolvePairRole reads only pairedWithId + sign(amount); both createPairTx call sites feed the same fields (verified by plan-checker against reimbursement-invariant.ts)"
        status: pass
    human_judgment: false
  - id: D-N4
    description: "No change to effectiveAmount(), any total, or dashboard/lens figure; lib/dal/transactions.ts unmodified; LENS-03 byte-identical regression stays green"
    requirement: "AMORT-05"
    verification:
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts (LENS-03) + full suite: 161 files, 1957 passed, 1 todo"
        status: pass
      - kind: unit
        ref: "node_modules/.bin/tsc --noEmit clean; yarn check:language passed"
        status: pass
    human_judgment: false

# Metrics
duration: ~20min
completed: 2026-07-29
status: complete
---

## What shipped

Two commits on `gsd/v2.9-amortization`:

- `75026784` — Task 1 (tracer): `resolvePairRole` + the split amount cell. An anchor row (paired,
  outflow) shows `pairedNetAmount` as the primary figure with the gross `amount` struck-through and
  opaque beneath it; unpaired rows are byte-for-byte unchanged.
- (Task 2) — `PairedReductionBadge` (new) + the title-row badge swap + counterpart amount
  attenuation. A counterpart (sale/refund inflow) row shows a "riduzione di …" badge linking to its
  anchor transaction and renders its own amount muted, instead of the generic reimbursement
  indicator.

## Verification

- `tests/transaction-table-paired-net-display.test.tsx` — anchor net+struck, unpaired unchanged,
  counterpart badge+href+swap, anchor keeps ReimbursementRowIndicator. All pass.
- `node_modules/.bin/tsc --noEmit` clean; `yarn check:language` passed.
- Full suite: 161 files, 1957 passed + 1 todo; LENS-03 byte-identical regression green (D-N4).

## Notes / held-out

The live-browser look on real data is the human-UAT item this closure phase exists to satisfy —
verify on a real closed-for-sale plan and a reimbursed transaction before shipping v2.9.
