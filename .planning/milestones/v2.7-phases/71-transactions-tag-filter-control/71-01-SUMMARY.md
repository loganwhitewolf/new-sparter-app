---
plan: 71-01
phase: 71
status: complete
requirements: [TAG-14]
human_verify: pending operator
---

# 71-01 — Transactions tag filter control — SUMMARY

## What shipped

UI-only slice. The `?tag=` param, `resolveOwnedTagId` IDOR guard, and `getTransactions` `tagId`
path already existed and were reused unchanged; this added the missing toolbar control.

- **`lib/utils/table-config.ts`** — `FilterField.toChip` widened to `(v: string, label?: string) => string`.
  Backward-compatible: every existing one-arg implementation stays assignable and renders unchanged.
- **`components/data-table/DataTableToolbar.tsx`** — the chip builder resolves the raw URL value
  against the field's effective option set (`filterOptions[field.key]`) and passes the matched
  label as `toChip`'s 2nd argument.
- **`app/(app)/transactions/transactions.table.ts`** — new `tag` select filter; `toChip: (v, label) => \`Tag: ${label ?? v}\``
  so the chip shows the tag NAME while the stored value stays the tagId.
- **`app/(app)/transactions/page.tsx`** — `tagOptions` built from the already-loaded `getTags`
  list (value `String(id)`, label `name`, archived marked `(archiviato)`), injected via
  `filterOptions={{ …, tag: tagOptions }}`. Also added `'tag'` to `hasActiveTransactionFilters`
  (plan-checker finding) so a zero-match tag filter shows the "no-result" empty state.
- **`tests/tag-ranking-list.test.tsx`** — fixed a stale Phase 69 assertion: the ranking name link
  now points at `/tags/1` (69-03 D6), not `/transactions?tag=1`. This was a real Phase 69 leftover
  the verifier's four-suite sample missed.

Because `key` → searchParam is 1:1 and `useTableUrl` has no param allowlist, persistence
(sessionStorage restore) and clear-all came for free — no extra wiring.

## Verification

- `vitest run` **full suite: 140 files, 1755 passed, 1 todo, 0 failed** (toolbar suite 17/17,
  including the two previously-RED tag chip cases).
- `tsc --noEmit` — clean on all touched files.
- `eslint` — clean on touched files (one pre-existing unrelated warning in another file).
- `yarn check:language` — passed.

## Execution note

The first executor run was terminated mid-TDD by a session limit after committing RED
(`2364773`) and the `toChip` signature edit. The run was resumed and completed: GREEN
implementation + stale-test fix committed as `224e939`. No work was lost or duplicated.

## Pending operator — human-verify checkpoint (Task 2, blocking)

On `/transactions` (dev server running at http://localhost:3000):

1. A **Tag** filter appears in the toolbar listing your tags (archived marked).
2. Selecting a tag filters the table and writes `?tag=<id>`.
3. The active chip reads **"Tag: {nome}"** (name, not the id).
4. "Cancella tutto" removes it; the filter survives bare navigation (back/forward, re-entry).
5. A tag with zero matching transactions shows the *filter* empty state ("Nessun movimento
   corrisponde ai filtri attivi"), not the "importa un file" one.
6. A forged/foreign `?tag=` in the URL is still ignored (ownership guard unchanged).
