# Deferred items — quick task 260615-dtm

Out-of-scope discoveries found during execution. NOT fixed (SCOPE BOUNDARY rule).

## Pre-existing tsc errors (unrelated to this task)

Confirmed present on clean HEAD (verified by stashing this task's changes and re-running `npx tsc --noEmit`). 6 errors total, none in files touched by this task:

- `tests/cascade-options.test.ts` (lines 125, 162, 397, 408) — `TS18050: The value 'null' cannot be used here.`
- `tests/category-combobox.test.tsx` (lines 70, 129) — `TS2322: Type '"system"' is not assignable to type '"out" | "in" | "transfer" | "allocation" | null'.`

These appear to be stale test fixtures referencing a removed `"system"` category type (ADR 0012 / Phase 46 nature-direction model). Should be addressed in a separate cleanup task.
