# Requirements: Sparter — Milestone v2.7 Tag Dedicated View

**Defined:** 2026-07-22
**Core Value:** Safely import real bank transactions, see where money goes categorized by month, and instantly spot deviations — on a zero-cost personal deploy.

## v2.7 Requirements

Requirements for this milestone. Each maps to a roadmap phase. REQ-IDs continue the `TAG` category from v2.6 (TAG-01…TAG-05 shipped: tag entity, bulk-assign, suggestions, dashboard filter, `/dashboard/tags` totals).

### Tag Dedicated View

- [ ] **TAG-06**: User can open a dedicated page for a single tag showing its all-time overview (every transaction carrying the tag, independent of any calendar period).
- [ ] **TAG-07**: The tag page shows three totals — Entrate, Uscite, and Valore finale (signed net) — computed with the same netting/exclusions as the dashboard (`getTagDetail`/`getTagTotals`), so the numbers reconcile with `/dashboard/tags`.
- [ ] **TAG-08**: The tag page shows the number of included transactions (matching the totals' transaction set).
- [ ] **TAG-09**: The tag page shows a per-category breakdown of the tag's transactions with signed amounts.
- [ ] **TAG-10**: The tag page shows a compact list of the included transactions (date · subcategory · signed amount), sorted by date descending.
- [ ] **TAG-11**: User can edit and archive the tag directly from the dedicated page.
- [ ] **TAG-12**: User can reach the tag page from `/tags` and from `/dashboard/tags`.

### Dashboard Tag-Filter Removal

- [ ] **TAG-13**: The dashboard no longer offers a period-scoped tag filter — `?tag=` is removed from `/dashboard/overview` and `/dashboard/categories` (including `TagFilterSelect`, `tagId` threading through the overview/category DAL, the `no-data-for-tag` empty state, and `parseTagIdParam`). Per-tag analysis lives only in the dedicated all-time page.

## v2 Requirements (deferred)

### Tag Dedicated View

- **TAG-F1**: Per-tag trend/sparkline over the tag's active span (deferred — the mini-dashboard is all-time flat for v2.7).
- **TAG-F2**: Export a tag's transactions (CSV) from the dedicated page.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Period-scoped per-tag analysis in the dashboard | Explicitly replaced by the all-time dedicated page (model: tags are event-shaped, TAG-06). |
| `dateRange` as a hard filter on the tag's transactions | `dateRange` stays a descriptive label; the canonical set is every transaction carrying the tag (TAG-06). |
| New tag CRUD semantics | Create/edit/archive already shipped in v2.6; this milestone only surfaces edit/archive on the new page (TAG-11). |
| Charts library for the breakdown | The Variant A breakdown uses simple CSS bars — no charting dependency. |

## Traceability

Filled during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TAG-06 | TBD | Pending |
| TAG-07 | TBD | Pending |
| TAG-08 | TBD | Pending |
| TAG-09 | TBD | Pending |
| TAG-10 | TBD | Pending |
| TAG-11 | TBD | Pending |
| TAG-12 | TBD | Pending |
| TAG-13 | TBD | Pending |
