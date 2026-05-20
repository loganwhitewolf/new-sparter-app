---
phase: "27"
plan: "01"
---

# T01: Added a server-only registration flag parser with a complete env truth-table test suite.

**Added a server-only registration flag parser with a complete env truth-table test suite.**

## What Happened

Created `lib/auth/registration.ts` as the centralized server-only source of truth for `REGISTRATION_ENABLED`. The helper reads only `REGISTRATION_ENABLED`, defaults signup to enabled when the flag is unset, empty, blank, or malformed, disables registration only for trimmed case-insensitive `false`, `0`, `no`, and `off`, and recognizes true-like values for operator readability. It also exports the shared Italian disabled-registration message for later action/API/UI wiring. Added `tests/registration-config.test.ts` with focused Vitest coverage for unset values, true-like values, false-like values, whitespace and case normalization, empty/blank values, malformed values, safe env access scope, and the shared message.

## Verification

Ran the required focused Vitest file, the project language convention check because tests/developer-facing strings were touched, and ESLint against the two touched files. All checks passed.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest tests/registration-config.test.ts` | 0 | ✅ pass — 1 test file passed, 8 tests passed | 708ms |
| 2 | `yarn check:language` | 0 | ✅ pass — English code convention check passed | 733ms |
| 3 | `yarn eslint lib/auth/registration.ts tests/registration-config.test.ts` | 0 | ✅ pass — no lint output | 888ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `lib/auth/registration.ts`
- `tests/registration-config.test.ts`
