# Sparter — Project Guide

Personal finance app for the Italian market. Rebuilt from the previous Express + Sequelize application into Next.js 16 App Router + Drizzle ORM.

## Planning Artifacts

- `.gsd/PROJECT.md` — project vision and current state
- `.gsd/REQUIREMENTS.md` — explicit capability contract and validation status
- `.gsd/milestones/` — milestone roadmaps, slice plans, summaries, validations, and learnings
- `docs/init/` — legacy bootstrap material from the original application; domain data may remain Italian when it represents product taxonomy or bank-import fixtures

## GSD Workflow

This project uses GSD (Get Shit Done) for planning and execution.

```sh
/gsd status              # Check current state and next work
/gsd plan                # Plan the next unit of work
/gsd auto                # Execute planned work through the GSD lifecycle
```

## Stack

```text
Next.js 16 App Router
Drizzle ORM + PostgreSQL (drizzle-kit for migrations)
Better Auth (auth provider)
Cloudflare R2 (CSV/Excel file storage)
Zod (validation)
Decimal.js (monetary arithmetic — REQUIRED)
Tailwind CSS + shadcn/ui
```

## Language Convention

Developer-facing code and project guidance must be written in English:

- identifiers, route segments, filenames, comments, test names, logs, commit-facing docs, and agent/project rules
- public route paths use English slugs (`/expenses`, `/transactions`, `/settings/patterns`)
- legacy localized URLs may exist only as redirects in `lib/routes.ts` and `next.config.ts`

Italian is allowed only for intentional product/domain surfaces:

- user-facing UI copy for the Italian product
- seeded taxonomy names/slugs and categorization regex patterns
- bank import headers, sample rows, fixture values, and localized validation messages shown to users

Run `yarn check:language` after changes that touch routes, comments, tests, docs, or developer-facing strings.

## Non-Negotiable Rules

### Monetary arithmetic

Never use native JavaScript arithmetic (`+`, `-`, `*`, `/`) on monetary amounts. Always use `Decimal.js` helpers:

```ts
import { toDecimal, toDbDecimal } from '@/lib/utils/decimal'

const result = toDecimal(expense.totalAmount).plus(toDecimal(other.totalAmount))
await db.insert(...).values({ totalAmount: toDbDecimal(result) })
```

### Drizzle DECIMAL

Drizzle returns `DECIMAL(10,2)` as a string, not a number. Pass string values directly to `new Decimal(stringValue)` or the project decimal helpers.

### Atomic imports

The full `importFile()` workflow must run inside `db.transaction(async (tx) => { ... })`. Helpers that participate in import writes should accept `DbOrTx`:

```ts
type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]
```

### File uploads

The browser uploads directly to R2 through a presigned PUT URL. Never proxy upload bytes through Server Actions or Route Handlers.

### Better Auth

- Better Auth replaces NextAuth v5; read the current API before changing authentication work.
- The Drizzle adapter uses provider `pg`; session management, route protection, and custom user fields (`subscriptionPlan`, `role`) are part of the auth boundary.
- Proxy code should perform session checks only; do not run direct DB queries in edge runtime.

### Drizzle migrations

Never use `drizzle-kit push` in production. Always generate SQL migrations and run the migration flow.

## Directory Structure

```text
app/
├── (auth)/          # Public route group
└── (app)/           # Authenticated application shell

lib/
├── db/              # Drizzle client, schema, and migrations
├── dal/             # Data Access Layer (all database queries)
├── services/        # Business logic
├── actions/         # "use server" thin wrappers
├── validations/     # Zod schemas
└── routes.ts        # Canonical app route constants and legacy redirects

drizzle/seed.ts      # Seed data adapted from docs/init/seed.ts
proxy.ts             # Route protection and staging bypass
auth.ts              # Better Auth configuration
```

## Seed Data

`docs/init/seed.ts` and `drizzle/seed.ts` contain:

- 26 categories (IN/OUT/system)
- about 120 subcategories
- 6 banking platforms (General, Satispay, Intesa SP, Intesa SP CC, Revolut, Fineco)
- system regex categorization patterns

Domain values are intentionally Italian because the product taxonomy is Italian. Developer comments and operational logs around the seed flow must stay English.

## Subscription Feature Gates

```text
free:  no auto-categorization
basic: Tier 1 (regex) + Tier 2 (history)
pro:   Tier 1 + Tier 2 + Tier 3 AI (v2 only)
```
