---
phase: 260728-mpo
plan: 01
subsystem: database
tags: [drizzle, seed-extras, import-format-detector, fineco]

requires: []
provides:
  - "Fineco v1 seed contract migrated to the Moneymap ;-delimited format (Data_Operazione timestamp column)"
  - "Explicit headerSignature override mechanism in seed-data.ts / seed.ts (headerSignatureFor), consumed by any future platform needing full-header detection instead of the derived required-columns join"
  - "merge-duplicate-fineco-platforms seed-extras STEP (D-01)"
  - "ensure-fineco-moneymap-global-format seed-extras STEP (D-02/D-03)"
affects: [import-wizard, import-format-detector, seed-extras]

tech-stack:
  added: []
  patterns:
    - "Optional per-entry headerSignature override on ImportFormatVersionSeed, checked first in headerSignatureFor() before falling back to the derived join — lets one platform detect against its full raw CSV header while every other platform keeps the existing derived-join convention untouched"
    - "Two-step platform+format consolidation (merge platforms first, then consolidate formats), each step independently idempotent, mirroring the ensureTradeRepublicCsvGlobalFormat precedent"

key-files:
  created: []
  modified:
    - scripts/seed-data.ts
    - scripts/seed.ts
    - scripts/seed-extras.ts
    - tests/fixtures/import/fineco.csv
    - tests/import-utils.test.ts
    - tests/import-detector.test.ts
    - tests/seed-extras-steps.test.ts

key-decisions:
  - "Orchestrator override (locked): Fineco's DB headerSignature is the full 8-column raw Moneymap header (Data_Operazione;Data_Valuta;Entrate;Uscite;Descrizione;Descrizione_Completa;Stato;Moneymap), stored as an explicit headerSignature field on the seed-data.ts entry — NOT the derived 4-column join every other platform uses. headerSignatureFor() in seed.ts and ensure-fineco-moneymap-global-format both check this explicit field first, falling back to the derived join for every other platform unchanged."
  - "secondaryDescriptionColumn ('Descrizione') is set only in the ensure-fineco-moneymap-global-format seed-extras step, not in seed-data.ts — seed.ts's resolvedFormats mapping never forwards this field for any platform (Satispay precedent), so adding it to seed-data.ts would be silently dropped on fresh installs."
  - "mergeDuplicateFinecoPlatforms uses typed drizzle-orm operators (ilike/like/or/ne) for the duplicate-match predicate instead of a raw sql template — functionally identical to the plan's suggested raw-sql mirror of patConflictDelete, but type-safe or shorter; the plan's DELETE for obsolete import_format_version rows still stays inline (not a shared helper), consistent with the ensureTradeRepublicCsvGlobalFormat precedent."

requirements-completed: [FINECO-CLEANUP-260728-mpo]

coverage:
  - id: D1
    description: "scripts/seed-data.ts Fineco v1 entry uses the ;-delimited Moneymap contract (Data_Operazione timestamp column) plus an explicit full-header headerSignature override"
    requirement: FINECO-CLEANUP-260728-mpo
    verification:
      - kind: unit
        ref: "tests/import-hash-contract.test.ts#fineco.csv: all row hashes match static literals"
        status: pass
      - kind: unit
        ref: "tests/import-detector.test.ts#tracks fineco.csv with its seeded header signature"
        status: pass
    human_judgment: false
  - id: D2
    description: "seed-extras STEPS registry contains merge-duplicate-fineco-platforms immediately followed (ordered) by ensure-fineco-moneymap-global-format, the latter last in the array"
    requirement: FINECO-CLEANUP-260728-mpo
    verification:
      - kind: unit
        ref: "tests/seed-extras-steps.test.ts#registers both Fineco cleanup steps, merge before consolidate (D-01 before D-02)"
        status: pass
      - kind: unit
        ref: "tests/seed-extras-steps.test.ts#registers ensure-fineco-moneymap-global-format LAST (append-only invariant)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Running the two new steps against a database with duplicate Fineco platforms/formats converges to exactly one fineco platform row, one active global approved import_format_version, and zero file rows pointing at a deleted format — including file FK reassignment before hard-delete"
    requirement: FINECO-CLEANUP-260728-mpo
    verification: []
    human_judgment: true
    rationale: "No live database is available in this execution environment (operator-run admin script against staging/production, per the task's own threat model and success criteria — this repo's seed-extras-steps.test.ts precedent only asserts registry shape/order, never runs steps against a live DB). Code-level idempotency and ordering are verified by unit tests (D1/D2); actual convergence against production data requires the operator run documented below."

duration: ~20min
completed: 2026-07-28
status: complete
---

# Quick Task 260728-mpo: Fineco platform + format cleanup Summary

**Migrated the canonical Fineco import contract to the Moneymap `;`-delimited format (with an explicit full-header `headerSignature` override) and added two idempotent seed-extras STEPS that merge duplicate Fineco platforms and consolidate every Fineco format version onto one global approved row, reassigning `file` FKs before hard-deleting the rest.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- `scripts/seed-data.ts` Fineco v1 entry now carries the real Moneymap contract (`delimiter: ";"`, `timestampColumn: "Data_Operazione"`) plus an explicit `headerSignature` override field (the full 8-column raw header) for fresh installs.
- `scripts/seed.ts`'s `headerSignatureFor()` checks that explicit override first, falling back to the existing derived required-columns join for every other platform — zero behavior change elsewhere.
- New `merge-duplicate-fineco-platforms` seed-extras STEP (D-01): reassigns every `import_format_version` row off any wizard-minted duplicate Fineco platform (`name ILIKE 'Fineco%' OR slug LIKE 'fineco-%'`) onto the canonical `slug = 'fineco'` platform, then hard-deletes the duplicate platform rows.
- New `ensure-fineco-moneymap-global-format` seed-extras STEP (D-02/D-03): upserts the single GLOBAL approved Moneymap format on the (now-consolidated) Fineco platform, reassigns any `file.importFormatVersionId` pointing at a to-be-deleted format onto the kept row, then hard-deletes every other Fineco format version. Both reassignment and delete run on every invocation (not gated on the insert/update branch), so a stale row from a prior partial run is still cleaned up.
- Registered in `STEPS` in dependency order (`merge-duplicate-fineco-platforms` before `ensure-fineco-moneymap-global-format`, the latter now last in the array).
- Test fixtures/assertions synced to the new `;`-delimited 4-column Fineco contract: `tests/fixtures/import/fineco.csv`, `tests/import-utils.test.ts`, `tests/import-detector.test.ts`, `tests/seed-extras-steps.test.ts`.

## Task Commits

1. **Task 1: Update canonical Fineco contract in seed-data.ts + sync test fixtures** - `8ba906c` (feat)
2. **Task 2: Add seed-extras STEPS to merge duplicate Fineco platforms and consolidate the global format** - `e31dd9b` (feat)

## Files Created/Modified

- `scripts/seed-data.ts` - Fineco v1 entry migrated to `;`-delimited Moneymap contract; new `ImportFormatVersionSeed` type with optional `headerSignature` override field
- `scripts/seed.ts` - `headerSignatureFor()` checks the explicit override before deriving
- `scripts/seed-extras.ts` - two new STEPS: `mergeDuplicateFinecoPlatforms`, `ensureFinecoMoneymapGlobalFormat`
- `tests/fixtures/import/fineco.csv` - header/rows re-delimited to `;`, `Data` → `Data_Operazione`
- `tests/import-utils.test.ts` - fixture-content assertions updated to `;`-joined literals
- `tests/import-detector.test.ts` - `expectedFixtureHeaders` entry for `fineco.csv` updated
- `tests/seed-extras-steps.test.ts` - registry order/last-step assertions updated for the two new steps

## Decisions Made

- **Orchestrator header-signature override honored over the PLAN.md-flagged assumption.** The plan's Task 2 action text originally proposed the derived 4-column join (`Data_Operazione;Descrizione_Completa;Entrate;Uscite`) for `headerSignature`, flagging this as a discretionary call versus the literal 8-column header CONTEXT.md provided. The orchestrator locked the literal 8-column header as the answer; implemented via an explicit optional `headerSignature` field on the seed-data entry, consumed by both `headerSignatureFor()` (seed.ts) and `ensureFinecoMoneymapGlobalFormat` (seed-extras.ts), falling back to the derived join for every other platform (zero behavior change elsewhere).
- **`secondaryDescriptionColumn` stays out of seed-data.ts**, set only via the seed-extras step — matches the existing Satispay precedent (`setSatispaySecondaryDescriptionColumn`), since `seed.ts`'s `resolvedFormats` mapping never forwards this field from seed-data for any platform.
- **Duplicate-platform predicate uses typed `drizzle-orm` operators** (`ilike`/`like`/`or`/`ne`) rather than a raw `sql` template — the plan suggested mirroring the file's existing raw-`sql` `patConflictDelete` pattern, but a plain `ILIKE`/`LIKE` `OR` condition has first-class typed operators available and needs no raw SQL; behavior and safety are identical.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 4 pattern, pre-resolved by orchestrator — not a deviation requiring a stop] headerSignature contract**
- **Found during:** Task 2 planning (already flagged by PLAN.md's own Objective section)
- **Issue:** PLAN.md's Task 2 action text specified the derived 4-column join for `headerSignature`, while CONTEXT.md's decision block specified the full 8-column raw header — PLAN.md explicitly flagged this ambiguity for review rather than silently resolving it.
- **Resolution:** Orchestrator instructions locked the literal 8-column header as the answer (superseding PLAN.md's derived-join implementation) before execution began, so no in-flight architectural decision was required — implemented directly per the orchestrator's explicit instructions (see `## Decisions Made` above).
- **Files modified:** `scripts/seed-data.ts`, `scripts/seed.ts`, `scripts/seed-extras.ts`
- **Verification:** `tests/import-detector.test.ts`, `tests/import-hash-contract.test.ts` pass; full suite (1838 tests) green.
- **Committed in:** `8ba906c`, `e31dd9b`

---

**Total deviations:** 0 auto-fixed (Rules 1–3); 1 pre-resolved ambiguity (orchestrator override, not an in-flight Rule 4 stop).
**Impact on plan:** No scope creep — the override only changed which string is stored as `headerSignature`; all other columns, ordering, idempotency guards, and file-reassignment-before-delete sequencing match PLAN.md exactly.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Operator Next Step

**This plan changes code only — no task connects to a live database.** For the cleanup to take effect against real data:

1. Run `yarn db:seed-extras:staging` first and inspect the console logs (`merge-duplicate-fineco-platforms` / `ensure-fineco-moneymap-global-format` — both log every reassignment/deletion count for audit, per the plan's threat model T-260728-mpo-01/02).
2. Confirm on staging: exactly one `fineco` platform row, exactly one active `import_format_version` row on it (global, approved, Moneymap contract, `secondaryDescriptionColumn = 'Descrizione'`), and zero `file` rows pointing at a deleted format.
3. Run `yarn db:seed-extras:production` with `PRODUCTION_MIGRATION_CONFIRM` set.
4. No new migration, `yarn db:seed`, or `yarn db:seed-patterns` run is required — this is purely the two additive seed-extras STEPS plus the `seed-data.ts` contract correction they both consume.

## Next Phase Readiness

- No blockers. The Fineco platform/format duplication cleanup is code-complete and unit-tested; it only needs the operator run above to take effect on real data.
- Any future platform needing full-raw-header detection (rather than the derived required-columns join) can reuse the same `headerSignature` override field on `ImportFormatVersionSeed` — no further scaffolding needed.

---
*Phase: 260728-mpo*
*Completed: 2026-07-28*
