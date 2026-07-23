# Project Research Summary

**Project:** Sparter v2.9 — Public Branding Site
**Domain:** Public branding / marketing site inside existing Next.js 16 App Router monolith (Italian personal-finance SaaS)
**Researched:** 2026-07-22
**Confidence:** HIGH

## Executive Summary

Sparter v2.8 adds a credible public marketing façade to an auth-gated personal finance app. The recommended approach is **not** a separate site or CMS — it is a new `(public)` route group inside the existing Next.js monolith, sharing Tailwind 4, shadcn/ui, Better Auth, and the same Vercel deploy. Today, anonymous visitors hitting `/` are redirected to `/dashboard` and then bounced to `/login`; the first infrastructure fix is expanding `proxy.ts` allowlist and replacing the root redirect with a smart root (anon → marketing, auth → `/dashboard`).

The stack adds minimal dependencies: **MDX + `@tailwindcss/typography`** for legal pages only. SEO, sitemap, robots, and OG use built-in Next.js 16 Metadata APIs — no `next-seo`, no headless CMS, no separate marketing deploy. Design exploration runs first in `app/proto/` (2–3 variants, Preview-gated, `noindex`); production pages promote components into `components/marketing/` under English URL slugs with Italian product copy.

Key risks are routing and layout boundaries, not technology. The top failure modes are: (1) forgetting to allowlist marketing paths in `proxy.ts`, (2) placing public pages under `(app)` where `verifySession` and onboarding gate run, and (3) shipping placeholder legal copy that misstates actual data processors (Supabase, R2, Vercel, Better Auth). Mitigation is a pitfall-driven phase order: proto → infrastructure → pages → legal → SEO hardening.

## Key Findings

### Recommended Stack

Ship inside the monolith with zero CMS and zero third-party SEO library. Reuse Next.js 16.2.4, React 19, Tailwind 4, shadcn/ui, Better Auth session reads, and Geist fonts. New dependencies are limited to MDX for legal content and optional `motion` only if a proto variant proves CSS/`tw-animate-css` insufficient.

**Core technologies:**
- **Next.js App Router (16.2.4):** `(public)` route group, static RSC marketing pages, built-in Metadata/sitemap/robots — no second framework or deploy
- **Tailwind 4 + shadcn/ui:** Marketing layout with visual continuity to `(auth)`; reuse Button, Sheet/mobile nav, design tokens from `globals.css`
- **Better Auth (`getAuthSessionOrNull`):** Smart root and proxy allowlist; session read in Node RSC or proxy, never Drizzle in edge
- **`@next/mdx` + `@tailwindcss/typography`:** Legal pages as git-tracked MDX under `content/legal/` imported into TSX wrappers — two static docs don't justify CMS or content pipelines
- **Built-in Next.js SEO:** `export const metadata`, `app/sitemap.ts`, `app/robots.ts`, static OG image — skip `next-seo`, `next-sitemap`, Contentlayer

See [STACK.md](./STACK.md) for installation, MDX config, and alternatives considered.

### Expected Features

**Must have (table stakes):**
- **Homepage `/`** — Hero, import-first value prop, product visual, primary CTA `Registrati`, secondary `Entra` — users expect a credible first touchpoint for a finance product
- **Dedicated `(public)` layout** — Header/nav/footer without AppShell, sidebar, or onboarding gate — marketing must not feel like a logged-out app screen
- **Smart root routing** — Anon → marketing homepage; auth → `/dashboard` — fixes broken first impression today
- **`/how-it-works`** — 3–5 step explainer aligned with real flow (import → categorize → deviations) — standard evaluation pattern for fintech
- **Privacy + Terms** — GDPR-minimum static pages, footer-linked — trust non-negotiable for finance; legal copy is content-gated, not code-gated
- **`proxy.ts` public allowlist** — Blocker for all public pages; deny-by-default model requires explicit path enumeration
- **Public footer + nav, mobile-responsive, basic SEO metadata** — Universal SaaS conventions

**Should have (competitive):**
- **Import-first positioning** — "I tuoi estratti, le tue regole" vs bank-sync competitors — honest, privacy-aligned differentiator
- **Deviation/baseline narrative + real dashboard screenshots** — Sparter's insight hook; finance buyers distrust stock art
- **Italian bank ecosystem credibility** — Only banks/formats actually supported (Intesa, Revolut, Fineco, etc.)
- **3-tier categorization story** — Educates on free/basic/pro without pricing page
- **Privacy-by-architecture trust line** — R2 presigned upload, no home-banking credentials

**Defer (post soft go-live / v2.9+):**
- **Pricing page** — Offer undefined; in-app tier gates exist but public pricing creates commitment
- **Blog, newsletter, contact form, live chat** — Scope explosion + GDPR overhead
- **Analytics/cookie banner** — Ship zero third-party trackers initially; add CMP when tracking is legally reviewed
- **Informazioni legali full page** — Defer until formal business entity (P.IVA) exists
- **Demo/sandbox, English locale, comparison pages** — Out of scope or premature

See [FEATURES.md](./FEATURES.md) for anti-features, dependency graph, and competitor analysis.

### Architecture Approach

Add `(public)` as a fourth sibling route group alongside `(auth)`, `(app)`, and `proto/` — same depth, orthogonal layouts. Marketing stays outside `(app)` so `verifySession()`, onboarding gate, and AppShell never run on public pages. Proxy allowlist + layout isolation is the primary pattern; smart root redirect for authenticated `/` happens in proxy (consistent with existing auth-route redirects). Production marketing is static RSC; proto keeps `force-dynamic` for env gate. Components promote from winning proto variant into `components/marketing/`.

**Major components:**
1. **`proxy.ts` + `lib/routes.ts`** — Single source of truth for `PUBLIC_ROUTES`; smart root `/` redirect; preserve `next-action` bypass
2. **`app/(public)/layout.tsx`** — Marketing shell (header, footer, shared SEO defaults); no DB, no session
3. **`app/(public)/page.tsx` + subpages** — Static homepage, `/how-it-works`, `/privacy`, `/terms`; delete current `app/page.tsx`
4. **`components/marketing/*`** — Reusable hero, feature grid, CTA, legal prose shell promoted from proto winner
5. **`app/proto/branding-{a,b,c}`** — Design variants (Phase 1); Preview-gated, `noindex`, throwaway routes

See [ARCHITECTURE.md](./ARCHITECTURE.md) for data flows, build order, and anti-patterns.

### Critical Pitfalls

1. **Proxy allowlist gaps** — New `(public)` routes do not become public automatically; anon visitors get 307 to `/login`. Fix: shared `PUBLIC_ROUTES` in `lib/routes.ts`, incognito QA, automated tests per path.
2. **Public pages under `(app)`** — `verifySession()` and onboarding gate break anonymous marketing. Fix: dedicated `(public)` route group; never import AppShell or SidebarProvider.
3. **Smart root mis-implemented** — Competing redirects in `app/page.tsx`, proxy, and `(app)/layout` cause loops or dead ends. Fix: lock contract (anon → marketing, auth → dashboard); expand allowlist before shipping homepage.
4. **Italian slugs vs English route convention** — `/come-funziona` violates `AGENTS.md`. Fix: canonical English slugs (`/how-it-works`, `/terms`); Italian in UI only; optional redirects in `next.config.ts`.
5. **Legal pages as placeholders** — Generic boilerplate misstates Supabase/R2/Vercel/Better Auth processors. Fix: accurate minimal copy from deploy runbook; block soft go-live without legal review.
6. **Auth CTA / sign-out flows** — `signOutAction` → `/login` disorients users; duplicate CTAs when logged in. Fix: sign-out → `/`; session-aware header hides `Registrati` for auth users.
7. **Proto indexed or confused with production** — Proto is `noindex` and Preview-gated; production marketing must be indexable. Fix: port components, not routes; verify Production `/proto` → 404.

See [PITFALLS.md](./PITFALLS.md) for full checklist, recovery strategies, and phase mapping.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Proto Variants & Design Lock
**Rationale:** Milestone flow requires 2–3 throwaway design variants before production implementation; zero auth/onboarding coupling in `app/proto/`.
**Delivers:** `app/proto/branding-{a,b,c}` on Vercel Preview; PO-visible design options.
**Addresses:** Proto-driven design selection (differentiator); visual direction for homepage and Come funziona.
**Avoids:** Shipping proto paths as production URLs (Pitfall 8); pricing/tier copy in hero (Pitfall 15).

### Phase 2: `(public)` Route Group & Proxy Allowlist
**Rationale:** Critical path blocker — no marketing page renders until proxy allowlist expands; layout boundary must exist before any page work.
**Delivers:** `lib/routes.ts` constants; `proxy.ts` allowlist + smart root; `app/(public)/layout.tsx` shell skeleton.
**Uses:** Existing Better Auth session in proxy; shared route constants pattern.
**Implements:** Proxy allowlist + layout isolation (Architecture Pattern 1); `PublicShell` boundary.
**Avoids:** Allowlist gaps (Pitfall 1); marketing under `(app)` (Pitfall 3); Server Action regressions (Pitfall 9); duplicate route definitions (Pitfall 12).

### Phase 3: Homepage & How It Works
**Rationale:** Depends on Phase 2 infrastructure and Phase 1 design pick; core conversion pages.
**Delivers:** `(public)/page.tsx` homepage; `/how-it-works` page; `components/marketing/*` from proto winner; delete `app/page.tsx`.
**Addresses:** Homepage hero + CTAs; Come funziona; public footer + nav; mobile-responsive layout.
**Avoids:** Marketing/app chrome mix (Pitfall 4); Italian slugs (Pitfall 5); feature over-promise in copy (Pitfall 15).

### Phase 4: Smart Root & Auth CTA Flows
**Rationale:** Can parallel with Phase 3 once allowlist exists; completes routing contract and auth entry/exit polish.
**Delivers:** Verified smart root matrix (anon/auth/0-tx); session-aware header; sign-out → `/` if changed.
**Addresses:** Smart root routing; CTA → `/login`, `/register`; authenticated user behavior on marketing pages.
**Avoids:** Redirect loops (Pitfall 2); auth CTA inconsistency (Pitfall 7); onboarding gate on marketing detour (Pitfall 10).

### Phase 5: Legal Pages (Privacy & Terms)
**Rationale:** Content-gated but engineering can ship structure early; accurate copy required before operator deploy.
**Delivers:** `/privacy`, `/terms` via MDX import pattern; footer links; "last updated" dates.
**Uses:** `@next/mdx`, `@tailwindcss/typography`, `content/legal/*.mdx`.
**Avoids:** Placeholder GDPR claims (Pitfall 6); pricing/subscription terms that don't exist.

### Phase 6: SEO & Launch Hardening
**Rationale:** Final polish after all routes exist; validates indexability and launch checklist.
**Delivers:** Per-page metadata; `app/sitemap.ts`, `app/robots.ts`; optional OG image; incognito verification checklist.
**Addresses:** Basic SEO metadata; robots/sitemap reachable without auth redirect.
**Avoids:** Generic root metadata (Pitfall 11); proto indexing (Pitfall 8); staging bypass masking bugs (Pitfall 14).

### Phase Ordering Rationale

- **Proto first (Phase 1)** runs parallel to infrastructure (Phase 2) until PO picks direction — design lock before production UI investment.
- **Infrastructure before pages (Phase 2 before 3–4)** — `proxy.ts` allowlist is the critical path; anonymous `/` broken until Steps 3–4 of architecture build order complete.
- **Legal separated (Phase 5)** — Engineering ships routes early; content accuracy is a deploy gate, not a code blocker.
- **SEO last (Phase 6)** — Sitemap/robots need final route list; metadata benefits from stable page titles.
- **Layout isolation enforced throughout** — `(public)` never enters `(app)` tree; onboarding gate bypassed by structure, not exemption lists.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (Legal):** Operator/legal review for GDPR Art. 13–14 copy; exact data controller identity may be TBD until business entity exists — mark unknowns explicitly rather than inventing.
- **Phase 3 (Homepage):** Optional `motion` dependency decision deferred until proto winner selected — CSS-only default keeps bundle small.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Proxy/routes):** Well-established in codebase; `proxy.ts`, `lib/routes.ts` patterns already exist for auth routes.
- **Phase 6 (SEO):** Next.js 16 built-in Metadata/sitemap/robots — official docs verified in STACK research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Grounded in live `package.json`, Next.js official MDX/metadata docs, repo constraints |
| Features | HIGH | SaaS marketing patterns well-established; Italian legal baseline MEDIUM — operator review required |
| Architecture | HIGH | Verified against live `proxy.ts`, `(app)/layout.tsx`, `app/page.tsx`, `app/proto/layout.tsx` |
| Pitfalls | HIGH | Codebase-verified failure modes; industry redirect-loop patterns cross-checked MEDIUM |

**Overall confidence:** HIGH

### Gaps to Address

- **Legal copy accuracy:** Engineering ships MDX structure; final Privacy/Termini text requires operator/legal review against actual sub-processors (Supabase, R2, Vercel, Better Auth, OAuth providers). Handle: placeholder with explicit TBD fields blocked from Production deploy.
- **Production domain / `metadataBase`:** Operator deploy (R038) may not have final domain at planning time. Handle: add `metadataBase` when domain known; OG image can ship as static asset under `(public)/`.
- **Sign-out redirect target:** Current `signOutAction` → `/login`; research recommends `/` for brand continuity. Handle: product decision in Phase 4 — low effort change if approved.
- **Motion library:** Optional and proto-dependent. Handle: default CSS/`tw-animate-css`; add `motion@12.x` only if chosen proto requires scroll storytelling.
- **Informazioni legali page:** Full Italian consumer/e-commerce page deferred until P.IVA/business entity exists. Handle: Privacy identifies controller even if individual; note as pre-production checklist.

## Sources

### Primary (HIGH confidence)
- Sparter repo — `proxy.ts`, `app/page.tsx`, `app/(app)/layout.tsx`, `app/proto/layout.tsx`, `lib/routes.ts`, `package.json`
- [Next.js Metadata and OG images](https://nextjs.org/docs/app/getting-started/metadata-and-og-images) — sitemap/robots, static metadata
- [Next.js MDX guide](https://nextjs.org/docs/app/guides/mdx) — `@next/mdx` setup, import pattern
- Sparter `.planning/PROJECT.md` — v2.8 locked scope, architecture, out-of-scope items
- Sparter `CONTEXT.md`, `CLAUDE.md`, `AGENTS.md` — domain language, language convention, proto rules

### Secondary (MEDIUM confidence)
- Italian GDPR web obligations — privacy footer, cookie consent, no pre-consent tracking (WebNovis 2026, Clym glossary)
- Competitor public sites — Moneyfarm IT, Copilot Money, Monarch/YNAB positioning
- SaaS homepage conversion patterns — hero → proof → features → CTA repetition (2025–2026 guides)
- [npm `motion@12.42.2`](https://www.npmjs.com/package/motion) — React 19 peer, optional dependency

### Tertiary (LOW confidence)
- Exact Informazioni legali requirements for soft go-live without formal business entity — defer to operator/legal

---
*Research completed: 2026-07-22*
*Ready for roadmap: yes*
