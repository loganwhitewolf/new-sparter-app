---
phase: 57
plan: 05
reviewed: 2026-06-26T00:00:00Z
depth: standard
status: needs-attention
reviewed_files:
  - lib/services/trade-republic-pdf-parser.ts
  - lib/services/import-parsers.ts
  - lib/dal/import-formats.ts
  - lib/actions/import.ts
  - tests/trade-republic-pdf-parser.test.ts
  - tests/import-actions.test.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
---

# Phase 57 Plan 05: Code Review Report

**Reviewed:** 2026-06-26
**Depth:** standard
**Files Reviewed:** 6
**Status:** needs-attention

## Summary

Plan 57-05 adds user-friendly Italian error messaging for unrecognized PDF uploads.
The three-layer design is sound: parser exports a stable constant (`UNRECOGNIZED_PDF_FORMAT`),
the DAL provides `listPdfImportPlatformNames()` with an injectable database param, and the action
intercepts the constant and enriches the message with live platform names.

No critical issues (security vulnerabilities, data loss, crashes). Three warnings and two info items
are present.

---

## Warnings

### WR-01: `listPdfImportPlatformNames` DB failure silently degrades to a generic error

**File:** `lib/actions/import.ts:305`

**Issue:** `listPdfImportPlatformNames()` is called inside the outer `try` block that wraps
`analyzeFile`. If the platform-name lookup throws (transient DB error, connection pool exhaustion),
the `catch` at line 321 returns `mapAnalyzeError(error)` — a generic "Impossibile analizzare il
file." — instead of the enriched PDF message. The user loses the actionable platform list. The
degraded message is also identical to an analysis failure, which may confuse operators looking at
logs (the underlying error was in `listPdfImportPlatformNames`, not in `analyzeFile`).

**Fix:** Wrap the platform-name lookup in its own try/catch so a DB failure falls back to the
`platformNames.length === 0` branch rather than masking the enrichment entirely:

```ts
if (result.errors[0] === UNRECOGNIZED_PDF_FORMAT) {
  let platformNames: string[] = []
  try {
    platformNames = await listPdfImportPlatformNames()
  } catch {
    // Non-fatal: fall through to the no-platforms fallback message
  }
  if (platformNames.length > 0) {
    errorMessage = `Il file PDF non è stato riconosciuto. Le piattaforme supportate per l'import PDF sono: ${platformNames.join(", ")}.`
  } else {
    errorMessage = "Il file PDF non è stato riconosciuto come formato supportato."
  }
}
```

---

### WR-02: `UNRECOGNIZED_PDF_FORMAT` doubles as machine-readable code and user-visible fallback — identity is fragile

**File:** `lib/services/trade-republic-pdf-parser.ts:43-44`

**Issue:** The constant serves two roles simultaneously: (1) the sentinel string `analyzeImportAction`
uses to detect that enrichment is needed, and (2) the text shown to the user if enrichment is
bypassed (e.g. the `completeOnboardingPrivateImportAction` path at `lib/actions/import.ts:396` or
any future caller that emits a plain `result.errors[0]` without the enrichment guard).

The consequence is concrete: `completeOnboardingPrivateImportAction` at line 393-398 returns
`analysis.errors[0]` verbatim without the UNRECOGNIZED_PDF_FORMAT check, so a PDF upload through
the onboarding wizard shows the bare fallback string "Il file PDF non è stato riconosciuto come
formato supportato." without the platform list — the intent of plan 57-05 (give the user the
platform list) is not delivered on that code path.

The deeper structural risk: if the sentinel string is ever edited for UX reasons, the equality check
`result.errors[0] === UNRECOGNIZED_PDF_FORMAT` continues to work on the same build, but any cached
or serialized error (e.g. stored in the file row's `errorMessage` column) will no longer match.

**Fix:** Make `UNRECOGNIZED_PDF_FORMAT` a machine-readable opaque token (not user-facing text), and
derive the Italian fallback from it only at the rendering layer:

```ts
// parser
export const UNRECOGNIZED_PDF_FORMAT = 'ERR_PDF_FORMAT_UNRECOGNIZED' // opaque

// action — both analyzeImportAction and completeOnboardingPrivateImportAction
if (result.errors[0] === UNRECOGNIZED_PDF_FORMAT) {
  // ... enrichment with platform list
}
```

Alternatively, apply the same enrichment logic in `completeOnboardingPrivateImportAction` to close
the gap without changing the constant's value.

---

### WR-03: `listPdfImportPlatformNames` lacks `reviewStatus` filter — inactive or rejected platforms leak into the message

**File:** `lib/dal/import-formats.ts:219-225`

**Issue:** The query filters on `platform.isActive = true` and `importFormatVersion.isActive = true`
but does NOT filter on `platform.reviewStatus = 'approved'` or
`importFormatVersion.reviewStatus = 'approved'`. A platform row with `isActive = true` but
`reviewStatus = 'pending'` or `'rejected'` would appear in the Italian error message shown to users.
This contradicts the access-control rule applied by `loadImportFormatsForDetection` (which checks
both `isActive` and `reviewStatus = 'approved'`).

**Fix:**

```ts
.where(
  and(
    eq(platform.isActive, true),
    eq(importFormatVersion.isActive, true),
    eq(platform.reviewStatus, 'approved'),
    eq(importFormatVersion.reviewStatus, 'approved'),
    isNull(platform.ownerUserId),              // global platforms only
    isNull(importFormatVersion.ownerUserId),
    inArray(platform.slug, [...PDF_IMPORT_PLATFORM_SLUGS]),
  ),
)
```

---

## Info

### IN-01: Test file re-exports parser constants — backward-compat claim has no callers

**File:** `tests/trade-republic-pdf-parser.test.ts:38-39`

**Issue:** Lines 38-39 re-export `CREDIT_X_MIN`, `CREDIT_X_MAX`, `DEBIT_X_MIN`, `DEBIT_X_MAX`,
`BALANCE_X_MIN` from the test file itself with the comment "backward compat with Wave 0 usages".
These constants are already exported directly from `lib/services/trade-republic-pdf-parser.ts`.
Exporting them from a test file means consumers would import from a test module — an unusual
dependency direction that would break in production builds that exclude test directories. If there
are genuine callers, they should import from the source module.

**Fix:** Remove the re-export block from the test file. Any downstream consumer should import from
`lib/services/trade-republic-pdf-parser` directly.

---

### IN-02: `completeOnboardingPrivateImportAction` PDF error path not covered by tests

**File:** `tests/import-actions.test.ts` — no test for PDF error through onboarding action

**Issue:** `tests/import-actions.test.ts` covers the `analyzeImportAction` enrichment path
thoroughly (line 464-482) but has no test for `completeOnboardingPrivateImportAction` returning
`UNRECOGNIZED_PDF_FORMAT` (the gap identified in WR-02). The existing test at line 650-663 covers a
generic detection error; the PDF-specific code path through the onboarding wizard is untested, which
is why WR-02 was not caught during development.

**Fix:** Add a test case in `completeOnboardingPrivateImportAction` describe block:

```ts
it('returns the raw PDF error string verbatim (platform list not enriched on this path)', async () => {
  const { UNRECOGNIZED_PDF_FORMAT } = await import('../lib/services/trade-republic-pdf-parser')
  mocks.analyzeFile.mockResolvedValueOnce({
    ...analysisResult,
    errors: [UNRECOGNIZED_PDF_FORMAT],
  })
  const result = await completeOnboardingPrivateImportAction(validCompletionForm())
  expect(result.error).toBe(UNRECOGNIZED_PDF_FORMAT) // documents current behavior
  expect(mocks.importFile).not.toHaveBeenCalled()
})
```

This both documents the current behavior and makes WR-02 visible as a failing test once the fix
is applied.

---

_Reviewed: 2026-06-26_
_Reviewer: Claude (adversarial — gsd-code-reviewer)_
_Depth: standard_
