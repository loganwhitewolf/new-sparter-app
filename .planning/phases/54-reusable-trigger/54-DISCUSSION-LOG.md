# Phase 54: reusable-trigger - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-20
**Phase:** 54-reusable-trigger
**Areas discussed:** Re-check UX (TRIG-02), Auto-run post-import (TRIG-01), On-demand destination + empty-state, Suggestions page scope, Import-result surfacing

**Origin:** This phase was scoped during a `/gsd-plan-phase 53 --gaps` session. The only actionable Phase 53 gap (8× identical "EUR deposit" rows surfaced as a regex) was traced to the `/suggestions` page using the legacy `detectPatternSuggestions()` instead of the unified `discoverRegexCandidates()` service (which already suppresses identical clusters). The user routed the fix into Phase 54 (reusable-trigger), whose SC-2 already mandates "the same underlying service — no parallel/divergent implementation."

---

## Re-check UX from the Files table (TRIG-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-row | "ricontrolla regex" on each file row; resolves platform from file; platform-scoped discovery; bulk deferred | ✓ |
| Bulk in toolbar | Single "ricontrolla tutto" action; fewer clicks but ambiguous destination | |
| Both | Per-row + toolbar bulk action | |

**User's choice:** Per-row
**Notes:** Accepted that, because discovery is platform-scoped, re-checking two files on the same platform yields identical results. Bulk action deferred.

---

## Auto-run after import (TRIG-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Synchronous post-commit | Runs after import + auto-categorization, outside db.transaction; no job infra | ✓ |
| Background + badge | Import returns immediately; discovery in background with per-file badge; needs job/polling | |

**User's choice:** Synchronous post-commit
**Notes:** Replaces the legacy inline `detectPatternSuggestions()` in `import.ts` (already TODO-marked for Phase 55). Simplest-first; no background infrastructure exists.

---

## On-demand re-check destination + empty-state

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate to /suggestions | Re-check lands on the unified suggestions page | ✓ |
| In-place toast/count | Runs without navigating; shows "N nuovi suggerimenti" + link | |

**User's choice:** Navigate to suggestions page

| Option (empty result) | Description | Selected |
|--------|-------------|----------|
| Toast, stay on Files table | Zero candidates → toast "Nessun pattern trovato per questa piattaforma", no navigation | ✓ |
| Navigate anyway (empty-state) | Always navigate; page shows an empty-state message | |

**User's choice:** Toast + stay on Files table (avoid dead-end empty page)

---

## Suggestions page scope (file → platform)

| Option | Description | Selected |
|--------|-------------|----------|
| Platform-scoped | Page shows whole-platform candidates via discoverRegexCandidates; matches apply scope | ✓ |
| Keep "per this file" | Filter candidates to the file's transactions; re-introduces divergence | |

**User's choice:** Platform-scoped
**Notes:** Consistent with D-03/APPLY-02 — the promote/apply path is already platform-wide, so what is shown matches what apply touches.

---

## Import-result surfacing (TRIG-01 UX, Phase 55 boundary)

| Option | Description | Selected |
|--------|-------------|----------|
| CTA + count | Import-result screen shows "X pattern proposti" with link; no auto-redirect | ✓ |
| Auto-redirect | Go straight to suggestions after import | |
| Availability only (badge) | No CTA in import flow; reachable only from per-row action | |

**User's choice:** CTA + count
**Notes:** Minimal; the rich import summary belongs to Phase 55.

---

## Claude's Discretion

- Italian copy for the per-row action label, import CTA, and empty-result toast.
- Visual placement of the per-row action (button vs row menu) and how platform scope is signalled.
- Whether to delete legacy `detectPatternSuggestions()` + tests now or flag for Phase 55.
- Loading/disabled states during the synchronous on-demand re-check.
- Threading the discovery count from the post-commit call to the import-result screen.

## Deferred Ideas

- Bulk / global "ricontrolla tutto" re-check across platforms.
- Background/async discovery with per-file "pronto" badge + polling.
- Rich import-summary UX (≤10 capped examples, regex-vs-single visual separation, "separate step" cue) → Phase 55.
- Auto-applying discovered patterns without user promotion.
