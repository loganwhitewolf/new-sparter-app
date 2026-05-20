# S01 Research: Production Environment Contract and Vercel/Supabase Runtime Readiness

**Milestone:** M007 — Zero-cost Production Deploy  
**Slice:** S01 — Production env contract and runtime DB readiness  
**Status:** partial research written during timeout recovery  
**Last updated:** 2026-05-14

## Research goal

Identify what the first deploy-readiness slice must establish before code changes: required environment variables, current runtime behavior, Vercel build compatibility, Supabase/Postgres connection constraints, and the minimum implementation work needed to make production configuration explicit and safe without exposing secrets.

## Current project findings

### Existing scripts and build surface

`package.json` currently provides:

- `yarn build` → `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=$PWD/.next-font-google-mocks.cjs next build --webpack`
- `yarn lint` → `eslint`
- `yarn check:language` → `node scripts/check-code-language.mjs`
- `yarn db:generate` → `drizzle-kit generate`
- `yarn db:migrate` → `tsx scripts/migrate.ts`

The build script is already tailored for the project’s Next.js 16 setup and mocked Google font responses. For Vercel, verify whether this env-prefixed build command runs unchanged in Vercel’s Linux shell. It should, but this slice should still run `yarn build` locally as the baseline proof.

### Existing DB runtime configuration

`lib/db/index.ts` creates a process-level `pg.Pool`:

```ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 10,
  ssl:
    process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: true }
      : undefined,
})
```

Findings:

- `DATABASE_URL` is assumed present with a non-null assertion; missing production env may fail at runtime in routes using DB instead of producing an explicit startup/config diagnostic.
- `max: 10` is likely too high for Vercel serverless + Supabase Free, especially when multiple function instances are warm at once.
- `DATABASE_SSL=true` currently maps to `{ rejectUnauthorized: true }`. This may work with Supabase if the certificate chain is accepted by Node. If Supabase pooler/direct URLs require a different SSL mode in practice, this must be tested with the actual project URL.
- There is no env knob for pool size. S01 should add a bounded `DATABASE_POOL_MAX` or similar, with a low default suitable for serverless/free-tier usage.

Recommended S01 implementation direction:

- Add `DATABASE_POOL_MAX` with default `1` or `2` in production/serverless contexts and a safe upper bound.
- Keep local development simple; default local pool can stay small unless a strong reason exists to preserve `10`.
- Parse pool size defensively and never log `DATABASE_URL`.
- Consider adding a small config helper so runtime DB config and migration script do not diverge on pool sizing/SSL semantics.

### Existing health endpoint

`app/api/health/route.ts` already uses:

- `export const runtime = 'nodejs'`
- `export const dynamic = 'force-dynamic'`
- parallel DB and R2 probes
- a sanitized JSON response with `status: 'ok' | 'degraded'`
- structured logs that include status, booleans, latency, and missing R2 env var names only

`lib/services/health.ts`:

- Checks missing `DATABASE_URL` before probing DB.
- Uses `SELECT 1` through Drizzle.
- Times out DB probe after `DEFAULT_DB_TIMEOUT_MS = 2500`.
- Returns sanitized DB codes: `database_configuration_missing`, `database_timeout`, `database_unreachable`.
- R2 health currently checks only missing required env names.

Findings:

- Health already satisfies much of S01/S05’s failure visibility model for DB presence and timeout.
- DB pool construction still occurs at module import time, so a malformed `DATABASE_URL` may still cause failures before/around probe execution depending on `pg` behavior. This should be verified and possibly hardened.
- Health does not currently report pool settings or runtime env details, which is good; do not expose connection info.

### Existing env example

`.env.example` currently lists:

Required/core local variables:

- `DATABASE_URL`
- `BETTER_AUTH_URL`
- `NEXT_PUBLIC_BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`
- optional commented `DATABASE_SSL=true`

R2 variables:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- optional `R2_PRESIGNED_UPLOAD_TTL_SECONDS`

Categorization gates:

- `CATEGORIZATION_REGEX_MIN_PLAN`
- `CATEGORIZATION_HISTORY_MIN_PLAN`
- `CATEGORIZATION_CUSTOM_PATTERNS_MIN_PLAN`

Logging:

- `BETTERSTACK_SOURCE_TOKEN`
- `BETTERSTACK_INGESTING_URL`

Findings:

- `.env.example` is local-development oriented and does not separate local vs production/Vercel concerns.
- It does not yet include planned M007 variables like `REGISTRATION_ENABLED`, `DATABASE_POOL_MAX`, or a separate migration target variable.
- It does not document which variables must be set in Vercel vs only local migration shell.

Recommended S01 env contract groups:

#### Vercel production runtime env vars

Required:

- `DATABASE_URL` — Supabase runtime connection string; prefer the Supabase pooler/transaction-mode URL if compatible with app queries.
- `DATABASE_SSL` — set to `true` for Supabase unless actual verification proves otherwise.
- `BETTER_AUTH_URL` — production origin, e.g. Vercel URL or custom domain.
- `NEXT_PUBLIC_BETTER_AUTH_URL` — same production public origin for browser-side auth client usage.
- `BETTER_AUTH_SECRET` — long random secret; never committed or printed.
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

Recommended/optional:

- `DATABASE_POOL_MAX` — low serverless-safe value, recommended `1` or `2` for zero-cost/free-tier deployment.
- `REGISTRATION_ENABLED` — planned guardrail for S04; include in contract now even if implementation lands later.
- `R2_PRESIGNED_UPLOAD_TTL_SECONDS` — optional, default currently 600 and capped at 3600.
- `BETTERSTACK_SOURCE_TOKEN` / `BETTERSTACK_INGESTING_URL` — optional structured log shipping.
- Categorization gate variables if production behavior needs to differ from alpha defaults.

#### Local-only production migration env vars

S02 should likely avoid using the same ambiguous `DATABASE_URL` for local dev and production migration. Candidate contract:

- `PRODUCTION_DATABASE_URL` or `DATABASE_URL` only when paired with an explicit production flag.
- `PRODUCTION_DATABASE_SSL=true` or shared `DATABASE_SSL=true` if using a dedicated URL.
- A command such as `yarn db:migrate:production` that refuses to run unless a production target variable is present and an explicit confirmation env/flag is supplied.

S01 should reserve space in docs for this, even if S02 implements the command.

## Platform notes and assumptions to verify

### Vercel Hobby / Next.js runtime

- DB and R2 code require Node.js runtime, not Edge runtime. `/api/health` already declares `runtime = 'nodejs'`.
- Other routes using `pg`, AWS SDK, file parsing, or server actions should remain Node-compatible. If any route is accidentally Edge-bound, production DB/R2 usage would fail.
- Vercel env var changes require redeploy for production runtime to see new values.
- Vercel build must not require production secrets except those intentionally needed at build time. Prefer runtime-only access for DB/R2 secrets.

### Supabase Free Postgres

- Serverless runtimes can create many short-lived connections. Supabase pooler should be preferred for runtime traffic when compatible.
- Local migrations may be better run through a direct/session-capable connection instead of a transaction pooler, depending on Supabase/Drizzle migration behavior. This must be validated in S02.
- Free-tier projects can pause or hit limits; health should surface degraded DB status without leaking URL/user/password.

### Cloudflare R2

- Existing R2 service uses S3-compatible client with `region: 'auto'` and endpoint `https://${accountId}.r2.cloudflarestorage.com`.
- Existing health only validates required env presence; actual upload/read smoke test belongs to S03/S05.
- Browser direct upload requires correct R2 CORS in the Cloudflare dashboard; this must be documented later.

## Risks / unknowns for S01

1. **Pooler compatibility unknown:** Supabase pooler URL may behave differently from direct Postgres for migrations or prepared/session behavior. Runtime should use pooler if compatible; migrations may require direct URL.
2. **SSL details unknown:** Current `DATABASE_SSL=true` uses `rejectUnauthorized: true`; confirm against Supabase connection strings.
3. **Import-time DB config:** Current DB module assumes `DATABASE_URL!`; malformed/missing env should be checked in health/build scenarios.
4. **Vercel build-time env leakage risk:** Avoid scripts/docs that encourage setting secrets in public/client-prefixed env vars except the intended public auth URL.
5. **Language convention:** Developer docs and env descriptions must be English; Italian should remain only intentional product-facing copy.

## Recommended S01 deliverables

1. Update `.env.example` with production-aware variables, including `DATABASE_POOL_MAX` and `REGISTRATION_ENABLED`, without adding real values.
2. Add a production environment contract document/runbook section, likely under `docs/production.md` or `docs/deploy/vercel-supabase-r2.md`, listing:
   - Vercel runtime variables
   - local migration-only variables
   - which variables are public vs secret
   - redeploy requirement after Vercel env changes
   - no-secret verification commands
3. Refactor DB pool config to use a bounded pool size env var and serverless-safe default.
4. Add/adjust tests for DB config parsing if the code is made testable without importing `server-only` in Vitest.
5. Verify:
   - `yarn lint`
   - `yarn check:language`
   - `yarn build`
   - any targeted tests added for env parsing

## Suggested acceptance mapping

S01 acceptance criterion says:

> Production env contract is documented, runtime DB pool settings are suitable for Vercel/Supabase Free, Vercel build works locally, and required env names are listed without values.

Evidence to collect at completion:

- File diff showing `.env.example` and docs list required env names only.
- Code diff showing DB pool max is bounded/configurable with low default.
- Fresh command output for `yarn build`, `yarn lint`, and `yarn check:language`.
- Optional targeted test output for config parsing.

## Blockers / incomplete research

- This artifact was written during automated timeout recovery, so no live web documentation was fetched in this pass.
- Supabase pooler URL mode, SSL behavior, and migration-vs-runtime connection split must still be verified against current Supabase docs and the actual project once credentials exist.
- Vercel production deployment behavior cannot be proven until env vars are set and a deployment is available.
