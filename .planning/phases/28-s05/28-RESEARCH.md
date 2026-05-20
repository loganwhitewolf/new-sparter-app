# S05 Research — Production smoke runbook and integrated verification

## Summary

S05 is a high-risk integration/operability slice, not a feature slice. S02/S03/S04 already implemented the local contracts for production migrations, R2 browser upload, health diagnostics, and registration control; S05 must assemble those into a repeatable operator runbook and, where real credentials/deploy access are available, capture live smoke evidence for the complete sequence: local migration → Vercel deploy/redeploy → `/api/health` → signup/login enabled → signup disabled/direct API 403/login preserved → small R2 import.

This codebase already has most primitives. The missing seam is an integrated production-smoke artifact: either a doc section plus evidence template, or a small no-secret smoke script/Playwright spec that operators can run against `PLAYWRIGHT_BASE_URL`/production URL. Live production proof cannot be produced from unit tests alone and may require secure collection of Vercel/Supabase/R2/test-account inputs during execution.

## Active requirements S05 owns/supports

- **R038** — zero-euro Vercel Hobby/free production deployment. S05 supports with final deploy/redeploy runbook and evidence.
- **R039** — Supabase Free Postgres as production DB. S05 supports with live migration + `/api/health` DB proof.
- **R041** — Cloudflare R2 production storage. S05 supports with live browser small-file import proof.
- **R043** — production health/smoke diagnostics without secrets. **Primary S05 owner.**
- **R044** — repeatable production runbook. **Primary S05 owner.**
- **R045** — free-tier constraints explicit. **Primary S05 owner.**
- Related validated dependencies: **R040** migration flow validated by S02; **R042** registration guardrail validated by S04, but both still need deployed smoke evidence.

## Recommendation

Plan S05 as documentation + smoke harness + live-evidence capture:

1. **T01: Runbook consolidation.** Expand `docs/deploy/vercel-supabase-r2.md` from topic sections into one ordered “first production deploy / redeploy / smoke” checklist. Keep variable names only, never values.
2. **T02: Production smoke harness.** Add a small no-secret script or Playwright spec that can validate safe surfaces against a deployed URL: health shape, disabled direct signup 403 shape, login/register UI selectors, and import route smoke instructions. Make it opt-in via env vars and skip/fail clearly when required non-secret inputs are absent.
3. **T03: Live operator evidence.** Run the guarded migration and deployed smoke only if production URL and credentials are available through secure env collection/current environment. Capture sanitized command outcomes and redact test credentials/presigned URLs.
4. **T04: Close requirements.** Update docs/evidence so R043/R044/R045 can be validated and R038/R039/R041 can be advanced/validated depending on whether live deploy proof was possible.

If no live Vercel/Supabase/R2 access is available in this session, S05 can still deliver the repeatable runbook and smoke harness, but must clearly mark live proof as operator-pending rather than claiming final integrated acceptance.

## Implementation landscape

### Existing files and purpose

- `docs/deploy/vercel-supabase-r2.md` — central deployment/runbook doc. Already includes env contract, registration toggle smoke, R2 setup/CORS, R2 health, small-file import smoke, local production migration runbook, free-tier constraints, redeploy warning, and no-secret verification commands. Missing an explicit top-level sequential “integrated production smoke run” with evidence fields and pass/fail criteria.
- `.env.example` — variable-name contract for local/dev and production-related names. Already includes runtime `DATABASE_URL`, `DATABASE_SSL`, `DATABASE_POOL_MAX`, auth URL/secret names, `REGISTRATION_ENABLED`, R2 names, and migration-only `PRODUCTION_*` names.
- `package.json` — relevant scripts: `build`, `lint`, `check:language`, `db:generate`, `db:migrate`, `db:migrate:production`. No existing production smoke script.
- `scripts/migrate.ts` + `scripts/migration-config.ts` — S02 production migration command. Emits sanitized JSON line events and uses exit code 1 for validation failures / 2 for runtime migration failures.
- `app/api/health/route.ts` + `lib/services/health.ts` — deployed readiness surface. Always HTTP 200 JSON with `status: ok|degraded`, DB component (`ok`, `latencyMs`, or safe code), and R2 component (`ok` or missing variable names). Logs sanitized `health_check_completed` fields.
- `lib/db/config.ts` / `lib/db/index.ts` — runtime DB pool configuration; `DATABASE_POOL_MAX` defaults low and caps at 5 (per S01/S02 context).
- `lib/auth/registration.ts`, `lib/actions/auth.ts`, `app/api/auth/[...all]/route.ts` — registration disabled behavior. Direct disabled signup path is exact `POST /api/auth/sign-up/email` and returns 403 `{ error: { code: 'registration_disabled', message } }`; signin/session routes remain delegated.
- `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx` — UI selectors/copy for browser smoke: headings `Accedi`, `Crea account`; inputs are named `email`/`password` with placeholders `Email`/`Password`; submit buttons `Accedi`/`Registrati`.
- `tests/import.spec.ts` — local/mocked import Playwright coverage. Uses `PLAYWRIGHT_BASE_URL` via `playwright.config.ts`; many tests are local-safe, but DB/R2 analyze tests are fixme and there is no authenticated live production import spec.
- `tests/auth.spec.ts` — mostly stale `test.fixme()` placeholders for auth happy paths; only unauthenticated `/dashboard` redirect is active. Do not rely on this as production auth proof without updating or adding a separate smoke spec.
- `tests/health.test.ts`, `tests/migration-config.test.ts`, `tests/r2.test.ts`, `tests/upload-put.test.ts`, `tests/import-api.test.ts`, `tests/auth-actions-registration.test.ts`, `tests/auth-route-registration.test.ts` — dependency slice contract tests already used for closeout.
- `scripts/set-r2-cors.mjs` — existing helper but **watch out**: it sets wildcard origins and includes `Content-Length`/AWS checksum headers, which conflicts with S03’s current docs that production CORS should be origin-specific and only allow the safe browser upload header contract (`Content-Type`). Either update it, document it as legacy/dev-only, or avoid it in S05 instructions.
- `playwright.config.ts` — supports deployed smoke by setting `PLAYWRIGHT_BASE_URL`; when absent it starts local dev server.

### Existing observability/safe diagnostics

- Migration CLI emits JSON line `migration_started`, `migration_succeeded`, and `migration_failed` without raw DB URL/password/stacks.
- `/api/health` distinguishes DB missing config, DB timeout/unreachable, and R2 missing env names without exposing values.
- Browser direct-to-R2 upload emits sanitized `upload-put-diagnostic` CustomEvents and must not include presigned URLs/object keys/secrets/file contents.
- Registration disabled direct API response has stable `registration_disabled` code and no request body echo.

## Natural seams for planning

1. **Runbook/doc seam** — `docs/deploy/vercel-supabase-r2.md` only. Add ordered integrated checklist, evidence table, failure decision tree, free-tier limits, and “do not paste secrets” guardrails. Independent from code if no script changes.
2. **Smoke script/spec seam** — new `scripts/production-smoke.mjs` or `tests/production-smoke.spec.ts` plus optional `package.json` script. Should depend only on deployed URL/test account env names and never print secret values. Independent from docs but should be referenced by docs.
3. **Legacy CORS helper seam** — `scripts/set-r2-cors.mjs` if chosen. It can be fixed independently to take an explicit allowed origin env var and not print bucket/account config or use wildcard production CORS.
4. **Evidence capture seam** — GSD summary/markdown artifact under S05, plus requirement updates. This should happen after live or simulated verification runs.

## First proof / highest-risk unblocker

The highest-risk proof is **real deployed health + R2 import**, because unit tests already cover migration guardrails and registration route logic, but only the deployed environment proves:

- Vercel env values actually propagated after redeploy.
- Supabase runtime connection works from serverless functions.
- R2 CORS permits the deployed HTTPS origin for browser PUT.
- Better Auth URLs/cookies work with the production origin.
- The small upload reaches `/import/<fileId>/analyze` with a real R2 object and DB `file` row.

For implementation ordering, first make the runbook/smoke harness able to verify `/api/health` against a `PRODUCTION_ORIGIN`/`PLAYWRIGHT_BASE_URL`, then add auth/import live checks. Health is the smallest deployed proof and unblocks diagnosing the rest.

## Verification plan

### Static/local regression commands

Run after doc/script/spec changes:

```bash
yarn vitest tests/migration-config.test.ts tests/health.test.ts tests/r2.test.ts tests/upload-put.test.ts tests/import-api.test.ts tests/registration-config.test.ts tests/auth-actions-registration.test.ts tests/auth-route-registration.test.ts
yarn playwright test tests/import.spec.ts
yarn lint
yarn check:language
yarn build
```

If adding a smoke script/spec, include a local dry-run/missing-env check that exits with a clear safe message and no secrets.

### Live/operator commands and checks

Use only when production URL and secrets/test credentials are available securely:

```bash
# Local migration, with PRODUCTION_* env set outside docs/logs.
yarn db:migrate:production

# Health should be no-secret JSON.
curl --fail --silent --show-error https://<production-origin>/api/health

# Browser smoke against deployed app.
PLAYWRIGHT_BASE_URL=https://<production-origin> yarn playwright test <production-smoke-spec>
```

Registration disabled direct API smoke can be implemented with `fetch`/`curl` using disposable test credentials, but outputs must record only HTTP status and `error.code`, not email/password/body/cookies.

### Pass criteria for S05 evidence

- Migration command exits 0 or, if no migrations are pending, reports sanitized success. Any failure has safe `error.code` only.
- `/api/health` returns HTTP 200; `status` is `ok` for final pass or `degraded` with safe component code/missing names for diagnostic evidence.
- With registration enabled, UI signup/login can reach authenticated app (e.g. `/dashboard`).
- With `REGISTRATION_ENABLED=false` + redeploy, new signup is blocked; direct `POST /api/auth/sign-up/email` returns 403 `registration_disabled`; existing user login still reaches authenticated app.
- Small CSV import from the deployed browser flow reaches `/import/<fileId>/analyze`; no browser diagnostics or visible output contain presigned URLs, object keys, credentials, file contents, or stacks.
- Docs explicitly record free-tier limits/constraints and operational recovery steps.

## Risks, constraints, and watch-outs

- **Live access may be unavailable.** Do not mark final integrated acceptance as complete unless live Vercel/Supabase/R2 evidence exists in this slice.
- **Do not create a migration API route.** M007 intentionally uses local manual migrations, not deploy-time or HTTP-triggered migrations.
- **Do not use `drizzle-kit push` in production.** Only reviewed generated migrations + `yarn db:migrate:production`.
- **Keep migration env separate from runtime env.** `PRODUCTION_DATABASE_URL` is local migration-only; Vercel runtime uses `DATABASE_URL`.
- **R2 CORS helper drift.** `scripts/set-r2-cors.mjs` currently conflicts with S03’s origin-specific, `Content-Type`-only production policy. Fix or avoid it before recommending it in the runbook.
- **Auth Playwright tests are stale.** `tests/auth.spec.ts` is mostly fixme; add a dedicated smoke spec rather than assuming auth browser coverage exists.
- **No broad production CORS.** Production R2 CORS should use the real HTTPS origin, `PUT`, and `Content-Type`; avoid `*` convenience.
- **No secret output.** Never print DB URLs, auth secrets, R2 keys, presigned URLs, cookies, request bodies, passwords, raw SDK/driver errors, or stack traces.
- **Untracked `test-results/` exists** in working tree from previous runs; do not include it in S05 changes unless intentionally managing artifacts.

## Skill discovery

Installed/relevant skills from the prompt:

- `write-docs` — useful for making the runbook understandable to a fresh operator.
- `observability` — useful for preserving safe diagnostic surfaces and evidence shape.
- `agent-browser` — useful if the executor performs live browser smoke against Vercel.
- `verify-before-complete` — should be used before claiming S05/milestone completion.

External skill discovery was run for core services:

- `npx skills find "Vercel deployment"` — no skills found.
- `npx skills find "Supabase Postgres"` — no skills found.
- `npx skills find "Cloudflare R2"` — no skills found.

No additional installable service-specific skills were identified.

## Sources inspected

- `.gsd/REQUIREMENTS.md`
- `.gsd/milestones/M007/M007-ROADMAP.md` and preloaded M007 context
- S02/S03/S04 summaries preloaded in the auto-mode context
- `docs/deploy/vercel-supabase-r2.md`
- `.env.example`
- `package.json`
- `playwright.config.ts`
- `scripts/migrate.ts`
- `scripts/set-r2-cors.mjs`
- `app/api/health/route.ts`
- `lib/services/health.ts`
- `app/api/auth/[...all]/route.ts`
- `lib/actions/auth.ts`
- `app/(auth)/login/page.tsx`
- `app/(auth)/register/page.tsx`
- `tests/import.spec.ts`
- `tests/auth.spec.ts`
- `tests/health.test.ts`
- `tests/auth-route-registration.test.ts`
