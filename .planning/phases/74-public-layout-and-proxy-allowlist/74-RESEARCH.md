# Phase 74: public-layout-and-proxy-allowlist - Research

**Researched:** 2026-07-23
**Domain:** Next.js 16 App Router route groups + root `proxy.ts` allowlist / smart-root gate
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Auth → `/dashboard` redirect for path `/` lives **only in `proxy.ts`** (not duplicated in RSC page). Anon passes through to `(public)` homepage shell. — **Reversibility:** costly — moving smart root to page later means two layers or a migration of tests/allowlist assumptions.
- **D-02:** Authenticated users hitting `/` **always** redirect to `/dashboard` (no `/?marketing=` escape hatch).
- **D-03:** Marketing deep links (`/how-it-works`, `/privacy`, `/terms`) remain reachable when logged in — they must **not** be added to `AUTH_ROUTES` (only `/login` and `/register` bounce authenticated users to dashboard).
- **D-04:** Allowlist matching for marketing + auth paths is **exact match only**. Exception retained: `/proto` keeps `path.startsWith('/proto')` as today.
- **D-05:** In `lib/routes.ts`: export `PUBLIC_MARKETING_ROUTES` (`/`, `/how-it-works`, `/privacy`, `/terms`), `AUTH_ROUTES` (`/login`, `/register`), and `PUBLIC_ROUTES = [...PUBLIC_MARKETING_ROUTES, ...AUTH_ROUTES]`. `proxy.ts` imports these — delete the local hard-coded arrays. — **Reversibility:** costly — chrome, proxy, and tests all depend on the shared export.
- **D-06:** Chrome (header/footer/sheet) references **named route constants** (not string literals). Dashboard link uses `APP_ROUTES.dashboard`.
- **D-07:** Phase ships **targeted automated tests** for: anon `/` not 307→login; auth `/` → dashboard; auth `/how-it-works` → 200; non-allowlisted path still gated.
- **D-08:** Always-visible **“Dashboard”** text link → `/dashboard` in **footer only** (desktop) and also in the **mobile Sheet** link list. Anon click → proxy → `/login`. This extends the UI-SPEC nav inventory (UI-SPEC originally omitted it until Phase 77).
- **D-09:** Entra / Registrati remain always visible in Phase 74; authenticated click still hits `AUTH_ROUTES` → `/dashboard`. Session-aware hide of Registrati stays Phase 77 (BRAND-12).
- **D-10:** Ship stub pages for `/how-it-works`, `/privacy`, `/terms` inside `(public)` layout: heading + body **“Contenuto in arrivo.”** + text link **“Torna alla home”** → `/`. No fake legal prose.
- **D-11:** Homepage `/` in this phase is the **minimal type-led shell** from `74-UI-SPEC.md` (brand + import-first supporting line + Registrati/Entra CTAs). Full Variant C promotion is Phase 75.
- **D-12:** Follow `74-UI-SPEC.md` for chrome structure, spacing, typography (Geist-only), colors, Sheet behavior, and copy — except where D-08 explicitly extends the link inventory. Do **not** create `components/marketing/*` or load Fraunces in this phase.

### Claude's Discretion
- Exact file layout under `app/(public)/` (`_components/site-header.tsx` vs inline) as long as UI-SPEC placement rule is met (colocate under `(public)`, no `components/marketing/*`).
- Exact Sheet ordering for “Dashboard” among footer-equivalent links (must be present; prefer after legal links or with product links — planner picks one coherent order).
- Test harness choice (unit vs integration) — prefer whatever already exists for proxy/routes if present; otherwise minimal new tests that lock D-07.

### Deferred Ideas (OUT OF SCOPE)
- Full Variant C homepage + `components/marketing/*` + Fraunces — Phase 75
- `/how-it-works` 3–5 step body — Phase 75
- Privacy / Terms legal MDX — Phase 76
- Session-aware header (hide Registrati when authenticated) — Phase 77 / BRAND-12
- SEO metadata, sitemap, robots — Phase 77 / BRAND-11
- Sign-out → `/` — Phase 77 / BRAND-13
- Pricing page — out of scope (BRAND-F01)
- Renumber branding phases when v2.8 Reimbursements claims phase IDs — process/docs chore after that milestone’s roadmap exists
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BRAND-03 | Anonymous visitor sees marketing pages under dedicated `(public)` layout (header/nav/footer) without AppShell, sidebar, or onboarding gate | Sibling route group `app/(public)/` with own layout; never import `(app)` chrome; delete conflicting `app/page.tsx` |
| BRAND-04 | Public marketing paths allowlisted in `proxy.ts` via SoT in `lib/routes.ts` (anon without 307→`/login`) | Export `PUBLIC_MARKETING_ROUTES` / `AUTH_ROUTES` / `PUBLIC_ROUTES`; exact `.includes(path)`; keep `/proto` `startsWith` |
| BRAND-05 | Smart root — anon `/` marketing homepage; auth `/` → `/dashboard` | Single redirect in `proxy.ts` after session check; homepage is static `(public)/page.tsx` shell |
</phase_requirements>

## Summary

Phase 74 is an infrastructure + chrome slice: introduce a `(public)` route group beside `(auth)` / `(app)`, move `/` ownership from the current unconditional `app/page.tsx → redirect('/dashboard')` into a minimal marketing shell, and refactor `proxy.ts` so its deny-by-default allowlist lives in `lib/routes.ts`. Existing Vitest coverage in `tests/proxy-auth.test.ts` is the right harness for D-07 — extend it; do not invent Playwright for proxy redirects.

Critical implementation order: (1) routes SoT + proxy import + smart-root branch, (2) delete `app/page.tsx` and add `app/(public)/page.tsx` in the same change set (Next.js forbids two owners of `/`), (3) stubs + chrome per UI-SPEC with D-08 Dashboard link. Preserve staging-key bypass and `next-action` short-circuit **before** session logic.

Upstream research (`.planning/research/PITFALLS.md`) suggested RSC smart-root and prefix matching — **ignore those**; CONTEXT locks proxy-only smart root (D-01) and exact match (D-04). Upstream ARCHITECTURE also proposed `components/marketing/*` — **out of scope** until Phase 75 (D-12).

**Primary recommendation:** Extend `lib/routes.ts` with named marketing/auth path objects + derived arrays; wire `proxy.ts` to those arrays with an explicit `path === '/' && isAuthenticated` redirect; ship colocated `(public)` layout/chrome/stubs; grow `tests/proxy-auth.test.ts` for the four D-07 behaviors.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Deny-by-default session gate + public allowlist | Frontend Server (SSR) / Proxy | — | Root `proxy.ts` already owns auth redirects before RSC; BRAND-04 extends that gate |
| Smart root auth `/` → `/dashboard` | Frontend Server (SSR) / Proxy | — | D-01: single layer; runs after session, before page render |
| Marketing chrome (header/nav/footer/Sheet) | Browser / Client (Sheet island) + RSC layout | CDN / Static | Sticky chrome is RSC; mobile Sheet needs client interactivity |
| Homepage shell + stub pages | Frontend Server (SSR) / RSC | CDN / Static | Static Italian copy; no DB/session in Phase 74 |
| Onboarding gate / AppShell | API / Backend + Frontend Server (`(app)` layout) | — | Must remain isolated; `(public)` never imports these |
| Proto preview gate | Frontend Server (`app/proto/layout`) | — | Unrelated `PROTOTYPES_ENABLED`; proxy only keeps `startsWith('/proto')` |

## Project Constraints (from .cursor/rules/)

No `.cursor/rules/` directory in this repo. Apply project constraints from `CLAUDE.md` / `AGENTS.md` instead:

- English route slugs; Italian UI copy only on product surfaces
- Layers: no DB queries in proxy/edge; session via Better Auth helper already used
- Run `yarn check:language` when touching routes / developer strings
- Decimal.js / R2 / migrations rules do not apply to this phase (no money or uploads)

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.2.4 `[VERIFIED: node_modules/next/package.json]` | Route groups, layouts, pages, root `proxy.ts` | Project stack; proxy is the Next 16 rename of middleware `[CITED: node_modules/next/dist/docs/.../proxy.md]` |
| React (RSC) | bundled with Next 16 | Server Components for layout/pages | Default App Router model |
| Better Auth session helper | existing `@/lib/auth-session` | `getAuthSessionOrNull` in proxy | Already wired; do not replace |
| Tailwind + shadcn (new-york/zinc) | existing | Button, Sheet for chrome | UI-SPEC; no new registry blocks |
| Vitest | 4.1.5 `[VERIFIED: node_modules/vitest/package.json]` | Unit tests for proxy allowlist/smart-root | Existing `tests/proxy-auth.test.ts` pattern |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | existing | `Menu` / `X` Sheet trigger icons | Mobile header only per UI-SPEC |
| `@playwright/test` | ^1.59.1 | E2E suite | Optional smoke only — **not** required for D-07 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Proxy smart root (locked) | RSC `getAuthSessionOrNull` on homepage | Rejected by D-01; would force dynamic homepage and duplicate redirect logic |
| Exact allowlist (locked) | Prefix match for marketing | Rejected by D-04; prefix risks accidental public subpaths |
| Vitest proxy unit tests | Playwright e2e for redirects | Heavier; session cookie setup; existing unit harness already mocks session |
| Colocated `_components/` | `components/marketing/*` | Deferred to Phase 75 (D-12) |

**Installation:**

```bash
# No new packages — reuse Next 16, Vitest, shadcn Button/Sheet already in repo
```

**Version verification:** Next `16.2.4`, Vitest `4.1.5` read from installed `package.json` files on 2026-07-23.

## Package Legitimacy Audit

> No external packages to install for this phase.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | — | N/A — no installs |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
                    Browser request (pathname)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ proxy.ts (order matters)                                    │
│  1. STAGING_KEY header bypass → next()                      │
│  2. next-action header → next() + x-pathname (no session)   │
│  3. getAuthSessionOrNull(headers)                           │
│  4. AUTH_ROUTES + authed → 307 /dashboard                   │
│  5. path === '/' + authed → 307 /dashboard   ← BRAND-05     │
│  6. !PUBLIC_ROUTES.includes && !authed → 307 /login         │
│     (PUBLIC includes marketing + auth; /proto via startsWith)│
│  7. next() + set x-pathname / x-search                      │
└─────────────────────────────┬───────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   app/(public)/*      app/(auth)/*         app/(app)/*
   layout: header/     centered wordmark    verifySession +
   footer/Sheet        login/register       onboarding + AppShell
   page: / shell       (unchanged)          (unchanged)
   stubs: how-it-works
          privacy/terms
```

### Recommended Project Structure

```text
app/
├── layout.tsx                 # root — unchanged (ThemeProvider, Geist)
├── page.tsx                   # DELETE — conflicts with (public)/page.tsx
├── (public)/
│   ├── layout.tsx             # flex min-h-screen; SiteHeader + main + SiteFooter
│   ├── page.tsx               # `/` minimal homepage shell (D-11)
│   ├── how-it-works/page.tsx  # stub (D-10)
│   ├── privacy/page.tsx       # stub (D-10)
│   ├── terms/page.tsx         # stub (D-10)
│   └── _components/
│       ├── site-header.tsx    # desktop nav + mobile Sheet (client island OK)
│       └── site-footer.tsx    # links + Dashboard (D-08)
├── (auth)/                    # unchanged
└── (app)/                     # unchanged — never wrap public

lib/routes.ts                  # ADD PUBLIC_MARKETING_ROUTES, AUTH_ROUTES, PUBLIC_ROUTES + named consts
proxy.ts                       # IMPORT SoT; ADD smart-root branch; DELETE local arrays
tests/proxy-auth.test.ts       # EXTEND for D-07 cases
```

### Pattern 1: Routes SoT with named constants + derived arrays

**What:** Single objects for chrome hrefs; arrays derived for proxy membership tests — prevents D-05/D-06 drift.

**When to use:** Always for Phase 74 chrome + proxy.

**Example:**

```typescript
// lib/routes.ts — Source: phase D-05/D-06 + .planning/research/ARCHITECTURE.md (adapted)

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

/** Exact allowlist helper — avoids `as const` Array.includes type narrowing pain */
export function isPublicPath(path: string): boolean {
  return (PUBLIC_ROUTES as readonly string[]).includes(path)
}

export function isAuthPath(path: string): boolean {
  return (AUTH_ROUTES as readonly string[]).includes(path)
}
```

**Naming note for planner:** CONTEXT names the arrays `AUTH_ROUTES` / `PUBLIC_ROUTES`. Prefer keeping those **exact export names** for proxy. Named chrome constants can be `MARKETING_ROUTES` / `AUTH_PAGE_ROUTES` (or fold login/register into a single named map) as long as chrome never hard-codes path strings.

### Pattern 2: Proxy refactor order (preserve bypasses)

**What:** Import SoT; add smart-root; keep staging + `next-action` first.

**When to use:** Any edit to `proxy.ts` in this phase.

**Example:**

```typescript
// proxy.ts — Source: live proxy.ts + ARCHITECTURE.md Pattern 1/2 + D-01/D-04/D-05
import { type NextRequest, NextResponse } from 'next/server'
import { getAuthSessionOrNull } from '@/lib/auth-session'
import {
  APP_ROUTES,
  AUTH_PAGE_ROUTES,
  isAuthPath,
  isPublicPath,
  MARKETING_ROUTES,
} from '@/lib/routes'

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname

  if (
    process.env.STAGING_KEY &&
    request.headers.get('x-staging-key') === process.env.STAGING_KEY
  ) {
    return NextResponse.next()
  }

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

  // BRAND-05 / D-01 / D-02 — must run even though '/' is public
  if (path === MARKETING_ROUTES.home && isAuthenticated) {
    return NextResponse.redirect(new URL(APP_ROUTES.dashboard, request.nextUrl))
  }

  if (!isPublicRoute && !isAuthenticated) {
    return NextResponse.redirect(new URL(AUTH_PAGE_ROUTES.login, request.nextUrl))
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)
  requestHeaders.set('x-search', request.nextUrl.search)
  return NextResponse.next({ request: { headers: requestHeaders } })
}
```

### Pattern 3: `(public)` sibling layout isolation

**What:** Nested layout under existing root `app/layout.tsx` — not a second root layout. Shares ThemeProvider/fonts; forbids AppShell.

**When to use:** All marketing HTML routes.

**Example:** Structure from `74-UI-SPEC.md` shell contract — sticky header, `main.flex-1`, footer. Sheet `side="right"` (do **not** reuse `MobileMoreSheet` which is `side="bottom"` app chrome).

### Anti-Patterns to Avoid

- **Keeping `app/page.tsx` alongside `(public)/page.tsx`:** Next.js conflicting paths error `[CITED: nextjs.org route-groups docs / local route-groups.md]`.
- **Adding marketing paths to `AUTH_ROUTES`:** Logged-in users could not open Come funziona (violates D-03).
- **Smart root only in RSC:** Violates D-01; also leaves a window where marketing HTML is generated before redirect.
- **Importing `verifySession` / `AppShell` into `(public)`:** Onboarding gate + sidebar leak (Pitfall 3).
- **Creating `components/marketing/*` or loading Fraunces:** Phase 75 (D-12).
- **Prefix-matching marketing paths:** Violates D-04; only `/proto` uses `startsWith`.
- **Skipping `next-action` passthrough when editing proxy:** Breaks Server Action response format (existing comment in `proxy.ts`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mobile nav drawer | Custom dialog/portal | shadcn `Sheet` | Focus trap, a11y, already in repo |
| CTA buttons | Custom button styles | shadcn `Button asChild` + `Link` | Matches auth/app design system |
| Session read in proxy | New auth client | `getAuthSessionOrNull` | Recoverable error handling already exists |
| Proxy unit tests | Ad-hoc fetch harness | Extend `tests/proxy-auth.test.ts` | Mock + `NextRequest` pattern proven |
| Route constants | String literals in chrome | `lib/routes.ts` named exports | BRAND-04 SoT; `check:language` / drift prevention |

**Key insight:** The hard part is **gate consistency** (proxy + routes + tests), not UI chrome. Reuse existing primitives; invest effort in allowlist/smart-root correctness.

## Common Pitfalls

### Pitfall 1: Public path allowlisted but smart root missing

**What goes wrong:** Authenticated `/` serves marketing shell (D-02 failure) because `/` is in `PUBLIC_ROUTES` and passes the anon gate.

**Why it happens:** Developers extend allowlist and forget the separate auth-`/` branch.

**How to avoid:** Implement smart-root redirect **after** session + **before** final `next()`; cover with D-07 auth `/` test.

**Warning signs:** Logged-in visit to `/` shows Registrati/Entra homepage.

### Pitfall 2: Dual owners of `/`

**What goes wrong:** Build fails with conflicting page error, or wrong page wins unpredictably.

**Why it happens:** Leaving `app/page.tsx` while adding `app/(public)/page.tsx`.

**How to avoid:** Same commit: delete root page, add `(public)/page.tsx`.

**Warning signs:** Next.js build error mentioning duplicate page for `/`.

### Pitfall 3: AppShell / onboarding leak

**What goes wrong:** Marketing renders inside sidebar or redirects anon to onboarding/login via `verifySession`.

**Why it happens:** Nesting under `(app)` or importing app layout components.

**How to avoid:** Sibling `(public)` only; forbid `(app)` imports in review checklist.

**Warning signs:** Bottom nav or sidebar on marketing routes.

### Pitfall 4: Breaking staging bypass or Server Actions

**What goes wrong:** Staging header ignored; register autoSignIn SA gets 307.

**Why it happens:** Reordering proxy so session/redirect runs before early returns.

**How to avoid:** Keep blocks 1–2 verbatim at top; add tests that `next-action` still skips session (already present).

**Warning signs:** SA failures on `/register`; staging key no longer bypasses login.

### Pitfall 5: Chrome href drift from allowlist

**What goes wrong:** Footer links to a path not in `PUBLIC_MARKETING_ROUTES` → anon 307 to login.

**Why it happens:** Hard-coded Italian or divergent English slugs.

**How to avoid:** Named constants only (D-06); stubs for every linked marketing path (D-10).

**Warning signs:** Incognito click footer → `/login`.

### Pitfall 6: Treating marketing like AUTH_ROUTES

**What goes wrong:** Auth users cannot read Come funziona / Privacy / Terms.

**Why it happens:** Copy-paste of auth bounce list to include marketing paths (contradicts D-03).

**How to avoid:** Keep `AUTH_ROUTES` = login/register only; test auth `/how-it-works` → 200.

**Warning signs:** Logged-in deep link to `/how-it-works` redirects to dashboard.

## Code Examples

### Extend existing proxy Vitest harness (D-07)

```typescript
// tests/proxy-auth.test.ts — Source: live file pattern [VERIFIED: tests/proxy-auth.test.ts]

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

it('still gates non-allowlisted paths for anonymous users', async () => {
  mocks.getAuthSessionOrNull.mockResolvedValue(null)
  const response = await proxy(request('/dashboard'))
  expect(response.status).toBe(307)
  expect(response.headers.get('location')).toBe('https://app.example.test/login')
})
```

### Sheet order recommendation (discretion)

Prefer footer-equivalent order with Dashboard last (app return):

`Come funziona → Entra → Registrati → separator → Privacy → Termini → Dashboard`

Desktop footer: same links including Dashboard; no Pricing.

### Homepage shell copy (locked)

Supporting line: **Carica i tuoi estratti. Sparter li categorizza — senza collegare la banca.**

Stub body: **Contenuto in arrivo.** + **Torna alla home** → `MARKETING_ROUTES.home`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` | `proxy.ts` export `proxy` | Next.js 16 | Sparter already migrated; keep convention |
| Root `app/page.tsx` always → `/dashboard` | Anon `/` = marketing; auth `/` = proxy → dashboard | This phase | Removes anon dead-end hop |
| Local `PUBLIC_ROUTES` in proxy | SoT in `lib/routes.ts` | This phase | Chrome + proxy + tests share paths |
| Prefix-match marketing (old research) | Exact match only (D-04) | CONTEXT 2026-07-23 | Safer allowlist |

**Deprecated/outdated:**

- RSC-only smart root as primary approach — superseded by D-01
- `components/marketing/*` in Phase 74 — deferred to 75
- PITFALLS advice to prefer prefix matching — superseded by D-04

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Session mock shape `{ user: { id } }` is enough for `!!session?.user` in proxy tests | Code Examples | Test may need fuller session type — adjust mock to satisfy TS only |
| A2 | Pathname from `NextRequest` has no trailing slash for marketing routes (no `trailingSlash` in next.config) | Pitfalls / Proxy | Exact match might miss `/how-it-works/` — low risk; confirm if users hit trailing slash |
| A3 | Graphify relationships for proxy/public are approximate (graph stale ~891h / 1589 commits behind) | Metadata | No structural dependency missed beyond what live code shows |

**If this table is empty:** N/A — three low-impact assumptions listed.

## Open Questions (RESOLVED)

1. **Named constant export names** — **RESOLVED:** parallel `MARKETING_ROUTES` / `AUTH_PAGE_ROUTES` objects feed the mandated arrays (`PUBLIC_MARKETING_ROUTES`, `AUTH_ROUTES`, `PUBLIC_ROUTES`). Do **not** put marketing paths on `APP_ROUTES`.
   - What we knew: D-05 mandates array names; D-06 mandates named constants for chrome.
   - Decision: Exact object names are `MARKETING_ROUTES` + `AUTH_PAGE_ROUTES` (not extending `APP_ROUTES`).

2. **Optional layout-level smoke test** — **RESOLVED:** skip RTL for SiteHeader; rely on Vitest proxy tests (D-07) + human checkpoint in Plan 03.
   - What we knew: D-07 is proxy-focused; UI-SPEC is visual contract.
   - Decision: No light RTL render test required for phase gate.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest / Next | ✓ | v22.22.3 | — |
| Yarn | scripts | ✓ | 4.14.1 | — |
| Vitest | D-07 tests | ✓ | 4.1.5 | — |
| Playwright | optional e2e | ✓ (dep) | ^1.59.1 | Prefer Vitest for D-07 |
| PostgreSQL | — | n/a | — | Not required for this phase |
| New npm packages | — | n/a | — | None |

**Missing dependencies with no fallback:** none

**Missing dependencies with fallback:** none

Step 2.6: external deps are only existing local toolchain — no new services.

## Validation Architecture

> `workflow.nyquist_validation` absent in `.planning/config.json` → treated as **enabled**.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `vitest.config.ts` |
| Quick run command | `yarn vitest run tests/proxy-auth.test.ts` |
| Full suite command | `yarn test` |
| E2E (optional) | `yarn test:e2e` — not required for BRAND-03/04/05 gate |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BRAND-04 | Anon `/` not 307→login | unit | `yarn vitest run tests/proxy-auth.test.ts -t 'anonymous marketing home'` | ❌ Wave 0 — extend file |
| BRAND-05 | Auth `/` → `/dashboard` | unit | `yarn vitest run tests/proxy-auth.test.ts -t 'authenticated home'` | ❌ Wave 0 |
| BRAND-03 / D-03 | Auth `/how-it-works` → 200 (not AUTH bounce) | unit | `yarn vitest run tests/proxy-auth.test.ts -t 'authenticated marketing deep link'` | ❌ Wave 0 |
| BRAND-04 | Anon `/dashboard` still 307→login | unit | existing test in `tests/proxy-auth.test.ts` | ✅ |
| BRAND-04 | `next-action` passthrough | unit | existing test | ✅ |
| BRAND-03 | `(public)` has no AppShell/onboarding | manual / static review | grep/import lint during review | ❌ automated — Wave 0 optional: forbid-import ESLint not present; use checklist |
| BRAND-03 | Stub pages render Italian stub copy | manual or light RTL | optional | ❌ not required for D-07 |

### Sampling Rate

- **Per task commit:** `yarn vitest run tests/proxy-auth.test.ts`
- **Per wave merge:** `yarn test` (or at least proxy + any new public component tests)
- **Phase gate:** Full suite green before `/gsd-verify-work`; plus manual: anon `/` shows chrome, no sidebar

### Wave 0 Gaps

- [ ] Extend `tests/proxy-auth.test.ts` with four D-07 cases (anon `/`, auth `/`, auth `/how-it-works`, gated path already covered — keep regression)
- [ ] If `lib/routes.ts` helpers exported, optional tiny unit test for `isPublicPath` / `isAuthPath` membership (nice-to-have, not blocking)
- [ ] No new framework install required

*(Framework already present — gaps are test cases only.)*

## Security Domain

> `security_enforcement` absent → treated as **enabled**.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (session gate) | Better Auth via `getAuthSessionOrNull` in proxy |
| V3 Session Management | yes | Existing session cookies; recoverable session errors → null |
| V4 Access Control | yes | Deny-by-default allowlist; marketing exact paths only |
| V5 Input Validation | partial | Pathname from URL; no user body parsing in this phase |
| V6 Cryptography | no | — |

### Known Threat Patterns for Next.js proxy + public routes

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Auth bypass via missing allowlist entry | Elevation of Privilege | Exact SoT list + tests; deny-by-default |
| Over-broad prefix allowlist | Elevation of Privilege | D-04 exact match; `/proto` exception only |
| Client-spoofed `x-pathname` | Tampering | Proxy overwrites header every request (existing T-38-01 note) |
| Staging key in production | Elevation of Privilege | Existing rule: never set `STAGING_KEY` on Railway prod |
| Open redirect via smart root | Spoofing | Fixed destination `APP_ROUTES.dashboard` only |
| Fake legal claims on stubs | Repudiation / Compliance | D-10 “Contenuto in arrivo.” only — no GDPR prose |

## Sources

### Primary (HIGH confidence)

- Live `proxy.ts`, `lib/routes.ts`, `app/page.tsx`, `app/(app)/layout.tsx`, `app/(auth)/layout.tsx` — verified this session
- `tests/proxy-auth.test.ts` — existing Vitest proxy harness
- `74-CONTEXT.md`, `74-UI-SPEC.md` — locked decisions + chrome contract
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` — proxy convention
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md` — conflicting paths caveat
- [nextjs.org/docs/app/api-reference/file-conventions/route-groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups) — Ref MCP confirmed
- [nextjs.org/docs/app/api-reference/file-conventions/proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) — Ref MCP confirmed
- `.planning/research/ARCHITECTURE.md` — `(public)` sibling + SoT pattern (minus marketing components / timing)

### Secondary (MEDIUM confidence)

- `.planning/research/PITFALLS.md` — pitfalls useful; smart-root/prefix recommendations **superseded by CONTEXT**
- Graphify status — graph exists but stale (~891h, 1589 commits); treated as approximate `[ASSUMED]` utility only

### Tertiary (LOW confidence)

- None material; A1–A3 logged above

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions from installed packages; no new deps
- Architecture: HIGH — live proxy/layouts + Next 16 docs + locked CONTEXT
- Pitfalls: HIGH — grounded in current deny-by-default proxy and known dual-`/` conflict

**Research date:** 2026-07-23
**Valid until:** 2026-08-22 (30 days — stable App Router patterns; re-check if Next minor bumps proxy APIs)

**Graph annotation:** `.planning/graphs/graph.json` is stale (`age_hours` ~891, `commits_behind` 1589) — treat any graph-derived relationships as approximate; research relied on live code instead.
