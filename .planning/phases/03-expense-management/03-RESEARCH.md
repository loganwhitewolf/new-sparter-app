# Phase 3: Expense Management - Research

**Researched:** 2026-04-27
**Domain:** Next.js 16 App Router CRUD — Drizzle ORM schema extension, Server Actions, shadcn/ui Table + Dialog, URL-based filter state, floating bulk action bar
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Expense no `amount` field. Fields: title, descriptionHash, subCategoryId, userId, status, notes. Amounts live on Transactions (Phase 5).
- **D-02:** `date` filter operates on `createdAt` (auto-set). No separate "data spesa" field in Phase 3.
- **D-03:** Create/edit form opens in `Dialog` (already installed). No route change. "Nuova spesa" Button in topbar triggers it.
- **D-04:** Form fields: `titolo` (required), `subcategoria` (two-level Select, optional), `note` (Textarea, optional). Submit via Server Action.
- **D-05:** `/spese` uses shadcn `Table` (must be installed). Columns: checkbox, titolo, categoria/subcategoria, status badge, data (createdAt), azioni (DropdownMenu).
- **D-06:** Status badge: emerald for "Categorizzata" (status 2 or 3), amber for "Da categorizzare" (status 1).
- **D-07:** Per-row DropdownMenu (three-dots) with Modifica + Elimina.
- **D-08:** Three filters in toolbar: Categoria (Select), Stato (Select), Periodo (preset Select — "Questo mese", "Ultimi 3 mesi", "Ultimi 6 mesi", "Quest'anno", "Anno scorso").
- **D-09:** Filters use URL search params (`useSearchParams` + `router.push`). Bookmarkable. URL: `/spese?category=ristorazione&status=uncategorized&period=last-month`.
- **D-10:** Checkbox column; floating action bar (FAB) appears when >= 1 row selected. FAB: count + "Categorizza (N)" button.
- **D-11:** "Categorizza (N)" opens a separate Dialog with category/subcategory Select. On confirm: Server Action `bulkCategorize` sets `status=3` and `subCategoryId` for all selected IDs. Selection cleared. Table revalidates.

### Claude's Discretion

- Exact Drizzle schema for Expense (columns, indexes, relations with User/SubCategory)
- Pagination: server-side cursor or offset (cursor recommended for performance)
- Optimistic UI updates (local React state vs Server Action revalidation)
- Error handling and Zod validation messages (Italian)
- DAL structure: `lib/dal/expenses.ts`, `lib/dal/categories.ts`

### Deferred Ideas (OUT OF SCOPE)

- Direct amount on Expense (cash entries) — v2 backlog
- DatePicker range (Calendar + Popover) — preset Select is sufficient; re-evaluate Phase 6
- Tags on transactions — out of scope v1
- Long notes with rich text editor — plain Textarea sufficient
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXP-01 | L'utente può creare, modificare ed eliminare manualmente una expense con titolo, subcategoria e note | Drizzle schema design, Server Actions (createExpense/updateExpense/deleteExpense), Dialog form pattern, Zod validation |
| EXP-02 | L'utente può visualizzare la lista delle expense con filtri per categoria, data e status di categorizzazione | shadcn Table, URL search params filter state, DAL getExpenses with dynamic WHERE, useSearchParams + useTransition |
| EXP-03 | L'utente può selezionare multiple expense e assegnare una categoria in bulk | Checkbox state management in Client Component, floating action bar, bulkCategorize Server Action (batch UPDATE) |
</phase_requirements>

---

## Summary

Phase 3 delivers the manual expense management surface — the first feature users interact with beyond authentication. It introduces three new Drizzle tables (`category`, `sub_category`, `expense`) plus seed data for 26 categories and ~120 subcategories. The expense entity is a semantic container with no monetary amounts: title, optional subcategory assignment, userId, status enum (1/2/3), and notes.

The architecture follows the established DAL pattern from Phase 2: the Server Component page reads expenses via `lib/dal/expenses.ts` with session-scoped queries, Client Components handle interactive state (filters, checkbox selection, dialogs), and Server Actions are thin wrappers that validate → auth-check → mutate → revalidatePath. The UI contract is fully specified in `03-UI-SPEC.md` — the planner must treat that document as a binding implementation specification.

The most complex interaction is the filter system: URL search params power all three filters, making them bookmarkable and SSR-compatible. The floating bulk action bar is a pure Client Component that reads checkbox state via React state lifted into the table component. Bulk categorize is a single Server Action that performs a batch UPDATE with an `inArray` WHERE clause.

**Primary recommendation:** Schema first (Wave 0), then seed data, then DAL, then Server Actions, then the page and its Client Components in the order: filter toolbar → table → modal form → FAB. This order ensures each layer is testable before the next.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Expense list data fetching | API / Backend (Server Component) | Database | `getExpenses()` DAL called directly from async Server Component — no HTTP round-trip |
| Filter state management | Browser / Client | Frontend Server (URL params) | URL search params keep state in the browser; SSR page reads params from `searchParams` prop |
| Category/subcategory data for selects | API / Backend (Server Component) | Database | `getCategories()` DAL returns seeded taxonomy, passed as props to Client Components |
| Create/edit/delete expense | API / Backend (Server Action) | Database | `"use server"` actions: validate (Zod) → verifySession → DAL write → revalidatePath |
| Bulk categorize | API / Backend (Server Action) | Database | Batch UPDATE via `inArray` — Server Action, not a route handler |
| Checkbox selection tracking | Browser / Client | — | React useState in Client Component; no server involvement until bulk confirm |
| Dialog open/close state | Browser / Client | — | Local React state; Radix Dialog portal stays in browser |
| Status badge rendering | Browser / Client (RSC renders) | — | Static presentation; no interactivity needed — can be Server Component leaf |
| URL filter routing | Browser / Client | Frontend Server | `useRouter().push` on filter change; page re-renders with new `searchParams` on server |
| Drizzle schema + migrations | Database / Storage | — | `drizzle-kit generate` + `tsx scripts/migrate.ts` |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.2 [VERIFIED: node_modules] | Schema definition, typed queries | Project-locked; `integer`, `serial`, `numeric`, `pgEnum`, `unique`, `index` all available in `drizzle-orm/pg-core` |
| drizzle-kit | 0.31.10 [VERIFIED: package.json] | Migration generation | Project-locked; `yarn db:generate` → `yarn db:migrate` |
| zod | 4.3.6 [VERIFIED: package.json] | Input validation in Server Actions | Project-locked; syntax: `z.string().min(2, { error: '...' })` |
| next | 16.2.4 [VERIFIED: node_modules] | App Router, Server Components, Server Actions, useSearchParams | Project-locked |
| react | 19.2.5 [VERIFIED: package.json] | useTransition, useState, cache | Project-locked; React 19 Server Actions work with `useActionState` |
| sonner | installed [VERIFIED: node_modules] | Toast notifications | Already in node_modules; not wired in root layout yet — Wave 0 task |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| decimal.js | 10.x [VERIFIED: package.json] | Monetary arithmetic | Not needed in Phase 3 (no amounts), but `toDecimal`/`toDbDecimal` utils must be created per STATE.md blocker note |
| date-fns | not installed [VERIFIED: ls] | Date formatting for `createdAt` display | Use `Intl.DateTimeFormat` or native JS — do NOT install date-fns just for Phase 3 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server Action revalidation | Optimistic update with React state | Revalidation is simpler and correct for this phase; optimistic is Claude's discretion |
| `router.push` for filters | `router.replace` | `replace` avoids polluting browser history — prefer `replace` for filter changes |
| cursor pagination | offset pagination | Cursor is better for large datasets (no COUNT query); Phase 3 caps at 200 rows so either works |

**Installation (Wave 0):**
```bash
npx shadcn@latest add table
```
Sonner Toaster must be added to `app/layout.tsx`:
```tsx
import { Toaster } from 'sonner'
// inside <body>: <Toaster />
```

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (Client Components)
  ExpenseFilters (useSearchParams, router.replace)
  ExpenseTable (useState: selectedIds)
  BulkActionBar (reads selectedIds, triggers bulkCategorize)
  ExpenseFormDialog (useActionState, Server Action)
  BulkCategorizeDialog (useActionState, Server Action)
       |
       | URL navigation (filter change → full page re-render)
       | Server Action call (create/update/delete/bulk)
       |
Next.js 16 App Router
  app/(app)/spese/page.tsx   ← async Server Component
    reads: searchParams.category, searchParams.status, searchParams.period
    calls: getExpenses(userId, filters), getCategories()
    renders: <ExpenseFilters />, <ExpenseTable />, <ExpenseFormDialog />
       |
       | DAL calls (server-only)
       |
lib/dal/expenses.ts         → PostgreSQL: SELECT expenses + LEFT JOIN sub_category + category
lib/dal/categories.ts       → PostgreSQL: SELECT categories + sub_categories (seeded)
lib/actions/expenses.ts     → Zod validate → verifySession → DAL write → revalidatePath('/spese')
       |
PostgreSQL (Drizzle)
  category, sub_category (seeded, read-only in Phase 3)
  expense (CRUD by userId)
```

### Recommended Project Structure

```
app/
└── (app)/
    └── spese/
        └── page.tsx              # async Server Component — expense list

lib/
├── db/
│   └── schema.ts                 # ADD: category, sub_category, expense tables + enums + relations
├── dal/
│   ├── expenses.ts               # NEW: getExpenses(), getExpenseById()
│   └── categories.ts             # NEW: getCategories() — returns categories with sub_categories
├── services/
│   └── (none in Phase 3)         # no multi-step business logic needed
├── actions/
│   └── expenses.ts               # NEW: createExpense, updateExpense, deleteExpense, bulkCategorize
└── validations/
    └── expense.ts                # NEW: CreateExpenseSchema, UpdateExpenseSchema, BulkCategorizeSchema

components/
├── expenses/
│   ├── expense-table.tsx         # Client Component — table + checkbox state
│   ├── expense-filters.tsx       # Client Component — category/status/period selects
│   ├── expense-form-dialog.tsx   # Client Component — create/edit modal
│   ├── bulk-action-bar.tsx       # Client Component — FAB (fixed position)
│   └── bulk-categorize-dialog.tsx  # Client Component — category picker + confirm
└── ui/
    └── table.tsx                 # TO INSTALL via shadcn

drizzle/
├── migrations/                   # generated SQL from db:generate
└── seed.ts                       # NEW: seed categories + sub_categories from docs/init/seed.ts

lib/utils/
└── decimal.ts                    # NEW: toDecimal(), toDbDecimal() — STATE.md blocker
```

### Pattern 1: Drizzle Schema Extension (Expense Tables)

**What:** Add `expenseStatusEnum`, `category`, `sub_category`, `expense` tables to `lib/db/schema.ts`. No separate file — everything stays in the single schema module the project already uses.
**When to use:** Any time a new domain entity is needed.

```typescript
// Source: lib/db/schema.ts pattern [VERIFIED: existing codebase] + drizzle-orm 0.45.2 API
import {
  pgTable, pgEnum, text, varchar, integer, serial,
  timestamp, index, unique,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { user } from './schema' // existing user table

export const categoryTypeEnum = pgEnum('category_type', ['in', 'out', 'system'])

export const expenseStatusEnum = pgEnum('expense_status', ['1', '2', '3', '4'])

export const category = pgTable('category', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  type: categoryTypeEnum('type').notNull(),
  displayOrder: integer('display_order').default(0),
  isActive: boolean('is_active').default(true).notNull(),
}, (table) => [
  index('category_slug_idx').on(table.slug),
  index('category_type_idx').on(table.type),
])

export const subCategory = pgTable('sub_category', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').notNull().references(() => category.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  displayOrder: integer('display_order').default(0),
  isActive: boolean('is_active').default(true).notNull(),
}, (table) => [
  index('sub_category_categoryId_idx').on(table.categoryId),
  unique('sub_category_category_slug_unique').on(table.categoryId, table.slug),
])

export const expense = pgTable('expense', {
  id: text('id').primaryKey(), // nanoid() — consistent with Better Auth user.id
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 120 }).notNull(),
  descriptionHash: varchar('description_hash', { length: 64 }),
  subCategoryId: integer('sub_category_id').references(() => subCategory.id, { onDelete: 'set null' }),
  status: expenseStatusEnum('status').notNull().default('1'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index('expense_userId_idx').on(table.userId),
  index('expense_userId_status_idx').on(table.userId, table.status),
  index('expense_userId_createdAt_idx').on(table.userId, table.createdAt),
  index('expense_subCategoryId_idx').on(table.subCategoryId),
])
```

**Critical note on `expense.id`:** Use `nanoid()` (consistent with Better Auth `user.id` which is `text` primary key), not `serial`. This avoids integer overflow and is consistent with the existing schema convention. Import `nanoid` or use `crypto.randomUUID()` in the DAL insert.

### Pattern 2: DAL with Filters

**What:** `getExpenses()` accepts a filter object, builds a WHERE clause dynamically using Drizzle's `and()` + `eq()` + `gte()`/`lte()` operators.
**When to use:** Any list page with server-side filtering.

```typescript
// Source: ARCHITECTURE.md DAL pattern [VERIFIED: existing codebase]
// lib/dal/expenses.ts
import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'
import { expense, subCategory, category } from '@/lib/db/schema'
import { eq, and, gte, lte, or, isNull } from 'drizzle-orm'
import { verifySession } from '@/lib/dal/auth'

type ExpenseFilters = {
  categorySlug?: string
  status?: 'uncategorized' | 'categorized'
  period?: 'this-month' | 'last-3-months' | 'last-6-months' | 'this-year' | 'last-year'
}

export const getExpenses = cache(async (filters: ExpenseFilters = {}) => {
  const { userId } = await verifySession()
  const { from, to } = periodToDateRange(filters.period ?? 'this-month')

  const conditions = [
    eq(expense.userId, userId),
    gte(expense.createdAt, from),
    lte(expense.createdAt, to),
  ]
  if (filters.status === 'uncategorized') conditions.push(eq(expense.status, '1'))
  if (filters.status === 'categorized') conditions.push(or(eq(expense.status, '2'), eq(expense.status, '3'))!)

  return db
    .select({
      id: expense.id,
      title: expense.title,
      status: expense.status,
      notes: expense.notes,
      createdAt: expense.createdAt,
      subCategoryId: expense.subCategoryId,
      subCategoryName: subCategory.name,
      categoryName: category.name,
      categorySlug: category.slug,
    })
    .from(expense)
    .leftJoin(subCategory, eq(expense.subCategoryId, subCategory.id))
    .leftJoin(category, eq(subCategory.categoryId, category.id))
    .where(and(...conditions))
    .orderBy(desc(expense.createdAt))
    .limit(200)
})
```

**Category filter:** The `category` filter operates on `category.slug` (from join). Add `eq(category.slug, filters.categorySlug)` to conditions when present. Note: expenses with no subCategory assigned will have `category.slug = null` — a category filter naturally excludes uncategorized expenses.

### Pattern 3: Server Action (thin wrapper)

**What:** Actions validate with Zod, call `verifySession()`, write via DAL, then `revalidatePath`. No business logic inside actions.
**When to use:** Every mutation triggered from Client Component.

```typescript
// Source: lib/actions/auth.ts pattern [VERIFIED: existing codebase]
// lib/actions/expenses.ts
'use server'
import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal/auth'
import { CreateExpenseSchema } from '@/lib/validations/expense'
import { insertExpense } from '@/lib/dal/expenses'

type ActionState = { error: string | null }

export async function createExpense(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = CreateExpenseSchema.safeParse({
    title: formData.get('title'),
    subCategoryId: formData.get('subCategoryId') ? Number(formData.get('subCategoryId')) : undefined,
    notes: formData.get('notes') || undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  const { userId } = await verifySession()
  await insertExpense({ ...parsed.data, userId })
  revalidatePath('/spese')
  return { error: null }
}
```

**bulkCategorize pattern:**
```typescript
export async function bulkCategorize(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { userId } = await verifySession()
  const ids = JSON.parse(formData.get('ids') as string) as string[]
  const subCategoryId = Number(formData.get('subCategoryId'))
  // Use inArray for batch update
  await db.update(expense)
    .set({ subCategoryId, status: '3', updatedAt: new Date() })
    .where(and(inArray(expense.id, ids), eq(expense.userId, userId)))
  revalidatePath('/spese')
  return { error: null }
}
```

### Pattern 4: URL Filter State (Client Component)

**What:** Filter selects read `useSearchParams()` for current value, call `router.replace()` on change.
**When to use:** Any filter/sort bar that must be bookmarkable and survive page refresh.

```typescript
// Source: Next.js 16 App Router docs [ASSUMED: exact hook API — consistent with Next.js 15 pattern]
// components/expenses/expense-filters.tsx
'use client'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTransition } from 'react'

export function ExpenseFilters({ categories }: { categories: Category[] }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function updateFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    startTransition(() => {
      router.replace('/spese?' + params.toString(), { scroll: false })
    })
  }
  // ...
}
```

`isPending` from `useTransition` drives the `opacity-50` loading state on the table while the server re-renders.

### Pattern 5: Seed Script

**What:** A standalone script `drizzle/seed.ts` that inserts categories and sub_categories using `db.insert().values().onConflictDoNothing()`.
**When to use:** Static reference data that must exist before the app runs.

```typescript
// drizzle/seed.ts
import { db } from '@/lib/db'
import { category, subCategory } from '@/lib/db/schema'
import { categories, subCategories } from '@/docs/init/seed' // or inline data

async function seed() {
  await db.insert(category).values(categories).onConflictDoNothing()
  // sub_categories after categories (FK constraint)
  await db.insert(subCategory).values(subCategories).onConflictDoNothing()
  console.log('Seed completato.')
}
seed().catch(console.error)
```

Run: `tsx drizzle/seed.ts` — add as `"db:seed": "tsx drizzle/seed.ts"` to package.json scripts.

### Pattern 6: Two-Level Category Select

**What:** A single `<Select>` with `<SelectGroup>` per category and `<SelectItem>` per sub_category. Category names are `<SelectLabel>` (non-selectable). Users select a sub_category ID.

```tsx
// Source: 03-UI-SPEC.md Hierarchy Select specification [VERIFIED: codebase + UI-SPEC]
<Select value={subCategoryId ?? ''} onValueChange={(v) => setSubCategoryId(v)}>
  <SelectTrigger><SelectValue placeholder="Seleziona una categoria" /></SelectTrigger>
  <SelectContent>
    {categories.map((cat) => (
      <SelectGroup key={cat.id}>
        <SelectLabel>{cat.name}</SelectLabel>
        {cat.subCategories.map((sub) => (
          <SelectItem key={sub.id} value={String(sub.id)}>
            {sub.name}
          </SelectItem>
        ))}
      </SelectGroup>
    ))}
  </SelectContent>
</Select>
```

### Anti-Patterns to Avoid

- **Calling DB directly from page components:** All queries must go through `lib/dal/`. Never import `db` in page.tsx.
- **Business logic in Server Actions:** Actions validate + auth + delegate + revalidate. No complex logic.
- **Importing `verifySession` from a client bundle:** `lib/dal/auth.ts` has `import 'server-only'`. Never import from Client Components.
- **Using `drizzle-kit push` for schema changes:** Always `db:generate` then `db:migrate`.
- **Storing checkbox selection in URL:** Checkbox state is ephemeral — React state only, not URL.
- **Using `router.push` for filter changes:** Use `router.replace` to avoid browser history spam.
- **Passing raw Drizzle DECIMAL strings as numbers:** Not an issue in Phase 3 (no amounts), but the pattern must not be introduced.
- **Installing extra shadcn components unnecessarily:** The UI-SPEC explicitly says use `<Dialog>` styled as alert for delete confirmation — do NOT install `AlertDialog` just for this.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table component | Custom `<table>` with CSS | `npx shadcn@latest add table` | shadcn Table is already the design system standard — consistent with other components |
| Toast notifications | Custom toast state | `sonner` (already installed) + `Toaster` in root layout | sonner handles positioning, animations, stacking, auto-dismiss |
| Form validation | Manual if-checks | Zod `safeParse` in Server Action | Consistent with auth pattern; Zod error messages in Italian via `{ error: '...' }` |
| Date range calculation | Custom date math | Native `Date` + helper function `periodToDateRange()` | Simple enough with native JS; no date-fns needed |
| ID generation for expense | UUID v4 with crypto | `crypto.randomUUID()` (Node built-in) | Consistent with Better Auth user.id being a text PK |
| Bulk update loop | `Promise.all` of individual updates | Drizzle `inArray` single UPDATE | One round-trip vs N; must also scope to userId for security |
| Category data re-fetch | Duplicate query per component | `React.cache()` on `getCategories()` | Deduplicates across Server Component tree |

**Key insight:** The primary complexity risk in Phase 3 is state synchronization between filter URL params, checkbox selection, and dialog open state. Use `useSearchParams` for filters, `useState` for selection, and `useState` for dialog open/close — keep these three concerns separate.

---

## Common Pitfalls

### Pitfall 1: Category Filter Excluding Uncategorized Expenses

**What goes wrong:** When a user filters by category and has uncategorized expenses, the JOIN on `sub_category → category` returns NULL for uncategorized rows. An `eq(category.slug, 'ristorazione')` condition correctly excludes them. But if the query accidentally uses INNER JOIN instead of LEFT JOIN, ALL uncategorized expenses disappear from the list even with no category filter active.

**Why it happens:** Drizzle's `.join()` defaults to INNER JOIN. Uncategorized expenses have `subCategoryId = null` → no join match → silently dropped.

**How to avoid:** Always use `.leftJoin(subCategory, ...)` and `.leftJoin(category, ...)`. Verify with a test expense that has no category assigned.

**Warning signs:** Expense count in DB doesn't match count shown in list.

---

### Pitfall 2: `revalidatePath` Not Triggering Re-fetch

**What goes wrong:** After a Server Action completes, the expense list doesn't update because `revalidatePath` is called with the wrong path, or the page uses a layout path instead of the route path.

**Why it happens:** `revalidatePath('/spese')` must exactly match the Next.js route path, not the file system path. The route is `app/(app)/spese/page.tsx` → path is `/spese`.

**How to avoid:** Use `revalidatePath('/spese')` in all expense actions. Optionally also `revalidatePath('/spese', 'page')` for specificity.

**Warning signs:** Create succeeds (no error returned) but list shows stale data until manual refresh.

---

### Pitfall 3: `useSearchParams` Requires Suspense Boundary

**What goes wrong:** Next.js 16 requires components that call `useSearchParams()` to be wrapped in a `<Suspense>` boundary, or it throws a build/runtime error about "missing Suspense boundary for useSearchParams".

**Why it happens:** `useSearchParams()` reads the URL at render time, which can cause hydration mismatches without Suspense.

**How to avoid:** Wrap the filter toolbar (and any component using `useSearchParams`) in `<Suspense fallback={...}>` in the page Server Component.

```tsx
// app/(app)/spese/page.tsx
<Suspense fallback={<FiltersSkeleton />}>
  <ExpenseFilters categories={categories} />
</Suspense>
```

**Warning signs:** Build error "This component should be wrapped in a Suspense boundary" or hydration mismatch warnings.

---

### Pitfall 4: Bulk Categorize Without userId Scope

**What goes wrong:** The `bulkCategorize` action trusts the `ids` array from the client and updates all expenses matching those IDs, regardless of userId. A malicious user could submit IDs belonging to other users.

**Why it happens:** `inArray(expense.id, ids)` without a userId check lets any authenticated user modify any expense by ID.

**How to avoid:** Always include `eq(expense.userId, userId)` in the WHERE clause of the bulk UPDATE. Drizzle makes this explicit.

**Warning signs:** No warning — this is a silent privilege escalation bug. Prevent it at design time.

---

### Pitfall 5: Seed Data Ordering (FK Constraint)

**What goes wrong:** Seeding `sub_category` before `category` violates the FK constraint and the seed script fails.

**Why it happens:** `sub_category.category_id` references `category.id`. PostgreSQL enforces FK constraints at insert time.

**How to avoid:** Always insert categories first, then sub_categories. Use a single seed script that runs both in order, not parallel inserts.

---

### Pitfall 6: `nanoid` vs `crypto.randomUUID()` for Expense ID

**What goes wrong:** Using `serial` (auto-increment integer) for `expense.id` creates a predictable ID that leaks information (e.g., "you have expense 47, so user registered early"). More critically, it would be inconsistent with the existing `text` primary key convention used by Better Auth.

**How to avoid:** Use `text` primary key + `crypto.randomUUID()` on insert (Node.js built-in, no extra dependency). This matches the `user.id` convention in the existing schema.

---

### Pitfall 7: Toaster Not in Root Layout

**What goes wrong:** `toast('Spesa creata con successo.')` from sonner is called client-side, but no `<Toaster />` component exists in the DOM — toast silently does nothing.

**Why it happens:** sonner requires `<Toaster />` to be mounted at the root layout level. Currently `app/layout.tsx` does not include it.

**How to avoid:** Wave 0 task: add `import { Toaster } from 'sonner'` and `<Toaster />` inside `<body>` in `app/layout.tsx`.

---

## Code Examples

Verified patterns from existing codebase and official sources:

### Zod v4 Server Action Validation (Italian messages)
```typescript
// Source: lib/validations/auth.ts pattern [VERIFIED: existing codebase]
// lib/validations/expense.ts
import { z } from 'zod'

export const CreateExpenseSchema = z.object({
  title: z
    .string()
    .min(2, { error: 'Il titolo deve contenere almeno 2 caratteri.' })
    .max(120, { error: 'Il titolo non può superare i 120 caratteri.' }),
  subCategoryId: z.number().int().positive().optional(),
  notes: z.string().max(500, { error: 'Le note non possono superare i 500 caratteri.' }).optional(),
})

export const UpdateExpenseSchema = CreateExpenseSchema.extend({
  id: z.string().min(1),
})

export const BulkCategorizeSchema = z.object({
  ids: z.array(z.string()).min(1, { error: 'Seleziona almeno una spesa per continuare.' }),
  subCategoryId: z.number().int().positive({ error: 'Seleziona una categoria prima di confermare.' }),
})
```

### Period to Date Range Helper
```typescript
// lib/dal/expenses.ts — pure helper, no DB
export function periodToDateRange(period: string): { from: Date; to: Date } {
  const now = new Date()
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999) // end of current month
  switch (period) {
    case 'last-3-months': return { from: new Date(now.getFullYear(), now.getMonth() - 2, 1), to }
    case 'last-6-months': return { from: new Date(now.getFullYear(), now.getMonth() - 5, 1), to }
    case 'this-year':     return { from: new Date(now.getFullYear(), 0, 1), to }
    case 'last-year':     return { from: new Date(now.getFullYear() - 1, 0, 1), to: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999) }
    default: // 'this-month'
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to }
  }
}
```

### Delete Confirmation Using Dialog (not AlertDialog)
```tsx
// Source: 03-UI-SPEC.md registry safety gate [VERIFIED: UI-SPEC]
// Do NOT install AlertDialog. Use Dialog styled as confirm.
// components/expenses/expense-table.tsx (inside row DropdownMenu)
function DeleteConfirmDialog({ expenseId, title, onConfirm }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
          Elimina
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Elimina spesa</DialogTitle>
        </DialogHeader>
        <p>Sei sicuro di voler eliminare &ldquo;{title}&rdquo;? Questa azione non può essere annullata.</p>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Annulla</Button></DialogClose>
          <Button variant="destructive" onClick={() => onConfirm(expenseId)}>Elimina</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### Decimal Utils (STATE.md Blocker — must be created in Wave 0)
```typescript
// Source: CLAUDE.md + BUSINESS_LOGIC_HANDOFF.md [VERIFIED: existing docs]
// lib/utils/decimal.ts
import Decimal from 'decimal.js'

/** Parse a DB DECIMAL string or number to Decimal instance */
export function toDecimal(value: string | number): Decimal {
  return new Decimal(value)
}

/** Convert Decimal to string for DB insertion (DECIMAL(10,2) column) */
export function toDbDecimal(value: Decimal): string {
  return value.toFixed(2)
}
```

Note: These utils are not used by Phase 3 expense operations (no amounts). They must exist for Phase 5 compliance. Create now to clear the STATE.md blocker.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useEffect` + fetch for mutations | Server Actions + `useActionState` | React 19 / Next.js 15+ | No manual loading state management for mutations |
| `middleware.ts` for route protection | `proxy.ts` (Next.js 16 rename) | Next.js 16 | Already implemented in this project |
| `NextAuth v5` | `Better Auth` | Project init | Session via `auth.api.getSession()` — already wired in `lib/dal/auth.ts` |
| `drizzle-kit push` | `drizzle-kit generate` + `scripts/migrate.ts` | Project convention | Enforced by CLAUDE.md |

**Deprecated/outdated:**
- `middleware.ts` filename: replaced by `proxy.ts` in Next.js 16 — already done in this project.
- `getServerSideProps`: replaced by async Server Components in App Router.
- `pages/` router: not used in this project.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `router.replace` is the correct API for filter changes in Next.js 16 (vs `router.push`) | Pattern 4 | Both work; using `push` pollutes history but doesn't break functionality |
| A2 | `useSearchParams()` requires Suspense boundary in Next.js 16 (same as Next.js 15) | Pitfall 3 | If not required, the added Suspense is harmless overhead |
| A3 | `periodToDateRange` with native Date is sufficient for "Questo mese" / "Anno scorso" preset logic | Code Examples | Edge case: month boundary bugs — test each preset explicitly |
| A4 | `crypto.randomUUID()` is available in the Next.js 16 Node runtime without additional imports | Pattern 1 | Fallback: use `nanoid` package (already a common dep) |

---

## Open Questions

1. **Seed script runner — is `tsx` available?**
   - What we know: `tsx` is in devDependencies (used for `scripts/migrate.ts`)
   - What's unclear: whether `drizzle/seed.ts` should import from `@/lib/db` (needs tsconfig paths) or use a relative path
   - Recommendation: Mirror the `scripts/migrate.ts` pattern exactly — use relative imports, not `@/` aliases, to avoid tsconfig path resolution issues in a script context

2. **Category filter with uncategorized expenses edge case**
   - What we know: Selecting a category filter should return categorized expenses in that category. Uncategorized expenses (status=1) have no subCategory → no category.
   - What's unclear: Should filtering by category slug also show uncategorized expenses? The UI-SPEC and CONTEXT.md are silent on this.
   - Recommendation: Category filter = "show me expenses assigned to this category". Uncategorized expenses are not shown when a category filter is active. This matches the natural mental model.

3. **Pagination — cursor vs offset for Phase 3**
   - What we know: UI-SPEC says "load up to 200 rows" with pagination at Claude's discretion.
   - What's unclear: Whether 200 rows is enough for all users during Phase 3 lifecycle.
   - Recommendation: Start with LIMIT 200 + no pagination UI. Add cursor-based pagination if needed in a follow-up. Keep DAL signature forward-compatible by accepting an optional `cursor` param.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | Drizzle ORM / migrations | [ASSUMED: local dev] | — | Dev must have local DB per STACK.md |
| `tsx` | Seed script / migrations | Installed in devDeps [VERIFIED: package.json] | ^4.21.0 | — |
| `sonner` | Toast notifications | Installed [VERIFIED: node_modules] | latest | — |
| `shadcn Table` | Expense list | NOT installed [VERIFIED: ls components/ui/] | — | Run `npx shadcn@latest add table` in Wave 0 |
| `nanoid` / `crypto.randomUUID` | Expense ID generation | `crypto.randomUUID` built-in Node.js | Node built-in | Use `nanoid` if built-in unavailable |

**Missing dependencies with no fallback:**
- None that block execution.

**Missing dependencies requiring Wave 0 installation:**
- `shadcn Table`: `npx shadcn@latest add table`
- `sonner Toaster` in root layout: add `<Toaster />` to `app/layout.tsx`

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (e2e) — existing project test suite |
| Config file | `playwright.config.ts` (root) |
| Quick run command | `yarn playwright test tests/expenses.spec.ts` |
| Full suite command | `yarn playwright test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXP-01 | Create expense: form submit creates row visible in list | e2e | `yarn playwright test tests/expenses.spec.ts::create` | ❌ Wave 0 |
| EXP-01 | Edit expense: modal pre-fills existing data, update persists | e2e | `yarn playwright test tests/expenses.spec.ts::edit` | ❌ Wave 0 |
| EXP-01 | Delete expense: confirm dialog, row removed from list | e2e | `yarn playwright test tests/expenses.spec.ts::delete` | ❌ Wave 0 |
| EXP-02 | Filter by status "Da categorizzare" shows only status=1 expenses | e2e | `yarn playwright test tests/expenses.spec.ts::filter-status` | ❌ Wave 0 |
| EXP-02 | Filter by period "Questo mese" excludes older expenses | e2e | `yarn playwright test tests/expenses.spec.ts::filter-period` | ❌ Wave 0 |
| EXP-02 | Filter params survive page refresh | e2e | `yarn playwright test tests/expenses.spec.ts::filter-bookmark` | ❌ Wave 0 |
| EXP-03 | Select N rows → FAB appears with correct count | e2e | `yarn playwright test tests/expenses.spec.ts::bulk-select` | ❌ Wave 0 |
| EXP-03 | Bulk categorize assigns subCategory + status=3 to all selected | e2e | `yarn playwright test tests/expenses.spec.ts::bulk-categorize` | ❌ Wave 0 |

All tests are `test.fixme()` stubs following the auth.spec.ts convention — implement after the corresponding plans execute.

### Sampling Rate
- **Per task commit:** Visual check — load `/spese` in browser, verify basic render
- **Per wave merge:** `yarn playwright test tests/expenses.spec.ts`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/expenses.spec.ts` — stub file with `test.fixme()` for all 8 behaviors above
- [ ] `drizzle/seed.ts` — seed script must exist and run before any test
- [ ] `npx shadcn@latest add table` — Table component must be installed
- [ ] Toaster in `app/layout.tsx` — required for toast assertions
- [ ] `lib/utils/decimal.ts` — toDecimal/toDbDecimal utils (STATE.md blocker, created in Wave 0)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Better Auth handles — already in Phase 2 |
| V3 Session Management | No | Better Auth + `verifySession()` — already in Phase 2 |
| V4 Access Control | Yes | Every DAL query scoped by `userId`; bulkCategorize must include `eq(expense.userId, userId)` |
| V5 Input Validation | Yes | Zod schemas for all Server Action inputs; title length, notes length enforced |
| V6 Cryptography | No | No new cryptographic operations in Phase 3 |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Insecure Direct Object Reference (IDOR) — access expense by ID without userId check | Elevation of privilege | Always scope DAL queries with `eq(expense.userId, userId)` from verified session |
| Bulk update privilege escalation — client submits foreign expense IDs | Tampering | `inArray(expense.id, ids)` + `eq(expense.userId, userId)` in single WHERE clause |
| Form injection via notes field | Tampering | Zod `max(500)` + React's default XSS escaping; no dangerouslySetInnerHTML |
| Status manipulation — client sends arbitrary status value | Tampering | Server Action hardcodes `status: '3'` for bulkCategorize; user cannot set status=2 (auto-categorized) |

---

## Sources

### Primary (HIGH confidence)
- `lib/db/schema.ts` [VERIFIED: read directly] — existing Drizzle schema conventions, enum pattern, index pattern
- `lib/dal/auth.ts` [VERIFIED: read directly] — `verifySession()` API, session fields available
- `lib/actions/auth.ts` [VERIFIED: read directly] — Server Action shape, `useActionState` pattern, Zod v4 usage
- `lib/validations/auth.ts` [VERIFIED: read directly] — Zod v4 syntax with `{ error: '...' }` for Italian messages
- `package.json` [VERIFIED: read directly] — exact versions: drizzle-orm 0.45.2, next 16.2.4, zod 4.3.6, sonner installed
- `03-CONTEXT.md` [VERIFIED: read directly] — all locked decisions D-01 through D-11
- `03-UI-SPEC.md` [VERIFIED: read directly] — binding UI contract, component inventory, copywriting
- `docs/init/seed.ts` [VERIFIED: read directly] — 26 categories, ~120 subcategories, exact structure
- `docs/init/BUSINESS_LOGIC_HANDOFF.md` [VERIFIED: read directly] — Expense schema, status enum, descriptionHash purpose
- drizzle-orm node_modules [VERIFIED: `node -e` check] — `serial`, `integer`, `numeric`, `unique` all available in pg-core at 0.45.2
- `playwright.config.ts` [VERIFIED: read directly] — test runner: Playwright, testDir: ./tests, baseURL: localhost:3000

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` [VERIFIED: read directly] — drizzle migration pattern, Better Auth adapter config
- `.planning/research/ARCHITECTURE.md` [VERIFIED: read directly] — DAL pattern, Server Component composition, filter/DAL patterns

### Tertiary (LOW confidence)
- `useSearchParams()` Suspense boundary requirement in Next.js 16 [ASSUMED] — consistent with documented Next.js 15 behavior; verify at implementation time

---

## Metadata

**Confidence breakdown:**
- Schema design: HIGH — drizzle pg-core API verified, existing schema pattern verified
- Server Action pattern: HIGH — existing `lib/actions/auth.ts` is a direct template
- DAL query pattern: HIGH — existing `lib/dal/auth.ts` + ARCHITECTURE.md verified
- URL filter state: HIGH — useSearchParams/useRouter are stable Next.js APIs; Suspense requirement is ASSUMED but low-risk
- Seed data: HIGH — `docs/init/seed.ts` read directly, exact structure confirmed
- Security (IDOR): HIGH — standard userId-scoping pattern, explicitly enforced by ARCHITECTURE.md rule #2

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (stable stack — 30 days)
