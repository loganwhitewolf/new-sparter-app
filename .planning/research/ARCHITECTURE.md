# Architecture Patterns — Sparter

**Domain:** Personal finance web app (Italian market)
**Researched:** 2026-04-22
**Stack:** Next.js 16 App Router, Drizzle ORM + MySQL, Better Auth, Cloudflare R2, Tailwind + shadcn/ui

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
│   │       ├── analyze/page.tsx   # Detection + preview
│   │       └── confirm/page.tsx   # Confirm platform/version + trigger import
│   ├── categories/page.tsx
│   └── profile/page.tsx
│
├── api/                           # Route handlers (HTTP only)
│   └── files/
│       ├── initiate/route.ts      # Create file record + presigned PUT URL
│       └── confirm/route.ts       # Confirm browser upload finished
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
│   ├── platforms.ts
│   ├── import-formats.ts
│   ├── dashboard.ts
│   └── users.ts
│
├── services/                      # Business logic — server-only
│   ├── categorization.ts          # 2-tier pipeline
│   ├── import.ts                  # analyzeFile, importFile
│   ├── import-format-detector.ts  # score platform + format version candidates
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
└── auth.ts                        # Better Auth config + server helpers

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

### Decision: Presigned Upload + Analyze/Preview + Confirmed Import

The import pipeline involves a browser-direct upload to R2, a server-side analysis/preview step, and a transactional DB import. Since v1 has no job runner, parsing and DB writes run synchronously in the request cycle after the user confirms the preview.

**Phase 1 — Upload Init + Browser PUT (Route Handlers + R2)**

```
Browser selects CSV/XLSX
    │
    ▼
POST /api/files/initiate            ← Route Handler, small JSON request
    │  verifies session + file metadata
    │  inserts file record status='pending'
    │  creates storageKey uploads/{userId}/{fileId}.{ext}
    │  generates presigned PUT URL
    └─ returns { fileId, presignedUrl }

Browser PUT presignedUrl            ← direct to Cloudflare R2, no app-server proxy
    │
    ▼
POST /api/files/confirm { fileId }  ← backend verifies object exists, then confirms upload
```

Route Handlers are used to create and confirm upload intent; the binary bytes never pass through a Server Action or Next.js route. This avoids body-size limits and keeps R2 as the only file sink.

The frontend is allowed to call R2 only with the short-lived presigned URL generated by the backend. It never receives R2 credentials and does not choose the `storageKey`; `storageKey` remains a backend/internal `files` table detail used later by analysis and import services.

**UI contract:** the user sees this as one upload flow. The upload component orchestrates initiate → PUT to R2 → confirm behind the scenes and exposes states such as `idle`, `validating`, `preparing`, `uploading`, `confirming`, `uploaded`, `analyzing`, and `error`. With `XMLHttpRequest` the UI can show upload progress; with `fetch` it can show an indeterminate loading state. After `confirm`, the UI proceeds to `/import/[fileId]/analyze` or triggers `analyzeFileAction(fileId)`.

**Phase 2 — Analyze + Preview (Server Action)**

```
Client receives fileId
    │
    ▼
Server Action: analyzeFileAction(fileId)
    │  calls lib/services/import.ts → analyzeFile()
    │    └─ downloads/streams from R2
    │    └─ detects columns, headers, delimiter, date format, currency, amount shape
    │    └─ calls detectImportFormat()
    │    └─ parses a sample with the best matching format version
    │    └─ computes row count + duplicate count
    └─ returns {
         detectedPlatformId,
         detectedFormatVersionId,
         confidence,
         candidates,
         rowCount,
         duplicateCount,
         sampleRows,
         parserWarnings
       }
```

The data model separates bank/payment platforms from import format versions. A platform can have multiple active or deprecated format versions, each with column mapping, detection rules, parser options, and validity status.

**Phase 3 — Confirmed Import (Server Action)**

```
User confirms detected platform + format version
    │
    ▼
Server Action: importFileAction(fileId, platformId, formatVersionId)
    │  calls lib/services/import.ts → importFile()
    │    └─ wraps the full import in db.transaction(async (tx) => ...)
    │    └─ updates file.status = 'processing'
    │    └─ streams rows from R2 with the selected format-version parser
    │    └─ for each row:
    │         maps columns via selected format version
    │         normalizes amount/date/description
    │         generates transactionHash → skip if exists (dedup)
    │         normalizes description → descriptionHash
    │         findOrCreate Expense
    │         insert Transaction
    │         run Tier 1 regex + Tier 2 history categorization if subscription allows
    │    └─ updates file.status = 'done' | 'error'
    └─ revalidatePath('/transactions'), revalidatePath('/dashboard')
```

### ASCII Flow Diagram

```
Browser
  │
  │  Step 1: Initiate upload
  ├──POST /api/files/initiate ──────────────────────────────────────────────┐
  │                                                                         │
  │  lib/dal/files.ts                                                       │
  │  insert({ status:'pending', storageKey })  ───► MySQL                  │
  │                                                                         │
  │  lib/services/r2.ts                                                     │
  │  createPresignedPutUrl(storageKey) ───────────► Cloudflare R2          │
  │                                                                         │
  │  return { fileId, presignedUrl } ◄──────────────────────────────────────┘
  │
  ├──PUT presignedUrl ─────────────────────────────► Cloudflare R2
  │
  ├──POST /api/files/confirm { fileId }
  │    HEAD/check object(storageKey) ─────────────── Cloudflare R2
  │    update file upload metadata ───────────────── MySQL
  │
  │  Step 2: Analyze + preview (Server Action)
  ├──analyzeFileAction(fileId)
  │    lib/services/import.ts → analyzeFile()
  │      getObject(storageKey) ──────────────────── Cloudflare R2
  │      detect columns/header/dates/delimiter/currency
  │      detectImportFormat() ───────────────────── MySQL (platforms + format versions)
  │      dry-run parse + duplicate checks ───────── MySQL
  │    return { detectedPlatform, detectedFormatVersion, confidence, rowCount,
  │             duplicateCount, sampleRows, candidates }
  │
  │  User confirms platform + format version
  │
  │  Step 3: Import (Server Action)
  └──importFileAction(fileId, platformId, formatVersionId)
       lib/services/import.ts → importFile()
         db.transaction(tx => ...)
           file.status = 'processing' ───────────── MySQL
           for each parsed row:
             transactionHash check ──────────────── MySQL (skip dup)
             findOrCreateExpense() ──────────────── MySQL
             insertTransaction() ────────────────── MySQL
             runCategorizationPipeline() ────────── MySQL
           file.status = 'done' | 'error' ───────── MySQL
       revalidatePath('/dashboard')
```

### Why Not a Single Server Action for Upload?

Server Actions process `FormData` synchronously on the server but are not designed for binary file transfer. Browser-direct presigned PUT keeps upload bandwidth away from the app server, avoids body-size limits, and still gives the app a durable `files` row for audit, status, and analysis.

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

Next.js 16 uses `proxy.ts` for route interception. Older docs and examples may still refer to `middleware.ts`; use the Next.js 16 naming in v1.

### Recommended Middleware Structure

```typescript
// proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/session'   // or the verified Better Auth JWT/session helper

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

  // --- Read session token/cookie without touching the DB ---
  const sessionCookie = req.cookies.get('sparter.session')?.value
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

### Notes on Better Auth + Proxy

Research the current Better Auth API during Phase 2 before locking the exact helper and cookie names. The custom proxy approach above is preferred for Sparter because:
1. It allows the staging bypass header check before any auth logic
2. It avoids importing DB-backed auth adapter code into the Edge runtime — keep proxy credential-light
3. Explicit control over redirect behavior with `callbackUrl`

### Security Principle

Middleware is optimistic protection only — it reads the cookie without a DB round-trip. Every Server Action and DAL function still calls `verifySession()` independently. Middleware is not the last line of defense.

```
Request
   │
   ▼
proxy.ts (JWT/session cookie check — no DB)
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
│  proxy.ts                                                           │
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
│  Route Handlers /api/files/initiate + /api/files/confirm            │
│  └── create file record + presigned R2 upload URL                   │
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
│  files.ts        │  │  import-format- │
│  platforms.ts    │  │  detector.ts    │
│  import-formats  │  │  r2.ts          │
│  users.ts        │  │                 │
│  auth.ts         │  │                 │
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
          │  importFormatVers. │
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
  → lib/auth.ts (Better Auth config + helpers)
  → proxy.ts (route protection)
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
  → /api/files/initiate/route.ts + /api/files/confirm/route.ts (presigned R2 upload)
  → lib/services/r2.ts
  → lib/services/import.ts (analyzeFile, importFile)
  → lib/services/import-format-detector.ts (platform + format-version detection)
  → lib/services/categorization.ts (Tier 1 + 2 pipeline)
  → (app)/import/ multi-step flow
  DEPENDS ON: Phase 3 (creates expenses + transactions)

Phase 6 — Import advanced
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
- Better Auth integration — verify against current official Better Auth docs during Phase 2 before locking helper names, cookie names and session shape
- Business Logic Handoff document — BUSINESS_LOGIC_HANDOFF.md (authoritative for Sparter-specific decisions)
