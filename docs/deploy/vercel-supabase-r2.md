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

## Local production migration variables reserved for S02

Production migrations are intentionally deferred to S02. Until that slice implements the migration command, do not run production migrations through the local development `DATABASE_URL` by accident.

The intended S02 contract is:

- use a dedicated production migration target variable such as `PRODUCTION_DATABASE_URL` instead of reusing the local development `DATABASE_URL`;
- pair it with an explicit SSL setting such as `PRODUCTION_DATABASE_SSL=true` when Supabase requires SSL;
- make the production migration command refuse to run unless the production target and an explicit confirmation flag are present;
- keep migration variables local to the operator shell or secure CI environment, not in committed files.

Runtime env configuration and production migration configuration are deliberately separate because the deployed app may use a Supabase pooler URL while migrations may require a direct or session-capable database connection.

## Free-tier constraints and assumptions

- Vercel serverless functions may create multiple warm instances. Keep `DATABASE_POOL_MAX` low; the app default is `2` and the parser caps configured values at `5`.
- Supabase Free has limited connection capacity and can pause or throttle under free-tier limits. Prefer the Supabase pooler for runtime traffic when compatible.
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
