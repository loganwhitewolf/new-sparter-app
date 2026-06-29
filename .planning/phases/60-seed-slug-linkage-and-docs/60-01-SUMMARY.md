---
phase: 60-seed-slug-linkage-and-docs
plan: "01"
subsystem: seed
tags: [seed, slug-linkage, platform, import-format, trade-republic]
dependency_graph:
  requires: []
  provides: [PLAT-05]
  affects:
    - scripts/seed-data.ts
    - scripts/seed.ts
    - tests/import-detector.test.ts
    - tests/import-hash-contract.test.ts
tech_stack:
  added: []
  patterns:
    - Slug-based seed linkage: seed-data.ts carries platformSlug string; seed.ts resolves slug→id at runtime
key_files:
  modified:
    - scripts/seed-data.ts
    - scripts/seed.ts
    - tests/import-detector.test.ts
    - tests/import-hash-contract.test.ts
decisions:
  - "Synthetic index-based ids used in tests (index+1) since seed-data no longer carries hardcoded ids (ADR 0015)"
  - "Guard on resolvedFormats.length > 0 prevents Drizzle empty-values throw"
  - "Missing slug: JSON warning log + row skipped (non-fatal)"
metrics:
  duration: "~15min"
  completed: "2026-06-29"
status: complete
---

# Phase 60 Plan 01: Seed Slug Linkage Summary

**One-liner:** Removed hardcoded `id:` from all 8 seeded platform entries and switched import format version linkage from `platformId: N` to `platformSlug: 'slug'` resolved at runtime — closing the Trade Republic id-8 collision (PLAT-05).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Remove explicit platform ids and add platformSlug to format versions in seed-data.ts | 0fe429f | scripts/seed-data.ts, scripts/seed.ts |
| 2 | Update import tests to slug-based linkage | 1a1b1a2 | tests/import-detector.test.ts, tests/import-hash-contract.test.ts |

## What Was Built

### scripts/seed-data.ts

All 8 platform entries now carry `{ name, slug, country }` — no explicit `id:` field. Serial assigns at runtime; conflict keyed on unique `slug`.

All 8 importFormatVersions entries now carry `platformSlug: 'slug-string'` instead of `platformId: N`.

### scripts/seed.ts

After the platform insert + setval, a fresh `SELECT id, slug FROM platform` builds a `Map<slug, number>`. Format version rows are built via `flatMap` resolving each `fv.platformSlug` to a DB integer `platformId`. Missing slug → `console.log({ event: 'seed_warning', ... })` + row skipped. Insert guarded by `resolvedFormats.length > 0`.

### tests/

`import-detector.test.ts` and `import-hash-contract.test.ts` updated to use `platformSlug`-based linkage and synthetic index-based ids (index+1) instead of `p.id` / `fv.platformId`. All 36 tests pass.

## Verification

```
grep -c 'platformSlug' scripts/seed-data.ts  → 8
npx tsc --noEmit (import files)              → 0 errors
yarn vitest run tests/import-detector.test.ts tests/import-hash-contract.test.ts → 36 passed
```

The Trade Republic id-8 collision is eliminated: platform conflict key is `slug`, serial assigns freely regardless of what integer other platforms hold.

## Deviations from Plan

Test file updates (Task 2) were added beyond the original 2-task plan to resolve TypeScript errors introduced by the seed-data.ts shape change — required for `tsc --noEmit` to pass on the phase.

## Self-Check: PASSED

- scripts/seed-data.ts: no `id:` on any platform entry — FOUND
- scripts/seed-data.ts: `platformSlug` on all 8 format version entries — FOUND
- scripts/seed.ts: slug-to-id resolution via DB query — FOUND
- scripts/seed.ts: `resolvedFormats.length > 0` guard — FOUND
- 36 import tests GREEN — CONFIRMED
