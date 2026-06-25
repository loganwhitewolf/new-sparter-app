---
phase: 56-import-format-refactor
plan: "01"
subsystem: import-pipeline
tags: [regression-test, hash-contract, behavior-preservation, tdd]
dependency_graph:
  requires: []
  provides: [transactionHash-regression-baseline]
  affects: [plans-02-03-04-gate]
tech_stack:
  added: []
  patterns: [vitest-pure-unit-test, static-hash-literals]
key_files:
  created:
    - tests/import-hash-contract.test.ts
  modified: []
decisions:
  - "descriptionStripPattern for fineco hard-coded as '\\s+Carta N\\..*$' to mirror today's production platform row (not in seed-data.ts shapes, applied via seed-extras)"
  - "Used it.each with FIXTURES array instead of 7 individual it() blocks — cleaner and ensures identical assertion structure per fixture"
  - "buildConfig receives descriptionStripPattern as explicit arg rather than reading slug=='fineco' internally — makes Phase 56 re-pointing of the strip pattern more surgical"
metrics:
  duration: "~10min"
  completed: "2026-06-25"
  tasks: 1
  files: 1
status: complete
---

# Phase 56 Plan 01: Import Hash Contract (Regression Baseline) Summary

Regression test pinning the exact `transactionHash` produced by all 7 CSV fixtures against the current (pre-refactor) code. GREEN on commit `3ac4a2f` before any Phase 56 column move.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Pin transactionHash for every CSV fixture against current code | 3ac4a2f | tests/import-hash-contract.test.ts |

## What Was Built

`tests/import-hash-contract.test.ts` — a pure vitest unit test (no DB, no R2, no network) that:

- Parses each of the 7 CSV fixtures via `parseImportFile`
- Runs `normalizeTransactionRow` for every data row using each platform's contract config (built from `scripts/seed-data.ts`)
- Asserts the resulting `transactionHash` array equals a hard-coded array of 64-char hex literals
- Asserts at least one non-null hash per fixture (non-vacuous guard)
- Pins first-row `amount` and `occurredAt.toISOString()` as secondary literals to catch sign/multiplier/date drift

## Pinned Hash Literals

These are the exact hashes captured from the current (pre-refactor) code. Plans 02–04 must keep these GREEN.

### general.csv (userId: `hash-contract-user`)

| Row | Description | Hash |
|-----|-------------|------|
| 1 | Coop Torino | `fc2ca4889376fba7960c8a2bc5327bc9f16d93b14a5f14876eb7bb1e1ee3c827` |
| 2 | Coop Torino (duplicate) | `fc2ca4889376fba7960c8a2bc5327bc9f16d93b14a5f14876eb7bb1e1ee3c827` |
| 3 | Stipendio | `1fc456b31126a629194304335b28ab4ffa7879f6428d62c0eb6e87b7ecfcd88d` |

### crypto-com.csv

| Row | Description | Hash |
|-----|-------------|------|
| 1 | CRO Card Cashback | `4ac485838f8c0a15480d3bb83c7b4bb3bf6552430e64fcd3b8859b8357959f86` |
| 2 | EUR Withdrawal | `b71410658b601c8285d35114d6bef5f1317d3ee0f6aea2ac911d027f5cbacbbb` |
| 3 | CRO Card Cashback (duplicate) | `4ac485838f8c0a15480d3bb83c7b4bb3bf6552430e64fcd3b8859b8357959f86` |

### satispay.csv

| Row | Description | Hash |
|-----|-------------|------|
| 1 | Bar Centrale | `494ae0ea38cfc38785d150ee30559d1175636cf7c10f9ac82e0af503f172c5a1` |
| 2 | Cashback Satispay | `3fdff687639af959a74fffdb671c9f214c58c031bfa8a0967fe3c4e8669d7c84` |
| 3 | Bar Centrale (duplicate) | `494ae0ea38cfc38785d150ee30559d1175636cf7c10f9ac82e0af503f172c5a1` |

### intesa-sp.csv

| Row | Description | Hash |
|-----|-------------|------|
| 1 | PAGAMENTO POS SUPERMERCATO | `ed47b86ed72ceb9f421a3bfd796cb8a99631ef2f0c847da2bd9c08f60058a6a7` |
| 2 | BONIFICO A VOSTRO FAVORE | `5b0ed2c6b158bac04f99bc943c5b1108427d8e74735e839cdd7859352e02617b` |
| 3 | PAGAMENTO POS SUPERMERCATO (duplicate) | `ed47b86ed72ceb9f421a3bfd796cb8a99631ef2f0c847da2bd9c08f60058a6a7` |

### intesa-sp-carta-credito.csv (multiplyBy: -1)

| Row | Description | Hash |
|-----|-------------|------|
| 1 | AMAZON MARKETPLACE | `bd73ec7a89203c32ce5b31aa047a60cdd9faf47372ffcbd494e146cc880f1877` |
| 2 | NETFLIX.COM | `33f756a6690c916dfdab22fa0bb561c63399896c423d1bd9ec3bd0f2b377c2b5` |
| 3 | AMAZON MARKETPLACE (duplicate) | `bd73ec7a89203c32ce5b31aa047a60cdd9faf47372ffcbd494e146cc880f1877` |

### revolut.csv

| Row | Description | Hash |
|-----|-------------|------|
| 1 | REWE SUPERMARKET | `b66d41fb78fd4e41e63ac3495b22dda82603b9892b625c9d765ceebee170c95b` |
| 2 | Salary | `cd6290bb5260f746d96ed9d81a92bf32ba5dbc09136629eb553e453b8c5a0424` |
| 3 | REWE SUPERMARKET (duplicate) | `b66d41fb78fd4e41e63ac3495b22dda82603b9892b625c9d765ceebee170c95b` |

### fineco.csv (amountType: separate, descriptionStripPattern: `\s+Carta N\..*$`)

| Row | Description | Hash |
|-----|-------------|------|
| 1 | PAGAMENTO CARTA SUPERMERCATO | `59d77d0f318078bf2cbfbc0b22ad008817500b27da035a3a4df442052dde5884` |
| 2 | ACCREDITO STIPENDIO | `410b61ca3abf242b0030532d16cf3959f96d1d0a99361c127e2d2af76128aeba` |
| 3 | PAGAMENTO CARTA SUPERMERCATO (duplicate) | `59d77d0f318078bf2cbfbc0b22ad008817500b27da035a3a4df442052dde5884` |

## Deviations from Plan

None — plan executed exactly as written. The test was written, hashes captured via external script (no self-referential derivation), and literals baked into static expectations.

## Out-of-scope Warnings Found

`yarn check:language` reports two pre-existing developer-facing Italian comments in `lib/dal/expenses.ts:82` and `lib/dal/transactions.ts:200`. These are pre-existing (outside this task's scope) and have been logged to `deferred-items.md`.

## Known Stubs

None — no UI rendering, no data stubs. Pure hash contract.

## Threat Flags

None — no new runtime trust boundary introduced (test only).

## Self-Check: PASSED

- `tests/import-hash-contract.test.ts` — FOUND
- Commit `3ac4a2f` — FOUND (via `git log --oneline -1`)
- `yarn test tests/import-hash-contract.test.ts` — 7 passed (7)
