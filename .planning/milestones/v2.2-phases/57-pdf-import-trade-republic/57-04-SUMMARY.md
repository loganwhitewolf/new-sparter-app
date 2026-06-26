---
plan: 57-04
phase: 57-pdf-import-trade-republic
status: complete
completed: 2026-06-26
wave: 3
---

# 57-04 Summary: Wire TR Parser into Import Pipeline + E2E Verification

## What Was Built

Added the `.pdf` dispatch branch to `parseImportFile`, proved E2E that the TR fixture flows through detector → `normalizeTransactionRow` with correct signs, and passed human verification of the full import path in the running app.

## Tasks Completed

| Task | Description | Status |
|------|-------------|--------|
| 1 | `.pdf` dispatch branch in `parseImportFile` (TDD) | ✓ Complete |
| 2 | TR detector + `normalizeTransactionRow` sign/date E2E test | ✓ Complete |
| 3 | Human E2E verification through running app | ✓ Approved |

## Key Files Modified

- `lib/services/import-parsers.ts` — `.pdf` branch before CSV fallback, imports `parseTradeRepublicPdf`
- `tests/trade-republic-pdf-parser.test.ts` — `parseImportFile` dispatch test added
- `tests/import-detector.test.ts` — TR detector confidence (≥0.98) + normalizeTransactionRow sign/date cases
- `lib/services/trade-republic-pdf-parser.ts` — **bug fix**: fused tipo+description tokens now correctly split

## Notable Deviation: Fused Tipo+Description Bug (auto-fixed)

During human E2E verification, transactions from `0,04` Cash Dividend rows were being lost with "missing description" import errors.

**Root cause:** PDF tokens like `"Rendimento Cash Dividend for ISIN US0378331005"` start at x≈121 (TIPO column range) and fuse the movement type and description into a single token. The parser was discarding the whole token as tipo, leaving `descrizione` empty.

**Fix applied** (committed as `fix(57-03)`): when a TIPO-range token contains a space, strip the first word (tipo) and keep the rest as description. Same fix for date+tipo+description fused tokens. Regression test added: no row in the real fixture may have empty `descrizione`.

## Test Results

```
tests/trade-republic-pdf-parser.test.ts: 23/23 passed
tests/import-detector.test.ts: 29/29 passed
```

## Detector Confidence

TR synthetic headers → seeded import_format_version: **confidence ≥ 0.98** (headerScore 1.0, signatureScore 1.0, delimiterScore 1.0 because `parsed.delimiter` is `null`).

## Human Verification Result

✓ File accepted without MIME/extension errors  
✓ Detector identifies format as Trade Republic  
✓ Credits positive, debits negative, dates correct  
✓ Cash Dividend 0,04 rows import correctly after fused-tipo fix  
✓ Import.ts untouched — PDF support is transparent through `parseImportFile`

## Self-Check: PASSED

- [x] `.pdf` branch in `parseImportFile` before CSV fallback
- [x] `import.ts` untouched — `analyzeFile`/`importFile` gain PDF support transparently
- [x] Detector confidence ≥ 0.8 asserted in test
- [x] `normalizeTransactionRow` signs credit/debit correctly
- [x] All rows have non-empty `descrizione` (regression test added)
- [x] Human E2E approved
