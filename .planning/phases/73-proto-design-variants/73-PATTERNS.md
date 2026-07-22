# Phase 69: proto-design-variants - Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 9
**Analogs found:** 8 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/proto/layout.tsx` | layout | request-response | `app/proto/layout.tsx` (self — padding fix only) | exact |
| `app/proto/branding/page.tsx` | route | request-response | `app/proto/table-toolbar/page.tsx` @ `e51aff2` | exact |
| `app/proto/branding/prototype-switcher.tsx` | component | request-response | `app/proto/overview/prototype-switcher.tsx` @ `cbafe29` (prefer over table-toolbar) | exact |
| `app/proto/branding/variant-a.tsx` | component | transform | `app/proto/table-toolbar/variant-a.tsx` @ `e51aff2` + auth/onboarding CTAs | role-match |
| `app/proto/branding/variant-b.tsx` | component | transform | same as variant-a (structurally independent sibling) | role-match |
| `app/proto/branding/variant-c.tsx` | component | transform | same as variant-a (structurally independent sibling) | role-match |
| `app/proto/branding/fonts.ts` | config | — | `app/fonts.ts` | exact |
| `app/proto/branding/NOTES.md` | config | — | `app/proto/table-toolbar/NOTES.md` @ `e51aff2` | exact |
| `app/proto/branding/assets/*` (webp/placeholder) | utility | file-I/O | — | none |

Historical proto trees were deleted (`b89380d` / earlier). Analogs for page/switcher/NOTES/variants are recovered from git commits `e51aff2` (table-toolbar, 3-variant hub) and `cbafe29` (overview switcher without `NODE_ENV` hide). Living analogs for brand mark + CTA: `app/(auth)/layout.tsx`, `app/(app)/onboarding/_components/step-5-outro.tsx`, `components/auth/login-form.tsx`.

## Pattern Assignments

### `app/proto/layout.tsx` (layout, request-response) — MODIFY

**Analog:** self — keep gate / metadata; change chrome only

**Keep unchanged** (lines 10–19):
```typescript
export const dynamic = 'force-dynamic'

export const metadata = {
  robots: { index: false, follow: false },
}

export default function ProtoLayout({ children }: { children: ReactNode }) {
  if (!process.env.PROTOTYPES_ENABLED) {
    notFound()
  }
```

**Padding fix** (line 21 — Pitfall 1 / RESEARCH):
```typescript
// BEFORE (kills full-bleed hero):
return <main className="min-h-screen bg-background p-4 md:p-6">{children}</main>

// AFTER (preferred — proto pages own their own inset):
return <main className="min-h-screen bg-background">{children}</main>
```

Do **not** add a nested branding layout solely to escape padding if the global proto layout can drop padding safely (only branding lives under proto today).

---

### `app/proto/branding/page.tsx` (route, request-response)

**Analog:** `app/proto/table-toolbar/page.tsx` @ `e51aff2` (simplest 3-variant hub)

**Core hub pattern** (adapt keys to lowercase `a|b|c` per D-05; whitelist like overview):
```tsx
// Source: app/proto/table-toolbar/page.tsx @ e51aff2 + overview whitelist @ cbafe29
import { PrototypeSwitcher } from './prototype-switcher'
import { VariantA } from './variant-a'
import { VariantB } from './variant-b'
import { VariantC } from './variant-c'
import { brandingDisplay } from './fonts'

type Props = { searchParams: Promise<{ variant?: string }> }

export default async function BrandingProtoPage({ searchParams }: Props) {
  const { variant: raw } = await searchParams
  const variant = raw === 'b' || raw === 'c' ? raw : 'a'

  return (
    <div className={`${brandingDisplay.variable} min-h-screen`}>
      {variant === 'a' && <VariantA />}
      {variant === 'b' && <VariantB />}
      {variant === 'c' && <VariantC />}
      <PrototypeSwitcher current={variant} />
    </div>
  )
}
```

**searchParams Promise convention** (living codebase — same as auth/dashboard pages):
```typescript
// Source: app/(auth)/login/page.tsx lines 3-8
type LoginPageProps = {
  searchParams: Promise<{ error?: string }>
}
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams
```

**Validation:** whitelist only — never echo raw `variant` into HTML (Security Domain ASVS V5).

**Do not:** create `app/(public)/`, touch `proxy.ts` allowlist, or hide switcher behind `NODE_ENV`.

---

### `app/proto/branding/prototype-switcher.tsx` (component, request-response)

**Analog:** `app/proto/overview/prototype-switcher.tsx` @ `cbafe29` (always visible under proto)

**Prefer overview over table-toolbar:** table-toolbar switcher @ `e51aff2` had `if (process.env.NODE_ENV === 'production') return null` — **unsafe for Vercel Preview** (Pitfall 2 / D-09). Overview switcher did **not** gate on `NODE_ENV`.

**Imports + URL replace** (from overview @ `cbafe29`, simplified to one axis):
```tsx
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
```

**Keyboard + chrome** (overview @ `cbafe29` — Italian aria-labels; high-contrast pill = proto tool, not design under review):
```tsx
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

  // ALWAYS render under /proto — never NODE_ENV gate
  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-foreground/20 bg-foreground px-2 py-1.5 text-background shadow-lg">
      {/* ‹ label › — font-mono so chrome reads as tool */}
    </div>
  )
```

---

### `app/proto/branding/variant-{a,b,c}.tsx` (component, transform)

**Analog (structure):** historical `variant-*.tsx` under `app/proto/table-toolbar/` @ `e51aff2` — exported `VariantA`/`B`/`C`, structurally independent, minimal shared chrome.

**Analog (marketing composition):** `app/(auth)/layout.tsx` (wordmark) + `app/(app)/onboarding/_components/step-5-outro.tsx` (Italian headline + primary/secondary CTA pair).

**Export convention** (table-toolbar):
```tsx
// Source: app/proto/table-toolbar/variant-a.tsx @ e51aff2
export function VariantA() {
  return (
    <div className="…">
      {/* structurally unique layout — do not share a Layout shell across A/B/C */}
    </div>
  )
}
```

**Brand mark baseline** (elevate beyond this for marketing — D-08):
```tsx
// Source: app/(auth)/layout.tsx lines 9-11
<span className="text-2xl font-semibold tracking-tight text-foreground">Sparter</span>
```

**CTA group** (shadcn `Button asChild` + routes — living onboarding pattern; auth uses hardcoded `/login` `/register`):
```tsx
// Source: app/(app)/onboarding/_components/step-5-outro.tsx lines 20-30
// + components/auth/login-form.tsx Link href="/register"
import Link from 'next/link'
import { Button } from '@/components/ui/button'

<div className="flex flex-wrap gap-3">
  <Button asChild size="lg">
    <Link href="/register">Registrati</Link>
  </Button>
  <Button asChild size="lg" variant="outline">
    <Link href="/login">Entra</Link>
  </Button>
</div>
```

`Button` supports `asChild` via `Slot.Root` (`components/ui/button.tsx` lines 47–54) — confirmed living.

**Composition constraints per D-02/D-03 (all three variants):**
- First viewport: brand + one headline + one import-first sub + CTA group + one dominant product visual
- No cards, no stat strips, no floating badges/overlays on hero media, no Pricing
- Below fold: two short benefit blocks + closing CTA
- Italian copy only; import-first / privacy-aligned (no “collega la banca”)

**Structural axes** (Claude's Discretion / RESEARCH — not color tweaks):

| File | Axis | Emphasis |
|------|------|----------|
| `variant-a.tsx` | Shot-as-plane | Full-bleed overview shot as atmosphere; quiet type/CTA band |
| `variant-b.tsx` | Editorial split | Asymmetric type column + large product frame |
| `variant-c.tsx` | Type-led stack | Oversized brand+headline; product band under type |

**Anti-pattern from prototype skill:** do not share a common `<Layout>` across variants — only tiny helpers (e.g. shared `CtaGroup` / screenshot component) if needed.

---

### `app/proto/branding/fonts.ts` (config)

**Analog:** `app/fonts.ts` (living root fonts — copy shape, different family, scoped variable)

```typescript
// Source: app/fonts.ts lines 1-13
import { Geist, Geist_Mono } from 'next/font/google'

export const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
})
```

**Adapt for branding only** (do not replace root Geist in `app/layout.tsx`):
```typescript
import { Newsreader } from 'next/font/google' // example — executor picks non-cliché face within D-08

export const brandingDisplay = Newsreader({
  subsets: ['latin'],
  variable: '--font-branding-display',
  display: 'swap',
})
```

Apply `brandingDisplay.variable` on the branding wrapper in `page.tsx` only. Root layout keeps Geist (`app/layout.tsx` lines 18–19).

**D-08 avoid:** purple-indigo gradients, warm-cream+terracotta Playfair cliché, broadsheet hairlines, glow, emoji clusters.

---

### `app/proto/branding/NOTES.md` (config / handoff artifact)

**Analog:** `app/proto/table-toolbar/NOTES.md` @ `e51aff2` (question + how-to + variants + **Verdetto**)

**Required sections for BRAND-02:**
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

**Verdict ritual** (table-toolbar filled example @ `e51aff2`):
```markdown
## Verdetto

**Vincitore: A — …** Confermato dall'utente (YYYY-MM-DD).
- Struttura: …
- B e C scartate; pezzi ripresi: … / nessuno.
```

Ship template empty in Wave 1; fill after PO Preview review (not REQUIREMENTS checkbox as SoT — D-07).

---

### `app/proto/branding/assets/*` (utility, file-I/O)

**Analog:** none in repo — no `next/image` usage found; no dashboard screenshot under `public/` or `app/proto/`.

**Follow RESEARCH Pattern 3:**
- Prefer real `/dashboard/overview` capture as shared asset across A/B/C
- Else labeled placeholder frame (OK for first Preview per Claude's Discretion)
- Use `next/image` with `priority` for LCP; static import preferred for intrinsic size
- No floating badges/overlays on the media (D-02)

Planner should treat asset as optional Wave task with labeled-placeholder fallback (Assumptions Log A3).

## Shared Patterns

### Proto env gate + noindex
**Source:** `app/proto/layout.tsx` lines 10–19  
**Apply to:** Entire branding subtree (inherit — do not re-check per page)  
```typescript
export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }
if (!process.env.PROTOTYPES_ENABLED) notFound()
```

### Public `/proto` access (no change)
**Source:** `proxy.ts` ~lines 35–38  
**Apply to:** Confirm only — do not edit this phase  
```typescript
const isPublicRoute = PUBLIC_ROUTES.includes(path) || path.startsWith('/proto')
```

### Variant URL state
**Source:** overview/table-toolbar switchers @ `cbafe29` / `e51aff2`  
**Apply to:** `page.tsx` + `prototype-switcher.tsx`  
- Server: await `searchParams`, whitelist `a|b|c`, default `a`  
- Client: `router.replace(pathname + '?' + params, { scroll: false })`  
- Keyboard ←/→ with input/contentEditable guard  

### Auth CTAs
**Source:** `step-5-outro.tsx` + `login-form.tsx` + `components/ui/button.tsx`  
**Apply to:** all three variants (hero + closing CTA)  
- Primary: `Button asChild size="lg"` → `/register` “Registrati”  
- Secondary: `variant="outline"` → `/login` “Entra”  
- Hardcoded paths only (no open redirect)

### Throwaway discipline
**Source:** historical proto file headers + NOTES  
**Apply to:** all branding source files  
- Top comment: `// PROTOTYPE — wipe me.` / NOTES “Throwaway” banner  
- No unit/e2e required (D-09); gate on `tsc`/`lint` + manual Preview checklist  
- Do not extract `components/marketing/*` this phase (Phase 71)

### Full-bleed vs padded shell
**Source:** RESEARCH Pitfall 1 + current `layout.tsx` line 21  
**Apply to:** layout modify first, then paint variants  
- Prefer remove `p-4 md:p-6` from proto layout  
- Fallback only: negative margin escape on branding page (`-m-4 md:-m-6`)

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/proto/branding/assets/*` | utility | file-I/O | No `next/image` hero usage and no overview screenshot in repo; use RESEARCH Pattern 3 + labeled placeholder |

## Metadata

**Analog search scope:** `app/proto/**` (living + git history `cbafe29`, `e51aff2`), `app/(auth)/**`, `app/(app)/onboarding/**`, `app/fonts.ts`, `app/layout.tsx`, `components/ui/button.tsx`, `components/auth/**`, `proxy.ts`, `.claude/skills/prototype/UI.md`  
**Files scanned:** ~25 (living) + 6 historical proto files recovered from git  
**Pattern extraction date:** 2026-07-22  

**Planner notes:**
1. Closest end-to-end template is **table-toolbar hub** (3 variants) + **overview switcher** (no `NODE_ENV` hide).
2. Marketing visual design has no living production analog — invent within A+B + D-08; steal CTA/auth/font wiring only.
3. Scope hard-stop: `app/proto/branding/**` + `app/proto/layout.tsx` padding — nothing under `app/(public)/`.
