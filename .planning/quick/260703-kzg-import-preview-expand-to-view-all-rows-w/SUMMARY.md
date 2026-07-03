---
quick_id: 260703-kzg
slug: import-preview-expand-to-view-all-rows-w
type: quick
status: complete
date: 2026-07-03
branch: gsd/quick-import-preview-all-rows
---

# Summary — Import preview: view all rows + filter by valid/duplicate/error

## What shipped
The import preview now returns **all** normalized rows (up to the parser's
`DEFAULT_MAX_ROWS = 10_000` bound) instead of the ~10 shown before, and the UI
offers **Tutte / Valide / Duplicate / Errori** filter chips with per-bucket
counts. The list defaults collapsed to the first 10 of the active filter, with a
"Mostra tutte (N)" toggle expanding the full filtered list inside a scrollable
container. Preview-only — dedup semantics, `duplicateCount`, persisted analysis
state, the detector's confidence-scoring sample, and the commit path are untouched.

## Commits (3 atomic, branch `gsd/quick-import-preview-all-rows`)
| SHA | Task |
|-----|------|
| 192dbdb | server: expose all normalized preview rows + `previewBuckets` counts (new pure helper `import-preview-buckets.ts`) |
| b9fb088 | client: filter chips + collapse-10/expand-all scrollable container + inline "Avviso" badge |
| ecc2665 | tests: pure partition + analyzeFile 31-row (>25) coverage |

## Key implementation note
`sampleRows` is now sourced from `provisionalStats.normalizedRows` (the existing
all-rows pass in `deriveFullFileImportStats`) — no second normalization, `maxRows`
preserved. The `duplicate` flag reuses the exact commit-path formula. The
null-best (no format matched) path keeps its previous behavior. `previewBuckets`
is optional on the type so no hand-built fixture breaks `tsc`.

## Verification
- `tests/import-preview-buckets.test.ts` (6) + `tests/import-service.test.ts` (53, incl. the 31-row all-rows/partition test) + `tests/import-preview-ui.test.tsx` (3): all green.
- `npx tsc --noEmit`, `yarn lint`, `yarn check:language`: zero errors in touched files.
- Full `yarn test`: 7 failures in 3 files — `expense-actions`, `import-table-actions`, `overview-interactions` — **pre-existing on main, unrelated** to this task (verified by running each in isolation; none touched here). Zero new failures introduced.

## Deviations
None. All locked decisions honored. The stale `sampleRows` length assertion in
`import-service.test.ts` was updated 2 → 3 (legitimate: rows now source from the
3 real normalized rows, not the detector mock's 2-row sample).
