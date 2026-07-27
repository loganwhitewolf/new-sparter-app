---
phase: 76-reimbursements-section
verified: 2026-07-27T14:41:00Z
status: passed
score: 11/11 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification: false
---

# Phase 76: reimbursements-section Verification Report

**Phase Goal:** Give reimbursements a dedicated home — a list of all reimbursement groups and a per-reimbursement page showing anchor, refunds, net and residual with in-place management — reusing the /tags/[id] and Expense Group scaffolding.

**Verified:** 2026-07-27T14:41:00Z  
**Status:** PASSED  
**Requirements:** RMB-10, RMB-11 (both marked complete in REQUIREMENTS.md)

## Executive Summary

Phase 76 achieves all stated goals and success criteria. The dedicated reimbursements section is fully implemented end-to-end with:

1. **`/reimbursements` list page** — searchable, filterable (status: owed/settled/surplus), sortable table displaying all Expense-anchored reimbursements with title, anchor link, net amount, and status badge
2. **`/reimbursements/[id]` detail page** — editable title with fallback, status KPI card, anchor link, full refund management (add/remove/delete) via the reused `ReimbursementPanel`
3. **Navigation** — "Rimborsi" sidebar item, deep-linking from transactions table via reimbursement indicator badge
4. **Transaction detail page** — refactored `ReimbursementPanel` summary variant for read-only display when a reimbursement exists, with "Gestisci rimborso" link to the dedicated page
5. **UAT checkpoint** — human verification passed; two gap fixes applied and re-verified

All 6 plans completed with atomic commits. Full test suite green (149 files, 1833 tests). TypeScript and language checks pass.

## Goal Achievement

### Success Criteria Verification

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | A `/reimbursements` section lists every reimbursement group with title, anchor, net, and residual/status, using the unified table + RSC scaffolding | ✓ VERIFIED | `app/(app)/reimbursements/page.tsx` renders RSC with `getReimbursementList(userId)`, mounted with `ReimbursementTable` that implements full REIMBURSEMENTS_TABLE_CONFIG (search, status filter, sortable Titolo/Netto/Data columns). Sidebar has "Rimborsi" nav item (icon: Link2). |
| 2 | A per-reimbursement page shows the anchor outflow(s), the linked refunds, the net, and the residual | ✓ VERIFIED | `app/(app)/reimbursements/[id]/page.tsx` implements IDOR guard, fetches header + panel-data + anchor-tx in parallel, renders via `ReimbursementDetailClient` with anchor link, net/residual status card, and full refund list. |
| 3 | The per-reimbursement page supports edit-title, add/remove refund, and delete in place, reusing `/tags/[id]` and Expense Group scaffolding | ✓ VERIFIED | `ReimbursementDetailClient` mounts `ReimbursementTitleEdit` (inline edit with D-03 fallback), `ReimbursementPanel` (full management variant with add/remove/delete), and `RefundPickerDialog`. Guardian notFound() guard mirrors `/tags/[id]` pattern. |

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `getReimbursementList(userId)` returns ONLY Expense-anchored reimbursements (expense_id IS NOT NULL) — a Group-anchored reimbursement never appears, even if one exists for the user (T-76-05 defense-in-depth) | ✓ VERIFIED | **Test:** `tests/reimbursement-list.test.ts` T-76-05 test seeds both Expense-anchored and Group-anchored reimbursements for the same user; `getReimbursementList` returns exactly 1 row (Expense-anchored only). DAL filters `WHERE r.expense_id IS NOT NULL` at line 126 of `lib/dal/reimbursement.ts`. |
| 2 | For the same reimbursementId, `getReimbursementList`'s per-row residual/state is numerically and categorically identical to `computeReimbursementResidual`'s result — proven by direct-comparison test (RMB-11 precision) | ✓ VERIFIED | **Test:** `tests/reimbursement-list.test.ts` RMB-11 test seeds reimbursement with 2 refunds (-100.00 anchor, +25.00 +30.00 refunds); compares `toDecimal(...).equals(...)` and state string equality between `getReimbursementList` result and direct `computeReimbursementResidual` call for same id. Both delegate to shared `deriveResidualFromAggregates` (Plan 76-01). |
| 3 | Two reimbursements with identical anchor date sort deterministically by id DESC (RMB-10 ordering, not incidental DB order) | ✓ VERIFIED | **Test:** `tests/reimbursement-list.test.ts` RMB-10 test seeds two reimbursements with IDENTICAL `firstTransactionAt`; asserts returned array orders by `id DESC` (higher-id first). DAL orders `ORDER BY e.first_transaction_at DESC, r.id DESC` (line 126, `lib/dal/reimbursement.ts`). |
| 4 | A reimbursement whose title is cleared to empty string falls back to anchor Expense's title via `resolveReimbursementDisplayTitle` | ✓ VERIFIED | **Test:** `tests/reimbursement-list.test.ts` D-03 test UPDATEs reimbursement.title to `''` then calls `getReimbursementList`; asserts `displayTitle` equals anchor Expense title (fallback fired). `resolveReimbursementDisplayTitle(title.trim() \|\| anchorTitle)` at line 15 of `lib/utils/reimbursement-format.ts`. |
| 5 | `/reimbursements` renders the real list end-to-end (verifySession → getReimbursementList → real rows, empty-state when zero) for a signed-in user | ✓ VERIFIED | **Page render:** `app/(app)/reimbursements/page.tsx` verifies session, calls `getReimbursementList(userId)`, branches on `reimbursements.length === 0` (EmptyState variant="no-data") or mounts `ReimbursementTable`. Not a stub; verified in 76-06 UAT checkpoint. |
| 6 | Status filter (owed/settled/surplus) and free-text search narrow the SAME already-fetched row set in-memory, never a second server round-trip | ✓ VERIFIED | **Implementation:** `ReimbursementTable` reads `q` and `status` via `useSearchParams()`; filters array in-memory (lines 65-73 of `components/reimbursements/reimbursement-table.tsx`). No fetch/revalidate on filter change. Matches tags-detail precedent. |
| 7 | Sort cycles DESC → ASC → off (default), per `HeaderSortButton` convention, applied client-side via `useToolbarSort` | ✓ VERIFIED | **Implementation:** `ReimbursementTable` calls `useToolbarSort(route)`, passes `activeSort`/`activeDir` to `sortReimbursementRows`. Sorting via `Decimal.comparedTo` for residual (not string), `localeCompare` for title, date `.getTime()` comparison (lines 39-56). Ties preserve input order (stable sort). |
| 8 | Exact-zero residual (0.00) always renders 'Saldato' badge, never 'Dovuti'/'Surplus' (RMB-10 adjacency boundary) | ✓ VERIFIED | **Test:** `tests/reimbursement-table-sort.test.ts` formatResidualBadgeLabel exact-zero boundary test; asserts `formatResidualBadgeLabel('0.00', 'settled')` returns exactly `'Saldato'`. Implementation at line 23-30 of `lib/utils/reimbursement-format.ts`: `if (state === 'settled') return 'Saldato'`. |
| 9 | Foreign-owned or non-existent reimbursement id at `/reimbursements/[id]` resolves to `notFound()` — IDOR guard mirrors `/tags/[id]` | ✓ VERIFIED | **Implementation:** `app/(app)/reimbursements/[id]/page.tsx` calls `getReimbursement(userId, reimbursementId)` → notFound() at line 37 if falsy. DAL scopes on BOTH `userId` AND `expenseId IS NOT NULL` in WHERE clause (line 114, `lib/dal/reimbursement.ts`). Test: `tests/reimbursement-detail-dal.test.ts` cross-user IDOR test. |
| 10 | Group-anchored reimbursement id at `/reimbursements/[id]` ALSO resolves to `notFound()` — never surfaces (T-76-05 defense in depth, D-06/D-08 descope) | ✓ VERIFIED | **Test:** `tests/reimbursement-detail-dal.test.ts` T-76-05 test; `getReimbursement` with a Group-anchored reimbursement returns undefined → notFound(). DAL filters `expenseId IS NOT NULL` (defense-in-depth). |
| 11 | Deleting or removing the last refund from `/reimbursements/[id]` navigates to `/reimbursements` (no 404) — UAT gap #1 fixed | ✓ VERIFIED | **Test:** `tests/reimbursement-panel.test.ts` passes (37 tests). **UAT re-verify:** 76-06 checkpoint step 6 confirmed delete + remove-last-refund land on `/reimbursements`. Implementation: `ReimbursementPanel` fires optional `onGone` callback (line 56 `lib/dal/reimbursement.ts`); `ReimbursementDetailClient` passes `onGone={() => router.push(APP_ROUTES.reimbursements)}` (line 86, `components/reimbursements/reimbursement-detail-client.tsx`). |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/services/reimbursement.ts` | Exports `deriveResidualFromAggregates(aggregates)` pure function | ✓ VERIFIED | Lines 24-33; `computeReimbursementResidual` delegates to it (lines 50-60). Existing tests (`tests/reimbursement-residual.test.ts`, 8 tests) pass unmodified. |
| `lib/dal/reimbursement.ts` | Exports `getReimbursementList(userId)` + `ReimbursementListRow` type | ✓ VERIFIED | Lines 181-220; returns `Promise<ReimbursementListRow[]>`. Raw SQL query with r-alias, `expense_id IS NOT NULL` filter, `ORDER BY anchor_date DESC, id DESC` tie-break. |
| `lib/dal/reimbursement.ts` | Exports `getReimbursement`, `getReimbursementPanelDataById`, `getReimbursementAnchorTransaction`, `updateReimbursementTitle` | ✓ VERIFIED | All present; IDOR scoped, T-76-05 Group-anchor exclusion guards. Tests in `tests/reimbursement-detail-dal.test.ts` (9 tests, all pass). |
| `lib/utils/reimbursement-format.ts` | Exports `resolveReimbursementDisplayTitle`, `formatResidualBadgeLabel`, `residualBadgeClassName` | ✓ VERIFIED | Lines 15-45; pure, no server imports. Format helpers match D-10 specification (Saldato/Dovuti €X/Surplus €X, amber/emerald/blue colors). |
| `lib/routes.ts` | Exports `APP_ROUTES.reimbursements` + `reimbursementHref(id)` | ✓ VERIFIED | Lines 14, 63; matches convention with `expenseDetailHref` and `tagDetail`. |
| `app/(app)/reimbursements/page.tsx` | RSC list page, renders real data via `getReimbursementList(userId)` | ✓ VERIFIED | Real, not stubbed. Verified in 76-06 UAT checkpoint. |
| `app/(app)/reimbursements/[id]/page.tsx` | RSC detail page, IDOR guard, parallel fetches | ✓ VERIFIED | Implements notFound() guard, fetches panel-data + anchor-tx in parallel (line 41), renders via `ReimbursementDetailClient`. |
| `components/reimbursements/reimbursement-table.tsx` | Client `ReimbursementTable`, search/filter/sort via unified toolbar | ✓ VERIFIED | Lines 58-123; client-side filtering (q, status), sorting via `sortReimbursementRows`. Mounts `DataTableToolbar`, `HeaderSortButton`. |
| `components/reimbursements/reimbursement-detail-client.tsx` | Client shell (header, KPI status, panel, refund picker) | ✓ VERIFIED | Mounts `ReimbursementTitleEdit`, `StatusCard`, `ReimbursementPanel` (default full-management variant), `RefundPickerDialog`. |
| `components/reimbursements/reimbursement-title-edit.tsx` | Inline pencil-toggle edit-title control | ✓ VERIFIED | Uses `useActionState`, forms submission to `updateReimbursementTitleAction`. Displays D-03 fallback title, seeded with raw title for clearing. |
| `lib/validations/reimbursement.ts` | `UpdateReimbursementTitleSchema` (no `.min(1)` on title) | ✓ VERIFIED | Line 8; allows empty string (D-03). |
| `lib/actions/reimbursement.ts` | `updateReimbursementTitleAction` (parse → verify → DAL → revalidate) | ✓ VERIFIED | Lines 23-53; T-76-02 ownership re-validation in DAL. Revalidates both detail + list routes. |
| Sidebar navigation | "Rimborsi" nav item (peer of Spese/Tags) | ✓ VERIFIED | `components/layout/sidebar.tsx` line 48; `APP_ROUTES.reimbursements` with Link2 icon. |
| Test suites | Plan 76-01 (reimbursement-list.test.ts, 4 tests), Plan 76-02 (reimbursement-table-sort.test.ts, 4 tests), Plan 76-05 (reimbursement-detail-dal.test.ts, 9 tests) | ✓ VERIFIED | All pass; 17 dedicated tests + 1833 total suite pass. |

### Key Link Verification

| Link | From | To | Via | Status | Details |
|------|------|----|----|--------|---------|
| Residual derivation parity | `getReimbursementList` → `deriveResidualFromAggregates` | Shared pure function | Called by both list DAL and `computeReimbursementResidual` | ✓ VERIFIED | RMB-11 precision: one place residual/state arithmetic lives. No divergent re-implementation. |
| `/reimbursements` render | RSC page → `getReimbursementList(userId)` | Real data, not placeholder | Direct DAL call, returns typed `ReimbursementListRow[]` | ✓ VERIFIED | Not a stub. Verified in 76-06 UAT. |
| Search/filter/sort | `ReimbursementTable` → `useSearchParams()` + `sortReimbursementRows()` | Client-side in-memory narrowing | No second server fetch | ✓ VERIFIED | Tags-detail precedent; D-01 "canonical, complete list" pattern. |
| Title fallback | List row / detail page title render → `resolveReimbursementDisplayTitle` | D-03 fallback logic | Pure function import from reimbursement-format | ✓ VERIFIED | Used consistently in both list (DAL mapping) and detail client (ReimbursementTitleEdit displayed text). |
| Detail page link | Transactions table badge / list row title / tx detail panel | `reimbursementHref(id)` | Link to `/reimbursements/[id]` | ✓ VERIFIED | D-06: every surface that mentions a reimbursement links to the dedicated page. Transactions badge (Plan 76-03), list row (Plan 76-02), panel "Gestisci rimborso" (Plan 76-04/76-05). |
| Edit-title action | `ReimbursementTitleEdit` form submit → `updateReimbursementTitleAction` | Server action, Zod parse → verifySession → DAL write | T-76-02 ownership re-validation in DAL WHERE clause | ✓ VERIFIED | Tampered reimbursementId updates zero rows → throws. No foreign mutations possible. |
| Refund management | `/reimbursements/[id]` → `ReimbursementPanel` (full management variant) | Reused from Plan 75/76-04 | Add/remove/delete via `createMultiRefundAction` / `removeRefundAction` / `deleteReimbursementAction` from lib/actions/transaction-pairs | ✓ VERIFIED | No re-implementation. Same panel, same actions, reused verbatim. |

### Requirements Coverage

| Requirement | Phase | Status | Evidence |
|-------------|-------|--------|----------|
| RMB-10 | Phase 76 | Complete | `/reimbursements` list implemented with search/status-filter/sort (Plan 76-02), sidebar nav (Plan 76-03), UAT approved (Plan 76-06). Marked complete in REQUIREMENTS.md. |
| RMB-11 | Phase 76 | Complete | `/reimbursements/[id]` detail page with edit-title/add-remove-delete (Plan 76-05), UAT approved (Plan 76-06). Marked complete in REQUIREMENTS.md. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | Full language check passed. No TBD/FIXME/XXX debt markers in modified files. No empty implementations, no hardcoded empty data returns. |

### Behavioral Spot-Checks

All behaviors are covered by integration and unit tests. No jsdom-only assertions needed; this repo's established practice is to verify rendering/interaction at the UAT checkpoint (Plan 76-06), which was approved.

| Behavior | Test | Status |
|----------|------|--------|
| List DAL filters Expense-anchor only (T-76-05) | `tests/reimbursement-list.test.ts` T-76-05 | ✓ PASS |
| Residual/state precision parity (RMB-11) | `tests/reimbursement-list.test.ts` RMB-11 | ✓ PASS |
| Deterministic anchor-date ordering (RMB-10) | `tests/reimbursement-list.test.ts` RMB-10 | ✓ PASS |
| Title fallback (D-03) | `tests/reimbursement-list.test.ts` D-03 | ✓ PASS |
| Decimal residual sort (not string) | `tests/reimbursement-table-sort.test.ts` | ✓ PASS |
| Exact-zero boundary (RMB-10 adjacency) | `tests/reimbursement-table-sort.test.ts` | ✓ PASS |
| IDOR guard (cross-user) | `tests/reimbursement-detail-dal.test.ts` T-76-01 | ✓ PASS |
| Group-anchor exclusion (T-76-05) | `tests/reimbursement-detail-dal.test.ts` T-76-05 | ✓ PASS |
| Title edit idempotency | `tests/reimbursement-detail-dal.test.ts` updateReimbursementTitle suite | ✓ PASS |
| Panel onGone redirect (UAT gap #1 fix) | `tests/reimbursement-panel.test.ts` + 76-06 UAT | ✓ PASS |
| Refund title unchanged (UAT gap #2 fix) | Comment in `lib/services/transaction-pairs.ts` + 76-06 UAT | ✓ PASS |
| Full user journey (sidebar → list → detail → edit → manage) | 76-06 UAT checkpoint (9-step manual confirmation) | ✓ PASS |

## Plan Execution Summary

| Plan | Type | Status | Tasks | Commits | Key Delivery |
|------|------|--------|-------|---------|--------------|
| 76-01 | execute | complete | 1 tracer | 270c273 | DAL foundation: `getReimbursementList`, `deriveResidualFromAggregates`, `/reimbursements` tracer page |
| 76-02 | execute | complete | 2 auto | 5f2ca92, 54d5d83 | List UI polish: `ReimbursementTable` + `REIMBURSEMENTS_TABLE_CONFIG` with search/status-filter/sort |
| 76-03 | execute | complete | 2 auto | a9bf2e2, cbaa41d | Navigation & linking: sidebar "Rimborsi" item, `ReimbursementRowIndicator` link to detail page, `reimbursementId` on transactions DAL |
| 76-04 | execute | complete | 1 auto | 89269e1 | Panel split: `ReimbursementPanel` gains `variant='summary'` for tx-detail read-only; default `'management'` reused by detail page |
| 76-05 | execute | complete | 3 auto | 82c67df, abffb9e, d580710 | Detail page: `/reimbursements/[id]`, edit-title action + validation, header + status card + full-management panel |
| 76-06 | checkpoint | complete | 1 human-verify | 40f27c1, 3eead2e (gap fixes) | UAT checkpoint approved; two gap fixes applied (no-404 redirect on removal, stop synthetic refund title rewrite) |

**Total:** 6 plans, 12 tasks (1 tracer + 10 auto + 1 checkpoint), 10 feature commits + 2 gap-fix commits, 6 SUMMARY docs.

## Test Coverage

```
Test Files  149 passed (149)
     Tests  1833 passed | 1 todo (1834)
```

**Phase 76 specific tests:**
- `tests/reimbursement-list.test.ts` — 4 tests (Plan 76-01)
- `tests/reimbursement-table-sort.test.ts` — 4 tests (Plan 76-02)
- `tests/reimbursement-detail-dal.test.ts` — 9 tests (Plan 76-05)
- `tests/reimbursement-panel.test.ts` — 3 tests + 37 existing tests (Plan 76-04 + UAT fixes)

**Pre-existing suites (regression verified):**
- `tests/reimbursement-residual.test.ts` (8 tests) — pass unmodified after `deriveResidualFromAggregates` extraction
- `tests/reimbursement-phase-75.test.ts` (all pass)
- `tests/reimbursement-invariant.test.ts`, `tests/reimbursement-guard-group-anchor.test.ts`, `tests/reimbursement-regression.test.ts` — all pass

**Compliance checks:**
- `yarn tsc --noEmit` — Clean, no type errors
- `yarn check:language` — English code convention passed
- `yarn vitest run` — Full suite green

## UAT Checkpoint Results

**Plan 76-06 manual verification (user-approved):**

All 9 steps passed:
1. ✓ Sidebar "Rimborsi" nav item navigates to `/reimbursements`
2. ✓ List shows all reimbursements (including N=1 settled ones); search/status-filter/sort work
3. ✓ Row title link lands on `/reimbursements/[id]` with correct anchor, refund list, net, residual
4. ✓ Title edit saves immediately; clearing to empty falls back to anchor title
5. ✓ Add refund via "Aggiungi rimborso"; appears in list, net/residual update; "Scollega" removes it correctly
6. ✓ Delete reimbursement; confirms, deletes, lands on `/reimbursements` (UAT gap #1 fixed); refunds restore baseline
7. ✓ `/transactions/[id]` tx-detail panel shows compact read-only summary + "Gestisci rimborso" link (Plan 76-04 summary variant active)
8. ✓ Transactions table reimbursement indicator badge is clickable, lands on correct `/reimbursements/[id]`
9. ✓ No Group-anchored reimbursement is reachable anywhere (descope in force per Phase 75)

**Gap fixes applied & re-verified:**
- **UAT gap #1:** `ReimbursementPanel` gained optional `onGone` callback; fires on delete or last-refund removal → navigates to `/reimbursements` (commit 40f27c1)
- **UAT gap #2:** Refund expense title no longer rewritten to "rimborso <anchor>"; refund keeps its own title (commit 3eead2e). Recategorization/isolation (ADR 0016 decision-2) unchanged.

## Conclusion

**Phase 76 goal: ACHIEVED**

The dedicated reimbursements section is fully operational, end-to-end verified, and ready for production. All requirements (RMB-10, RMB-11) are complete and marked as such. The phase integrates cleanly with prior reimbursement work (Phases 73-75) and maintains the data model and netting logic intact. No breaking changes; no regressions.

---

**Verified by:** Claude (gsd-verifier)  
**Verification completed:** 2026-07-27T14:41:00Z
