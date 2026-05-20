# Sparter — Project Guide

Personal finance app for the Italian market. Rebuilt from the previous Express + Sequelize application into Next.js 16 App Router + Drizzle ORM.

## Quick reference

| | |
|---|---|
| **Developer** | Andrea — Senior Full-Stack / Tech Lead. Personal rules: **`.claude/developer-profile.md`** (read every session; portable to other repos). |
| **Communication** | Answer first, no filler. Depth = senior peer. Uncertainty explicit. Writing style in developer-profile. |
| **Engineering** | Ask don't assume · simplest first · scoped diffs only · flag low confidence before proceeding |
| **Decisions** | Outside GSD: 2–3 approaches, wait for choice. GSD execute: follow locked `*-PLAN.md`; no re-open between tasks. |
| **GSD entry** | `/gsd-quick` · `/gsd-debug` · `/gsd-execute-phase` before substantive edits unless bypass requested. |
| **Hard rules** | Decimal.js for money · import in `db.transaction` · R2 presigned PUT · no `drizzle-kit push` in prod · `dal` / `services` / `actions` · dev English, IT product surfaces · `CONTEXT.md` for domain terms |
| **Session memory** | Read `MEMORY.md` + `ERRORS.md` at start. Decisions → `MEMORY.md`; wrap-up on "session end" / "wrapping up"; retries → `ERRORS.md`. |
| **Planning** | `.planning/PROJECT.md`, `REQUIREMENTS.md`, `phases/` · `CONTEXT.md` (domain language) |

Detail: sections below.

## Developer rules (portable)

**Mandatory every session:** read and apply `.claude/developer-profile.md` (agent conduct, profile, writing style).

That file is **project-agnostic**. Copy it to other repositories as `.claude/developer-profile.md` and reference it from each project's `CLAUDE.md`. Sparter-specific content stays **only in this file**.

## Permanent project constraints

These facts are always true for this project. Apply them to every session without exception. If any task conflicts with one of these, flag it before proceeding.

- **Next.js 16** — APIs and conventions may differ from older Next.js; read `node_modules/next/dist/docs/` before framework changes; heed deprecation notices.
- **Monetary amounts** — never use native JS arithmetic (`+`, `-`, `*`, `/`); use `Decimal.js` via `@/lib/utils/decimal`. Drizzle `DECIMAL` columns are strings.
- **Imports** — full `importFile()` runs inside `db.transaction`; write helpers accept `DbOrTx`.
- **Uploads** — browser → R2 via presigned PUT only; never proxy file bytes through Server Actions or Route Handlers.
- **Auth** — Better Auth + Drizzle `pg` adapter; `proxy.ts` does session checks only (no DB in edge runtime).
- **Migrations** — `drizzle-kit generate` + `scripts/migrate.ts`; never `drizzle-kit push` in production.
- **Layers** — queries in `lib/dal/`, business logic in `lib/services/`, thin `"use server"` in `lib/actions/`.
- **Language** — developer-facing code and docs in English; Italian only for intentional product/domain surfaces (see Language Convention below). Run `yarn check:language` when touching routes, comments, tests, or developer strings.
- **Domain terms** — for dashboard, categorization, or import work, read `CONTEXT.md` and use its vocabulary (e.g. Transaction vs Expense, Deviation vs delta, Reference Period).

Details and examples: Non-Negotiable Rules, Directory Structure, and Subscription Feature Gates below.

## Planning Artifacts

- `.planning/PROJECT.md` — project vision and current state
- `.planning/REQUIREMENTS.md` — explicit capability contract and validation status
- `.planning/phases/` — phase plans, context, research, summaries
- `CONTEXT.md` — canonical domain language (dashboard, categorization, imports)
- `docs/init/` — legacy bootstrap material from the original application (e.g. business logic handoff)
- `scripts/seed-data.ts` — canonical seed dataset (categories, platforms, regex patterns)

## GSD Workflow

This project uses GSD (Get Shit Done) for planning and execution.

```sh
/gsd status              # Check current state and next work
/gsd plan                # Plan the next unit of work
/gsd auto                # Execute planned work through the GSD lifecycle
```

**Workflow enforcement:** Before substantive repo edits (`Edit`, `Write`, refactors, new features), start through a GSD entry point unless the user explicitly asks to bypass planning:

- `/gsd-quick` — small fixes, doc updates, ad-hoc tasks
- `/gsd-debug` — investigation and bug fixing
- `/gsd-execute-phase` — planned phase work from `*-PLAN.md`

Decisions belong in discuss/plan artifacts (`*-CONTEXT.md`, `*-PLAN.md`); execution follows locked plans without re-negotiating approach per task (see developer-profile, agent conduct rule 3).

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
- public route paths use English slugs (`/expenses`, `/transactions`, `/settings/categories`)
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

scripts/seed.ts      # Operator seed runner (PRODUCTION_* via scripts/db-config.ts)
scripts/seed-data.ts # System taxonomy rows for seed
drizzle/migrations/  # Generated SQL migrations only
proxy.ts             # Route protection and staging bypass
auth.ts              # Better Auth configuration
```

## Seed Data

`scripts/seed-data.ts` (canonical) and `scripts/seed.ts` contain:

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
