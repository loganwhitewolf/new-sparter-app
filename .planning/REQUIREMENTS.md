# Requirements: Sparter — Milestone v2.1 (Regex Discovery & Transaction Unification)

**Defined:** 2026-06-16
**Core Value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending — all running on a zero-cost personal deploy.

**Milestone goal:** Re-architect regex discovery as a separate step downstream of auto-categorization (today it runs inside import, before categorization), removing duplicate and already-covered proposals, with a reusable trigger and a cleaned-up import summary.

## v2.1 Requirements

### Discovery Pipeline (PIPE)

Reorder and relocate regex discovery in the import pipeline.

- [ ] **PIPE-01**: Regex discovery runs *after* auto-categorization and operates only on the still-uncategorized set (Set B); already-categorized transactions (Set A) are excluded from discovery input.
- [ ] **PIPE-02**: Regex discovery is extracted from the `analyzeFile`/`importFile` flow into a standalone service callable independently of an in-progress import.
- [ ] **PIPE-03**: Platform-specific normalization (e.g. Fineco date strip via `descriptionStripPattern`) is applied before discovery; an analysis confirms what normalization already covers vs what the residual-variable regex must still handle.

### Regex Validity & Deduplication (RDISC)

Correct the definition of a valid regex and stop proposing duplicates.

- [x] **RDISC-01**: A regex is proposed only when, after normalization, ≥2 transactions share a common prefix/substring but differ in a residual variable part (causale, month, progressive number). *Test case:* Fineco "Bonifico Andrea Bernardini causale stipendio marzo/maggio/giugno" → one regex.
- [x] **RDISC-02**: When ≥2 transactions are identical after normalization, they are surfaced as a single-categorization suggestion, not a regex. *Test case:* repeated identical "Macellaio" → single categorization, no regex.
- [x] **RDISC-03**: Check 1 — a candidate is skipped when the regex it would generate is already matched/covered by an existing pattern in the regex table.
- [x] **RDISC-04**: Check 2 — a candidate is skipped when that transaction type is already covered by an existing manual category (e.g. a manually categorized expense / history for the same descriptionHash).

### Application & Scope (APPLY)

Apply a newly created regex to existing data.

- [ ] **APPLY-01**: A regex created during discovery is applied to the uncategorized transactions of the current file.
- [ ] **APPLY-02**: The retroactive application scope is decided and implemented: current file only vs the entire platform's uncategorized history. *(Open decision — resolve in discuss/plan.)*

### Reusable Trigger (TRIG)

One service, two entry points.

- [ ] **TRIG-01**: Discovery runs automatically after import, as the step following auto-categorization.
- [ ] **TRIG-02**: Discovery can be re-run on-demand from the Files table ("ricontrolla regex"), reusing the same underlying service. *(Open decision: per-row vs bulk UX — resolve in discuss/plan.)*

### Import Summary UX (SUMUI)

Clean up the post-import summary.

- [ ] **SUMUI-01**: The import summary shows at most 10 example transactions.
- [ ] **SUMUI-02**: The import summary visually separates proposed regex from single-categorization suggestions.
- [ ] **SUMUI-03**: The user is informed that regex discovery now happens as a separate step after import. *(Open decision: exact copy/placement — resolve in discuss/plan.)*

## Future Requirements

Deferred — tracked, not in this milestone.

### Tooling Alignment (TOOL)

- **TOOL-01**: Consolidate the in-app discovery service with the offline `yarn regex:discover` + `/regex-label` tool (quick-task 260615-dtm) so both share clustering/normalization logic. *(This milestone only requires clarifying the relationship during planning; full consolidation is deferred.)*

### Parked backlog (carried, not in v2.1)

- **GLOBAL-01**: Pattern suggestions across all uncategorized transaction history (independent of a file).
- **DISM-01**: Persistent dismissal of noisy suggestions.

## Out of Scope

| Feature | Reason |
|---------|--------|
| AI/LLM-based pattern discovery (Tier 3) | This milestone is a deterministic-pipeline refactor; AI categorization is a separate gated feature |
| Multi-user / shared pattern libraries | Single-user personal finance for v2.x |
| Full merge of offline + in-app discovery tools | Deferred to TOOL-01; v2.1 only clarifies the boundary |
| Changes to the nature/direction data model | Locked by v2.0 (ADR 0012); discovery consumes it, does not change it |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PIPE-01 | Phase 51 | Pending |
| PIPE-02 | Phase 51 | Pending |
| PIPE-03 | Phase 51 | Partial (util layer complete in 51-01; service wires it in 51-03) |
| RDISC-01 | Phase 52 | Complete |
| RDISC-02 | Phase 52 | Complete |
| RDISC-03 | Phase 52 | Complete |
| RDISC-04 | Phase 52 | Complete |
| APPLY-01 | Phase 53 | Pending |
| APPLY-02 | Phase 53 | Pending |
| TRIG-01 | Phase 54 | Pending |
| TRIG-02 | Phase 54 | Pending |
| SUMUI-01 | Phase 55 | Pending |
| SUMUI-02 | Phase 55 | Pending |
| SUMUI-03 | Phase 55 | Pending |

**Coverage:**

- v2.1 requirements: 14 total
- Mapped to phases: 14 (Phases 51–55) ✓
- Unmapped: 0

Deferred (not mapped, tracked for future): TOOL-01, GLOBAL-01, DISM-01.

---
*Requirements defined: 2026-06-16*
*Last updated: 2026-06-16 — roadmap created, all 14 v2.1 requirements mapped to Phases 51–55*
