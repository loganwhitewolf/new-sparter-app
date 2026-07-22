# Requirements: Sparter — Milestone v2.7 Tag Dedicated View

**Defined:** 2026-07-22
**Core Value:** Safely import real bank transactions, see where money goes categorized by month, and instantly spot deviations — on a zero-cost personal deploy.

## v2.7 Requirements

Requirements for this milestone. Each maps to a roadmap phase. REQ-IDs continue the `TAG` category from v2.6 (TAG-01…TAG-05 shipped: tag entity, bulk-assign, suggestions, dashboard filter, `/dashboard/tags` totals).

### Tag Dedicated View

- [x] **TAG-06**: User can open a dedicated page for a single tag showing its all-time overview (every transaction carrying the tag, independent of any calendar period).
- [x] **TAG-07**: The tag page shows three totals — Entrate, Uscite, and Valore finale (signed net) — computed with the same netting/exclusions as the dashboard (`getTagDetail`/`getTagTotals`), so the numbers reconcile with `/dashboard/tags`.
- [x] **TAG-08**: The tag page shows the number of included transactions (matching the totals' transaction set).
- [x] **TAG-09**: The tag page shows a per-category breakdown of the tag's transactions with signed amounts.
- [x] **TAG-10**: The tag page shows a compact list of the included transactions (date · description · subcategory · signed amount), sorted by date descending.
- [x] **TAG-11**: User can edit and archive the tag directly from the dedicated page.
- [x] **TAG-12**: User can reach the tag page from `/tags` and from `/dashboard/tags`.

### Dashboard Tag-Filter Removal

- [ ] **TAG-13**: The dashboard no longer offers a period-scoped tag filter — `?tag=` is removed from `/dashboard/overview` and `/dashboard/categories` (including `TagFilterSelect`, `tagId` threading through the overview/category DAL, the `no-data-for-tag` empty state, and `parseTagIdParam`). Per-tag analysis lives only in the dedicated all-time page.

### Transactions Tag Filter

- [ ] **TAG-14**: User can filter the transactions table by tag from the transactions toolbar — a tag control integrated into the existing unified filter/sort system (writes `?tag=`, persisted, shown as an active chip, cleared by clear-all). The `?tag=` URL param, ownership guard, and `getTransactions` `tagId` support already exist; this adds the UI control. (Complements TAG-13: the dashboard loses the tag *analysis* filter, the transactions list gains a tag *navigation* filter.)

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

Filled at roadmap creation (2026-07-22).

| Requirement | Phase | Status |
|-------------|-------|--------|
| TAG-06 | Phase 69 | Complete |
| TAG-07 | Phase 69 | Complete |
| TAG-08 | Phase 69 | Complete |
| TAG-09 | Phase 69 | Complete |
| TAG-10 | Phase 69 | Complete |
| TAG-11 | Phase 69 | Complete |
| TAG-12 | Phase 69 | Complete |
| TAG-13 | Phase 70 | Pending |
| TAG-14 | Phase 71 | Pending |
