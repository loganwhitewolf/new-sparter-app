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
| `REGISTRATION_ENABLED` | No | Optional | Implemented server-side registration toggle. Registration is enabled by default when unset, blank, or malformed. Set to `false`, `0`, `no`, or `off` to block new signup through both server actions and direct `/api/auth/sign-up/email` calls while existing-user login remains delegated to Better Auth. Redeploy after changing this value in Vercel. |

Do not create client-prefixed versions of database, R2, Better Stack, or auth secret variables. Only variables intentionally named with `NEXT_PUBLIC_` are exposed to browser code.

## Registration toggle smoke and recovery

`REGISTRATION_ENABLED` is an implemented server-side production guardrail for controlling public signup without affecting existing users. Leave it unset, blank, or set to a true-like value (`true`, `1`, `yes`, `on`) to keep signup open. Set it to an explicit false-like value (`false`, `0`, `no`, `off`) to disable new registration.

When registration is disabled:

- New signup through the app server action returns the disabled-registration message instead of calling Better Auth signup.
- Direct `POST /api/auth/sign-up/email` calls are rejected server-side with HTTP `403` and the sanitized error code `registration_disabled`.
- Existing-user login through `POST /api/auth/sign-in/email` and normal sign-in UI flow remains available and delegated to Better Auth.
- This is not only a UI hiding mechanism; the server action and direct Better Auth route are both guarded.

After adding or changing `REGISTRATION_ENABLED` in Vercel, redeploy before retesting. If Vercel still appears to use stale registration behavior, trigger a new production deployment first, then rerun the signup and login smoke checks. If signup was disabled accidentally, re-enable or remove the variable, redeploy, and verify signup opens again.

Minimal no-secret smoke checklist after redeploy:

1. With `REGISTRATION_ENABLED=false`, attempt a new signup from the UI and confirm the disabled-registration message appears.
2. With `REGISTRATION_ENABLED=false`, call `POST /api/auth/sign-up/email` with disposable test credentials and confirm HTTP `403` with error code `registration_disabled`; do not log or paste credentials, request bodies, cookies, or tokens.
3. With `REGISTRATION_ENABLED=false`, sign in with an existing test user and confirm the login flow still reaches the authenticated app.
4. Re-enable registration only when intended, redeploy, and verify a new signup can proceed.

## Cloudflare R2 production setup

Use this sequence when preparing the production import upload path for Vercel:

1. In Cloudflare R2, create the production bucket that will store uploaded import files.
2. Create scoped R2 API token/access keys for that bucket. The keys must allow the app to sign uploads, check uploaded objects, and read objects for import analysis; do not reuse personal or account-wide credentials when a scoped key is available.
3. Add the server-side R2 variables in the Vercel production environment: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, and optionally `R2_PRESIGNED_UPLOAD_TTL_SECONDS`.
4. Redeploy the Vercel production app after adding or changing the variables. Existing serverless functions can keep stale environment values until a new deployment is active.
5. Open `/api/health` on the deployed app and confirm `components.r2.ok` is `true` before running an import smoke.
6. Run a tiny CSV import smoke through the real browser flow: sign in, upload a small CSV file, wait for the direct R2 `PUT`, confirm the app transitions to `/import/<fileId>/analyze`, then review the analysis page.

R2 credentials and the bucket name remain server-side only in this app. Do not create browser-exposed R2 variables. The browser receives only a short-lived presigned `PUT` URL and the upload headers returned by the server.

## Cloudflare R2 CORS policy

Configure CORS on the R2 bucket before testing browser uploads. The production rule must allow the deployed HTTPS origin, the `PUT` method, and the safe upload header contract used by the code: `Content-Type`.

Minimal production policy shape:

```json
[
  {
    "AllowedOrigins": ["https://your-production-origin.example"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3000
  }
]
```

Replace the origin with the real production HTTPS origin configured for the app. Keep local development origins in a separate non-production allowance only when needed, for example `http://localhost:3000`; do not broaden the production rule to every origin for convenience.

If the browser upload fails after presign succeeds, first compare the R2 CORS origin, method, and allowed headers against the actual browser request. The app emits browser `upload_put_attempt`, `upload_put_retrying`, and `upload_put_failed` diagnostics with attempt count, max attempts, HTTP status when available, retryable flag, and generic error names/messages. Those diagnostics must not include presigned URLs, object keys, credential values, file contents, raw SDK requests, or stacks.

## R2 health expectations

Use `/api/health` as the first no-secret inspection surface after deployment:

- With all required R2 variables present and valid, `components.r2.ok` should be `true`.
- With missing R2 configuration, health reports only the missing variable names, not credential values.
- If Vercel variables were just added or changed and health still reports missing or stale values, trigger a new production deployment before retesting.

Server-side R2 failures are logged with sanitized operation, code, status, and missing environment variable names when relevant. Do not add ad hoc logging of credentials, bucket values, object contents, raw SDK objects, or stack traces while debugging.

## Small-file R2 import smoke

After `/api/health` is healthy, verify the end-to-end path with a deliberately tiny file:

1. Prepare a small CSV fixture with only a few rows and no sensitive real bank data.
2. Sign in to the production deployment with an account allowed by the current signup guardrail.
3. Start an import from the UI and choose the small CSV file.
4. Confirm the upload completes and the route changes to `/import/<fileId>/analyze`.
5. If the upload fails, inspect the browser upload diagnostic events and the health response before changing secrets or CORS.
6. Remove failed or obsolete demo imports later if they are no longer useful for verification.

Each smoke creates one small R2 object and one database file row. Keep demo files small, watch Cloudflare R2 Free storage/operation usage and Supabase Free row usage, and rely on the S04 registration guardrail to avoid public signup amplification of quota usage.

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
- Cloudflare R2 is used through server-side signing and browser direct upload. Keep the CORS policy aligned with the documented `Content-Type` upload header contract.
- Production secrets should be runtime-only whenever possible. The Vercel build should not need database, R2, Better Auth secret, or Better Stack token values.

## Redeploy after environment changes

Vercel production functions do not automatically pick up edited environment variables in already-deployed builds. After adding or changing any production variable in Vercel, trigger a new production deployment before testing `/api/health` or auth/import flows.

## No-secret verification commands

Use commands and endpoints that report status without printing credential values.

```bash
# Verify the deployment document exists and the env example lists implemented names.
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
