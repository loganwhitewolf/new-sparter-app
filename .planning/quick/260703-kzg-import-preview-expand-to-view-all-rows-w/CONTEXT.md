# Quick Task Context — Import preview: view all rows, filter by valid/duplicate/error

## Goal
In the import preview, let the user optionally **expand to see ALL the rows being
imported** (currently only ~10 shown) and **filter them by: Valide / Duplicate /
Errori** (+ Tutte). Improves confidence before committing an import.

## What the code does today (verified)
- Preview normalizes **all** parsed rows already: `deriveFullFileImportStats` /
  the loop at `lib/services/import.ts:149` iterates `input.parsed.rows` (up to
  `DEFAULT_MAX_ROWS = 10_000`) to compute aggregate stats. So per-row flags exist
  for every row at analyze time — exposing them is cheap (no re-normalization).
- BUT the displayed list is capped twice: the parser returns
  `sampleRows = rows.slice(0, sampleSize)` (`DEFAULT_SAMPLE_SIZE = 25`), the
  detector re-slices at `PREVIEW_SAMPLE_SIZE = 25`
  (`lib/services/import-format-detector.ts:103`), and `import.ts:294` maps those 25
  into the client `sampleRows` shape. The component
  `components/import/import-preview.tsx:181` then renders `.slice(0, 10)`.
- Each preview row already carries the needed flags:
  `{ rowIndex, description, amount, occurredAt, duplicate, valid, errors, warnings }`
  (`import.ts:294`). `duplicate` = `transactionHash` in `existingHashes` (global
  per-user dedup) or `repeatedInFileHashes`.
- Aggregate counts on the result: `rowCount`, `duplicateCount` exist
  (`import-preview.tsx:106`). Valid/error counts are derivable or should be added.

## Locked decisions (defaults, user-approved)
1. **Expose all rows**: the analyze/preview result returns **all** normalized
   preview rows up to `maxRows` (10k), not just 25. Reuse the existing all-rows
   normalization pass (do NOT normalize twice); emit per-row display records from
   it and compute `duplicate` with the existing logic (`import.ts:299`).
2. **Filters**: chips **Tutte / Valide / Duplicate / Errori** with per-bucket counts.
   Buckets: Errori = `!row.valid`; Duplicate = `row.duplicate` (and valid);
   Valide = `row.valid && !row.duplicate`. Warnings stay as an inline badge, not a
   separate filter.
3. **Expand UX**: list defaults collapsed to the first 10 (of the active filter);
   a "Mostra tutte (N)" toggle expands the full filtered list inside a scrollable
   max-height container. Keep it simple; windowing/virtualization only if needed.
4. **Payload**: sending up to 10k compact rows (~1–1.5 MB worst case) is acceptable;
   `maxRows` already bounds it. No pagination round-trips.

## Implementation shape
- **Server**: extend the analyze result to carry the full per-row list (either widen
  `sampleRows` to all rows or add a new `rows` field — planner picks; check the
  result type allow-list in `lib/validations/import.ts` (~227–239) and the
  `ImportPreview`/analyze result type). Add bucket counts (`validCount`,
  `errorCount`) alongside `duplicateCount` if not already present. Lift the
  `PREVIEW_SAMPLE_SIZE`/`sampleSize` cap for the returned preview list (keep
  `maxRows` as the hard bound). Source the per-row records from the existing
  all-rows stats pass in `import.ts` / `deriveFullFileImportStats`.
- **Client** (`components/import/import-preview.tsx`): filter chips with counts,
  collapsed-10 + "Mostra tutte (N)" expand, scrollable container. Reuse existing
  row rendering (description/amount/date + valid/duplicate/warning badges). Italian
  product copy.
- **Types/validations** (`lib/validations/import.ts`): update the analyze result
  schema/type for the full rows + bucket counts.

## Verification
- Unit test: the row partition (valid/duplicate/error) is correct; the analyze
  result returns all rows (not capped at 25) for a >25-row fixture.
- `yarn test`, `npx tsc --noEmit` (no `typecheck` script), `yarn lint`,
  `yarn check:language`.
- Pre-existing unrelated failures on main (suggestion-promote-form, transactions-dal,
  expense-actions, import-table-actions, overview-interactions) are NOT this task.

## Constraints
- Monetary display via existing helpers (`formatAbsoluteAmount`); never native math.
- Dev-facing code/strings English; Italian only for the user-facing preview copy.
- Layers: services/dal/actions; keep the analyze compute server-side.
- Do NOT change import dedup semantics or the commit path — this is preview-only.
