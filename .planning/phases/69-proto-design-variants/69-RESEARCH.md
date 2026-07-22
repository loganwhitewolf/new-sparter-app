# Phase 69: proto-design-variants - Research

**Researched:** 2026-07-22
**Domain:** Throwaway marketing branding UI under Next.js 16 `app/proto/` (Preview-gated, `noindex`)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Primary direction is **A + touch of B** — “Dashboard as manifesto” (real `/dashboard/overview` screenshot as dominant visual plane) combined with editorial marketing typography and quiet atmosphere on the proto surface. Not pure lifestyle editorial; not pure app-chrome clone. — **Reversibility:** costly — Phase 71 promotes the winner into `components/marketing/*`; changing direction after promotion rewrites production marketing UI.
- **D-02:** First viewport composition: brand (Sparter) as hero-level signal + one outcome headline + one short import-first supporting line + CTA group (primary Registrati, secondary Entra) + one dominant product visual. No cards, no stat strips, no floating badges/overlays on the hero media, no Pricing.
- **D-03:** Below the fold (still in scope for the proto homepage): two short benefit blocks + closing CTA. Not a full feature dump. “Come funziona” page content is **out of this phase** (Phase 71).
- **D-04:** Positioning copy is import-first / privacy-aligned (e.g. estratti file, non “collega la banca”). Italian UI copy. Real product screenshot preferred over stock/illustration.
- **D-05:** Single hub route with `?variant=` search param + floating bottom switcher (prototype skill UI pattern), not three disconnected URLs as the primary compare UX. Suggested path: `/proto/branding` (variants A/B/C via `?variant=a|b|c`). Separate `/proto/branding-a` style routes are optional aliases only if needed for share links — hub+switcher is the review surface. — **Reversibility:** reversible
- **D-06:** Ship **three** structurally different variants inside the A+B frame (layout/hierarchy/visual weight differ — not three color tweaks). Cap at 3.
- **D-07:** Record the PO pick in `app/proto/branding/NOTES.md` (same ritual as historical overview proto Notes): winning variant id, what to keep/steal from losers, explicit “do not ship” notes. That file is the handoff artifact for Phase 71. Updating REQUIREMENTS checkboxes happens at phase verification / milestone tracking — NOTES.md is the design-lock source of truth. — **Reversibility:** reversible
- **D-08:** Marketing proto may use typography distinct from app Geist for editorial feel; reuse Tailwind tokens / shadcn Button where it speeds the proto. Avoid purple-on-white / purple-indigo gradients, warm-cream+terracotta serif cliché, broadsheet hairline layout, glow effects, emoji clusters.
- **D-09:** Proto stays throwaway: no tests required beyond runnable pages; no production `(public)` components extraction in this phase (extraction is Phase 71). Keep existing `app/proto/layout.tsx` gate (`force-dynamic`, `notFound` without `PROTOTYPES_ENABLED`, robots noindex).

### Claude's Discretion
- Exact three structural axes within A+B (e.g. screenshot-dominant vs split vs type-led-with-shot-below) — planner/executor invent radical differences; user did not prescribe axes beyond A+B.
- Exact Italian headline/subhead wording for the three variants (must stay import-first and honest).
- Whether to embed a static PNG/WebP screenshot asset under `app/proto/branding/` or reference a placeholder frame until a real capture is added — prefer real capture when available; placeholder labeled as such is OK for first Preview.
- Switcher chrome styling (must be clearly “proto tool”, not part of the design under review).

### Deferred Ideas (OUT OF SCOPE)
- `(public)` layout, proxy allowlist for `/`, `/how-it-works`, `/privacy`, `/terms` — Phase 70
- Production homepage + Come funziona + `components/marketing/*` extraction — Phase 71
- Legal MDX pages — Phase 72
- SEO/sitemap/robots + session-aware header + sign-out → `/` — Phase 73
- Pricing, blog, analytics/CMP, video hero, English locale — BRAND-F* / out of scope
- Optional `motion` library — only if CSS/`tw-animate-css` insufficient after proto (research deferred)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BRAND-01 | Visitor on Vercel Preview can compare 2–3 branding UI variants under `app/proto/` (throwaway, `noindex`, `PROTOTYPES_ENABLED`-gated) | Hub `/proto/branding` + `?variant=` + floating switcher; reuse existing proto layout gate; three structural variants A/B/C |
| BRAND-02 | One proto variant is selected as the production design direction before shipping `(public)` page UI | `NOTES.md` winner ritual (historical overview pattern); handoff artifact for Phase 71 — not REQUIREMENTS checkbox as SoT |
</phase_requirements>

## Summary

Phase 69 is a **design-lock sandbox**, not production marketing. Infrastructure already exists: `app/proto/layout.tsx` gates on `PROTOTYPES_ENABLED`, exports `robots: noindex`, forces dynamic rendering; `proxy.ts` already skips session for `/proto/*`. Historical overview/table-toolbar protos were deleted after PO lock — only the layout remains. Rebuild branding variants on the **hub + `?variant=` + floating switcher** pattern from `.claude/skills/prototype/UI.md` and the recovered overview switcher (`cbafe29`), **overriding** older v2.8 research that suggested separate `/proto/branding-{a,b,c}` routes.

No new npm packages. Reuse Next.js 16.2.4, Tailwind 4 tokens, shadcn `Button`, `next/font` for a marketing display face scoped to the branding subtree, `next/image` for a dashboard screenshot (or labeled placeholder). Primary planner risk is **scope creep into `(public)`** and **layout padding** (`p-4 md:p-6` on proto `<main>`) which breaks full-bleed hero composition — fix that for branding before painting variants.

**Primary recommendation:** Ship `/proto/branding` with three structurally different A+B variants, client switcher (always visible under proto gate — never `NODE_ENV` hide), Italian import-first copy, screenshot/placeholder asset, and a NOTES.md template ready for the PO verdict.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Proto env gate + noindex | Frontend Server (SSR) | — | Existing `app/proto/layout.tsx` evaluates `PROTOTYPES_ENABLED` at request time |
| Public access to `/proto/*` | API / Backend (proxy) | — | `proxy.ts` already prefix-matches `/proto`; no change this phase |
| Variant selection (`?variant=`) | Frontend Server (SSR) | Browser / Client | Page awaits `searchParams`; switcher updates URL via `router.replace` |
| Branding UI variants | Browser / Client + SSR | CDN / Static | Mostly static RSC markup; switcher is client-only chrome |
| Screenshot / placeholder asset | CDN / Static | — | Static import or `public/` / colocated asset; no R2 |
| Winner lock (NOTES.md) | — (docs artifact) | — | Human PO write-up; Phase 71 consumes it |
| Auth CTAs (`/register`, `/login`) | Frontend Server | — | Plain `Link` to existing auth routes; no session logic in proto |

## Project Constraints (from .cursor/rules/)

No `.cursor/rules/` directory present in this workspace at research time. Project constraints come from `CLAUDE.md` / `AGENTS.md`: English route segments, Italian product copy, proto under `app/proto/*`, Decimal.js for money (N/A here), no production `drizzle-kit push`, layers `dal`/`services`/`actions` (N/A — no DB in this phase).

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.2.4 (locked in repo; registry latest 16.2.11) | Proto routes, `searchParams` Promise, Metadata robots | Existing monolith; proto layout already correct |
| React | 19 (repo) | RSC + client switcher | Existing |
| Tailwind CSS | ^4 | Layout, atmosphere, typography utilities | Existing design system |
| shadcn/ui `Button` | in-repo `components/ui/button.tsx` | Primary/secondary CTA fidelity | Matches auth CTA affordances |
| `next/font/google` | bundled with Next | Marketing display face distinct from Geist | Official font optimization; no external stylesheet |
| `next/image` | bundled with Next | Product screenshot / placeholder | LCP-friendly hero visuals |
| `tw-animate-css` | ^1.4.0 (repo) | Optional subtle entrance motion | Already imported in `globals.css`; defer `motion` (BRAND-F07) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sonner` / ThemeProvider | existing root layout | Theme inheritance | Do not fight system dark/light — designs should read in both |
| `next/link` | bundled | CTA navigation to `/login`, `/register` | Always for CTAs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hub + `?variant=` | Separate `/proto/branding-a|b|c` | Research SUMMARY suggested separate routes; **CONTEXT D-05 locks hub** — aliases only if share UX needs them |
| CSS/`tw-animate-css` | `motion` package | Deferred (BRAND-F07 / CONTEXT); add only if proto proves CSS insufficient |
| Real screenshot | Stock illustration | Forbidden by D-04 preference; placeholder frame OK if labeled |
| New marketing CSS framework | Keep Tailwind tokens | Continuity with app; faster throwaway |

**Installation:**

```bash
# None — no new packages for Phase 69
```

**Version verification:** `next@16.2.4` in package.json (npm registry latest `16.2.11`); `tw-animate-css@^1.4.0` (registry `1.4.0`). [VERIFIED: npm registry / package.json]

## Package Legitimacy Audit

> Phase installs **zero** new external packages.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | — | N/A — no installs |

**Packages removed due to [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Stakeholder browser (Vercel Preview URL)
        │
        ▼
  proxy.ts ── path.startsWith('/proto') ──► skip session redirect
        │
        ▼
  app/proto/layout.tsx
        ├── if !PROTOTYPES_ENABLED → notFound() (Production 404)
        ├── robots: noindex
        └── dynamic = force-dynamic
                │
                ▼
        /proto/branding (page.tsx)
                ├── await searchParams.variant ∈ {a,b,c} (default a)
                ├── render VariantA | VariantB | VariantC
                │     ├── hero: brand + headline + sub + CTAs + product visual
                │     └── below fold: 2 benefits + closing CTA
                └── PrototypeSwitcher (client)
                      └── router.replace(?variant=…) + ←/→ keys
                │
                ▼
        NOTES.md (human) ──► Phase 71 promotes winner → components/marketing/*
```

Graph note: `.planning/graphs/graph.json` exists but is **stale** (~870h / 1508 commits behind) — treat graph relationships as approximate; graph queries for proto/branding returned empty. [VERIFIED: gsd graphify status]

### Recommended Project Structure

```
app/proto/
├── layout.tsx                 # MODIFY: drop outer p-4/md:p-6 (full-bleed) OR add branding nested layout that escapes padding
└── branding/
    ├── page.tsx               # Hub: await searchParams, mount variant + switcher
    ├── NOTES.md               # PO verdict template (fill after Preview review)
    ├── prototype-switcher.tsx # Client floating bar (adapt from overview proto)
    ├── fonts.ts               # Optional next/font display face for marketing only
    ├── variant-a.tsx          # Structural axis 1
    ├── variant-b.tsx          # Structural axis 2
    ├── variant-c.tsx          # Structural axis 3
    └── assets/
        └── overview-hero.webp # Real capture preferred; else placeholder.svg + label
```

### Pattern 1: Server page + client switcher (Sparter proto standard)

**What:** RSC page awaits `searchParams: Promise<{ variant?: string }>`, validates whitelist, renders one variant. Client `PrototypeSwitcher` updates `?variant=` via `router.replace(pathname + '?' + params, { scroll: false })` and keyboard arrows.

**When to use:** All UI prototypes under `/proto` that need PO comparison.

**Example:**

```tsx
// Source: historical app/proto/overview/page.tsx @ cbafe29 + Next.js searchParams docs
// https://nextjs.org/docs/app/api-reference/file-conventions/page
type Props = { searchParams: Promise<{ variant?: string }> }

const VARIANTS = ['a', 'b', 'c'] as const

export default async function BrandingProtoPage({ searchParams }: Props) {
  const { variant: raw } = await searchParams
  const variant = VARIANTS.includes(raw as (typeof VARIANTS)[number]) ? raw! : 'a'

  return (
    <div className="-m-4 min-h-screen md:-m-6"> {/* escape layout padding if not removed */}
      {variant === 'a' && <VariantA />}
      {variant === 'b' && <VariantB />}
      {variant === 'c' && <VariantC />}
      <PrototypeSwitcher current={variant} />
    </div>
  )
}
```

### Pattern 2: Scoped marketing font (do not replace root Geist)

**What:** Export a display face from `app/proto/branding/fonts.ts` with `variable: '--font-branding-display'`; apply `className` / CSS var on the branding wrapper only.

**When to use:** Editorial A+B typography (D-08) without changing app auth/dashboard chrome.

**Example:**

```tsx
// Source: next/font best practices (multiple fonts via CSS variables)
// https://nextjs.org/docs/app/getting-started/fonts
import { Newsreader } from 'next/font/google' // example — pick non-cliché face at implement time

export const brandingDisplay = Newsreader({
  subsets: ['latin'],
  variable: '--font-branding-display',
  display: 'swap',
})
```

Avoid D-08 clichés: no purple gradients, no warm-cream+terracotta Playfair-style stack, no broadsheet hairlines, no glow/emoji clusters. Prefer cool/quiet atmosphere + green primary token already in `globals.css`.

### Pattern 3: Product visual as dominant plane

**What:** Real `/dashboard/overview` capture as the hero visual plane (D-01/D-04). Use `next/image` with `priority` for LCP; static import preferred for intrinsic size + blur. No floating badges/overlays on the media (D-02).

**When to use:** All three variants — composition differs; asset can be shared.

### Anti-Patterns to Avoid

- **Shipping `(public)` or expanding `PUBLIC_ROUTES`:** Phase 70. Proto already public via `/proto` prefix.
- **Three color themes of one layout:** Violates D-06 / prototype UI skill — structural axes required.
- **Hiding switcher with `NODE_ENV !== 'production'`:** Vercel Preview runs `NODE_ENV=production`; would hide the review tool. Gate is already `PROTOTYPES_ENABLED`. [VERIFIED: historical switcher @ cbafe29 always visible; skill guidance conflicts with Sparter Preview]
- **Copying proto `<main className="… p-4">` into production later:** Pitfall 8 / ARCHITECTURE — promote components, not proto shell.
- **Pricing / Pro tier / bank-linking claims in hero:** Pitfall 15 + D-04.
- **Come funziona page content:** Phase 71 (D-03).
- **Extracting `components/marketing/*` now:** Phase 71 (D-09).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Variant URL state | Custom event bus / localStorage only | `?variant=` + `router.replace` | Shareable Preview links; reload-stable |
| Floating switcher | New design-system control | Adapt overview `PrototypeSwitcher` | Already proven with PO |
| Font loading | `<link href="fonts.googleapis.com">` | `next/font/google` | Self-hosted, no layout shift, privacy |
| Hero image | Raw `<img>` without sizes | `next/image` + `priority` | LCP / CLS |
| Env gate | Per-page `notFound` checks | Existing `app/proto/layout.tsx` | Single gate, `force-dynamic` already correct |
| Motion library | Install `motion` | CSS / `tw-animate-css` | Deferred per CONTEXT |

**Key insight:** This phase succeeds when the PO can flip three *different layouts* on one Preview URL and write a verdict in NOTES.md — not when marketing infrastructure exists.

## Recommended Structural Axes (Claude's Discretion)

Within locked A+B frame, ship these three (planner may rename labels):

| Key | Axis | First-viewport emphasis |
|-----|------|-------------------------|
| `a` | **Shot-as-plane** | Full-bleed overview screenshot as atmosphere; brand + type + CTAs in a quiet band (scrim OK; no badges on media) |
| `b` | **Editorial split** | Asymmetric type column + large product frame (magazine hierarchy) |
| `c` | **Type-led stack** | Oversized brand + headline dominate; product visual as full-width band immediately under the type block |

All three: Italian import-first copy; CTAs Registrati (primary) / Entra (secondary); two benefit blocks + closing CTA below fold; no Pricing.

## Common Pitfalls

### Pitfall 1: Proto layout padding kills full-bleed
**What goes wrong:** Hero looks inset/card-like because layout wraps children in `p-4 md:p-6`.  
**Why it happens:** Overview proto lived inside padded chrome; marketing heroes need edge-to-edge.  
**How to avoid:** Remove padding from `app/proto/layout.tsx` (safe today — only layout exists under proto) **or** negative-margin escape on branding page + document why. Prefer layout fix.  
**Warning signs:** Screenshot has visible page margin; “dashboard chrome” feel from padding alone.

### Pitfall 2: NODE_ENV-gated switcher invisible on Preview
**What goes wrong:** PO opens Preview, sees one variant, cannot compare.  
**Why it happens:** Prototype skill suggests hide in production; Preview is production mode.  
**How to avoid:** Always render switcher under proto routes; rely on `PROTOTYPES_ENABLED` + Production 404.  
**Warning signs:** Switcher works locally (`next dev`) but missing on Vercel Preview URL.

### Pitfall 3: Variants differ only by color/copy
**What goes wrong:** PO cannot lock a direction; Phase 71 thrash.  
**Why it happens:** Fast theming instead of layout axes.  
**How to avoid:** Enforce table of structural axes; if two look alike, redo one.  
**Warning signs:** Switching variants changes hue but not scroll silhouette.

### Pitfall 4: Honest-copy failure (bank sync / pricing)
**What goes wrong:** Stakeholder trusts a promise product cannot keep.  
**Why it happens:** Generic SaaS marketing templates.  
**How to avoid:** Import-first / privacy-aligned Italian copy only (D-04); no Pricing (out of scope).  
**Warning signs:** “Collega la banca”, “Piano Pro”, €/mese in hero.

### Pitfall 5: Scope leak into `(public)`
**What goes wrong:** Partial Phase 70/71 work lands early; proxy/SEO incomplete.  
**Why it happens:** Temptation to “just put the winner on `/`”.  
**How to avoid:** Hard stop at `app/proto/branding/**` + NOTES.md; no `app/(public)/`, no `PUBLIC_ROUTES` edits.  
**Warning signs:** Diff touches `proxy.ts` allowlist beyond comments, or adds `app/(public)`.

### Pitfall 6: Proto confused with production later
**What goes wrong:** Duplicate content / unfinished UX indexed.  
**Why it happens:** Copying proto page into `(public)` wholesale.  
**How to avoid:** Keep noindex + Preview gate; Phase 71 extracts components. Verify Production `/proto/branding` → 404.  
**Warning signs:** Proto paths in sitemap (Phase 73 concern, but don’t add them now).

## Code Examples

### Hub page (searchParams Promise)

```tsx
// Source: Next.js page.js searchParams + Sparter overview proto @ cbafe29
// https://nextjs.org/docs/app/api-reference/file-conventions/page
import { VariantA } from './variant-a'
import { VariantB } from './variant-b'
import { VariantC } from './variant-c'
import { PrototypeSwitcher } from './prototype-switcher'

type Props = { searchParams: Promise<{ variant?: string }> }

export default async function Page({ searchParams }: Props) {
  const { variant: raw } = await searchParams
  const variant = raw === 'b' || raw === 'c' ? raw : 'a'

  return (
    <>
      {variant === 'a' && <VariantA />}
      {variant === 'b' && <VariantB />}
      {variant === 'c' && <VariantC />}
      <PrototypeSwitcher current={variant} />
    </>
  )
}
```

### Floating switcher (adapt — always show under proto)

```tsx
// Source: app/proto/overview/prototype-switcher.tsx @ cbafe29
// https://nextjs.org/docs/app/api-reference/functions/use-search-params
'use client'

import { useCallback, useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const VARIANTS = [
  { key: 'a', name: 'Shot-as-plane' },
  { key: 'b', name: 'Editorial split' },
  { key: 'c', name: 'Type-led stack' },
] as const

export function PrototypeSwitcher({ current }: { current: string }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const go = useCallback(
    (dir: number) => {
      const idx = VARIANTS.findIndex((v) => v.key === current)
      const next = VARIANTS[(idx + dir + VARIANTS.length) % VARIANTS.length].key
      const params = new URLSearchParams(searchParams.toString())
      params.set('variant', next)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [current, searchParams, router, pathname],
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement
      if (el && ['INPUT', 'TEXTAREA'].includes(el.tagName)) return
      if ((el as HTMLElement | null)?.isContentEditable) return
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  const meta = VARIANTS.find((v) => v.key === current) ?? VARIANTS[0]

  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-foreground/20 bg-foreground px-2 py-1.5 text-background shadow-lg">
      <button type="button" onClick={() => go(-1)} aria-label="Variante precedente" className="px-2 text-lg leading-none">
        ‹
      </button>
      <span className="min-w-[12rem] text-center font-mono text-sm">
        {meta.key} — {meta.name}
      </span>
      <button type="button" onClick={() => go(1)} aria-label="Variante successiva" className="px-2 text-lg leading-none">
        ›
      </button>
    </div>
  )
}
```

Note: Parent layout is `force-dynamic`, so Suspense around `useSearchParams` is not required for build green, but wrapping remains harmless. Prefer server `searchParams` for the variant body; client hook only in the switcher. [CITED: nextjs.org/docs useSearchParams]

### CTA group

```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function CtaGroup() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button asChild size="lg">
        <Link href="/register">Registrati</Link>
      </Button>
      <Button asChild size="lg" variant="outline">
        <Link href="/login">Entra</Link>
      </Button>
    </div>
  )
}
```

### NOTES.md template (BRAND-02 handoff)

```markdown
# PROTOTYPE — branding variants · NOTES

> Throwaway. Design-lock source of truth for Phase 71. Delete/archive after promotion.

## Domanda
Quale direzione A+B diventa la homepage di produzione?

## Come provarlo
- Locale: `PROTOTYPES_ENABLED=1 yarn dev` → `/proto/branding?variant=a`
- Preview: Vercel Preview URL + `/proto/branding` (env Preview-scoped)

## Varianti
- **a — Shot-as-plane:** …
- **b — Editorial split:** …
- **c — Type-led stack:** …

## Verdetto PO (compilare dopo review)
- **Winner:** _
- **Steal from losers:** _
- **Do not ship:** _
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| In-app `(app)/…/overview-prototype` | Public `/proto/*` Preview gate | 2026-05 quick-260529-lyd | Stakeholder demos without auth |
| Separate `/proto/branding-{a,b,c}` (research SUMMARY) | Hub + `?variant=` (CONTEXT D-05) | 2026-07-22 discuss | Single share URL for PO |
| Overview/table-toolbar proto trees | Deleted after PO lock | Phase 43 / earlier | Only `layout.tsx` remains — rebuild branding fresh |

**Deprecated/outdated:**
- Research ARCHITECTURE folder listing `branding-a/b/c` as primary — superseded by D-05.
- Prototype skill “hide switcher in production” — unsafe for Sparter Preview; do not apply.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Exact display font family (e.g. Newsreader) is executor choice within D-08 anti-cliché rules | Standard Stack / Pattern 2 | Mild visual misfit — swap font in one file |
| A2 | Removing proto layout padding is preferred over negative margins | Pitfall 1 | If future non-bleed protos return, they need their own padding — acceptable |
| A3 | No real overview screenshot exists in repo yet; first Preview may ship labeled placeholder | Discretion / Assets | Stakeholder feedback on “cool” may wait on capture — flag in NOTES |
| A4 | `Button` `asChild` + `Link` works with current shadcn Slot setup | Code Examples | If not, use `Link` styled as button — verify at implement |

## Open Questions

1. **Real dashboard screenshot availability**
   - What we know: D-04 prefers real `/dashboard/overview` capture; none found under `public/` or `app/proto/`.
   - What's unclear: Who captures (PO vs executor) and light vs dark theme preference.
   - Recommendation: Plan Wave includes optional asset task; ship labeled placeholder if capture missing; update asset before PO final pick.

2. **Whether to tweak `app/proto/layout.tsx` padding globally**
   - What we know: Only branding will live under proto initially.
   - What's unclear: Desire to keep padded shell for future non-marketing protos.
   - Recommendation: Prefer remove padding globally; document that proto pages own their inset.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next build/dev | ✓ | v22.22.3 | — |
| Yarn | Scripts | ✓ | 4.14.1 | — |
| `PROTOTYPES_ENABLED` (local) | Local preview | operator sets | — | `PROTOTYPES_ENABLED=1 yarn dev` |
| `PROTOTYPES_ENABLED` (Vercel Preview) | BRAND-01 stakeholder review | ✓ (established workflow) | Preview-scoped | Document in NOTES if unset |
| Dashboard screenshot asset | Dominant visual | ✗ in repo | — | Labeled placeholder frame |
| PostgreSQL / R2 / auth | — | N/A | — | Not used this phase |

**Missing dependencies with no fallback:** none blocking (placeholder OK per discretion).

**Missing dependencies with fallback:** real overview screenshot → labeled placeholder.

Step 2.6: external deps are Node/Yarn/env only — no Docker/Redis/ffmpeg required.

## Validation Architecture

> `workflow.nyquist_validation` absent in `.planning/config.json` → treat as enabled. **D-09** explicitly: no tests required beyond runnable pages. Automated unit/e2e for throwaway UI are out of scope; gate on manual Preview checklist + typecheck/lint on touched files.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.5 + Playwright (e2e) — existing |
| Config file | Vitest via package scripts; Playwright for e2e |
| Quick run command | `yarn test` (full unit — not required per task for this phase) |
| Full suite command | `yarn test && yarn test:e2e` (not phase gate for proto UI) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BRAND-01 | Preview visitor can open `/proto/branding` and switch `?variant=a\|b\|c` | manual | `PROTOTYPES_ENABLED=1 yarn dev` + browser | ❌ Wave 0 intentional |
| BRAND-01 | Without env → 404; Production → 404 | manual / smoke | Visit without env; verify Vercel Production | ❌ (layout already covers) |
| BRAND-01 | `robots: noindex` on proto | manual inspect / metadata | View page source / Next metadata | ✅ via layout |
| BRAND-02 | Winner recorded in NOTES.md | manual artifact | Human edit after PO review | ❌ (doc task) |

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit` on touched files + `yarn lint` for `app/proto/**` (historical quick task pattern)
- **Per wave merge:** Same + local `PROTOTYPES_ENABLED=1` smoke of all three variants
- **Phase gate:** Preview URL shared; NOTES.md verdict filled; Production `/proto` still 404

### Wave 0 Gaps

- [ ] None required for automated test infra — D-09 waives proto unit tests
- [ ] Optional: add `NOTES.md` template file in first implement task (not a test gap)
- [ ] Manual checklist in plan SUMMARY: env gate, three variants, switcher, CTAs, no Pricing, Italian copy

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Proto is intentionally unauthenticated; no session APIs |
| V3 Session Management | no | — |
| V4 Access Control | partial | Preview-only via `PROTOTYPES_ENABLED`; Production `notFound()` |
| V5 Input Validation | yes | Whitelist `variant` to `a\|b\|c`; ignore other query keys |
| V6 Cryptography | no | — |

### Known Threat Patterns for marketing proto

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Proto indexed / scraped | Information Disclosure | `robots: noindex` + Production 404 without env |
| Open redirect via CTA | Spoofing | Hardcoded `/login` `/register` only |
| XSS via query param reflected into HTML | Tampering | Never echo raw `variant` into HTML without whitelist |
| Stakeholder confuses proto with production | Elevation (social) | Switcher chrome labeled; NOTES access steps; Preview URL discipline |

## Sources

### Primary (HIGH confidence)

- `app/proto/layout.tsx` — env gate, `force-dynamic`, noindex [VERIFIED: codebase]
- `proxy.ts` — `/proto` public prefix [VERIFIED: codebase]
- `.planning/phases/69-proto-design-variants/69-CONTEXT.md` — locked decisions D-01…D-09
- `.planning/REQUIREMENTS.md` — BRAND-01, BRAND-02
- `.planning/research/{SUMMARY,ARCHITECTURE,FEATURES,PITFALLS}.md` — v2.8 marketing research (hub route overridden by CONTEXT)
- Historical proto @ `cbafe29` / NOTES deleted in `b89380d` — switcher + verdict ritual [VERIFIED: git]
- `.claude/skills/prototype/UI.md` — variant radical difference + switcher UX
- `.planning/quick/260529-lyd-proto-public-preview/SUMMARY.md` — Preview workflow
- Next.js docs: `searchParams` / `useSearchParams` [CITED: nextjs.org]
- next/font multiple fonts pattern [CITED: next.js font docs / next-best-practices font.md]

### Secondary (MEDIUM confidence)

- Ref MCP documentation reads for `useSearchParams` and font optimization
- Auth brand treatment `app/(auth)/layout.tsx` — baseline wordmark

### Tertiary (LOW confidence)

- WebSearch hero/`next/image` full-bleed patterns (community blogs) — corroborated with Next Image docs concepts; implement with official `next/image` API

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — reuse verified in-repo; zero new packages
- Architecture: HIGH — proto gate + proxy confirmed; hub pattern locked in CONTEXT + historical switcher recovered
- Pitfalls: HIGH — padding, NODE_ENV, scope leak grounded in codebase + prior research

**Research date:** 2026-07-22  
**Valid until:** 2026-08-22 (30 days; stack stable; design discretion may shift after first Preview)
