# Phase 51: discovery-pipeline-reorder - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Regex discovery becomes a distinct step that runs **after** auto-categorization, examining **only** the still-uncategorized residual (Set B), and is extracted from the `analyzeFile`/`importFile` flow into a standalone service that does not depend on an in-progress import. Platform-specific normalization is applied before discovery, and the service reports what normalization already collapsed vs the residual-variable text the regex must still handle.

Delivers requirements **PIPE-01, PIPE-02, PIPE-03** only. This phase reorders/extracts the in-app discovery path; it does not implement validity/dedup (Phase 52), retroactive application (Phase 53), the dual trigger UX (Phase 54), or the summary UX (Phase 55).

</domain>

<decisions>
## Implementation Decisions

### Discovery timing / data source
- **D-01:** Discovery runs **post-categorization, on the persisted Set B** — uncategorized expenses (`expense.status = '1'` / `subCategoryId IS NULL`) after `categorizePipeline` has written results at the `descriptionHash`/expense grain. It does **not** run pre-commit on parsed rows, and there is no analyze-time dry-run of categorization. This matches PIPE-02 ("callable without an import in progress") and SC2 ("against persisted uncategorized transactions"). The Phase 55 summary will read the post-commit discovery result.

### Service contract
- **D-02:** A standalone service `discoverRegexCandidates({ userId, scope })` lives in `lib/services` (e.g. a discovery service module). It uses a **DAL query** to fetch the persisted uncategorized set, applies platform normalization, then **delegates the prefix/variable clustering to a pure util** (reuse/extend the existing `detectPatternSuggestions` in `lib/utils/pattern-suggestions.ts`). The pure util stays unit-testable in isolation; both Phase 54 entry points call the service, never the util directly.

### Read scope
- **D-03:** The `scope` argument is **platform-scoped from the start**: `scope = { platformId }` selects the platform's **entire uncategorized history** as discovery input. Both Phase 54 entry points (automatic post-import + on-demand from the Files table) resolve a file → its platform → that platform's uncategorized set. This keeps discovery platform-bounded ("never cross into another platform's history") and aligns with the platform-grouped offline CLI.
- **Note:** This is the discovery *read* scope. The retroactive *write* scope (current file vs platform history) is **APPLY-02, deferred to Phase 53** — do not resolve it here.

### Unification of the two implementations
- **D-04:** **In-app path only.** Phase 51 reorders + extracts the in-app discovery into the service + pure util. The offline operator CLI `scripts/regex-discovery.ts` (`yarn regex:discover`, token-cluster + Markdown report) is **left untouched** — it is a separate operator workflow (see Deferred Ideas). The two implementations use different algorithms (in-app prefix-based vs CLI token-cluster); converging them is explicitly out of scope.

### Normalization report (PIPE-03)
- **D-05:** The report is **per-candidate metadata**. Each discovery candidate carries fields distinguishing what normalization already collapsed from what the regex must still handle, e.g. `{ stablePrefix, strippedByNormalization, residualVariablePart, sampleNormalized }`. No separate top-level analysis object and no roll-up are required for this phase; per-candidate metadata feeds the Phase 55 summary UX directly.

### Claude's Discretion
- Exact module/file naming, DAL query naming, and how the pure util's signature is extended to carry the D-05 metadata are left to research/planning.
- Whether the old inline `analyzeFile` `detectPatternSuggestions` call (`lib/services/import.ts:298–322`) is removed within Phase 51 or kept as dead-but-harmless until Phase 54/55 wires the new path: planner's call. The intent is that discovery no longer runs pre-categorization on the full set; cutover sequencing is an implementation detail.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase / milestone definition
- `.planning/ROADMAP.md` §"Phase 51: discovery-pipeline-reorder" — goal, success criteria 1–4, the Fineco DoD input.
- `.planning/REQUIREMENTS.md` — PIPE-01/02/03 wording; RDISC/APPLY/TRIG/SUMUI for downstream-phase awareness.

### In-app discovery + import pipeline (to reorder/extract)
- `lib/services/import.ts` — `analyzeFile` (current pre-commit `detectPatternSuggestions` call at lines ~298–322) and `importFile` (commit-time `categorizePipeline` at ~558, expense upsert at `descriptionHash` grain).
- `lib/utils/pattern-suggestions.ts` — `detectPatternSuggestions`, `PatternDetectorRow`, `CoveragePattern`, `PatternSuggestion`, `isCoveredByPatterns` (the pure clustering util to extend).
- `lib/services/categorization.ts` — `categorizePipeline`, `loadActivePatterns`, `applyTier1Regex`, `applyTier2History`, `SubscriptionPlan`.
- `lib/services/categorization-match.ts` — `ActivePattern`, `CategorizationResult`, `applyTier1Regex` (script-safe, no `server-only`).

### Platform normalization
- Project guide `CLAUDE.md` + memory note: `descriptionStripPattern` is a nullable column on platform (migration 0015) used to strip bank boilerplate (e.g. Fineco). Discovery must apply this before clustering (PIPE-03).
- `lib/utils/import.ts` — `normalizeTransactionRow` (used by both import and the offline CLI).

### Offline CLI (out of scope, reference only)
- `scripts/regex-discovery.ts` — operator tool, NOT changed in this phase. `docs/regex-discovery.md` documents the `yarn regex:discover` → `/regex-label` → `seed-patterns-data.ts` workflow.
- `scripts/seed-patterns-data.ts` / `scripts/seed-patterns.ts` — canonical system patterns (single source of truth for global regex).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `detectPatternSuggestions` (pure, prefix-based clustering) — the core to extend into the new pure util; already returns ranked `PatternSuggestion[]` with `matchCount`.
- `categorizePipeline` / Tier-1 regex matching — defines what "categorized" means; Set B is its complement.
- `descriptionStripPattern` normalization (per-platform) + `normalizeTransactionRow` — the normalization to apply before discovery.

### Established Patterns
- Layered architecture (`dal` queries / `services` logic / thin `actions`) — the service must fetch via DAL, not inline SQL.
- Categorization happens at the **expense / `descriptionHash`** grain inside `importFile`'s `db.transaction`; Set B is therefore naturally an expense-grain set.
- `server-only` split: `categorization-match.ts` is script-safe so the offline CLI can reuse pure logic — mirror this if the new util must stay importable from scripts.

### Integration Points
- New service slots in **after** the commit-time categorization, reading persisted uncategorized expenses by `platformId`.
- Phase 54 will call this service from two entry points (post-import auto-run + Files-table on-demand); the service signature must support both.
- Phase 55 will render the per-candidate D-05 metadata in the import summary.

</code_context>

<specifics>
## Specific Ideas

- DoD anchor (from ROADMAP success criteria): the Fineco "Bonifico Andrea Bernardini causale stipendio marzo/maggio/giugno" input must survive categorization as Set B and reach discovery as **normalized, uncategorized** text — not silently dropped. Use this as the canonical test input.

</specifics>

<deferred>
## Deferred Ideas

- **Unify the offline CLI onto the in-app clustering core** — converge `scripts/regex-discovery.ts` (token-cluster) and the in-app prefix-based util onto one algorithm. Out of scope for v2.1 Phase 51; backlog candidate (would require choosing a single algorithm and reworking the operator report).
- **Retroactive write scope (APPLY-02)** — current-file-only vs platform-entire-uncategorized-history for *applying* a created regex. Owned by Phase 53; only the *read* scope is decided here (D-03).

</deferred>

---

*Phase: 51-discovery-pipeline-reorder*
*Context gathered: 2026-06-16*
