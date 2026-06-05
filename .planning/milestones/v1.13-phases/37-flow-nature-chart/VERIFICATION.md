---
phase: 37-flow-nature-chart
verified: 2026-05-26T08:19:07Z
status: human_needed
score: 9/9
overrides_applied: 0
human_verification:
  - test: "Navigate to /dashboard/overview; click a legend item (e.g. Essenziale)"
    expected: "URL updates to ?hidden=essential; that nature's bars disappear. Clicking again removes ?hidden= entirely."
    why_human: "URL-persistence and visual toggle requires a running browser session."
  - test: "Load /dashboard/overview?hidden=debt,discretionary on first paint"
    expected: "Both segments are already hidden with no flicker — state is read from URL before render."
    why_human: "SSR hydration behaviour cannot be verified by grep."
  - test: "Non classificato segment: navigate to overview with a subcategory that has null effectiveNature and real expenses"
    expected: "A 'Non classificato' bar segment appears in the chart and the legend item is present."
    why_human: "Conditional rendering (unclassifiedHasData) depends on live data, not static analysis."
  - test: "Navigate to /settings/categories; change the nature of a system subcategory via the inline Select"
    expected: "The change persists on reload; navigating to /dashboard/overview shows the subcategory's amount moved into the new nature segment."
    why_human: "Cross-surface revalidation chain (setSubcategoryNatureAction -> revalidateCategorizationSurfaces -> /dashboard) requires a live DB and dev server."
  - test: "Create a personal subcategory without selecting a nature"
    expected: "Form rejects the submission with a validation error."
    why_human: "Form validation UX (error display) requires a running browser."
---

# Phase 37: flow-nature-chart Verification Report

**Phase Goal:** Add `nature` enum column to `sub_category`; evolve `EntrateUsciteChart` into a stacked nature-segmented chart with URL-persisted toggles; seed system subcategories with default natures; expose nature override in `/settings/categories`.
**Verified:** 2026-05-26T08:19:07Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `nature` nullable enum column exists on `sub_category` and `user_subcategory_override` | VERIFIED | `schema.ts:191` — `flowNatureEnum("nature")` on `subCategory`; `schema.ts:216` on `userSubcategoryOverride` |
| 2 | Drizzle migration exists for `flow_nature` enum and `nature` columns | VERIFIED | `drizzle/migrations/0012_flow_nature.sql` — creates `flow_nature` enum, adds `nature` to both tables |
| 3 | System subcategories seeded with default natures in `seed-data.ts` | VERIFIED | 126 `nature:` fields across ~124 subcategory entries; 2 system entries (`trasferimento`, `addebito-carta-di-credito`) correctly set to `null` |
| 4 | `EntrateUsciteChart` renders stacked bars grouped by nature (algebraic sums, no ABS) | VERIFIED | `entrate-uscite-chart.tsx:127-135` — `visibleKeys.map(key => <Bar stackId="a" ...>)`; no `Math.abs` or ABS anywhere in the file |
| 5 | Nature toggle via URL `?hidden=` param, persisted via `router.replace` + `startTransition` | VERIFIED | `entrate-uscite-chart.tsx:90-110` — full `toggleNature` implementation; `router.replace` + `startTransition` + `scroll: false`; empty set removes param |
| 6 | Null nature renders as "Non classificato" segment (conditional on data) | VERIFIED | `entrate-uscite-chart.tsx:69-76` — `unclassifiedHasData` guard; `NATURE_LABELS['unclassified'] = 'Non classificato'` in `nature-labels.ts`; test at `dashboard-charts.test.tsx:59-62` asserts label present |
| 7 | `MonthlyNatureTrendPoint` type and `getMonthlyTrendByNature` DAL function group by nature algebraically | VERIFIED | `dashboard.ts:135-141` — type definition; `dashboard.ts:1257-1299` — query with `COALESCE(override.nature, sub.nature)`, `.groupBy(monthSql, natureSql)`; `buildMonthlyNatureTrendData` aggregates with `toDecimal().plus()` |
| 8 | Nature field exposed and editable in `/settings/categories` | VERIFIED | `subcategory-nature-select.tsx` (55 lines, `'use client'`, calls `setSubcategoryNatureAction`); wired in `category-settings-panel.tsx:164-166`; `CreateSubcategoryDialog` has required nature Select with `defaultValue="discretionary"` |
| 9 | Transfer flows excluded via `excludeFromTotals` / `ignore` — no new nature type | VERIFIED | `getMonthlyTrendByNature` at line 1289-1290 applies both `notExcludedFromTotals()` and `notIgnoredCategory()`; `seed.ts:76-80` sets `excludeFromTotals=true` for `ricariche-conti` and `addebito-carta-di-credito` |

**Score:** 9/9 truths verified

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R-FN-01 | 37-02 | `nature` nullable enum on `sub_category` | SATISFIED | `schema.ts:191` — `flowNatureEnum("nature")` nullable |
| R-FN-02 | 37-02 | Drizzle migration for `nature` column | SATISFIED | `drizzle/migrations/0012_flow_nature.sql` |
| R-FN-03 | 37-02 | System subcategories seeded with default natures | SATISFIED | 126 nature entries in `seed-data.ts` |
| R-FN-04 | 37-04 | `EntrateUsciteChart` replaced by stacked nature chart | SATISFIED | Fully rewritten; stacked `Bar` per `NATURE_ORDER` |
| R-FN-05 | 37-04 | URL `?hidden=` toggle persisted | SATISFIED | `toggleNature` writes via `router.replace`; `startTransition` |
| R-FN-06 | 37-04 | Null nature as "Non classificato" segment | SATISFIED | `unclassifiedHasData` guard + `NATURE_LABELS` |
| R-FN-07 | 37-05 | Nature field in `/settings/categories` (create + edit) | SATISFIED | `SubcategoryNatureSelect` + `CreateSubcategoryDialog` |
| R-FN-08 | 37-03 | `MonthlyNatureTrendPoint` / DAL groups by nature | SATISFIED | `getMonthlyTrendByNature` with algebraic accumulation |
| R-FN-09 | 37-03 | Transfer flows excluded (no new nature type) | SATISFIED | `notExcludedFromTotals()` + `notIgnoredCategory()` in query |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/db/schema.ts` | `flowNatureEnum`, `nature` on `sub_category` and `user_subcategory_override` | VERIFIED | Lines 52-59, 191, 216 |
| `drizzle/migrations/0012_flow_nature.sql` | Migration adding flow_nature enum and nature columns | VERIFIED | Present; 4-statement migration |
| `scripts/seed-data.ts` | `nature` on all subcategories | VERIFIED | 126 nature entries covering all system subcategories |
| `lib/utils/nature-labels.ts` | `FlowNature`, `NATURE_LABELS`, `NATURE_ORDER`, `NATURE_COLORS` | VERIFIED | All 4 exports present; 7-entry label map including `unclassified` |
| `lib/dal/dashboard.ts` | `getMonthlyTrendByNature`, `MonthlyNatureTrendPoint` | VERIFIED | Type at line 135; function at line 1257; builder at line 660 |
| `components/dashboard/entrate-uscite-chart.tsx` | Stacked nature chart, URL-persisted toggle, `>= 80 lines` | VERIFIED | 139 lines; full implementation |
| `lib/actions/categories.ts` | `setSubcategoryNatureAction` | VERIFIED | Line 143; gated by `verifySession()` + Zod |
| `lib/dal/categories.ts` | `upsertSubcategoryNatureOverride`, `effectiveNature` in `getCategoriesForUser` | VERIFIED | Line 246; COALESCE at line 79 |
| `components/categories/subcategory-nature-select.tsx` | Inline Select bound to `setSubcategoryNatureAction`, `>= 30 lines` | VERIFIED | 55 lines; full implementation |
| `components/categories/category-mutation-dialogs.tsx` | `CreateSubcategoryDialog` with required nature field | VERIFIED | `name="nature"` hidden input at line 166; visible Select at 173 |
| `app/(app)/dashboard/overview/page.tsx` | `Promise.all` of both DAL calls; `EntrateUsciteChart` receives `natureTrend` | VERIFIED | Lines 25-28; `<EntrateUsciteChart data={natureTrend} />` at line 36 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `entrate-uscite-chart.tsx` | `lib/utils/nature-labels.ts` | `import NATURE_ORDER, NATURE_LABELS, NATURE_COLORS` | WIRED | Line 15 |
| `entrate-uscite-chart.tsx` | `lib/dal/dashboard.ts` | `import MonthlyNatureTrendPoint` | WIRED | Line 16 |
| `entrate-uscite-chart.tsx` | URL `?hidden=` param | `router.replace` + `startTransition` | WIRED | Lines 107-109 |
| `overview/page.tsx` | `lib/dal/dashboard.ts` | `getMonthlyTrendByNature` in `Promise.all` | WIRED | Lines 2, 27 |
| `subcategory-nature-select.tsx` | `lib/actions/categories.ts` | `setSubcategoryNatureAction` on `onValueChange` | WIRED | Lines 13, 27 |
| `category-settings-panel.tsx` | `subcategory-nature-select.tsx` | `<SubcategoryNatureSelect effectiveNature={...}>` per row | WIRED | Lines 22, 164-166 |
| `lib/actions/categories.ts` | `lib/dal/categories.ts` | `upsertSubcategoryNatureOverride` | WIRED | Lines 14, 157 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `entrate-uscite-chart.tsx` | `data: MonthlyNatureTrendPoint[]` | `getMonthlyTrendByNature` in `overview/page.tsx` | Yes — DB query groups transactions by `COALESCE(override.nature, sub.nature)` | FLOWING |
| `category-settings-panel.tsx` | `subCategory.effectiveNature` | `getCategoriesForUser` via `COALESCE(override.nature, sub.nature)` | Yes — live DB join | FLOWING |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX/placeholder markers found in phase files | — | — |

No stub indicators found. All implementations are substantive and connected.

### Human Verification Required

All 9 automated truths pass. The following require a running dev server and browser to confirm end-to-end behaviour:

#### 1. Legend toggle updates URL

**Test:** Navigate to `/dashboard/overview`; click a legend item (e.g. "Essenziale").
**Expected:** URL updates to `?hidden=essential`; that nature's bars disappear visually. Clicking again removes `?hidden=` entirely from the URL.
**Why human:** Visual bar rendering and URL mutation via `router.replace` cannot be verified by grep.

#### 2. First-paint URL persistence (no hydration flicker)

**Test:** Load `/dashboard/overview?hidden=debt,discretionary` directly in the browser.
**Expected:** Both segments are hidden immediately on first paint without flicker.
**Why human:** SSR hydration behaviour with `useSearchParams` requires browser observation.

#### 3. Non classificato segment conditional visibility

**Test:** Ensure at least one subcategory has `effectiveNature = null` and carries real expenses, then visit `/dashboard/overview`.
**Expected:** A "Non classificato" segment appears in the stacked chart and in the legend. When no such expenses exist, the segment and legend item are absent.
**Why human:** `unclassifiedHasData` depends on live data; cannot be verified statically.

#### 4. Nature override propagates to chart

**Test:** In `/settings/categories`, change the nature of a system subcategory from its seed default to a different value (e.g. `essential` → `debt`) via the inline Select.
**Expected:** On reload of `/dashboard/overview`, the subcategory's transaction amounts move from the `Essenziale` segment to the `Debiti` segment.
**Why human:** Cross-surface revalidation chain (`setSubcategoryNatureAction` → `revalidateCategorizationSurfaces` → `/dashboard`) requires a live DB.

#### 5. Nature required on subcategory creation

**Test:** Open the "Nuova sottocategoria" dialog, fill in the name, and attempt to submit without selecting a nature.
**Expected:** The form rejects with a validation error (inline or toast).
**Why human:** Form validation UX feedback (error display) requires a running browser.

### Gaps Summary

No gaps found. All 9 requirements are fully implemented, wired, and the data flows are connected end-to-end. Five items require human smoke-testing in a running dev server before the phase can be marked fully closed.

---

_Verified: 2026-05-26T08:19:07Z_
_Verifier: Claude (gsd-verifier)_
