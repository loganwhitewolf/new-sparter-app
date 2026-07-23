# Phase 70 — dashboard-tag-filter-removal — CONTEXT

**Requirements:** TAG-13
**Goal:** Per-tag analysis lives only in the dedicated all-time page (`/tags/[id]`, Phase 69). The period-scoped `?tag=` dashboard filter and its entire wiring are gone, and the dashboard behaves exactly as it did before the filter existed.

**Why:** tags are event-shaped; their canonical view is all-time. Crossing a tag with the dashboard's year/month scope produced a second, divergent set of numbers for the same tag (the exact inconsistency this milestone removes).

## Verified blast radius (mapped 2026-07-22 — trust but re-verify with grep)

### REMOVE

| What | Where |
|------|-------|
| `TagFilterSelect` component + its test | `components/dashboard/tag-filter-select.tsx`, `tests/tag-filter-select.test.tsx` (delete both) |
| Its render sites | `app/(app)/dashboard/overview/page.tsx` (2 sites: the zero-data branch + the main branch), `app/(app)/dashboard/categories/page.tsx` (1 site) |
| `parseTagIdParam` + its tests | `lib/validations/dashboard.ts`; test block in `tests/dashboard-filters.test.ts` (`describe('parseTagIdParam (68-01)')`) |
| `?tag=` reads / `resolveOwnedTagId` calls / `tagId` plumbing on dashboard pages | `app/(app)/dashboard/overview/page.tsx`, `app/(app)/dashboard/categories/page.tsx`, **and `app/(app)/dashboard/categories/[id]/page.tsx`** (the drill-down also parses `?tag=` — easy to miss) |
| `no-data-for-tag` empty-state variant | `components/dashboard/overview/overview-empty-state.tsx` (variant union + branch); its use in overview page collapses to `no-data-for-year` |
| `tagId` params + `tagScopedTransactions(...)` calls | `lib/dal/overview.ts` (6 refs), `lib/dal/dashboard.ts` (9 refs) — drop the params from the affected function signatures and their call sites |
| Now-unused `getTags` fetches on dashboard pages | only where they existed solely to feed `TagFilterSelect` — verify per page |

### KEEP — do NOT touch (regression risk)

- **`lib/dal/transaction-tags-sql.ts` (`tagScopedTransactions`) stays.** It is still used by `lib/dal/transactions.ts:340` to power `/transactions?tag=` **and the Phase 71 toolbar tag filter (TAG-14)**. Removing the helper or the file would break a just-shipped feature. Only the *dashboard* callers go away; after this phase its consumers are `transactions.ts` (code) and `tags.ts:124` (a docstring mention).
- **`resolveOwnedTagId`** in `lib/dal/tags.ts` — still used by the transactions page and others. Its docstring currently frames it as "IDOR defense for the dashboard `?tag=` filter"; update that comment to reference the transactions filter instead, but keep the function.
- `/dashboard/tags` (the per-tag ranking section) and `/tags/[id]` — untouched.
- `/transactions?tag=` and the transactions toolbar tag filter — untouched.

## Locked decisions

- **D1 — Legacy URLs degrade silently.** A dashboard URL still carrying `?tag=<id>` must render the normal, unfiltered dashboard: the param is simply not read. No redirect, no error, no empty state. (No param-stripping redirect — unnecessary complexity.)
- **D2 — Pure removal, no behavior substitution.** Do not replace the filter with any other per-tag affordance on the dashboard. Users reach per-tag analysis via `/dashboard/tags` → `/tags/[id]`.
- **D3 — Numbers must be identical to the unfiltered pre-existing behavior.** Removing an optional `tagId` that was `undefined` in the default path must not change any aggregate. Existing dashboard tests must stay green without assertion edits (except tests that specifically covered the tag filter, which are deleted with it).
- **D4 — Delete tests of deleted code**, don't leave them skipped.

## Verification hooks

- No `TagFilterSelect`, `parseTagIdParam`, or `no-data-for-tag` reference remains anywhere (`grep` across `app lib components tests`).
- `grep tagScopedTransactions lib/` afterwards returns **only** `transaction-tags-sql.ts` (definition), `transactions.ts` (2), `tags.ts` (1 comment).
- `/transactions?tag=<id>` still filters, and the toolbar tag filter (TAG-14) still works — the key regression check.
- Full suite green: `./node_modules/.bin/vitest run` (direct binary — RTK falsifies npx). `tsc --noEmit` clean on touched files; ESLint clean; `yarn check:language` passes.
