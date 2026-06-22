# Phase 52: regex-validity-and-dedup - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning
**Source:** Plan-phase decision capture (discuss-phase skipped; 3 research open-questions resolved inline)

<domain>
## Phase Boundary

Extends the Phase 51 `discoverRegexCandidates` service so it:
1. Proposes a regex ONLY for genuine prefix+variable families (RDISC-01).
2. Surfaces identical-after-normalization groups as single-categorization suggestions instead, with NO regex (RDISC-02).
3. Skips a candidate whose generated regex would already be covered by an existing active pattern (RDISC-03, Check 1).
4. Skips a candidate already covered by an existing manual categorization for the same `descriptionHash` (RDISC-04, Check 2).

Purely additive on three existing Phase 51 files — no migration, no new packages.
</domain>

<decisions>
## Implementation Decisions

### SC-1 vs SC-2 routing (RDISC-01 / RDISC-02)
- The Phase 51 `residualVariablePart` field IS the signal — no new clustering algorithm.
  - `residualVariablePart` non-empty → genuine prefix+variable family → propose regex.
  - `residualVariablePart` empty (longest-common-prefix consumed all tokens) → identical group → single-categorization suggestion, no regex.

### Macellaio / single-categorization token count (open question A1 — RESOLVED)
- **Decision: real repeated-merchant descriptions are always multi-token** (POS/PAGAMENTO prefix or name+surname).
- The util's `< 2 token` guard stays UNCHANGED — zero behavioral change to `pattern-suggestions.ts` clustering.
- DoD test case 2 uses a multi-token fixture (e.g. `"Macellaio Da Mario"`), not a bare single word.

### Check 2 policy — partial manual coverage (RDISC-04 — RESOLVED)
- **Decision: ANY member manually categorized → skip the whole candidate.**
- Conservative: if even one cluster member already has a manual categorization for the same `descriptionHash`, the candidate is dropped (don't re-propose what the user already decided by hand).

### Check 2 scope (RDISC-04 — RESOLVED)
- **Decision: dedup against the user's ENTIRE manual history, platform-agnostic.**
- `descriptionHash` is platform-agnostic; if the user manually categorized that description on ANY platform, do not re-propose it.

### Check 2 data source (from research — critical trap)
- The `unique(userId, descriptionHash)` constraint on `expense` means an uncategorized and a categorized expense can never share a hash — querying current `expense` rows always returns empty.
- Check 2 MUST query `expenseClassificationHistory` with `source = 'manual'` (the persisted source of truth). New DAL query `getManuallyCategorizedHashes`.

### Check 1 semantics (RDISC-03 — from research)
- Check 1 is NOT the Phase 51 input-coverage filter (which discards input rows matching an active pattern).
- Check 1 tests the candidate's GENERATED regex against existing active patterns — a separate explicit gate (`candidateCoveredByExistingPattern`), reusing the same dual full + numeric-stripped matcher as `applyTier1Regex` (matcher fidelity).

### Output shape
- Add a second list `singleCategorizationSuggestions` to `DiscoveryResult` (NOT a discriminated union).
- Consumed downstream by Phase 54 (trigger) and Phase 55 SUMUI-02 (visual separation).
- Propagate `descriptionHashes: string[]` through the util (additive pattern already established in Phase 51).

### Claude's Discretion
- Exact function/file naming for the new DAL query and the gate helpers, following Phase 51 conventions.
- Test fixture wording, beyond the multi-token requirement above.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 52 research + Phase 51 base
- `.planning/phases/52-regex-validity-and-dedup/52-RESEARCH.md` — full technical research, matcher fidelity, unique-constraint trap.
- `.planning/phases/51-discovery-pipeline-reorder/51-03-SUMMARY.md` — the `discoverRegexCandidates` service this phase extends.
- `lib/services/regex-discovery.ts` — discovery service (where validity/dedup gates plug in).
- `lib/utils/pattern-suggestions.ts` — `detectPatternSuggestionsWithMeta`, D-05 metadata incl. `residualVariablePart`.
- `lib/dal/regex-discovery.ts` — `getUncategorizedExpensesForDiscovery` (Set B source).
- `lib/services/categorization.ts` — `loadActivePatterns`, `applyTier1Regex` matcher, `applyTier2History`.

### Domain language
- `CONTEXT.md` (repo root) — Set A / Set B, descriptionHash, regex vs single categorization.
</canonical_refs>

<specifics>
## Specific Ideas

- Two DoD test cases drive verification:
  1. Fineco "Bonifico Andrea Bernardini causale stipendio marzo/maggio/giugno" (≥2 sharing prefix, differing residual) → exactly ONE proposed regex.
  2. Repeated identical "Macellaio Da Mario" (identical after normalization) → single-categorization suggestion, NO regex.
- Plus the two skip Checks (Check 1 generated-regex coverage, Check 2 manual-history hash dedup).
- Test style matches Phase 51: real util + real `normalizeDescription`, mocked DAL / `loadActivePatterns`.
</specifics>

<deferred>
## Deferred Ideas

- Retroactive application of a created regex → Phase 53.
- Auto-run trigger post-import + Files-table on-demand → Phase 54.
- Import-summary UX (capped example list, visual separation) → Phase 55.
</deferred>

---

*Phase: 52-regex-validity-and-dedup*
*Context captured: 2026-06-16 via plan-phase decision capture*
