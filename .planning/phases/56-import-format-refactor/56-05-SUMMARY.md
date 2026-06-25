---
phase: 56-import-format-refactor
plan: "05"
subsystem: import-format
tags: [typescript, regex-discovery, seed-extras, ifmt-05]
requires: ["56-03", "56-04"]
provides: ["IFMT-05"]
affects: ["lib/dal/regex-discovery.ts", "scripts/regex-discovery.ts", "scripts/seed-extras.ts"]
tech-stack:
  added: []
  patterns: ["column-re-point", "no-op-seed-step"]
key-files:
  created: []
  modified:
    - lib/dal/regex-discovery.ts
    - scripts/regex-discovery.ts
    - scripts/seed-extras.ts
decisions:
  - "platform import removed from seed-extras.ts — no other step references the Drizzle platform table object"
  - "import-hash-discovery.test.ts TS errors noted as pre-existing out-of-scope (untracked file from earlier phase 56 discovery)"
metrics:
  duration: "3 minutes"
  completed: "2026-06-25"
  tasks: 4
  files: 3
status: complete
---

# Phase 56 Plan 05: TypeScript Compilation Gate (IFMT-05 Gap Closure) Summary

Closed the 3 TypeScript compilation blockers identified in VERIFICATION.md: 2 TS2339 errors in `lib/dal/regex-discovery.ts` (descriptionStripPattern read from dropped `platform` column), 10 TS2339 errors in `scripts/regex-discovery.ts` `loadAllActiveFormats` (9 contract-column aliases reading from dropped `platform` columns), and 1 TS2353 error in `scripts/seed-extras.ts` (Step 2 writing to `platform.descriptionStripPattern` which was dropped in migration 0022). All 13 errors eliminated. `npx tsc --noEmit` now reports zero errors across all three gap files.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Re-point `lib/dal/regex-discovery.ts` to read `descriptionStripPattern` from `importFormatVersion` | 26e1e16 | lib/dal/regex-discovery.ts |
| 2 | Redirect `loadAllActiveFormats` 9 contract-column aliases to `importFormatVersion` | daa9ec4 | scripts/regex-discovery.ts |
| 3 | Convert `setFinecoDescriptionStripPattern` to no-op; remove unused `platform` import | 5ae9f4f | scripts/seed-extras.ts |
| 4 | Full TypeScript compilation gate (verification only) | 5ae9f4f | — |

## What Was Built

### lib/dal/regex-discovery.ts

Two select queries fixed:
- `getUncategorizedExpensesForDiscovery` line 45: `platform.descriptionStripPattern` → `importFormatVersion.descriptionStripPattern`
- `getUncategorizedExpensesForPlatformApply` line 92: same re-point

Join chain (`expense → file → importFormatVersion → platform`) and return types unchanged.

### scripts/regex-discovery.ts

Nine contract-column aliases in `loadAllActiveFormats` select block re-pointed from `platform.*` to `importFormatVersion.*`:
- `platformDelimiter`, `platformTimestampColumn`, `platformDescriptionColumn`, `platformAmountType`, `platformAmountColumn`, `platformPositiveAmountColumn`, `platformNegativeAmountColumn`, `platformMultiplyBy`, `platformDescriptionStripPattern`

Identity aliases (`platformName`, `platformSlug`, `platformCountry`) remain on `platform.*` — these columns were NOT dropped in migration 0022.

Map block unpacking `row.platform*` aliases into `candidate.platform.*` unchanged.

### scripts/seed-extras.ts

Step 2 (`setFinecoDescriptionStripPattern`) body replaced with `console.log` no-op documenting the supersession:
- `descriptionStripPattern` now lives on `importFormatVersion`, seeded via `seed-data.ts`
- Existing production rows migrated by `move-parsing-contract-to-format-version` (Step 14)
- Function signature uses `_database` (unused parameter convention)
- `platform` Drizzle import removed (confirmed unused by all other steps after this change)
- STEPS array order preserved at Step 2 position

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written, with one minor clarification:

**Import cleanup:** The plan said "do NOT remove [platform import] speculatively, as other steps may still use platform." Verified that no other step in `seed-extras.ts` uses the Drizzle `platform` table object (line 786 `FROM platform p` is inside a raw `sql` template literal, not a Drizzle reference). Removed the import to prevent unused-import lint warnings. This is consistent with plan instructions (only retain if used).

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` — lib/dal/regex-discovery.ts | PASS — 0 errors |
| `npx tsc --noEmit` — scripts/regex-discovery.ts | PASS — 0 errors |
| `npx tsc --noEmit` — scripts/seed-extras.ts | PASS — 0 errors |
| Zero `platform.descriptionStripPattern` in lib/dal/regex-discovery.ts | PASS |
| Zero `platform.*` contract aliases in scripts/regex-discovery.ts | PASS |
| No `.update(platform)` in setFinecoDescriptionStripPattern | PASS |
| `yarn check:language` | PRE-EXISTING FAILURES in lib/dal/expenses.ts:82 and lib/dal/transactions.ts:200 — not introduced by this plan |

## Known Out-of-Scope Issues

| File | Issue | Status |
|------|-------|--------|
| `tests/import-hash-discovery.test.ts` | Untracked temporary discovery script referencing old `platform` contract columns (TS2339, 7 errors) — predates phase 56 migration; never committed | Deferred — not in scope for plan 05 |
| `lib/dal/expenses.ts:82`, `lib/dal/transactions.ts:200` | Developer-facing Italian comments flagged by `yarn check:language` | Deferred — pre-existing, not introduced by this plan |

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All changes are column-reference redirections on existing imported symbols.

## Self-Check: PASSED

- lib/dal/regex-discovery.ts: modified (26e1e16)
- scripts/regex-discovery.ts: modified (daa9ec4)
- scripts/seed-extras.ts: modified (5ae9f4f)
- All three gap files: zero TS compilation errors confirmed
