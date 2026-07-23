# Phase 74: public-layout-and-proxy-allowlist - Pattern Map

**Mapped:** 2026-07-23
**Files analyzed:** 11
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/routes.ts` | config / utility | request-response (path SoT) | `lib/routes.ts` (`APP_ROUTES` object) | exact |
| `proxy.ts` | middleware | request-response | `proxy.ts` (live allowlist + session gate) | exact |
| `app/page.tsx` | route (delete) | request-response | `app/page.tsx` (current redirect-only root) | exact |
| `app/(public)/layout.tsx` | route / layout | request-response | `app/(auth)/layout.tsx` | role-match |
| `app/(public)/page.tsx` | route / page | request-response | `app/proto/branding/variant-c.tsx` (CTA pair only) | partial |
| `app/(public)/how-it-works/page.tsx` | route / page | request-response | `app/(auth)/layout.tsx` + stub contract | role-match |
| `app/(public)/privacy/page.tsx` | route / page | request-response | same stub pattern as how-it-works | role-match |
| `app/(public)/terms/page.tsx` | route / page | request-response | same stub pattern as how-it-works | role-match |
| `app/(public)/_components/site-header.tsx` | component | request-response | `components/layout/mobile-more-sheet.tsx` + Button `asChild` | role-match |
| `app/(public)/_components/site-footer.tsx` | component | request-response | `components/layout/mobile-more-sheet.tsx` (link list + routes) | role-match |
| `tests/proxy-auth.test.ts` | test | request-response | `tests/proxy-auth.test.ts` | exact |

**Anti-analogs (do not copy into `(public)`):**

| File | Why forbidden |
|------|----------------|
| `app/(app)/layout.tsx` | `verifySession`, onboarding gate, `AppShell` / `SidebarProvider` |
| `components/layout/app-shell.tsx` | sidebar + bottom nav app chrome |
| `components/layout/mobile-more-sheet.tsx` `side="bottom"` | UI-SPEC requires Sheet `side="right"` for public mobile nav |

---

## Pattern Assignments

### `lib/routes.ts` (config / utility, request-response)

**Analog:** `lib/routes.ts` (extend in place)

**Imports / object pattern** (lines 1–18) — keep `APP_ROUTES` untouched; add parallel named maps + derived arrays (D-05/D-06):

```typescript
import type { DashboardPreset, DashboardSort } from '@/lib/validations/dashboard'

export const APP_ROUTES = {
  dashboard: '/dashboard',
  // ... existing app paths — do NOT fold marketing into this object
} as const
```

**Core pattern to add** (from RESEARCH Pattern 1 — names locked by CONTEXT D-05):

```typescript
export const MARKETING_ROUTES = {
  home: '/',
  howItWorks: '/how-it-works',
  privacy: '/privacy',
  terms: '/terms',
} as const

export const AUTH_PAGE_ROUTES = {
  login: '/login',
  register: '/register',
} as const

export const PUBLIC_MARKETING_ROUTES = [
  MARKETING_ROUTES.home,
  MARKETING_ROUTES.howItWorks,
  MARKETING_ROUTES.privacy,
  MARKETING_ROUTES.terms,
] as const

export const AUTH_ROUTES = [
  AUTH_PAGE_ROUTES.login,
  AUTH_PAGE_ROUTES.register,
] as const

export const PUBLIC_ROUTES = [
  ...PUBLIC_MARKETING_ROUTES,
  ...AUTH_ROUTES,
] as const

export function isPublicPath(path: string): boolean {
  return (PUBLIC_ROUTES as readonly string[]).includes(path)
}

export function isAuthPath(path: string): boolean {
  return (AUTH_ROUTES as readonly string[]).includes(path)
}
```

**Href builder precedent** (lines 32–51) — chrome should use named constants, not new builders, except existing helpers stay as-is:

```typescript
export function buildDashboardCategoriesHref(filters: DashboardCategoryFilters = {}) {
  // ...
  return APP_ROUTES.dashboardCategories + (search ? `?${search}` : '')
}
```

**Error handling:** N/A — pure constants/helpers.

**Validation:** After edit, `yarn check:language` (routes / developer strings).

---

### `proxy.ts` (middleware, request-response)

**Analog:** `proxy.ts` (refactor in place)

**Imports pattern** (lines 1–2 today) — replace local arrays with SoT:

```typescript
import { type NextRequest, NextResponse } from 'next/server'
import { getAuthSessionOrNull } from '@/lib/auth-session'
import {
  APP_ROUTES,
  AUTH_PAGE_ROUTES,
  isAuthPath,
  isPublicPath,
  MARKETING_ROUTES,
} from '@/lib/routes'
```

**Auth / gate order** (lines 10–49) — **preserve blocks 1–2 verbatim**; then session; then AUTH bounce; then **new** smart-root; then anon gate:

```typescript
// 1. STAGING_KEY bypass FIRST (keep verbatim)
if (
  process.env.STAGING_KEY &&
  request.headers.get('x-staging-key') === process.env.STAGING_KEY
) {
  return NextResponse.next()
}

// 2. next-action short-circuit (keep verbatim) — must stay before session
if (request.headers.has('next-action')) {
  const saHeaders = new Headers(request.headers)
  saHeaders.set('x-pathname', request.nextUrl.pathname)
  saHeaders.set('x-search', request.nextUrl.search)
  return NextResponse.next({ request: { headers: saHeaders } })
}

const session = await getAuthSessionOrNull(request.headers)
const isAuthenticated = !!session?.user
const isPublicRoute = isPublicPath(path) || path.startsWith('/proto')

if (isAuthPath(path) && isAuthenticated) {
  return NextResponse.redirect(new URL(APP_ROUTES.dashboard, request.nextUrl))
}

// BRAND-05 / D-01 / D-02 — after session, before final next()
if (path === MARKETING_ROUTES.home && isAuthenticated) {
  return NextResponse.redirect(new URL(APP_ROUTES.dashboard, request.nextUrl))
}

if (!isPublicRoute && !isAuthenticated) {
  return NextResponse.redirect(new URL(AUTH_PAGE_ROUTES.login, request.nextUrl))
}
```

**Delete** (lines 4–5):

```typescript
const PUBLIC_ROUTES = ['/login', '/register']
const AUTH_ROUTES = ['/login', '/register']
```

**Header forward pattern** (lines 51–59) — keep after allowlist decisions:

```typescript
const requestHeaders = new Headers(request.headers)
requestHeaders.set('x-pathname', request.nextUrl.pathname)
requestHeaders.set('x-search', request.nextUrl.search)
return NextResponse.next({ request: { headers: requestHeaders } })
```

**Matcher** (lines 62–64) — unchanged.

**Exact match only (D-04):** use `isPublicPath(path)` / `.includes` — never `startsWith` for marketing; retain `path.startsWith('/proto')` only.

---

### `app/page.tsx` (route delete, request-response)

**Analog:** `app/page.tsx` (current owner of `/`)

**Current core pattern** (lines 1–5) — to be **removed** in the same change set as `app/(public)/page.tsx`:

```typescript
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/dashboard')
}
```

**Action:** Delete file entirely. Smart-root for auth users moves to `proxy.ts` only (D-01). Leaving this file alongside `(public)/page.tsx` causes Next.js conflicting-paths error.

---

### `app/(public)/layout.tsx` (route / layout, request-response)

**Analog:** `app/(auth)/layout.tsx` — sibling route-group chrome without AppShell

**Imports / shell pattern** (lines 1–16):

```typescript
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm px-4">
        <div className="mb-8 flex justify-center">
          <span className="text-2xl font-semibold tracking-tight text-foreground">Sparter</span>
        </div>
        {children}
      </div>
    </div>
  )
}
```

**Adapt for public (UI-SPEC shell):**

```typescript
import { SiteHeader } from './_components/site-header'
import { SiteFooter } from './_components/site-footer'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}
```

**Wordmark type continuity** from auth layout: `text-2xl font-semibold tracking-tight text-foreground`.

**Anti-pattern — do not import from** `app/(app)/layout.tsx` (lines 8–14, 21, 58–61):

```typescript
import { SidebarProvider } from "@/components/layout/sidebar-provider";
import { AppShell } from "@/components/layout/app-shell";
import { verifySession } from "@/lib/dal/auth";
// ...
const { userId, email, name, image } = await verifySession();
// ...
return (
  <SidebarProvider>
    <AppShell user={{ email, name, image }}>{children}</AppShell>
  </SidebarProvider>
);
```

**Session in layout:** none in Phase 74 (D-09 / UI-SPEC).

---

### `app/(public)/page.tsx` (route / page, request-response)

**Analog (partial):** `app/proto/branding/variant-c.tsx` — CTA pair + supporting line shape only; **do not** copy Fraunces, Image band, or benefit sections (D-12 / Phase 75).

**CTA pattern** (variant-c lines 19–26) — adapt paths to named constants; UI-SPEC wants `gap-4`:

```typescript
<div className="flex flex-wrap items-center justify-center gap-3">
  <Button asChild size="lg">
    <Link href="/register">Registrati</Link>
  </Button>
  <Button asChild size="lg" variant="outline">
    <Link href="/login">Entra</Link>
  </Button>
</div>
```

**Preferred href style** from `app/(app)/onboarding/_components/step-5-outro.tsx` (lines 20–29) — constants, not string literals:

```typescript
<Button asChild size="lg" className="w-full">
  <a href={APP_ROUTES.dashboard}>
    Vai alla dashboard
  </a>
</Button>
```

For public homepage use `Link` + `AUTH_PAGE_ROUTES.login` / `.register` + `MARKETING_ROUTES` for brand link if any.

**Homepage shell contract (D-11 / UI-SPEC):**

- Centered column: `max-w-xl mx-auto px-4 py-12 text-center`
- Brand “Sparter” (Geist only — no Fraunces)
- Supporting line: **Carica i tuoi estratti. Sparter li categorizza — senza collegare la banca.**
- CTA group: primary Registrati + outline Entra, `size="lg"`, `gap-4`
- **No** `redirect()` in this page — smart root is proxy-only (D-01)

---

### `app/(public)/how-it-works/page.tsx` | `privacy/page.tsx` | `terms/page.tsx` (route / page, request-response)

**Analog:** Minimal RSC page style (auth pages are thin wrappers) + D-10 stub contract. Closest structural simplicity: `app/(auth)/login/page.tsx` (thin page, no chrome).

**Stub core pattern** (shared across three files):

```typescript
import Link from 'next/link'
import { MARKETING_ROUTES } from '@/lib/routes'

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <h1 className="text-xl font-semibold text-foreground">Come funziona</h1>
      <p className="mt-4 text-base text-foreground">Contenuto in arrivo.</p>
      <Link
        href={MARKETING_ROUTES.home}
        className="mt-6 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        Torna alla home
      </Link>
    </div>
  )
}
```

| File | Heading copy |
|------|----------------|
| `how-it-works/page.tsx` | Come funziona |
| `privacy/page.tsx` | Privacy |
| `terms/page.tsx` | Termini |

**Forbidden:** Fake legal prose / GDPR claims (D-10).

---

### `app/(public)/_components/site-header.tsx` (component, request-response)

**Analog:** `components/layout/mobile-more-sheet.tsx` for Sheet + Link + `APP_ROUTES` inventory; `components/ui/sheet.tsx` default `side="right"`.

**Imports pattern** (mobile-more-sheet lines 1–6):

```typescript
'use client'

import Link from 'next/link'
import { FolderTree, Regex, Tags, User } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { APP_ROUTES } from '@/lib/routes'
```

**Adapt imports for public header:**

```typescript
'use client'

import Link from 'next/link'
import { Menu } from 'lucide-react' // X via Sheet close; UI-SPEC Menu / X
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  APP_ROUTES,
  AUTH_PAGE_ROUTES,
  MARKETING_ROUTES,
} from '@/lib/routes'
```

**Route-constant link list pattern** (mobile-more-sheet lines 8–20, 35–45) — close on navigate:

```typescript
const moreSheetItems = [
  { href: APP_ROUTES.categorySettings, label: 'Categorie', icon: FolderTree },
  // ...
]

<Link
  key={href}
  href={href}
  onClick={() => onOpenChange(false)}
  className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium ..."
>
```

**Sheet side:** UI default is already `"right"` (`components/ui/sheet.tsx` line 50). **Do not** copy `side="bottom"` from MobileMoreSheet (line 30).

**Sheet order (discretion + D-08):**  
`Come funziona → Entra → Registrati → separator → Privacy → Termini → Dashboard`  
(Dashboard last — app return; D-08 extends UI-SPEC inventory.)

**Desktop header slots (UI-SPEC):** wordmark → `/`; nav “Come funziona”; Entra `Button asChild variant="outline" size="sm"`; Registrati primary `size="sm"`. Sticky classes from UI-SPEC (`sticky top-0 z-40 border-b ... h-14 max-w-6xl`).

**a11y:** trigger `aria-label="Apri menu"`; close `aria-label="Chiudi menu"`.

**Colocation:** under `app/(public)/_components/` — same convention as `app/(app)/onboarding/_components/` (do **not** create `components/marketing/*`).

---

### `app/(public)/_components/site-footer.tsx` (component, request-response)

**Analog:** `components/layout/mobile-more-sheet.tsx` link inventory from routes constants; wordmark from `app/(auth)/layout.tsx`.

**Core pattern:** RSC-friendly footer (no Sheet required) — text links only:

```typescript
import Link from 'next/link'
import {
  APP_ROUTES,
  AUTH_PAGE_ROUTES,
  MARKETING_ROUTES,
} from '@/lib/routes'

// Structure per UI-SPEC: border-t, py-8, max-w-6xl mx-auto px-4 sm:px-6
// Links: Come funziona, Privacy, Termini, Entra, Registrati, Dashboard (D-08)
// Copyright: © {new Date().getFullYear()} Sparter — text-sm text-muted-foreground
```

**Link class:** `text-sm text-muted-foreground hover:text-foreground` (not primary Buttons).

**D-08:** Always-visible “Dashboard” → `APP_ROUTES.dashboard` in footer (desktop) and mobile Sheet (header). Anon click → proxy → `/login`.

---

### `tests/proxy-auth.test.ts` (test, request-response)

**Analog:** `tests/proxy-auth.test.ts` (extend in place)

**Harness pattern** (lines 1–21):

```typescript
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAuthSessionOrNull: vi.fn(),
}))

vi.mock('@/lib/auth-session', () => ({
  getAuthSessionOrNull: mocks.getAuthSessionOrNull,
}))

const { proxy } = await import('../proxy')

function request(path: string, headers?: Record<string, string>) {
  return new NextRequest(`https://app.example.test${path}`, { headers })
}
```

**Existing cases to keep** (lines 24–54): protected → login; anon login allowed; `next-action` skips session.

**Add D-07 cases** (from RESEARCH):

```typescript
it('allows anonymous marketing home without redirect to login', async () => {
  mocks.getAuthSessionOrNull.mockResolvedValue(null)
  const response = await proxy(request('/'))
  expect(response.status).toBe(200)
  expect(response.headers.get('location')).toBeNull()
})

it('redirects authenticated home to dashboard', async () => {
  mocks.getAuthSessionOrNull.mockResolvedValue({ user: { id: 'u1' } })
  const response = await proxy(request('/'))
  expect(response.status).toBe(307)
  expect(response.headers.get('location')).toBe('https://app.example.test/dashboard')
})

it('allows authenticated marketing deep link', async () => {
  mocks.getAuthSessionOrNull.mockResolvedValue({ user: { id: 'u1' } })
  const response = await proxy(request('/how-it-works'))
  expect(response.status).toBe(200)
  expect(response.headers.get('location')).toBeNull()
})

// Non-allowlisted gate already covered by '/dashboard' test — keep as regression
```

**Run:** `yarn vitest run tests/proxy-auth.test.ts`

---

## Shared Patterns

### Route constants as single source of truth
**Source:** `lib/routes.ts` (`APP_ROUTES` object style, lines 3–18)  
**Apply to:** `proxy.ts`, `site-header.tsx`, `site-footer.tsx`, stub pages, homepage CTAs  
- Chrome: `MARKETING_ROUTES.*`, `AUTH_PAGE_ROUTES.*`, `APP_ROUTES.dashboard`  
- Proxy: `isPublicPath` / `isAuthPath` / `PUBLIC_ROUTES` arrays  
- Never hard-code path string literals in chrome (D-06)

### Proxy early-return order
**Source:** `proxy.ts` lines 10–29  
**Apply to:** Any `proxy.ts` edit  
1. Staging key bypass  
2. `next-action` passthrough (set `x-pathname` / `x-search`, no session)  
3. Session + redirects  
4. Forward headers on `next()`

### Session helper
**Source:** `proxy.ts` line 32 + `@/lib/auth-session`  
**Apply to:** Proxy only in this phase — not `(public)` layout  

```typescript
const session = await getAuthSessionOrNull(request.headers)
const isAuthenticated = !!session?.user
```

### Button asChild + navigation
**Source:** `app/proto/branding/variant-c.tsx` lines 20–25; `step-5-outro.tsx` lines 20–29  
**Apply to:** Header actions, homepage shell CTAs  

```typescript
<Button asChild size="sm"> {/* or size="lg" on homepage */}
  <Link href={AUTH_PAGE_ROUTES.register}>Registrati</Link>
</Button>
<Button asChild size="sm" variant="outline">
  <Link href={AUTH_PAGE_ROUTES.login}>Entra</Link>
</Button>
```

### Sheet + close-on-navigate
**Source:** `components/layout/mobile-more-sheet.tsx` lines 27–48  
**Apply to:** Mobile nav in `site-header.tsx`  
- Reuse shadcn Sheet primitives  
- Use default / explicit `side="right"` (not bottom)  
- `onClick={() => onOpenChange(false)}` on each Link  

### Wordmark typography
**Source:** `app/(auth)/layout.tsx` line 10  
**Apply to:** Header + footer brand  

```typescript
<span className="text-2xl font-semibold tracking-tight text-foreground">Sparter</span>
```

(Prefer `Link` wrapping wordmark → `MARKETING_ROUTES.home`.)

### Colocated `_components/` under route group
**Source:** `app/(app)/onboarding/_components/*`  
**Apply to:** `app/(public)/_components/site-header.tsx`, `site-footer.tsx`  
- Client islands only where needed (`'use client'` for Sheet)  
- Footer can stay RSC  

### Language convention
**Source:** `CLAUDE.md` / `AGENTS.md`  
**Apply to:** All Phase 74 files  
- English route slugs / identifiers / comments  
- Italian UI labels only (`Come funziona`, `Entra`, `Registrati`, stub copy)  
- Run `yarn check:language` after route/string touches  

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | All Phase 74 files have a usable analog. Sticky marketing header chrome has no prior sticky `top-0` header in app layout (AppShell has no top bar) — follow **74-UI-SPEC.md** classes directly; compose from auth wordmark + MobileMoreSheet Sheet + Button patterns above. |

---

## Metadata

**Analog search scope:** `lib/routes.ts`, `proxy.ts`, `app/page.tsx`, `app/(auth)/`, `app/(app)/layout.tsx`, `app/(app)/onboarding/_components/`, `app/proto/branding/`, `components/layout/`, `components/ui/sheet.tsx`, `tests/proxy-auth.test.ts`  
**Files scanned:** ~25 primary + grep hits for Sheet / Button asChild  
**Pattern extraction date:** 2026-07-23  
**UI contract:** `.planning/phases/74-public-layout-and-proxy-allowlist/74-UI-SPEC.md` (approved) — chrome spacing/typography/copy are authoritative; D-08 adds Dashboard to footer + Sheet  
