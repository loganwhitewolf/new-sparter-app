---
phase: "05"
plan: "02"
---

# T02: Implemented deterministic import parsing, format detection, amount/date normalization, and stable transaction hashing.

**Implemented deterministic import parsing, format detection, amount/date normalization, and stable transaction hashing.**

## What Happened

Replaced the T01 TODO contracts with executable Vitest coverage for the import utility and detector public interfaces, then added pure import modules. `lib/utils/import.ts` now normalizes descriptions, parses Italian/ISO dates, parses signed decimal-comma and thousands-separated amounts through `toDbDecimal()`, computes SHA-256 description/transaction hashes, and normalizes single-column plus Fineco-style separate amount rows including Intesa credit-card sign flipping. `lib/services/import-parsers.ts` now decodes bounded CSV/XLSX files with BOM handling, UTF-8/ISO-8859-1 fallback behavior, delimiter detection, max byte/row/sample caps, and structured non-secret warnings/errors. `lib/services/import-format-detector.ts` now scores caller-supplied seeded format versions by required headers, delimiter, date parseability, amount shape, and sample validity, returning sorted candidates plus preview rows, duplicate counts, and diagnostics suitable for later UI/actions. Verification confirmed all seeded fixtures detect with confidence and produce preview-ready duplicate information without DB/R2 dependencies.

## Verification

Ran the task-required Vitest command after implementation: `npx vitest run tests/import-utils.test.ts tests/import-detector.test.ts --reporter=verbose`, which passed 26 tests across both import suites. Also ran `npx tsc --noEmit`, which passed after adjusting the XLSX helper to use the typed `readSheet` API from `read-excel-file/node`. Observability impact was verified through tests covering structured unknown-format errors, oversized-file parser errors, BOM header handling, duplicate counts, and bounded parser result shapes.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx vitest run tests/import-utils.test.ts tests/import-detector.test.ts --reporter=verbose` | 0 | ✅ pass | 4500ms |
| 2 | `npx tsc --noEmit` | 0 | ✅ pass | 3200ms |

## Deviations

Vitest did not resolve the Next.js `@/*` alias in this project because there is no Vitest alias config, so the new tests and service-to-utils import use relative imports for plain `npx vitest` compatibility.

## Known Issues

None.

## Files Created/Modified

- `lib/utils/import.ts`
- `lib/services/import-parsers.ts`
- `lib/services/import-format-detector.ts`
- `tests/import-utils.test.ts`
- `tests/import-detector.test.ts`
