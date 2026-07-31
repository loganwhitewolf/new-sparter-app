---
phase: 260731-hhv
plan: 02
subsystem: ui
tags: [categories, seed-sequence, onboarding, dashboard, expenses, month-multi, kpi]

requires:
  - phase: 260731-hhv-01
    provides: contrast tokens, onboarding stepper/dropzone, categorize contrast
provides:
  - Working "Crea categoria" via category_id_seq heal + seed setval
  - Welcome single CTA
  - Hidden empty pattern-suggestions box
  - Expenses month-multi filter (D-11 override)
  - Clickable Entrate/Uscite KPI cards
affects: [260731-hhv-03]

tech-stack:
  added: []
  patterns:
    - Stale serial heal on pkey 23505 + seed setval after explicit-id inserts
    - month-multi on expenses via EXISTS on member transaction.occurredAt

key-files:
  created:
    - tests/expense-filters-months.test.ts
  modified:
    - lib/dal/categories.ts
    - scripts/seed.ts
    - scripts/seed-extras.ts
    - app/(app)/onboarding/_components/step-5-outro.tsx
    - app/(app)/import/[fileId]/suggestions/page.tsx
    - app/(app)/expenses/expenses.table.ts
    - app/(app)/expenses/page.tsx
    - lib/validations/expense.ts
    - lib/dal/expenses.ts
    - lib/dal/months-with-data.ts
    - components/dashboard/overview/kpi-card-reading.tsx
    - components/dashboard/overview/kpi-row.tsx
    - components/dashboard/overview/overview-dashboard-section.tsx
    - app/(app)/dashboard/overview/page.tsx

key-decisions:
  - "3.7 root cause was stale category_id_seq after seed explicit ids — not Zod/UI"
  - "3.2 OverviewNudge already linked to uncategorized — verify-only, no code change"
  - "3.5 filters expenses by member transaction occurredAt (not expense.createdAt)"
  - "D-11 no-temporal-filter lock overridden by contract 3.5 / quick 260731-hhv"

patterns-established:
  - "Slug-only 23505 → duplicate Italian; category_pkey → setval + retry"
  - "seed-extras append-only step sync-category-serial-sequences for existing DBs"

requirements-completed: [3.7, 3.1, 3.2, 3.3, 3.5, 3.6]

coverage:
  - id: D1
    description: Crea categoria succeeds after serial heal (bug 3.7)
    requirement: "3.7"
    verification:
      - kind: unit
        ref: tests/categories-dal.test.ts#heals stale category_id_seq
        status: pass
      - kind: unit
        ref: tests/category-actions.test.ts#does not mislabel primary-key
        status: pass
    human_judgment: false
  - id: D2
    description: Welcome single CTA Vai alla dashboard
    requirement: "3.1"
    verification:
      - kind: unit
        ref: tests/step-5-outro.test.tsx#single CTA
        status: pass
    human_judgment: false
  - id: D3
    description: OverviewNudge uncategorized link verified (D-01 / 3.2)
    requirement: "3.2"
    verification:
      - kind: unit
        ref: tests/overview-interactions.test.tsx#3.2 / D-01
        status: pass
    human_judgment: false
  - id: D4
    description: Empty pattern suggestions box hidden
    requirement: "3.3"
    verification:
      - kind: unit
        ref: tests/import-suggestions-page.test.tsx#empty state hides box
        status: pass
    human_judgment: false
  - id: D5
    description: Expenses month-multi filter
    requirement: "3.5"
    verification:
      - kind: unit
        ref: tests/expense-filters-months.test.ts
        status: pass
      - kind: unit
        ref: tests/expenses-dal.test.ts#months filter EXISTS
        status: pass
    human_judgment: false
  - id: D6
    description: Entrate/Uscite KPI cards clickable to categories
    requirement: "3.6"
    verification:
      - kind: unit
        ref: tests/overview-interactions.test.tsx#3.6 Entrate and Uscite
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-07-31
status: complete
---

# Phase 260731-hhv Plan 02: Welcome/Dashboard PRONTO + bug Crea categoria Summary

**Fixed Crea categoria by healing a desynced `category_id_seq`, then shipped welcome CTA, empty-suggestions hide, expenses month-multi, and clickable Entrate/Uscite KPIs.**

## Performance

- **Duration:** 9 min
- **Tasks:** 4/4
- **Commits:** 4 (code+tests only; docs not committed per orchestrator)

## Accomplishments

- **3.7:** Root cause = seed inserts categories with explicit ids without `setval('category_id_seq')`. Next insert hit `category_pkey` 23505; `mapDuplicate` mislabeled it as “nome già esistente”. Fixed with DAL setval+retry, seed `setval`, and seed-extras step `sync-category-serial-sequences`.
- **3.1:** Welcome keeps only “Vai alla dashboard”.
- **3.2 / D-01:** Verified `OverviewNudge` already links to `/transactions?status=uncategorized&months=…` with dismiss X — **no code change**.
- **3.3:** Removed “Nessun suggerimento trovato” empty box; kept `ProceedToImportsCta` + tag suggestions.
- **3.5:** Expenses toolbar month-multi; D-11 comment overridden; filter via EXISTS on member `transaction.occurredAt`; `getMonthsWithData('expenses')`.
- **3.6:** Entrate/Uscite cards → `buildDashboardCategoriesHref({ type: 'in'|'out', … })`; Bilancio copy untouched.

## Task Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `f9e848b0` | fix(260731-hhv-02): heal stale category_id_seq for Crea categoria (3.7) |
| 2 | `d334f499` | feat(260731-hhv-02): welcome single CTA, hide empty pattern suggestions (3.1/3.3) |
| 3 | `7fa0b690` | feat(260731-hhv-02): add month-multi filter to expenses (3.5) |
| 4 | `572a7bcd` | feat(260731-hhv-02): make Entrate/Uscite KPI cards navigable (3.6) |

## 3.2 verify result

**Already correct — skipped code change.**

`components/dashboard/overview/overview-nudge.tsx` wraps “Movimenti da categorizzare” in `<Link href={/transactions?status=uncategorized&months=YYYY-MM,…}>` and keeps the dismiss button. Locked by `tests/overview-interactions.test.tsx` source assertion.

## 3.7 root cause

| | |
|---|---|
| **Symptom** | “Crea categoria” showed duplicate-name (or generic) error for new unique names |
| **Cause** | `category_id_seq.last_value` stuck at 1 while `MAX(category.id)=33` after seed with explicit ids and no setval |
| **Why Italian “duplicate”** | All `23505` (including `category_pkey`) mapped to slug-duplicate message |
| **Fix** | Slug-only → duplicate; `category_pkey` → setval + retry; seed + seed-extras sync sequences |

Local repro (before heal): `INSERT … RETURNING` → `23505 category_pkey Key (id)=(1)`. After setval → insert id 34 OK.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical] Seed omitted category/subcategory setval**
- **Found during:** Task 1 reproduce
- **Issue:** `scripts/seed.ts` setval’d direction/nature/platform but not category/sub_category
- **Fix:** Added setval after those inserts + additive seed-extras step
- **Commit:** `f9e848b0`

None other — plan otherwise executed as written.

## Known Stubs

None.

## Threat Flags

None new beyond existing authenticated category CRUD and dashboard navigation.

## Self-Check: PASSED

- [x] `lib/dal/categories.ts` heal path present
- [x] Commits `f9e848b0`, `d334f499`, `7fa0b690`, `572a7bcd` on `gsd/quick-260730-o82-tx-direction-multi`
- [x] Wave 01 commits not reverted
- [x] Docs SUMMARY written; not committed (per wave instructions)
