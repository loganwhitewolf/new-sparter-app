# S01 — Research: Logger Pino + Better Stack

**Date:** 2026-05-04

## Summary

Slice S01 owns R001 (structured Pino logger), R005 (automatic server-side `userId` context), and R006 (optional Better Stack sink). The codebase currently has no `lib/logger.ts`, no Pino dependencies in `package.json`/`yarn.lock`, and no `console.*` calls in the critical upload areas found by scan (`lib/services/r2.ts`, `app/api/files/*`, `components/import/*`). This slice is therefore mostly greenfield infrastructure plus env documentation and unit tests; S02/S03 will consume the logger.

The important seam is to separate logger configuration from request context. Pino’s `mixin` is synchronous, while Better Auth session lookup via `headers()`/`auth.api.getSession()` is async. Use `AsyncLocalStorage` for sync context reads inside `mixin`, and expose a helper that establishes the context around a route handler/service call after resolving the session once. Do not make every log call query Better Auth.

## Recommendation

Create `lib/logger.ts` as a server-only singleton Pino logger with a small config-builder API for tests. Install `pino` and `@logtail/pino` as runtime dependencies and `pino-pretty` as a dev dependency. Use pretty output only in development; use plain Pino JSON stdout in production when no Better Stack token exists; when `BETTERSTACK_SOURCE_TOKEN` exists, add the Better Stack transport while preserving stdout JSON via a multi-target transport.

Recommended exported surface for planners/executors:

- `logger` — singleton with standard Pino methods (`info`, `warn`, `error`, `debug`, etc.).
- `withLogContext<T>(context, fn)` — low-level `AsyncLocalStorage.run()` wrapper.
- `withUserId<T>(fn, extraContext?)` — server helper that resolves Better Auth session from `headers()`, stores `{ userId }` when available, and runs `fn`; it must not throw just because there is no session.
- `getLogContext()` — useful for tests and for S02/S03 if needed.
- optionally `createLoggerOptions(env)` / `buildTransportConfig(env)` — pure helpers so unit tests can verify dev/prod/Better Stack behavior without spawning Pino transports.

Use the observability skill rule “log decisions, not activity”: S01 should not add noisy request logs. It should provide the foundation and tests; S02 should log upload decision/failure points (`initiate`, R2 service throws, `confirm`).

## Implementation Landscape

### Key Files

- `package.json` — currently lacks `pino`, `pino-pretty`, and `@logtail/pino`. Add with Yarn 4 (`yarn add pino @logtail/pino`; `yarn add -D pino-pretty`). There is no test script, but existing tests are run directly through Vitest.
- `lib/logger.ts` — new file. Should import `server-only`, `pino`, `AsyncLocalStorage` from `node:async_hooks`, `headers` from `next/headers`, and `auth` from `@/auth`. Keep Better Stack token values out of logs.
- `auth.ts` — Better Auth instance already exports `auth`; `auth.api.getSession({ headers })` is the direct session lookup used by `lib/dal/auth.ts`. The logger helper can use the same API but should not redirect on missing session.
- `lib/dal/auth.ts` — existing `verifySession()` redirects on unauthenticated users and supports staging headers. Do not call it from logger context setup unless a throwing/redirecting helper is desired. For optional logging context, use `auth.api.getSession()` directly and optionally mirror the staging-header branch if S02 needs staging `userId` in logs.
- `next.config.ts` — currently empty. Next 16 docs list `pino`, `pino-pretty`, and `thread-stream` in the built-in `serverExternalPackages` list, so a config change is probably not required. If executor hits bundling/worker issues, add explicit `serverExternalPackages: ['pino', 'pino-pretty', '@logtail/pino']`.
- `.env.example` — currently documents DB and Better Auth only. Add `BETTERSTACK_SOURCE_TOKEN=` and, if used, optional `BETTERSTACK_INGESTING_URL=https://in.logs.betterstack.com` (Better Stack docs require an ingesting host; milestone acceptance only requires the source token to activate logging, so provide a safe default in code).
- `tests/logger.test.ts` (new) — unit tests for exported methods, ALS context propagation into log records or config/mixin, dev pretty config, production JSON/no-token behavior, Better Stack target activation when token is set, and graceful no-session behavior if tested with mocks.
- `app/api/files/initiate/route.ts`, `app/api/files/confirm/route.ts`, `lib/services/r2.ts` — consumers for S02, not primary S01 implementation. They already run on `nodejs` runtime and have structured R2 errors that S02 can log with `logger.error({ userId, stage, ... })`.

### Build Order

1. Add dependencies and lockfile updates first, then verify TypeScript can resolve Pino/Logtail types.
2. Implement pure logger config helpers before the singleton. This lets tests assert environment-specific behavior without starting worker-thread transports.
3. Implement `AsyncLocalStorage` context helpers and wire Pino `mixin` to include stored context in each log line. Keep `mixin` synchronous.
4. Implement singleton creation with environment rules:
   - `NODE_ENV === 'development'`: `pino-pretty` target to stdout, colorized, ignore `pid,hostname`, `translateTime` enabled.
   - no Better Stack token: no Better Stack target; in production Pino default JSON stdout is enough.
   - token present: include `@logtail/pino` target with `{ sourceToken, options: { endpoint } }`; preserve stdout JSON using a `pino/file` target with `destination: 1` if using multi-target mode.
5. Update `.env.example`.
6. Add unit tests.

### Verification Approach

- `yarn vitest run tests/logger.test.ts` — targeted unit coverage for S01.
- `yarn tsc --noEmit` or `yarn next build --webpack` if no standalone typecheck script exists. The project’s build script already mocks Google font responses.
- `yarn lint` — should pass after new imports/config.
- Manual smoke during execution (optional but useful): run a tiny server-side script or test logger call with `NODE_ENV=development` and confirm pretty output; with `BETTERSTACK_SOURCE_TOKEN=dummy`, assert config selects `@logtail/pino` without printing the token.

## Don’t Hand-Roll

| Problem | Existing Solution | Why Use It |
|---------|------------------|------------|
| Structured logging and levels | `pino` | Fast JSON logger with standard `info/warn/error/debug` API and serializers. |
| Readable dev logs | `pino-pretty` transport | Official pretty-printer; supports color, timestamp translation, and ignoring noisy fields. |
| Better Stack ingestion | `@logtail/pino` | Better Stack’s documented Pino v7+ transport; avoids custom HTTP batching/retry code. |
| Per-request context propagation | Node `AsyncLocalStorage` | Synchronous context access from Pino `mixin` after one async session lookup at the request boundary. |

## Constraints

- Project uses Next.js 16 App Router. The project instruction says to read relevant docs in `node_modules/next/dist/docs/` before writing code. Relevant doc checked: `serverExternalPackages.md`; Next already externalizes `pino`, `pino-pretty`, and `thread-stream`.
- Existing API upload routes explicitly set `export const runtime = 'nodejs'`; Pino/AsyncLocalStorage should stay server-only and Node-runtime only. Do not import `lib/logger.ts` into client components.
- `pino` transport options are passed to worker threads and must be structured-clone compatible. Do not put functions in transport options.
- Pino multi-target routing depends on the numeric `level` field. Avoid custom `formatters.level` that renames/removes `level` if using multiple targets.
- Pino `mixin` is synchronous. User/session resolution must happen before logging via ALS, not inside `mixin`.
- `verifySession()` redirects when unauthenticated. Logger context should be optional and non-invasive; avoid redirect side effects from logging helpers.
- Secrets: never log `BETTERSTACK_SOURCE_TOKEN`, `R2_SECRET_ACCESS_KEY`, `R2_ACCESS_KEY_ID`, auth secrets, or presigned URL query parameters. S02 may log object keys and bucket names, but should avoid full signed URLs.

## Common Pitfalls

- **Spawning worker transports in unit tests** — config tests can inspect pure objects; singleton tests should run under `NODE_ENV=test` with no pretty/Logtail transport, or mock Pino.
- **Assuming Better Stack token alone always identifies the ingest host** — Better Stack docs show both source token and ingesting host. To satisfy the milestone’s “token activates without code change,” default endpoint to `https://in.logs.betterstack.com` and allow override via `BETTERSTACK_INGESTING_URL`.
- **AsyncLocalStorage context not wrapping the whole async operation** — S02 route handlers must call logger-consuming service code inside `withUserId`/`withLogContext`; setting context after calling services will not affect downstream logs.
- **Client bundle leaks** — `lib/logger.ts` imports server-only modules; keep it out of `components/import/import-uploader.tsx`. Client-side retry logs in S02 should remain browser `console.*` or a separate client helper, per R030 out-of-scope.

## Open Risks

- `@logtail/pino` behavior under Next 16 build/runtime should be verified once dependencies are installed. If worker transport bundling fails despite Next’s external package list, explicitly add it to `serverExternalPackages` and keep routes on `nodejs` runtime.
- The exact helper name/signature in the roadmap says `withUserId(ctx)`, while the clean TypeScript shape is likely `withUserId(fn, extraContext?)` or `withUserId(context, fn)`. Planner should lock this API before S02 consumes it.

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| Observability | installed `observability` skill | Used for research framing: log decisions, not activity; avoid silent catches; verify signals. |
| Pino | `andrelandgraf/fullstackrecipes@pino-logging-setup` (110 installs), `oakoss/agent-skills@pino-logging` (58 installs) | Available, not installed. Current docs were enough; no install recommended unless executor wants examples. |
| Better Stack | `membranedev/application-skills@better-stack` (76 installs) | Available, not installed. Useful if Better Stack setup/debugging becomes deeper than this slice. |
| Better Auth | `better-auth/skills@better-auth-best-practices` (45.3K installs) | Available, not installed. Not necessary for S01 unless auth/session behavior changes. |

## Sources

- Pino transports can use single or multiple targets, with per-target levels and structured-clone-compatible options (source: Context7 `/pinojs/pino`, “Configure Pino.js Transports for Performance”).
- `pino-pretty` is intended as a dev transport and supports `colorize`, `translateTime`, and `ignore: 'pid,hostname'` (source: Context7 `/pinojs/pino-pretty`).
- Better Stack documents `@logtail/pino` with `sourceToken` and `options.endpoint`; Pino v7+ is required (source: [Better Stack Pino transport](https://betterstack.com/docs/logs/javascript/pino/)).
- Better Stack HTTP ingest host commonly uses `https://in.logs.betterstack.com` (source query: “Better Stack logs ingesting host endpoint in.logs.betterstack.com @logtail/pino endpoint”).
- Next.js 16 docs list `pino`, `pino-pretty`, and `thread-stream` as automatically externalized server packages (source: `node_modules/next/dist/docs/02-pages/04-api-reference/04-config/01-next-config-js/serverExternalPackages.md`).