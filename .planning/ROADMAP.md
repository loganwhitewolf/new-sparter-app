# Roadmap

## Milestones

- ✅ **M001–M006** — Foundation → Dashboard Insight Suite (Phases 1–23, shipped ~2026-05)
- ✅ **M007: Zero-cost Production Deploy** — Phases 24–28 (shipped 2026-05-19)
- ✅ **v1.8 / M008: Dashboard Intelligence** — Phase 29 (shipped 2026-05-20)
- ✅ **v1.9: Social Auth** — Phases 30–32 (shipped 2026-05-22)
- ◆ **v1.10: Pattern Suggestions** — Phases 33–36 (planned)

## Phases

<details>
<summary>✅ M001–M006 (Phases 1–23) — SHIPPED</summary>

- [x] Phase 01: design-system
- [x] Phase 02: authentication
- [x] Phase 03: expense-management
- [x] Phase 04: dashboard-kpi
- [x] Phase 05–07: M001 remaining slices
- [x] Phase 08–10: M002 Observability
- [x] Phase 11–16: M004 Import Management
- [x] Phase 17–20: M005 Category Management & UX Polish
- [x] Phase 21–23: M006 Dashboard Insight Suite

</details>

<details>
<summary>✅ M007: Zero-cost Production Deploy (Phases 24–28) — SHIPPED 2026-05-19</summary>

- [x] Phase 24: s01 — env contract + DB pool config
- [x] Phase 25: s02 — production migration CLI
- [x] Phase 26: s03 — R2 upload + CORS
- [x] Phase 27: s04 — registration guardrail
- [x] Phase 28: s05 — runbook + smoke suite

</details>

<details>
<summary>✅ v1.8 / M008: Dashboard Intelligence (Phase 29) — SHIPPED 2026-05-20</summary>

- [x] Phase 29: dashboard-intelligence — Deviation view + chart clarity *(complete 2026-05-20)*
  - [x] 29-01: D-01 fix, deviation utilities, test scaffolds
  - [x] 29-02: getCategoryDeviations DAL + DeviationBadge
  - [x] 29-03: EntrateUsciteChart + BilancioBarsChart (MonthlyTrendChart deleted)
  - [x] 29-04: Wire deviation into category pages + sort toggle

</details>

<details>
<summary>✅ v1.9: Social Auth (Phases 30–32) — SHIPPED 2026-05-22</summary>

- [x] Phase 30: oauth-config — OAuth provider setup, env wiring, registration guardrail removal *(complete 2026-05-21)*
- [x] Phase 31: oauth-ui — Social login/register buttons on auth pages *(complete 2026-05-21)*
- [x] Phase 32: account-linking — Link/unlink providers from settings *(complete 2026-05-22)*

Full details: `.planning/milestones/v1.9-ROADMAP.md`

</details>

<details open>
<summary>◆ v1.10: Pattern Suggestions (Phases 33–36) — PLANNED</summary>

- [ ] **Phase 33: pattern-suggestion-detector** — Build the deterministic detector contract from the ADR.
- [ ] **Phase 34: import-analysis-suggestions** — Integrate suggestions into import analysis safely.
- [ ] **Phase 35: import-review-promotion** — Let users review and promote suggestions before import confirmation.
- [ ] **Phase 36: post-import-reanalysis** — Re-run suggestions from persisted transactions after import.

### Phase 33: pattern-suggestion-detector

**Goal:** Build the deterministic detector contract from the ADR.
**Requirements:** SUG-01, SUG-02, SUG-03, SUG-04, SUG-05, SUG-06, ANL-02, ANL-04
**Plans:** 1 plan
- [ ] 33-01-PLAN.md — Wave 0 failing tests + skeleton, then Wave 1 detectPatternSuggestions implementation (single plan, 2 tasks, all 8 requirements)
**Success Criteria**:
1. Pure detector emits suggestions for recurring uncategorized normalized token prefixes.
2. Numeric token stripping, longest-prefix behavior, minimum count/token floors, regex escaping, and amount-sign inference are covered by tests.
3. Invalid, duplicate, and already-covered rows are excluded without introducing persistence or new dependencies.

### Phase 34: import-analysis-suggestions

**Goal:** Integrate suggestions into import analysis safely.
**Requirements:** ANL-01, ANL-03, ANL-05, SCOP-01, SCOP-02
**Success Criteria**:
1. `analyzeFile` returns capped, ranked `patternSuggestions` in `ImportAnalysisResult`.
2. Suggestion detection uses the same active-pattern coverage rules as import categorization.
3. Analysis failures remain safe and do not leak R2 keys, presigned URLs, raw rows, or stack traces.
4. Existing import analysis and confirmation behavior still works when no suggestions exist.

### Phase 35: import-review-promotion

**Goal:** Let users review and promote suggestions before import confirmation.
**Requirements:** REV-01, REV-02, REV-03, REV-04, REV-05
**Success Criteria**:
1. Import analysis UI shows suggestion cards with sample descriptions.
2. User can choose a destination subcategory and create a categorization pattern from a suggestion.
3. Promotion success and validation errors are visible, and import confirmation remains optional and unblocked.

### Phase 36: post-import-reanalysis

**Goal:** Re-run suggestions from persisted transactions after import.
**Requirements:** POST-01, POST-02, POST-03, POST-04, POST-05, SCOP-03
**Success Criteria**:
1. User can trigger suggestion re-analysis for an imported file without reading the raw R2 object.
2. Re-analysis is scoped by session-owned `fileId`, uses persisted transactions, and excludes already categorized transactions.
3. User can promote post-import suggestions to categorization patterns.
4. The UI and copy do not imply existing transactions are automatically reclassified.

Full context: `.planning/REQUIREMENTS.md`, `.planning/research/SUMMARY.md`

</details>

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1–23 | M001–M006 | 87/87 | Complete | 2026-05 |
| 24–28 | M007 | 20/20 | Complete | 2026-05-19 |
| 29 | v1.8/M008 | 4/4 | Complete | 2026-05-20 |
| 30 | v1.9 | 3/3 | Complete | 2026-05-21 |
| 31 | v1.9 | 3/3 | Complete | 2026-05-21 |
| 32 | v1.9 | 3/3 | Complete | 2026-05-22 |
| 33 | v1.10 | 0/1 | Planned | — |
| 34 | v1.10 | — | Planned | — |
| 35 | v1.10 | — | Planned | — |
| 36 | v1.10 | — | Planned | — |

**Total: 36 phases · 120 plans complete · 4 phases planned for v1.10**
