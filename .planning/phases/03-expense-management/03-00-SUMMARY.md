---
phase: 03-expense-management
plan: "00"
subsystem: prerequisites
tags: [test-stubs, shadcn, sonner, decimal, wave-0]
dependency_graph:
  requires: []
  provides:
    - tests/expenses.spec.ts — Playwright fixme stubs for EXP-01/02/03
    - components/ui/table.tsx — shadcn Table component for expense list
    - app/layout.tsx — global Toaster for toast feedback
    - lib/utils/decimal.ts — toDecimal/toDbDecimal for monetary arithmetic
  affects:
    - Phase 3 plans 01-04 (consume Table component + Toaster)
    - Phase 5 (consumes toDecimal/toDbDecimal for import amount handling)
tech_stack:
  added:
    - sonner ^2.0.7 — toast notification library
  patterns:
    - TDD-first: test stubs created before any implementation (fixme pattern)
    - shadcn new-york style with data-slot attributes
    - Decimal.js wrapper pattern (toDecimal/toDbDecimal) for DB DECIMAL safety
key_files:
  created:
    - tests/expenses.spec.ts
    - components/ui/table.tsx
    - lib/utils/decimal.ts
  modified:
    - app/layout.tsx (Toaster added)
    - package.json (sonner added)
    - yarn.lock (sonner resolution added)
decisions:
  - table.tsx created from official shadcn CLI output (shadcn add table), not hand-written
  - sonner installed via yarn add (not pre-existing in package.json)
  - lib/utils/decimal.ts placed in lib/utils/ subdirectory (not in lib/utils.ts) to keep monetary utils isolated and importable as @/lib/utils/decimal
metrics:
  duration: ~12 minutes
  completed: 2026-04-27T20:02:30Z
  tasks_completed: 3
  files_created: 3
  files_modified: 3
---

# Phase 3 Plan 00: Wave 0 Prerequisites Summary

**One-liner:** Playwright EXP-01/02/03 test stubs + shadcn Table + Sonner Toaster + Decimal.js wrapper utils for Phase 3 wave-0 bootstrap.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create expenses.spec.ts with 8 fixme stubs | b5026e6 | tests/expenses.spec.ts |
| 2 | Install shadcn Table + wire Sonner Toaster | 4432d97 | components/ui/table.tsx, app/layout.tsx, package.json, yarn.lock |
| 3 | Create lib/utils/decimal.ts (STATE.md blocker) | b9d7635 | lib/utils/decimal.ts |

## Verification Results

```
grep -c "test.fixme" tests/expenses.spec.ts   → 8  ✓
grep "Toaster" app/layout.tsx                  → 2 matches (import + JSX)  ✓
test -f components/ui/table.tsx                → OK  ✓
grep "toDecimal|toDbDecimal" lib/utils/decimal.ts → 2 function exports  ✓
npx tsc --noEmit                               → 0 errors  ✓
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] sonner not in package.json**
- **Found during:** Task 2 — `app/layout.tsx` requires `import { Toaster } from 'sonner'` but sonner was not a declared dependency
- **Fix:** Ran `yarn add sonner` (installed 2.0.7), updated package.json and yarn.lock in the worktree to match
- **Files modified:** package.json, yarn.lock
- **Commit:** 4432d97

**2. [Rule 3 - Blocking] shadcn CLI not available via npx in worktree context**
- **Found during:** Task 2 — `npx shadcn@latest add table` failed in worktree; used `./node_modules/.bin/shadcn add table --yes` in main repo instead
- **Fix:** Ran shadcn CLI on main repo, copied the generated output (official shadcn version with `"use client"`, `has-aria-expanded` class) to worktree
- **Files modified:** components/ui/table.tsx
- **Commit:** 4432d97

## Known Stubs

All test stubs in `tests/expenses.spec.ts` are intentional `test.fixme()` placeholders per the plan contract. They are not blocking — they will be implemented in Plan 04 (page + components).

No data stubs exist in production code.

## Threat Flags

No new trust boundaries introduced. Wave 0 creates test stubs and utility files only — no user input, no DB access, no API surface.

## Self-Check: PASSED

- tests/expenses.spec.ts: FOUND
- components/ui/table.tsx: FOUND
- lib/utils/decimal.ts: FOUND
- app/layout.tsx (Toaster): FOUND
- Commits b5026e6, 4432d97, b9d7635: FOUND
