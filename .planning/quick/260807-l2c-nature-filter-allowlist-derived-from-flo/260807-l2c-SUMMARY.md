---
phase: 260807-l2c
plan: 01
subsystem: validations
tags: [nature-filter, flow-nature, allowlist, tsc-exhaustiveness]
dependency-graph:
  requires: []
  provides:
    - lib/utils/nature-labels.ts:NATURE_FILTER_VALUES
  affects:
    - lib/validations/transactions.ts
    - lib/validations/expense.ts
tech-stack:
  added: []
  patterns:
    - "Record<Union, true> exhaustiveness object as a compiler-enforced single source of truth for a derived allowlist"
key-files:
  created:
    - tests/nature-filter-allowlist.test.ts
  modified:
    - lib/utils/nature-labels.ts
    - lib/validations/transactions.ts
    - lib/validations/expense.ts
decisions:
  - "NATURE_FILTER_VALUES derived from a module-private FLOW_NATURE_MEMBERS: Record<FlowNature, true> so tsc fails on any future FlowNature drift (addition = missing-property, removal = excess-property)"
  - "No legacy-alias layer for the three dead codes (operational/financial/extraordinary) — they were never reachable via any real UI control, so dropping them changes nothing observable"
metrics:
  duration: "~25 min"
  completed: 2026-08-07
status: complete
actuals:
  tokens: 8000
  tasks: 2
  commits: 2
---

# Phase 260807-l2c Plan 01: Nature filter allowlist derived from FlowNature Summary

Fixed `?nature=savings` and `?nature=investment` being silently dropped on `/transactions` and
`/expenses` by replacing two hand-maintained, out-of-sync `NATURE_ALLOWED` literals with a single
`NATURE_FILTER_VALUES` constant derived from the `FlowNature` union via a compiler-checked
`Record<FlowNature, true>` exhaustiveness object.

## What Changed

**`lib/utils/nature-labels.ts`** — added a module-private `FLOW_NATURE_MEMBERS: Record<FlowNature, true>`
directly below the `FlowNature` type export, with all 8 live keys mapped to `true`. Exported
`NATURE_FILTER_VALUES: readonly string[]`, built from `Object.keys(FLOW_NATURE_MEMBERS)` plus the
`'unclassified'` sentinel. `NATURE_LABELS`, `NATURE_ORDER`, `NATURE_COLORS` untouched.

**`lib/validations/transactions.ts`** — deleted the local `NATURE_ALLOWED` literal (had
`operational`/`financial`/`extraordinary` dead codes, was missing `savings`/`investment`);
`parseStatus(input.nature, ...)` now reads `NATURE_FILTER_VALUES` imported from
`@/lib/utils/nature-labels`.

**`lib/validations/expense.ts`** — same fix: deleted the duplicated `NATURE_ALLOWED` literal,
wired in `NATURE_FILTER_VALUES`. `TYPE_ALLOWED` (the unrelated direction-type filter axis) left
completely untouched.

**`tests/nature-filter-allowlist.test.ts`** (new) — Task 1 added four smoke assertions proving
the bug fix (`savings`/`investment` now parsed by both `parseTransactionFilters` and
`parseExpenseFilters`). Task 2 replaced those with a full `it.each` matrix: all 8 `FlowNature`
codes + `'unclassified'` accepted by both parsers (hardcoded literal list, deliberately not
imported from `NATURE_FILTER_VALUES`, so a typo inside `FLOW_NATURE_MEMBERS` can't make the test
self-referentially pass), plus rejection coverage for the 3 dead codes and one garbage value on
both parsers. 26 assertions total (18 accept + 8 reject).

## Exhaustiveness Proof (per environment_notes)

Before committing Task 1, temporarily removed the `investment: true` key from
`FLOW_NATURE_MEMBERS` and re-ran `tsc --noEmit`:

```
lib/utils/nature-labels.ts(18,7): error TS2741: Property 'investment' is missing in type
'{ essential: true; discretionary: true; income: true; income_extraordinary: true; debt: true;
transfer: true; savings: true; }' but required in type 'Record<FlowNature, true>'.
```

Confirmed the failure mode described in the doc comment (missing-property error on removal
without updating the union). Reverted the temporary edit; `tsc --noEmit` passed clean again
before staging/committing. No temporary edit was left in the tree or the commit — verified via
`git diff` on the file immediately after revert.

## Verification

- `node_modules/.bin/tsc --noEmit` — passes.
- `node_modules/.bin/vitest run tests/nature-filter-allowlist.test.ts tests/transaction-filters-direction.test.ts tests/expense-filters-months.test.ts` — 3 files, 41 tests, all green (26 new + 8 direction + 7 months, no regression on the shared validation files).
- `yarn check:language` — "English code convention check passed."

## Deviations from Plan

None — plan executed exactly as written.

One minor observational note (not a deviation, no fix needed): the plan's `<done>` criterion for
Task 2 states "12 + 8 = 20 assertions total." The actual coverage matches the `<action>` block's
literal spec exactly (9 live values × 2 parsers = 18 accept assertions, 4 rejected values × 2
parsers = 8 reject assertions = 26 total) — the plan's own arithmetic summary undercounts the
9-value accept list (8 FlowNature codes + `'unclassified'`) as if it were 6. The functional
requirement (all live codes + unclassified accepted, all dead codes + garbage rejected, both
parsers) is fully satisfied; only the plan's arithmetic gloss was off.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: lib/utils/nature-labels.ts (NATURE_FILTER_VALUES export present)
- FOUND: lib/validations/transactions.ts (imports NATURE_FILTER_VALUES, no local NATURE_ALLOWED)
- FOUND: lib/validations/expense.ts (imports NATURE_FILTER_VALUES, no local NATURE_ALLOWED)
- FOUND: tests/nature-filter-allowlist.test.ts
- FOUND commit 8390805d (Task 1: feat)
- FOUND commit 7420b5f9 (Task 2: test)
