---
phase: 57
plan: "05"
fixed_at: 2026-06-26T14:43:00Z
review_path: .planning/phases/57-pdf-import-trade-republic/57-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 57 Plan 05: Code Review Fix Report

**Fixed at:** 2026-06-26T14:43:00Z
**Source review:** .planning/phases/57-pdf-import-trade-republic/57-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03 — Info items IN-01 and IN-02 skipped per instructions)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: DB failure silently degrades to generic error in `analyzeImportAction`

**Files modified:** `lib/actions/import.ts`
**Commit:** b90f3f8
**Applied fix:** Extracted `listPdfImportPlatformNames()` call out of the shared `try` block into its own `try/catch`. On DB failure the catch block is a no-op and `platformNames` stays `[]`, falling through to the no-platforms fallback message instead of the outer `mapAnalyzeError` path.

### WR-02: `completeOnboardingPrivateImportAction` missing UNRECOGNIZED_PDF_FORMAT enrichment

**Files modified:** `lib/actions/import.ts`
**Commit:** 83d938f
**Applied fix:** Added the same `UNRECOGNIZED_PDF_FORMAT` intercept block to `completeOnboardingPrivateImportAction` as exists in `analyzeImportAction`. The platform-name lookup is wrapped in its own `try/catch` (consistent with the WR-01 fix). Onboarding users uploading an unrecognized PDF now receive the enriched Italian message with the supported-platform list rather than the bare constant string.

### WR-03: `listPdfImportPlatformNames` lacks `reviewStatus` and `ownerUserId` filters

**Files modified:** `lib/dal/import-formats.ts`
**Commit:** d9b815f
**Applied fix:** Added four conditions to the Drizzle `and()` clause: `eq(platform.reviewStatus, APPROVED_REVIEW_STATUS)`, `eq(importFormatVersion.reviewStatus, APPROVED_REVIEW_STATUS)`, `isNull(platform.ownerUserId)`, and `isNull(importFormatVersion.ownerUserId)`. This aligns the query's access-control rules with `loadImportFormatsForDetection` — only globally approved platforms appear in the user-facing message.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-06-26T14:43:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
