# Stack Research

**Domain:** Public branding / marketing site inside existing Next.js 16 App Router app (Sparter v2.8)
**Researched:** 2026-07-22
**Confidence:** HIGH (core stack); MEDIUM (motion — optional, proto-dependent)

## Executive Recommendation

Ship the public site **inside the monolith** using existing Next.js 16 + Tailwind 4 + shadcn/ui. Add **zero** CMS, **zero** third-party SEO library, and **no** separate deploy. New dependencies are limited to **MDX + typography for legal pages**; motion is **optional and deferred** until a proto variant proves CSS/`tw-animate-css` is insufficient. SEO, sitemap, robots, OG, and fonts use **built-in Next.js APIs** already present in the repo.

---

## Recommended Stack

### Core Technologies (no version change — reuse existing)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js App Router | **16.2.4** (pinned) | Public route group, layouts, smart root, static/SSG pages | Already the app shell; marketing pages are RSC-first static content — no second framework |
| React | **19.2.5** | UI | Matches app; public pages stay mostly Server Components |
| Tailwind CSS | **4.x** | Marketing layout, responsive hero, spacing | Already configured in `app/globals.css`; public layout extends same design tokens |
| shadcn/ui + Radix | **shadcn 4.6** | CTA buttons, nav, dialogs in marketing shell | Reuse `Button`, `Sheet`/mobile nav; visual continuity with `(auth)` login/register |
| Better Auth session | **1.6.9** via `getAuthSessionOrNull` | Smart root (`/` → marketing vs dashboard) | Same pattern as `proxy.ts`; session read in RSC `app/page.tsx`, not edge DB |
| `next/font/google` | built-in | Geist Sans + Geist Mono | Already in `app/fonts.ts`; self-hosted, build-mocked (`NEXT_FONT_GOOGLE_MOCKED_RESPONSES`) |

### New Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@next/mdx` | **16.2.4** (match `next`; latest patch **16.2.11**) | Compile MDX for Privacy/Termini | Legal copy as editable markdown-ish source under `content/legal/` |
| `@mdx-js/react` | **3.1.1** | MDX → React mapping | Required peer of `@next/mdx` |
| `@mdx-js/loader` | **3.1.1** | Webpack loader for MDX imports | Required peer; project builds with `--webpack` today |
| `@types/mdx` | latest | TS types for `.mdx` imports | Dev dependency |
| `@tailwindcss/typography` | **0.5.20** | `prose` classes for legal long-form | Wrap MDX output in `(public)` legal layout only |
| `motion` | **12.42.2** (optional) | Hero scroll reveals, staggered sections | **Only if** proto winner needs motion beyond `tw-animate-css`; import from `motion/react` |

### Built-in Next.js Capabilities (no install)

| Capability | Location | Purpose |
|------------|----------|---------|
| `Metadata` / `generateMetadata` | `(public)/layout.tsx`, per-page | Title template, description, OG, Twitter, `robots` |
| `metadataBase` | `app/layout.tsx` | Absolute URLs for OG/sitemap (set when production domain known) |
| `app/sitemap.ts` | new | Index `/`, `/how-it-works`, `/privacy`, `/terms` |
| `app/robots.ts` | new | Allow marketing routes; keep `/dashboard`, `/settings/*` out of index via `disallow` or noindex on app layout (already partial) |
| Static OG image | `app/(public)/opengraph-image.png` or `.tsx` | Single brand OG for v2.8; skip dynamic `ImageResponse` until needed |
| `next/og` `ImageResponse` | optional later | Dynamic OG only if per-page share cards become a requirement |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Existing `yarn build` (`--webpack`) | MDX compilation | `@next/mdx` uses webpack loader; **do not switch prod build to Turbopack** until MDX + remark plugins are verified on Turbopack |
| Existing Playwright | Smoke public routes + smart root | Extend E2E: anon `/` shows marketing; authed `/` → dashboard |
| `yarn check:language` | Route slugs / dev strings English | Public **UI copy** Italian; route segments English (`/how-it-works`, not `/come-funziona`) |

---

## Integration Points (existing codebase)

### Route structure

```
app/
├── layout.tsx              # root: fonts, ThemeProvider, metadataBase
├── page.tsx                # smart root (replace redirect-only stub)
├── sitemap.ts              # NEW
├── robots.ts               # NEW
├── (public)/               # NEW route group — dedicated marketing layout
│   ├── layout.tsx          # header/footer, metadata title template
│   ├── page.tsx            # homepage (or keep app/page.tsx — pick one)
│   ├── how-it-works/page.tsx
│   ├── privacy/page.tsx    # imports content/legal/privacy.mdx
│   └── terms/page.tsx
├── (auth)/                 # unchanged
├── (app)/                  # unchanged — robots noindex where already set
└── proto/                  # Phase 1 variants — unchanged gate
```

### `proxy.ts` — extend `PUBLIC_ROUTES`

Today only `/login`, `/register`, and `/proto/*` are public. v2.8 **must** add marketing paths or anonymous visitors hit `/login`:

```ts
const PUBLIC_ROUTES = [
  '/',
  '/how-it-works',
  '/privacy',
  '/terms',
  '/login',
  '/register',
] as const
// keep: path.startsWith('/proto')
```

Keep auth-route redirect (`/login` + session → `/dashboard`). Do **not** add session logic for marketing in proxy beyond allowlist — smart root stays in `app/page.tsx` RSC.

### Smart root (`app/page.tsx`)

Replace unconditional `redirect('/dashboard')` with:

1. `getAuthSessionOrNull(headers())` (same helper as proxy/DAL)
2. Authenticated → `redirect(APP_ROUTES.dashboardOverview)` (or `/dashboard`)
3. Anonymous → render marketing homepage **or** `redirect` to `(public)` home if split

Prefer **single `/` ownership** — either inline marketing in `app/page.tsx` or re-export from `(public)` to avoid duplicate routes.

### MDX for legal — import pattern (recommended)

Avoid turning every app route into `.mdx` pages. Use **import MDX into TSX page wrappers**:

```
content/legal/privacy.mdx
content/legal/terms.mdx
app/(public)/privacy/page.tsx   → import Privacy from '@/content/legal/privacy.mdx'
```

Requires:

1. `next.config.ts` wrapped with `createMDX({})` and `pageExtensions` including `mdx` (does not force all pages to MDX)
2. Root `mdx-components.tsx` mapping headings/links to Tailwind `prose` styles
3. Legal layout: `<article className="prose prose-neutral dark:prose-invert max-w-3xl mx-auto">`

Export `metadata` from the TSX page (or re-export from MDX via `export const metadata = { ... }` in `.mdx` and spread in page — Next supports MDX exports).

**Skip for v2.8:** `remark-gfm`, frontmatter parsers, content collections — two static docs don't justify the plugin graph yet.

### Motion strategy

| Layer | Already have | Use for |
|-------|--------------|---------|
| `tw-animate-css` + Tailwind `animate-in` | yes (shadcn) | Nav sheet, button micro-interactions, section fade-in via CSS |
| `motion` | not installed | Parallax hero, scroll-linked stagger, layout transitions |

**Default:** proto variants built with CSS only. Add `motion` in production phase **only** if chosen proto depends on it — keeps bundle and client boundaries smaller.

If added:

```tsx
'use client'
import { motion } from 'motion/react'
```

Isolate in `components/marketing/*` client islands; never wrap full `(public)/layout` in client motion.

### Fonts

| Decision | Recommendation |
|----------|------------------|
| Body / UI | Keep **Geist Sans** (`app/fonts.ts`) — brand continuity with app |
| Monospace | Keep **Geist Mono** for code/finance snippets in “Come funziona” |
| Display / hero | **Optional** second `next/font/google` (e.g. `Instrument_Serif` or `DM_Serif_Display`) scoped to marketing headings via CSS variable — add only if proto locks a serif hero |
| Avoid | Adobe Fonts, `@fontsource/*` CDN, `next/font/local` until brand assets exist |

Marketing layout can apply `font-serif` on hero only while body stays Geist.

### SEO metadata pattern

```tsx
// app/(public)/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { default: 'Sparter', template: '%s · Sparter' },
  description: '…', // Italian product description
  openGraph: { locale: 'it_IT', type: 'website' },
  alternates: { canonical: '/' },
}
```

Per-page overrides on `/how-it-works`, `/privacy`, `/terms`. App routes under `(app)/` keep existing `robots: 'noindex'` where set.

**Sitemap** (`app/sitemap.ts`): static entries only — no DB. **Robots** (`app/robots.ts`): allow `/`, disallow `/dashboard`, `/import`, `/settings`, etc.

No `next-seo`, `@vercel/og` package, or JSON-LD library — hand-write `application/ld+json` in layout if Organization schema needed later.

### Proto phase (`app/proto/`)

No new stack for protos. Reuse:

- Same Tailwind tokens
- Optional `motion` experiments inside proto pages only
- Existing `PROTOTYPES_ENABLED` + `robots: noindex` in `app/proto/layout.tsx`

Production picks one variant; dependencies promoted only if variant uses them.

---

## Installation

```bash
# MDX + legal typography (recommended for v2.8)
yarn add @next/mdx@16.2.4 @mdx-js/react@3.1.1 @mdx-js/loader@3.1.1
yarn add -D @types/mdx

# Typography plugin (Tailwind 4)
yarn add -D @tailwindcss/typography@0.5.20
# then register in app/globals.css: @plugin "@tailwindcss/typography";

# Optional — only after proto selects motion-heavy direction
yarn add motion@12.42.2
```

**Config sketch** (`next.config.ts`):

```ts
import createMDX from '@next/mdx'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  allowedDevOrigins: ['127.0.0.1'],
  serverExternalPackages: ['better-auth', '@better-auth/kysely-adapter', 'kysely'],
}

export default createMDX({})(nextConfig)
```

Add `mdx-components.tsx` at repo root (required by App Router).

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@next/mdx` import pattern | Plain TSX legal pages | Legal text frozen and never edited by non-devs — zero deps |
| `@next/mdx` import pattern | `react-markdown` + `remark` in RSC | Need MD without JSX in legal docs; slightly lighter but loses MDX component embeds |
| Built-in `Metadata` + `sitemap.ts` | `next-seo` | Never — duplicates App Router API |
| `motion` | CSS `@keyframes` + `IntersectionObserver` | Hero animation is subtle; prefer zero JS |
| `motion` | `framer-motion` package name | Legacy installs only — same codebase, use `motion` + `motion/react` |
| Geist only | Distinct marketing font stack | Proto demands strong brand differentiation |
| Monolith `(public)` group | Separate marketing site (Astro, etc.) | Wrong for v2.8 — same deploy, same auth CTAs, zero-cost constraint |
| Content in git MDX | Headless CMS | 4 static pages; CMS is operational overhead |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `next-seo`, `react-helmet-async` | Redundant with Next 16 Metadata API | `export const metadata` / `generateMetadata` |
| `next-sitemap` package | Built-in `app/sitemap.ts` sufficient for ~4 URLs | `MetadataRoute.Sitemap` |
| Contentlayer, Velite, Fumadocs | Blog-scale content pipelines for 2 legal pages | `content/legal/*.mdx` imports |
| Sanity / Contentful / Notion CMS | Cost, sync, auth — out of scope | Git-tracked MDX |
| Separate Next app or Astro subsite | Split deploy, duplicate auth links, CORS | `(public)` route group |
| `framer-motion` npm name | Rebranded to `motion`; duplicate dependency risk | `motion@12.x`, `import { motion } from 'motion/react'` |
| GSAP, AOS, react-spring | Extra weight; inconsistent with shadcn motion language | `tw-animate-css`, optional `motion` |
| `next-intl` / i18n framework | Product is Italian-only; no locale routing requirement | Italian copy in components/MDX |
| `@next/mdx` + Turbopack prod build (now) | Project uses `next build --webpack`; remark plugin constraints on Turbopack | Keep webpack until MDX config validated |
| `gray-matter` + filesystem blog utils | No blog; frontmatter unused | MDX `export const metadata` |
| `@vercel/analytics` / Posthog (unless already planned) | Not a branding-site requirement | Defer to ops milestone |
| Edge DB session in proxy for `/` | Drizzle can't run in edge; pattern already rejected (D-11) | RSC smart root with Node session |
| Drizzle table for page content | Static legal/marketing copy doesn't need DB | Files in repo |
| Pricing page stack (Stripe marketing) | Explicitly out of scope v2.8 | Link to `/register` only |

---

## Stack Patterns by Variant

**If proto variant is static/CSS-only (likely):**
- No `motion` dependency
- Hero uses Tailwind grid + `tw-animate-css` `animate-in fade-in slide-in-from-bottom-4`
- Screenshots via `next/image` static imports

**If proto variant needs scroll storytelling:**
- Add `motion@12.42.2`
- One client component per section (`MarketingHero.tsx`, `FeatureSteps.tsx`)
- Respect `prefers-reduced-motion: reduce` — disable transforms

**If legal pages stay developer-maintained only:**
- Skip MDX entirely — TSX + `prose` manual markup
- Saves 4 packages and `next.config` MDX wrap

**If production domain is known before ship:**
- Set `metadataBase: new URL('https://sparter.app')` in root layout
- Add `opengraph-image.png` (1200×630) under `(public)/`

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `next@16.2.4` | `@next/mdx@16.2.x` | Pin same minor; patch 16.2.11 available |
| `next@16.2.4` | `@mdx-js/react@3.1.x` | Official Next MDX guide combo |
| `react@19.2.5` | `motion@12.42.x` | Peer `^18 \|\| ^19`; React 19 CI tested upstream |
| `tailwindcss@4` | `@tailwindcss/typography@0.5.20` | Register via `@plugin` in CSS, not `tailwind.config.js` |
| `better-auth@1.6.9` | Smart root in RSC | Use `getAuthSessionOrNull`, not new auth libs |
| Build `--webpack` | `@next/mdx` | Default path; Turbopack needs string plugin names if adopted later |

---

## Sources

- [Next.js Metadata and OG images](https://nextjs.org/docs/app/getting-started/metadata-and-og-images) — HIGH — static/generated metadata, sitemap/robots conventions, streaming metadata for bots
- [Next.js MDX guide](https://nextjs.org/docs/app/guides/mdx) — HIGH — `@next/mdx` setup, `mdx-components.tsx`, import vs file routing, typography plugin
- [npm `motion@12.42.2`](https://www.npmjs.com/package/motion) — MEDIUM — React 19 peer, `motion/react` import path
- [npm `@next/mdx@16.2.11`](https://www.npmjs.com/package/@next/mdx) — HIGH — version aligned with Next 16.2
- Sparter repo: `package.json`, `proxy.ts`, `app/layout.tsx`, `app/fonts.ts`, `app/page.tsx`, `app/proto/layout.tsx` — HIGH — integration constraints

---
*Stack research for: Sparter v2.8 Public Branding Site*
*Researched: 2026-07-22*
