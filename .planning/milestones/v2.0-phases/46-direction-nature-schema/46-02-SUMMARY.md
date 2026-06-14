---
phase: "46"
plan: "02"
subsystem: "dal/services/components/tests"
tags: ["typecheck", "compile-only", "schema-migration", "adr-0012"]
dependency_graph:
  requires: ["46-01"]
  provides: ["typecheck-green", "build-green"]
  affects: ["dal", "services", "actions", "components", "scripts", "tests"]
tech_stack:
  added: []
  patterns:
    - "minimum-compile: sql<T>`raw_sql` placeholders for removed columns"
    - "natureId subquery: COALESCE(override.natureId, sub.natureId) → nature.code"
    - "TODO(Phase 49) markers on all semantic-deferred call sites"
key_files:
  created: []
  modified:
    - lib/utils/nature-labels.ts
    - lib/dal/transactions.ts
    - lib/dal/expenses.ts
    - lib/dal/categories.ts
    - lib/dal/subcategory-usage.ts
    - lib/dal/patterns.ts
    - lib/validations/pattern.ts
    - lib/services/categorization.ts
    - lib/services/pattern-application.ts
    - lib/actions/patterns.ts
    - lib/utils/pattern-suggestions.ts
    - lib/dal/dashboard.ts
    - lib/dal/overview.ts
    - lib/actions/categories.ts
    - lib/validations/category.ts
    - lib/utils/cascade-options.ts
    - components/categories/category-pattern-panel.tsx
    - components/categories/category-settings-panel.tsx
    - components/dashboard/overview/overview-chart-filters.tsx
    - components/dashboard/overview/overview-chart-utils.ts
    - components/patterns/pattern-actions.tsx
    - components/transactions/transaction-table.tsx
    - scripts/seed-extras.ts
    - tests/categories-dal.test.ts
    - tests/category-settings-seed.ts
    - tests/dashboard-dal.test.ts
    - tests/import-service.test.ts
    - tests/nature-labels.test.ts
    - tests/overview-interactions.test.tsx
    - tests/pattern-suggestion-detector.test.ts
    - tests/pattern-validation.test.ts
    - tests/patterns-amount-sign.test.ts
    - tests/sidebar-provider.test.tsx
decisions:
  - "FlowNature v2.0: 8 codes (extraordinary→savings, financial→investment, operational dissolved)"
  - "Minimum-compile only: all semantic rewrites deferred to Phase 49 per D-05"
  - "natureId subquery pattern for SQL aggregations (dashboard/overview)"
  - "category.type comparisons in components replaced with amount-sign fallback"
  - "seed-extras.ts historical steps use raw SQL to avoid removed column references"
metrics:
  duration: "~3 hours (across 2 sessions)"
  completed_date: "2026-06-11"
  tasks_completed: 3
  files_changed: 33
---

# Phase 46 Plan 02: Direction-Nature Schema — Compile Repair Summary

Make the entire repository typecheck (`yarn tsc --noEmit` exits 0) and build GREEN against the new schema authored in Plan 46-01.

## What Was Built

TypeScript compile repair across 33 files. Plan 46-01 removed `category.type`, `subCategory.nature` (flowNatureEnum), `userSubcategoryOverride.nature`, `categorizationPattern.amountSign`, and the three deprecated enums. Plan 46-02 repairs every call site with minimum edits — stale behavior marked `// TODO(Phase 49)`, no aggregation rewrite, no semantic changes.

## Tasks

### Task 1 — DAL filter queries (nature join)

Files: `lib/utils/nature-labels.ts`, `lib/dal/transactions.ts`, `lib/dal/expenses.ts`, `lib/dal/categories.ts`, `lib/dal/subcategory-usage.ts`

- `FlowNature` union reduced to 8 v2.0 codes: `essential`, `discretionary`, `income`, `income_extraordinary`, `debt`, `transfer`, `savings`, `investment`
- `NATURE_LABELS`, `NATURE_ORDER`, `NATURE_COLORS` updated (9 entries including `unclassified`)
- `transactions.ts` / `expenses.ts`: added `leftJoin(nature, eq(subCategory.natureId, nature.id))`; nature and type filters now use `eq(nature.code, ...)`
- `categories.ts`: `CategoryWithSubCategories.type` is now `string | null`; `createUserSubcategory` input changed to `natureId?: number | null`; `upsertSubcategoryNatureOverride` parameter is `{ natureId: number | null }`
- `subcategory-usage.ts`: `category.type` filter removed; `_allowedTypes` unused placeholder

Commit: `eae2eee`

### Task 2 — amountSign removal + dashboard/overview SQL repair

Files: `lib/dal/patterns.ts`, `lib/validations/pattern.ts`, `lib/services/categorization.ts`, `lib/services/pattern-application.ts`, `lib/actions/patterns.ts`, `lib/utils/pattern-suggestions.ts`, `lib/dal/dashboard.ts`, `lib/dal/overview.ts`

- `categorizationPattern.amountSign` removed from all producers/consumers
- `deriveAmountSign` function removed from `lib/validations/pattern.ts`
- `ActivePattern` type has no `amountSign`; `CoveragePattern` has no `amountSign`
- `applyTier1Regex` and `isCoveredByPatterns` are now regex-only (sign-agnostic per ADR 0012)
- `dashboard.ts`: `buildMonthlyNatureTrendData` updated to v2.0 nature codes (9 segments); `getAggregatedTransactionsData` uses `subCategory.natureId` subquery for transfer detection; `getMonthlyTrendByNature` uses `COALESCE(override.natureId, sub.natureId) → nature.code` subquery
- `overview.ts`: `natureSql` uses same subquery pattern; `notTransferCategory()` uses `nature.code` via `natureId` join

Commit: `0320f26`

### Task 3 — actions, components, scripts, tests

Files: actions, components, cascade-options, seed-extras, 10 test files

- `lib/actions/categories.ts`: `setSubcategoryNatureAction` passes `natureId: null` (TODO Phase 49); `createSubcategoryAction` drops `nature` field from parse
- `lib/validations/category.ts`: `NatureSchema` updated to 8 v2.0 codes; `CreateSubcategorySchema` drops `nature` field
- `lib/utils/cascade-options.ts`: null-guard on `cat.type` (now `string | null`)
- Components: `category-pattern-panel` removes amountSign column; `category-settings-panel` uses `Record<string, string>` type for TYPE_LABELS; `overview-chart-utils` OUT_KEYS updated to v2.0; `overview-chart-filters` maps updated; `pattern-actions` removes amountSign from Props; `transaction-table` uses amount-sign fallback for color (TODO Phase 49)
- `scripts/seed-extras.ts`: all `subCategory.nature`, `category.type`, `categorizationPattern.amountSign` references replaced with `database.execute(sql\`...\`)` raw SQL
- Tests: `amountSign` removed from `ActivePattern` literals and `CoveragePattern`; FlowNature codes updated to v2.0; `deriveAmountSign` test rewritten to assert removal; nature-labels test updated to 8+1 codes

Commit: `5acc1b5`

## Verification Gates

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | PASS — 0 errors |
| `npx next build` | PASS — Compiled successfully (Turbopack) |
| `yarn check:language` | PARTIAL — 6 pre-existing failures in unmodified files (see Deferred Items) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FlowNature v2.0 codes in NATURE_SLUGS record**
- Found during: Task 3 seed-extras.ts
- Issue: `extraordinary` and `operational` keys no longer match `FlowNature` type
- Fix: renamed `extraordinary → savings`, `financial → investment`, removed `operational` entries
- Files modified: `scripts/seed-extras.ts`
- Commit: `5acc1b5`

**2. [Rule 1 - Bug] sidebar-provider.test.tsx cast error**
- Found during: Task 3
- Issue: `capturedCtx as NonNullable<typeof capturedCtx>` collapsed to `never` type
- Fix: changed to `capturedCtx as unknown as { collapsed: boolean; setCollapsed: ... }`
- Files modified: `tests/sidebar-provider.test.tsx`
- Commit: `5acc1b5`

**3. [Rule 2 - Missing] seed-extras.ts historical steps use raw SQL**
- Found during: Task 3
- Issue: Steps 1-5 reference removed Drizzle columns (`subCategory.nature`, `category.type`, `categorizationPattern.amountSign`)
- Fix: wrapped all such SET clauses in `database.execute(sql\`UPDATE ...\`)` to bypass Drizzle type checking while preserving historical step idempotency
- Note: Steps are already executed in production; raw SQL is forward-compatible
- Files modified: `scripts/seed-extras.ts`
- Commit: `5acc1b5`

## Deferred Items

These pre-existing `check:language` failures exist in files NOT touched by this plan. Out of scope per deviation rule scope boundary:

- `tests/subcategory-picker.test.tsx:207` — Italian term in pre-existing comment
- `tests/suggestion-promote-form.test.tsx:72,81,83,84,85` — Italian terms in pre-existing comments

Tracked for future fix outside this phase.

## Known Stubs

All stubs are intentional minimum-compile placeholders per D-05 (semantic rewrites deferred to Phase 49):

| Stub | File | Reason |
|------|------|--------|
| `categoryType: category.id` (number FK placeholder) | `lib/dal/transactions.ts` | Direction semantics not yet wired |
| `typeFilter = sql\`true\`` | `lib/dal/dashboard.ts` (multiple functions) | category.type removed; direction join Phase 49 |
| `isTransfer = false` | `components/transactions/transaction-table.tsx` | Transfer detection via direction join Phase 49 |
| `amountColorClass` uses sign-only fallback | `components/transactions/transaction-table.tsx` | direction-based color Phase 49 |
| `natureId: null` in setSubcategoryNatureAction | `lib/actions/categories.ts` | nature code → natureId lookup Phase 49 |

## Self-Check: PASSED

- `eae2eee` — Task 1 commit exists
- `0320f26` — Task 2 commit exists
- `5acc1b5` — Task 3 commit exists
- `npx tsc --noEmit` → 0 errors confirmed
- `npx next build` → Compiled successfully confirmed
