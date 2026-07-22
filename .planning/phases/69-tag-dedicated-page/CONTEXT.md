# Phase 69 — tag-dedicated-page — CONTEXT

**Requirements:** TAG-06, TAG-07, TAG-08, TAG-09, TAG-10, TAG-11, TAG-12
**Goal:** A dedicated, all-time per-tag page (mini-dashboard) that is the canonical view of a tag, reachable from `/tags` and `/dashboard/tags`.

This CONTEXT captures decisions already locked with the user (grill + prototype, 2026-07-22). Treat them as LOCKED — do not re-open. Source of truth also in memory `project_tag_dedicated_view`.

## Locked decisions

- **D1 — Route `/tags/[id]`.** New RSC page (`app/(app)/tags/[id]/page.tsx`), authenticated group. `verifySession()` → ownership via `getTag(userId, id)`; if not found/owned → `notFound()`. `id` is a positive int; malformed → `notFound()`. Add an `APP_ROUTES.tagDetail(id)` helper in `lib/routes.ts`.

- **D2 — `/tags` becomes an index.** The existing `TagSettingsPanel` (`components/tags/tag-settings-panel.tsx`) currently renders a list + an inline detail (`TagDetailView`, added in quick task 260722-ked). Change it to an **index**: each tag in the list links to `/tags/[id]`. **Remove the inline `TagDetailView`** from the panel — its rendering (KPI + count + tx list) is refolded into the dedicated page. Keep `CreateTagDialog`, keep the active/archived grouping, keep archived badges. The server action `getTagDetailAction` (in `lib/actions/tags.ts`) existed only for that client-side inline fetch — the dedicated page is an RSC that calls the DAL directly, so `getTagDetailAction` becomes orphaned; remove it (verify no other caller).

- **D3 — Single numeric source, one query.** Extend the EXISTING `getTagDetail(userId, tagId)` in `lib/dal/tags.ts` (do NOT add a parallel query): add `category.name` to the existing select and derive a **per-category breakdown** inside the pure `buildTagDetailData` (group by category name, signed `Decimal` sum + count, sort by |total| desc). Same exclusion set already in place (effectiveAmount + isNotSecondary, exclude `transfer`, `expense.status ∈ {1,2,3}`, direction via user override). Extend the `TagDetail` type with `breakdown: { categoryName, total, count }[]`. **Reconciliation (TAG-07):** `TagDetail.net` MUST equal `getTagTotals`' `total` for the same tag.

- **D4 — Layout = prototype Variant A** ("report verticale"). Reference: `app/proto/tag-view/variant-a.tsx` (throwaway on branch `proto/tag-view`). Top-to-bottom: header (name + date-range label + Edit/Archive) → 3 KPI cards (Entrate / Uscite / Valore finale, signed net, sign-colored) → "{n} transazioni incluse" → per-category breakdown with CSS bars (bar color by sign: `--total-in` / `--total-out`) → compact transaction list (date · subcategory · signed amount, date-descending, scrollable). Reuse `it-IT` currency/date formatting and `tabular-nums`. `formatDateRange` returns "Nessun intervallo" when no range (as in the current panel).

- **D5 — Edit / Archive.** Reuse `EditTagDialog` and `ArchiveTagDialog` from `components/tags/tag-mutation-dialogs.tsx` in the page header. Show an "Archiviato" badge when archived; render `ArchiveTagDialog` only when NOT archived (mirror the current panel). The existing actions already `revalidatePath(APP_ROUTES.tags)` + `dashboardTags` — also `revalidatePath` the new detail route. User stays on the page after archive (badge updates); no forced redirect.

- **D6 — Entry points.** (a) `/tags` index list items link to `/tags/[id]` (D2). (b) `/dashboard/tags` ranking (`components/dashboard/tag-ranking-list.tsx`) currently links the tag name to `/transactions?tag={id}`; re-point the **primary** name link to `/tags/[id]`. A secondary "vedi transazioni" affordance to `/transactions?tag={id}` MAY stay.

## Scope fences

- **`/transactions?tag=` stays.** TAG-13 (Phase 70) removes the period-scoped tag filter only from the **dashboard** (`/dashboard/overview`, `/dashboard/categories`). The transactions-table filter `/transactions?tag=` is unaffected — do not touch it here.
- Do NOT remove the dashboard `?tag=` wiring in this phase — that is Phase 70.

## Out of scope (this phase)

| Item | Why |
|------|-----|
| Per-tag trend / sparkline | Deferred (TAG-F1); the mini-dashboard is all-time flat. |
| CSV export of a tag's transactions | Deferred (TAG-F2). |
| Charting library for the breakdown | Variant A uses simple CSS bars — no dependency. |
| Tag CRUD semantics changes | Create/edit/archive already shipped (v2.6); only surface edit/archive here. |
| Removing dashboard `?tag=` filter | Phase 70 (TAG-13). |

## Project constraints (must hold)

- Money: `Decimal.js` via `@/lib/utils/decimal` — never native arithmetic; Drizzle DECIMAL columns are strings.
- Layers: queries in `lib/dal/`, thin `"use server"` in `lib/actions/`. `server-only` on DAL.
- Language: code/comments/routes English; product UI copy Italian. Run `yarn check:language`.
- Ownership/IDOR: `getTag`/`resolveOwnedTagId` before forwarding a user-supplied tagId.
- Existing base already includes `getTagDetail` + `getTagDetailAction` (quick 260722-ked, absorbed into this milestone branch `gsd/v2.7-tag-dedicated-view`).

## Verification hooks

- `TagDetail.net` reconciles with `getTagTotals` for the same tag (TAG-07).
- Included-transaction count == length of the returned transaction list (TAG-08).
- Page reachable and correct from `/tags` and `/dashboard/tags` (TAG-12).
- `tsc --noEmit` clean on touched files; ESLint clean; `yarn check:language` passes.
