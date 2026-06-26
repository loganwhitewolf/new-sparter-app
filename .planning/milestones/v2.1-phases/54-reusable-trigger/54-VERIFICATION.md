---
phase: 54-reusable-trigger
verified: 2026-06-21T07:40:00Z
status: passed
score: 10/10
behavior_unverified: 0
overrides_applied: 0
re_verification: null
---

# Phase 54: reusable-trigger — Verification Report

**Phase Goal:** One discovery service is reachable from two entry points — automatically after every import and on demand from the Files table.
**Verified:** 2026-06-21T07:40:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The suggestions page sources its data from `discoverRegexCandidates` (platform-scoped), not the legacy `detectPatternSuggestions` | VERIFIED | `app/(app)/import/[fileId]/suggestions/page.tsx` imports and calls `discoverRegexCandidates({ userId, scope: { platformId } })`; zero matches for `detectPatternSuggestions` in `app/` and `components/` |
| 2 | A platform with 8 identical "EUR deposit" rows produces 0 regex candidates (1 single-categorization suggestion) | VERIFIED | Test anchor in `tests/import-suggestions-page.test.tsx` (test "8 identical EUR deposit rows → 0 regex candidates, 1 single suggestion") passes; 11/11 tests pass |
| 3 | The suggestions page renders both `discovery.candidates` (regex) and `discovery.singleCategorizationSuggestions` (identical groups) | VERIFIED | `SuggestionSection` accepts `singleSuggestions?: SingleCategorizationSuggestion[]`; early-return guard covers both lists; page passes both to the component |
| 4 | The `notFound()` guards on missing/unimported file and null platformId are preserved | VERIFIED | Guards present at lines 17–24 of `app/(app)/import/[fileId]/suggestions/page.tsx`; test cases for both guards pass |
| 5 | `detectPatternSuggestions` has no production consumer outside `analyzeFile` | VERIFIED | `grep -rn "detectPatternSuggestions" app/ components/ lib/actions/` returns 0 matches; only `lib/services/import.ts:analyzeFile` retains the call (lines 29 and 313), flagged `TODO Phase 55: remove` |
| 6 | After `importFile`'s transaction commits, `discoverRegexCandidates` runs as a post-commit step (outside `db.transaction`) | VERIFIED | Block at `lib/services/import.ts` lines 670–688, after `db.transaction` resolves; wrapped in try/catch; `tests/import-service.test.ts` describes "importFile — post-commit discovery (TRIG-01)" — 58/58 pass |
| 7 | Post-commit discovery is non-fatal: on throw, import still succeeds and `discoveryCount` is 0 | VERIFIED | try/catch at lines 679–685 logs `post_import_discovery_failed` and leaves `discoveryCount = 0`; test case "when discoverRegexCandidates throws, importFile returns successfully with discoveryCount: 0" passes |
| 8 | `ImportFileResult` carries a `discoveryCount` field; the import-result UI shows a CTA + count linking to `/import/[fileId]/suggestions` when `discoveryCount > 0` with no auto-redirect | VERIFIED | `ImportFileResult.discoveryCount: number` at line 68 of `lib/services/import.ts`; `import-preview.tsx` lines 91–96 and 233–258 render CTA only when `count > 0`, no `router.push` to suggestions on that path (D-05 respected) |
| 9 | Each imported Files-table row exposes a per-row "ricontrolla regex" action via a thin `recheckRegexAction` server action over `discoverRegexCandidates` (no second detector path) | VERIFIED | `recheckRegexAction` at `lib/actions/import.ts` lines 563–598; calls `verifySession` → `getPlatformIdForUserFile` → `discoverRegexCandidates`; no `detectPatternSuggestions` reference in the action; 6/6 tests pass |
| 10 | On zero candidates the client toasts "Nessun pattern trovato per questa piattaforma" without navigating; on >0 it navigates to `/import/[fileId]/suggestions` | VERIFIED | `import-table.tsx` lines 220–227: zero total → `toast("Nessun pattern trovato per questa piattaforma")` and `return`; lines 226–227: `router.push` only when `total > 0` |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/(app)/import/[fileId]/suggestions/page.tsx` | Unified-service-backed suggestions page | VERIFIED | Calls `discoverRegexCandidates({ userId, scope: { platformId } })`; both `notFound()` guards present; passes `singleSuggestions` to `SuggestionSection` |
| `components/import/suggestion-section.tsx` | Render path for both candidate lists | VERIFIED | `singleSuggestions?: SingleCategorizationSuggestion[]` prop added; early-return guard covers both lists; single suggestions rendered as `<ul>` plain list |
| `lib/services/import.ts` | Post-commit `discoverRegexCandidates` call + `discoveryCount` on `ImportFileResult` | VERIFIED | `ImportFileResult.discoveryCount: number` at line 68; post-commit block at lines 670–688; `analyzeFile` legacy block untouched |
| `components/import/import-preview.tsx` | `discoveryCount` CTA on the import result | VERIFIED | Reads `res.data?.discoveryCount`; renders CTA panel with count + link only when `discoveryCount > 0`; no auto-redirect |
| `lib/actions/import.ts` | `recheckRegexAction` thin server action over `discoverRegexCandidates` | VERIFIED | Exported at line 563; auth → ownership guard → service call → returns `ImportActionState<{ candidatesCount; singleCount; platformId }>`; no business logic in action |
| `components/import/import-row-actions.tsx` | Per-row "ricontrolla regex" menu item + `onRecheckRegex` prop | VERIFIED | Props `onRecheckRegex: (row: ImportListRow) => void` and `isRecheckPending?: boolean` at lines 23–25; clickable `DropdownMenuItem` (not a Link) for `row.status === 'imported'` at line 125 |
| `components/import/import-table.tsx` | Client wiring: action call + toast + router.push | VERIFIED | Imports `recheckRegexAction`; defines `handleRecheckRegex`; passes `onRecheckRegex` + `isRecheckPending` to `ImportRowActions`; toast without nav on zero, `router.push` on >0 |
| `tests/import-suggestions-page.test.tsx` | Tests against unified service + EUR-deposit anchor | VERIFIED | 11/11 tests pass; no legacy mocks (`detectPatternSuggestions`, `getUncategorizedTransactionsByFileId`, `loadActivePatterns`); EUR-deposit anchor test present |
| `tests/import-service.test.ts` | TDD tests for post-commit discovery (TRIG-01) | VERIFIED | 58/58 tests pass; 4 new tests in "importFile — post-commit discovery (TRIG-01)" suite |
| `tests/recheck-regex-action.test.ts` | TDD tests for `recheckRegexAction` (TRIG-02) | VERIFIED | 6/6 tests pass; covers auth, IDOR guard, missing fileId, service throw, userId provenance |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/(app)/import/[fileId]/suggestions/page.tsx` | `lib/services/regex-discovery.ts` | `discoverRegexCandidates({ userId, scope: { platformId } })` | WIRED | Import at line 5; call at line 28 |
| `app/(app)/import/[fileId]/suggestions/page.tsx` | `lib/dal/files.ts` | `getPlatformIdForUserFile` ownership guard | WIRED | Import at line 3; call at line 21 |
| `lib/services/import.ts` | `lib/services/regex-discovery.ts` | Post-commit `discoverRegexCandidates({ userId, scope: { platformId } })` | WIRED | Import at line 38; call at line 676 |
| `lib/services/import.ts` | `lib/dal/files.ts` | `getPlatformIdForUserFile` post-commit ownership guard | WIRED | Import at line 10–14; call at line 674 |
| `components/import/import-preview.tsx` | `app/(app)/import/[fileId]/suggestions/page.tsx` | CTA link rendered when `result.discoveryCount > 0` | WIRED | `href` at line 241: `/import/${encodeURIComponent(importedFileId)}/suggestions` |
| `components/import/import-table.tsx` | `lib/actions/import.ts` | `recheckRegexAction(formData)` called from row callback | WIRED | Import at line 27; call at line 208 |
| `lib/actions/import.ts` | `lib/dal/files.ts` | `getPlatformIdForUserFile({ userId, fileId })` ownership guard | WIRED | Import at line 38; call at line 576 |
| `lib/actions/import.ts` | `lib/services/regex-discovery.ts` | `discoverRegexCandidates({ userId, scope: { platformId } })` | WIRED | Import at line 39; call at line 583 |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Suggestions-page tests pass (EUR-deposit anchor, service call assertion) | `yarn vitest run tests/import-suggestions-page.test.tsx` | 11/11 passed | PASS |
| Post-commit discovery tests pass (non-fatal, discoveryCount, null-platformId) | `yarn vitest run tests/import-service.test.ts` | 58/58 passed | PASS |
| recheckRegexAction tests pass (auth, IDOR, missing fileId, service throw) | `yarn vitest run tests/recheck-regex-action.test.ts` | 6/6 passed | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TRIG-01 | 54-02 | Discovery runs automatically post-import as the step following auto-categorization | SATISFIED | `importFile` post-commit block in `lib/services/import.ts`; `discoveryCount` field on `ImportFileResult`; CTA in `import-preview.tsx` |
| TRIG-02 | 54-01, 54-03 | User can trigger on-demand re-check from Files table via the same underlying service | SATISFIED | `recheckRegexAction` in `lib/actions/import.ts`; `onRecheckRegex` prop + menu item in `import-row-actions.tsx`; client wiring in `import-table.tsx` |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `lib/services/import.ts` | 302 | `TODO Phase 55: remove — regex discovery now runs post-import...` | INFO | Intentional deferral: `detectPatternSuggestions` in `analyzeFile` scheduled for deletion in Phase 55. Reference to a named follow-up phase is present — no unreferenced debt. |

No `TBD`, `FIXME`, or `XXX` markers found in any file modified by this phase.

---

### Human Verification Required

None. All truths are verifiable programmatically and all behavioral tests pass. Visual presentation (minimal CTA, single-suggestion list styling) is minimal by design (Phase 55 polishes the UI — SUMUI-02).

---

## Gaps Summary

No gaps. All 10 observable truths are verified, all 10 artifacts exist and are wired, all 8 key links are confirmed. Both TRIG-01 and TRIG-02 requirements are satisfied. The divergent detector path (`detectPatternSuggestions`) has no UI/component/action consumer — its sole remaining call is `analyzeFile` in `lib/services/import.ts`, intentionally deferred to Phase 55 with a named TODO reference.

---

_Verified: 2026-06-21T07:40:00Z_
_Verifier: Claude (gsd-verifier)_
