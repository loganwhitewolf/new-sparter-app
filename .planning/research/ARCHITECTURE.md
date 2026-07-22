# Architecture Research

**Domain:** Public branding site inside existing Sparter Next.js 16 App Router monolith (v2.8)
**Researched:** 2026-07-22
**Confidence:** HIGH (grounded in live codebase; routing/SEO patterns are standard Next.js)

## Standard Architecture

### System Overview

Sparter today is a single Next.js deploy with three route surfaces and one edge proxy gate:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         app/layout.tsx (root)                            │
│   ThemeProvider · fonts · globals.css · default Metadata · Toaster       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  (public)    │  │   (auth)     │  │    (app)     │  │   proto/   │ │
│  │  NEW v2.8    │  │  login/reg   │  │  dashboard+  │  │  preview   │ │
│  │  marketing   │  │  centered    │  │  AppShell    │  │  throwaway │ │
│  │  no session  │  │  no session  │  │  verifySession│  │  env gate  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘ │
│         │                 │                 │                 │        │
├─────────┴─────────────────┴─────────────────┴─────────────────┴────────┤
│                            proxy.ts (request gate)                       │
│  STAGING_KEY bypass → session via getAuthSessionOrNull → allowlist/redirect│
└─────────────────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
   Anonymous OK on                    Authenticated OK on
   PUBLIC_ROUTES + /proto             all non-auth-marketing paths
   (after v2.8 expansion)             (app) routes; auth pages → /dashboard
```

**v2.8 adds `(public)`** — a fourth sibling route group at the same depth as `(auth)` and `(app)`. It must stay **outside** `(app)` so marketing never runs `verifySession`, the onboarding gate, or `AppShell`.

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `proxy.ts` | Session boundary; public allowlist; auth-page redirect; smart root for `/`; forwards `x-pathname` / `x-search` | Extend `PUBLIC_ROUTES`; add `path === '/' && isAuthenticated → /dashboard` |
| `app/(public)/layout.tsx` | Marketing chrome (header, footer, nav); shared SEO defaults; **no DB, no session** | Static RSC layout; optional `metadata` export |
| `app/(public)/page.tsx` | Homepage hero, product pitch, CTAs to `/login` and `/register` | Static Server Component; Italian copy, English route |
| `app/(auth)/layout.tsx` | Minimal centered auth shell (unchanged) | Existing layout — do not merge with public |
| `app/(app)/layout.tsx` | Authenticated shell + onboarding gate (unchanged) | Only receives requests that passed proxy for logged-in users |
| `app/proto/layout.tsx` | Design sandbox; `PROTOTYPES_ENABLED` gate; `noindex` | 2–3 branding variants before production |
| `lib/routes.ts` | Canonical path constants for links and proxy allowlist | Add `PUBLIC_MARKETING_ROUTES` (or export shared `PUBLIC_ROUTES`) |
| `components/marketing/*` | Reusable hero, feature grid, CTA, legal prose shell | Promoted from winning proto variant |

## Recommended Project Structure

```
app/
├── layout.tsx                    # root — unchanged except optional metadata polish
├── (public)/                     # NEW — v2.8 marketing surface
│   ├── layout.tsx                # marketing shell (header/footer)
│   ├── page.tsx                  # `/` homepage (replaces app/page.tsx)
│   ├── how-it-works/
│   │   └── page.tsx              # `/how-it-works` (Italian UI, English slug)
│   ├── privacy/
│   │   └── page.tsx              # `/privacy`
│   └── terms/
│       └── page.tsx              # `/terms`
├── (auth)/                       # unchanged
│   ├── layout.tsx
│   ├── login/page.tsx
│   └── register/page.tsx
├── (app)/                        # unchanged — no marketing routes here
│   └── ...
├── proto/                        # design-first variants
│   ├── layout.tsx                # existing env gate + noindex
│   ├── branding-a/page.tsx       # variant A (example)
│   ├── branding-b/page.tsx       # variant B
│   └── branding-c/page.tsx       # variant C (optional)
└── page.tsx                      # DELETE — superseded by (public)/page.tsx

components/
└── marketing/                    # NEW — promoted from winning proto
    ├── site-header.tsx
    ├── site-footer.tsx
    ├── hero.tsx
    └── ...

lib/
└── routes.ts                     # MODIFY — add public marketing constants

proxy.ts                          # MODIFY — allowlist + smart root
next.config.ts                    # OPTIONAL — Italian slug redirects only
```

### Structure Rationale

- **`(public)` sibling to `(auth)` / `(app)`:** Route groups do not affect URLs but control which layout runs. Marketing needs its own chrome and must not inherit `(app)`'s `verifySession()` (which redirects unauthenticated users to `/login`).
- **English URL segments:** Per `AGENTS.md` / `CLAUDE.md`, new public paths use English slugs (`/how-it-works`, `/privacy`, `/terms`). Italian product copy lives in page content; legacy Italian URLs, if desired later, belong only in `next.config.ts` redirects or `lib/routes.ts` — not as primary routes.
- **`app/page.tsx` removal:** Two files cannot both own `/`. Today `app/page.tsx` unconditionally `redirect('/dashboard')`; v2.8 replaces it with `(public)/page.tsx`.
- **`components/marketing/`:** Keeps proto throwaways separate from production imports. Proto pages may inline styles for speed; production pulls shared pieces from here after PO sign-off.
- **Proto stays under `app/proto/`:** Already exempt in `proxy.ts`, already `noindex`, already Preview-gated — zero auth/onboarding coupling.

## Architectural Patterns

### Pattern 1: Proxy allowlist + layout isolation

**What:** All anonymous-accessible HTML routes are enumerated in `proxy.ts`. Everything else requires a Better Auth session. Layout groups enforce orthogonal concerns (marketing vs auth vs app).

**When to use:** Every new public HTML route in Sparter.

**Trade-offs:** Single source of truth in proxy; must keep `lib/routes.ts` in sync. Duplicating allowlist logic in layouts is an anti-pattern.

**Example:**

```typescript
// lib/routes.ts — single canonical list
export const PUBLIC_MARKETING_ROUTES = [
  '/',
  '/how-it-works',
  '/privacy',
  '/terms',
] as const

export const PUBLIC_ROUTES = [
  ...PUBLIC_MARKETING_ROUTES,
  '/login',
  '/register',
] as const

// proxy.ts
import { PUBLIC_ROUTES } from '@/lib/routes'

const isPublicRoute =
  PUBLIC_ROUTES.includes(path) || path.startsWith('/proto')

// Smart root — authenticated users skip marketing
if (path === '/' && isAuthenticated) {
  return NextResponse.redirect(new URL('/dashboard', request.nextUrl))
}
```

### Pattern 2: Smart root at proxy (not in `(app)` layout)

**What:** `/` shows marketing to anonymous visitors; authenticated users redirect to `/dashboard` before any RSC runs.

**When to use:** Root URL shared by marketing and product entry.

**Trade-offs:** Proxy runs session lookup on every `/` hit (already true for all routes). Avoids `verifySession()` in public pages (which would send anon users to login). Mirrors existing auth-route redirect (`/login` + session → `/dashboard`).

**Do not:** Keep `app/page.tsx` as `redirect('/dashboard')` — that breaks anonymous homepage entirely.

**Alternative considered — RSC-only smart root:**

```typescript
// app/(public)/page.tsx
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getAuthSessionOrNull } from '@/lib/auth-session'

export default async function HomePage() {
  const session = await getAuthSessionOrNull(await headers())
  if (session?.user) redirect('/dashboard')
  return <HomeMarketing />
}
```

Works only if `/` is already in `PUBLIC_ROUTES`. Prefer **proxy redirect for auth users** (consistent with auth pages) plus static marketing page for anon — avoids `force-dynamic` on homepage.

### Pattern 3: Static marketing, dynamic proto

**What:** Production `(public)/*` pages are static Server Components (default). Proto subtree keeps `export const dynamic = 'force-dynamic'` for `PROTOTYPES_ENABLED` runtime gate.

**When to use:** Marketing has no per-user data; proto must 404 in Production even after merge.

**Trade-offs:** Marketing pages cache well on Vercel CDN; proto pays request-time env check intentionally.

**Example — public page metadata (indexable):**

```typescript
// app/(public)/how-it-works/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Come funziona — Sparter',
  description: 'Importa estratti conto, categorizza le spese, monitora le deviazioni.',
}

export default function HowItWorksPage() {
  return (/* static Italian content */)
}
```

**Contrast — app/settings (existing noindex pattern):**

```typescript
export const metadata = { robots: 'noindex, nofollow' }
```

Marketing pages should **not** use `noindex` — they are the public façade for SEO and sharing.

### Pattern 4: Proto → production promotion pipeline

**What:** Design exploration in `app/proto/branding-*`; after PO picks a direction, extract components into `components/marketing/` and wire production routes under `(public)/`.

**When to use:** Milestone Phase 1 (PROJECT.md: proto variants first).

**Trade-offs:** Short-term duplication between proto and production; clean separation prevents shipping Preview-only env gates to Production.

**Flow:**

```
PO reviews /proto/branding-{a,b,c} on Vercel Preview (PROTOTYPES_ENABLED=1)
    ↓ pick winner
Extract shared UI → components/marketing/*
    ↓
Implement app/(public)/* using extracted components
    ↓
Delete losing proto variants; keep or archive winner notes in planning artifact
```

Proto routes remain `/proto/branding-a` etc. — **not** `/proto/` as production paths. Production URLs are the English slugs at repo root.

## Data Flow

### Request Flow (anonymous homepage)

```
Browser GET /
    ↓
proxy.ts — no session → isPublicRoute true → next()
    ↓
app/layout.tsx (ThemeProvider)
    ↓
app/(public)/layout.tsx (marketing header/footer)
    ↓
app/(public)/page.tsx (static HTML — hero, CTAs)
    ↓
Response 200 (static / ISR-eligible)
```

### Request Flow (authenticated homepage)

```
Browser GET /
    ↓
proxy.ts — session present → redirect 307 /dashboard
    ↓
(app)/layout.tsx — verifySession, onboarding gate, AppShell
    ↓
/dashboard/*
```

### Request Flow (anonymous → protected app)

```
Browser GET /dashboard (no session)
    ↓
proxy.ts — not public → redirect /login
    ↓
(auth)/layout.tsx → login page
```

### Request Flow (marketing CTA)

```
Homepage "Registrati" link → /register (already PUBLIC_ROUTES)
    ↓
(auth)/layout.tsx — centered form
    ↓
Post-auth: proxy redirects /register → /dashboard (existing behavior)
```

### State Management

No client global state required. Marketing is stateless RSC. Theme follows existing `ThemeProvider` in root layout. No DAL, services, or server actions on public pages unless a future contact form is added (out of v2.8 scope).

### Key Data Flows

1. **Session boundary:** `proxy.ts` → `getAuthSessionOrNull` (Node runtime, Better Auth). Public pages never call `verifySession()` from `lib/dal/auth.ts`.
2. **Onboarding gate:** Only `(app)/layout.tsx` reads `x-pathname` and queries transaction count. Public routes never receive `(app)` layout — gate is bypassed by structure, not by exemption list changes.
3. **SEO metadata:** Root `metadata` in `app/layout.tsx` provides defaults; `(public)/layout.tsx` can set `openGraph`; per-page exports override `title` / `description`. No `generateMetadata` async fetch needed for v2.8 (static legal copy).

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–1k users | Current monolith is sufficient. Static marketing pages on Vercel edge. |
| 1k–100k users | Marketing static assets scale on CDN automatically. Session check in proxy remains cheap. |
| 100k+ users | If marketing traffic dwarfs app traffic, optional split to `www` subdomain — **not warranted for personal finance v1.x**. |

### Scaling Priorities

1. **First bottleneck:** None expected for static marketing. Proxy session lookup is already on every request.
2. **Second bottleneck:** If legal/homepage assets grow heavy, use `next/image` and lazy sections — not a separate deploy.

## Anti-Patterns

### Anti-Pattern 1: Marketing inside `(app)`

**What people do:** Add `app/(app)/page.tsx` or a `/home` route under the authenticated group.

**Why it's wrong:** `(app)/layout.tsx` calls `verifySession()` — anonymous visitors redirect to `/login`. Onboarding gate adds DB queries on every hit.

**Do this instead:** `(public)` route group at `app/(public)/`.

### Anti-Pattern 2: Reusing `(auth)/layout.tsx` for marketing

**What people do:** Share the centered minimal layout because it "looks clean."

**Why it's wrong:** Auth layout is form-focused (max-w-sm, no nav/footer). Marketing needs site navigation, hero width, legal footer links.

**Do this instead:** Dedicated `(public)/layout.tsx`. Link visually via shared logo typography only.

### Anti-Pattern 3: Italian primary URL slugs

**What people do:** Ship `/come-funziona`, `/termini` as canonical paths.

**Why it's wrong:** Violates project language convention (`AGENTS.md`); inconsistent with `/expenses`, `/settings/categories`.

**Do this instead:** Canonical English slugs; Italian strings in UI; optional redirects:

```typescript
// next.config.ts (optional, later)
async redirects() {
  return [
    { source: '/come-funziona', destination: '/how-it-works', permanent: true },
    { source: '/termini', destination: '/terms', permanent: true },
  ]
}
```

### Anti-Pattern 4: `force-dynamic` on production marketing

**What people do:** Copy proto layout's `dynamic = 'force-dynamic'` into `(public)`.

**Why it's wrong:** Disables static generation/CDN caching for no benefit — production has no env gate.

**Do this instead:** Default static RSC. Reserve `force-dynamic` for `app/proto/` only.

### Anti-Pattern 5: Smart root only in RSC without proxy allowlist

**What people do:** Implement session branch in `page.tsx` but forget to add `/` to `PUBLIC_ROUTES`.

**Why it's wrong:** Anonymous `GET /` hits proxy first → not public → redirect `/login` → marketing never renders.

**Do this instead:** Expand allowlist **before** shipping `(public)/page.tsx`.

### Anti-Pattern 6: Shipping proto paths as production URLs

**What people do:** Link stakeholders to `/proto/branding-a` and later rename to production.

**Why it's wrong:** Proto is `noindex`, Preview-gated, and semantically throwaway.

**Do this instead:** Production routes at `/`, `/how-it-works`, etc.; proto deleted or left for future spikes.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Vercel | Same deploy as app | Marketing and app share domain — no CORS issues for CTAs |
| Better Auth | Session read in `proxy.ts` only for public pages | Public RSC must not import `verifySession` |
| Search engines | `metadata` + default `robots: index` on `(public)` | Contrast with `(app)` / `settings` noindex pattern |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `(public)` ↔ `(auth)` | `<Link href="/login">` / `/register` | No shared layout; visual brand consistency via components |
| `(public)` ↔ `(app)` | CTAs → login; post-auth proxy → `/dashboard` | Marketing never imports `APP_ROUTES` app internals beyond auth paths |
| `proto/` ↔ `(public)` | Manual component promotion | Proto not imported by production at build time — copy/refactor after pick |
| `proxy.ts` ↔ `lib/routes.ts` | Import shared `PUBLIC_ROUTES` | Prevents drift between allowlist and link constants |
| `proxy.ts` ↔ `(app)/layout.tsx` | `x-pathname` header | Unchanged — public routes do not enter `(app)` layout |

### New vs Modified (explicit)

| File / area | Action | Purpose |
|-------------|--------|---------|
| `app/(public)/layout.tsx` | **New** | Marketing shell |
| `app/(public)/page.tsx` | **New** | Homepage at `/` |
| `app/(public)/how-it-works/page.tsx` | **New** | Product explainer |
| `app/(public)/privacy/page.tsx` | **New** | Privacy policy |
| `app/(public)/terms/page.tsx` | **New** | Terms of service |
| `components/marketing/*` | **New** | Shared UI from proto winner |
| `app/proto/branding-{a,b,c}/` | **New** | Design variants (Phase 1) |
| `proxy.ts` | **Modify** | `PUBLIC_ROUTES` expansion + smart root `/` redirect |
| `lib/routes.ts` | **Modify** | Marketing route constants (+ optional helpers) |
| `app/page.tsx` | **Delete** | Replaced by `(public)/page.tsx` |
| `next.config.ts` | **Optional modify** | Italian legacy redirects |
| `app/layout.tsx` | **Optional modify** | Richer default `metadata` / `openGraph` |
| `app/(auth)/layout.tsx` | **Unchanged** | |
| `app/(app)/layout.tsx` | **Unchanged** | |
| `app/proto/layout.tsx` | **Unchanged** | Reuse as-is for branding protos |

### Suggested Build Order

Dependencies flow proto → infrastructure → pages → cleanup.

| Step | Work | Depends on | Delivers |
|------|------|------------|----------|
| 1 | Proto variants `app/proto/branding-{a,b,c}` | — | PO-visible design options on Preview |
| 2 | PO picks direction; extract `components/marketing/*` | Step 1 | Reusable production building blocks |
| 3 | `lib/routes.ts` — add `PUBLIC_MARKETING_ROUTES` / `PUBLIC_ROUTES` | — | Canonical paths for links + proxy |
| 4 | `proxy.ts` — import allowlist; smart root redirect for `/` | Step 3 | Anonymous can hit `/`; auth users → dashboard |
| 5 | `app/(public)/layout.tsx` | Step 2 | Marketing chrome |
| 6 | Static legal pages `/privacy`, `/terms` | Steps 3–5 | Lowest-risk pages; footer links |
| 7 | `/how-it-works` page | Steps 2–5 | Product narrative |
| 8 | `(public)/page.tsx` homepage | Steps 2–5 | Hero + CTAs |
| 9 | Delete `app/page.tsx` | Step 8 | Single owner of `/` |
| 10 | Optional `next.config.ts` Italian redirects | Steps 6–8 | Back-compat URLs |
| 11 | Delete losing proto variants | Step 2 sign-off | Repo hygiene |

**Critical path:** Steps 3–4 must land **before** Step 8 is deployed — otherwise anonymous `/` still redirects to `/login`.

**Parallelizable:** Step 1 (proto) runs fully parallel to Steps 3–4 (infra) until PO pick merges UI with routes.

### Relationship to `(auth)` Layout

| Aspect | `(public)` | `(auth)` |
|--------|------------|----------|
| Session required | No | No |
| Layout purpose | Full-site marketing | Login/register forms |
| Width / structure | Full-width, nav + footer | Centered card, max-w-sm |
| Post-login behavior | N/A (CTA sends to auth routes) | Proxy redirects to `/dashboard` |
| Shared ancestor | `app/layout.tsx` (theme, toaster) | Same |

No merge of layouts. Optional: `(public)` header "Accedi" links to `/login` — same entry as today.

### SEO Metadata Strategy

| Page | `title` | `robots` | Rendering |
|------|---------|----------|-----------|
| `/` | Sparter — [tagline] | index, follow (default) | Static |
| `/how-it-works` | Come funziona — Sparter | index, follow | Static |
| `/privacy` | Privacy — Sparter | index, follow | Static |
| `/terms` | Termini di servizio — Sparter | index, follow | Static |
| `/login`, `/register` | (existing) | default | Static |
| `/proto/*` | — | **noindex, nofollow** (existing) | force-dynamic |
| `(app)/*` settings | — | **noindex** (existing pattern) | dynamic RSC |

Use per-page `export const metadata` (existing app pattern). Add `(public)/layout.tsx` defaults for `openGraph.siteName`, `locale: 'it_IT'`. Root `app/layout.tsx` already sets `lang="it"` on `<html>` — keep.

No sitemap requirement in v2.8 unless operator wants one later (`app/sitemap.ts` — trivial add-on).

## Sources

- Live codebase: `proxy.ts`, `app/(app)/layout.tsx`, `app/(auth)/layout.tsx`, `app/proto/layout.tsx`, `app/page.tsx`, `lib/routes.ts`, `app/layout.tsx`
- Project contracts: `.planning/PROJECT.md` (v2.8 milestone), `AGENTS.md`, `CLAUDE.md` (language convention, proto convention)
- Prior art: `.planning/quick/260529-lyd-proto-public-preview/SUMMARY.md` (proto extraction from `(app)`)
- Onboarding gate pattern: D-11 — RSC layout + `x-pathname`; public routes avoid `(app)` layout entirely

---
*Architecture research for: v2.8 Public Branding Site*
*Researched: 2026-07-22*
