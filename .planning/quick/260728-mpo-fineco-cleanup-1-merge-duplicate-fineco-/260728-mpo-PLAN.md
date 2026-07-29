---
phase: 260728-mpo
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/seed-data.ts
  - scripts/seed-extras.ts
  - tests/fixtures/import/fineco.csv
  - tests/import-utils.test.ts
  - tests/import-detector.test.ts
  - tests/seed-extras-steps.test.ts
autonomous: true
requirements: [FINECO-CLEANUP-260728-mpo]
must_haves:
  truths:
    - "The Fineco survivor platform (slug=fineco) has exactly one import_format_version row after seed-extras runs: global, approved, ownerUserId=null, isActive=true, carrying the ';'-delimited Moneymap contract (D-02)."
    - "Every platform row matching name ILIKE 'Fineco%' OR slug LIKE 'fineco-%' (excluding the survivor) is deleted, with its format versions merged onto the survivor first, not orphaned (D-01)."
    - "Every file row that pointed at a now-deleted Fineco import_format_version points at the kept format id instead (D-03)."
    - "Fresh installs (yarn db:seed) create the Fineco v1 format with the same parsing-contract columns (delimiter ';', Data_Operazione/Descrizione_Completa/Entrate/Uscite, date format, strip pattern) as the migrated production row — single source of truth in scripts/seed-data.ts."
    - "Re-running yarn db:seed-extras twice in a row is a no-op the second time (idempotent guards, no duplicate inserts, no errors)."
  artifacts:
    - "scripts/seed-data.ts — Fineco importFormatVersions v1 entry updated to the ';'-delimited Moneymap contract"
    - "scripts/seed-extras.ts — new steps merge-duplicate-fineco-platforms and ensure-fineco-moneymap-global-format appended to STEPS"
    - "tests/fixtures/import/fineco.csv — updated to the new ';'-delimited header/columns"
    - "tests/seed-extras-steps.test.ts — registry assertions cover the two new steps and their relative order"
  key_links:
    - "STEPS array order: merge-duplicate-fineco-platforms MUST run before ensure-fineco-moneymap-global-format — the latter assumes all Fineco format versions are already consolidated onto the survivor platform"
    - "ensure-fineco-moneymap-global-format derives its contract from scripts/seed-data.ts's importFormatVersions (platformSlug='fineco', version=1) — Task 1 (seed-data update) must land before Task 2 relies on it"
    - "file.importFormatVersionId reassignment (D-03) MUST run before the DELETE of obsolete import_format_version rows in ensure-fineco-moneymap-global-format, in that order, inside the same step"
---

<objective>
Clean up production Fineco platform/format duplication in two parts:

1. Merge every duplicate Fineco **platform** row (wizard-minted `fineco-<suffix>` slugs, or any
   `name ILIKE 'Fineco%'`) into the canonical seeded platform `slug = 'fineco'`, for all users.
2. Make the Moneymap `;`-delimited Fineco CSV contract the **single global approved**
   `import_format_version` on that platform — reassigning any `file` rows first, then hard-deleting
   every other Fineco format version — and update `scripts/seed-data.ts` so fresh installs seed the
   same contract (single source of truth).

Purpose: today's production DB has accumulated wizard-created duplicate Fineco platforms (from the
private-format-creation flow) and stale/private Fineco format versions with the old comma-delimited,
`Data`-column contract. This collapses both back to one canonical platform and one canonical,
Moneymap-compatible global format, per CONTEXT.md decisions 1–3 (D-01/D-02/D-03).

Output: two new idempotent `seed-extras` STEPS (`merge-duplicate-fineco-platforms`,
`ensure-fineco-moneymap-global-format`), an updated canonical Fineco contract in
`scripts/seed-data.ts`, and updated test fixtures/assertions so the test suite reflects the new
canonical contract. No Drizzle migration — this is data-only, per CLAUDE.md (seeds additive,
`seed-extras` for row updates, no `drizzle-kit push` in prod).

**Assumption flagged for review (not silently resolved):** CONTEXT.md's decision block gives the
*full real* Moneymap CSV header as the `header_signature` value
(`Data_Operazione;Data_Valuta;Entrate;Uscite;Descrizione;Descrizione_Completa;Stato;Moneymap`, 8
columns) but also says "mirror the TR CSV seed-extras pattern" — and the TR CSV precedent
(`ensureTradeRepublicCsvGlobalFormat`) actually stores the *derived* signature (a join of only the
required columns: timestamp/description/amount/positive/negative), not the full raw header, and
every other platform in `scripts/seed-data.ts` follows that same derived-join convention
uniformly (see `headerSignatureFor()` in `scripts/seed.ts`). Task 1/2 below follow the **derived**
convention (`Data_Operazione;Descrizione_Completa;Entrate;Uscite`, joined by `;`) for consistency
with every existing row and to keep `yarn db:seed` (fresh installs) byte-identical to the
seed-extras-migrated production row with zero special-casing. `headerSignature` only affects a 5%
weight "exact header" detection bonus (`lib/services/import-format-detector.ts` `signatureScore`) —
the 45%-weight required-columns match is unaffected either way, so real Moneymap exports (which
have all 8 columns) still detect at full confidence. If the literal 8-column string was intended
verbatim, flag it back before executing.
</objective>

<execution_context>
@$HOME/.cursor/gsd-core/workflows/execute-plan.md
@$HOME/.cursor/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/quick/260728-mpo-fineco-cleanup-1-merge-duplicate-fineco-/260728-mpo-CONTEXT.md

**Schema facts (lib/db/schema.ts):**
- `platform.slug` is unique; `platform` is never user-owned (ADR 0015) — `proposedByUserId` is
  provenance only, `reviewStatus` defaults `'approved'`.
- `importFormatVersion.platformId` → `platform.id` `onDelete: cascade`; unique constraint on
  `(platformId, version)`. `ownerUserId`/`visibility`/`reviewStatus` control global vs. private.
- `file.importFormatVersionId` → `importFormatVersion.id` `onDelete: set null` — this task
  reassigns it explicitly BEFORE delete (D-03) so files keep pointing at a live format instead of
  silently going null.
- **No other table references `platform.id` directly** (verified by grep) — only
  `importFormatVersion.platformId` does. So once every format version is moved off a duplicate
  platform, deleting that platform row is safe (its cascade has nothing left to cascade).

**Precedent to mirror (scripts/seed-extras.ts, `ensureTradeRepublicCsvGlobalFormat`):** guard by
looking up an existing GLOBAL row with a matching `headerSignature` first (update in place, no
duplicate insert); if absent, insert at the next free `(platformId, version)` slot via
`MAX(version)+1`. Same idempotency shape applies here.

**Current (stale) Fineco contract in scripts/seed-data.ts (`importFormatVersions`, `platformSlug:
'fineco'`, `version: 1`):** `delimiter: ","`, `descriptionColumn: "Descrizione_Completa"`,
`amountType: "separate"`, `amountColumn: null`, `positiveAmountColumn: "Entrate"`,
`negativeAmountColumn: "Uscite"`, `timestampColumn: "Data"`, `dateFormat: "DD/MM/YYYY"`,
`dateReplace: true`, `decimalReplace: false`, `multiplyBy: 1`,
`descriptionStripPattern: "\\s+Carta N\\..*$"`.

**Target Moneymap contract (D-02, locked):** `delimiter: ";"`, `descriptionColumn:
"Descrizione_Completa"`, `secondaryDescriptionColumn: "Descrizione"`, `amountType: "separate"`,
`amountColumn: null`, `positiveAmountColumn: "Entrate"`, `negativeAmountColumn: "Uscite"`,
`timestampColumn: "Data_Operazione"`, `dateFormat: "DD/MM/YYYY"`, `dateReplace: true`,
`decimalReplace: false`, `multiplyBy: 1`, `descriptionStripPattern: "\\s+Carta N\\..*$"` (unchanged),
target row: `visibility: 'global'`, `reviewStatus: 'approved'`, `ownerUserId: null`, `isActive: true`.

Note on `secondaryDescriptionColumn`: `scripts/seed.ts`'s `resolvedFormats` mapping (the fresh-install
`yarn db:seed` loop) does NOT forward `secondaryDescriptionColumn` from `seed-data.ts` for ANY
platform today — Satispay's `secondaryDescriptionColumn` is set exclusively via its own seed-extras
step (`setSatispaySecondaryDescriptionColumn`), never via `seed-data.ts`/`seed.ts`. Follow that exact
precedent for Fineco: do NOT add `secondaryDescriptionColumn` to the `seed-data.ts` entry (it would
be silently dropped by `seed.ts` and imply a fresh-install guarantee that doesn't exist for any other
platform either); set it directly in the `ensure-fineco-moneymap-global-format` step instead. Fresh
installs get it correctly via the documented `db:seed` → `db:seed-extras` run order (CLAUDE.md).

@scripts/seed-data.ts
@scripts/seed-extras.ts
@scripts/seed.ts
@tests/seed-extras-steps.test.ts
@tests/fixtures/import/fineco.csv
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update canonical Fineco contract in seed-data.ts + sync test fixtures</name>
  <files>scripts/seed-data.ts, tests/fixtures/import/fineco.csv, tests/import-utils.test.ts, tests/import-detector.test.ts</files>
  <action>
    In `scripts/seed-data.ts`, update the `importFormatVersions` array entry where `platformSlug ===
    'fineco'` and `version === 1` (per D-02): change `delimiter` from `","` to `";"`; change
    `timestampColumn` from `"Data"` to `"Data_Operazione"`; leave `descriptionColumn`
    (`"Descrizione_Completa"`), `amountType` (`"separate"`), `amountColumn` (`null`),
    `positiveAmountColumn` (`"Entrate"`), `negativeAmountColumn` (`"Uscite"`), `dateFormat`
    (`"DD/MM/YYYY"`), `dateReplace` (`true`), `decimalReplace` (`false`), `multiplyBy` (`1`), and
    `descriptionStripPattern` (`"\\s+Carta N\\..*$"`) unchanged — they already match D-02. Do NOT add
    a `secondaryDescriptionColumn` field to this object (see the Context section's precedent note —
    it is set via seed-extras only, matching Satispay). Update the `notes` string to describe the new
    Moneymap `;`-delimited contract and reference that `secondaryDescriptionColumn` is set via
    seed-extras. Add an inline comment above the entry (mirroring the existing Trade Republic
    comment style) explaining: version 1 was migrated from comma-delimited/`Data` to
    `;`-delimited/`Data_Operazione` to match Moneymap-exported Fineco CSVs, and that already-deployed
    rows are converged by the `merge-duplicate-fineco-platforms` + `ensure-fineco-moneymap-global-format`
    seed-extras steps (quick task 260728-mpo).

    Update `tests/fixtures/import/fineco.csv`: change the header row to
    `Data_Operazione;Descrizione_Completa;Entrate;Uscite` and re-delimit the three existing data rows
    with `;` instead of `,`, keeping the exact same values (dates, descriptions, amounts, and the
    duplicate row) so downstream hash-contract assertions keep pinning to the same values. Do not add
    any of the extra Moneymap-only header columns (`Data_Valuta`, `Descrizione`, `Stato`, `Moneymap`)
    — every other platform fixture in this directory carries only the required columns, not a full
    real export; stay consistent.

    In `tests/import-utils.test.ts`, update the test named `'keeps separate Fineco inflow/outflow
    columns available for amount parsing tests'` (around line 27): change the three `toContain(...)`
    assertions from comma-joined literals (`'Entrate,Uscite'`, `'ACCREDITO STIPENDIO,2500.00,'`,
    `'PAGAMENTO CARTA SUPERMERCATO,,12.34'`) to their `;`-joined equivalents (`'Entrate;Uscite'`,
    `'ACCREDITO STIPENDIO;2500.00;'`, `'PAGAMENTO CARTA SUPERMERCATO;;12.34'`). Do NOT touch the
    later test `'parses Fineco separate Entrate/Uscite columns...'` (around line 95) — it constructs
    its own literal row/config objects with `Data`/`Descrizione_Completa` and does not read the
    fixture file, so it is unaffected by this change and stays green as a general separate-amount-
    column regression test.

    In `tests/import-detector.test.ts`, update the `expectedFixtureHeaders` array entry
    `['fineco.csv', 'Data,Descrizione_Completa,Entrate,Uscite']` to
    `['fineco.csv', 'Data_Operazione;Descrizione_Completa;Entrate;Uscite']`. No other line in this
    file needs to change — the `formats` array is built dynamically from `seed-data.ts`'s
    `importFormatVersions`/`platforms`, so it already picks up the new delimiter/columns
    automatically once Task 1's `seed-data.ts` edit lands.
  </action>
  <verify>
    <automated>npx vitest run tests/import-utils.test.ts tests/import-detector.test.ts tests/import-hash-contract.test.ts</automated>
  </verify>
  <done>All three test files pass; `tests/import-hash-contract.test.ts`'s Fineco row hashes are unchanged (same literal expectations) because the underlying date/description/amount values are identical — only column names and delimiter changed.</done>
</task>

<task type="auto">
  <name>Task 2: Add seed-extras STEPS to merge duplicate Fineco platforms and consolidate the global format</name>
  <files>scripts/seed-extras.ts, tests/seed-extras-steps.test.ts</files>
  <action>
    In `scripts/seed-extras.ts`, add two new step functions (placed after `reorganizeLeisureSubcategories`,
    before the `STEPS` registry array), and register them in `STEPS` in this exact order — merge
    first, then consolidate — because the second step assumes all Fineco format versions already
    live on the survivor platform:

    **Step A — `mergeDuplicateFinecoPlatforms(database: Db)`** (D-01): Resolve the survivor platform
    id via `eq(platform.slug, 'fineco')`; if absent, log and return (no-op — matches every other
    step's "target absent" guard style). Select every OTHER platform row whose `name ILIKE 'Fineco%'`
    OR `slug LIKE 'fineco-%'`, excluding the survivor id — use a single raw `sql` predicate passed to
    `.where()` (the `sql` template tag is already imported), e.g. combining both conditions with `OR`
    and excluding the survivor id with `AND`, mirroring the existing raw-`sql` usage pattern already
    in this file (`patConflictDelete` in `reorganizeSpesaSubcategories`). If none found, log and
    return. For each duplicate platform found: select its `import_format_version` rows by
    `platformId`; for each such row, compute the next free version on the survivor platform (same
    `MAX(version)+1` query pattern as `ensureTradeRepublicCsvGlobalFormat`, re-queried per row to
    avoid unique-constraint collisions since multiple rows may move), then `UPDATE
    import_format_version SET platform_id = survivorId, version = nextFreeVersion WHERE id =
    <that row's id>`. After all of a duplicate's format versions are moved, log the count. Once every
    duplicate has been processed, hard-delete all duplicate platform rows in one
    `DELETE ... WHERE id IN (duplicateIds)` (safe: their format versions were all reassigned away
    first, so the `onDelete: cascade` FK has nothing left to cascade). Log the deleted row count.

    **Step B — `ensureFinecoMoneymapGlobalFormat(database: Db)`** (D-02/D-03): Look up the Fineco
    seed contract via `seedFormatVersions.find(fv => fv.platformSlug === 'fineco' && fv.version ===
    1)` (the already-imported `seedFormatVersions` binding, i.e. `importFormatVersions` from
    `./seed-data`); if absent, log and return. Compute `headerSignature` by mirroring
    `headerSignatureFor()` from `scripts/seed.ts` inline (same as `ensureTradeRepublicCsvGlobalFormat`
    already does): join `[timestampColumn, descriptionColumn, amountColumn, positiveAmountColumn,
    negativeAmountColumn].filter(Boolean)` with the seed's `delimiter` — this yields
    `"Data_Operazione;Descrizione_Completa;Entrate;Uscite"` once Task 1 lands (see the Objective
    section's flagged assumption about the derived vs. literal-8-column signature). Resolve the
    (now-consolidated, per Step A) Fineco `platformId` via `eq(platform.slug, 'fineco')`; if absent,
    log and return.

    Look for an existing GLOBAL row (`platformId` = resolved id, `ownerUserId IS NULL`,
    `headerSignature` = computed signature) — same guard shape as
    `ensureTradeRepublicCsvGlobalFormat`. If found: `UPDATE` that row's id in place, setting
    `visibility: 'global'`, `reviewStatus: 'approved'`, `ownerUserId: null`, `isActive: true`, and
    every parsing-contract column (`delimiter`, `descriptionColumn`, `secondaryDescriptionColumn:
    'Descrizione'`, `amountType`, `amountColumn`, `positiveAmountColumn`, `negativeAmountColumn`,
    `timestampColumn`, `dateFormat`, `dateReplace`, `decimalReplace`, `multiplyBy`,
    `descriptionStripPattern`, `notes`) from the seed contract — this makes the step idempotent AND
    self-healing if a previous partial run left it half-updated. Track this row's id as
    `keptFormatId`. If NOT found: compute the next free version via the same `MAX(version)+1` pattern,
    then `INSERT` a new `import_format_version` row with `platformId`, `ownerUserId: null`,
    `visibility: 'global'`, `reviewStatus: 'approved'`, `version: nextFreeVersion`, `headerSignature`,
    `isActive: true`, `secondaryDescriptionColumn: 'Descrizione'`, and the same contract columns as
    above, `.returning({ id: ... })` to get `keptFormatId`.

    Then (D-03, order matters): `UPDATE file SET import_format_version_id = keptFormatId WHERE
    import_format_version_id IN (SELECT id FROM import_format_version WHERE platform_id =
    <resolved platformId> AND id != keptFormatId)` — use `database.execute(sql\`...\`)` the same way
    `v2BackfillOverrideNatureId` does for a raw multi-table UPDATE. Log the reassigned row count.
    Finally, hard-delete every other Fineco format version: `DELETE FROM import_format_version WHERE
    platform_id = <resolved platformId> AND id != keptFormatId`. Log the deleted row count. Both the
    reassignment and the delete must run in this order, every time the step runs (not gated on the
    branch taken above), so a stale/duplicate format left over from a previous partial run is still
    cleaned up.

    Register both in the `STEPS` array, appended at the end (after `reorganize-leisure-subcategories`):
    `{ name: 'merge-duplicate-fineco-platforms', run: mergeDuplicateFinecoPlatforms }` then
    `{ name: 'ensure-fineco-moneymap-global-format', run: ensureFinecoMoneymapGlobalFormat }`, in that
    order (merge must run first).

    In `tests/seed-extras-steps.test.ts`: change the existing test `'registers
    reorganize-leisure-subcategories LAST (append-only invariant)'` — it currently asserts
    `STEP_NAMES.indexOf('reorganize-leisure-subcategories')` equals `STEP_NAMES.length - 1`, which is
    no longer true. Rename/rewrite it to assert
    `STEP_NAMES.indexOf('reorganize-leisure-subcategories')` is still greater than
    `STEP_NAMES.indexOf('vacanze-audit-deactivate-subcategories')` (keep that half of the existing
    assertion) but drop the "LAST" claim for this step. Add two new tests: one asserting both new
    step names are present in `STEP_NAMES` and that
    `STEP_NAMES.indexOf('merge-duplicate-fineco-platforms')` is less than
    `STEP_NAMES.indexOf('ensure-fineco-moneymap-global-format')` (dependency order, D-01 before D-02);
    another asserting `STEP_NAMES.indexOf('ensure-fineco-moneymap-global-format')` equals
    `STEP_NAMES.length - 1` (this step is LAST now, preserving the append-only-LAST-step convention
    this test file already uses for each successive addition).
  </action>
  <verify>
    <automated>npx vitest run tests/seed-extras-steps.test.ts</automated>
  </verify>
  <done>STEP_NAMES contains both new steps in the correct relative order; ensure-fineco-moneymap-global-format is last; all existing seed-extras-steps.test.ts assertions still pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Operator shell → `yarn db:seed-extras` | Operator-triggered admin script with direct DB credentials (`DATABASE_URL`/`PRODUCTION_DATABASE_URL`); no untrusted network input reaches these steps. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260728-mpo-01 | Tampering | `mergeDuplicateFinecoPlatforms` match predicate (`name ILIKE 'Fineco%' OR slug LIKE 'fineco-%'`) | medium | mitigate | Predicate is scoped to exactly the two patterns the wizard can produce (D-01) and always excludes the resolved survivor id; every reassigned format-version id and deleted platform id is logged (`console.log`) before/after each mutation for operator audit before the step is trusted in production. |
| T-260728-mpo-02 | Tampering | `ensureFinecoMoneymapGlobalFormat` hard-delete of obsolete `import_format_version` rows | high | mitigate | `file.importFormatVersionId` is reassigned to the kept row BEFORE the delete, in the same step, every run (not gated on the insert/update branch) — no `file` row can be left dangling or nulled via the `onDelete: set null` FK; delete is scoped to `platform_id = <fineco id> AND id != keptFormatId`, never a broader table-wide delete. |
| T-260728-mpo-03 | Tampering | Non-transactional multi-statement step (no explicit `db.transaction()` wrapper) | low | accept | Matches the existing `ensureTradeRepublicCsvGlobalFormat`/`v2*` precedent in this file — none of the other steps wrap in an explicit transaction. All guards are re-checked from scratch on every run (idempotent), so a partial failure only requires re-running `yarn db:seed-extras`; this is an operator-run one-off admin script, not concurrent user-facing code. |
</threat_model>

<verification>
Run, from the repo root:
- `npx vitest run tests/seed-extras-steps.test.ts tests/import-utils.test.ts tests/import-detector.test.ts tests/import-hash-contract.test.ts tests/import-format-wizard-actions.test.ts` — all green, including the untouched hash-contract regression (proves no transactionHash drift from the delimiter/column-name change).
- `npx tsc --noEmit` — no new type errors in `scripts/seed-data.ts`, `scripts/seed-extras.ts`, or the touched test files.
- `yarn check:language` — clean (all new dev-facing strings — log messages, comments — are English; the Fineco column names/notes are bank-header/product-domain values, matching the existing Satispay/Trade Republic precedent).

Manual sanity check to record in SUMMARY (do not attempt against production from this environment):
confirm the intended production run order once shipped is `yarn db:seed-extras` (staging first,
then production) — no new migration or `db:seed`/`db:seed-patterns` step is required, since this is
purely two additive seed-extras STEPS plus a seed-data.ts contract correction consumed by both.
</verification>

<success_criteria>
- `scripts/seed-data.ts` Fineco v1 entry uses the `;`-delimited Moneymap contract (`Data_Operazione`
  timestamp column), matching D-02.
- `scripts/seed-extras.ts` STEPS registry contains `merge-duplicate-fineco-platforms` immediately
  followed (not necessarily adjacent, but ordered) by `ensure-fineco-moneymap-global-format`, itself
  last in the array.
- Running the two new steps against a database with duplicate Fineco platforms/formats converges to:
  exactly one `fineco` platform row, exactly one active `import_format_version` row on it (global,
  approved, Moneymap contract), and zero `file` rows pointing at a deleted format.
- Re-running the same two steps a second time changes nothing (idempotent — verified by code
  inspection of the guard clauses, matching the existing `ensureTradeRepublicCsvGlobalFormat`
  idempotency shape; this repo's `seed-extras-steps.test.ts` precedent does not run steps against a
  live DB, only asserts registry shape/order, so no new DB-backed integration test is added here,
  consistent with every prior seed-extras step in this file).
- All existing tests continue to pass; the Fineco hash-contract regression pins are unchanged.
</success_criteria>

<output>
Create `.planning/quick/260728-mpo-fineco-cleanup-1-merge-duplicate-fineco-/260728-mpo-SUMMARY.md` when done, including an Operator Next Step calling out that `yarn db:seed-extras` must be run against staging then production for this cleanup to take effect (this plan changes code only; no plan task connects to a live database).
</output>
