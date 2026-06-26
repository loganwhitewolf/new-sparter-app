---
plan: 57-01
phase: 57-pdf-import-trade-republic
status: complete
completed: 2026-06-26
wave: 1
---

# 57-01 Summary: Wave 0 Prerequisite — unpdf, Fixture, Calibration, Seed

## What Was Built

Installed the `unpdf` runtime dependency, committed a real Trade Republic PDF fixture, calibrated X-coordinate column boundaries from it, scaffolded the parser test file with todo/skip behavioral placeholders, and seeded the TR platform + `import_format_version` with synthetic headers.

## Tasks Completed

| Task | Description | Status |
|------|-------------|--------|
| 1 | Obtain Trade Republic PDF fixture (human action) | ✓ Complete |
| 2 | Install unpdf + calibrate X-coordinate boundaries | ✓ Complete |
| 3 | Seed TR platform and import_format_version | ✓ Complete |
| 4 | Run db:seed and verify TR format version persisted | ✓ Complete |

## Key Files Created/Modified

- `tests/fixtures/import/trade-republic-sample.pdf` — real TR statement, Italian locale, 22.7 KB, 4 pages
- `tests/trade-republic-pdf-parser.test.ts` — calibration probe + 13 todo behavioral placeholders (RED targets for Wave 2)
- `scripts/seed-data.ts` — TR platform (id 8, slug `trade-republic`) + importFormatVersions entry appended
- `package.json` / `yarn.lock` — `unpdf ^1.6.2` runtime dependency

## Calibrated X-Coordinate Column Boundaries

Derived from real fixture (`tests/fixtures/import/trade-republic-sample.pdf`):

| Constant | Value | Column |
|----------|-------|--------|
| `CREDIT_X_MIN` | 395 | IN ENTRATA (credit) starts ~405.8 |
| `CREDIT_X_MAX` | 440 | upper bound before debit zone |
| `DEBIT_X_MIN` | 440 | IN USCITA (debit) starts ~448.9 |
| `DEBIT_X_MAX` | 470 | upper bound before balance zone |
| `BALANCE_X_MIN` | 470 | SALDO starts ~479.1–501.2 |

## Seed Verification

- `yarn db:seed` idempotent: 8 platforms, 8 format versions inserted (or already present)
- headerSignatureFor yields: `data,descrizione,importo_entrata,importo_uscita`
- `descriptionStripPattern`: `quantity:\\s*[\\d.,]+\\s*` (strips savings-plan quantity tokens, D-06/PDF-05)

## Test Results

```
Tests: 1 passed | 13 todo (14 total)
```

1 calibration probe passes; 13 behavioral placeholders are `todo` (RED targets for Wave 2 parser).

## Self-Check: PASSED

- [x] unpdf in `package.json` dependencies (runtime, not devDependencies)
- [x] Fixture at `tests/fixtures/import/trade-republic-sample.pdf` — real PDF, 22.7 KB < 5 MB
- [x] X-boundary constants exported with comment citing calibration source
- [x] TR platform (id 8, slug `trade-republic`) and format version in `seed-data.ts`
- [x] `yarn db:seed` idempotent — TR rows inserted without duplication
- [x] Existing seed rows untouched (additive-only per project rule)
