---
phase: 56-import-format-refactor
plan: "04"
subsystem: import-pipeline
tags: [detector, dal, wizard, contract-move, behavior-preservation, adr-0013]
dependency_graph:
  requires: [56-03-platform-drop-migration]
  provides: [detector-reads-version-contract, wizard-writes-version-contract, IFMT-04, IFMT-05]
  affects: [import-pipeline-runtime, phase-57-pdf-import]
tech_stack:
  added: []
  patterns: [version-sourced-contract, identity-only-platform, drizzle-select-repoint]
key_files:
  created: []
  modified:
    - lib/dal/import-formats.ts
    - tests/import-detector.test.ts
    - lib/services/import-format-wizard.ts
    - tests/import-format-wizard-actions.test.ts
decisions:
  - "kept candidate sub-object named 'platform' to avoid breaking import.ts (deriveFullFileImportStats passes best.platform to normalizeTransactionRow) — zero edit to import.ts"
  - "ImportFormatRow type renamed platform* fields to contract fields (delimiter, timestampColumn, etc.) and kept platformName/platformSlug/etc. for identity — clean separation"
  - "wizard: dateFormat:null, dateReplace:false, decimalReplace:false set explicitly so the private format version is a well-formed contract row"
  - "test fixtures for import-detector.test.ts rebuilt from importFormatVersions seed — contract fields now version-sourced, headerSignature rebuilt from fv.* fields"
metrics:
  duration: "~8min"
  completed: "2026-06-25"
  tasks: 3
  files: 4
status: complete
---

# Phase 56 Plan 04: Runtime Consumer Re-point Summary

Detection DAL, wizard, and test fixtures re-pointed to read/write the parsing contract from `import_format_version`, completing the behavior-preserving ADR 0013 refactor with both regression tests GREEN.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Re-point detection DAL + detector fixture test to version-sourced contract | 2638096 | lib/dal/import-formats.ts, tests/import-detector.test.ts |
| 2 | Update wizard to write contract on importFormatVersion, identity on platform | b46dcbf | lib/services/import-format-wizard.ts, tests/import-format-wizard-actions.test.ts |
| 3 | Full-suite regression and language gate (verification only — no file change) | — | tests/import-hash-contract.test.ts (GREEN, literals unchanged) |

## What Was Built

### Task 1 — Detection DAL re-point (`lib/dal/import-formats.ts`)

**`loadImportFormatsForDetection` select:** Contract columns (`delimiter`, `timestampColumn`, `descriptionColumn`, `amountType`, `amountColumn`, `positiveAmountColumn`, `negativeAmountColumn`, `multiplyBy`, `descriptionStripPattern`) now selected from `importFormatVersion`; identity columns (`platformName`, `platformSlug`, `platformCountry`, `platformIsActive`, `platformVisibility`, `platformReviewStatus`, `platformOwnerUserId`) still selected from `platform`.

**`ImportFormatRow` type:** Contract fields added at the top level (`delimiter`, `timestampColumn`, etc.); platform identity fields kept with `platform*` prefix.

**`hasExpectedRowShape`:** Updated to validate contract fields from version (not platform).

**`toCandidate`:** Builds `platform` sub-object with contract from row (version-sourced) and identity from `platform*` fields — the sub-object shape is identical to before, so `import.ts` and `import-format-detector.ts` consume it unchanged.

**`tests/import-detector.test.ts` fixture:** `formats` array rebuilt from `importFormatVersions` seed (contract) + `platforms` seed (identity). `headerSignature` computed from `fv.*` fields. All 20 tests GREEN (same detection outcomes, same confidence ≥ 0.8).

### Task 2 — Wizard re-point (`lib/services/import-format-wizard.ts`)

**`createPrivateRows`:** Platform insert now writes identity only: `ownerUserId`, `visibility`, `reviewStatus`, `name`, `slug`, `country:'IT'`, `isActive:true`. No `delimiter`, `timestampColumn`, or any contract field.

ImportFormatVersion insert gains the full contract: `delimiter`, `timestampColumn`, `descriptionColumn`, `amountType` (= `input.amountMode`), `amountColumn` (single mode only), `positiveAmountColumn`/`negativeAmountColumn` (separate mode only), `multiplyBy:1`, `dateFormat:null`, `dateReplace:false`, `decimalReplace:false`, `descriptionStripPattern:null`.

`CreatePrivateImportFormatResult` shape and the file-row update are unchanged.

**`tests/import-format-wizard-actions.test.ts`:** Updated assertions verify:
- `insertedPlatforms[0]` has no `delimiter`, `timestampColumn`, `descriptionColumn`, `amountType` fields
- `insertedVersions[0]` has the full contract including `delimiter:','`, `amountType:'single'`, `amountColumn:'Importo'`, `multiplyBy:1`, etc.
All 9 tests GREEN.

### Task 3 — Full suite regression + language gate

`tests/import-hash-contract.test.ts` — 7 tests GREEN with **original Plan 01 literals unchanged**. No hash drifted.

Full import suite result: `99 passed (99)` across:
- `tests/import-hash-contract.test.ts` (7)
- `tests/import-detector.test.ts` (20)
- `tests/import-service.test.ts` (varies)
- `tests/import-utils.test.ts` (varies)
- `tests/import-format-wizard-actions.test.ts` (9)

`yarn check:language` — clean for this plan. Only pre-existing violations in `lib/dal/expenses.ts:82` and `lib/dal/transactions.ts:200` (already logged in 56-01-SUMMARY as deferred).

## Contract Source Verification

Grep for platform-table contract field reads in runtime source confirms: no direct reads of `platform.delimiter`, `platform.timestampColumn`, etc. in `lib/dal/`, `lib/services/`, `lib/utils/`. Reads of `format.platform.timestampColumn` in `import-format-detector.ts` are reads from the **candidate sub-object** (populated from `importFormatVersion` by the DAL), not from the platform table.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Discretionary Decisions

**1. Kept `platform` sub-object name on `ImportFormatCandidateInput`**
- Plan said: "if you rename the candidate sub-object, update all reads consistently"
- Decision: kept `platform` as the sub-object name. Renaming to `config` or `contract` would have required updating `import.ts` (`best.platform`), `import-format-detector.ts` (all `format.platform.*` reads), and call sites. Zero behavioral impact, non-trivial churn for no gain. The sub-object is an internal candidate carrier, not a DB-access path.

## Phase 56 Invariant: IFMT-02 PROVEN

Both regression gates are GREEN:
1. `tests/import-hash-contract.test.ts` — 7/7 GREEN with original Plan 01 pinned literals.
2. `tests/import-detector.test.ts` — 20/20 GREEN, all 7 formats detected by slug with confidence ≥ 0.8.

The 6 CSV/XLSX imports produce identical `transactionHash` before and after the refactor.

## Phase 56 Requirements Met

| Requirement | Status |
|-------------|--------|
| IFMT-04 — versioning per platform expressible | Done — wizard writes contract to `importFormatVersion`; `unique(platformId, version)` is meaningful |
| IFMT-05 — all consumers read contract from version | Done — DAL, detector, wizard all re-pointed; `import.ts` unchanged (consumed via candidate shape) |
| IFMT-02 — regression gate GREEN | Done — pinned literals unchanged, 99 tests pass |

## Known Stubs

None — no UI rendering, no data stubs. Pure service/DAL layer changes.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced.

## Self-Check: PASSED

- `lib/dal/import-formats.ts` — FOUND, contract select from importFormatVersion
- `lib/services/import-format-wizard.ts` — FOUND, contract on importFormatVersion insert
- Commit `2638096` (Task 1) — FOUND
- Commit `b46dcbf` (Task 2) — FOUND
- `yarn test tests/import-hash-contract.test.ts tests/import-detector.test.ts tests/import-service.test.ts tests/import-utils.test.ts tests/import-format-wizard-actions.test.ts` — 99 passed GREEN
