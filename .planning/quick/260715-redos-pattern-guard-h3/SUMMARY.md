---
quick_id: 260715-redos
slug: redos-pattern-guard-h3
date: 2026-07-15
status: complete
---

# Summary: Fix H-3 — ReDoS via user categorization regexes

## What changed

- **`lib/validations/pattern.ts`** — `normalizePatternInput()` now, after the
  existing compile check:
  - rejects patterns longer than `MAX_PATTERN_LENGTH = 200`;
  - rejects catastrophic-backtracking shapes via `safeRegex(source)` (finding H-3).
  This is the single choke point through which every persisted user pattern (create
  and update) passes, so all downstream compile sites inherit the guard.
- **deps** — added `safe-regex@2.1.1` + `@types/safe-regex@1.1.6` (dev).
- **`lib/validations/__tests__/pattern.test.ts`** — new regression suite (6 tests).

## Verification

- New tests: 6/6 pass — reject `(a+)+$`, `(x+x+)+y`, `(a*)*`, `(.*a){20}`, reject
  >200-char patterns, accept `amazon|amzn` / `\bnetflix\b` / etc., surface the
  rejection through `CreatePatternSchema`.
- Full `lib/validations` suite: 74/74 pass.
- All 45 seeded system patterns verified to pass `safe-regex` (no false positives
  against real taxonomy).
- `yarn tsc --noEmit`: touched files error-free (pre-existing unrelated test-file
  errors remain). `yarn check:language`: passed.

## Result

Catastrophic-backtracking patterns can no longer be persisted, closing the
self-service DoS vector. Legitimate merchant patterns are unaffected.

## Residual / notes

- Pre-existing user patterns are not retroactively re-validated (personal
  pre-launch app; existing rows are owner-authored and trusted). If ever needed, a
  one-off `safe-regex` sweep over `categorizationPattern` rows would surface any.
- `safe-regex` is a strong heuristic, not a proof. For a hard guarantee under
  hostile multi-tenant load, the follow-up would be RE2 (linear-time engine) or a
  worker-thread match timeout — deferred as higher-cost. Tracked against
  `docs/security/audit-2026-07-14.md`.
- H-2 (email pre-verification) still open.
