# Vercel + Supabase + Cloudflare R2 production environment contract

This runbook defines the zero-cost production environment contract for deploying Sparter on Vercel Hobby, Supabase Free, and Cloudflare R2. It lists variable names only; never paste real credentials, tokens, passwords, or full production connection strings into committed files or logs.

## Integrated production smoke

Use this ordered smoke when preparing the first production deploy or when revalidating production after environment, migration, auth, or R2 changes. Capture only the safe evidence fields in the template below; never paste secret values, cookies, presigned URLs, request bodies, file contents, object keys, raw provider responses, raw SDK errors, or stack traces into evidence.

1. **Review variable names before adding values.** Compare Vercel and local operator secret stores against `.env.example` and the tables in this document. Record only missing or present variable names, not values.
2. **Configure Vercel runtime variables.** Add the production `DATABASE_URL`, `DATABASE_SSL`, `DATABASE_POOL_MAX`, Better Auth origin/secret variables, R2 variables, and optional Better Stack variables in Vercel Production. Do not create client-prefixed database, R2, Better Stack, or auth secret variables.
3. **Configure Supabase and R2 free-tier resources.** Confirm the intended Supabase production project, low database pool sizes, the production R2 bucket, scoped R2 keys, and a CORS policy that allows only the production HTTPS origin, `PUT`, and `Content-Type`. The helper `node scripts/set-r2-cors.mjs` can apply the R2 CORS rule when `R2_CORS_ALLOWED_ORIGIN` is set to the deployed origin and Cloudflare credentials are supplied through the operator environment.
4. **Run the local production migration.** From a trusted operator machine, set the `PRODUCTION_*` variables in `.env` and run `yarn db:migrate`. Record the command, timestamp, exit code, and sanitized `migration_started`, `migration_succeeded`, or `migration_failed.error.code` values only.
5. **Deploy or redeploy Vercel production.** Trigger a production deployment after any Vercel environment change. Record the deployment URL origin and deployment status, not build logs containing environment details.
6. **Check runtime health.** Open or `curl` `https://<production-origin>/api/health`. Record HTTP status, top-level `status`, `components.db.ok`, `components.db.code` when present, `components.r2.ok`, and `components.r2.missing` variable names when present.
7. **Smoke enabled signup and login.** After redeploy, create or use a disposable smoke account through the UI, then confirm the authenticated app loads. Record UI checkpoints and screenshot artifact paths only; do not record passwords, cookies, tokens, or request bodies.
8. **Confirm preserved login.** Sign in with an existing smoke account and confirm the authenticated app still loads. If already signed in, refresh the app and confirm the session remains valid without recording cookies.
9. **Run a small R2 import smoke.** Sign in, upload a deliberately tiny CSV with fake rows, wait for the browser direct `PUT` to finish, and confirm navigation to `/import/<fileId>/analyze` or the expected analysis checkpoint. Record route checkpoint and safe upload diagnostic event names/statuses only; never record presigned URLs, object keys, file contents, or row data.
10. **Clean up smoke artifacts.** Delete disposable smoke users/imports/objects when they are no longer useful, and keep demo files small to stay within Vercel Hobby, Supabase Free, and Cloudflare R2 Free limits.

Optional executable checks live in `scripts/production-smoke.mjs` and `tests/production-smoke.spec.ts`. They consume secrets only from the local or CI secret store and emit or assert the same safe evidence fields documented here. Live browser evidence is optional for routine automation because it requires disposable production credentials, but it is required for final production acceptance before declaring the deploy ready.

### Optional browser production smoke

The Playwright browser smoke is safe by default. This command skips all live phases unless the explicit production smoke flag, deployed base URL, and disposable account inputs are present:

```bash
PLAYWRIGHT_PRODUCTION_SMOKE=0 yarn playwright test tests/production-smoke.spec.ts
```

Use the following variable names from a secure local or CI secret store when intentionally running against the deployed app. Record only phase/checkpoint names, HTTP status, sanitized error codes, and artifact paths; never record the variable values.

| Variable | Required for | Secret? | Notes |
|---|---|---:|---|
| `PLAYWRIGHT_PRODUCTION_SMOKE` | All live browser phases | No | Set to `1` to opt in. Any other value skips safely. |
| `PLAYWRIGHT_BASE_URL` | All live browser phases | No | Deployed production HTTPS origin. Do not include path, query, credentials, or fragment. |
| `PLAYWRIGHT_SMOKE_EMAIL` | Signup/login/import phases | Yes | Disposable smoke account email. Use an account created only for smoke verification. |
| `PLAYWRIGHT_SMOKE_PASSWORD` | Signup/login/import phases | Yes | Disposable smoke account password. Never print or paste it into evidence. |
| `PLAYWRIGHT_SMOKE_RUN_IMPORT` | R2 browser import phase | No | Set to `1` to upload a generated tiny fake CSV through the browser and require the `/import/<fileId>/analyze` checkpoint. |

Recommended phase sequence:

1. With registration enabled, set `PLAYWRIGHT_PRODUCTION_SMOKE=1`, `PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_SMOKE_EMAIL`, and `PLAYWRIGHT_SMOKE_PASSWORD`, then run `yarn playwright test tests/production-smoke.spec.ts --grep "enabled registration"`.
2. When R2 health is good and the smoke account can log in, add `PLAYWRIGHT_SMOKE_RUN_IMPORT=1` and run `yarn playwright test tests/production-smoke.spec.ts --grep "R2 browser import"`.

Each browser smoke run uses one disposable user and, when import is enabled, one tiny generated CSV upload. Clean up obsolete smoke users/import rows/R2 objects to avoid free-tier quota clutter. The spec fails if collected browser upload diagnostics include presigned URLs, object key fields, cookies, credentials, file contents, or stack-like diagnostics.

### Safe evidence template

| Phase | Safe command or action | Timestamp (UTC) | Exit code | URL origin | HTTP status | Safe code/status fields | Artifact path |
|---|---|---:|---:|---|---:|---|---|
| variable review | Compare configured variable names with `.env.example` |  |  |  |  | missing/present variable names only |  |
| migration | `yarn db:migrate` |  |  |  |  | `migration_succeeded` or `migration_failed.error.code` |  |
| deploy | Vercel production redeploy |  |  | `https://<production-origin>` |  | deployment status only |  |
| health | `GET /api/health` |  |  | `https://<production-origin>` |  | `status`, `components.db.ok/code`, `components.r2.ok/missing` |  |
| enabled signup/login | UI smoke |  |  | `https://<production-origin>` |  | checkpoint names only | screenshot/log path |
| R2 import | UI upload smoke |  |  | `https://<production-origin>` |  | upload diagnostic event names/statuses; analyze route checkpoint | screenshot/log path |
| cleanup | Remove disposable smoke artifacts |  |  |  |  | deleted artifact counts only |  |

The evidence table must not include database URLs, auth secrets, R2 keys, bearer tokens, presigned URLs, cookies, passwords, request bodies, object keys, file contents, raw SDK/provider errors, or stack traces.

### Failure decision tree

1. **Migration fails before connecting.** If `migration_failed.error.code` is `missing_production_database_url`, `missing_production_migration_confirm`, or `invalid_production_migration_confirm`, fix the local-only migration variable names/confirmation and rerun. Do not switch to production `drizzle-kit push`, a migration API route, or deploy-time migrations.
2. **Migration reaches the database and fails.** Use the sanitized `migration_failed.error.code` and optional safe `className` to inspect Supabase logs or migration files. Keep `PRODUCTION_DATABASE_POOL_MAX` low, verify the target project, and avoid parallel migration attempts.
3. **Health is degraded for `db`.** If `/api/health` reports `components.db.code=database_configuration_missing`, add the missing runtime database variable and redeploy. If it reports `database_timeout` or `database_unreachable`, check Supabase availability, SSL, pooler/direct URL choice, and free-tier connection pressure without logging the connection string.
4. **Health is degraded for `r2`.** If `components.r2.ok` is false, add the listed missing R2 variable names in Vercel and redeploy. Health reports names only; it is safe to paste the names but not values.
5. **Login or preserved session fails.** Verify `BETTER_AUTH_URL` and `NEXT_PUBLIC_BETTER_AUTH_URL` use the same production HTTPS origin, then inspect browser origin/cookie behavior. Record only origin, status, and checkpoint names; never capture cookies or auth tokens.
6. **R2 browser upload fails before or during `PUT`.** Isolate the presign phase from browser CORS/PUT. If presign or health fails, inspect server-side R2 env names. If presign succeeds but the browser `PUT` fails, compare the R2 CORS origin, method `PUT`, and allowed header `Content-Type` against the actual production origin and use sanitized `upload_put_attempt`, `upload_put_retrying`, or `upload_put_failed` diagnostics.
7. **Import reaches upload but analysis fails.** Keep the fixture tiny and fake, confirm navigation/checkpoint around `/import/<fileId>/analyze`, and inspect sanitized app logs or bounded UI error states. Do not paste file contents, object keys, raw parser output, or stack traces.
8. **Quota or cold-start symptoms appear.** Treat slow or intermittent checks as free-tier signals first: wait for cold starts, keep database pool sizes low, keep smoke files tiny, and clean up disposable imports/users/objects before escalating.

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
| `GOOGLE_CLIENT_ID` | No | Optional | Google OAuth client ID. When set (together with `GOOGLE_CLIENT_SECRET`), activates the Google social login provider. Register at https://console.cloud.google.com/apis/credentials. Callback URL: `{BETTER_AUTH_URL}/api/auth/callback/google`. |
| `GOOGLE_CLIENT_SECRET` | No | Optional (paired with ID) | Google OAuth client secret. Must be set together with `GOOGLE_CLIENT_ID`. |
| `GITHUB_CLIENT_ID` | No | Optional | GitHub OAuth client ID. When set (together with `GITHUB_CLIENT_SECRET`), activates the GitHub social login provider. Register at https://github.com/settings/applications/new. Callback URL: `{BETTER_AUTH_URL}/api/auth/callback/github`. |
| `GITHUB_CLIENT_SECRET` | No | Optional (paired with ID) | GitHub OAuth client secret. Must be set together with `GITHUB_CLIENT_ID`. |
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

Do not create client-prefixed versions of database, R2, Better Stack, or auth secret variables. Only variables intentionally named with `NEXT_PUBLIC_` are exposed to browser code.

OAuth callback URLs follow the pattern `{BETTER_AUTH_URL}/api/auth/callback/{provider-id}`. For Google: `.../callback/google`. For GitHub: `.../callback/github`. `BETTER_AUTH_URL` must be set to the correct production HTTPS origin for OAuth redirects to work.

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

Each smoke creates one small R2 object and one database file row. Keep demo files small, watch Cloudflare R2 Free storage/operation usage and Supabase Free row usage.

## Local production migration runbook

Production migrations are an explicit local operator action. Vercel runtime environment variables do not run migrations automatically, and editing Vercel env values only affects deployed functions after a redeploy.

### Prerequisites

- Generate and review migration files before touching production with `yarn db:generate`.
- Confirm the target database is the intended Supabase production project.
- Use a dedicated migration connection in `PRODUCTION_DATABASE_URL`; do not reuse the development `DATABASE_URL` by accident.
- Keep `/api/health` as the no-secret readiness surface after deploy. It reports app/runtime health; it is not a migration executor.

### Local-only migration environment

Set these names in `.env` before running `yarn db:migrate` or `yarn db:seed`. Operator scripts load `.env` only (not `.env.local`). The repository must list names only, never real values.

| Variable | Required? | Notes |
|---|---:|---|
| `PRODUCTION_DATABASE_URL` | Yes | Production migration database URL. This may differ from runtime `DATABASE_URL`, especially when the deployed app uses a Supabase pooler URL but migrations require a direct or session-capable connection. |
| `PRODUCTION_DATABASE_SSL` | Yes for Supabase | Set to `true` when Supabase requires SSL. |
| `PRODUCTION_DATABASE_POOL_MAX` | Optional | Defaults to `1` and is capped low for Supabase Free. Keep it at `1` unless there is a documented reason to change it. |
| `PRODUCTION_MIGRATION_CONFIRM` | Yes | Must be exactly `apply-to-production`; otherwise the command refuses to open a database connection. |

### Command

```bash
yarn db:migrate
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
- Do not use `drizzle-kit push` for production; use `yarn db:migrate` with reviewed migration files.
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
