# Technology Stack — Sparter

**Project:** Sparter (personal finance web app, Italian market)
**Updated:** 2026-04-27
**Stack status:** Locked for v1

---

## Stack Overview

| Layer | Choice | Status |
|-------|--------|--------|
| Framework | Next.js 16 App Router | Locked |
| Runtime UI | React 19 | Locked |
| ORM | Drizzle ORM + drizzle-kit | Locked |
| Database | PostgreSQL | Locked |
| DB driver | `pg` via `drizzle-orm/node-postgres` | Locked |
| Auth | Better Auth + Drizzle adapter provider `pg` | Locked |
| Storage | Cloudflare R2 via `@aws-sdk/client-s3` | Locked |
| Validation | Zod v4 | Locked |
| Monetary math | Decimal.js | Locked |
| UI | Tailwind CSS + shadcn/ui | Locked |
| Deployment | Railway-compatible Node.js runtime | Locked |

---

## Package Baseline

Current package choices:

```json
{
  "next": "16.2.4",
  "react": "19.2.5",
  "react-dom": "19.2.5",
  "drizzle-orm": "^0.45.2",
  "pg": "^8.20.0",
  "better-auth": "^1.6.9",
  "zod": "^4.3.6",
  "decimal.js": "^10.6.0",
  "@aws-sdk/client-s3": "^3.1037.0",
  "@aws-sdk/s3-request-presigner": "^3.1037.0"
}
```

Dev/runtime support:

```json
{
  "drizzle-kit": "^0.31.10",
  "eslint": "^10",
  "eslint-config-next": "16.2.4",
  "@types/pg": "^8.20.0",
  "tsx": "^4.21.0",
  "typescript": "^6"
}
```

Package manager:

```json
{
  "packageManager": "yarn@4.14.1"
}
```

Yarn Berry uses `nodeLinker: node-modules` for compatibility with Next.js, Drizzle, generator CLIs, and local IDE tooling.

`mysql2` is no longer part of the stack. Do not add `drizzle-orm/mysql2` or `drizzle-orm/mysql-core` imports.

---

## Database Integration Pattern

Create the database client once at module scope in `lib/db/index.ts`:

```ts
import 'server-only'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 10,
  ssl:
    process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: true }
      : undefined,
})

export const db = drizzle(pool, { schema })
```

Local example:

```bash
DATABASE_URL=postgres://postgres:sparter@localhost:5432/sparter
```

Hosted Postgres with strict TLS:

```bash
DATABASE_SSL=true
DATABASE_URL=postgres://user:password@host:5432/database
```

Do not instantiate a new Pool inside route handlers, server actions, DAL functions, or React components. Hot reload and concurrent requests can otherwise leak connections.

---

## Drizzle Schema Pattern

Use `drizzle-orm/pg-core`:

```ts
import {
  pgTable,
  pgEnum,
  text,
  varchar,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'
```

Better Auth tables currently live in `lib/db/schema.ts`:

- `user`
- `session`
- `account`
- `verification`

Custom feature-gate fields:

- `subscriptionPlan`: `subscription_plan` enum, default `free`
- `role`: `user_role` enum, default `user`

Timestamps use `timestamp(..., { withTimezone: true })` so generated SQL is `timestamp with time zone`.

---

## Better Auth Pattern

Better Auth is configured in root `auth.ts`:

```ts
database: drizzleAdapter(db, {
  provider: 'pg',
})
```

Important constraints:

- `nextCookies()` remains in `plugins`.
- `subscriptionPlan` and `role` are `additionalFields` with `input: false`.
- Client components import only `lib/auth-client.ts`; never import `auth.ts`.
- Server code can use `auth.api.*` and DAL helpers.

---

## Migrations

Never use `drizzle-kit push` in production or shared environments.

Use:

```bash
npm run db:generate
npm run db:migrate
```

`npm run db:generate` runs `drizzle-kit generate` and writes SQL to `drizzle/migrations/`.

`npm run db:migrate` runs `scripts/migrate.ts`, which uses `drizzle-orm/node-postgres/migrator` and a `pg` Pool.

If `DATABASE_URL` is unavailable, generation can still run, but applying migrations must wait until a reachable Postgres URL exists.

---

## Runtime Constraints

- Next.js 16 uses `proxy.ts`, not `middleware.ts`.
- `proxy.ts` should stay lightweight: staging bypass + Better Auth session redirect logic.
- Any file importing `lib/db/index.ts` is server-only.
- Do not import `lib/db/index.ts`, `auth.ts`, `pg`, or Drizzle server modules from Client Components.

---

## Persistent Project Rules

- Monetary arithmetic: never use JS native arithmetic for money. Use Decimal.js utilities.
- Drizzle `DECIMAL` values should be treated as strings and passed directly to `Decimal`.
- File uploads go browser → presigned R2 PUT URL. Do not proxy file bytes through Next.js.
- CSV import must remain transactional: `db.transaction(async (tx) => { ... })`; helpers accept `DbOrTx`.
- Zod v4 uses `z.email()` and `{ error: '...' }`.

---

## References To Re-check Before Major Upgrades

- Next.js local docs in `node_modules/next/dist/docs/`
- Drizzle ORM docs/changelog for Postgres migrations
- Better Auth Drizzle adapter docs for provider-specific schema changes
- `pg` Pool SSL options for the chosen hosting provider
