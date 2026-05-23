# Requirements: Sparter v1.10 Pattern Suggestions

**Defined:** 2026-05-22
**Core Value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending — all running on a zero-cost personal deploy with real database persistence and repeatable migration/deploy procedures.

## v1 Requirements

### Detection

- [ ] **SUG-01**: User receives pattern suggestions for recurring valid uncategorized import rows that share a common normalized token prefix.
- [ ] **SUG-02**: Suggested patterns strip purely numeric tokens before prefix comparison.
- [ ] **SUG-03**: Suggested patterns require at least 2 matching rows and at least 2 non-numeric prefix tokens.
- [ ] **SUG-04**: Suggested patterns preserve the longest qualifying common prefix, not exactly 2 tokens.
- [ ] **SUG-05**: Suggested patterns exclude rows that are invalid, duplicate, or already matched by an active categorization pattern.
- [ ] **SUG-06**: Suggested regex sources are escaped so bank-description metacharacters cannot create unintended regex behavior.

### Analysis Contract

- [ ] **ANL-01**: Import analysis returns `patternSuggestions` in `ImportAnalysisResult`.
- [ ] **ANL-02**: Each pattern suggestion includes `pattern`, `matchCount`, `detectedAmountSign`, and up to 3 sample descriptions.
- [ ] **ANL-03**: Import analysis returns at most 5 pattern suggestions sorted by `matchCount` descending.
- [ ] **ANL-04**: `detectedAmountSign` is `positive`, `negative`, or `any` based on grouped transaction amounts.
- [ ] **ANL-05**: Pattern suggestion detection failures do not leak raw R2 object keys, presigned URLs, raw rows, or stack traces.

### Import Review

- [x] **REV-01**: User can see pattern suggestions on the import analysis page before confirming import.
- [x] **REV-02**: User can inspect sample descriptions for each suggestion.
- [x] **REV-03**: User can select a destination subcategory and promote a suggestion to a categorization pattern.
- [x] **REV-04**: User can continue import confirmation without handling suggestions.
- [x] **REV-05**: User sees clear success or validation feedback after attempting to promote a suggestion.

### Post-Import Re-Analysis

- [ ] **POST-01**: User can re-run pattern suggestion analysis for an imported file using persisted transactions filtered by `fileId`.
- [ ] **POST-02**: Post-import re-analysis uses the same detection algorithm and suggestion shape as pre-import analysis.
- [ ] **POST-03**: Post-import re-analysis enforces session user ownership of the import file.
- [ ] **POST-04**: Post-import suggestions exclude transactions that already have category coverage.
- [ ] **POST-05**: User can promote a post-import suggestion to a categorization pattern.

### Scope Boundaries

- [ ] **SCOP-01**: Dismissed suggestions are not persisted.
- [ ] **SCOP-02**: Pattern suggestions are scoped to one import file, not global transaction history.
- [ ] **SCOP-03**: Creating a post-import pattern does not automatically reclassify existing transactions unless a later requirement adds that behavior.

## Future Requirements

Deferred to a future release. Tracked but not in the current roadmap.

### Reclassification

- **REVAL-01**: User can apply a newly created post-import pattern to existing transactions from the same import.

### Global Suggestions

- **GLOBAL-01**: User can detect pattern suggestions across all uncategorized transaction history.

### Dismissals

- **DISM-01**: User can permanently dismiss a noisy suggestion.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| ML/LLM clustering | Adds latency, cost, and non-determinism; ADR chose deterministic prefix detection |
| Longest common substring detection | Harder to read and less anchored than prefix patterns |
| Persistent dismissal table | Explicitly excluded by ADR for v1.10 |
| Raw R2 post-import re-analysis | Persisted transactions are the source of truth after import |
| Automatic existing-transaction reclassification | Useful later, but distinct from suggestion detection and promotion |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SUG-01 | Phase 33 | Pending |
| SUG-02 | Phase 33 | Pending |
| SUG-03 | Phase 33 | Pending |
| SUG-04 | Phase 33 | Pending |
| SUG-05 | Phase 33 | Pending |
| SUG-06 | Phase 33 | Pending |
| ANL-01 | Phase 34 | Pending |
| ANL-02 | Phase 33 | Pending |
| ANL-03 | Phase 34 | Pending |
| ANL-04 | Phase 33 | Pending |
| ANL-05 | Phase 34 | Pending |
| REV-01 | Phase 35 | Complete |
| REV-02 | Phase 35 | Complete |
| REV-03 | Phase 35 | Complete |
| REV-04 | Phase 35 | Complete |
| REV-05 | Phase 35 | Complete |
| POST-01 | Phase 36 | Pending |
| POST-02 | Phase 36 | Pending |
| POST-03 | Phase 36 | Pending |
| POST-04 | Phase 36 | Pending |
| POST-05 | Phase 36 | Pending |
| SCOP-01 | Phase 34 | Pending |
| SCOP-02 | Phase 34 | Pending |
| SCOP-03 | Phase 36 | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

---
*Requirements defined: 2026-05-22*
*Last updated: 2026-05-22 after milestone v1.10 roadmap creation*
