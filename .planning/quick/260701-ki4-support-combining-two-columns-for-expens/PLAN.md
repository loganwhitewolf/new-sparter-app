---
quick_id: 260701-ki4
slug: support-combining-two-columns-for-expens
type: quick
autonomous: true
files_modified:
  - lib/db/schema.ts
  - drizzle/migrations/          # new generated SQL migration
  - lib/utils/import.ts
  - lib/dal/import-formats.ts
  - lib/validations/import.ts
  - lib/services/import-format-wizard.ts
  - components/import/import-format-wizard.tsx
  - scripts/seed-extras.ts
  - tests/import-utils.test.ts
must_haves:
  truths:
    - A format version may declare a nullable secondary description column; when set and the row's secondary value is non-empty and differs from primary, the imported description is `Primary — @secondary`.
    - Two Satispay rows sharing `Nome` "Federico P." but differing `@username` produce distinct descriptionHash values (distinct expenses) on future imports.
    - Rows with an empty secondary value (shops) keep primary-only description — behaviour unchanged.
    - The secondary column is optional everywhere: not required by the detector, not in requiredColumns, nullable in the wizard.
  artifacts:
    - New nullable column `secondary_description_column` on `import_format_version`.
    - New generated SQL migration (ADD COLUMN, nullable, no backfill).
    - seed-extras STEP setting Satispay active format version secondary column to 'Descrizione'.
  key_links:
    - normalizeTransactionRow composes the combined string BEFORE normalizedDescription / descriptionHash / transactionHash derive from it (single code path).
    - DAL selects the new column and threads it into the platform config consumed by normalizeTransactionRow (via object spread in import.ts and import-format-detector.ts — no manual threading needed).
---

<objective>
Add a generic, nullable `secondaryDescriptionColumn` to the import-format parsing contract so import can compose the expense description as `Primary — @secondary` (em dash, space-padded) when the secondary value is present. This disambiguates Satispay person-to-person payments (two "Federico P." with different `@usernames`) in both the expense title and the `descriptionHash`-based grouping. Opt-in per format, reusable beyond Satispay. Future imports only — no backfill.

Purpose: Distinct people currently collapse into one expense because `descriptionHash` derives from a single `Nome` column; the `@username` in `Descrizione` disambiguates them.
Output: schema column + migration, compose logic, DAL/validation/wizard/seed threading, and a unit assertion that the combined description yields distinct hashes.
</objective>

<context>
@CLAUDE.md
@.planning/quick/260701-ki4-support-combining-two-columns-for-expens/CONTEXT.md
@lib/utils/import.ts
@lib/dal/import-formats.ts
@lib/services/import.ts
@lib/services/import-format-detector.ts
@lib/validations/import.ts
@lib/services/import-format-wizard.ts
@components/import/import-format-wizard.tsx
@scripts/seed-extras.ts
@scripts/seed-data.ts
@tests/import-utils.test.ts
</context>

<execution_notes>
- All locked decisions live in CONTEXT.md — do not re-open the mechanism, the compose format, or the "future imports only" hash policy.
- Threading note (verified against source): `lib/services/import.ts` (`deriveFullFileImportStats`) and `lib/services/import-format-detector.ts` (`buildPreview`) both pass the platform config via object spread `{ ...platform, platformId }`. Because the DAL populates the new field on that object, NO manual threading change is needed in either file. The only threading work is in the DAL projection/type/guard/mapper.
- The em dash `—` in the compose template is code punctuation, not a developer-facing Italian string; `yarn check:language` should not flag it. If it does, keep the em dash (it is the locked separator) and address the checker's mechanism per its rules.
- No `typecheck` script exists — use `npx tsc --noEmit` for a fast type gate; `yarn build` is the comprehensive gate.
- Migration/seed run order (operator step, requires a live DB, NOT part of automated verify): `yarn db:migrate && yarn db:seed && yarn db:seed-extras`.
</execution_notes>

<tasks>

<task type="auto">
  <name>Task 1: Schema column + generated migration</name>
  <files>lib/db/schema.ts, drizzle/migrations/ (generated)</files>
  <action>
    In `lib/db/schema.ts`, in the `importFormatVersion` pgTable (around line 297, alongside `descriptionColumn`), add a nullable column:
    `secondaryDescriptionColumn: varchar("secondary_description_column", { length: 120 }),`
    Place it directly after the `descriptionColumn` line so the parsing-contract columns stay grouped. It must be nullable (no `.notNull()`, no default) — opt-in per format, no data backfill.
    Then generate the SQL migration with `yarn db:generate` (drizzle-kit generate). Do NOT run `drizzle-kit push`. Confirm the generated file under `drizzle/migrations/` contains a single `ALTER TABLE ... ADD COLUMN "secondary_description_column" varchar(120);` (nullable, no NOT NULL, no backfill/UPDATE).
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
    Also: `yarn db:generate` produces a new migration; grep the newest file in `drizzle/migrations/` for `secondary_description_column` and confirm it is a nullable ADD COLUMN with no NOT NULL clause.
  </verify>
  <done>Nullable `secondary_description_column` exists on `importFormatVersion` in schema; a new generated migration adds it as a nullable column with no backfill; typecheck passes.</done>
</task>

<task type="auto">
  <name>Task 2: Config type + compose logic in normalizeTransactionRow</name>
  <files>lib/utils/import.ts</files>
  <action>
    1. Add an optional field to the `ImportPlatformConfig` type (after `descriptionColumn`): `secondaryDescriptionColumn?: string | null`. Optional so existing call sites that omit it still compile.
    2. In `normalizeTransactionRow`, the primary `description` is currently a `const` computed from `descriptionColumn` with the strip pattern applied (the two lines: rawDescription, then description). Change that `const description` binding to `let description` so it can be augmented.
    3. Immediately after the primary `description` is computed and BEFORE `const normalizedDescription = normalizeDescription(description)`, insert the compose block: when `platform.secondaryDescriptionColumn` is set, read `secondary = String(row[platform.secondaryDescriptionColumn] ?? '').trim()`; if `secondary` is non-empty AND `secondary !== description`, reassign `description = `${description} — ${secondary}``. Use the em dash `—` with a single space on each side. Apply the strip pattern to the primary column only (unchanged) — do NOT strip the secondary.
    4. Leave `normalizedDescription`, `descriptionHash`, and `transactionHash` computations untouched — they already derive from `description`, so the combined string flows through the single existing code path. `rawRow` already preserves the untouched source row via `cleanRawRow`.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>`ImportPlatformConfig` carries optional `secondaryDescriptionColumn`; `normalizeTransactionRow` composes `Primary — @secondary` when the secondary value is present and differs from primary, and all downstream hashes derive from the combined string; typecheck passes.</done>
</task>

<task type="auto">
  <name>Task 3: DAL projection/type/guard/mapper + detector guard</name>
  <files>lib/dal/import-formats.ts, lib/services/import-format-detector.ts</files>
  <action>
    In `lib/dal/import-formats.ts`:
    1. Add `secondaryDescriptionColumn: string | null` to the `ImportFormatRow` type, in the "Parsing contract fields (ADR 0013)" group next to `descriptionColumn`.
    2. In `hasExpectedRowShape`, add a fail-closed check: `(typeof row.secondaryDescriptionColumn === 'string' || row.secondaryDescriptionColumn === null)`.
    3. In the `.select({...})` projection inside `loadImportFormatsForDetection`, add `secondaryDescriptionColumn: importFormatVersion.secondaryDescriptionColumn,` in the contract-columns group.
    4. In `toCandidate`, add `secondaryDescriptionColumn: row.secondaryDescriptionColumn,` inside the `platform: { ... }` object (contract group), so the value reaches the `ImportPlatformConfig` consumed by `normalizeTransactionRow`.

    In `lib/services/import-format-detector.ts`:
    5. GUARD (verify, likely no code change): confirm `requiredColumns(format)` does NOT include `secondaryDescriptionColumn` and `scoreCandidate` does not reference it — the secondary column must never be required for a format match nor affect confidence. It is currently absent from both; leave it absent. Add no logic that treats it as required.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
    Also: `grep -n secondaryDescriptionColumn lib/services/import-format-detector.ts` returns no match in `requiredColumns`/`scoreCandidate` (guard: secondary stays optional).
  </verify>
  <done>DAL selects, shape-guards, types, and maps the new column into the platform config; the detector still treats it as optional (not in requiredColumns, not scored); typecheck passes.</done>
</task>

<task type="auto">
  <name>Task 4: Validation schema + wizard service persistence</name>
  <files>lib/validations/import.ts, lib/services/import-format-wizard.ts</files>
  <action>
    In `lib/validations/import.ts`:
    1. Add `secondaryDescriptionColumn: OptionalImportFormatWizardColumnSchema,` to the `CreatePrivateImportFormatSchema` object (next to `descriptionColumn`). Reuse the existing `OptionalImportFormatWizardColumnSchema` (empty string preprocesses to `undefined`; trims; max 120) — it is optional and nullable, NOT required. Do not add it to `superRefine` requirements.
    2. In `getPrivateImportFormatColumnValidationError`, validate the secondary column exists in headers ONLY when provided: if `input.secondaryDescriptionColumn` is a non-empty string, include it in the existence check (append to the checked-columns list). It must remain optional — never add it to the required set that triggers "missing column" when absent.

    In `lib/services/import-format-wizard.ts`:
    3. In `createPrivateRows`, in the `importFormatVersion` insert `.values({...})` block (parsing-contract group, next to `descriptionColumn`), add `secondaryDescriptionColumn: input.secondaryDescriptionColumn ?? null,`. `input` is `CreatePrivateImportFormatInput & {...}`, so the field flows from the parsed schema. Persist `null` when omitted.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
    Also run the validation + wizard-action suites: `yarn test lib/validations/__tests__/import.test.ts tests/import-format-wizard-actions.test.ts`.
  </verify>
  <done>The wizard schema accepts an optional `secondaryDescriptionColumn`; existence is validated only when provided; the wizard service persists it (null when omitted); validation and wizard-action tests pass.</done>
</task>

<task type="auto">
  <name>Task 5: Wizard UI — optional secondary column dropdown</name>
  <files>components/import/import-format-wizard.tsx</files>
  <action>
    Add an OPTIONAL secondary-description dropdown to the column-configuration step (Step 2), defaulting to a "none" choice. User-facing copy is Italian (product surface); identifiers/logic stay English.
    1. Add a sentinel constant near the top: `const NO_SECONDARY_VALUE = '__none__'` (shadcn `SelectItem` cannot have an empty-string value).
    2. Add controlled state: `const [secondaryDescriptionColumn, setSecondaryDescriptionColumn] = useState(NO_SECONDARY_VALUE)`.
    3. Add a hidden input inside the `<form>` (next to the `descriptionColumn` hidden input) whose value maps the sentinel back to empty string so the Zod optional preprocess yields `undefined`:
       `<input type="hidden" name="secondaryDescriptionColumn" value={secondaryDescriptionColumn === NO_SECONDARY_VALUE ? '' : secondaryDescriptionColumn} />`
    4. Add a `SelectField` in the column grid (after "Colonna descrizione") labelled `Colonna descrizione secondaria (opzionale)`, value `secondaryDescriptionColumn`, `onValueChange={setSecondaryDescriptionColumn}`, with options `[{ value: NO_SECONDARY_VALUE, label: 'Nessuna' }, ...headerSelectOptions]`, placeholder `Seleziona colonna…`. Use Italian copy such as a helper line noting it is combined as `Descrizione — secondaria` for person payments.
    5. Do NOT add it to `validateWizardFields` required checks or to the duplicate-column check — it is optional and independent. No change to `WizardFieldValues`/`readFormValues` is required (the hidden input is submitted directly and handled by Zod).
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
    Also: `yarn lint` passes for the changed component.
  </verify>
  <done>The wizard column step shows an optional "Colonna descrizione secondaria" dropdown defaulting to "Nessuna"; selecting a column submits it, "Nessuna" submits empty (→ undefined); typecheck and lint pass.</done>
</task>

<task type="auto">
  <name>Task 6: seed-extras STEP for Satispay format version</name>
  <files>scripts/seed-extras.ts</files>
  <action>
    Append an additive, idempotent STEP that sets `secondary_description_column = 'Descrizione'` on the existing active Satispay import format version — matched by platform slug. Do NOT edit `scripts/seed-data.ts` shapes (baseline insert already ran in prod).
    1. Extend the existing schema import to also bring in `importFormatVersion` and `platform` from `../lib/db/schema` (currently only categorization/category/expense/nature/subCategory are imported).
    2. Add an async step function (e.g. `setSatispaySecondaryDescriptionColumn(database: Db)`): resolve the Satispay platform id via `select({ id: platform.id }).from(platform).where(and(eq(platform.slug, 'satispay'), isNull(platform.proposedByUserId))).limit(1)`. If absent, log a skip and return. Otherwise `update(importFormatVersion).set({ secondaryDescriptionColumn: 'Descrizione' }).where(and(eq(importFormatVersion.platformId, satispayId), eq(importFormatVersion.isActive, true), isNull(importFormatVersion.ownerUserId)))`. Log the rowCount. The UPDATE is idempotent (re-running sets the same value). `'Descrizione'` is a bank CSV header value (product/domain surface), not a developer string.
    3. Register it in the `STEPS` array (append at the end, name e.g. `'set-satispay-secondary-description-column'`) — never reorder or delete existing steps.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
    Also: `grep -n "set-satispay-secondary-description-column" scripts/seed-extras.ts` appears in both the function/registry; `grep -n "importFormatVersion" scripts/seed-extras.ts` confirms the import was added.
  </verify>
  <done>A new idempotent seed-extras STEP updates the active global Satispay format version's secondary column to 'Descrizione', matched by slug; it is registered last in STEPS; typecheck passes.</done>
</task>

<task type="auto">
  <name>Task 7: Unit assertion + full verification gate</name>
  <files>tests/import-utils.test.ts</files>
  <action>
    Add a unit test to `tests/import-utils.test.ts` (inside the existing describe block) that proves the combined description produces distinct hashes for two rows sharing a primary but differing secondary, and that an empty secondary keeps primary-only. Mirror the platform-config object shape used by the existing `normalizeTransactionRow` tests (plain object literal, `amountType: 'single' as const`), adding `secondaryDescriptionColumn: 'Descrizione'`.
    Assertions:
    - Row A `{ Nome: 'Federico P.', Descrizione: '@federicopiazza82', Importo: '-50', Data: '2026-01-02' }` → `description === 'Federico P. — @federicopiazza82'`.
    - Row B `{ Nome: 'Federico P.', Descrizione: '@piseddu_f', Importo: '-16', Data: '2026-01-02' }` → `A.descriptionHash !== B.descriptionHash` (distinct expenses).
    - Shop row `{ Nome: '🏬 a un Negozio', Descrizione: '', Importo: '-8', Data: '2026-01-02' }` → `description === '🏬 a un Negozio'` (primary only; empty secondary ignored).
    - Config uses `descriptionColumn: 'Nome'`, `secondaryDescriptionColumn: 'Descrizione'`, `timestampColumn: 'Data'`, `amountColumn: 'Importo'`, `descriptionStripPattern: null`, `multiplyBy: 1`, positive/negative null.
    Use a plain ISO `Data: '2026-01-02'` (parses via parseBankDate) to keep the test focused on description composition, not date-format parsing.
  </action>
  <verify>
    <automated>yarn test tests/import-utils.test.ts</automated>
    Full gate (run all): `yarn test`, `npx tsc --noEmit`, `yarn lint`, `yarn check:language`. Optional comprehensive build gate: `yarn build`.
  </verify>
  <done>The new unit test asserts combined description, distinct hashes for differing secondary, and primary-only for empty secondary; full test suite, typecheck, lint, and language check pass.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` — no type errors across schema, import util, DAL, validations, wizard service, wizard UI, seed-extras, and test.
- `yarn test` — full vitest suite green, including the new combined-description assertion in `tests/import-utils.test.ts` and existing hash-contract / detector / wizard-action suites (regression: shop rows and single-column formats unchanged).
- `yarn lint` — clean.
- `yarn check:language` — clean (em dash and 'Descrizione'/'Nessuna' are code punctuation / product-domain surfaces, not developer Italian strings).
- `yarn db:generate` produced a nullable ADD COLUMN migration with no backfill.
- Operator step (manual, live DB — not CI): `yarn db:migrate && yarn db:seed && yarn db:seed-extras` applies the column and sets the Satispay secondary column. Future imports only; no backfill of existing expenses.
</verification>

<success_criteria>
- `import_format_version.secondary_description_column` exists (nullable) with a generated migration.
- `normalizeTransactionRow` composes `Primary — @secondary` only when the secondary value is present and differs from primary; hashes derive from the combined string via the single existing code path.
- Two Satispay "Federico P." rows with different `@usernames` hash to distinct `descriptionHash` (→ distinct expenses) on future imports; shop rows with empty secondary are unchanged.
- The secondary column is optional throughout: not required by the detector, not in `requiredColumns`, nullable in the wizard schema/UI/service.
- The Satispay active format version is set to `secondaryDescriptionColumn = 'Descrizione'` via an idempotent seed-extras step.
- Full verification gate (test/typecheck/lint/check:language) passes.
</success_criteria>

<output>
Atomic commits, one per task (schema+migration, compose logic, DAL/detector, validation+wizard-service, wizard UI, seed-extras, test). Update the quick task tracker/SUMMARY per the /gsd-quick workflow when execution completes.
</output>
