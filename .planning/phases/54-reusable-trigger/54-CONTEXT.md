# Phase 54: reusable-trigger - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning

<domain>
## Phase Boundary

One discovery service — `discoverRegexCandidates` (platform-scoped, post-transaction) — becomes reachable from **two entry points**:
1. **Automatically after every import**, as the step following auto-categorization (TRIG-01).
2. **On-demand from the Files table** via a per-row "ricontrolla regex" action (TRIG-02).

As the foundation for both, the UI stops using the legacy `detectPatternSuggestions()` detector and consumes the unified service everywhere. Retiring the divergent detector is what satisfies TRIG-02's "same underlying service — no parallel/divergent implementation," and it **fixes the Phase 53 UAT bug** (8× identical `"EUR deposit"` rows surfaced as a regex) for free: identical-after-normalization clusters route to `singleCategorizationSuggestions`, never to regex `candidates` (RDISC-01/02, already implemented + tested in the service).

Delivers **TRIG-01, TRIG-02** only. This phase does **not** build the rich import-summary UX (capped examples, visual regex-vs-single separation) — that is **Phase 55**.

</domain>

<decisions>
## Implementation Decisions

### On-demand re-check from the Files table (TRIG-02)
- **D-01:** **Per-row** "ricontrolla regex" action on each file row in the Files table (`app/(app)/import/`, `FilesToolbar.tsx`). The action resolves the platform from that file (server-side, mirroring Phase 53's `getPlatformIdForUserFile`) and runs the platform-scoped unified service. A bulk/global "ricontrolla tutto" is **deferred** (see Deferred Ideas).
- **Accepted consequence:** because discovery is platform-scoped, re-checking two different files on the *same* platform yields the same result. This is acceptable; the action label/result should make the platform scope legible (exact copy at planner/UI discretion).

### Auto-run after import (TRIG-01)
- **D-02:** **Synchronous, post-commit.** After `importFile` commits and auto-categorization completes, run `discoverRegexCandidates` as a subsequent step (it is designed to run **outside** `db.transaction` — `userId` + `platformId` only, no file bytes, no R2 handle). No background-job / polling infrastructure (none exists today; simplest-first).
- This **replaces** the legacy inline `detectPatternSuggestions()` call currently in `lib/services/import.ts` (the one already marked `// TODO Phase 55: remove`).

### On-demand re-check destination (TRIG-02 UX)
- **D-03:** A successful on-demand re-check **navigates to the unified `/import/[fileId]/suggestions` page** (same surface as the post-import path). No separate in-place presentation surface — single rendering path.
- **D-06:** If the re-check finds **zero candidates**, do **not** navigate. Show a toast `"Nessun pattern trovato per questa piattaforma"` and keep the user on the Files table (avoid a dead-end empty page). Exact Italian copy at UI discretion.

### Suggestions page migration & scope (foundation)
- **D-04:** Migrate `app/(app)/import/[fileId]/suggestions/page.tsx` from `detectPatternSuggestions()` to `discoverRegexCandidates({ userId, scope: { platformId } })`. The page resolves `platformId` from `fileId` first (Phase 53 `getPlatformIdForUserFile`), then calls the service. **Scope becomes platform-wide** (the whole platform's uncategorized history), not file-only — confirmed and intentional: consistent with D-03/APPLY-02 (the promote/apply path is already platform-wide, so what is shown matches what apply touches).
- The page now renders the service's two lists: `candidates` (regex) and `singleCategorizationSuggestions` (identical groups). Minimal presentation here; the polished visual separation is Phase 55.

### Auto-run result surfacing (TRIG-01 UX, Phase 55 boundary)
- **D-05:** After the synchronous auto-run, the import-result screen shows a **CTA + count** (e.g. "X pattern proposti") linking to the suggestions page. **No auto-redirect.** Keep it minimal — the rich import summary belongs to Phase 55.

### Legacy detector retirement
- After D-02 and D-04, `detectPatternSuggestions()` has no remaining production consumers (its two callers were the suggestions page and `import.ts`). Whether to delete the legacy function + its tests now or leave the dead code for Phase 55 cleanup is **Claude's discretion** for the planner — but no UI/flow may keep calling it (TRIG-02 forbids a divergent implementation).

### Claude's Discretion
- Exact Italian copy for the per-row action label, the import CTA, and the empty-result toast.
- Where the per-row action lives visually (row button vs row menu) and how the platform scope is signalled.
- Whether `detectPatternSuggestions()` (and its tests) are deleted in this phase or flagged for Phase 55.
- Loading/disabled states during the synchronous on-demand re-check.
- How the import-result count is threaded from the post-commit discovery call to the result screen.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase / requirements definition
- `.planning/ROADMAP.md` §"Phase 54: reusable-trigger" — goal, success criteria 1–3.
- `.planning/REQUIREMENTS.md` — TRIG-01, TRIG-02 (TRIG-02 open per-row/bulk decision is now resolved → per-row).

### Unified discovery service (the one service to reuse)
- `lib/services/regex-discovery.ts` — `discoverRegexCandidates({ userId, scope })`, `DiscoveryResult`, `DiscoveryScope`; residual split routing identical groups to `singleCategorizationSuggestions` (RDISC-01/02), Check 1/Check 2 dedup (RDISC-03/04). **Post-transaction, platform-scoped.**
- `lib/dal/regex-discovery.ts` — `getUncategorizedExpensesForDiscovery(userId, platformId)` (platform-scoped Set B) and `getManuallyCategorizedHashes`.
- `lib/utils/pattern-suggestions.ts` — legacy `detectPatternSuggestions()` (to retire) and `detectPatternSuggestionsWithMeta()` (used by the service).

### Entry points to wire
- `lib/services/import.ts` — `importFile`; legacy inline `detectPatternSuggestions()` call (~lines 298–313, `// TODO Phase 55: remove`) → replace with post-commit `discoverRegexCandidates` (TRIG-01).
- `app/(app)/import/[fileId]/suggestions/page.tsx` — current legacy consumer to migrate (TRIG-02 destination + D-04 scope shift).
- `app/(app)/import/` (Files table) + `app/(app)/import/FilesToolbar.tsx` — host for the per-row "ricontrolla regex" action (TRIG-02 entry point).
- `lib/dal/files.ts` — `getPlatformIdForUserFile({ userId, fileId })` (Phase 53; reuse for file→platform resolution + ownership guard).

### Upstream context (scope alignment)
- `.planning/phases/51-discovery-pipeline-reorder/51-CONTEXT.md` — D-03 platform-scoped discovery read scope.
- `.planning/phases/52-regex-validity-and-dedup/52-CONTEXT.md` + `52-VERIFICATION.md` — unified service contract (two-list output, RDISC-01/02/03/04); verified service is additive and was UI-agnostic by design.
- `.planning/phases/53-retroactive-application/53-CONTEXT.md` — promote flow, platform resolution, applyResult counts.
- `.planning/phases/53-retroactive-application/53-UAT.md` — origin of the EUR-deposit identical-cluster bug this phase resolves; `53-VERIFICATION.md` for the verified Phase 53 surface.

### Domain language
- `CONTEXT.md` (repo root) — Transaction vs Expense, categorization tiers, descriptionHash, platform.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `discoverRegexCandidates` — the single unified service; built + tested in Phase 52, currently **zero production consumers**. This phase wires it in.
- `getPlatformIdForUserFile` — Phase 53 DAL with ownership guard; reuse for both the suggestions page and the per-row re-check to resolve `platformId` from `fileId`.
- The `/suggestions` page already resolves `platformId` and calls `notFound()` on a broken platform chain (Phase 53) — keep that guard when migrating the data source.

### Established Patterns
- Layered: queries in `dal/`, business logic in `services/`, thin `"use server"` actions. The on-demand re-check should be a thin action over the service; navigation in the client.
- Imports run inside `db.transaction`; discovery must run **after** the transaction commits (the service forbids a tx handle).
- Italian product copy for user-facing surfaces; English for code/comments/logs (`yarn check:language`).

### Integration Points
- TRIG-01: post-commit hook in the import flow (after auto-categorization) → `discoverRegexCandidates` → count surfaced as a CTA on the import-result screen.
- TRIG-02: per-row Files-table action → resolve platform → run service → navigate to `/suggestions` (or toast on empty).
- Both entry points and the suggestions page must call the **same** service (no second detector path).

</code_context>

<specifics>
## Specific Ideas

- Verification anchor (the bug that motivated this phase): a Crypto.com file with 8 identical `"EUR deposit"` rows must produce **0 regex candidates** and (at most) a single-categorization suggestion — never a regex proposal — on the `/suggestions` page, because the page now uses `discoverRegexCandidates` (RDISC-02), not the legacy detector.
- "Same kind of results" (SC-1/SC-3): the automatic post-import run and an on-demand re-check for the same uncategorized set must produce identical candidates (same service, modulo data changed since import).

</specifics>

<deferred>
## Deferred Ideas

- Bulk / global "ricontrolla tutto" re-check across all platforms/files (toolbar-level) — future enhancement; per-row is enough for TRIG-02.
- Background/async discovery with a per-file "pronto" badge + polling — needs job infrastructure; revisit only if synchronous post-import discovery proves too slow on large imports.
- Rich import-summary UX: ≤10 capped example transactions, visual regex-vs-single-categorization separation, "discovery is now a separate step" cue → **Phase 55 (import-summary-ux)**.
- Auto-applying discovered patterns without user promotion — out of scope (promotion stays user-driven, per Phase 53).

</deferred>

---

*Phase: 54-reusable-trigger*
*Context gathered: 2026-06-20*
