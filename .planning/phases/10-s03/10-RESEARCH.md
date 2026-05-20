# S03 — Research

**Date:** 2026-05-04

## Summary

S03 is a targeted, low-risk slice: add `app/api/health/route.ts` as a Node.js App Router route handler that always returns HTTP 200 JSON with `{ status, timestamp, components: { db, r2 } }`. The route should perform a real PostgreSQL `SELECT 1` through the existing Drizzle/pg connection and a side-effect-free R2 configuration check for the four required variables already used by `lib/services/r2.ts`: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME`.

The only meaningful risk is accidentally making the health endpoint hang behind a slow DB query. Implement the DB probe behind a local timeout (recommended 2.5s) and return `status: "degraded"` when either DB probe or R2 env validation fails. Per the observability skill: log decisions, not activity; emit one structured `health_check_completed` log with status/component booleans, and a warning/error only when degraded. Never log or return env values, connection strings, signed URLs, or secrets.

## Recommendation

Create a small health route with three pure seams: `checkR2Config(env)`, `checkDb({ timeoutMs })`, and `buildHealthResponse(components)`. Keep the endpoint side-effect-free except for the DB ping and one structured log line. Use `NextResponse.json(...)`, `export const runtime = 'nodejs'`, and explicitly add `export const dynamic = 'force-dynamic'` so the health result is request-time even though Next 16 route handlers are not cached by default unless opted in.

Prefer extracting the R2 env-var list/check into `lib/services/r2.ts` (or a tiny new shared helper) rather than duplicating names in the route. `r2.ts` already centralizes R2 configuration at lines 114-123, but `getR2Config` logs and throws as part of upload operations; health needs a pure check that does not construct an S3 client or emit `r2_operation_failed` for a diagnostic-only endpoint.

## Implementation Landscape

### Key Files

- `app/api/health/route.ts` — does not exist yet. Add `GET` handler returning HTTP 200 with the health contract. Suggested response shape:
  ```ts
  {
    status: 'ok' | 'degraded',
    timestamp: new Date().toISOString(),
    components: {
      db: { ok: true, latencyMs: number } | { ok: false, latencyMs: number, error: { code: string, message: string } },
      r2: { ok: boolean, missing: string[] },
    },
  }
  ```
- `lib/db/index.ts` — exports Drizzle `db` from a pg `Pool` (lines 6-15). Use `db.execute(sql`SELECT 1`)` with `sql` from `drizzle-orm`. Consider first checking `DATABASE_URL` presence so missing DB config is explicitly degraded instead of falling through to pg defaults.
- `lib/services/r2.ts` — already knows the required R2 env vars in `getR2Config` (lines 115-123). Add/export a pure helper such as `REQUIRED_R2_ENV_VARS` plus `getMissingR2EnvVars(env = process.env)` and reuse it in `getR2Config` and health.
- `lib/logger.ts` — import `logger` only; no auth/user context is needed for health. Use structured fields such as `{ event: 'health_check_completed', status, dbOk, r2Ok, missingR2EnvVars }`.
- `tests/import-api.test.ts` — useful test pattern for route handlers: mock `server-only`, mock app modules with `vi.hoisted`, dynamic import the route, call handler directly, and assert response JSON/log calls.
- `tests/health.test.ts` or `tests/health-api.test.ts` — add focused unit/integration contract tests for ok, missing R2 vars, DB failure, and DB timeout.
- `.env.example` — currently documents DB and Better Stack only. It may be worth adding blank/documented R2 variables here so a degraded health response is actionable for local developers, though the roadmap only explicitly required Better Stack env docs in S01.
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` and `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — Next 16 docs confirm `app/**/route.ts`, supported `GET`, `NextResponse`/Web response APIs, and route handlers under `app`.

### Build Order

1. Extract/confirm pure R2 env check first. This retires the only duplication risk and gives health tests a deterministic function to assert without touching AWS SDK/R2 clients.
2. Add DB health helper with timeout. Prove it returns degraded for missing `DATABASE_URL`, rejected `db.execute`, and timeout. Use a 2.5s timeout to satisfy the “responds within 3 seconds” acceptance criterion with margin.
3. Add `app/api/health/route.ts` composing DB + R2 results, calculating top-level `status`, returning `NextResponse.json(body)` with default 200, and logging the completed check.
4. Add route tests and then run the targeted health tests, logger/r2 regression tests if `r2.ts` changed, lint, and build.

### Verification Approach

Recommended commands:

- `yarn vitest run tests/health.test.ts tests/r2.test.ts --reporter=verbose` — health contract plus any R2 helper regression coverage.
- `yarn lint` — route/helper style and import ordering.
- `yarn build` — validates Next 16 route handler typing/build behavior.
- Optional local smoke after starting dev server: `curl -s http://localhost:3000/api/health | jq .` and confirm HTTP 200 with `status: "ok"` or `"degraded"` based on local DB/R2 env.

Required behavioral assertions:

- All R2 vars present + DB `SELECT 1` resolves → `status: "ok"`, `components.db.ok: true`, `components.r2.ok: true`, `components.r2.missing: []`.
- Any R2 var missing → HTTP 200, `status: "degraded"`, `components.r2.ok: false`, and `missing` contains only variable names (no values).
- DB query rejects → HTTP 200, `status: "degraded"`, `components.db.ok: false`, sanitized error code/message, logger emits degraded health event.
- DB query never resolves → route responds via timeout path before 3s. In Vitest, use fake timers around the timeout helper or set a tiny injected timeout for the helper-level test.

## Don't Hand-Roll

| Problem | Existing Solution | Why Use It |
|---------|------------------|------------|
| DB ping | Existing Drizzle `db` plus `sql` from `drizzle-orm` | Reuses the project’s pg pool and avoids a second database client/config path. |
| Structured diagnostics | Existing `lib/logger.ts` Pino singleton | Keeps S03 aligned with S01/S02 and Better Stack/stdout activation. |
| R2 config truth | Existing R2 required env list in `lib/services/r2.ts` | Prevents health from drifting from upload behavior. |

## Constraints

- This is Next.js 16.2.4; follow the project rule to read relevant docs before code changes. Route handlers live under `app/**/route.ts`; there cannot be a `page.tsx` at the same segment. Existing API routes set `export const runtime = 'nodejs'`.
- `/api/health` should never call Better Auth or `withUserId`; it is unauthenticated diagnostics and should not perform per-request auth/session work.
- The route must always return HTTP 200 even when degraded. Do not throw/return 500 from DB/R2 failures.
- The 3-second response SLA requires a route-owned timeout; pg/Drizzle may otherwise hang while trying to connect.
- R2 health is only env presence, not a live Cloudflare call. Do not instantiate `S3Client` or call R2 from health.

## Common Pitfalls

- **Duplicating R2 env names** — health could report ok while upload still fails if the lists diverge. Export/reuse a pure env helper from the R2 module or shared config.
- **Leaking secrets** — return/log variable names only (`R2_BUCKET_NAME`), never values, `DATABASE_URL`, R2 keys, or signed URLs.
- **Letting `Promise.race` hide work forever** — a timeout race satisfies the response SLA but the DB query may continue in the background. Keep timeout small and health checks cheap; avoid high-frequency polling until a cancellable pg query pattern is introduced.
- **Over-logging health checks** — a health endpoint may be polled often. Log one compact summary; use warn/error only for degraded results.

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| Observability / health surfaces | `observability` | Installed and used; key rule applied: log decisions, not activity, and expose a cheap side-effect-free health surface. |
| Next.js / React | `react-best-practices` | Installed; not invoked because this is a server route with no React UI. |
| Drizzle ORM | none found via `npx skills find "Drizzle ORM"` | No external skill discovered. |
| Cloudflare R2 | none found via `npx skills find "Cloudflare R2"` | No external skill discovered. |

## Sources

- Next.js 16 route handlers are defined as `route.ts` under `app`, support `GET`, and can use `NextResponse`/Web response APIs (source: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`).
- Next.js 16 `route.ts` file convention and supported methods confirmed, including automatic handling of unsupported methods and optional route config exports (source: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`).