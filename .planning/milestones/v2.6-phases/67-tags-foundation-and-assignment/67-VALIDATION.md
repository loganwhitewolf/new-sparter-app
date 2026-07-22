---
phase: 67
slug: tags-foundation-and-assignment
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-20
---

# Phase 67 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from 67-RESEARCH.md `## Validation Architecture`. Per-task IDs are filled once plans exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + TypeScript (node environment; no jsdom) |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npm run test -- tags` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~15–30 seconds (tag-scoped); full suite per existing baseline |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- tags`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Requirement Verification Map

> Task IDs (`67-NN-NN`) and wave assignments are backfilled after planning. Rows are keyed by requirement + behavior for now.

| Requirement | Behavior | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|------------|-----------------|-----------|-------------------|-------------|--------|
| TAG-01 | Create with non-duplicate name succeeds; duplicate (case/whitespace-insensitive) rejected inline | T-67 IDOR | Mutation scoped to session `userId` | unit + integration | `npm run test -- tag-operations.test.ts -t "createTag"` | ❌ W0 | ⬜ pending |
| TAG-01 | Archived tags remain queryable; `archived=true` still in assignment/filter result set | — | userId-scoped read | unit | `npm run test -- tags-dal.test.ts -t "archived"` | ❌ W0 | ⬜ pending |
| TAG-02 | Bulk-assign N tags to M txs is additive union; no rows removed; `unique(txId,tagId)` holds | T-67 IDOR | Each tx + tag ownership checked | integration | `npm run test -- bulk-assign-tags-action.test.ts` | ❌ W0 | ⬜ pending |
| TAG-02 | Bulk removal removes exactly the targeted join rows; other tags untouched | — | Ownership-scoped delete | integration | `npm run test -- bulk-remove-tags-action.test.ts` | ❌ W0 | ⬜ pending |
| TAG-03 | `computeTagSuggestions` returns only (tag date-range ∩ newly-imported txs) | — | userId-scoped | unit | `npm run test -- import-tags.test.ts -t "computeTagSuggestions"` | ❌ W0 | ⬜ pending |
| TAG-03 | Dedup: txs already carrying the tag are excluded from suggestions | — | — | unit | `npm run test -- import-tags.test.ts -t "dedup"` | ❌ W0 | ⬜ pending |
| TAG-06 | seed-extras step sets `isActive=false` on the two subcategories; not offered for new categorization | — | — | integration | `yarn db:seed-extras && npm run test -- seed-extras.test.ts` | ❌ W0 | ⬜ pending |
| TAG-06 | `trasporto` regex rejects daily-commute keywords (bus/train/metro w/o travel context) | — | — | unit | `npm run test -- categorization-match.test.ts -t "trasporto"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/tag-operations.test.ts` — TAG-01 create/update/archive + D-02 uniqueness guard
- [ ] `tests/tags-dal.test.ts` — TAG-01 getTag/getTags/getTagsByDateRange with IDOR scoping
- [ ] `tests/bulk-assign-tags-action.test.ts` — TAG-02 N×M join insertion + D-06 additivity
- [ ] `tests/bulk-remove-tags-action.test.ts` — TAG-02 D-07 symmetric bulk removal
- [ ] `tests/import-tags.test.ts` — TAG-03 computeTagSuggestions, date matching, D-10 dedup
- [ ] `tests/seed-extras.test.ts` — TAG-06 deactivate-subcategories step (D-11/D-13)
- [ ] `tests/categorization-match.test.ts` — extend with `trasporto` travel-only pattern test (D-14 regex side)
- [ ] `tests/conftest.ts` — shared fixtures (userId, test tags, test transactions, test imports)
- [ ] Framework install: none — Vitest already configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Duplicate-name inline error renders in the `/settings/tags` form | TAG-01 / D-02 | UI feedback rendering | Create tag "Sharm", then create "  sharm " → inline error shown, no row added |
| Post-import "Suggerimenti tag" block appears pre-checked on the suggestions screen | TAG-03 / D-08 | Requires a real import + summary render | Create dated tag, import a file with in-range txs → block shows pre-checked list; confirm adds tags |
| Row chips + detail-page single add/remove | TAG-02 / D-07b | Visual/interaction | Assign tag → chip in row; open `/transactions/[id]` → add/remove single tag |

---

## Invariants (cross-cutting — must hold)

- **Tag = filter, never breakdown:** tags never change dashboard totals or category breakdowns.
- **Archive, never delete:** archived tags remain selectable in assignment and queryable in filters (D-04).
- **Additive union:** bulk-assign adds to existing tags, never removes (D-06).
- **Suggestion dedup:** a tag already on a tx is never re-suggested even if the tx matches the date range (D-10).
- **Vacanze value unchanged by deactivation:** subcategory deactivation (D-11) must not change the Vacanze dashboard total — the transaction uncategorization (D-12) is the deliberate recategorization, distinct from the grouping/tagging invariance from v2.6.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
