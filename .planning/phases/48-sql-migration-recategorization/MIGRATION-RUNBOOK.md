# Phase 48 — Migration Runbook: sql-migration-recategorization

**Migration:** 0018 (direction + nature lookup tables, nature_id FKs, deprecated column/enum drops)
**Model:** v1 dual-axis → v2.0 `nature → direction`
**Safety level:** destructive (drops columns and enums) — no SQL down-migration exists

---

## Guiding Principles

- **Never `drizzle-kit push` in production.** Always run `yarn db:generate` → review → `yarn db:migrate`.
- **Dump before migrate.** A `pg_dump` snapshot is mandatory before every `yarn db:migrate` run (step 3). It is the sole rollback path.
- **Staging-first is a hard gate (D-14).** The full sequence (steps 3–7) must pass `db:verify` on staging before production is touched. This document enforces this as an explicit human checkpoint.
- **Seed data is not in the SQL.** The generated migration owns schema shape only. Lookup rows (`direction`, `nature`), taxonomy transforms, and `nature_id` backfills live in `yarn db:seed` and `yarn db:seed-extras` (D-05). Running only `yarn db:migrate` leaves the data model incomplete.

---

## Canonical Operator Order (D-06)

The full sequence for each target environment:

| Step | Command / Action | Notes |
|------|-----------------|-------|
| 1 | `yarn db:generate` | **Already done — Plan 01.** Migration 0018 generated and reviewed. Reference commit in Plan 01 SUMMARY. |
| 2 | Review / patch the migration | **Already done — Plan 01.** SQL reviewed; manual patch applied where Drizzle output needed hardening. |
| 3 | **`pg_dump` snapshot** of the target DB | **Mandatory before step 4.** See pg_dump section below. This dump is the ONLY rollback path. |
| 4 | `yarn db:migrate[:target]` | Applies 0018. Expect `migration_succeeded` JSON event. |
| 5 | `yarn db:seed[:target]` | Inserts directions (4 rows), natures (8 rows), taxonomy rows — idempotent. FK order matters: directions and natures first, then subcategories. |
| 6 | `yarn db:seed-extras[:target]` | Runs all STEPS including `v2-backfill-nature-id` and `v2-backfill-override-nature-id`. Review row-count logs. |
| 7 | `yarn db:verify[:target]` | **Must exit 0 (PASS).** See verification assertions below. On staging this is the staging-first gate. |

**Do not skip steps.** Do not run steps out of order. On any failure in steps 4–7, stop and follow the rollback procedure before retrying.

---

## Pre-Migrate Snapshot: pg_dump (D-13)

Run immediately before `yarn db:migrate`. Confirm the dump file exists and is non-empty before proceeding to migrate.

### Staging snapshot

```bash
# Read STAGING_DATABASE_URL from .env (scripts read .env, not .env.local)
source .env
pg_dump "$STAGING_DATABASE_URL" -Fc -f "backups/pre-0018-staging-$(date +%Y%m%dT%H%M%S).dump"
ls -lh backups/pre-0018-staging-*.dump   # confirm non-empty
```

### Production snapshot

```bash
source .env
pg_dump "$PRODUCTION_DATABASE_URL" -Fc -f "backups/pre-0018-production-$(date +%Y%m%dT%H%M%S).dump"
ls -lh backups/pre-0018-production-*.dump  # confirm non-empty
```

**Storage:** Store dump files in the `backups/` directory at the repo root (gitignored). Keep them locally until the deployment is stable and verified. Do not delete until post-verify confidence is established.

> **Note — Supabase hosts:** If `STAGING_DATABASE_URL` or `PRODUCTION_DATABASE_URL` uses the direct Supabase host (`db.<ref>.supabase.co`), that host may not resolve from a local machine. Use the pooler/session connection string from the Supabase dashboard (Connect → Session or Transaction pooler) for both `pg_dump` and the `yarn db:*` commands.

---

## Rollback: Restore from Dump (D-13)

**There is no SQL down-migration.** Migration 0018 drops columns (`category_type`, `flow_nature`, `amount_sign`, `sub_category.nature`, `user_subcategory_override.nature`, `categorization_pattern.amount_sign`) and drops enums. A reverse SQL cannot recover dropped data. Reversibility comes solely from the pre-migrate dump.

### Restore staging

```bash
source .env
pg_restore --clean --if-exists -d "$STAGING_DATABASE_URL" backups/pre-0018-staging-<timestamp>.dump
```

### Restore production

```bash
source .env
pg_restore --clean --if-exists -d "$PRODUCTION_DATABASE_URL" backups/pre-0018-production-<timestamp>.dump
```

**When to use:** If `yarn db:migrate` fails with exit code 2, or if `yarn db:verify` fails and the data state cannot be corrected forward, restore from the dump. Do not leave the database half-migrated.

---

## Per-Target Command Reference

Scripts read secrets from `.env` (not `.env.local`). Production commands require `PRODUCTION_MIGRATION_CONFIRM=apply-to-production` in `.env` (see db-config.ts).

| Command | Local | Staging | Production |
|---------|-------|---------|------------|
| Migrate | `yarn db:migrate` | `yarn db:migrate:staging` | `yarn db:migrate:production` |
| Seed | `yarn db:seed` | `yarn db:seed:staging` | `yarn db:seed:production` |
| Seed extras | `yarn db:seed-extras` | `yarn db:seed-extras:staging` | `yarn db:seed-extras:production` |
| Verify | `yarn db:verify` | `yarn db:verify:staging` | `yarn db:verify:production` |

**Production pre-condition:** Set `PRODUCTION_MIGRATION_CONFIRM=apply-to-production` in `.env` before running any `:production` command. This is the existing confirm gate (`db-config.ts` validates the value is exactly `apply-to-production`). The staging-first gate (D-14) extends this — it does not replace it.

---

## Staging-First Blocking Gate (D-14)

The full sequence (steps 3–7) **must run clean on staging** and `yarn db:verify:staging` must **exit 0 (PASS)** before any production command is run.

```
STAGING GATE — required before production apply
================================================
[ ] pg_dump staging snapshot exists and is non-empty
[ ] yarn db:migrate:staging  → migration_succeeded
[ ] yarn db:seed:staging     → seed_succeeded
[ ] yarn db:seed-extras:staging → seed_extras_succeeded (all STEPS complete)
[ ] yarn db:verify:staging   → exit 0 (PASS)
```

Production apply is **forbidden** until all five boxes are checked. This is enforced as a separate blocking human checkpoint in the execution plan.

---

## Expected Verification Outcome (db:verify)

`yarn db:verify[:target]` runs `scripts/verify-migration.ts` and exits 0 on PASS, non-zero on FAIL. The following assertions must pass:

| Assertion | Source | Expected |
|-----------|--------|----------|
| No active system subcategory with null `nature_id` | D-04 / MIG-02 | 0 violations |
| No `(pattern, sub_category_id)` duplicates | MIG-03 | 0 duplicates |
| Override backfill coverage | D-02 | Logged (rows updated where system sub had a nature) |
| User-owned null `nature_id` rows | D-01 / D-03 | Allowed — logged, not a failure |

A clean run logs a `verify_passed` event with counts. Any violation logs `verify_failed` with the specific assertion and row details.

---

## Full Sequence — Step by Step

### Staging (rehearsal)

```bash
# Step 3: snapshot
source .env
pg_dump "$STAGING_DATABASE_URL" -Fc -f "backups/pre-0018-staging-$(date +%Y%m%dT%H%M%S).dump"
ls -lh backups/pre-0018-staging-*.dump

# Step 4: migrate
yarn db:migrate:staging
# Expect: {"event":"migration_succeeded","target":"staging",...}

# Step 5: seed
yarn db:seed:staging
# Expect: seed_succeeded with directions, natures, categories, subcategories, patterns logged

# Step 6: seed-extras
yarn db:seed-extras:staging
# Expect: seed_extras_succeeded — all 12 STEPS run, including:
#   v2-backfill-nature-id: review per-nature row counts
#   v2-backfill-override-nature-id: review override backfill count

# Step 7: verify (MUST pass before production)
yarn db:verify:staging
# Expect: exit 0, {"event":"verify_passed",...}
```

### Production (only after staging gate approved)

```bash
# Pre-condition: PRODUCTION_MIGRATION_CONFIRM=apply-to-production in .env

# Step 3: snapshot (mandatory — do not skip)
source .env
pg_dump "$PRODUCTION_DATABASE_URL" -Fc -f "backups/pre-0018-production-$(date +%Y%m%dT%H%M%S).dump"
ls -lh backups/pre-0018-production-*.dump

# Step 4: migrate
yarn db:migrate:production
# Expect: {"event":"migration_succeeded","target":"production",...}

# Step 5: seed
yarn db:seed:production

# Step 6: seed-extras
yarn db:seed-extras:production

# Step 7: verify
yarn db:verify:production
# Expect: exit 0, {"event":"verify_passed",...}
```

---

## Failure Decision Tree

```
yarn db:migrate fails (exit 2)?
  → STOP. Do not run seed or seed-extras.
  → pg_restore from pre-migrate dump.
  → Fix the migration SQL; re-run from step 3.

yarn db:seed or db:seed-extras fails?
  → STOP.
  → Assess: if data state can be corrected by re-running (idempotent), re-run.
  → If data is corrupt or ambiguous, pg_restore from dump and investigate.

yarn db:verify fails (exit non-zero)?
  → Read the verify_failed log — which assertion failed?
  → D-04 violation (system sub with null nature_id):
      Check v2-backfill-nature-id step. May need to re-run seed-extras.
  → MIG-03 violation (duplicate patterns):
      Investigate pattern migration steps. May need a targeted fix.
  → If not fixable forward without risk, pg_restore from dump.
```

---

## References

| Artifact | Role |
|----------|------|
| `scripts/migrate.ts` | `yarn db:migrate*` — guarded Drizzle migrate execution |
| `scripts/db-config.ts` | Target resolution, env keys, `PRODUCTION_MIGRATION_CONFIRM` gate |
| `scripts/seed.ts` | `yarn db:seed*` — directions, natures, taxonomy, patterns (idempotent) |
| `scripts/seed-extras.ts` | `yarn db:seed-extras*` — 12 STEPS incl. `v2-backfill-nature-id`, `v2-backfill-override-nature-id` |
| `scripts/verify-migration.ts` | `yarn db:verify*` — D-04 + MIG-03 SQL assertions |
| `drizzle/migrations/0018_*.sql` | The generated and reviewed migration SQL |
| `tests/fixtures/v2-taxonomy-manifest.ts` | Authoritative v2 slug/nature oracle |

---

*Phase 48 — sql-migration-recategorization*
*Runbook authored: 2026-06-11*
