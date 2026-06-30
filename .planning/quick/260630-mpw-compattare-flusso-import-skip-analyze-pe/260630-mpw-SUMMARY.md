---
status: complete
quick_id: 260630-mpw
---

# Quick Task 260630-mpw — Summary

## Rationale

`/analyze` remains for **recognized formats** (transaction preview + confirm import). The unknown-format card was a useless intermediate step — users always continued to `/configure`.

## Changes

- `lib/utils/import-status.ts` — shared `isUnknownFormatAnalysis()`
- `analyze/page.tsx` — server redirect to configure on unknown format; removed dead-end card
- `configure/page.tsx` — merged unknown-format guidance + "Torna alle importazioni" in header
- `import-uploader.tsx` — post-upload analyze, route directly to configure or analyze
- `import-format-wizard.tsx` — back link on step 1 (platform picker)

## Verification

`yarn vitest run tests/import-analyze-page.test.tsx tests/import-format-wizard-ui.test.tsx` — 11/11
