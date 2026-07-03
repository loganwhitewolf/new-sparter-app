---
quick_id: 260703-kzg
slug: import-preview-expand-to-view-all-rows-w
branch: gsd/quick-import-preview-all-rows
type: quick
autonomous: true
files_modified:
  - lib/utils/import-preview-buckets.ts        # new — pure partition helper
  - lib/services/import.ts                     # emit all rows + bucket counts
  - components/import/import-preview.tsx        # filter chips + expand/collapse
  - tests/import-preview-buckets.test.ts        # new — helper unit test
  - tests/import-service.test.ts               # all-rows integration + assertion fix
---

<objective>
In the import preview, return ALL normalized rows (up to the existing `maxRows`
bound) instead of the ~10 currently shown, and let the user filter them with chips
(Tutte / Valide / Duplicate / Errori) that carry per-bucket counts. Default the list
collapsed to the first 10 of the active filter, with a "Mostra tutte (N)" toggle that
expands the full filtered list inside a scrollable container.

Preview-only. Do NOT touch dedup semantics, the commit path (`importFile`), the
persisted `duplicateCount`, or the detector's confidence-scoring `sampleRows`.

Purpose: give the user confidence about exactly what will be imported before confirming.
Output: a wider analyze payload (all rows + bucket counts), a filterable/expandable
preview table, and tests proving the partition is correct and the 25-row cap is lifted.
</objective>

<context>
Locked decisions live in @.planning/quick/260703-kzg-import-preview-expand-to-view-all-rows-w/CONTEXT.md — do not re-open them.

Source-of-truth findings (verified against code):
- The analyze result contract is the `ImportAnalysisResult` type in `lib/services/import.ts:35`.
  The action (`lib/actions/import.ts:301`) passes it straight to the client with NO
  allow-list re-mapping. CONTEXT's pointer to `lib/validations/import.ts` (~227–239)
  is a red herring — those lines are the import *sort* schema, unrelated to this payload.
- `deriveFullFileImportStats` (`lib/services/import.ts:131`) already normalizes EVERY
  parsed row (`parsed.rows`, which the parser hard-bounds at `DEFAULT_MAX_ROWS = 10_000`
  in `lib/services/import-parsers.ts:31`) and returns them as `normalizedRows`. In
  `analyzeFile`, this is `provisionalStats.normalizedRows` — the cheap all-rows source
  to expose. Do NOT normalize a second time; do NOT re-slice.
- Today `analyzeFile` builds `sampleRows` from `detected.preview.sampleRows`
  (`lib/services/import.ts:294`), which the detector caps at `PREVIEW_SAMPLE_SIZE = 25`
  (`lib/services/import-format-detector.ts:64,103,172`). That detector cap is ALSO used
  for confidence scoring (`scoreCandidate`) and `sampleValidity` — leave it alone. We
  only change where `analyzeFile` sources its client-facing rows from.
- Per-row `duplicate` is recomputed at `lib/services/import.ts:299` as
  `Boolean(hash && (existingHashes.has(hash) || provisionalStats.repeatedInFileHashes.has(hash)))`.
  `existingHashes` is computed at `import.ts:289` and is in scope for the mapping. Reuse
  this exact formula — it is the authoritative duplicate flag.
- Normalized rows carry `occurredAt: Date | null` — convert with `.toISOString()` for the
  client shape (`string | null`). Invalid rows have `transactionHash = null`, so
  `duplicate` is naturally `false` for them → they land in the Errori bucket. The three
  buckets partition the rows exactly (see below).
- The client shape intentionally omits `transactionHash` — keep it omitted (no hash leak).
- The "Duplicati" summary tile (`import-preview.tsx:107`) shows `result.duplicateCount`
  (the skipped-or-duplicate *import-impact* aggregate). This is a DIFFERENT number from the
  new "Duplicate" chip (rows that are `valid && duplicate`). Do NOT try to reconcile them;
  leave the tile and `duplicateCount` untouched.

Bucket partition (locked decision 2), mutually exclusive:
- Errori    = `!valid`
- Duplicate = `valid && duplicate`
- Valide    = `valid && !duplicate`
- Tutte     = all rows

@lib/services/import.ts
@components/import/import-preview.tsx
@tests/import-service.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Server — expose all preview rows + bucket counts (pure helper + type)</name>
  <files>lib/utils/import-preview-buckets.ts, lib/services/import.ts, tests/import-service.test.ts</files>
  <action>
Create `lib/utils/import-preview-buckets.ts` as a pure, dependency-free module (no
`server-only` — it is imported by both the service and the client component). Export:
- a `PreviewRowFlags` type = `{ valid: boolean; duplicate: boolean }`;
- `bucketOfPreviewRow(row: PreviewRowFlags): 'valid' | 'duplicate' | 'error'` implementing
  the partition (return `error` when `!valid`, else `duplicate` when `row.duplicate`, else `valid`);
- a `PreviewBucketCounts` type = `{ all: number; valid: number; duplicate: number; error: number }`;
- `countPreviewBuckets(rows: PreviewRowFlags[]): PreviewBucketCounts` — start `all` at
  `rows.length` and increment the bucket returned by `bucketOfPreviewRow` for each row.
All identifiers, types, and comments in English.

In `lib/services/import.ts`:
- Import `countPreviewBuckets` and `PreviewBucketCounts` from `@/lib/utils/import-preview-buckets`.
- Add an OPTIONAL field `previewBuckets?: PreviewBucketCounts` to the `ImportAnalysisResult`
  type. Keep it optional so no existing hand-built fixture breaks `npx tsc --noEmit`; the
  service always populates it.
- In `analyzeFile`, replace the `sampleRows` construction (currently `import.ts:294`,
  mapping `detected.preview.sampleRows`). Source the rows from the existing all-rows pass:
  - When `best` is present: map `provisionalStats.normalizedRows` into the client row shape
    `{ rowIndex, description, amount, occurredAt: occurredAt ? occurredAt.toISOString() : null,
    duplicate, valid, errors, warnings }`, computing `duplicate` with the EXACT formula from
    `import.ts:299` (`Boolean(hash && (existingHashes.has(hash) || provisionalStats.repeatedInFileHashes.has(hash)))`).
    `provisionalStats.normalizedRows` is already bounded by the parser's `DEFAULT_MAX_ROWS`,
    so it IS the hard-bounded full list — no extra slice, no `PREVIEW_SAMPLE_SIZE` cap.
  - When `best` is null (no format matched): preserve today's behavior — keep sourcing from
    `detected.preview.sampleRows` (invalid rows shown alongside the error alert). Its items
    already expose `occurredAt` as `string | null`.
- Compute `const previewBuckets = countPreviewBuckets(sampleRows)` and include both
  `sampleRows` and `previewBuckets` in the returned object. Do NOT change `rowCount`,
  `duplicateCount`, the persisted analysis state, or anything in `importFile`.

Fix the now-stale assertion this change legitimately updates: in `tests/import-service.test.ts`,
the test "persists full-file analysis stats instead of sample-limited preview stats"
(~line 1518) currently asserts `expect(result.sampleRows).toHaveLength(2)`. With rows now
sourced from the 3 real normalized rows (the detector mock's 2-row preview is no longer the
source), change it to `toHaveLength(3)`. This keeps the commit green; it is not new coverage.
  </action>
  <verify>
    <automated>yarn test tests/import-service.test.ts && npx tsc --noEmit</automated>
  </verify>
  <done>
`ImportAnalysisResult.sampleRows` returns every normalized row (up to `maxRows`) in the
best-candidate path and `previewBuckets` is populated; the null-best path is unchanged;
`import-service.test.ts` passes with the updated length assertion; `tsc` is clean.
  </done>
</task>

<task type="auto">
  <name>Task 2: Client — filter chips with counts + collapse-10/expand-all scroll container</name>
  <files>components/import/import-preview.tsx</files>
  <action>
Extend the existing `'use client'` component (it already imports `useState`). Add:
- `import { bucketOfPreviewRow, countPreviewBuckets } from '@/lib/utils/import-preview-buckets'`.
- State: `const [activeFilter, setActiveFilter] = useState<'all' | 'valid' | 'duplicate' | 'error'>('all')`
  and `const [expanded, setExpanded] = useState(false)`.
- Counts: `const buckets = result.previewBuckets ?? countPreviewBuckets(result.sampleRows)`.
  The `??` fallback keeps the component robust to older payloads and to fixtures that omit
  `previewBuckets`.
- Filtered rows via `useMemo`: when `activeFilter === 'all'` use `result.sampleRows`,
  otherwise `result.sampleRows.filter((r) => bucketOfPreviewRow(r) === activeFilter)`.
- Visible rows: `expanded ? filteredRows : filteredRows.slice(0, 10)`.

Render (inside the existing "Anteprima transazioni" Card, above the Table):
- A row of four chips using the existing `Button` component, `size="sm"`, and
  `variant={active ? 'default' : 'outline'}`, with `aria-pressed`. Labels + counts (Italian
  product copy): `Tutte (${buckets.all})`, `Valide (${buckets.valid})`,
  `Duplicate (${buckets.duplicate})`, `Errori (${buckets.error})`. Clicking a chip sets
  `activeFilter` AND resets `expanded` to `false` (re-collapse on filter change, per decision 3).
- Replace `result.sampleRows.slice(0, 10)` in the table body with `visibleRows`.
- Wrap the scrolling area of the table in a container with a bounded max height and vertical
  scroll (e.g. `className="max-h-96 overflow-y-auto"`) so the expanded list scrolls; keep the
  existing horizontal `overflow-x-auto`.
- Below the table, when `filteredRows.length > 10`, render a `Button` `variant="ghost"`/`link`
  toggle: `expanded ? 'Mostra meno' : \`Mostra tutte (${filteredRows.length})\`` that flips
  `expanded`.
- Empty state: when `filteredRows.length === 0`, show an Italian message row/cell such as
  "Nessuna riga in questa vista." instead of an empty table body.
- Warnings inline (decision 2, not a filter): when a row has `row.warnings.length > 0`, show a
  small secondary `Badge` labelled "Avviso" alongside the existing Valida/Duplicato/Errore
  badge in the Stato cell.

Keep monetary display via the existing `formatAbsoluteAmount` helper (no native math).
Do NOT add windowing/virtualization — plain slice + scroll container per decision 3.
Leave the "Duplicati" summary tile and all confirm/redirect logic untouched.
  </action>
  <verify>
    <automated>yarn test tests/import-preview-ui.test.tsx && npx tsc --noEmit && yarn lint && yarn check:language</automated>
  </verify>
  <done>
Chips render with correct per-bucket counts; the list defaults to the first 10 of the active
filter; "Mostra tutte (N)" expands the full filtered list inside a scrollable container and
toggles back; switching a filter re-collapses; warnings show as an inline badge; existing
`SUMUI-01` test (10-of-25 default) still passes; `tsc`, `lint`, and `check:language` are clean.
  </done>
</task>

<task type="auto">
  <name>Task 3: Tests — partition helper + all-rows (>25) integration</name>
  <files>tests/import-preview-buckets.test.ts, tests/import-service.test.ts</files>
  <action>
Create `tests/import-preview-buckets.test.ts` (fast, no mocks) covering
`@/lib/utils/import-preview-buckets`:
- `bucketOfPreviewRow` returns `error` for `{ valid: false, duplicate: false }` and for
  `{ valid: false, duplicate: true }` (invalid always wins), `duplicate` for
  `{ valid: true, duplicate: true }`, and `valid` for `{ valid: true, duplicate: false }`.
- `countPreviewBuckets` over a mixed array returns `all === rows.length` and
  `valid + duplicate + error === all` with the exact per-bucket counts (assert the partition
  is mutually exclusive and total-preserving).

Extend `tests/import-service.test.ts` (`analyzeFile` describe block, reusing the existing
hoisted mocks — `@/lib/utils/import` is real, `detectImportFormat` is mocked but returns a
best candidate whenever `loadImportFormatsForDetection` yields a format, and
`deriveFullFileImportStats` normalizes `parsed.rows` via the real util):
- Add a test that mocks `parseImportFile` via `makeParsedImport([...])` with MORE than 25 rows
  (e.g. 30) built from the existing row shape (keys `'"Data Movimento"'`, `'"Descrizione"'`,
  `'"Importo"'` with valid values). Assert `result.sampleRows.length === 30` (proving the
  25-cap is lifted) and `result.previewBuckets` is defined with `all === 30`, and
  `previewBuckets.valid + previewBuckets.duplicate + previewBuckets.error === 30`.
- Optionally enrich the same fixture with one duplicate pair (two identical date/description/
  amount rows → both flagged `duplicate` via `repeatedInFileHashes`) and one invalid row
  (e.g. empty `'"Importo"'`) and assert `previewBuckets.duplicate === 2` and
  `previewBuckets.error === 1`. Keep `getDuplicateHashes` at its default empty-set mock.

Then run the full suite. Note any pre-existing unrelated failures listed in CONTEXT
(suggestion-promote-form, transactions-dal, expense-actions, import-table-actions,
overview-interactions) — these are NOT caused by this task; do not attempt to fix them here.
  </action>
  <verify>
    <automated>yarn test tests/import-preview-buckets.test.ts tests/import-service.test.ts</automated>
  </verify>
  <done>
The helper partition test and the >25-row integration test pass; the full `yarn test` run
shows only the known pre-existing unrelated failures (documented in the summary), with the
import preview / service / buckets suites green.
  </done>
</task>

</tasks>

<verification>
Full-suite gate (run after Task 3):
- `yarn test` — import-service, import-preview-ui, import-preview-buckets, import-detector,
  import-actions, and analyze-page suites green; only the CONTEXT-listed pre-existing
  failures remain (record them verbatim in the SUMMARY).
- `npx tsc --noEmit` — clean (no `typecheck` script exists; use tsc directly).
- `yarn lint` — clean.
- `yarn check:language` — clean (new English identifiers/types/comments; Italian only in the
  user-facing chip/button/empty-state copy).

Manual sanity (optional): on the analyze page, chips show counts, default shows 10 rows of the
active filter, "Mostra tutte (N)" expands into a scrollable list, and switching filters
re-collapses to 10.
</verification>

<success_criteria>
- `analyzeFile` returns all normalized preview rows up to `maxRows` (not 25), sourced from the
  existing `deriveFullFileImportStats` all-rows pass (no second normalization), plus
  `previewBuckets` counts.
- The preview UI offers Tutte / Valide / Duplicate / Errori chips with correct counts, a
  collapsed-to-10 default per active filter, and a "Mostra tutte (N)" expand inside a
  scrollable container; warnings remain an inline badge.
- Dedup semantics, `duplicateCount`, persisted analysis state, the detector's scoring
  `sampleRows`, and the `importFile` commit path are all unchanged.
- Tests prove the valid/duplicate/error partition and that >25 rows are returned; `tsc`,
  `lint`, and `check:language` pass; only pre-existing unrelated test failures remain.
</success_criteria>

<output>
Create `.planning/quick/260703-kzg-import-preview-expand-to-view-all-rows-w/SUMMARY.md` when done,
recording the three commits, the `sampleRows` length assertion change (2 → 3), and the exact
list of any pre-existing unrelated test failures observed on the final `yarn test` run.
</output>
