# Architecture Patterns — Sparter

**Domain:** Personal finance web app (Italian market)
**Researched:** 2026-04-22
**Stack:** Next.js 15 App Router, Drizzle ORM + MySQL, NextAuth v5 (Auth.js), Cloudflare R2, Tailwind + shadcn/ui

---

## 1. Directory Structure

### Recommended Layout

```
app/
├── (auth)/                        # Route group — public auth pages
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   └── layout.tsx                 # Minimal layout, no shell
│
├── (app)/                         # Route group — authenticated shell
│   ├── layout.tsx                 # Shell: sidebar, topbar, session guard
│   ├── dashboard/
│   │   ├── page.tsx               # Server Component — reads KPIs
│   │   └── loading.tsx            # Skeleton via Suspense
│   ├── expenses/
│   │   ├── page.tsx               # List with filters
│   │   ├── [id]/page.tsx
│   │   └── new/page.tsx
│   ├── transactions/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── import/
│   │   ├── page.tsx               # Upload step
│   │   └── [fileId]/
│   │       ├── analyze/page.tsx   # Column detection + platform match
│   │       └── confirm/page.tsx   # Confirm + trigger import
│   ├── categories/page.tsx
│   └── profile/page.tsx
│
├── api/                           # Route handlers (HTTP only)
│   └── upload/route.ts            # R2 upload — see section 3
│
lib/
├── db/
│   ├── index.ts                   # Drizzle client singleton
│   ├── schema.ts                  # All table definitions
│   └── migrations/                # drizzle-kit output
│
├── dal/                           # Data Access Layer — server-only
│   ├── expenses.ts
│   ├── transactions.ts
│   ├── files.ts
│   ├── dashboard.ts
│   └── users.ts
│
├── services/                      # Business logic — server-only
│   ├── categorization.ts          # 2-tier pipeline
│   ├── import.ts                  # analyzeFile, importFile
│   ├── platform-matcher.ts        # findBestMatchingPlatform
│   └── r2.ts                      # R2 SDK wrapper
│
├── actions/                       # "use server" thin wrappers
│   ├── expenses.ts
│   ├── import.ts
│   └── auth.ts
│
├── validations/                   # Zod schemas
│   ├── expense.ts
│   ├── import.ts
│   └── auth.ts
│
└── auth.ts                        # NextAuth v5 config + export

proxy.ts                           # Route protection (renamed from middleware.ts in Next.js 16)
```

### Key Naming Decisions

- `(auth)` and `(app)` are **route groups** — they organize layouts without affecting URL paths. `(app)/layout.tsx` renders the full shell (sidebar + topbar) only for authenticated pages.
- `lib/dal/` contains all Drizzle queries. No raw DB access in page components.
- `lib/services/` contains multi-step business logic that calls the DAL.
- `lib/actions/` are thin `"use server"` files that validate input, call a service, and call `revalidatePath`. They own no business logic.
- **Confidence: HIGH** — Route groups and DAL pattern sourced from official Next.js docs (2026-04-21).

---

## 2. Data Access Layer (DAL) Pattern

### Why DAL, Not Direct-in-Component

Official Next.js docs recommend the DAL pattern for new projects (over component-level DB access) because:
1. Authorization checks run in one place — reduces IDOR risk
2. `React.cache()` deduplications DB calls across a render pass
3. `import 'server-only'` prevents accidental client bundle inclusion
4. DTOs keep sensitive columns off the wire

### DAL Structure

```typescript
// lib/dal/expenses.ts
import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'
import { expenses, subCategories, categories } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { verifySession } from '@/lib/dal/auth'

export const getExpenses = cache(async (filters?: ExpenseFilters) => {
  const session = await verifySession()   // auth check happens here

  return db
    .select({
      id: expenses.id,
      title: expenses.title,
      status: expenses.status,
      subCategoryId: expenses.subCategoryId,
      // Do NOT include descriptionHash, internal fields
    })
    .from(expenses)
    .where(eq(expenses.userId, session.userId))
    .orderBy(desc(expenses.createdAt))
})
```

### Auth Check Helpers

```
lib/dal/auth.ts
  └── verifySession()    — reads JWT cookie, redirects to /login if invalid
                           wrapped in React.cache() — called N times, 1 DB-equivalent per render
```

Every DAL function calls `verifySession()` as its first line. Server Actions also call it before delegating to services.

---

## 3. File Import Pipeline Architecture

### Decision: Two-Step Split (API Route + Server Action)

The import pipeline involves a file upload to R2 followed by synchronous parsing and DB writes. Since v1 has no job runner, everything runs synchronously in the request cycle. The architecture splits this into two phases across two request types:

**Phase 1 — Upload (API Route Handler)**

```
Browser FormData
    │
    ▼
POST /api/upload                    ← Route Handler (not a Server Action)
    │  receives file stream
    │  pipes to R2 via @aws-sdk/client-s3
    │  inserts file record status='pending'
    └─ returns { fileId, storageKey }
```

A Route Handler is used here instead of a Server Action because:
- Server Actions use `multipart/form-data` but are not designed for streaming binary data to external storage
- Route Handlers give full control over the request stream and allow piping to R2 without buffering the entire file in memory
- The upload can return a `fileId` immediately for the next step

**Phase 2 — Analyze + Import (Server Actions)**

```
Client receives fileId
    │
    ▼
Server Action: analyzeFileAction(fileId)
    │  calls lib/services/import.ts → analyzeFile()
    │    └─ downloads from R2
    │    └─ detects columns, delimiter, date format
    │    └─ calls findBestMatchingPlatform()
    └─ returns { columnSample, platformMatches }

User confirms platform selection
    │
    ▼
Server Action: importFileAction(fileId, platformId)
    │  calls lib/services/import.ts → importFile()
    │    └─ streams rows from R2
    │    └─ for each row:
    │         generates transactionHash → skip if exists (dedup)
    │         normalizes description → descriptionHash
    │         findOrCreate Expense
    │         insert Transaction
    │         run categorization pipeline
    │    └─ updates file.status = 'done' | 'error'
    └─ revalidatePath('/transactions'), revalidatePath('/dashboard')
```

### ASCII Flow Diagram

```
Browser
  │
  │  Step 1: Upload
  ├──POST /api/upload ─────────────────────────────────────────────────────┐
  │                                                                         │
  │  lib/services/r2.ts                                                     │
  │  putObject(key, stream)  ──────────────────────► Cloudflare R2         │
  │                                                                         │
  │  lib/dal/files.ts                                                       │
  │  insert({ status:'pending', storageKey })  ───► MySQL                  │
  │                                                                         │
  │  return { fileId }  ◄───────────────────────────────────────────────────┘
  │
  │  Step 2: Analyze (Server Action)
  ├──analyzeFileAction(fileId)
  │    lib/services/import.ts → analyzeFile()
  │      getObject(storageKey) ──────────────────── Cloudflare R2
  │      detect columns/delimiter
  │      findBestMatchingPlatform() ─────────────── MySQL (platforms table)
  │    return { platformMatches, columnSample }
  │
  │  User confirms platform
  │
  │  Step 3: Import (Server Action)
  └──importFileAction(fileId, platformId)
       lib/services/import.ts → importFile()
         for each CSV row:
           transactionHash check ──────────────────── MySQL (skip dup)
           findOrCreateExpense() ──────────────────── MySQL
           insertTransaction() ─────────────────────── MySQL
           runCategorizationPipeline() ─────────────── MySQL
         update file.status ──────────────────────────── MySQL
       revalidatePath('/dashboard')
```

### Why Not a Single Server Action for Upload?

Server Actions process `FormData` synchronously on the server but are HTTP POST endpoints. Streaming a binary file from the action directly to R2 is possible but creates a double-buffering problem (Next.js buffers the request body before the action runs). A Route Handler gives you the raw `Request` object and avoids this. Route Handler for upload, Server Actions for subsequent steps — clean separation.

---

## 4. Categorization Pipeline as a Service

### Location: `lib/services/categorization.ts`

This is pure business logic with no UI dependency. It lives in `lib/services/`, not in an action or a component.

```
lib/services/categorization.ts
  └── runCategorizationPipeline(expense, userId, subscriptionPlan)
        │
        ├─ Tier 1: checkRegexPatterns(description, userId)
        │    SELECT FROM categorizationPatterns
        │    WHERE userId = ? OR userId IS NULL
        │    apply regex to normalized description
        │    if match → return { subCategoryId, method: 'regex', confidence: 1.0 }
        │
        ├─ Tier 2: checkHistory(descriptionHash, userId)
        │    SELECT subCategoryId, SUM(weight) as totalWeight
        │    FROM expenseClassificationHistory
        │    WHERE expenseKey = ? AND userId = ?
        │    GROUP BY subCategoryId
        │    ORDER BY totalWeight DESC
        │    LIMIT 1
        │    if totalWeight >= 3 → return { subCategoryId, method: 'history' }
        │
        └─ No match → return { status: 1 } (manual categorization needed)
             (Tier 3 AI is v2 — insert into PendingAiExpense when subscription=pro)
```

### Subscription Feature Gate

```typescript
export async function runCategorizationPipeline(
  expense: NewExpense,
  userId: string,
  plan: 'free' | 'basic' | 'pro'
): Promise<CategorizationResult> {
  if (plan === 'free') {
    return { status: 1, method: null }   // no auto-categorization
  }

  const regexResult = await checkRegexPatterns(expense.title, userId)
  if (regexResult) return regexResult

  const historyResult = await checkHistory(expense.descriptionHash, userId)
  if (historyResult) return historyResult

  // v2: if plan === 'pro', insert into PendingAiExpense, return status 4
  return { status: 1, method: null }
}
```

### Call Sites

The pipeline is called from exactly one place: `lib/services/import.ts` inside `importFile()`, once per expense created. It is NOT called from a Server Action directly. The action calls the service, the service calls the pipeline. This single call site makes the v2 AI upgrade surgical — just change the `status 1` fallback to insert into `PendingAiExpense`.

---

## 5. Dashboard Query Architecture

### Decision: Server Components with DAL, Not API Routes

For the dashboard KPIs, the correct architecture is **Server Components that call the DAL directly**. Reasoning:
- Dashboard data does not need to be fetched client-side (no client state dependency)
- Server Components can call Drizzle directly — no HTTP round-trip overhead
- `React.cache()` in the DAL deduplicates if multiple components need the same data
- API routes would add latency and boilerplate for no gain in this pattern

### Query Architecture

```
app/(app)/dashboard/page.tsx          ← async Server Component
  │
  ├── lib/dal/dashboard.ts
  │     getOverview(userId, preset)
  │       SELECT
  │         SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) as totalIn,
  │         SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as totalOut,
  │         COUNT(CASE WHEN e.subCategoryId IS NULL THEN 1 END) as uncategorizedCount
  │       FROM transactions t
  │       JOIN expenses e ON t.expenseId = e.id
  │       JOIN subCategories sc ON e.subCategoryId = sc.id
  │       JOIN categories c ON sc.categoryId = c.id
  │       WHERE t.userId = ? AND c.slug != 'ignore'
  │         AND t.timestamp BETWEEN ? AND ?
  │
  ├── lib/dal/dashboard.ts
  │     getCategoriesBreakdown(userId, type, dateRange)
  │       GROUP BY category, subcategory
  │       + percentage calculation (done in JS with Decimal.js, not SQL)
  │
  └── lib/dal/dashboard.ts
        getAggregatedTransactionsData(userId, dateRange)
          GROUP BY YEAR(timestamp), MONTH(timestamp)
          → monthly breakdown
```

### Drizzle Pattern for Complex GROUP BY

Use the `sql` template literal for aggregations that exceed what Drizzle's query builder expresses cleanly:

```typescript
// lib/dal/dashboard.ts
import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import Decimal from 'decimal.js'

export const getOverview = cache(async (
  userId: string,
  from: Date,
  to: Date
) => {
  const session = await verifySession()

  const rows = await db.execute(sql`
    SELECT
      SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END)   AS total_in,
      SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END) AS total_out,
      COUNT(CASE WHEN e.sub_category_id IS NULL THEN 1 END)   AS uncategorized_count
    FROM transactions t
    LEFT JOIN expenses e ON t.expense_id = e.id
    LEFT JOIN sub_categories sc ON e.sub_category_id = sc.id
    LEFT JOIN categories c ON sc.category_id = c.id
    WHERE t.user_id = ${session.userId}
      AND (c.slug IS NULL OR c.slug != 'ignore')
      AND t.timestamp BETWEEN ${from} AND ${to}
  `)

  const row = rows[0] as any
  const totalIn  = new Decimal(row.total_in  ?? 0)
  const totalOut = new Decimal(row.total_out ?? 0)
  const balance  = totalIn.minus(totalOut)

  return {
    totalIn:           parseFloat(totalIn.toFixed(2)),
    totalOut:          parseFloat(totalOut.toFixed(2)),
    balance:           parseFloat(balance.toFixed(2)),
    savingsRate:       totalIn.gt(0)
                         ? parseFloat(totalIn.minus(totalOut).div(totalIn).times(100).toFixed(2))
                         : 0,
    uncategorizedCount: Number(row.uncategorized_count ?? 0),
  }
})
```

Key rule: **never use `+`, `-`, `*`, `/` on JS floats for amounts**. Always use `Decimal.js` after extracting SQL results.

### Streaming Dashboard with Suspense

Wrap slow KPI queries in `<Suspense>` boundaries at the component level so the layout shell renders immediately:

```
app/(app)/dashboard/page.tsx

  <DashboardShell>                    ← immediate
    <Suspense fallback={<OverviewSkeleton />}>
      <OverviewKPIs />                ← async SC, calls getOverview()
    </Suspense>
    <Suspense fallback={<ChartSkeleton />}>
      <CategoryBreakdown />           ← async SC, calls getCategoriesBreakdown()
    </Suspense>
    <Suspense fallback={<TrendSkeleton />}>
      <MonthlyTrend />                ← async SC, calls getAggregatedTransactionsData()
    </Suspense>
  </DashboardShell>
```

Three independent DB queries stream in parallel. The shell renders instantly.

---

## 6. Auth Middleware (proxy.ts)

### Important Note on Next.js 16

Next.js 16 renamed `middleware.ts` to `proxy.ts`. The file is otherwise identical in behavior. For v1, the project will likely be on Next.js 15 where the file is still `middleware.ts`. The migration is handled by a codemod when upgrading.

### Recommended Middleware Structure

```typescript
// middleware.ts  (proxy.ts in Next.js 16+)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/session'   // or auth() from NextAuth v5

const PUBLIC_ROUTES  = ['/login', '/signup']
const AUTH_ROUTES    = ['/login', '/signup']
const STAGING_BYPASS_HEADER = 'x-staging-key'
const STAGING_KEY_VALUE     = process.env.STAGING_BYPASS_KEY

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname

  // --- Staging bypass (non-production only) ---
  if (process.env.NODE_ENV !== 'production') {
    const stagingKey = req.headers.get(STAGING_BYPASS_HEADER)
    if (stagingKey === STAGING_KEY_VALUE) {
      return NextResponse.next()
    }
  }

  // --- Read session (JWT cookie — compatible with NextAuth v5 stateless) ---
  const sessionCookie = req.cookies.get('next-auth.session-token')?.value
                     ?? req.cookies.get('__Secure-next-auth.session-token')?.value
  const session = sessionCookie ? await decrypt(sessionCookie) : null
  const isAuthenticated = !!session?.userId

  const isPublicRoute = PUBLIC_ROUTES.includes(path)
  const isAuthRoute   = AUTH_ROUTES.includes(path)

  // Redirect authenticated users away from auth pages
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
  }

  // Redirect unauthenticated users from protected pages
  if (!isPublicRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', req.nextUrl)
    loginUrl.searchParams.set('callbackUrl', path)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)',
  ],
}
```

### Notes on NextAuth v5 + Middleware

NextAuth v5 (Auth.js) exports an `auth()` helper that can be used as middleware directly:

```typescript
// The simplest approach if using NextAuth v5
export { auth as middleware } from '@/lib/auth'
```

However, the custom approach above is preferred for Sparter because:
1. It allows the staging bypass header check before any auth logic
2. It avoids importing the full NextAuth config into the Edge runtime (v5 has Edge compatibility but the Drizzle adapter/MySQL driver does not — keep middleware credential-light)
3. Explicit control over redirect behavior with `callbackUrl`

### Security Principle

Middleware is optimistic protection only — it reads the cookie without a DB round-trip. Every Server Action and DAL function still calls `verifySession()` independently. Middleware is not the last line of defense.

```
Request
   │
   ▼
middleware.ts (JWT cookie check — no DB)
   │  redirect if no session
   ▼
Route renders → Server Component
   │
   ▼
DAL function → verifySession() (authoritative check)
   │  redirect if invalid session
   ▼
DB query with userId scoping (every WHERE clause includes userId)
```

---

## 7. Component Boundaries

### Server vs Client Component Decision Rules

| Scenario | Component Type | Reason |
|---|---|---|
| Dashboard KPI display | Server Component | DB access, no interactivity |
| Expense list (read-only) | Server Component | DB access, Suspense streaming |
| Filter bar (date, category) | Client Component | Local state, user interaction |
| Import upload form | Client Component | File input, progress feedback |
| Category select dropdown | Client Component | Controlled input |
| Auth forms (login/signup) | Client Component | `useActionState` for errors |
| Category breakdown chart | Client Component | Chart library (recharts/visx) needs DOM |
| Modal/dialog wrappers | Client Component | Portal, focus trap |

**Rule of thumb:** Push `'use client'` boundary as far down the tree as possible. A page that needs both server data and one interactive dropdown can render as a Server Component that passes data to a leaf-level Client Component.

### Typical Expense List Composition

```
app/(app)/expenses/page.tsx          ← Server Component
  │  calls dal/expenses.getExpenses()
  │
  ├── <ExpenseFilters />             ← 'use client' — search/filter state
  │     onChange triggers router.push with searchParams
  │
  └── <ExpenseTable rows={expenses} />  ← Server Component or Client Component
        │  if sortable → Client Component
        │  if static display → Server Component
        │
        └── <ExpenseRow />           ← Server Component
              └── <CategorizeButton expenseId={id} />  ← 'use client'
                    calls categorizeExpenseAction() via onClick
```

---

## 8. Full System Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Browser                                    │
│  Client Components: forms, filters, charts, upload UI               │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  HTTP / Server Actions / Route Handlers
┌──────────────────────────────▼──────────────────────────────────────┐
│                     Next.js App Router                              │
│                                                                     │
│  proxy.ts / middleware.ts                                           │
│  ├── JWT cookie check (optimistic)                                  │
│  └── staging bypass (non-prod header)                               │
│                                                                     │
│  Route Groups                                                       │
│  ├── (auth)/    login, signup                                       │
│  └── (app)/     dashboard, expenses, transactions, import, profile  │
│                                                                     │
│  Server Components (async)                                          │
│  └── call DAL functions directly                                    │
│                                                                     │
│  "use server" Actions (lib/actions/)                                │
│  ├── validate input (Zod)                                           │
│  ├── call verifySession()                                           │
│  ├── delegate to lib/services/                                      │
│  └── revalidatePath()                                               │
│                                                                     │
│  Route Handler /api/upload                                          │
│  └── pipe file stream to R2                                         │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
┌─────────▼────────┐  ┌────────▼────────┐  ┌───────▼────────────────┐
│  lib/dal/        │  │  lib/services/  │  │  Cloudflare R2         │
│  server-only     │  │  server-only    │  │  CSV/Excel files       │
│                  │  │                 │  │  storageKey per upload │
│  expenses.ts     │  │  import.ts      │  └────────────────────────┘
│  transactions.ts │  │  categorization │
│  dashboard.ts    │  │  .ts            │
│  files.ts        │  │  platform-      │
│  users.ts        │  │  matcher.ts     │
│  auth.ts         │  │  r2.ts          │
└─────────┬────────┘  └────────┬────────┘
          │                    │
          └─────────┬──────────┘
                    │
          ┌─────────▼──────────┐
          │  MySQL (Drizzle)   │
          │                    │
          │  users             │
          │  transactions      │
          │  expenses          │
          │  files             │
          │  platforms         │
          │  categories        │
          │  subCategories     │
          │  tags              │
          │  categorizationP.  │
          │  expenseClassif.   │
          │  History           │
          │  pendingAiExpense  │
          └────────────────────┘
```

---

## 9. Build Order Rationale (Phased Dependencies)

The Sparter development order from the business logic document maps directly onto architectural dependencies:

```
Phase 1 — Design system
  → No DB, no auth. Pure UI components. No architectural dependencies.

Phase 2 — Auth
  → lib/auth.ts (NextAuth v5 config)
  → middleware.ts (route protection)
  → lib/dal/auth.ts (verifySession)
  → lib/actions/auth.ts (signup, login, logout server actions)
  ESTABLISHES: DAL pattern, session, middleware config

Phase 3 — Expense management
  → lib/db/schema.ts (all tables — define upfront, migrate later)
  → lib/dal/expenses.ts
  → lib/actions/expenses.ts
  → CRUD pages in (app)/expenses/
  ESTABLISHES: DAL query patterns, Server Action shape

Phase 4 — Dashboard KPIs
  → lib/dal/dashboard.ts (GROUP BY queries with Drizzle sql``)
  → (app)/dashboard/ with Suspense streaming
  DEPENDS ON: Phase 3 (needs expense + transaction data)

Phase 5 — Import
  → /api/upload/route.ts (R2 upload Route Handler)
  → lib/services/r2.ts
  → lib/services/import.ts (analyzeFile, importFile)
  → lib/services/categorization.ts (Tier 1 + 2 pipeline)
  → (app)/import/ multi-step flow
  DEPENDS ON: Phase 3 (creates expenses + transactions)

Phase 6 — Import advanced
  → lib/services/platform-matcher.ts
  → Custom regex patterns UI
  → ExpenseClassificationHistory write path
  DEPENDS ON: Phase 5 (extends import pipeline)

Phase 7 — User profile
  → lib/dal/users.ts update path
  → (app)/profile/ page
  DEPENDS ON: Phase 2 (needs auth to scope to userId)
```

**The schema should be defined in full in Phase 2/3** even if not all tables are used immediately. Drizzle migrations are additive but defining the full schema early prevents column-missing bugs later in the import pipeline.

---

## 10. Critical Architecture Rules (Do Not Deviate)

1. **All DB queries go through `lib/dal/`** — never import `db` directly in a page, layout, or action
2. **Every DAL function calls `verifySession()` first** — middleware is not enough
3. **Every amount calculation uses `Decimal.js`** — no native JS arithmetic on `DECIMAL` fields
4. **Server Actions are thin** — validate (Zod) → auth check → call service → revalidate. No business logic inside actions
5. **`'use client'` boundary as low as possible** — default to Server Components, opt-in to Client Components at the leaf level
6. **R2 upload is a Route Handler, not a Server Action** — to avoid full request buffering
7. **Categorization pipeline has one call site** — `lib/services/import.ts` → `importFile()`. Not called from actions directly

---

## Sources

- Next.js 15/16 official docs — Route Groups, Data Fetching, Data Security, Authentication, Middleware/Proxy (fetched 2026-04-21, HIGH confidence)
- Drizzle ORM `sql` template literal pattern — from training data + business logic doc note (MEDIUM confidence — verify aggregation syntax against drizzle-orm docs at build time)
- NextAuth v5 middleware pattern — from training data, verified against Next.js auth guide (MEDIUM confidence — verify cookie name `next-auth.session-token` matches v5 default in actual auth.ts setup)
- Business Logic Handoff document — BUSINESS_LOGIC_HANDOFF.md (authoritative for Sparter-specific decisions)
