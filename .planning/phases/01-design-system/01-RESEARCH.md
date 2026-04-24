# Phase 1: Design System — Research

**Researched:** 2026-04-24
**Domain:** Next.js 16 App Router bootstrap, shadcn/ui New York + Tailwind v4, Geist fonts, layout shell
**Confidence:** HIGH (core stack verified against official docs + npm registry)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01**: Sidebar nav items `(app)`: Dashboard → Spese → Import → Categorie + Impostazioni in fondo (separatore). Ordine fisso.
- **D-02**: Badge uncategorized count su: voce "Categorie" sidebar (badge numerico) + sezione KPI Dashboard.
- **D-03**: Mobile (< 768px): bottom navigation bar con 4 voci principali (Dashboard, Spese, Import, Categorie). Impostazioni via avatar only.
- **D-04**: Topbar `(app)`: logo Sparter sinistra + avatar destra con DropdownMenu (Profilo, Logout). No page title nel topbar.
- **D-05**: Layout `(auth)`: minimal, senza sidebar/topbar. Logo centrato + contenuto.
- **D-06**: Brand color: emerald-600 (#059669) come `--primary`. Base color shadcn/ui: slate.
- **D-07**: Colori semantici KPI: totalIn=emerald-600, totalOut=red-500, balance=slate-700, savingsRate condicionale.
- **D-08**: shadcn/ui style: New York, radius 0.5rem.
- **D-09**: Font: Geist (UI) + Geist Mono (numeri finanziari) via `next/font/google`.
- **D-10**: Bootstrap completo Phase 1: Next.js 16, tutti i pacchetti stack, tsconfig @/, Tailwind, .env.example, lib/db/ stub, lib/dal/ lib/services/ lib/actions/ directories vuote.
- **D-11**: Page stubs: solo `/login` (auth) e `/dashboard` (app).
- **D-12**: Componenti shadcn: Button, Input, Card, Badge, Select, Dialog, Separator, Avatar, DropdownMenu, Sheet.

### Claude's Discretion

- Esatta palette CSS variables (shade variants per hover, focus, muted) — derivate da emerald/slate seguendo convenzioni shadcn/ui
- Breakpoints sidebar → bottom-nav: `md` = 768px (raccomandato)
- Struttura file componenti UI: `components/ui/` standard shadcn

### Deferred Ideas (OUT OF SCOPE)

- Schema Drizzle completo → Fase 2+
- Dark mode toggle → Out of scope v1
- Animazioni/transizioni sidebar → future phases
- Pagine stub aggiuntive (register, expenses, import, categories, settings) → rispettive fasi
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DS-01 | Token colore e tipografia coerenti (palette, CSS variables Tailwind) | CSS variables via shadcn/ui New York init; emerald/slate tokens in globals.css; Geist variable fonts as CSS vars |
| DS-02 | Componenti base: Button, Input, Card, Badge, Select, Modal | `npx shadcn@latest add` per ciascun componente; install installs Radix primitives automatically |
| DS-03 | Layout shell con route group `(auth)` e `(app)` (sidebar + topbar) | Next.js route groups in app/(auth)/ e app/(app)/; layout.tsx per group; bottom nav con Tailwind responsive classes |
</phase_requirements>

---

## Summary

Phase 1 bootstraps a fresh Next.js 16 App Router project with the complete Sparter stack and delivers a working visual foundation. The project is being started from zero — no existing code, no existing DB.

The two most significant shifts since the previous STACK.md research (which was done against Next.js 15): (1) **`middleware.ts` is renamed to `proxy.ts`** in Next.js 16 — the edge runtime is NOT supported in proxy; runtime is Node.js only. (2) **Tailwind CSS ships as v4** by default with create-next-app — shadcn/ui has adapted with a new Tailwind v4 CSS variable model using `@theme inline` instead of `tailwind.config.js`. Both are confirmed via official Next.js 16 upgrade guide and shadcn docs.

The shadcn/ui init produces `components.json` with `style: "new-york"` and writes CSS variables into `globals.css` using the `@theme inline` pattern. Geist and Geist_Mono are importable from `next/font/google` directly. The drizzle-kit/drizzle-orm version pairing has changed: current versions are drizzle-orm `0.45.2` and drizzle-kit `0.31.10` — the old "ORM minor - 8" matching rule no longer applies; use latest of each.

**Primary recommendation:** Run `create-next-app@latest` with recommended defaults (TypeScript, Tailwind, App Router, Turbopack), then run `npx shadcn@latest init` to configure New York style. Customize globals.css for emerald primary and add Geist fonts via next/font/google. Build route groups and stubs manually.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Route groups / layout shell | Frontend Server (SSR) | — | layout.tsx files are React Server Components; no data, pure markup |
| CSS variables / design tokens | Browser / Client | CDN/Static | Injected via globals.css at build; served as static CSS |
| Font loading (Geist) | Frontend Server (SSR) | CDN/Static | next/font inlines @font-face at build, no runtime requests |
| Sidebar / topbar shell | Frontend Server (SSR) | Browser/Client | Shell is static SC; active-link highlighting needs 'use client' for pathname |
| Mobile bottom nav | Browser / Client | — | Fixed positioning; active state needs usePathname() |
| shadcn components | Browser / Client | — | Radix primitives require client interactivity |
| lib/db/ stub | API / Backend | — | server-only guard; never reaches browser |
| .env.example | Build | — | Documentation file; not a runtime artifact |

---

## Stack Version Verification

All versions verified against npm registry on 2026-04-24.

| Package | Verified Version | Registry Source | Notes |
|---------|-----------------|-----------------|-------|
| next | 16.2.4 | [VERIFIED: npm registry] | Use `next@latest` |
| react | 19.2.5 | [VERIFIED: npm registry] | Next.js 16 ships React 19.2 canary |
| react-dom | 19.2.5 | [VERIFIED: npm registry] | Must match react version |
| drizzle-orm | 0.45.2 | [VERIFIED: npm registry] | Use `drizzle-orm@latest` |
| drizzle-kit | 0.31.10 | [VERIFIED: npm registry] | Use `drizzle-kit@latest` |
| mysql2 | 3.22.2 | [VERIFIED: npm registry] | |
| better-auth | 1.6.9 | [VERIFIED: npm registry] | Replaces NextAuth — research API in Phase 2 |
| zod | 4.3.6 | [VERIFIED: npm registry] | Major version jump from 3.x; verify API in Phase 2 |
| decimal.js | 10.6.0 | [VERIFIED: npm registry] | |
| @aws-sdk/client-s3 | 3.1036.0 | [VERIFIED: npm registry] | |
| @aws-sdk/s3-request-presigner | 3.1036.0 | [VERIFIED: npm registry] | Must match client-s3 version |
| tailwindcss | 4.2.4 | [VERIFIED: npm registry] | v4 — different from v3 config format |
| shadcn (CLI) | 4.4.0 | [VERIFIED: npm registry] | `npx shadcn@latest` |
| lucide-react | 1.9.0 | [VERIFIED: npm registry] | Bundled with shadcn New York |
| clsx | 2.1.1 | [VERIFIED: npm registry] | Used by shadcn utils |
| tailwind-merge | 3.5.0 | [VERIFIED: npm registry] | Used by shadcn cn() util |
| server-only | 0.0.1 | [VERIFIED: npm registry] | Install separately for lib/db guard |
| geist (npm package) | 1.7.0 | [VERIFIED: npm registry] | Vercel's geist package; NOT needed — use next/font/google instead |

### Critical Version Notes

**Zod v4:** The current npm latest is 4.3.6, a major version jump. Phase 1 installs it but uses no Zod in Phase 1. Verify Zod v4 API changes before Phase 2 uses it for validation. [ASSUMED: Zod v4 API is backward-compatible for basic schemas — must verify]

**drizzle-kit + drizzle-orm pairing:** The old "ORM minor - 8" matching rule (0.36 + 0.28) is outdated. Current versions are 0.45.2 + 0.31.10. The drizzle-kit package no longer lists drizzle-orm as a peer dependency in the npm registry output — install both at latest and they are designed to work together. [VERIFIED: npm registry] [ASSUMED: current latest pair is compatible — check Drizzle changelog if issues arise]

**React 19.2:** Next.js 16 uses React 19.2 canary (not stable React 19.x). This is expected and documented behavior. [VERIFIED: nextjs.org/docs/app/guides/upgrading/version-16]

---

## Next.js 16 Project Initialization

### Exact Command

[VERIFIED: nextjs.org/docs/app/getting-started/installation]

```bash
npx create-next-app@latest sparter --yes
```

The `--yes` flag uses recommended defaults:
- TypeScript: yes
- ESLint: yes (ESLint flat config format in v16 — not `.eslintrc`)
- Tailwind CSS: yes (Tailwind v4)
- App Router: yes
- Turbopack: yes (now default bundler in Next.js 16)
- Import alias: `@/*`
- AGENTS.md: yes (Next.js coding guide for agents)
- `src/` directory: no (by default)

### Generated Project Structure

```
sparter/
├── app/
│   ├── globals.css          # Tailwind v4 @import + @theme inline
│   ├── layout.tsx           # Root layout with html/body
│   └── page.tsx             # Home page stub
├── public/                  # Static assets
├── next.config.ts           # TypeScript config (not .js)
├── tailwind.config.ts       # Not present in v4 — Tailwind v4 uses CSS-only config
├── tsconfig.json            # With @/* path alias pre-configured
├── package.json
├── eslint.config.mjs        # ESLint flat config (not .eslintrc)
└── AGENTS.md                # Next.js coding guide
```

**Important:** Tailwind CSS v4 does NOT use `tailwind.config.js`. Configuration is done entirely in CSS via `@theme inline` in `globals.css`.

### Next.js 16 Breaking Changes Relevant to Phase 1

[VERIFIED: nextjs.org/docs/app/guides/upgrading/version-16]

1. **`middleware.ts` → `proxy.ts`**: The file is renamed to `proxy.ts`. The exported function must be named `proxy` (or default export). The edge runtime is NOT supported — proxy runs on Node.js only. For Phase 1, create a placeholder `proxy.ts` that allows all requests.

2. **Async Request APIs fully removed**: `params` and `searchParams` in `page.tsx` are now always Promises. No synchronous access. Pattern:
   ```ts
   export default async function Page({ params }: { params: Promise<{ id: string }> }) {
     const { id } = await params
   }
   ```

3. **Turbopack is default bundler**: `next dev` and `next build` use Turbopack by default. `next dev --turbopack` flag no longer needed. Custom webpack configs will cause build failures unless `--webpack` flag is used.

4. **`next lint` removed**: Use ESLint CLI directly (`eslint`). ESLint flat config format (`eslint.config.mjs`) is required.

5. **`revalidateTag` requires second argument**: `revalidateTag('tag', 'max')`. Single-argument form deprecated. Phase 1 doesn't use revalidateTag but future phases must be aware.

6. **`skipMiddlewareUrlNormalize` renamed to `skipProxyUrlNormalize`** in next.config.ts.

7. **React Compiler stable**: Available as `reactCompiler: true` in next.config.ts but NOT enabled by default. Leave off for Phase 1.

---

## shadcn/ui Init (New York + Slate + Emerald)

### Init Command

[VERIFIED: ui.shadcn.com/docs/installation/next]

```bash
npx shadcn@latest init
```

Interactive prompts will ask for:
- Style: New York
- Base color: (slate may not be listed — select neutral or zinc as closest; then manually customize CSS vars for slate palette)
- CSS variables: yes

**Critical finding about slate:** A GitHub issue (shadcn-ui/ui#10197) reports that slate is missing from the base colors in `shadcn create`. Available base colors in the current shadcn CLI are: Neutral, Stone, Zinc, Mauve, Olive, Mist, Taupe. Slate is NOT listed. [VERIFIED: github.com/shadcn-ui/ui/issues/10197, confirmed via search]

**Resolution:** Initialize with `zinc` as the base color (closest to slate), then manually override the CSS variables in `globals.css` to use slate palette values. Since the design decisions use Tailwind's standard slate color tokens, map them manually.

### What shadcn init writes

**`components.json`** (example for New York + zinc, pre-customization):
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "zinc",
    "cssVariables": true,
    "prefix": ""
  },
  "rsc": true,
  "tsx": true,
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

Note: `tailwind.config` is empty string for Tailwind v4 (no config file).

**`globals.css`** structure with Tailwind v4:

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  --radius: 0.5rem;  /* D-08: New York radius */
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.515 0.154 153.85); /* emerald-600 #059669 */
  --primary-foreground: oklch(1 0 0); /* white */
  --secondary: oklch(0.966 0.002 247.84); /* slate-100 */
  --secondary-foreground: oklch(0.211 0.026 264.88); /* slate-900 */
  --muted: oklch(0.966 0.002 247.84);
  --muted-foreground: oklch(0.556 0.013 265.64); /* slate-500 */
  --accent: oklch(0.966 0.002 247.84);
  --accent-foreground: oklch(0.211 0.026 264.88);
  --destructive: oklch(0.637 0.237 25.33); /* red-500 */
  --border: oklch(0.929 0.007 264.53); /* slate-200 */
  --input: oklch(0.929 0.007 264.53);
  --ring: oklch(0.515 0.154 153.85); /* emerald-600 for focus rings */
}

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  /* ... etc */
}
```

[ASSUMED: Exact OKLCH values for emerald-600 and slate tokens — verify against shadcn theming docs or use CSS color picker to convert. The pattern and structure are VERIFIED; specific OKLCH values are [ASSUMED] based on emerald-600 = #059669 → OKLCH conversion.]

### Component Installation Command

```bash
npx shadcn@latest add button input card badge select dialog separator avatar dropdown-menu sheet
```

Each install pulls down: the component file to `components/ui/`, the required Radix UI primitive package, and any peer utilities.

---

## Geist Font Setup

### Import Syntax

[VERIFIED: nextjs.org/docs/app/api-reference/components/font + WebSearch confirming Geist available in next/font/google]

Geist and Geist_Mono are available in `next/font/google` (not `next/font/local`). They are hosted on Google Fonts by Vercel.

```ts
// app/fonts.ts  (recommended: separate fonts file for reuse)
import { Geist, Geist_Mono } from 'next/font/google'

export const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
})

export const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
})
```

Both are variable fonts — no `weight` parameter required.

### Apply in Root Layout

[VERIFIED: nextjs.org/docs/app/api-reference/components/font]

```tsx
// app/layout.tsx
import { geistSans, geistMono } from './fonts'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className={`${geistSans.className} antialiased`}>
        {children}
      </body>
    </html>
  )
}
```

The `variable` option adds `--font-geist-sans` and `--font-geist-mono` as CSS custom properties on `<html>`. The `className` on `<body>` applies Geist as the default sans font.

### Wire to Tailwind v4

In `globals.css` under `@theme inline`:

```css
@theme inline {
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  /* ... shadcn color vars */
}
```

This makes `font-sans` = Geist and `font-mono` = Geist Mono available as Tailwind utility classes.

### Applying Geist Mono to Financial Numbers

Per D-09 and UI-SPEC.md: all monetary amounts, KPI values, badge counts, and table numbers must use `font-mono`. Apply via Tailwind utility class:

```tsx
<span className="font-mono">€12.450,00</span>
```

No additional setup needed — Tailwind `font-mono` maps to `--font-mono` = Geist Mono.

---

## CSS Variables & Color System

### Tailwind v4 Model

[VERIFIED: ui.shadcn.com/docs/tailwind-v4, nextjs.org docs]

Tailwind v4 uses a **CSS-first configuration** model. There is no `tailwind.config.js`. All configuration happens in `globals.css`:

```css
@import "tailwindcss";        /* loads all Tailwind utilities */

@theme inline {               /* defines Tailwind design tokens as CSS vars */
  --color-primary: var(--primary);
  --font-sans: var(--font-geist-sans);
  --radius-lg: var(--radius);
}
```

The `@theme inline` block registers design tokens that Tailwind uses to generate utility classes. Token references in `@theme inline` point to CSS custom properties defined in `:root`.

### Adding Project-Specific Tokens

The UI-SPEC.md specifies custom semantic tokens for Sparter KPI colors. Add these to `globals.css`:

```css
:root {
  /* ... shadcn base variables ... */

  /* Sparter KPI semantic colors */
  --color-total-in: oklch(0.515 0.154 153.85);   /* emerald-600 */
  --color-total-out: oklch(0.637 0.237 25.33);    /* red-500 */
  --color-balance: oklch(0.372 0.033 264.39);     /* slate-700 */
}

@theme inline {
  /* ... shadcn tokens ... */
  --color-total-in: var(--color-total-in);
  --color-total-out: var(--color-total-out);
  --color-balance: var(--color-balance);
}
```

This makes `text-total-in`, `bg-total-in`, etc. available as Tailwind utility classes.

### Emerald Primary Override

shadcn init may not offer slate as base color and will default primary to the base color hue. After init, manually edit `:root` in `globals.css` to set:

```css
--primary: oklch(0.515 0.154 153.85);  /* emerald-600 */
--primary-foreground: oklch(1 0 0);     /* white */
--ring: oklch(0.515 0.154 153.85);      /* emerald-600 focus ring */
```

---

## Route Group Layout Structure

### File Tree

[VERIFIED: nextjs.org docs — route groups; ARCHITECTURE.md]

```
app/
├── (auth)/
│   ├── layout.tsx        # Minimal: centered logo + content, no sidebar
│   └── login/
│       └── page.tsx      # Login form stub
│
├── (app)/
│   ├── layout.tsx        # Shell: sidebar + topbar + content area
│   └── dashboard/
│       └── page.tsx      # Dashboard stub
│
├── layout.tsx            # Root layout: <html>, <body>, fonts
├── globals.css           # Tailwind v4 + CSS variables
└── fonts.ts              # Geist/GeistMono definitions
```

### Root Layout (app/layout.tsx)

```tsx
import type { Metadata } from 'next'
import { geistSans, geistMono } from './fonts'
import './globals.css'

export const metadata: Metadata = {
  title: 'Sparter',
  description: 'Personal finance per il mercato italiano',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className={`${geistSans.className} antialiased`}>
        {children}
      </body>
    </html>
  )
}
```

### Auth Layout (app/(auth)/layout.tsx)

Per D-05: minimal, centered, no sidebar, no topbar.

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm px-4">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <span className="text-2xl font-semibold tracking-tight">Sparter</span>
        </div>
        {children}
      </div>
    </div>
  )
}
```

### App Layout (app/(app)/layout.tsx)

Per D-01 through D-04: sidebar (desktop) + topbar + bottom nav (mobile).

```tsx
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { BottomNav } from '@/components/layout/bottom-nav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar — hidden on mobile, shown on md+ */}
      <aside className="hidden md:flex md:w-60 md:flex-shrink-0">
        <Sidebar />
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
        {/* Bottom nav — shown on mobile only */}
        <BottomNav className="md:hidden" />
      </div>
    </div>
  )
}
```

**Note:** `Sidebar`, `Topbar`, and `BottomNav` are created as separate components in `components/layout/`. Active link detection requires `'use client'` + `usePathname()`.

### Route Group Behavior

Route groups `(auth)` and `(app)` do NOT appear in the URL. `/login` routes to `app/(auth)/login/page.tsx`. `/dashboard` routes to `app/(app)/dashboard/page.tsx`. Both route groups have separate `layout.tsx` files that apply their respective shells.

---

## Mobile Bottom Navigation

### Pattern

[ASSUMED based on established Next.js App Router patterns — no specific shadcn component]

Bottom nav is a custom component — shadcn/ui does not include one. Use plain Tailwind + Next.js `usePathname()` for active state.

```tsx
// components/layout/bottom-nav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Receipt, Upload, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/expenses', label: 'Spese', icon: Receipt },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/categories', label: 'Categorie', icon: Tag },
]

export function BottomNav({ className }: { className?: string }) {
  const pathname = usePathname()

  return (
    <nav className={cn(
      'fixed bottom-0 left-0 right-0 z-50',
      'flex h-16 items-center border-t border-border bg-background',
      className
    )}>
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 py-2',
              'min-h-[44px]',  // WCAG 2.5.5 touch target
              isActive ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-xs">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
```

Per D-03 and UI-SPEC: Impostazioni NOT in bottom nav. Touch targets minimum 44px per WCAG 2.5.5.

The `md:hidden` class in the app layout hides the bottom nav on screens >= 768px (Tailwind `md` breakpoint).

---

## Package Installation Order

### Step 1: Bootstrap with create-next-app

```bash
npx create-next-app@latest sparter \
  --typescript \
  --eslint \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --yes
cd sparter
```

Or interactive (recommended for first run to confirm Tailwind v4 is selected).

### Step 2: shadcn/ui Init

```bash
npx shadcn@latest init
```

Prompts: New York style, zinc base color (slate not available — manually customize after), CSS variables: yes.

### Step 3: Install shadcn Components

```bash
npx shadcn@latest add button input card badge select dialog separator avatar dropdown-menu sheet
```

This installs Radix primitives automatically. No manual Radix installs needed.

### Step 4: Install Stack Packages

```bash
npm install drizzle-orm mysql2 better-auth zod decimal.js \
  @aws-sdk/client-s3 @aws-sdk/s3-request-presigner \
  server-only
```

```bash
npm install --save-dev drizzle-kit @types/node tsx
```

### Step 5: Verify No Peer Conflicts

```bash
npm ls --depth=0 2>&1 | grep WARN
```

Expected warnings: React peer dependency warnings from some packages that still specify `^18` but work fine with React 19. These are known ecosystem lag warnings and are not errors.

### No Peer Dependency Issues Expected

[VERIFIED: npm view checks]

- Next.js 16 peer deps: `react ^18.2.0 || ^19.0.0` — React 19.2 satisfies this
- drizzle-orm 0.45: optional peer deps (mysql2, pg, etc.) — install mysql2 explicitly
- better-auth 1.6.9: no conflicting peers observed
- zod 4.3.6: standalone, no peer deps
- decimal.js 10.6.0: standalone
- aws-sdk v3: standalone modular packages

---

## lib/db Stub Structure

### What Phase 1 Needs

Phase 1 creates a placeholder `lib/db/index.ts` that:
1. Has `import 'server-only'` to prevent client-side imports
2. Is typed correctly for future Drizzle MySQL connection
3. Does NOT actually connect to a database (no DATABASE_URL required in Phase 1)

```ts
// lib/db/index.ts
import 'server-only'

// Drizzle ORM MySQL client — initialized in Phase 2 when DATABASE_URL is available
// Import shape for reference:
// import { drizzle } from 'drizzle-orm/mysql2'
// import mysql from 'mysql2/promise'
// import * as schema from './schema'

// Phase 1 stub — db is undefined until Phase 2 wires the connection
// Do not import this file anywhere in Phase 1 UI code
export const db = null as unknown as import('drizzle-orm/mysql2').MySql2Database

export type DbOrTx = typeof db
```

The `DbOrTx` type is exported now so Phase 5 DAL helpers can import it without modifying this file.

### Directory Structure to Create

```
lib/
├── db/
│   ├── index.ts       # server-only stub (above)
│   └── schema.ts      # empty placeholder — schemas added in Phase 3+
├── dal/
│   └── .gitkeep       # ensures directory is tracked in git
├── services/
│   └── .gitkeep
├── actions/
│   └── .gitkeep
└── validations/
    └── .gitkeep
```

### drizzle.config.ts (Phase 1 stub)

Create but commented out — migrations require DATABASE_URL which isn't set in Phase 1:

```ts
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'mysql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

---

## tsconfig & Path Aliases

[VERIFIED: nextjs.org/docs/app/getting-started/installation + create-next-app defaults]

`create-next-app` generates `tsconfig.json` with `@/*` alias pre-configured:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

No manual edits needed for the `@/` alias. The `strict: true` setting is already correct per CLAUDE.md requirements.

---

## proxy.ts Placeholder (Phase 1)

[VERIFIED: nextjs.org/docs/app/guides/upgrading/version-16]

Phase 1 creates a minimal `proxy.ts` that allows all traffic through. Phase 2 will implement the JWT auth check.

```ts
// proxy.ts  — Phase 1 placeholder
// Next.js 16: middleware.ts renamed to proxy.ts
// Runtime is nodejs (NOT edge) — this cannot be changed
import { type NextRequest, NextResponse } from 'next/server'

export function proxy(_request: NextRequest) {
  // Phase 1: allow all requests through
  // Phase 2: add Better Auth JWT check + staging bypass
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)',
  ],
}
```

**Critical:** In Next.js 16, `proxy.ts` runs on **Node.js runtime** (not edge). This is a change from Next.js 15 middleware which could run on edge. The implication for Phase 2: Better Auth helpers that use Node.js APIs are safe to import in proxy.ts, but keep it JWT-only — no DB queries.

---

## .env.example

Create at project root documenting all future env vars:

```bash
# .env.example — copy to .env.local and fill in values

# Database (Railway MySQL — available in Phase 2+)
DATABASE_URL=mysql://user:password@host.railway.app:3306/railway

# Better Auth (Phase 2)
BETTER_AUTH_SECRET=your-32-char-secret-here
BETTER_AUTH_URL=http://localhost:3000

# Cloudflare R2 (Phase 5)
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=sparter-uploads

# Staging bypass (all environments)
STAGING_KEY=your-random-bypass-key
```

---

## Validation Architecture

### Test Framework

Nyquist validation is enabled in `config.json` (`nyquist_validation: true`).

Phase 1 is pure UI bootstrap — no existing test infrastructure detected.

| Property | Value |
|----------|-------|
| Framework | None installed yet — Wave 0 must install |
| Recommended | Playwright (E2E, no DB needed for Phase 1) or Vitest (unit) |
| Quick run command | `npx playwright test --project=chromium` (after setup) |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DS-01 | CSS variables present in DOM (--primary, --font-geist-sans) | Smoke | `playwright test tests/design-system.spec.ts` | ❌ Wave 0 |
| DS-01 | Geist font loaded (no CLS) | Smoke/manual | Lighthouse CLS check | Manual |
| DS-02 | shadcn Button renders without errors at /login | Smoke | `playwright test tests/design-system.spec.ts` | ❌ Wave 0 |
| DS-02 | shadcn components present in DOM | Smoke | `playwright test tests/design-system.spec.ts` | ❌ Wave 0 |
| DS-03 | /login returns 200 and renders auth layout (no sidebar) | Smoke | `playwright test tests/layout.spec.ts` | ❌ Wave 0 |
| DS-03 | /dashboard returns 200 and renders app layout (sidebar visible on desktop) | Smoke | `playwright test tests/layout.spec.ts` | ❌ Wave 0 |
| DS-03 | Bottom nav visible on mobile viewport, hidden on desktop | Smoke | `playwright test tests/layout.spec.ts` | ❌ Wave 0 |

### Wave 0 Gaps

- [ ] Install Playwright: `npm install --save-dev @playwright/test && npx playwright install chromium`
- [ ] `playwright.config.ts` — base URL http://localhost:3000, single chromium project
- [ ] `tests/design-system.spec.ts` — checks CSS variable existence in document, confirms font-family contains "Geist"
- [ ] `tests/layout.spec.ts` — checks /login has no sidebar, /dashboard has sidebar, bottom nav responsive behavior

### Sampling Rate

- **Per task commit:** `npx playwright test tests/layout.spec.ts` (< 15 seconds)
- **Per wave merge:** `npx playwright test`
- **Phase gate:** Full Playwright suite green before `/gsd-verify-work`

---

## Gotchas & Pitfalls

### Pitfall 1: middleware.ts Does Not Exist in Next.js 16

**What goes wrong:** Creating `middleware.ts` instead of `proxy.ts`. Next.js 16 will warn about the deprecated filename and may not pick it up in future releases. The codemod renames it.

**How to avoid:** Create `proxy.ts` from the start. Export function as `proxy` (not `middleware`).

**Source:** [VERIFIED: nextjs.org/docs/app/guides/upgrading/version-16]

---

### Pitfall 2: Tailwind v4 Has No tailwind.config.js

**What goes wrong:** Trying to add font configuration to `tailwind.config.ts` (doesn't exist in Tailwind v4). Or creating `tailwind.config.ts` manually — it will be ignored.

**How to avoid:** All Tailwind config goes in `globals.css` under `@theme inline`. Font family registration via `--font-sans: var(--font-geist-sans)`.

**Source:** [VERIFIED: nextjs.org docs Tailwind v4 example in font documentation]

---

### Pitfall 3: Slate Not Available as shadcn Base Color

**What goes wrong:** Running `npx shadcn@latest init` and selecting slate as base color — it's not in the list. Choosing a wrong color results in a mismatched color scheme.

**How to avoid:** Initialize with zinc (closest neutral to slate), then manually edit `:root` CSS variables in `globals.css` to use slate palette OKLCH values. This is a one-time manual step.

**Source:** [VERIFIED: github.com/shadcn-ui/ui/issues/10197]

---

### Pitfall 4: Active Sidebar Link Requires 'use client'

**What goes wrong:** Building `Sidebar` as a Server Component and trying to call `usePathname()`. Server Components cannot use hooks — this throws a build error.

**How to avoid:** Mark `Sidebar`, `Topbar`, and `BottomNav` as `'use client'` components since they need `usePathname()` for active state. This is acceptable for navigation components — they contain no server-fetched data.

**Source:** [ASSUMED based on Next.js App Router hook constraints]

---

### Pitfall 5: Geist Mono Must Be Named with Underscore

**What goes wrong:** Importing as `GeistMono` from `next/font/google` — the package name doesn't exist. Next.js convention for multi-word font names uses underscore.

**How to avoid:** Import as `Geist_Mono` with underscore:
```ts
import { Geist, Geist_Mono } from 'next/font/google'
```

**Source:** [VERIFIED: nextjs.org docs — "Use an underscore (_) for font names with multiple words"]

---

### Pitfall 6: Async params in Page.tsx is Required (Not Optional)

**What goes wrong:** Future dynamic pages (Phase 3+) using `params.id` synchronously. In Next.js 16 this throws — synchronous access was removed.

**How to avoid:** Establish the async pattern from the first dynamic route:
```ts
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
}
```

Phase 1 has no dynamic routes but the pattern must be documented for phase executors.

**Source:** [VERIFIED: nextjs.org/docs/app/guides/upgrading/version-16]

---

### Pitfall 7: Zod v4 API May Have Breaking Changes

**What goes wrong:** Installing zod@latest (4.3.6) but writing code that assumes Zod v3 API. If Phase 2 uses v3 patterns on v4, subtle bugs or TypeScript errors.

**How to avoid:** Phase 1 installs Zod but does not use it. Phase 2 must verify the Zod v4 API before writing validators.

**Source:** [ASSUMED — Zod v4 is a major version; confirm at Phase 2]

---

### Pitfall 8: tw-animate-css Instead of tailwindcss-animate

**What goes wrong:** Installing `tailwindcss-animate` (v3 plugin) — shadcn/ui with Tailwind v4 uses `tw-animate-css` instead. The old plugin is incompatible with v4's CSS-first model.

**How to avoid:** shadcn init installs `tw-animate-css` automatically when Tailwind v4 is detected. Do not manually install `tailwindcss-animate`.

**Source:** [VERIFIED: ui.shadcn.com/docs/tailwind-v4]

---

### Pitfall 9: proxy.ts Runtime is Node.js Only (Not Edge)

**What goes wrong:** Phase 2 adds Better Auth middleware check to `proxy.ts` and assumes edge-compatible code. In Next.js 16, `proxy.ts` runs on Node.js — there is no edge runtime option. However, this is BETTER for Sparter since Better Auth's session helpers use Node.js APIs.

**How to avoid:** Design `proxy.ts` as a Node.js file. Do not add `export const runtime = 'edge'`. Keep it lightweight (JWT decode only, no DB), but Node.js APIs are available if needed.

**Source:** [VERIFIED: nextjs.org/docs/app/guides/upgrading/version-16]

---

## Planning Recommendations (How to Split into Plans/Waves)

### Recommended Wave Structure

**Wave 0 — Test Infrastructure (prerequisite)**
- Install Playwright, create playwright.config.ts
- Create test stubs (layout.spec.ts, design-system.spec.ts)
- No app code yet

**Wave 1 — Project Bootstrap**
- Run `create-next-app` with recommended defaults
- Install all stack packages (drizzle-orm, drizzle-kit, better-auth, zod, decimal.js, @aws-sdk, server-only)
- Create `.env.example`
- Create `proxy.ts` placeholder
- Verify `npm run dev` starts without errors

**Wave 2 — Design System Foundation**
- Run `npx shadcn@latest init` (New York, zinc base)
- Manually override CSS variables for slate base + emerald primary in `globals.css`
- Add Geist + Geist_Mono via `app/fonts.ts`
- Wire fonts to Tailwind v4 `@theme inline`
- Add project-specific KPI color tokens

**Wave 3 — shadcn Components**
- `npx shadcn@latest add button input card badge select dialog separator avatar dropdown-menu sheet`
- Verify all components render correctly at a test page
- Confirm `components/ui/` directory populated

**Wave 4 — Layout Shell**
- Create `app/(auth)/layout.tsx` (minimal centered)
- Create `app/(auth)/login/page.tsx` (stub with login form placeholder)
- Create `app/(app)/layout.tsx` (sidebar + topbar + bottom nav shell)
- Create `components/layout/sidebar.tsx` (`'use client'`, static nav items D-01)
- Create `components/layout/topbar.tsx` (`'use client'`, logo + avatar D-04)
- Create `components/layout/bottom-nav.tsx` (`'use client'`, 4 items D-03)
- Create `app/(app)/dashboard/page.tsx` (stub with page title)

**Wave 5 — Directory Structure & Stubs**
- Create `lib/db/index.ts` (server-only stub)
- Create `lib/db/schema.ts` (empty)
- Create `lib/dal/.gitkeep`, `lib/services/.gitkeep`, `lib/actions/.gitkeep`, `lib/validations/.gitkeep`
- Create `drizzle.config.ts` (commented connection)
- Run Playwright test suite — all green

### Why This Order

Wave 1 before Wave 2: shadcn init must run on a project that already has Tailwind v4 (added by create-next-app). Running init first would fail or create an incomplete setup.

Wave 2 before Wave 3: shadcn components depend on the CSS variable system set up by init. Components installed before init would use wrong tokens.

Wave 4 before Wave 5: Layout needs to be navigable to test it. Directory stubs have no dependencies.

Wave 0 first: Playwright must be installed before the app is built so tests can run after Wave 4.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Zod v4 (4.3.6) is API-compatible with v3 for basic schema patterns | Stack Version Verification | Phase 2 validation code breaks — need to rewrite schemas |
| A2 | OKLCH values for emerald-600 and slate tokens are correctly approximated in the CSS variables section | CSS Variables | Wrong colors — easy fix by checking a CSS color tool |
| A3 | Active sidebar link component must be 'use client' for usePathname | Mobile Bottom Navigation | No impact — server-side active detection alternative exists but is more complex |
| A4 | drizzle-orm 0.45.2 + drizzle-kit 0.31.10 are compatible with each other | Stack Version Verification | Migration commands fail — fix by checking Drizzle changelog |
| A5 | shadcn init with zinc base color produces components that look correct after manual slate/emerald CSS override | shadcn/ui Init | Minor visual mismatch on hover states — fixable by tweaking CSS vars |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | ✓ | v25.8.1 | — |
| npm | All | ✓ | 11.11.0 | — |
| Playwright chromium | Test suite | ✗ | — | Install in Wave 0 |
| MySQL database | lib/db (Phase 2+) | ✗ | — | Not needed in Phase 1 — db stub is offline |
| Cloudflare R2 | File upload (Phase 5+) | ✗ | — | Not needed in Phase 1 |

**Note:** Node.js v25.8.1 exceeds the minimum Next.js 16 requirement of v20.9.

**Missing dependencies with no fallback for Phase 1:**
- None — Phase 1 has no external service dependencies.

---

## Sources

### Primary (HIGH confidence — VERIFIED via tool in this session)

- [nextjs.org/docs/app/getting-started/installation](https://nextjs.org/docs/app/getting-started/installation) — create-next-app command, project structure, tsconfig, Tailwind v4
- [nextjs.org/docs/app/guides/upgrading/version-16](https://nextjs.org/docs/app/guides/upgrading/version-16) — Breaking changes: proxy.ts rename, async params removal, turbopack default, React 19.2
- [nextjs.org/docs/app/api-reference/components/font](https://nextjs.org/docs/app/api-reference/components/font) — Geist/GeistMono import syntax, CSS variable method, Tailwind integration
- npm registry (2026-04-24) — All package versions verified via `npm view`

### Secondary (MEDIUM confidence — VERIFIED via multiple sources)

- [ui.shadcn.com/docs/tailwind-v4](https://ui.shadcn.com/docs/tailwind-v4) — Tailwind v4 CSS variable model, @theme inline pattern, tw-animate-css
- [github.com/shadcn-ui/ui/issues/10197](https://github.com/shadcn-ui/ui/issues/10197) — Slate base color missing from shadcn create
- [ui.shadcn.com/docs/components-json](https://ui.shadcn.com/docs/components-json) — components.json structure for New York style
- WebSearch results confirming middleware → proxy rename and edge runtime removal

### Tertiary (LOW confidence — inferred from training + patterns)

- OKLCH color values for emerald-600 and slate tokens — derived from hex values, not confirmed against shadcn's exact theme generator output
- Zod v4 API compatibility with v3 basic patterns — not verified in this session

---

## Metadata

**Confidence breakdown:**
- Stack versions: HIGH — verified against npm registry 2026-04-24
- Next.js 16 changes: HIGH — verified against official upgrade guide
- shadcn/ui init flow: MEDIUM — command verified; exact output (CSS values) partially assumed
- Geist font setup: HIGH — verified against official Next.js font docs
- Route group layout: HIGH — stable Next.js pattern
- Tailwind v4 model: MEDIUM — structure verified; exact OKLCH values for custom tokens assumed

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (Tailwind/shadcn fast-moving — re-verify if planning starts > 2 weeks from research date)
