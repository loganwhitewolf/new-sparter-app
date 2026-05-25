---
phase: 35
plan: 02
subsystem: import-review-promotion
tags: [tdd, green-phase, server-action, pattern-suggestions, wave-1]
dependency_graph:
  requires:
    - "35-01: RED test suite for promoteSuggestionAction"
  provides:
    - "promoteSuggestionAction exported from lib/actions/patterns.ts (REV-03)"
    - "Server-side validation and IDOR/tampering mitigations (T-35-01, T-35-02, T-35-03)"
  affects:
    - "lib/actions/patterns.ts"
    - "tests/pattern-actions.test.ts (7 tests turned GREEN)"
tech_stack:
  added: []
  patterns:
    - "verifySession() as first line of Server Action (auth gate)"
    - "CreatePatternSchema.safeParse() for all FormData reads (input validation)"
    - "Hardcoded confidence value to prevent FormData tampering"
    - "Generic error message for DAL failures (no detail leakage)"
key_files:
  created: []
  modified:
    - lib/actions/patterns.ts
decisions:
  - "confidence: 0.85 hardcoded in action body — FormData confidence field is never read (D-01, T-35-02)"
  - "No requireCustomPatternsAccess call — free users may promote suggestions (D-03)"
  - "description: undefined — inline promote form does not collect description (D-01)"
  - "userId from verifySession() only — FormData userId is not read at any point (T-35-01)"
metrics:
  duration: "4m"
  completed: "2026-05-23"
  tasks_completed: 1
  files_modified: 1
---

# Phase 35 Plan 02: promoteSuggestionAction Implementation Summary

`promoteSuggestionAction` added to `lib/actions/patterns.ts` (~34 LOC): validates FormData with `CreatePatternSchema`, hardcodes `confidence: 0.85`, derives `userId` exclusively from `verifySession()`, writes via `createPattern` DAL, and revalidates categorization surfaces — with no subscription gate per D-03.

## Implementation Details

### New function signature

```typescript
export async function promoteSuggestionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState>
```

**Location:** `lib/actions/patterns.ts`, appended after `deletePatternAction` (line 146 onwards)
**LOC added:** 34 lines (including blank lines and comments)

### 5 divergences from `createPatternAction`

| # | Divergence | createPatternAction | promoteSuggestionAction | Reason |
|---|---|---|---|---|
| 1 | Plan gate | `requireCustomPatternsAccess(subscriptionPlan)` called | NOT called | D-03: all plans may promote suggestions |
| 2 | verifySession destructure | `{ userId, subscriptionPlan }` | `{ userId }` only | subscriptionPlan not needed (no gate) |
| 3 | confidence source | `formData.get("confidence")` | Hardcoded `0.85` | D-01 + anti-tampering (T-35-02) |
| 4 | description source | `formData.get("description")` | `undefined` (literal) | D-01: inline form does not collect description |
| 5 | Subscription check | Guards entire flow | No guard | D-03: suggestion promotion is plan-agnostic |

### No new imports

Lines 1–18 of `lib/actions/patterns.ts` are unchanged. All required symbols were already imported:
- `verifySession` (line 2)
- `CreatePatternSchema`, `ActionState` (lines 3–7)
- `createPattern` (lines 8–12)
- `revalidateCategorizationSurfaces` (line 18)

## Threat Mitigations

| Threat ID | Category | Mitigation | Pinned by test |
|-----------|----------|------------|----------------|
| T-35-01 | Tampering / IDOR | `userId` destructured exclusively from `verifySession()`. FormData `userId` field is never read. `createPattern({ ...parsed.data, userId })` ensures session value wins even if schema were extended. | Test 1: calls with `userId: 'attacker-id'` in FormData → DAL receives `userId: 'user-abc'` from session |
| T-35-02 | Tampering (input validation) | All FormData reads go through `CreatePatternSchema.safeParse()`. `confidence` is literal `0.85` — FormData tampering on this field has zero effect. | Test 2: FormData `confidence: '0.99'` → DAL receives `confidence: 0.85` |
| T-35-03 | Spoofing / Authn bypass | `await verifySession()` is the first line. If session is missing/invalid, the action throws/redirects before any DB write. | Test 7: `verifySession` rejects with NEXT_REDIRECT → action rejects, no `createPattern` call |

## Test Results

### Before this plan (Plan 01 RED state)

```
Tests: 10 failed | 27 passed (37) [pattern-actions.test.ts only had 22 tests, 7 failing]
```

### After this plan

```
tests/pattern-actions.test.ts: 29 passed (29)
Full suite: 3 failed | 565 passed | 1 todo (569)
```

The 3 remaining failures are the RED tests for Plans 03 and 04 (UI components and wiring not yet created):
- 2 tests in `tests/import-preview-ui.test.tsx` (SuggestionSection rendering)
- 1 test in `tests/import-analyze-page.test.tsx` (getCategories wiring)

These are expected at this wave stage and are not regressions.

### promoteSuggestionAction describe block: 7/7 GREEN

| Test | Description | Requirement |
|------|-------------|-------------|
| 1 | Session userId used, FormData attacker-id ignored | REV-03, T-35-01 |
| 2 | FormData confidence: 0.99 → DAL receives 0.85 | T-35-02 |
| 3 | Free user succeeds when min plan = basic | D-03 |
| 4 | Missing subCategoryId → Italian validation error, no DAL call | REV-05 |
| 5 | Malformed pattern `([` → "Pattern regex non valido.", no DAL call | REV-05 |
| 6 | DAL FATAL error → generic Italian message, no detail leaked | REV-05 |
| 7 | verifySession rejects → action rejects, no DAL call | T-35-03 |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 355c694 | feat(35-02): add promoteSuggestionAction to lib/actions/patterns.ts |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan implements a Server Action with no UI rendering.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes. The action uses the existing `createPattern` DAL which already has a trust boundary.

## Self-Check: PASSED

### Files verified
- lib/actions/patterns.ts: FOUND (in worktree)

### Commits verified
- 355c694 (Task 1): FOUND
