# Phase 2: Authentication - Pattern Map

**Mapped:** 2026-04-25
**Files analyzed:** 11 (new/modified files for Phase 2)
**Analogs found:** 9 / 11 (2 files have no codebase analog — rely on RESEARCH.md patterns)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `auth.ts` (root) | config | request-response | none | no-analog |
| `lib/db/index.ts` | config | CRUD | `lib/db/index.ts` (self — stub to replace) | self |
| `lib/db/schema.ts` | model | CRUD | `lib/db/schema.ts` (self — stub to populate) | self |
| `proxy.ts` | middleware | request-response | `proxy.ts` (self — stub to replace) | self |
| `app/api/auth/[...all]/route.ts` | route | request-response | none | no-analog |
| `lib/dal/auth.ts` | utility | request-response | `lib/db/index.ts` (server-only + import pattern) | partial |
| `lib/actions/auth.ts` | service | request-response | `app/(auth)/login/page.tsx` (form pattern) | partial |
| `lib/validations/auth.ts` | utility | transform | `lib/utils.ts` (utility module pattern) | partial |
| `lib/auth-client.ts` | config | request-response | `lib/utils.ts` (utility module pattern) | partial |
| `app/(auth)/login/page.tsx` | component | request-response | `app/(auth)/login/page.tsx` (self — static stub to wire) | self |
| `app/(auth)/register/page.tsx` | component | request-response | `app/(auth)/login/page.tsx` (closest sibling) | role-match |
| `components/layout/topbar.tsx` | component | request-response | `components/layout/topbar.tsx` (self — placeholder to wire) | self |
| `tests/auth.spec.ts` | test | request-response | `tests/layout.spec.ts` | role-match |

---

## Pattern Assignments

### `auth.ts` (root) — config, request-response

**Analog:** none in codebase. Use RESEARCH.md Pattern 1 directly.

**Key constraint from CLAUDE.md:** `auth.ts` must be at project root (D-12). Better Auth replaces NextAuth v5 — zero use of `next-auth`, `getServerSession`, `handlers`.

**Imports pattern to use** (from RESEARCH.md Pattern 1):
```typescript
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { db } from "@/lib/db"
```

**Critical:** `plugins: [nextCookies()]` must be last plugin. Without it, session cookies are not set in Server Actions and login/register silently fails (redirect to dashboard, then immediately back to login).

---

### `lib/db/index.ts` — config, CRUD (modify existing stub)

**Analog:** `lib/db/index.ts` (the stub being replaced)

**Existing stub** (lines 1–7 of current file):
```typescript
import 'server-only'

export const db =
  null as unknown as import('drizzle-orm/node-postgres').NodePgDatabase

export type DbOrTx = typeof db
```

**What to preserve:**
- `import 'server-only'` — MUST remain (CLAUDE.md rule)
- `export type DbOrTx` — must be updated after `db` is a real Drizzle instance (CLAUDE.md rule: all DAL helpers accept `DbOrTx`)

**Pattern to replace with** (RESEARCH.md Pattern 8):
```typescript
import "server-only"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 10,
  ssl:
    process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: true }
      : undefined,
})

export const db = drizzle(pool, { schema })

export type DbOrTx =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0]
```

**Note:** `DbOrTx` expands to include transaction type because `typeof db` is now a real Drizzle instance (replaces the one-liner stub type).

---

### `lib/db/schema.ts` — model, CRUD (modify existing stub)

**Analog:** `lib/db/schema.ts` (single-line comment placeholder being populated)

**Current content** (line 1):
```typescript
// Database schema placeholder. Tables are added by later phases.
```

**Drizzle config** (`drizzle.config.ts` lines 6–7) shows `schema: './lib/db/schema.ts'` — all table definitions live here.

**Workflow:** Run `npx @better-auth/cli@latest generate` first (outputs Drizzle PostgreSQL schema), then integrate the generated table definitions into this file. The CLI generates four tables: `user`, `session`, `account`, `verification`. The `user` table will include the custom columns `subscriptionPlan` and `role` from `additionalFields` in `auth.ts`.

**Import pattern for Drizzle PostgreSQL schema files**:
```typescript
import {
  pgTable,
  pgEnum,
  varchar,
  boolean,
  timestamp,
  text,
} from "drizzle-orm/pg-core"
```

---

### `proxy.ts` — middleware, request-response (modify existing stub)

**Analog:** `proxy.ts` (the stub being replaced)

**Existing stub** (lines 1–13 of current file):
```typescript
// Phase 1 placeholder.
// Next.js 16 uses proxy.ts instead of middleware.ts.
import { type NextRequest, NextResponse } from 'next/server'

export function proxy(_request: NextRequest) {
  // Phase 1: allow all requests through.
  // Phase 2: add Better Auth JWT checks and staging bypass header support.
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
```

**What to preserve:**
- Function name `proxy` (not `middleware`) — Next.js 16 requirement
- `config.matcher` value — already correct, do not change
- `NextRequest`, `NextResponse` imports from `'next/server'`

**Staging bypass pattern** (D-07, D-08 — MUST be first check):
```typescript
// D-07/D-08: Staging bypass FIRST, before any auth check
if (
  process.env.STAGING_KEY &&
  request.headers.get("x-staging-key") === process.env.STAGING_KEY
) {
  return NextResponse.next()
}
```

**Session check pattern** (RESEARCH.md Pattern 5):
```typescript
const session = await auth.api.getSession({
  headers: request.headers,
})
const isAuthenticated = !!session?.user
```

**Route guard logic:**
```typescript
const PUBLIC_ROUTES = ["/login", "/register"]
const AUTH_ROUTES = ["/login", "/register"]

// Redirect authenticated users away from auth pages
if (AUTH_ROUTES.includes(path) && isAuthenticated) {
  return NextResponse.redirect(new URL("/dashboard", request.nextUrl))
}
// Redirect unauthenticated users from protected pages
if (!PUBLIC_ROUTES.includes(path) && !isAuthenticated) {
  return NextResponse.redirect(new URL("/login", request.nextUrl))
}
return NextResponse.next()
```

**Note on runtime:** proxy.ts runs in Node.js runtime by default in Next.js 16. `auth.api.getSession()` requires Node.js (connects to PostgreSQL via Drizzle) — compatible. No `export const runtime = 'edge'` here.

---

### `app/api/auth/[...all]/route.ts` — route, request-response (new)

**Analog:** none in codebase. Use RESEARCH.md Pattern 2 directly.

**Complete file** (RESEARCH.md Pattern 2 — verbatim, this is the entire file):
```typescript
import { auth } from "@/auth"
import { toNextJsHandler } from "better-auth/next-js"

export const { GET, POST } = toNextJsHandler(auth)
```

**Note:** This is a catch-all route handler. Better Auth exposes `/api/auth/sign-in/email`, `/api/auth/sign-up/email`, `/api/auth/get-session`, etc. through this handler. No modification needed.

---

### `lib/dal/auth.ts` — utility, request-response (new)

**Analog:** `lib/db/index.ts` (only existing file with `import 'server-only'` and server-module pattern)

**`server-only` import pattern** (from `lib/db/index.ts` line 1):
```typescript
import 'server-only'
```

**Core `verifySession()` pattern** (RESEARCH.md Pattern 6):
```typescript
import "server-only"
import { cache } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/auth"

export const verifySession = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  if (!session?.user) {
    redirect("/login")
  }
  return {
    userId: session.user.id,
    email: session.user.email,
    subscriptionPlan: (session.user as any).subscriptionPlan as "free" | "basic" | "pro",
    role: (session.user as any).role as "user" | "admin",
  }
})
```

**`cache()` wrapper:** Wrapping with React's `cache()` deduplicates the `getSession` DB call within a single request lifecycle. Multiple DAL functions calling `verifySession()` in the same request only hit the DB once.

**D-10 requirement:** `userId` is returned and available for all Phase 3+ DAL queries.

---

### `lib/actions/auth.ts` — service, request-response (new)

**Analog:** No direct analog. Closest pattern source is RESEARCH.md Pattern 3. Project convention for server actions is `'use server'` thin wrappers in `lib/actions/`.

**`'use server'` directive** — must be first line of the file (Next.js App Router requirement).

**Core action pattern** (RESEARCH.md Pattern 3):
```typescript
'use server'
import { auth } from "@/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { LoginSchema, RegisterSchema } from "@/lib/validations/auth"

export type AuthActionState = { error: string | null }

export async function signInAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!parsed.success) {
    return { error: "Credenziali non valide. Riprova o contatta il supporto." }
  }
  try {
    await auth.api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password },
      headers: await headers(),
    })
  } catch {
    return { error: "Credenziali non valide. Riprova o contatta il supporto." }
  }
  redirect("/dashboard")
}
```

**Critical workaround — `name` field** (Pitfall 1 from RESEARCH.md): `auth.api.signUpEmail` requires a `name` field. D-01 collects only email + password. Pass `email` as `name` placeholder:
```typescript
await auth.api.signUpEmail({
  body: {
    email: parsed.data.email,
    password: parsed.data.password,
    name: parsed.data.email,  // Required by Better Auth — email as placeholder
  },
  headers: await headers(),
})
```

**Error messages** (from UI-SPEC and decisions):
- Login failure (D-05): `"Credenziali non valide. Riprova o contatta il supporto."`
- Register failure (D-06): `"Si è verificato un errore. Riprova."`

---

### `lib/validations/auth.ts` — utility, transform (new)

**Analog:** `lib/utils.ts` (utility module structure — named exports, no default export)

**Utility module pattern** (from `lib/utils.ts` lines 1–6):
```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Zod v4 schema pattern** (RESEARCH.md Pattern 4 — CRITICAL: v4 breaking changes):
```typescript
import { z } from "zod"

export const LoginSchema = z.object({
  email: z.email({ error: "Email non valida." }).trim(),
  password: z.string().min(8, { error: "Password troppo corta." }),
})

export const RegisterSchema = z.object({
  email: z.email({ error: "Email non valida." }).trim(),
  password: z.string().min(8, { error: "La password deve essere di almeno 8 caratteri." }),
})

export type LoginInput = z.infer<typeof LoginSchema>
export type RegisterInput = z.infer<typeof RegisterSchema>
```

**Zod v4 breaking changes to observe:**
- `z.email()` — top-level function (NOT `z.string().email()`)
- `{ error: "..." }` — key is `error` (NOT `message`)
- `z.enum()` for enums (NOT `z.nativeEnum()`)

---

### `lib/auth-client.ts` — config, request-response (new)

**Analog:** `lib/utils.ts` (utility module structure)

**Pattern** (RESEARCH.md Pattern 10):
```typescript
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000",
})
```

**Note:** This file is client-safe (no Node.js imports). Import path alias `@/lib/auth-client` is used in `topbar.tsx`.

---

### `app/(auth)/login/page.tsx` — component, request-response (modify existing stub)

**Analog:** `app/(auth)/login/page.tsx` (the stub itself)

**Existing stub structure** (lines 1–26 of current file):
```typescript
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-xl font-semibold">Accedi</h1>
        <p className="text-sm text-muted-foreground">
          Inserisci le tue credenziali per accedere.
        </p>
      </div>
      <form className="flex flex-col gap-3">
        <Input type="email" placeholder="Email" autoComplete="email" />
        <Input type="password" placeholder="Password" autoComplete="current-password" />
        <Button type="submit" className="w-full">Accedi</Button>
      </form>
    </div>
  )
}
```

**What to add:**
1. `'use client'` directive (required for `useActionState`)
2. `useActionState` hook from `"react"`
3. `signInAction` import from `@/lib/actions/auth`
4. `Alert`, `AlertDescription` from `@/components/ui/alert` — error banner (D-04)
5. `AlertCircle`, `Loader2` from `lucide-react`
6. `name` attributes on inputs (required for `FormData.get()` in server action)
7. `action={action}` on `<form>` (replaces no-action stub)
8. `disabled={isPending}` on Button + spinner icon
9. Link to `/register` at bottom

**`useActionState` pattern** (RESEARCH.md Pattern 7):
```typescript
const [state, action, isPending] = useActionState(signInAction, { error: null })
```

**Error banner pattern** (D-04 — inline, no per-field errors):
```tsx
{state.error && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>{state.error}</AlertDescription>
  </Alert>
)}
```

**Pending state on Button:**
```tsx
<Button type="submit" className="w-full" disabled={isPending}>
  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  Accedi
</Button>
```

---

### `app/(auth)/register/page.tsx` — component, request-response (new)

**Analog:** `app/(auth)/login/page.tsx` (sibling page — identical structure, different action and copy)

**Layout pattern** — use the exact same JSX structure as the wired `login/page.tsx`. Differences:
- `signUpAction` instead of `signInAction`
- CTA text: "Registrati" (D-03)
- Heading: "Registrati" or "Crea un account"
- `autoComplete="new-password"` on password field
- Link goes to `/login` instead of `/register`

**Auth layout integration** (`app/(auth)/layout.tsx` lines 1–16): The register page renders inside the same auth layout (logo + centered form) — no layout changes needed, this is automatic.

---

### `components/layout/topbar.tsx` — component, request-response (modify)

**Analog:** `components/layout/topbar.tsx` (self — placeholder data to replace with live session)

**Existing structure** (lines 1–50 of current file):
- Already `'use client'` (line 1)
- Avatar dropdown with hardcoded `"Utente"` / `"utente@example.com"` (lines 33–36)
- `AvatarFallback` hardcoded to `"U"` (line 26)
- Logout `DropdownMenuItem` has no `onClick` (line 43)

**What to add:**
1. `authClient` import from `@/lib/auth-client`
2. `useRouter` from `next/navigation` (for `router.refresh()` after signout if needed)
3. `signOutAction` import from `@/lib/actions/auth`
4. Session data wiring:

```typescript
const { data: session } = authClient.useSession()
const email = session?.user?.email ?? ""
const fallback = email.charAt(0).toUpperCase() || "U"
```

**Logout handler** (calls server action, redirect handled by action):
```typescript
<DropdownMenuItem
  className="text-destructive focus:text-destructive"
  onClick={() => signOutAction()}
>
  <LogOut className="mr-2 h-4 w-4" />
  Logout
</DropdownMenuItem>
```

**Session display** (replace hardcoded values at lines 33–36):
```tsx
<p className="text-sm font-medium">{email.split("@")[0] || "Utente"}</p>
<p className="text-xs text-muted-foreground">{email || "utente@example.com"}</p>
```

**Note on session reactivity** (RESEARCH.md Pitfall 5): After `signOutAction` the redirect to `/login` causes full page navigation, so the topbar stale state is cleared automatically. No `router.refresh()` needed for sign-out.

---

### `tests/auth.spec.ts` — test, request-response (new, Wave 0)

**Analog:** `tests/layout.spec.ts` (same test framework, same structure)

**Test file structure** (from `tests/layout.spec.ts` lines 1–47):
```typescript
import { expect, test } from '@playwright/test'

test.describe('Auth - AUTH-01: Registration', () => {
  test('description', async ({ page }) => {
    await page.goto('/register')
    // ...
    await expect(something).toBeVisible()
  })
})
```

**Playwright config** (`playwright.config.ts` lines 10–11):
- `baseURL: 'http://localhost:3000'` — use relative paths in `page.goto()`
- `workers: 1` — tests run sequentially (important for DB state)

**Test groups to create** (from RESEARCH.md Validation Architecture):
- `AUTH-01`: register happy path, invalid email, short password
- `AUTH-02`: login + session persistence after refresh, wrong credentials
- `AUTH-03`: unauthenticated redirect to `/login`, staging bypass header

**Staging bypass pattern for tests** (D-07, needed to fix `layout.spec.ts` `/dashboard returns 200` test):
```typescript
// Set x-staging-key header to bypass auth in test environment
await page.setExtraHTTPHeaders({ 'x-staging-key': process.env.STAGING_KEY ?? '' })
await page.goto('/dashboard')
```

**`tests/layout.spec.ts` update required:** The `/dashboard returns 200` test (line 27) will return 302 once proxy.ts is wired. Update to either:
- Check for redirect to `/login` (status 302), or
- Add staging bypass header before navigation

---

## Shared Patterns

### `'use client'` Directive
**Source:** `components/layout/topbar.tsx` line 1, `app/(auth)/login/page.tsx` (to be added)
**Apply to:** `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`, `components/layout/topbar.tsx`
```typescript
'use client'
```
Required for hooks (`useActionState`, `useSession`).

### `'use server'` Directive
**Source:** Next.js App Router convention
**Apply to:** `lib/actions/auth.ts`
```typescript
'use server'
```
Must be first line of server action files.

### `import 'server-only'`
**Source:** `lib/db/index.ts` line 1
**Apply to:** `lib/db/index.ts` (preserve), `lib/dal/auth.ts`
```typescript
import 'server-only'
```
Prevents server modules leaking to client bundle. CLAUDE.md rule — mandatory in all `lib/db/` and `lib/dal/` files.

### Path Alias `@/` Imports
**Source:** All existing files (`app/(auth)/login/page.tsx` lines 1–2, `app/(app)/layout.tsx` lines 1–3)
```typescript
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Topbar } from '@/components/layout/topbar'
```
Use `@/` for all project imports. No relative `../` paths except within the same directory.

### lucide-react Icon Imports
**Source:** `components/layout/topbar.tsx` lines 3
```typescript
import { LogOut, User } from 'lucide-react'
```
New icons for auth forms: `AlertCircle` (error banner), `Loader2` (spinner).

### shadcn UI Component Imports
**Source:** `app/(auth)/login/page.tsx` lines 1–2
```typescript
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
```
`Alert`/`AlertDescription` (for error banner) — not yet installed. May need `npx shadcn@latest add alert` before use.

### Error Handling in Server Actions
**Apply to:** `lib/actions/auth.ts`
Pattern: `try { await auth.api.* } catch { return { error: "generic message" } }`
Never re-throw auth errors to the client. Return opaque generic strings per D-05 and D-06.

### Decimal.js Rule (CLAUDE.md)
**NOT applicable to Phase 2** — no monetary arithmetic in auth flows. No `amount` fields touched.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `auth.ts` (root) | config | request-response | First Better Auth config file — no auth system existed before Phase 2 |
| `app/api/auth/[...all]/route.ts` | route | request-response | First API route in the project — no existing route handlers to copy from |

---

## Metadata

**Analog search scope:** Full project source tree (all `.ts`/`.tsx` files, excluding `node_modules`, `.next`, `.git`)
**Files scanned:** 29 source files
**Pattern extraction date:** 2026-04-25
**Key finding:** This is a greenfield phase — most files have no direct analog. The strongest patterns come from the existing stubs being replaced (`proxy.ts`, `lib/db/index.ts`, `app/(auth)/login/page.tsx`) and the test files (`tests/layout.spec.ts`, `tests/design-system.spec.ts`). All new logic patterns come from RESEARCH.md.
