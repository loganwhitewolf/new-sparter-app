# Phase 41: collapsible-sidebar — Research

**Researched:** 2026-06-07
**Domain:** Next.js 16 App Router layout — React Context, sidebar collapse, localStorage hydration, shadcn/radix-ui component wiring
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- D-01: Topbar (`components/layout/topbar.tsx`) eliminato su tutti i breakpoint.
- D-02: App name, ThemeToggle e user avatar/dropdown migrano nella sidebar o in `/settings`.
- D-03: Icon rail only — due larghezze: `w-60` (espanso) e `w-16` (collassato). Nessuna variante fully-hidden/overlay.
- D-04: Toggle in cima: in modalità espansa affianca il wordmark "Sparter"; in collassato occupa da solo quello slot.
- D-05: Stato collapse persistito in `localStorage` sotto la chiave `sparter-sidebar-collapsed`. Default: espanso al primo accesso.
- D-06: Icone toggle: `ChevronLeft` (expand → collapse) / `ChevronRight` (collapse → expand) da Lucide.
- D-07: Avatar + dropdown user ancorati al fondo della sidebar. Dropdown: nome/email label, link a `/settings/profile`, azione Logout.
- D-08: Collapsed: solo avatar circle. Expanded: avatar + nome + email.
- D-09: Topbar rimosso anche su mobile.
- D-10: BottomNav acquisisce "Impostazioni" come 5° entry (icona `Settings` Lucide), `APP_ROUTES.settings`, posizione rightmost.
- D-11: ThemeToggle si sposta a `/settings` page come sezione "Aspetto" in `SettingsHub`.
- D-12: Componente `ThemeToggle` (`components/theme-toggle.tsx`) riutilizzato senza modifiche.
- D-13: Collapsed state vive in un React context (`SidebarContext`) al livello app-shell.
- D-14: `useSidebarCollapsed()` hook legge/scrive `localStorage` e si sincronizza con il context.

### Claude's Discretion

- Esatta Tailwind transition class per l'animazione della larghezza (es. `transition-[width] duration-200`).
- Se wrappare il sidebar content in `SidebarProvider` in `app/(app)/layout.tsx` oppure inline nell'`<aside>`.
- Tooltip su nav item icon-only in collapsed mode (raccomandato: shadcn `Tooltip` su ogni nav item).

### Deferred Ideas (OUT OF SCOPE)

- Logo/icon asset per Sparter (sostituirebbe il testo "Sparter" in expanded e un cerchio logo in collapsed) — rinviato ad asset brand.
- Sidebar su mobile come slide-in drawer — BottomNav copre le esigenze di navigazione mobile.
- Per-route page title nell'area contenuto — fuori scope per questa fase.
</user_constraints>

---

## Summary

La fase elimina il layout a due zone (Topbar + Sidebar) sostituendolo con una sidebar a singola zona che gestisce tutto il chrome applicativo. Il cambio principale è la migrazione dei controlli utente (Avatar/Dropdown, ThemeToggle) dalla Topbar alla Sidebar e poi a `/settings`.

Tecnicamente il challenge principale è il React Context in un RSC layout: `app/(app)/layout.tsx` è un Server Component asincrono che non può ospitare state. La soluzione standard Next.js 16 è un **Client Component wrapper** (`SidebarProvider`) importato dal layout RSC come `{children}` wrapper. Il provider gestisce `useState` + `localStorage` e fornisce il context a tutti i client component nella subtree. [VERIFIED: Context7/next.js]

Il secondo challenge è **evitare l'SSR flash** per la larghezza della sidebar: il default `collapsed=false` deve corrispondere alla prima render SSR, e il valore localStorage viene letto solo dopo mount. Il pattern usato già dal `ThemeToggle` — `useState(false)` + `useEffect` / `queueMicrotask` per il mount — è la tecnica corretta senza `suppressHydrationWarning`. [VERIFIED: codebase pattern in `components/theme-toggle.tsx`]

Tooltip per i nav item icon-only è già disponibile senza installazioni: `radix-ui` ^1.4.3 esporta `Tooltip` (che contiene `TooltipProvider`, `Root`, `Trigger`, `Content`) via `import { Tooltip } from "radix-ui"`. È sufficiente scrivere un `components/ui/tooltip.tsx` shadcn-style. [VERIFIED: node_modules inspection]

**Primary recommendation:** `SidebarProvider` come Client Component wrapper in `app/(app)/layout.tsx`; `<aside>` riceve la larghezza da context tramite classe Tailwind condizionale; Tooltip wrappa ogni `Link` del nav in collapsed mode.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sidebar collapse state | Client (React Context) | — | `localStorage` + `useState` sono client-only |
| Sidebar layout width | Frontend Server (RSC layout) | Client (context-driven `<aside>` class) | L'`<aside>` è nel RSC layout ma la larghezza viene da context fornito dal client wrapper |
| User session (avatar, nome) | Client (`authClient.useSession()`) | — | Better Auth usa React hooks — client component obbligatorio |
| Logout action | Client (onClick `signOutAction`) | Server Action | `signOutAction` è una Server Action ma il trigger è client |
| Nav link active state | Client (`usePathname()`) | — | `usePathname` è hook client |
| ThemeToggle in /settings | Client (`ThemeToggle`) | — | Usa `useTheme()` + `useState` |
| BottomNav Impostazioni entry | Client (BottomNav già client) | — | Aggiunta stateless al array `navItems` |
| SettingsHub "Aspetto" section | Server (SettingsHub già RSC) | — | Il ThemeToggle è un island client component nel RSC |

---

## Standard Stack

### Core (già nel progetto — nessuna nuova installazione)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React Context API | React 19.2.5 | `SidebarContext` per collapsed state | Built-in; pattern ufficiale Next.js per context in RSC layout |
| `radix-ui` | ^1.4.3 | `Tooltip` per icon-only nav items | Già presente; esporta `@radix-ui/react-tooltip` 1.2.8 |
| `lucide-react` | ^1.14.0 | `ChevronLeft`, `ChevronRight`, `Settings` icons | Già nel progetto; usato ovunque |
| Tailwind CSS | 4.3.0 | Transizioni larghezza sidebar (`transition-[width]`) | Tailwind 4 supporta arbitrary properties natively |
| `authClient.useSession()` | better-auth ^1.6.9 | Dati sessione utente nel sidebar | Stesso pattern del Topbar corrente |

### Nuovi componenti UI da creare

| File | Tipo | Contenuto |
|------|------|-----------|
| `components/ui/tooltip.tsx` | shadcn-style wrapper | `TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent` wrappati attorno a `radix-ui` |
| `components/layout/sidebar-provider.tsx` | Client Context Provider | `SidebarContext`, `useSidebarCollapsed()`, `SidebarProvider` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Context custom | Zustand / Jotai | Overkill per un singolo boolean; nessun package extra |
| `transition-[width]` Tailwind | CSS custom property / inline style | Arbitrary property è la via più semplice in Tailwind 4 |
| `Tooltip` da radix-ui barrel | Installare `@radix-ui/react-tooltip` direttamente | Barrel già include; inutile dipendenza duplicata |

**Installazione richiesta:** Nessuna. Tutti i package sono già presenti.

---

## Package Legitimacy Audit

> Nessun nuovo package da installare in questa fase. `radix-ui` (già installato) include `@radix-ui/react-tooltip` 1.2.8 come dipendenza diretta — verificato via `node_modules/radix-ui/package.json`.

| Package | Registry | Già presente | slopcheck | Disposition |
|---------|----------|-------------|-----------|-------------|
| `radix-ui` | npm | Sì — ^1.4.3 | N/A | Approved (già installato) |
| `@radix-ui/react-tooltip` | npm | Sì — 1.2.8 (via radix-ui) | N/A | Approved (transitiva) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser Request
      │
      ▼
RSC app/(app)/layout.tsx  (async Server Component)
  │  verifySession() → userId
  │  headers() → pathname, search
  │  onboarding guard & chrome bypass
      │
      ▼
<SidebarProvider>          ← Client Component wrapper (D-13)
  useState(collapsed)
  localStorage r/w
  SidebarContext.Provider
      │
      ├─── <aside data-sidebar>   ← width driven by collapsed state from context
      │       <Sidebar />          ← 'use client', reads SidebarContext
      │            │
      │            ├─ Toggle button (ChevronLeft/Right)
      │            ├─ Nav items (Link + ClientMountIcon + Tooltip in collapsed)
      │            └─ User controls (Avatar + DropdownMenu + signOutAction)
      │
      ├─── <main>
      │       {children}
      │
      └─── <BottomNav className="md:hidden" />  ← 'use client', +Impostazioni entry
```

### Recommended Project Structure

```
components/
├── layout/
│   ├── sidebar.tsx          # REWRITE — collapsible icon rail
│   ├── sidebar-provider.tsx # NEW — SidebarContext + SidebarProvider + useSidebarCollapsed
│   ├── bottom-nav.tsx       # UPDATE — aggiunge Impostazioni entry
│   └── topbar.tsx           # DELETE
├── ui/
│   └── tooltip.tsx          # NEW — shadcn-style Tooltip wrapper
└── settings/
    └── settings-hub.tsx     # UPDATE — aggiunge sezione Aspetto con ThemeToggle
```

### Pattern 1: SidebarProvider come Client Component in RSC layout

**Cosa:** Un Client Component wrapper che ospita il `SidebarContext` e viene importato nel layout RSC.
**Quando usare:** Ogni volta che serve condividere state client-side tra componenti in un RSC layout.

```tsx
// Source: https://nextjs.org/docs/app/getting-started/server-and-client-components#context-providers
'use client'

import { createContext, useContext, useState, useEffect } from 'react'

type SidebarContextValue = {
  collapsed: boolean
  setCollapsed: (v: boolean) => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

const STORAGE_KEY = 'sparter-sidebar-collapsed'

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false) // default SSR: espanso
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Leggi localStorage dopo mount per evitare SSR mismatch
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) setCollapsed(stored === 'true')
    setMounted(true)
  }, [])

  const handleSet = (v: boolean) => {
    setCollapsed(v)
    if (mounted) localStorage.setItem(STORAGE_KEY, String(v))
  }

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed: handleSet }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebarCollapsed() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebarCollapsed must be used within SidebarProvider')
  return ctx
}
```

### Pattern 2: Wiring della larghezza `<aside>` da context

**Cosa:** Il layout RSC importa `SidebarProvider`, l'`<aside>` dentro il provider legge il context per la classe di larghezza.
**Attenzione:** L'`<aside>` deve essere all'interno di `SidebarProvider` — non nel layout RSC direttamente.

```tsx
// Source: codebase pattern — app/(app)/layout.tsx (to be refactored)
// L'aside diventa un client component separato oppure si usa il SidebarProvider
// come wrapper dell'intero shell incluso l'aside.

// Opzione raccomandata (Claude's discretion): SidebarProvider wrappa tutto il chrome
// in app/(app)/layout.tsx:
return (
  <SidebarProvider>
    <AppShell>{children}</AppShell>
  </SidebarProvider>
)

// AppShell è un client component che legge context e applica le classi:
// <aside className={cn("...", collapsed ? "w-16" : "w-60", "transition-[width] duration-200")}>
```

### Pattern 3: Tooltip su icon-only nav items

**Cosa:** `TooltipProvider` wrappa il nav; ogni `Link` in collapsed mode è wrappato in `<Tooltip>`.
**Quando usare:** Solo quando `collapsed === true`.

```tsx
// Source: @radix-ui/react-tooltip 1.2.8 — verificato in node_modules
// Import dal barrel: import { Tooltip } from "radix-ui"
// Oppure componente UI wrapper in components/ui/tooltip.tsx

// shadcn-style tooltip.tsx da creare:
'use client'
import { Tooltip as TooltipPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

function TooltipContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 rounded-md bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md',
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
```

### Pattern 4: User controls nella sidebar — authClient.useSession()

**Cosa:** `authClient.useSession()` è già usato in `Topbar` come hook React client-side. Va spostato 1:1 nel nuovo componente sidebar (o in un sotto-componente `SidebarUserControl`).
**Chiave:** `signOutAction` è già una Server Action (`lib/actions/auth.ts`) chiamata via `onClick`. Pattern identico al Topbar.

```tsx
// Source: components/layout/topbar.tsx (pattern attuale da replicare nella sidebar)
const { data: session } = authClient.useSession()
const email = session?.user?.email ?? ''
const fallback = email.charAt(0).toUpperCase() || 'U'

// onClick handler:
onClick={() => signOutAction()}
```

### Pattern 5: ThemeToggle — SSR hydration senza flash

**Cosa:** `ThemeToggle` gestisce già il problema hydration con `useState(false)` + `useEffect(queueMicrotask)`. In `Topbar` era wrappato con `dynamic({ ssr: false })` per nascondere il placeholder. In `SettingsHub` si può importare direttamente senza `dynamic()` — il componente internamente gestisce il proprio stato `mounted`.

**Importante:** `ThemeToggle` usa `useTheme()` da `next-themes`, che richiede che `ThemeProvider` sia un antenato. Nel progetto è già nel layout radice. Nessuna modifica necessaria. [VERIFIED: codebase pattern in `components/theme-toggle.tsx`]

### Anti-Patterns to Avoid

- **Context direttamente nel RSC layout:** `app/(app)/layout.tsx` è `async` — non può usare `useState`/`createContext`. Il provider deve essere un Client Component figlio.
- **`dynamic({ ssr: false })` per il `SidebarProvider`:** Non necessario — il provider non genera output visuale instabile; il default `collapsed=false` corrisponde alla render SSR.
- **Tooltip senza `TooltipProvider`:** `@radix-ui/react-tooltip` richiede `TooltipProvider` come antenato; va aggiunto una sola volta nel nav (o nel `SidebarProvider`).
- **Width tramite inline style:** Preferire classi Tailwind condizionali; più prevedibile con il PurgeCSS di Tailwind 4.
- **Rimuovere `data-sidebar` dall'`<aside>`:** L'attributo è usato da `tests/layout.spec.ts` — mantenerlo.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tooltip per icon-only nav | Custom title/popover | `radix-ui` Tooltip (già disponibile) | Gestisce focus, keyboard, ARIA automaticamente |
| DropdownMenu user controls | Custom dropdown | `DropdownMenu` da `components/ui/dropdown-menu.tsx` | Già presente, già usato in Topbar |
| Avatar utente | Img con fallback manuale | `Avatar` / `AvatarFallback` da `components/ui/avatar.tsx` | Già presente |
| Transizione CSS larghezza | keyframe animation custom | `transition-[width] duration-200` Tailwind | Tailwind 4 supporta arbitrary transition properties natively |

**Key insight:** Tutti i componenti necessari (Avatar, DropdownMenu, Separator) sono già installati nel progetto. L'unico componente da creare è `components/ui/tooltip.tsx` come thin wrapper attorno al `Tooltip` già in `radix-ui`.

---

## Common Pitfalls

### Pitfall 1: SSR/hydration flash sulla larghezza della sidebar

**What goes wrong:** Se `useSidebarCollapsed()` inizializza leggendo `localStorage` direttamente nello `useState` initializer, il server rende `collapsed=undefined/true` mentre il client idrata con `false` → layout shift o errore hydration.
**Why it happens:** `localStorage` non esiste durante SSR.
**How to avoid:** Inizializzare sempre con `false` (default SSR = espanso), poi leggere localStorage in `useEffect` dopo mount. Questo corrisponde già al pattern di `ThemeToggle` nel progetto.
**Warning signs:** Errore console `"Hydration failed because..."`, sidebar che "salta" da collassato a espanso al primo caricamento.

### Pitfall 2: TooltipProvider mancante

**What goes wrong:** Errore runtime `"Missing TooltipProvider"` quando si usa `Tooltip` senza il suo provider.
**Why it happens:** `@radix-ui/react-tooltip` usa un context interno che richiede `TooltipProvider`.
**How to avoid:** Aggiungere `<TooltipProvider>` una sola volta, ad esempio come wrapper del nav nel `Sidebar` o direttamente nel `SidebarProvider`.

### Pitfall 3: `app-layout-guard.test.ts` fallisce dopo eliminazione Topbar

**What goes wrong:** Il test `app-layout-guard.test.ts` ha `vi.mock('@/components/layout/topbar', ...)` — se il file `topbar.tsx` viene eliminato, il mock funziona ancora (vi.mock non verifica l'esistenza del file), ma il `layout.tsx` importa ancora Topbar → TypeScript error + test failure.
**Why it happens:** L'import in `app/(app)/layout.tsx` va rimosso contestualmente all'eliminazione del file.
**How to avoid:** Nel task di eliminazione Topbar: (1) elimina `topbar.tsx`, (2) rimuovi l'import da `layout.tsx`, (3) aggiorna `app-layout-guard.test.ts` per rimuovere il mock di Topbar.

### Pitfall 4: `profile.spec.ts` PROF-04 — test del dropdown nel topbar

**What goes wrong:** `tests/profile.spec.ts` ha il test `PROF-04: topbar profile dropdown navigates to /profile` che:
  - cerca `page.getByRole('button', { name: 'Menu utente' })`
  - è un test E2E che richiede staging bypass
**Why it happens:** Il pulsante "Menu utente" si sposta dalla Topbar alla Sidebar.
**How to avoid:** Aggiornare il test: il selettore `getByRole('button', { name: 'Menu utente' })` rimane valido (l'`aria-label` è lo stesso), ma il test descrittivo va rinominato da "topbar" a "sidebar". Verificare che il nuovo trigger avatar nella sidebar mantenga `aria-label="Menu utente"`.

### Pitfall 5: `layout.spec.ts` — test "bottom nav hidden on desktop"

**What goes wrong:** Il test verifica che `[data-bottom-nav]` non sia visibile su viewport 1280×800. Con la nuova sidebar collassabile, la BottomNav rimane `className="md:hidden"` — il test non cambia. Nessun problema.
**Warning signs:** Se si tocca la classe `md:hidden` per sbaglio.

### Pitfall 6: Tooltip e `ClientMountIcon` insieme

**What goes wrong:** Il sidebar usa `ClientMountIcon` (placeholder fino al mount per evitare hydration mismatch). In collapsed mode, il `TooltipTrigger` wrappa il `Link` che contiene `ClientMountIcon`. Se `TooltipProvider` è un antenato server-rendered, potrebbe non essere disponibile prima del mount.
**Why it happens:** `Tooltip` di radix-ui richiede client-side per funzionare.
**How to avoid:** `SidebarProvider` è già `'use client'` — rendere `TooltipProvider` parte di `SidebarProvider` o di `Sidebar`. Non va nel layout RSC. Il `Tooltip` stesso va reso solo quando `collapsed && mounted`.

---

## Code Examples

### Struttura `SidebarContext` (pattern minimo)

```tsx
// Source: https://nextjs.org/docs/app/getting-started/server-and-client-components#context-providers
// components/layout/sidebar-provider.tsx
'use client'

import { createContext, useContext, useState, useEffect } from 'react'

type SidebarCtx = { collapsed: boolean; setCollapsed: (v: boolean) => void }
const SidebarContext = createContext<SidebarCtx | null>(null)
const STORAGE_KEY = 'sparter-sidebar-collapsed'

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) setCollapsed(stored === 'true')
    setMounted(true)
  }, [])

  const toggle = (v: boolean) => {
    setCollapsed(v)
    if (mounted) localStorage.setItem(STORAGE_KEY, String(v))
  }

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed: toggle }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebarCollapsed(): SidebarCtx {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebarCollapsed must be inside SidebarProvider')
  return ctx
}
```

### Come viene usato nel layout RSC

```tsx
// Source: https://nextjs.org/docs/app/getting-started/server-and-client-components
// app/(app)/layout.tsx (dopo refactor)
import { SidebarProvider } from '@/components/layout/sidebar-provider'

// ... guard logic (invariato) ...

return (
  <SidebarProvider>
    <AppShell>{children}</AppShell>
  </SidebarProvider>
)
// AppShell è 'use client' e legge SidebarContext per la classe della <aside>
```

### Tailwind width transition — Tailwind 4

```tsx
// Source: tailwindcss 4.3.0 — arbitrary values supportati nativamente
// Classe condizionale nell'<aside>:
className={cn(
  'hidden border-r border-border md:flex md:shrink-0 md:flex-col transition-[width] duration-200 ease-in-out overflow-hidden',
  collapsed ? 'md:w-16' : 'md:w-60'
)}
```

### SettingsHub con sezione Aspetto

```tsx
// Source: components/settings/settings-hub.tsx (pattern attuale + nuova sezione)
// SettingsHub rimane server component; ThemeToggle viene importato come client island
import { ThemeToggle } from '@/components/theme-toggle'

// Aggiunta sezione Aspetto in coda al componente:
<div className="space-y-2">
  <h2 className="text-sm font-medium text-muted-foreground">Aspetto</h2>
  <div className="flex items-center justify-between rounded-lg border p-4">
    <div>
      <p className="text-sm font-medium">Tema</p>
      <p className="text-xs text-muted-foreground">Chiaro o scuro</p>
    </div>
    <ThemeToggle />
  </div>
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ThemeToggle` in Topbar via `dynamic({ ssr: false })` | `ThemeToggle` in SettingsHub importato direttamente | Phase 41 | Semplificazione — il componente gestisce internamente il proprio mounted state |
| Topbar separata per app name + user controls | Tutto nella Sidebar | Phase 41 | Meno zone chrome, layout più pulito su tutti i breakpoint |
| BottomNav 4 entry | BottomNav 5 entry (+Impostazioni) | Phase 41 | Settings ora raggiungibile da mobile senza topbar |

**Deprecated/outdated dopo questa fase:**
- `components/layout/topbar.tsx` — eliminato; nessun sostituto diretto (i contenuti migrano nella sidebar)
- `vi.mock('@/components/layout/topbar', ...)` in `app-layout-guard.test.ts` — da rimuovere
- Test `PROF-04: topbar profile dropdown` — da rinominare in "sidebar user controls"

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ThemeToggle` in `SettingsHub` può essere importato direttamente senza `dynamic()` perché gestisce il proprio `mounted` state | Code Examples | Possibile flash visuale (bottone disabled temporaneamente) — non un errore hydration |
| A2 | `AppShell` come client component separato è il modo migliore per tenere `<aside>` fuori dal RSC e dentro il context | Architecture | Se si opta per inline nel `SidebarProvider`, il layout RSC diventa più semplice ma meno leggibile |

---

## Open Questions

1. **Posizionamento `TooltipProvider`**
   - What we know: va messo come antenato client-side dei `Tooltip` items nel nav.
   - What's unclear: se metterlo dentro `SidebarProvider` (con tutti i client component) o dentro `Sidebar` component.
   - Recommendation: dentro `Sidebar` (più vicino all'uso) — evita che il provider sia attivo anche quando la sidebar non è visibile (mobile).

2. **`AppShell` inline vs componente separato**
   - What we know: l'`<aside>` deve leggere `SidebarContext` quindi deve essere in un client component figlio del provider.
   - What's unclear: se wrappare solo l'`<aside>` in un client component (e lasciare il resto nel RSC) o creare un `AppShell` client component per l'intera struttura flex.
   - Recommendation: `AppShell` client component separato — più pulito e permette di gestire la classe condizionale della `<aside>` in un unico posto.

---

## Environment Availability

> Nessuna dipendenza esterna da verificare. Tutti i tool sono già installati nel progetto.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `radix-ui` | Tooltip component | ✓ | ^1.4.3 | — |
| `@radix-ui/react-tooltip` | Tooltip (via barrel) | ✓ | 1.2.8 | — |
| `lucide-react` | Toggle icons, Settings icon | ✓ | ^1.14.0 | — |
| `next-themes` | ThemeToggle | ✓ | ^0.4.6 | — |
| `better-auth` | `authClient.useSession()` | ✓ | ^1.6.9 | — |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 (unit) + Playwright 1.59.1 (E2E) |
| Config file | `vitest.config.ts` / `playwright.config.ts` |
| Quick run command | `yarn vitest run tests/app-layout-guard.test.ts` |
| Full suite command | `yarn vitest run && yarn playwright test` |

### Phase Requirements → Test Map

| ID | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|-------------------|-------------|
| D-01 | Topbar eliminata (nessun `<header>` nel layout app) | unit | `yarn vitest run tests/app-layout-guard.test.ts` | ✅ (va aggiornato) |
| D-03 | Sidebar ha `md:w-60` in expanded e `md:w-16` in collapsed | E2E | `yarn playwright test tests/layout.spec.ts` | ✅ (va aggiornato) |
| D-05 | Collapse state persiste in localStorage su reload | E2E | `yarn playwright test tests/layout.spec.ts` | ❌ Wave 0 |
| D-07 | Avatar dropdown ha link Profilo + Logout | E2E | `yarn playwright test tests/profile.spec.ts` | ✅ PROF-04 (va aggiornato) |
| D-10 | BottomNav ha 5 entry, "Impostazioni" è la 5ª | E2E | `yarn playwright test tests/layout.spec.ts` | ❌ Wave 0 |
| D-11 | ThemeToggle visibile in /settings page | E2E | `yarn playwright test tests/design-system.spec.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `yarn vitest run tests/app-layout-guard.test.ts`
- **Per wave merge:** `yarn vitest run`
- **Phase gate:** Suite completa verde prima di `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/layout.spec.ts` — aggiornare test esistenti (Topbar rimossa, sidebar collapsed/expanded, BottomNav 5 entry)
- [ ] `tests/app-layout-guard.test.ts` — rimuovere `vi.mock('@/components/layout/topbar', ...)`, aggiungere `vi.mock('@/components/layout/sidebar-provider', ...)`
- [ ] `tests/profile.spec.ts` — rinominare PROF-04 da "topbar navigation" a "sidebar user controls"; selettore `'Menu utente'` rimane valido

*(Test di localStorage persistence per D-05 richiedono Playwright con `page.evaluate(() => localStorage.getItem(...))` — nuovo test in `layout.spec.ts`)*

---

## Security Domain

> `security_enforcement` non esplicitamente configurato in `.planning/config.json` — trattato come abilitato.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No — nessuna modifica al flusso auth | Better Auth invariato |
| V3 Session Management | Marginale | `signOutAction` già implementata correttamente (Server Action + redirect) |
| V4 Access Control | No — nessuna nuova route o guard | |
| V5 Input Validation | No — nessun input utente nel sidebar | |
| V6 Cryptography | No | |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `localStorage` letto da script injection | Tampering | Nessun dato sensibile in `sparter-sidebar-collapsed` (solo boolean) — rischio trascurabile |
| `signOutAction` CSRF | Spoofing | Già mitigato da Next.js Server Actions (token implicito); non cambia |

---

## Sources

### Primary (HIGH confidence)

- Context7 `/vercel/next.js` — React context in RSC layout, localStorage hydration flash prevention
- `components/layout/topbar.tsx` — pattern `authClient.useSession()`, `signOutAction`, Avatar, DropdownMenu
- `components/theme-toggle.tsx` — pattern `useState(false)` + `queueMicrotask` per SSR hydration
- `components/ui/dropdown-menu.tsx` — import da `radix-ui` barrel (pattern da replicare per tooltip.tsx)
- `node_modules/radix-ui/dist/index.d.ts` — export `Tooltip` da barrel verificato
- `node_modules/@radix-ui/react-tooltip/dist/index.d.ts` — API: `TooltipProvider`, `Root`, `Trigger`, `Content`
- `app/(app)/layout.tsx` — struttura RSC corrente, `data-sidebar` attribute, `md:w-60` attuale
- `tests/layout.spec.ts` — selettori E2E da preservare/aggiornare
- `tests/app-layout-guard.test.ts` — mock `topbar` da rimuovere
- `tests/profile.spec.ts` — PROF-04 da aggiornare

### Secondary (MEDIUM confidence)

- Tailwind 4.3.0 `transition-[width]` — arbitrary transition properties supportate nativamente in Tailwind 4; non trovato esempio esplicito nei docs ma confermato dal funzionamento del sistema di classi arbitrarie [ASSUMED per il comportamento specifico dell'animazione, ma il supporto arbitrary values è core Tailwind 4]

### Tertiary (LOW confidence)

Nessuna claim a bassa confidenza.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — tutti i package verificati in `node_modules` e `package.json`
- Architecture: HIGH — pattern React Context in RSC verificato con Context7/next.js docs ufficiali
- Pitfalls: HIGH — derivati direttamente dall'analisi del codice esistente (test, componenti, pattern)
- Tailwind transition: MEDIUM — arbitrary values core, ma non trovato esempio `transition-[width]` in docs ufficiali

**Research date:** 2026-06-07
**Valid until:** 2026-07-07 (stack stabile)
