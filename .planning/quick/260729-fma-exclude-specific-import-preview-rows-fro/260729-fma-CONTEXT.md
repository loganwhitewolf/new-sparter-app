# Quick Task 260729-fma: Exclude specific import rows - Context

**Gathered:** 2026-07-29
**Status:** Ready for planning

<domain>
## Task Boundary

On the import analyze/preview step, allow the user to exclude a specific transaction row from import ("Non importare") without changing the date-range / import-mode filters.

Out of scope: "Rendi valida", force-import duplicates, editing error rows, schema changes.

</domain>

<decisions>
## Implementation Decisions

### Action surface
- Single action: **Non importare** (plus undo/restore). No "Rendi valida".
- Trigger from the existing status Badge cell (Valida / Duplicato / Errore) — DropdownMenu or similar already in `components/ui`.

### Identity
- Track exclusions by stable `rowIndex` from parse/preview (not UI list position).

### Preview behavior
- Excluded rows update live: counts (Righe trovate / Duplicati / period card as applicable), bucket chips, and row visual state (e.g. badge "Esclusa" or strikethrough + restore action).
- Excluded rows may remain visible in the table so the user can restore them.

### Confirm / server
- Pass `excludedRowIndexes` (array of ints) via FormData on confirm.
- Zod-validate on `ImportFileSchema`.
- In `importFile`, after import-mode filter, skip any normalized row whose `rowIndex` is in the excluded set — before hash dedup/insert.
- Never trust client-filtered row lists; only apply the exclusion set server-side on re-parsed rows.

### Claude's Discretion
- Exact DropdownMenu vs Popover UX; Italian copy for restore ("Ripristina" / "Importa").
- Whether excluded rows stay in "Righe trovate" or are subtracted (prefer: subtract from importable counts, keep visible in table with excluded styling).

</decisions>

<specifics>
## Specific Ideas

- Same override pattern as `importMode` / `rangeStart` / `rangeEnd` already on this branch.
- Branch: stay on `quick/260729-f21-import-mode-filters` (do not create a new branch).

</specifics>

<canonical_refs>
## Canonical References

- `.planning/quick/260729-f21-import-mode-filters-from-last-platform-t/260729-f21-CONTEXT.md` (prior import mode work on same branch)
- `components/import/import-preview.tsx`
- `lib/services/import.ts` (`importFile` insert loop)

</canonical_refs>
