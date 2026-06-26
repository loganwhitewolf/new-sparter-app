---
phase: 57-pdf-import-trade-republic
plan: "02"
subsystem: import-upload-validation
status: complete
tags: [pdf-import, upload, validation, presigned-url, tdd]
completed_date: "2026-06-26"
duration: "2 min"

dependency_graph:
  requires: ["57-01"]
  provides: ["57-03", "57-04"]
  affects: [lib/validations/import.ts, components/import/import-uploader.tsx]

tech_stack:
  added: []
  patterns: [TDD RED→GREEN, defensive-MIME-fallback, extension-gating]

key_files:
  created: []
  modified:
    - lib/validations/import.ts
    - lib/validations/__tests__/import.test.ts
    - components/import/import-uploader.tsx

decisions:
  - "application/octet-stream added to IMPORT_CONTENT_TYPES as defensive fallback (Assumption A5: some browsers emit octet-stream for PDF); extension check still constrains file kind"
  - "initiate route (app/api/files/initiate/route.ts) required NO code change — it delegates fully to InitiateUploadSchema; PDF support flows through transparently"
  - "PDF type fallback derived from extension when file.type is empty string in the uploader, avoiding the old hardcoded text/csv fallback for .pdf files"
  - "5 MB size cap (MAX_IMPORT_FILE_SIZE_BYTES) preserved unchanged per D-05 and threat T-57-02-01"

metrics:
  duration: "2 min"
  completed_date: "2026-06-26"
  tasks: 2
  files_modified: 3
  commits: 3
---

# Phase 57 Plan 02: PDF Upload Validation Summary

PDF upload validation extended — `application/pdf`, `application/octet-stream` fallback, and `.pdf` extension added to the upload allowlists so Trade Republic PDF statements flow through the existing presigned PUT path; oversized files still blocked pre-upload.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | Add failing PDF tests | de7e107 | lib/validations/__tests__/import.test.ts |
| 1 GREEN | Add PDF to upload allowlists | 0b147ff | lib/validations/import.ts |
| 2 | Surface .pdf in uploader UI | 0d9203e | components/import/import-uploader.tsx |

## What Was Built

**lib/validations/import.ts:**
- `IMPORT_CONTENT_TYPES` gains `'application/pdf'` and `'application/octet-stream'`
- `SUPPORTED_EXTENSIONS` gains `'.pdf'`
- Name-refinement error message updated: "Only CSV, XLSX, and PDF imports are supported."
- `ConfirmUploadSchema` also benefits (shares `IMPORT_CONTENT_TYPES`) — no separate change needed

**lib/validations/__tests__/import.test.ts:**
- 7 new test cases covering: PDF accept (application/pdf), PDF accept (application/octet-stream), PDF reject over 5 MB, reject wrong extension with updated message, CSV regression, XLSX regression, XLSX over 5 MB regression
- All 18 tests pass (14 pre-existing + 4 new from RED commit = corrected to all GREEN)

**components/import/import-uploader.tsx:**
- `.pdf` added to `ACCEPTED_EXTENSIONS` → file input `accept` attribute now includes `.pdf`
- MIME type validation error message updated to include PDF (Italian product copy, correct)
- `type` fallback in `fetch` body now derives `'application/pdf'` for `.pdf` files when `file.type` is empty, instead of the previous hardcoded `'text/csv'` fallback

**app/api/files/initiate/route.ts:** No code change required — the route validates entirely via `InitiateUploadSchema` (line 62); no hardcoded MIME or extension checks exist.

## Verification Results

- `yarn test lib/validations/__tests__/import.test.ts` → 18/18 passed
- `node -e ".../.pdf..."` → "uploader accepts .pdf"
- `yarn check:language components/import/import-uploader.tsx` → no violations in this file
- Regression: CSV and XLSX validation paths unchanged

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] PDF type fallback for empty file.type**
- **Found during:** Task 2
- **Issue:** The uploader's fetch body used `selectedFile.type || 'text/csv'` as fallback. For a `.pdf` file where the browser reports an empty `file.type`, this would send `type: 'text/csv'` to the initiate route — schema would reject the request because `.pdf` extension and `text/csv` MIME are inconsistent (the schema validates both extension and MIME independently via name-refine + type-refine).
- **Fix:** Derive fallback from extension: `selectedFile.type || (selectedFile.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/csv')`
- **Files modified:** components/import/import-uploader.tsx
- **Commit:** 0d9203e

## Known Stubs

None — this plan only extends validation; no data rendering, no UI stubs.

## Threat Surface Scan

No new security-relevant surface beyond what is documented in the plan's threat model (T-57-02-01, T-57-02-02, T-57-02-03). The `application/octet-stream` addition widens the MIME surface as documented in T-57-02-02 (accepted risk; extension check still constrains file kind).

## TDD Gate Compliance

- RED gate: commit de7e107 (`test(57-02):`) — 4 failing tests confirmed
- GREEN gate: commit 0b147ff (`feat(57-02):`) — all 18 tests passing

## Self-Check: PASSED

- FOUND: lib/validations/import.ts
- FOUND: lib/validations/__tests__/import.test.ts
- FOUND: components/import/import-uploader.tsx
- Commits verified: de7e107, 0b147ff, 0d9203e
