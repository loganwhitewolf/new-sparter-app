---
quick_id: 260715-redos
slug: redos-pattern-guard-h3
date: 2026-07-15
---

# Quick Task: Fix H-3 — ReDoS via user categorization regexes

Source: `docs/security/audit-2026-07-14.md` finding **H-3** (HIGH).

## Problem

`normalizePatternInput()` only checked that a user regex compiled — no complexity
or length guard. A user could persist `(a+)+$` and trigger catastrophic
backtracking during import (regexes run synchronously per description, inside the
import `db.transaction`), blocking the Node event loop → platform-wide DoS.

## Plan

1. `normalizePatternInput()` is the single choke point for all persisted user
   patterns (create + update flow through it), so guard there:
   - length cap (`MAX_PATTERN_LENGTH = 200`)
   - reject catastrophic-backtracking shapes via `safe-regex` (star-height / nested
     quantifier detection) before persistence.
2. Add `safe-regex` + `@types/safe-regex` deps.
3. Regression test: reject nested quantifiers + oversized; accept legit patterns.

## Constraints

- Must not reject legitimate merchant patterns — verified all 45 seeded system
  patterns pass `safe-regex`.
- Downstream compile sites (categorization-match, pattern-application,
  pattern-suggestions) inherit protection since they only run validated patterns.
- `descriptionStripPattern` is operator-controlled — out of scope.
