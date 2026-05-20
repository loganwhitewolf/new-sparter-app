# S02 Research: Manual Supabase migration flow

## Summary
S02 is a targeted/high-risk operational slice: the code already has a Drizzle migrator, but it is currently local-development oriented and unsafe as a production command. `scripts/migrate.ts` reads `DATABASE_URL`, loads `.env.local`/`.env`, uses `pg.Pool max: 10`, logs Italian messages, and prints the raw caught error. That violates the M007 contract for a separate production migration target, bounded connection usage, English developer-facing logs, and no-secret diagnostics.

Active requirements supported/owned: R040 (manual local Drizzle production migration flow), R038/R039 (zero-cost Vercel + Supabase DB baseline), R043/R044 (sanitized diagnostics/runbook), and R045 (free-tier constraints). S01 explicitly reserved a separate migration-only env contract so S02 should not reuse Vercel runtime `DATABASE_URL` as the production migration target.

## Recommendation
Refactor migration execution into testable helpers plus a thin script entry point, then add an explicit production script. Keep the existing generated SQL migrations under `drizzle/migrations` and keep `drizzle-kit push` out of the flow.

Recommended shape:
- Add `lib/db/migration-config.ts` or `scripts/migration-config.ts` with pure helpers for reading/parsing env, target validation, pool config, and error sanitization.
- Update `scripts/migrate.ts` to support two modes:
  - local/default: can continue using `DATABASE_URL` for dev ergonomics;
  - production: uses only `PRODUCTION_DATABASE_URL`, optional `PRODUCTION_DATABASE_SSL=true`, `PRODUCTION_DATABASE_POOL_MAX` bounded to a very low cap (default 1, cap 2), and an explicit confirmation such as `PRODUCTION_MIGRATION_CONFIRM=apply-to-production` or `MIGRATION_TARGET=production`.
- Add package script such as `db:migrate:production` that sets an explicit mode (`tsx scripts/migrate.ts --production` or `MIGRATION_TARGET=production tsx scripts/migrate.ts`).
- Log phase/status only: `migration_started`, `migration_succeeded`, `migration_failed`, target class (`production`), migration folder, SSL enabled boolean, pool max. Never log URLs, passwords, raw connection strings, or raw stack traces.
- Update `docs/deploy/vercel-supabase-r2.md` with exact command, required env names, warning that Vercel env vars do not run migrations automatically, and a note that runtime pooler URLs and migration URLs may differ.

## Implementation landscape
Key files:
- `scripts/migrate.ts` — current migrator entry point using `drizzle-orm/node-postgres/migrator`; primary change target.
- `package.json` — currently has `db:migrate`; add `db:migrate:production` without removing the local workflow.
- `drizzle.config.ts` — already points at `lib/db/schema.ts` and `drizzle/migrations`; comment currently says production migrations use `npm run db:migrate`, which must be corrected to the explicit production command.
- `.env.example` — add commented migration-only names (`PRODUCTION_DATABASE_URL`, `PRODUCTION_DATABASE_SSL`, optional `PRODUCTION_DATABASE_POOL_MAX`, confirmation flag) without values.
- `docs/deploy/vercel-supabase-r2.md` — expand the S02 migration section into an operator runbook.
- `tests/...` — add targeted Vitest tests for migration config/guardrails. Prefer pure helper tests over running a real DB migration in unit tests.

Current migrator behavior to fix:
- Uses `DATABASE_URL`, risking accidental local/runtime target reuse.
- Fails missing env with Italian developer-facing text.
- Uses `max: 10`, too high for Supabase Free/serverless-style safety and inconsistent with S01 pool decisions.
- Prints raw `err`, which may include host/user/password/connection details.
- Has no target confirmation or ambiguity checks.

## Natural seams for planning
1. **Config/guardrail seam**: pure parsing/validation helpers for production migration target, SSL, pool max, and sanitized error classification. This can be developed and tested without touching DB.
2. **Script wiring seam**: update `scripts/migrate.ts` to consume helpers, construct a low-connection `pg.Pool`, run Drizzle `migrate(db, { migrationsFolder: './drizzle/migrations' })`, and always `pool.end()`.
3. **Documentation/env seam**: update `.env.example`, `drizzle.config.ts` comments, and deployment doc with the command and operator sequence.
4. **Verification seam**: tests for missing env, wrong env names, absent confirmation, localhost/non-Supabase-looking targets if desired, pool bounding, SSL handling, and sanitized failure messages.

## First proof
The biggest unblocker is proving the script refuses ambiguous or missing production targets before a DB connection is attempted. Build this proof first with tests that call the pure config helper and assert:
- production mode ignores `DATABASE_URL` and requires `PRODUCTION_DATABASE_URL`;
- missing/blank `PRODUCTION_DATABASE_URL` fails with a stable code/message;
- missing confirmation fails before building a pool;
- pool max defaults to 1 and caps low;
- sanitized error output does not contain a URL/password-like sample.

## Verification
Targeted checks after implementation:
- `yarn vitest tests/migration-config.test.ts` (or equivalent new test file).
- `yarn lint` (developer-facing English and unused imports).
- `yarn check:language` because existing migrator logs are Italian and S02 will touch scripts/docs.
- `yarn build` to preserve S01 baseline.
- Manual dry/failure checks, without secrets in output: run production command with missing env and with missing confirmation; both should fail before DB access and print only env names/status codes.
- Final M007/S05 live proof: run the production command against the real Supabase target from the operator shell. Do not store the connection string in repo or output.

## Risks and constraints
- Supabase runtime pooler vs migration connection may differ. Docs should instruct using a migration-appropriate Supabase connection string; do not assume the Vercel runtime `DATABASE_URL` is the right migration URL.
- Raw `pg`/Drizzle errors can include sensitive connection details. Catch and log a sanitized class/message; optionally include `error.name`/safe code but not `error.stack` or full object.
- Avoid `drizzle-kit push` entirely; the production command must use generated migrations only.
- Keep connection usage minimal (`max: 1` is sufficient for serial migrations).
- Do not add production secrets to `.env.example` values; names only.

## Skill discovery
Relevant installed skills from the available list: `observability` (sanitized phase/status logging), `write-docs` (operator runbook), and `api-design` is not central because this is CLI/script work. No external skill installation is required for the planner.

## Sources
- Memory: MEM190 confirms manual local generated Drizzle migrations for M007; MEM044/MEM149 warn about Drizzle migration metadata/generation gotchas.
- Code scan: `scripts/migrate.ts`, `package.json`, `drizzle.config.ts`, `.env.example`, `docs/deploy/vercel-supabase-r2.md`, S01 summary.
