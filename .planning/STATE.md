---
gsd_state_version: 1.0
milestone: v2.3
milestone_name: Platform Identity & Format Ownership
current_phase: 59
current_phase_name: import-wizard-attach-format
status: planning
stopped_at: Phase 58 verified and complete (8/8 must-haves, 16/16 tests). Ready for Phase 59.
last_updated: "2026-06-29T13:20:00.000Z"
last_activity: 2026-06-29
last_activity_desc: Phase 58 verification passed
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
  percent: 33
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-29)

**Core value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending — all running on a zero-cost personal deploy.
**Current focus:** Phase 59 — import-wizard-attach-format

## Current Position

Phase: 58 (platform-identity-and-access) — COMPLETE (verified 2026-06-29)
Phase: 59 (import-wizard-attach-format) — NEXT
Status: Phase 58 verified — 8/8 must-haves, 16/16 tests PASS
Last activity: 2026-06-29 — Phase 58 verification passed

## Roadmap (v2.3 — Phases 58–60)

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 58 | platform-identity-and-access | PLAT-01, PLAT-02, PLAT-03 | Complete (verified 2026-06-29) |
| 59 | import-wizard-attach-format | PLAT-04 | Not started |
| 60 | seed-slug-linkage-and-docs | PLAT-05, PLAT-06 | Not started |

**Coverage:** 6/6 PLAT requirements mapped. Decision contract LOCKED (ADR 0015) — pure implementation, no discovery.

## Accumulated Context

### Decisions

Design contract is LOCKED (ADR 0015). Do not re-derive the approach:

- **ADR 0015**: Platform is never user-owned — drop `platform.visibility`, rename `platform.ownerUserId` → `proposedByUserId`; visibility governed by `reviewStatus` (`pending` = visible only to proposer; `approved` = shared with all; seeded platforms stay `approved`). Private ownership lives only on `import_format_version` (`ownerUserId`), which can be private even on a global/approved platform. `accessibleWhere` relaxes to "private format visible to owner on any platform," decoupling private-format from private-platform.
- **ADR 0015 wizard**: on detection failure, first offer an existing Platform to attach a new private Import Format; create a new Platform (born `pending`) only when none fits — no more silently duplicated platforms.
- **ADR 0015 seed**: seeded platforms carry no explicit `id:` (serial assigns; conflict on unique `slug`); seeded import formats reference `platformSlug`, resolved slug→id at runtime in `seed.ts`. Runtime FK stays `platformId` (surrogate int, hot join) — slug is the seed-linkage key only. This eliminates the Trade Republic id-8 collision (`onConflictDoNothing` silently skipped TR when a user platform held serial id 8).
- **ADR 0013** (extended by 0015): the parsing contract lives on `import_format_version`, not `platform`; `platform` is pure identity. DescriptionStripPattern lives on `import_format_version` — the CONTEXT.md glossary line ("Regex nullable configurata per Platform") is stale and corrected in PLAT-06.
- Migration path: `drizzle-kit generate` + `scripts/migrate.ts`; additive idempotent backfill in `seed-extras.ts`; never `drizzle-kit push` in production. Seed run order after migration: `db:migrate → db:seed → db:seed-extras → db:seed-patterns`.
- **Deferred (not built now)**: operator approval UI to promote `pending` → `approved` (needed only with a second user); multi-user identity dedup. For single-user, `pending` + proposer-visible is already functional.
- [Phase 58-01]: Migration 0023 via --custom fallback: RENAME COLUMN applied directly via node-pg when drizzle-kit stalled on Supabase pooler; platformRelations.owner key kept (D-06)
- [Phase 58-02]: PLAT-02/PLAT-03: accessibleWhere relaxed to 2-branch OR — private format on approved platform visible to owner; pending platform visible only to proposedByUserId
- [Phase 58-03]: Wizard reviewStatus aligned to pending; DRAFT_REVIEW_STATUS → PENDING_REVIEW_STATUS; platform insert uses proposedByUserId, no visibility write

### Phase 58 — What was built (foundation for Phase 59)

- `platform` table: no `visibility` column, `proposedByUserId` (renamed from `ownerUserId`), `reviewStatus` lifecycle (`pending`/`approved`)
- Migration 0023 applied to Supabase (RENAME COLUMN, no data loss)
- `accessibleWhere` 2-branch OR: global-approved formats + owner-format-on-any-visible-platform
- `createPrivateRows` in wizard: platform insert uses `proposedByUserId`, `reviewStatus: 'pending'`, no `visibility`
- 16/16 phase tests PASS; zero forbidden column references in DAL and wizard

### Codebase facts rilevanti per la milestone

- `lib/dal/import-formats.ts` `accessibleWhere` (lines 132–158): 2-branch OR — global-approved (branch 1) + format-owner with platform visibility guard (branch 2). `platform.proposedByUserId` referenced correctly.
- Schema (`lib/db/schema.ts`): `platform.proposedByUserId` (nullable text), `platform.reviewStatus` (default `approved`). No `visibility` on `platform`.
- `importFormatVersion` keeps `ownerUserId` and `visibility` (Discretion A3 — Phase 59/60 territory).
- Seed (`scripts/seed-data.ts`): Trade Republic platform hardcodes `id: 8` (slug `trade-republic`) and its import format references `platformId: 8` — the collision PLAT-05 fixes via slug linkage. Remove explicit `id:` from seeded platforms; do NOT change the FK column to slug.
- CONTEXT.md glossary line 33–34 ("DescriptionStripPattern — Regex nullable configurata per Platform") is the stale reference PLAT-06 corrects (should reference `import_format_version` / ADR 0013).

### Planning Risk

- **Regression risk on the hot `platform` join (PLAT-04):** Phase 59 must guard against regression on the existing format-detection + import paths. Use existing test harness (`import-detector.test.ts`).

### Blockers/Concerns

Nessuno.

### Quick Tasks Completati (carryover da v2.1/v2.2)

| # | Description | Date | Commit |
|---|-------------|------|--------|
| 260609-fru | Dashboard overview prototype fixes | 2026-06-09 | 5ebd690 |
| 260609-k2d | Transactions nature + in/out/transfer filters; 7 UI fixes | 2026-06-09 | cdc5997 |
| 260609-lcp | Cascading filters (type→nature, category→subcat); amount sign strip | 2026-06-09 | ffd4fc3 |
| 260615-dtm | Bank-agnostic regex-discovery tool | 2026-06-15 | d737b8e |
| 260615-n3t | Onboarding step-4 fix | 2026-06-15 | 1434308 |
| 260615-oiq | Onboarding private platform creation | 2026-06-15 | d5b590c |
| 260616-dlw | Fix transaction description sort | 2026-06-16 | c71d32e |
| 260629-gdp | Pattern suggestions back link + auto-redirect after classify | 2026-06-29 | 4673927 |
| 260629-lky | File list R2 download + expense details dialog source file | 2026-06-29 | a6d7f95 |
| 260629-m9i | Detach transaction to dedicated expense + re-import manual lock | 2026-06-29 | 90bfa69 |

## Deferred Items

Items riconosciuti e posticipati:

| Category | Item | Status |
|----------|------|--------|
| v2.3 | Operator approval UI (`pending` → `approved`) | deferred — needed only with a second user |
| v2.3 | Multi-user platform identity dedup | deferred — multi-user only |
| verification_gap | 53-VERIFICATION.md | human_needed — 3 browser/visual checks |
| verification_gap | 55-VERIFICATION.md | human_needed — 2 visual checks |
| uat_gap | 53-UAT.md | diagnosed — 0 pending scenarios |
| quick_task | 260615-dtm-reusable-regex-discovery-tool | unknown — TOOL-01 deferred |
| quick_task | 260615-n3t-fix-recurring-onboarding-catalogazione | unknown — to evaluate |
| v2.1 | TOOL-01 | consolidate in-app + offline discovery — parked |
| v2.1 | GLOBAL-01 | file-independent suggestions — parked |
| v2.1 | DISM-01 | persistent dismissal of noisy suggestions — parked |
| v2.2 | TR categorization | regex-discovery + seed-patterns post-import — deferred |
| operator | R038/R039/R041 | live Vercel/Supabase/R2 deploy operator-pending |
| backlog | R029 | partial categorization revalidation coverage |
| check:language | expenses.ts:82, transactions.ts:200 | pre-existing Italian comments — out of scope Phase 58 |

## Session Continuity

**Resume file:** None

**Stopped at:** Phase 58 verified (8/8 must-haves, 16/16 tests). ROADMAP updated. Ready for Phase 59.

Last session: 2026-06-29T13:20:00.000Z
Resume: `/gsd-plan-phase 59` to plan the import-wizard-attach-format phase.

**Next:** Plan Phase 59 (`import-wizard-attach-format`).

## Operator Next Steps

- v2.2 PR #24 deploy order (if not yet merged): `yarn db:migrate → yarn db:seed → yarn db:seed-extras → yarn db:seed-patterns` (migration 0022 has critical backfill).
- After Phase 58 migrations land, the same run order applies; migration 0023 is idempotent post-apply.

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 49 P02 | 30m | 2 tasks | 5 files |
| Phase 50 P01 | 20m | 2 tasks | 4 files |
| Phase 50-transaction-pairing P50-02 | 35min | 2 tasks | 5 files |
| Phase 50-transaction-pairing P50-03 | 10min | 2 tasks | 4 files |
| Phase 50-transaction-pairing P50-04 | 25min | 2 tasks | 3 files |
| Phase 50-transaction-pairing P50-05 | 90min | 2 tasks + operator checkpoint + 5 fixes | 5 files |
| Phase 51 P01 | 15min | 2 tasks | 2 files |
| Phase 51 P02 | 15min | 2 tasks | 2 files |
| Phase 51 P03 | 8min | 3 tasks (TDD RED+GREEN + comment) | 3 files |
| Phase 52 P01 | 3 min | 2 tasks | 6 files |
| Phase 52 P02 | 2 min | 2 tasks | 2 files |
| Phase 52 P03 | 3 min | 3 tasks | 2 files |
| Phase 53 PP01 | 3min | - tasks | - files |
| Phase 53 P02 | 8min | 2 tasks (TDD RED+GREEN) | 4 files |
| Phase 53 P03 | 10min | 2 tasks + verification | 7 files |
| Phase 54 P01 | 3min | 3 tasks | 3 files |
| Phase 54 P02 | 5min | 2 tasks (TDD RED+GREEN) | 3 files |
| Phase 54 P03 | 8min | 3 tasks (TDD RED+GREEN) | 5 files |
| Phase 55 P01 | 7min | 2 tasks | 10 files |
| Phase 55 P02 | 3min | 2 tasks | 4 files |
| Phase 55 P03 | 2min | 3 tasks | 3 files |
| Phase 56 P01 | 10min | 1 tasks | 1 files |
| Phase 56 P02 | 8min | 2 tasks | 4 files |
| Phase 56 P03 | 4min | 3 tasks | 6 files |
| Phase Phase 56 PP56-04 | 8min | 3 tasks | 4 files |
| Phase 56 P05 | 3min | 4 tasks | 3 files |
| Phase 57 P02 | 2min | 2 tasks | 3 files |
| Phase 57 P03 | 10min | 2 tasks | 2 files |
| Phase 57 P05 | 3min | 1 tasks | 6 files |
| Phase 58 P01 | 5min | 3 tasks | 4 files |
| Phase 58 P02 | 3min | 2 tasks | 2 files |
| Phase 58 P03 | 5min | 2 tasks | 2 files |
