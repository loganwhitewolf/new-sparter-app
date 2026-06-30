---
status: complete
quick_id: 260630-opy
---

# Summary

- Added `getLatestGlobalImportFormatDefaults(platformId)` in `lib/dal/import-formats.ts`
- `createPrivateRows` uses inherited ancillary parsing fields instead of null/false/1 hardcodes
- Mapping columns still come from the wizard form
- Fallback when platform has no global version (new pending platform)

Tests: `yarn vitest run tests/import-format-wizard-actions.test.ts` — 18/18
