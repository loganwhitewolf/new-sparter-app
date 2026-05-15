# Vercel + Supabase + Cloudflare R2 production environment contract

This runbook defines the zero-cost production environment contract for deploying Sparter on Vercel Hobby, Supabase Free, and Cloudflare R2. It lists variable names only; never paste real credentials, tokens, passwords, or full production connection strings into committed files or logs.

## Vercel runtime environment variables

Configure these in Vercel for the production environment. After any change, redeploy the app so the serverless runtime receives the updated values.

| Variable | Public? | Required? | Notes |
|---|---:|---:|---|
| `DATABASE_URL` | No | Yes | Supabase runtime Postgres connection string. Prefer the Supabase pooler URL for app runtime traffic when compatible with deployed queries. Do not log or commit this value. |
| `DATABASE_SSL` | No | Yes for Supabase | Set to `true` for Supabase production connections when SSL is required. Local Docker development usually leaves it unset. |
| `DATABASE_POOL_MAX` | No | Recommended | Serverless-safe runtime pool size. If omitted or invalid, the app defaults to `2`; values above `5` are capped to `5`. Recommended production value: `2` for Vercel/Supabase Free. |
| `BETTER_AUTH_URL` | No | Yes | Server-side production HTTPS origin used by Better Auth. |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | Yes | Yes | Intentionally public browser-side auth origin. This is the only auth-related variable that should be client-prefixed. |
| `BETTER_AUTH_SECRET` | No | Yes | Long random server-side secret. Never expose in browser variables, docs, screenshots, or logs. |
| `R2_ACCOUNT_ID` | No | Yes | Cloudflare account identifier used server-side to build the R2 S3-compatible endpoint. |
| `R2_ACCESS_KEY_ID` | No | Yes | Cloudflare R2 access key ID for server-side signing and object checks. |
| `R2_SECRET_ACCESS_KEY` | No | Yes | Cloudflare R2 secret access key. Always secret server-side. |
| `R2_BUCKET_NAME` | No | Yes | R2 bucket name used by server-side upload/import code. Keep it server-side in this app contract. |
| `R2_PRESIGNED_UPLOAD_TTL_SECONDS` | No | Optional | Presigned upload URL lifetime. Defaults to `600` seconds and is capped to `3600`. |
| `BETTERSTACK_SOURCE_TOKEN` | No | Optional | Enables Better Stack log shipping when present. Leave unset to keep structured logs on stdout. |
| `BETTERSTACK_INGESTING_URL` | No | Optional | Optional Better Stack ingest endpoint override. The default endpoint value is safe to document. |
| `CATEGORIZATION_REGEX_MIN_PLAN` | No | Optional | Alpha gate override; defaults remain intentionally open during alpha. |
| `CATEGORIZATION_HISTORY_MIN_PLAN` | No | Optional | Alpha gate override; defaults remain intentionally open during alpha. |
| `CATEGORIZATION_CUSTOM_PATTERNS_MIN_PLAN` | No | Optional | Alpha gate override; defaults remain intentionally open during alpha. |
| `REGISTRATION_ENABLED` | No | Planned | Planned guardrail for M007/S04. Documented now for deployment planning; signup blocking is not implemented in this slice. |

Do not create client-prefixed versions of database, R2, Better Stack, or auth secret variables. Only variables intentionally named with `NEXT_PUBLIC_` are exposed to browser code.

## Local production migration runbook

Production migrations are an explicit local operator action. Vercel runtime environment variables do not run migrations automatically, and editing Vercel env values only affects deployed functions after a redeploy.

### Prerequisites

- Generate and review migration files before touching production with `yarn db:generate`.
- Confirm the target database is the intended Supabase production project.
- Use a dedicated migration connection in `PRODUCTION_DATABASE_URL`; do not reuse the development `DATABASE_URL` by accident.
- Keep `/api/health` as the no-secret readiness surface after deploy. It reports app/runtime health; it is not a migration executor.

### Local-only migration environment

Set these names in the operator shell or another secure local secret store before running the command. The repository must list names only, never real values.

| Variable | Required? | Notes |
|---|---:|---|
| `PRODUCTION_DATABASE_URL` | Yes | Production migration database URL. This may differ from runtime `DATABASE_URL`, especially when the deployed app uses a Supabase pooler URL but migrations require a direct or session-capable connection. |
| `PRODUCTION_DATABASE_SSL` | Yes for Supabase | Set to `true` when Supabase requires SSL. |
| `PRODUCTION_DATABASE_POOL_MAX` | Optional | Defaults to `1` and is capped low for Supabase Free. Keep it at `1` unless there is a documented reason to change it. |
| `PRODUCTION_MIGRATION_CONFIRM` | Yes | Must be exactly `apply-to-production`; otherwise the command refuses to open a database connection. |

### Command

```bash
yarn db:migrate:production
```

Do not use `drizzle-kit push` for production. Production changes must go through reviewed migration files and the guarded migration command above.

### Expected safe output

The CLI emits JSON status lines with sanitized fields only. A successful run prints events similar to:

```json
{"event":"migration_started","targetClass":"production","migrationsFolder":"./drizzle/migrations","sslEnabled":true,"poolMax":1}
{"event":"migration_succeeded","targetClass":"production","migrationsFolder":"./drizzle/migrations","sslEnabled":true,"poolMax":1}
```

A failed run prints `migration_failed` with a stable `error.code`, optional safe `className`, and a generic message. It must not print connection strings, passwords, usernames, URL hostnames, raw stacks, or raw driver/Drizzle error dumps.

### Failure cases and diagnosis

- Missing `PRODUCTION_DATABASE_URL`, missing `PRODUCTION_MIGRATION_CONFIRM`, or an incorrect confirmation value fails validation before opening a database connection.
- Live database errors fail through sanitized migration status. Use the safe `error.code` plus Supabase logs/dashboard context to investigate without pasting secrets into docs, issues, chats, or logs.
- Stale Vercel environment variables require a redeploy for runtime behavior, but they do not affect this local migration command.
- After deployment, verify runtime readiness with `/api/health`; do not create an API route or Vercel function to run migrations.

## Free-tier constraints and assumptions

- Vercel serverless functions may create multiple warm instances. Keep `DATABASE_POOL_MAX` low; the app default is `2` and the parser caps configured values at `5`.
- Supabase Free has limited connection capacity and can pause or throttle under free-tier limits. Prefer the Supabase pooler for runtime traffic when compatible.
- Production migrations use their own low pool max. Keep `PRODUCTION_DATABASE_POOL_MAX` at `1` for Supabase Free, do not run parallel production migrations, and wait for one migration command to finish before starting another.
- Do not use `drizzle-kit push` for production; use `yarn db:migrate:production` with reviewed migration files.
- Never paste secrets into docs, committed files, screenshots, tickets, chat, or logs.
- Cloudflare R2 is used through server-side signing and browser direct upload. R2 CORS/dashboard validation belongs to later deployment slices, not this baseline contract.
- Production secrets should be runtime-only whenever possible. The Vercel build should not need database, R2, Better Auth secret, or Better Stack token values.

## Redeploy after environment changes

Vercel production functions do not automatically pick up edited environment variables in already-deployed builds. After adding or changing any production variable in Vercel, trigger a new production deployment before testing `/api/health` or auth/import flows.

## No-secret verification commands

Use commands and endpoints that report status without printing credential values.

```bash
# Verify the deployment document exists and the env example lists planned names.
test -f docs/deploy/vercel-supabase-r2.md
grep -q "DATABASE_POOL_MAX" .env.example
grep -q "REGISTRATION_ENABLED" .env.example

# Verify developer-facing language in routes, comments, tests, and docs.
yarn check:language

# Build baseline for the production-aware configuration surface.
yarn build
```

For a deployed environment, use the readiness endpoint instead of logging secrets:

```bash
curl --fail --silent --show-error https://<production-origin>/api/health
```

`/api/health` is the no-secret readiness surface. Database failures are sanitized as `database_configuration_missing`, `database_timeout`, or `database_unreachable`. R2 readiness reports missing variable names only, not values. If Vercel env values were just changed and health still reports stale or missing configuration, redeploy first.
