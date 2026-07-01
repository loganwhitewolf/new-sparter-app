---
phase: 60-seed-slug-linkage-and-docs
plan: "02"
subsystem: docs
tags: [docs, context, comments, descriptionStripPattern, import-format]
dependency_graph:
  requires: []
  provides: [PLAT-06]
  affects: [CONTEXT.md, lib/services/regex-discovery.ts, lib/services/pattern-application.ts]
tech_stack:
  added: []
  patterns: []
key_files:
  modified:
    - CONTEXT.md
    - lib/services/regex-discovery.ts
    - lib/services/pattern-application.ts
decisions:
  - "Comment-only changes: no executable code modified in either service file"
  - "Pre-existing TypeScript errors (seed.ts, tests/) confirmed out-of-scope and unrelated to plan changes"
metrics:
  duration: "~2 minutes"
  completed: "2026-06-29T14:39:00Z"
status: complete
---

# Phase 60 Plan 02: Fix DescriptionStripPattern Attribution Summary

**One-liner:** Corrected all developer-facing references attributing DescriptionStripPattern to `platform` — now consistently attributed to `import_format_version` per ADR 0013 (PLAT-06).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Fix DescriptionStripPattern glossary entry in CONTEXT.md | 1acdafd | CONTEXT.md |
| 2 | Fix stale code comments in regex-discovery.ts and pattern-application.ts | 4e7a98f | lib/services/regex-discovery.ts, lib/services/pattern-application.ts |

## What Was Built

Three targeted documentation/comment corrections — no runtime behavior changed:

1. **CONTEXT.md** (`DescriptionStripPattern` entry): First sentence updated from "Regex nullable configurata per Platform" to "Regex nullable configurata per Import Format (campo `description_strip_pattern` su `import_format_version`, ADR 0013)."

2. **lib/services/regex-discovery.ts** — two comments:
   - `applyStrip` JSDoc: now says "Applies the import format version descriptionStripPattern (`import_format_version.description_strip_pattern`, ADR 0013), a seed/operator-controlled value..."
   - Step-3 inline comment: "import format version value: `import_format_version.description_strip_pattern`" replaces "platform-level value"

3. **lib/services/pattern-application.ts** — one comment:
   - CR-02 mirror comment: "apply import format version descriptionStripPattern before normalizing" replaces "apply platform descriptionStripPattern before normalizing"

## Verification

All checks passed:

```
CONTEXT.md OK
regex-discovery.ts OK
pattern-application.ts OK
TypeScript OK (no errors in modified files)
```

Pre-existing TypeScript errors in `scripts/seed.ts` and `tests/` (related to Phase 60-01 seed-slug refactor) confirmed unrelated to this plan's changes.

`yarn check:language` flagged pre-existing violations in `lib/dal/expenses.ts` and `lib/dal/transactions.ts` — both out of scope for this plan.

## Deviations from Plan

None — plan executed exactly as written. All three comment edits applied to the specified lines; no executable code touched.

## Known Stubs

None.

## Threat Flags

None — changes are comment/glossary text only; no new network endpoints, auth paths, file access patterns, or schema changes.

## Self-Check: PASSED

- CONTEXT.md modified: FOUND
- lib/services/regex-discovery.ts modified: FOUND
- lib/services/pattern-application.ts modified: FOUND
- Task 1 commit 1acdafd: FOUND
- Task 2 commit 4e7a98f: FOUND
