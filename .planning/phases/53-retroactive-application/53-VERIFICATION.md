---
phase: 53-retroactive-application
verified: 2026-06-16T15:48:17Z
status: human_needed
score: 10/11 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Promote a Fineco suggestion in the browser"
    expected: "Card shows 'Pattern creato' badge and 'N categorizzate · M ancora senza match' Italian copy inline (no toast, card not removed)"
    why_human: "State transition after Server Action response requires browser JS execution; SSR snapshot tests assert markup but cannot simulate the useEffect → onPromoted → setApplyResult → re-render sequence"
  - test: "Promote a Fineco suggestion with matching expenses on Revolut platform"
    expected: "Revolut expenses remain uncategorized; only Fineco platform expenses are touched"
    why_human: "Cross-platform isolation guarantee requires a real DB with multi-platform data; unit tests mock the DAL and cannot prove the WHERE clause prevents cross-platform writes"
  - test: "Navigate to /import/[fileId]/suggestions for a file that has no platform chain (e.g. pending_upload file)"
    expected: "Page returns 404 / notFound without rendering the suggestion surface"
    why_human: "notFound() call verified in test mocks, but the real Next.js notFound behavior in the App Router requires a browser or integration test to confirm the 404 response"
---

# Phase 53: retroactive-application Verification Report

**Phase Goal:** A regex created during discovery immediately categorizes existing uncategorized transactions, with the retroactive scope resolved and enforced.
**Verified:** 2026-06-16T15:48:17Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Platform-scoped apply scans only uncategorized expenses on the same platform (expense → file → importFormatVersion → platform join), never user-wide | VERIFIED | `getUncategorizedExpensesForPlatformApply` in `lib/dal/regex-discovery.ts` lines 81-103: identical join chain + `eq(platform.id, platformId)` + `isNull(expense.subCategoryId)` in WHERE; unit test asserts DAL called with `(userId, platformId)` pair |
| 2 | Already-categorized expenses (Set A, subCategoryId IS NOT NULL) are never selected or updated | VERIFIED | `isNull(expense.subCategoryId)` in `getUncategorizedExpensesForPlatformApply` WHERE; UPDATE uses `inArray(expense.id, matchingIds)` restricted to the scanned Set B |
| 3 | `applyNewPatternToPlatformExpenses` returns `{ updatedCount, notUpdatedCount }` where `notUpdatedCount = scannedInScope − updatedCount` | VERIFIED | `lib/services/pattern-application.ts` lines 222-225: `return { updatedCount: matchingIds.length, notUpdatedCount: uncategorized.length - matchingIds.length }`; unit test asserts `{ 2, 1 }` when 3 scanned, 2 match |
| 4 | Matcher tests both full normalized title and numeric-stripped form (Tier-1 fidelity preserved) | VERIFIED | `applyNewPatternToPlatformExpenses` filter loop lines 169-183: `regex.test(normalized) \|\| regex.test(stripped)`; unit test with `"***** 114 data operazione"` pattern confirms numeric-token strip path |
| 5 | `getPlatformIdForUserFile` returns `platformId` only when file belongs to `userId`; null otherwise | VERIFIED | `lib/dal/files.ts` lines 81-93: WHERE `eq(file.id, input.fileId) AND eq(file.userId, input.userId)`; `return rows[0]?.platformId ?? null` |
| 6 | `applyNewPatternToExpenses` (legacy user-wide) remains unchanged for `createPatternAction` | VERIFIED | `lib/actions/patterns.ts` line 133: `createPatternAction` still calls `applyNewPatternToExpenses`; `promoteSuggestionAction` never calls it (confirmed by test asserting `applyNewPatternToExpenses` is NOT called on promote path) |
| 7 | `promoteSuggestionAction` resolves `platformId` server-side from `fileId` (never trusts client `platformId` alone) | VERIFIED | `lib/actions/patterns.ts` lines 235-243: parses `fileId` from FormData, calls `getPlatformIdForUserFile({ userId, fileId })`, returns Italian error if null; no FormData `platformId` read |
| 8 | On successful promote, action returns `{ error: null, applyResult: { updatedCount, notUpdatedCount } }` | VERIFIED | `lib/actions/patterns.ts` line 324: `return { error: null, applyResult }`; unit test asserts exact shape |
| 9 | Missing `fileId` or unresolvable platform returns Italian validation error without creating pattern | VERIFIED | Lines 236-242 of `lib/actions/patterns.ts`: Italian errors `"File di import non valido."` / `"Impossibile determinare la piattaforma per questo file."`; `createPattern` NOT called; 2 unit tests covering both paths |
| 10 | Apply failure after pattern save is logged but non-fatal; counts reflect `{ 0, 0 }` on throw | VERIFIED | `lib/actions/patterns.ts` lines 315-321: catch logs and returns `{ error: null, applyResult: { updatedCount: 0, notUpdatedCount: 0 } }`; unit test verifies `createPattern` was called once, action returns zero counts |
| 11 | Suggestions page resolves `platformId` from `fileId` and passes `fileId` + `platformId` to `SuggestionSection` | PARTIAL — see note | Page resolves `platformId` (line 28-29) and calls `notFound()` when null (gate is VERIFIED). However, `platformId` is NOT passed to `SuggestionSection` — intentionally removed by post-plan code review fix WR-01 (commit `6a57549`). Only `fileId` is threaded through; `platformId` is re-resolved server-side per each `promoteSuggestionAction` call. The underlying APPLY-01/02 behavior is unaffected. |

**Score:** 10/11 truths verified (1 partial — intentional post-review deviation)

**Note on Truth 11:** Plan 03 documented `platformId` threading through `SuggestionSection → SuggestionCard`. The code review (53-REVIEW.md, WR-01) identified this as a dead prop (the action re-derives platformId from fileId server-side, so the client-side prop was never used). Commit `6a57549` removed it. The ROADMAP success criteria do not require `platformId` to be a client-visible prop; they require retroactive apply to be platform-scoped (which is enforced in the action). This deviation improves security posture and is not a gap in goal achievement.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/dal/regex-discovery.ts` | `getUncategorizedExpensesForPlatformApply` — platform Set B for writes | VERIFIED | Exported at line 81; correct join chain + WHERE; includes `descriptionStripPattern` (added by CR-02 fix) |
| `lib/dal/files.ts` | `getPlatformIdForUserFile({ userId, fileId })` | VERIFIED | Exported at line 81; ownership guard at WHERE; returns `number \| null` |
| `lib/services/pattern-application.ts` | `applyNewPatternToPlatformExpenses` + `PatternApplyResult` | VERIFIED | Both exported; service function is substantive (111 lines); legacy function body unchanged |
| `lib/validations/pattern.ts` | `ActionState` with optional `applyResult`; `PatternApplyResult` re-export | VERIFIED | Lines 86-98: `PatternApplyResult` type, `ActionState.applyResult?: PatternApplyResult \| null` |
| `lib/actions/patterns.ts` | `promoteSuggestionAction` wired to platform apply + fileId resolution | VERIFIED | Lines 225-325: full integration including fileId parse, platform resolve, platform apply, applyResult return |
| `tests/pattern-application.test.ts` | Platform boundary, matcher dual-test, count semantics unit tests | VERIFIED | 8 tests: platform boundary, isolation, count semantics (3 cases), invalid regex, numeric-strip dual match, history writes |
| `tests/pattern-actions.test.ts` | `promoteSuggestion` applyResult + platform resolution tests | VERIFIED | 12 `promoteSuggestion` tests; all pass; 5 new tests for Plan 02 behaviors |
| `app/(app)/import/[fileId]/suggestions/page.tsx` | `platformId` resolution + `notFound()` guard | VERIFIED | Lines 28-31: `getPlatformIdForUserFile` called; `notFound()` when null; `fileId` passed to `SuggestionSection` |
| `components/import/suggestion-promote-form.tsx` | Hidden `fileId` input + `applyResult` callback | VERIFIED | Line 65: `<input type="hidden" name="fileId" value={fileId} />`; `onPromoted` signature is `(applyResult: PatternApplyResult) => void`; `useEffect` guards with `state.applyResult` before calling `onPromoted` |
| `components/import/suggestion-card.tsx` | Inline Italian apply count display after promote | VERIFIED | Lines 55-59: `{applyResult.updatedCount} categorizzate · {applyResult.notUpdatedCount} ancora senza match` when `applyResult` non-null |
| `tests/suggestion-card.test.tsx` | Count copy visibility assertion | VERIFIED | Tests: "does not render apply count copy in default state", "renders Italian apply count copy when initialApplyResult is set", "zero updatedCount renders correctly" |
| `tests/suggestion-promote-form.test.tsx` | Hidden `fileId` input assertion | VERIFIED | Test: `expect(html).toMatch(/<input[^>]*type="hidden"[^>]*name="fileId"[^>]*value="file-abc"/)` |
| `tests/import-suggestions-page.test.tsx` | `getPlatformIdForUserFile` mock + `notFound` on null + guard sequencing | VERIFIED | 3 new APPLY-01 tests; mock in place; `notFound` tested on null; ordering test (file guard fires before platform guard) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `applyNewPatternToPlatformExpenses` | `getUncategorizedExpensesForPlatformApply` | DAL fetch before matcher loop | WIRED | Line 156 of `pattern-application.ts`: `const uncategorized = await getUncategorizedExpensesForPlatformApply(userId, platformId)` |
| `getUncategorizedExpensesForPlatformApply` WHERE | `getUncategorizedExpensesForDiscovery` WHERE | Identical join chain + `eq(platform.id)` + `isNull(subCategoryId)` | WIRED | Both functions use 3 leftJoins (file, importFormatVersion, platform) and same WHERE conditions; verified by `tests/regex-discovery-dal.test.ts` structural assertions |
| `applyNewPatternToPlatformExpenses` matcher | `normalizeDescription` + numeric-strip dual test | `regex.test(normalized) \|\| regex.test(stripped)` | WIRED | Lines 169-183 of `pattern-application.ts`; also applies `descriptionStripPattern` (CR-02 fix, commit `7ca2138`) before normalizing |
| `promoteSuggestionAction` | `getPlatformIdForUserFile` | Parse `fileId` from FormData → DAL resolve | WIRED | Lines 235-243 of `patterns.ts`; `getPlatformIdForUserFile` imported and called |
| `promoteSuggestionAction` | `applyNewPatternToPlatformExpenses` | After `createPattern` success | WIRED | Lines 306-314 of `patterns.ts`: `applyResult = await applyNewPatternToPlatformExpenses(db, {...})` |
| `SuggestionPromoteForm` | `promoteSuggestionAction` | Hidden `fileId` + `useActionState` | WIRED | `useActionState(promoteSuggestionAction, { error: null })` at line 26; `<input type="hidden" name="fileId" value={fileId} />` at line 65 |
| `SuggestionPromoteForm` `useEffect` | `SuggestionCard` `applyResult` state | `onPromoted(state.applyResult)` | WIRED | Lines 32-37 of `suggestion-promote-form.tsx`: `useEffect` fires `onPromoted(state.applyResult)` when `submittedRef.current && state.error === null && state.applyResult` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `applyNewPatternToPlatformExpenses` | `uncategorized` | `getUncategorizedExpensesForPlatformApply` → Drizzle DB query | Yes — real DB SELECT with platform filter | FLOWING |
| `promoteSuggestionAction` | `applyResult` | `applyNewPatternToPlatformExpenses` return value | Yes — real match loop over DB rows | FLOWING |
| `SuggestionCard` | `applyResult` state | `onPromoted(state.applyResult)` callback from `SuggestionPromoteForm` | Yes — Server Action return value flows through `useActionState` | FLOWING (browser-only; cannot trace via grep) |
| `SuggestionCard` render | `{applyResult.updatedCount} categorizzate · {applyResult.notUpdatedCount} ancora senza match` | `applyResult` state | Yes — values come from server DB operation | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 53 regression slice (67 tests) | `npx vitest run tests/pattern-application.test.ts tests/pattern-actions.test.ts tests/suggestion-card.test.tsx tests/suggestion-promote-form.test.tsx tests/import-suggestions-page.test.tsx` | PASS (67) FAIL (0) | PASS |
| `applyNewPatternToPlatformExpenses` exists and is exported | `grep -q "applyNewPatternToPlatformExpenses" lib/services/pattern-application.ts` | Match found | PASS |
| `getPlatformIdForUserFile` exists and is exported | `grep -q "getPlatformIdForUserFile" lib/dal/files.ts` | Match found | PASS |
| `categorizzate` count copy in card | `grep -q "categorizzate" components/import/suggestion-card.tsx` | Match found | PASS |
| Hidden `fileId` input in form | `grep -q 'name="fileId"' components/import/suggestion-promote-form.tsx` | Match found | PASS |
| Legacy `applyNewPatternToExpenses` NOT called in promote path | Only line 302 (comment) references it; actual call at line 133 is in `createPatternAction` only | Not called on promote path | PASS |
| Debt markers (TBD, FIXME, XXX) in phase-modified files | `grep -E "TBD\|FIXME\|XXX"` across all 15 phase files | No matches | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| APPLY-01 | 53-02, 53-03 | A regex created during discovery is applied to the uncategorized transactions of the current file | SATISFIED (superset) | Platform-scoped apply covers the entire platform history, which is a superset of "current file" uncategorized expenses. The current file's uncategorized expenses are always included in the platform scope. ROADMAP SC-1 verified. REQUIREMENTS.md checkbox still unchecked — traceability note says "Partial" (service+action+UI all delivered; checkbox state appears to be a documentation gap rather than an implementation gap). |
| APPLY-02 | 53-01, 53-02 | Retroactive apply targets the entire uncategorized history for the same platform; platform derived server-side; cross-user access blocked | SATISFIED | REQUIREMENTS.md checkbox is `[x]`. `getPlatformIdForUserFile` enforces `eq(file.userId, userId)`. Platform-scoped DAL WHERE enforced. Verified by structural tests. |

**Note on APPLY-01 checkbox:** `REQUIREMENTS.md` still shows `- [ ] **APPLY-01**` (unchecked). All three plans for this phase claim to deliver APPLY-01, and the traceability table says "Partial (service + action wired in 53-01/02; UI renders in 53-03)." All three waves are complete. The unchecked box appears to be a documentation artifact that was not updated to `[x]` when Phase 53 finished. This is a WARNING — not a blocker, but the requirements traceability record is inconsistent with the completed implementation.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers; no empty return stubs; no placeholder copy | — | — |

### Human Verification Required

#### 1. End-to-end apply feedback in the browser

**Test:** In a running dev environment, navigate to `/import/[fileId]/suggestions` for a file with uncategorized expenses matching at least one suggestion. Promote the suggestion by selecting a subcategory and clicking "Crea pattern."
**Expected:** The suggestion card shows both "Pattern creato" badge AND the Italian count line (e.g. "3 categorizzate · 12 ancora senza match") inline, without a toast, without the card being removed or hidden. Counts persist while the page is open.
**Why human:** The `useEffect → onPromoted → setApplyResult → re-render` sequence is a client-side runtime behavior. SSR snapshot tests confirm markup structure but cannot simulate the async Server Action round-trip and state update.

#### 2. Cross-platform isolation in a real environment

**Test:** Import files from two different platforms (e.g. Fineco and Revolut) with overlapping expense title patterns. Promote a Fineco suggestion matching a regex that would also match some Revolut expenses.
**Expected:** Only Fineco platform's uncategorized expenses are updated. Revolut expenses remain uncategorized. The card counts reflect only the Fineco scope.
**Why human:** Unit tests mock the DAL and verify the `(userId, platformId)` arguments are passed correctly, but cannot prove the DB WHERE clause produces correct row isolation against a real PostgreSQL dataset.

#### 3. `notFound` behavior for missing platform chain

**Test:** Attempt to access `/import/[fileId]/suggestions` for a file that exists but has no `importFormatVersionId` (e.g. a file in `pending_upload` status) or whose platform chain is broken.
**Expected:** Next.js serves a 404 page (not a 500 or an empty suggestions surface).
**Why human:** `mocks.notFound` in tests throws `new Error('notFound')` to simulate the Next.js behavior. The actual HTTP 404 routing behavior in App Router requires a browser or integration test.

### Gaps Summary

No code gaps found. All must-have truths are either VERIFIED or represent intentional, documented deviations:

- **Truth 11 deviation** (platformId not threaded to SuggestionSection): An intentional post-plan code review fix (WR-01, commit `6a57549`). The security posture is improved: `platformId` is resolved server-side per action call rather than echoed from client props. The ROADMAP success criteria are still met.

- **APPLY-01 checkbox**: REQUIREMENTS.md shows `- [ ]` (unchecked) for APPLY-01 even though all three phase plans are complete and the implementation delivers the behavior. This is a documentation consistency warning, not an implementation blocker.

---

_Verified: 2026-06-16T15:48:17Z_
_Verifier: Claude (gsd-verifier)_
