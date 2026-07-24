# Deferred Items — Phase 75 Plan 04

Out-of-scope discoveries logged per the executor's scope-boundary rule (only fixes directly
caused by the current task's own changes are auto-applied; everything else is logged here, not
fixed).

## 1. Local dev Postgres reset as a side effect of running this plan's own test suite

**Not a new issue** — `tests/helpers/reimbursement-test-db.ts`'s `resetReimbursementFixtures()`
runs `TRUNCATE TABLE ... RESTART IDENTITY CASCADE` against `postgres://postgres:sparter@localhost
:5432/sparter` (the SAME database the `yarn dev` app connects to locally), including `user`,
`direction`, `nature`, `category`, `sub_category`, `platform`, `file`, `expense`, `transaction`,
`expense_group`, `expense_group_membership`, `reimbursement`, `reimbursement_refund`, `tag`,
`transaction_tag`. This has been the harness's behavior since Phase 73 (used by every
`reimbursement-*.test.ts` run across Phases 73/74/75).

Running this plan's `yarn vitest run tests/reimbursement-phase-75.test.ts ...` (required by the
plan's own `<verify>` blocks) truncated the developer's local dev DB, including their `user` row
(cascading their `session`/`account` rows) — their local login session is now invalid.

## 2. `yarn db:seed` fails when leftover test-fixture rows share a seed row's `code`

Attempting to restore baseline taxonomy immediately after the above (`yarn db:migrate && yarn
db:seed`, WITHOUT first truncating leftover fixture rows) hit:

```
error: insert or update on table "sub_category" violates foreign key constraint
"sub_category_nature_id_nature_id_fk"
detail: Key (nature_id)=(3) is not present in table "nature".
```

**Root cause (confirmed):** `resetReimbursementFixtures()` truncates fixture tables at the START
of each test, not the end — so the LAST test in a suite run leaves its own fixture rows behind
(e.g. `tests/fixtures/reimbursement-seed.ts#seedMinimalTaxonomy` inserts a `nature` row with
`code: 'essential'` via a plain auto-increment insert, landing at whatever id the sequence gives
it — e.g. `id=1`, not the canonical seed's `id=3`). `scripts/seed.ts`'s `natures` array
(`scripts/seed-data.ts`) inserts explicit ids via `.onConflictDoNothing()` with NO target column
specified, so Postgres treats a conflict on ANY unique constraint (including the `code` unique
index, not just the primary key) as "do nothing" — the leftover fixture row's `code='essential'`
at `id=1` silently blocks the canonical row from ever landing at `id=3`, and every subcategory
seed row hardcoded to `nature_id: 3` then fails its FK check.

**Workaround applied for this checkpoint:** manually truncated the same fixture-table set the
harness uses (`docker exec sparter-postgres psql ... TRUNCATE ... RESTART IDENTITY CASCADE`)
BEFORE re-running `yarn db:seed && yarn db:seed-extras && yarn db:seed-patterns` — this succeeded
cleanly (87 subcategories, 46 patterns). Baseline taxonomy is restored; the `user` table is
empty (expected — no seed script creates accounts), so a fresh login/registration is required.

**Recommendation:** `scripts/seed.ts`'s `.onConflictDoNothing()` calls for `direction`/`nature`
should specify an explicit target (e.g. `.onConflictDoNothing({ target: nature.id })`) so a
`code`-only collision from an out-of-band row (test fixtures, manual inserts) cannot silently
block the canonical explicit-id row from landing — worth a dedicated fix, unrelated to this
plan's `lib/dal/reimbursement.ts` / `ReimbursementPanel` / `RefundPickerDialog` work.
