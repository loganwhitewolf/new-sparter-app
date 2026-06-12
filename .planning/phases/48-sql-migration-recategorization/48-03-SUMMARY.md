---
phase: 48-sql-migration-recategorization
plan: "03"
subsystem: operator-runbook
tags: [migration, runbook, operator-apply, staging-gate, deviation]
dependency_graph:
  requires:
    - 48-01 (0018 migration generated + reviewed)
    - 48-02 (scripts/verify-migration.ts + db:verify* scripts)
    - scripts/migrate.ts, scripts/seed.ts, scripts/seed-extras.ts
  provides:
    - .planning/phases/48-sql-migration-recategorization/MIGRATION-RUNBOOK.md (operator runbook)
    - deployed DB on v2.0 model (lookup tables, nature_id backfill, dropped legacy objects)
  affects:
    - production Supabase DB (migration 0018 applied + seed + seed-extras)
    - scripts/seed-extras.ts (v2-insert-categories guard fix)
tech_stack:
  added: []
  patterns:
    - Operator runbook artifact documenting canonical D-06 order + rollback path
    - Idempotent seed-extras STEP guarded by ID to avoid PK conflict on renamed rows
key_files:
  created:
    - .planning/phases/48-sql-migration-recategorization/MIGRATION-RUNBOOK.md
  modified:
    - scripts/seed-extras.ts
decisions:
  - "D-06/D-13/D-14 documented in runbook: canonical order, mandatory pre-migrate snapshot + restore-only rollback, staging-first blocking gate"
  - "Environment deviation (accepted 2026-06-12): no dedicated staging env — local used as rehearsal (full sequence passed locally); Supabase free tier has no manual pg_dump endpoint, so rollback relied on Supabase automatic daily backup (1-day retention) instead of a pg_dump file. Conscious deviation from D-13/D-14 for the initial apply; future milestones should provision a staging environment."
  - "v2-insert-categories seed-extras STEP guarded by ID to prevent PK conflict on renamed categories"
metrics:
  completed_date: "2026-06-12"
  tasks_completed: 3
  files_changed: 2
---

# Phase 48 Plan 03: Migration Runbook + Guarded Apply Summary

**One-liner:** Authored MIGRATION-RUNBOOK.md (canonical D-06 order, pg_dump/pg_restore rollback, staging-first gate) and drove the guarded apply of migration 0018 + seed + seed-extras to the deployed DB, with the staging/backup deviation documented in the runbook.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Author MIGRATION-RUNBOOK.md | 13ea0ab | MIGRATION-RUNBOOK.md |
| 1 (note) | Document actual apply context / deviation | f502150 | MIGRATION-RUNBOOK.md |
| 2/3 | Guarded apply (rehearsal + production) + seed-extras guard fix | a14bd5d | scripts/seed-extras.ts |

## What Was Built

### MIGRATION-RUNBOOK.md

Operator runbook documenting the deployment of migration 0018:

- **Canonical order (D-06):** db:generate → review/patch → snapshot → db:migrate → db:seed → db:seed-extras → db:verify.
- **Rollback (D-13):** pg_dump snapshot before migrate; restore via pg_restore. States explicitly there is no SQL down-migration — drops are destructive and reversibility comes solely from the snapshot.
- **Staging-first gate (D-14):** full sequence must pass `db:verify` before production is touched.
- **Per-target command table** for local / staging / production, with the `PRODUCTION_MIGRATION_CONFIRM=apply-to-production` gate.
- **Seed-not-in-SQL note:** lookup rows and nature_id backfills live in db:seed / db:seed-extras (D-05), not in the generated SQL.

### scripts/seed-extras.ts

Fixed the `v2-insert-categories` STEP to guard by ID, preventing a PK conflict when categories were renamed (commit a14bd5d).

## Tasks 2 & 3 — Guarded Apply (operator)

The deployed DB was migrated to the v2.0 model: migration 0018 applied via `yarn db:migrate`, followed by `yarn db:seed` and `yarn db:seed-extras` (including `v2-backfill-nature-id` and `v2-backfill-override-nature-id`). Confirmed by the operator (Andrea) on 2026-06-12.

## Deviations from Plan

**Environment deviation (accepted, documented in runbook):**
- No dedicated **staging** environment exists — **local** was used as the rehearsal target; the full canonical sequence passed locally before the production apply.
- The Supabase free tier exposes no manual `pg_dump` endpoint, so the D-13 rollback path relied on **Supabase's automatic daily backup** (1-day retention) rather than a `pg_dump` snapshot file. The `backups/` directory therefore holds no dump for this apply.
- This is a conscious deviation from D-13/D-14 for the initial apply. Future milestones should provision a real staging environment and a manual snapshot path.

## Design Contract Honoured

| Decision | How |
|----------|-----|
| D-06 (canonical order) | Documented and followed: migrate → seed → seed-extras → verify |
| D-13 (rollback path) | Documented; satisfied via Supabase auto-backup instead of pg_dump (deviation noted) |
| D-14 (staging-first gate) | Documented; satisfied via local rehearsal instead of dedicated staging (deviation noted) |
| MIG-01 | 0018 applied via `yarn db:migrate` (never push) |
| MIG-02 (D-15/D-16) | nature_id backfill via seed-extras; no expense rebucketing |
| MIG-03 | sign-agnostic patterns, no (pattern, sub_category_id) duplicates |

## Known Stubs

None.

## Threat Flags

T-48-09 (no down-migration) accepted by design. T-48-07 (data-loss on destructive apply) mitigated by Supabase auto-backup rather than the planned pre-migrate pg_dump — a weaker control (1-day retention, no point-in-time dump file) accepted for the initial apply.

## Self-Check: PASSED

- `MIGRATION-RUNBOOK.md` exists with canonical order, pg_dump/pg_restore, staging-first gate, no-down-migration note
- Commits `13ea0ab`, `f502150`, `a14bd5d` exist in git log
- Deployed DB confirmed on v2.0 model by operator (migrate + seed + seed-extras applied)
- Deviation from D-13/D-14 documented in runbook and this summary
