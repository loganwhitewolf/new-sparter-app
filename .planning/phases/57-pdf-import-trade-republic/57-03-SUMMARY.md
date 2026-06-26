---
phase: 57-pdf-import-trade-republic
plan: "03"
subsystem: import-parsers
tags: [pdf, trade-republic, parser, balance-chain, tdd]
status: complete

dependency_graph:
  requires: [57-01]
  provides: [parseTradeRepublicPdf, validateBalanceChain, TR_SYNTHETIC_HEADERS, MAX_PDF_PAGES]
  affects: [lib/services/import-parsers.ts, tests/trade-republic-pdf-parser.test.ts]

tech_stack:
  added: []
  patterns:
    - "Per-page Y-sorted row bucketing to preserve chronological order across multi-page PDFs"
    - "X-coordinate band classification for credit/debit/balance columns"
    - "Decimal.js balance chain validation: prev + signed_amount == curr per row"
    - "Fused token extraction: date+tipo tokens merged by PDF renderer parsed via regex prefix match"

key_files:
  created:
    - lib/services/trade-republic-pdf-parser.ts
  modified:
    - tests/trade-republic-pdf-parser.test.ts

decisions:
  - "Per-page Y sorting preserves chronological order — flat cross-page sort merges Y values from different pages, corrupting order"
  - "DATE_PATTERN extended to match fused tokens (e.g. '01 gen 2024 Interessi') common on compressed page layouts"
  - "validateBalanceChain exported for direct unit testing without requiring a binary PDF tamper fixture"
  - "Italian document section names removed from developer comments to pass check:language (names kept as string literals in code)"

metrics:
  duration: 10m
  completed: 2026-06-26
  tasks_completed: 2
  files_modified: 2
  commits: 3

key_decisions:
  - "Per-page Y sorting: prevents cross-page Y value confusion (row 9 was '01 set 2025' mixing with row 8 '02 apr 2026' in global sort)"
  - "Fused token date extraction via regex prefix: DATE_PATTERN matches '^\\d{1,2}\\s+\\w{3,9}\\s+\\d{4}' not exact; DATE_EXTRACT extracts the date portion"
  - "validateBalanceChain exported for unit testing to enable tamper test without needing a binary-patched PDF fixture"
---

# Phase 57 Plan 03: Trade Republic PDF Parser Summary

TR PDF parser as a pure service — converts PDF bytes to a `ParsedImportFile` with synthetic headers, certified by the running-balance chain, ready for the existing import pipeline.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED | Failing tests for section/sign/balance/strip | `fab6dc3` | tests/trade-republic-pdf-parser.test.ts |
| 1 (GREEN) | TR PDF parser — section extraction and positional sign attribution | `dcbf649` | lib/services/trade-republic-pdf-parser.ts, tests/... |
| 2 (GREEN) | Balance chain validation, page ceiling, quantity strip tests | `ce1ceba` | lib/services/trade-republic-pdf-parser.ts, tests/... |

## What Was Built

`lib/services/trade-republic-pdf-parser.ts` exports:

- `parseTradeRepublicPdf(bytes, options): Promise<ParsedImportFile>` — main entry point
- `TR_SYNTHETIC_HEADERS` — `['data', 'descrizione', 'importo_entrata', 'importo_uscita']` (must match seeded import_format_version)
- `MAX_PDF_PAGES` — `50` (page ceiling, T-57-03-02)
- `validateBalanceChain(rows)` — exported for unit testing
- `ExtractedRow` (type) — exported for unit testing
- Calibrated X-boundary constants: `CREDIT_X_MIN/MAX`, `DEBIT_X_MIN/MAX`, `BALANCE_X_MIN`

Core pipeline:
1. `getDocumentProxy` → check `pdf.numPages <= 50`
2. `extractTextItems` → detect TR markers (`TRADE REPUBLIC` + `TRANSAZIONI SUL CONTO`)
3. `extractSectionItemsByPage` → isolate movements section, discard summary/position sections, per-page grouping
4. `groupPageItemsIntoRows` → Y-descending sort within each page, Y-tolerance bucketing
5. `parseRowBucket` → X-coordinate classification: credit (395–440), debit (440–470), balance (≥470)
6. `validateBalanceChain` → Decimal.js: prev_balance + signed_amount == curr_balance, explicit error on mismatch
7. Return `ParsedImportFile` with `delimiter: null`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cross-page Y sorting corrupted chronological order**
- **Found during:** Task 1 GREEN (balance chain was failing at row 9, then at row 27)
- **Issue:** Grouping all items by Y globally mixed items from page 1 (Y 700-100 range) with page 2 (Y 700-100 range), producing an interleaved sequence like "16 feb 2026, 01 set 2025, 16 feb 2026…"
- **Fix:** `extractSectionItemsByPage` returns `StructuredTextItem[][]` (one per page); `groupPageItemsIntoRows` processes each page independently then concatenates in page order
- **Files modified:** lib/services/trade-republic-pdf-parser.ts
- **Commit:** dcbf649

**2. [Rule 1 - Bug] Fused date+tipo tokens not detected as date rows**
- **Found during:** Task 1 GREEN (balance chain was failing because 4 rows were being skipped)
- **Issue:** Some rows had date and tipo movement fused in one PDF token: `"01 mag 2026 Interessi"` instead of separate `"01 mag 2026"` + `"Interessi"` tokens. The exact `DATE_PATTERN` (`/^\d{1,2}\s+\w{3}\s+\d{4}$/`) rejected these.
- **Fix:** Extended DATE_PATTERN to `^\d{1,2}\s+\w{3,9}\s+\d{4}` (prefix match); added `DATE_EXTRACT` regex to extract the date portion from the fused token
- **Files modified:** lib/services/trade-republic-pdf-parser.ts
- **Commit:** dcbf649

**3. [Rule 2 - Language compliance] Italian terms in developer comments**
- **Found during:** Task 2 verification (`yarn check:language`)
- **Issue:** Document section names (`TRANSAZIONI`, `PANORAMICA`) in developer-facing comments triggered the language checker (Italian term detection by word boundary)
- **Fix:** Replaced Italian terms in JSDoc comments with code references (`TR_MARKERS[1]`, `SECTION_END_PATTERNS`) or backtick-neutral phrasing ("movements section", "summary/position sections")
- **Files modified:** lib/services/trade-republic-pdf-parser.ts, tests/trade-republic-pdf-parser.test.ts
- **Commit:** ce1ceba

## Verification Results

All plan truths verified:

- [x] `parseTradeRepublicPdf` recognizes TR by markers (TRADE REPUBLIC + TRANSAZIONI SUL CONTO) — test passes
- [x] Only the movements section extracted; PANORAMICA discarded — 33 rows from fixture (no duplicates)
- [x] Sign determined by X coordinate: credit 395–440, debit 440–470 — test passes for both credit and debit rows
- [x] Balance chain validated with Decimal.js; mismatch throws explicit error + zero rows — unit test with tampered row passes
- [x] `ParsedImportFile` with `delimiter: null` and headers `['data','descrizione','importo_entrata','importo_uscita']` — test passes
- [x] `MAX_PDF_PAGES = 50` enforced before row extraction — test passes
- [x] Quantity strip regex (`quantity:\s*[\d.,]+\s*/i`) normalizes descriptions differing only in quantity value — test passes

Full test suite for the file: 18/18 passing.

## Known Stubs

None — all behaviors are fully wired against the real TR fixture.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns beyond what the plan's threat model covers:

- T-57-03-01 (balance chain tampering) — mitigated: `validateBalanceChain` returns explicit error + zero rows
- T-57-03-02 (oversized PDF) — mitigated: `MAX_PDF_PAGES = 50` checked before `extractTextItems`

## Self-Check: PASSED

- lib/services/trade-republic-pdf-parser.ts: FOUND
- tests/trade-republic-pdf-parser.test.ts: FOUND
- Commit fab6dc3 (RED): FOUND
- Commit dcbf649 (GREEN Task 1): FOUND
- Commit ce1ceba (GREEN Task 2): FOUND
