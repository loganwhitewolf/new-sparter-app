---
phase: 260729-fma
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/validations/import.ts
  - lib/actions/import.ts
  - lib/services/import.ts
  - components/import/import-preview.tsx
  - tests/import-service.test.ts
  - tests/import-preview-ui.test.tsx
autonomous: true
requirements:
  - EXCLUDE-IMPORT-PREVIEW-ROWS-260729-fma
must_haves:
  truths:
    - "User can mark a preview row Non importare and restore it without changing import mode or date range (D-action)."
    - "Exclusions are tracked by stable parse rowIndex, not UI list position (D-identity)."
    - "Excluding/restoring a row live-updates Righe trovate, Duplicati, period card, and bucket chip counts; excluded rows stay visible with Esclusa styling (D-preview)."
    - "Confirm sends excludedRowIndexes via FormData; ImportFileSchema validates; importFile skips those rowIndexes after import-mode filter and before hash dedup/insert (D-confirm)."
    - "Server never trusts a client-filtered row list — only an exclusion set applied to re-parsed normalized rows (D-confirm)."
  artifacts:
    - "lib/validations/import.ts — ImportFileSchema.excludedRowIndexes"
    - "lib/services/import.ts — skip excluded rowIndexes in importFile insert path"
    - "components/import/import-preview.tsx — DropdownMenu Non importare / Ripristina + FormData append"
    - "tests/import-service.test.ts + tests/import-preview-ui.test.tsx — server skip + UI FormData/counts"
  key_links:
    - "appendExcludedRowIndexes (or appendImportModeFields sibling) → confirmImportAction FormData.getAll('excludedRowIndexes') → ImportFileSchema → importFile"
    - "applyImportModeFilter then exclude-by-rowIndex Set then getDuplicateHashes / insert loop"
    - "Client preview subtracts excluded indexes from importable counts while keeping rows visible for restore"
---

<objective>
Let the user exclude specific import-preview rows from confirm ("Non importare") without changing date-range / import-mode filters, with undo and live preview updates.

Purpose: bank files include one-off rows the user does not want imported; mode/range filters are too coarse. Per-row exclusion (by stable `rowIndex`) is the precise override, matching the existing `importMode` FormData override pattern on this branch.

Output: Zod + action + `importFile` skip path; ImportPreview DropdownMenu CTA; tests for server skip and UI payload/counts.

**Branch constraint:** stay on `quick/260729-f21-import-mode-filters` — do not create a new branch.
</objective>

<execution_context>
@$HOME/.cursor/gsd-core/workflows/execute-plan.md
@$HOME/.cursor/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@CONTEXT.md
@.planning/quick/260729-fma-exclude-specific-import-preview-rows-fro/260729-fma-CONTEXT.md
@.planning/quick/260729-f21-import-mode-filters-from-last-platform-t/260729-f21-CONTEXT.md
@lib/validations/import.ts
@lib/actions/import.ts
@lib/services/import.ts
@components/import/import-preview.tsx
@components/ui/dropdown-menu.tsx
@tests/import-service.test.ts
@tests/import-preview-ui.test.tsx

**Locked decisions (CONTEXT.md — do not revisit):**
- D-action: ONLY "Non importare" + restore — no "Rendi valida", no force-import duplicates, no error-row editing
- D-identity: track exclusions by stable `rowIndex` from parse/preview
- D-preview: live update counts/chips/row visual state; excluded rows may remain visible for restore
- D-confirm: FormData `excludedRowIndexes` → Zod on `ImportFileSchema` → `importFile` skip after import-mode filter, before hash dedup/insert; never trust client-filtered row lists

**Discretion (implement, do not re-ask):**
- CTA: Badge cell opens `DropdownMenu` from `@/components/ui/dropdown-menu` (same pattern as transaction table menus). Item label "Non importare"; restore label "Ripristina".
- Excluded visual: Badge "Esclusa" + muted/strikethrough row text; restore via the same dropdown on that badge.
- Counts: subtract excluded rows from importable counts (Righe trovate, Duplicati, bucket chip numbers, period card span) while still listing excluded rows in the table under their original bucket (so they remain findable).
- FormData: `fd.append('excludedRowIndexes', String(rowIndex))` per index (mirror `counterpartIds` / `getAll` pattern). Empty set = omit or empty array — schema defaults to `[]`.
- Do not add `excludedRowIndexes` to `AnalyzeImportSchema` — exclusions are confirm-time client state only (analyze stays full-file + mode filter client-side).
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Schema + confirm + importFile skip by rowIndex</name>
  <files>lib/validations/import.ts, lib/actions/import.ts, lib/services/import.ts, tests/import-service.test.ts</files>
  <behavior>
    - ImportFileSchema accepts excludedRowIndexes as an array of positive ints (1-based rowIndex), default [] (D-confirm)
    - confirmImportAction reads formData.getAll('excludedRowIndexes') and passes the validated array to importFile (D-confirm)
    - importFile applies applyImportModeFilter first, then drops any normalized row whose rowIndex is in the excluded set, then runs getDuplicateHashes / insert on the remainder (D-confirm, D-identity)
    - An excluded valid unique row is not inserted; non-excluded siblings in the same mode window still import
    - Empty / omitted excludedRowIndexes preserves current importMode behavior unchanged
  </behavior>
  <action>
    1. Extend `ImportFileSchema` in `lib/validations/import.ts` with `excludedRowIndexes`: coerce FormData string entries to `z.array(z.coerce.number().int().positive()).default([])` (preprocess empty/missing to []). Do not add the field to `AnalyzeImportSchema` (confirm-only per discretion).
    2. In `confirmImportAction` (`lib/actions/import.ts`), add `excludedRowIndexes: formData.getAll('excludedRowIndexes')` to the raw parse object (same shape as `counterpartIds` in `createMultiRefundAction`). Pass `parsed.data.excludedRowIndexes` into `importFile`.
    3. Extend `importFile` input with `excludedRowIndexes?: number[]`. After `applyImportModeFilter` builds `filteredRows` / `modeStats`, build `excluded = new Set(input.excludedRowIndexes ?? [])` and filter out rows whose `rowIndex` is in that set before `rebuildStatsFromRows` / `getDuplicateHashes` / the insert loop — so hash dedup and inserts never see excluded indexes (D-confirm, D-identity). Persist file reference dates / counts from the post-exclusion set. Unknown indexes are ignored (no error).
    4. Add a focused `importFile` test in `tests/import-service.test.ts`: mode `all` (or from-last with null last date), three distinct valid rows, `excludedRowIndexes` containing the middle row's `rowIndex` — assert that row is absent from `insertTransactionBatch` and `importedCount` reflects the skip. Keep an empty-exclusion control path green.
  </action>
  <verify>
    <automated>yarn vitest run tests/import-service.test.ts -t "excludedRowIndexes|from-last mode skips" -x</automated>
  </verify>
  <done>Confirm path validates excludedRowIndexes and importFile skips those stable rowIndexes after mode filter and before hash dedup/insert (D-confirm, D-identity).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Preview Non importare / Ripristina + live counts + FormData</name>
  <files>components/import/import-preview.tsx, tests/import-preview-ui.test.tsx</files>
  <behavior>
    - Status Badge cell opens a DropdownMenu with Non importare for non-excluded rows; excluded rows show Esclusa badge and Ripristina (D-action) — no Rendi valida item anywhere
    - Exclusions stored in client state keyed by row.rowIndex; toggling does not change importMode / rangeStart / rangeEnd (D-identity, D-action)
    - Excluding/restoring immediately refreshes Righe trovate, Duplicati, Transazioni nel periodo, and bucket chip counts by subtracting excluded indexes from the mode-filtered importable set (D-preview)
    - Excluded rows remain visible in the table (muted/strikethrough + Esclusa) so restore stays one click away (D-preview)
    - handleConfirm appends each excluded index via FormData excludedRowIndexes alongside existing appendImportModeFields (D-confirm)
  </behavior>
  <action>
    1. In `components/import/import-preview.tsx`, add `useState` for `excludedRowIndexes: number[]` (or Set mirrored to array). Helpers `excludeRow(rowIndex)` / `restoreRow(rowIndex)`. Export a small `appendExcludedRowIndexes(fd, indexes)` next to `appendImportModeFields` for testability — append each index with `fd.append('excludedRowIndexes', String(i))`.
    2. Derive `importableRows` = mode-filtered rows whose `rowIndex` is not in the excluded set. Drive summary tiles (Righe trovate, Duplicati, period via `periodSpan(importableRows)`) and bucket chip counts from `importableRows`. Keep table source as mode-filtered rows (plus activeFilter on original valid/duplicate/error classification) so excluded rows stay listed; style excluded rows muted/strikethrough and replace status badges with Badge "Esclusa" + DropdownMenu Ripristina (D-preview).
    3. Wrap the status Badge cell in `DropdownMenu` / `DropdownMenuTrigger` (asChild on the badge or a compact button) / `DropdownMenuContent` / `DropdownMenuItem`: non-excluded → "Non importare" calls exclude; excluded → "Ripristina" calls restore. Do not add any other row actions (D-action). Reuse `@/components/ui/dropdown-menu` only.
    4. In `handleConfirm`, after `appendImportModeFields`, call `appendExcludedRowIndexes(fd, excludedRowIndexes)`.
    5. Extend `tests/import-preview-ui.test.tsx`: assert `appendExcludedRowIndexes` writes multiple FormData entries; assert excluding a row shrinks Righe trovate / bucket counts in rendered markup (or pure helper if DOM menu is mocked — follow existing DropdownMenu SSR stub pattern from other table-menu tests). Assert no Italian product string for a validate/force-valid action appears in the component module.
  </action>
  <verify>
    <automated>yarn vitest run tests/import-preview-ui.test.tsx tests/import-service.test.ts -t "excluded|appendImportMode|appendExcluded" -x</automated>
  </verify>
  <done>Preview offers only Non importare / Ripristina by rowIndex, live-updates importable counts, and confirm sends excludedRowIndexes with importMode fields (D-action, D-preview, D-confirm).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → confirmImportAction | Untrusted excludedRowIndexes ints cross into the write path |
| importFile → DB | Exclusion set chooses which of the caller's re-parsed rows are inserted |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-fma-01 | Tampering | confirmImportAction / ImportFileSchema | medium | mitigate | Zod-coerce positive ints only; server re-parses file and skips by rowIndex — never insert client-supplied transaction payloads |
| T-fma-02 | Tampering | excludedRowIndexes | low | mitigate | Unknown/out-of-range indexes are no-ops; exclusion can only shrink the insert set for the authenticated user's own file |
| T-fma-03 | Elevation of Privilege | importFile exclusion | low | accept | Cannot touch other users' data; session-scoped file ownership unchanged |
| T-fma-SC | Tampering | npm/pip/cargo installs | low | accept | No new packages in this plan |
</threat_model>

<verification>
- `yarn vitest run tests/import-service.test.ts tests/import-preview-ui.test.tsx`
- Executor smoke: on `/import/[fileId]/analyze`, exclude one Valida row → counts drop, row shows Esclusa; Ripristina restores; confirm does not insert that row while siblings import. Mode chips / range inputs unchanged by exclude.
</verification>

<success_criteria>
- D-action / D-identity / D-preview / D-confirm all observable end-to-end on branch `quick/260729-f21-import-mode-filters`
- No "Rendi valida" UI or schema path
- Hash dedup still runs on the post-mode, post-exclusion subset
</success_criteria>

## Source audit

| SOURCE | ID | Item | Plan | Status |
|--------|-----|------|------|--------|
| GOAL | — | Exclude specific preview rows from confirm without changing date range | 01 | COVERED |
| REQ | EXCLUDE-IMPORT-PREVIEW-ROWS-260729-fma | Quick task capability | 01 | COVERED |
| RESEARCH | — | N/A (quick, no research) | — | — |
| CONTEXT | D-action | Non importare + restore only | 01 Task 2 | COVERED |
| CONTEXT | D-identity | Stable rowIndex tracking | 01 Tasks 1–2 | COVERED |
| CONTEXT | D-preview | Live counts + visible excluded styling | 01 Task 2 | COVERED |
| CONTEXT | D-confirm | FormData → Zod → importFile skip before insert | 01 Task 1 | COVERED |

<output>
Create `.planning/quick/260729-fma-exclude-specific-import-preview-rows-fro/260729-fma-SUMMARY.md` when done
</output>
