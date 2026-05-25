# Phase 32: account-linking - Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 11
**Analogs found:** 11 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/(app)/settings/page.tsx` | page (hub) | request-response | `app/(app)/settings/page.tsx` (current) + `app/(app)/settings/categories/page.tsx` | exact (replace redirect with hub layout) |
| `app/(app)/settings/profile/page.tsx` | page (server component) | request-response | `app/(app)/profile/page.tsx` | exact (copy + extend) |
| `app/(app)/profile/page.tsx` | page (redirect shim) | request-response | `app/(app)/settings/page.tsx` (current redirect pattern) | exact |
| `lib/routes.ts` | config | — | `lib/routes.ts` | exact (add two constants) |
| `components/layout/topbar.tsx` | component (client) | event-driven | `components/layout/topbar.tsx` | exact (one href change) |
| `components/layout/sidebar.tsx` | component (client) | event-driven | `components/layout/sidebar.tsx` | exact (active-link logic) |
| `components/settings/settings-hub.tsx` | component (server/client) | request-response | `app/(app)/settings/categories/page.tsx` (page-level card grid) | role-match |
| `components/profile/connected-accounts-card.tsx` | component (client) | event-driven + CRUD | `components/auth/social-provider-buttons.tsx` + `components/categories/category-mutation-dialogs.tsx` | role-match (composite) |
| `tests/profile.spec.ts` | test (E2E) | — | `tests/profile.spec.ts` | exact (update route refs) |
| `tests/account-linking.spec.ts` | test (E2E) | — | `tests/auth.spec.ts` | role-match (fixme stubs pattern) |
| `tests/connected-accounts-card.test.tsx` | test (unit) | — | `tests/oauth-ui.test.tsx` | exact |

---

## Pattern Assignments

### `app/(app)/settings/page.tsx` (hub page, request-response)

**Analog:** Current `app/(app)/settings/page.tsx` (replace redirect) + `app/(app)/settings/categories/page.tsx` (heading/layout)

**Current file to replace** (`app/(app)/settings/page.tsx` lines 1–6):
```typescript
import { redirect } from 'next/navigation'
import { APP_ROUTES } from '@/lib/routes'

export default function SettingsPage() {
  redirect(APP_ROUTES.categorySettings)
}
```

**Replace with this structure** (modeled on `app/(app)/settings/categories/page.tsx` lines 1–39):
```typescript
// Server component — no 'use client', no verifySession needed (no user data displayed)
import Link from 'next/link'
import { APP_ROUTES } from '@/lib/routes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata = { title: 'Impostazioni — Sparter' }

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Impostazioni</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestisci il tuo profilo e le impostazioni dell'applicazione.
        </p>
      </div>
      {/* Two hub cards — exact layout is agent's discretion (D-01) */}
      {/* Link to APP_ROUTES.profileSettings and APP_ROUTES.categorySettings */}
    </div>
  )
}
```

**Key constraint:** This is a pure server component. No `verifySession()` needed; the app layout already enforces auth. Route protection is handled by `proxy.ts`.

---

### `app/(app)/settings/profile/page.tsx` (server component page, request-response)

**Analog:** `app/(app)/profile/page.tsx` (copy verbatim, then add `configuredProviders` prop and `ConnectedAccountsCard`)

**Full source to copy** (`app/(app)/profile/page.tsx` lines 1–75):
```typescript
import { verifySession } from '@/lib/dal/auth'
import { getUserProfile } from '@/lib/dal/users'
import { ProfileForm } from '@/components/profile/profile-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata = {
  title: 'Profilo — Sparter',
}

export default async function ProfilePage() {
  const session = await verifySession()
  const profile = await getUserProfile(session.userId)

  const email = profile.email ?? session.email
  const subscriptionLabel =
    profile.subscriptionPlan === 'pro'
      ? 'Pro'
      : profile.subscriptionPlan === 'basic'
        ? 'Basic'
        : 'Free'
  const roleLabel = profile.role === 'admin' ? 'Amministratore' : 'Utente'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profilo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestisci le tue informazioni personali.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* ... email, plan, role read-only fields ... */}
        </CardContent>
      </Card>

      <ProfileForm profile={profile} />
    </div>
  )
}
```

**Additions for Phase 32:**

1. Add `searchParams` prop (Next.js 16 async pattern from RESEARCH.md Pattern 5):
```typescript
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ linked?: string; error?: string }>
}) {
  const params = await searchParams
  // ...existing session + profile fetch...

  const configuredProviders: Provider[] = [
    ...(process.env.GOOGLE_CLIENT_ID ? (['google'] as Provider[]) : []),
    ...(process.env.GITHUB_CLIENT_ID ? (['github'] as Provider[]) : []),
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* ...existing Account card + ProfileForm... */}
      <ConnectedAccountsCard
        configuredProviders={configuredProviders}
        initialLinked={params.linked}
        initialError={params.error}
      />
    </div>
  )
}
```

2. Import `Provider` type from `@/components/auth/social-provider-buttons` (line 9 of that file).
3. Import `ConnectedAccountsCard` from `@/components/profile/connected-accounts-card`.

---

### `app/(app)/profile/page.tsx` (compatibility redirect shim, request-response)

**Analog:** Current `app/(app)/settings/page.tsx` (exact same redirect pattern, lines 1–6)

**Copy this exact pattern:**
```typescript
import { redirect } from 'next/navigation'
import { APP_ROUTES } from '@/lib/routes'

export default function ProfilePage() {
  redirect(APP_ROUTES.profileSettings)
}
```

No metadata, no session check, no DB. Pure redirect shim.

---

### `lib/routes.ts` (config, additions only)

**Analog:** `lib/routes.ts` itself — add two constants to the existing `APP_ROUTES` object (lines 3–12)

**Current object** (lines 3–12):
```typescript
export const APP_ROUTES = {
  dashboard: '/dashboard',
  dashboardOverview: '/dashboard/overview',
  dashboardCategories: '/dashboard/categories',
  expenses: '/expenses',
  import: '/import',
  transactions: '/transactions',
  settings: '/settings',
  categorySettings: '/settings/categories',
} as const
```

**Add two entries:**
```typescript
  profile: '/profile',                  // compatibility alias (D-04)
  profileSettings: '/settings/profile', // canonical (D-03)
```

Place them after `categorySettings` to preserve existing key order.

---

### `components/layout/topbar.tsx` (client component, event-driven)

**Analog:** `components/layout/topbar.tsx` itself — one line change

**Current href** (line 63):
```typescript
<Link href="/profile">
```

**Replace with:**
```typescript
<Link href={APP_ROUTES.profileSettings}>
```

**Add import** (extend the existing `authClient`/`signOutAction` imports at the top):
```typescript
import { APP_ROUTES } from '@/lib/routes'
```

No other changes. All other topbar structure, avatar, dropdown, logout patterns are unchanged.

---

### `components/layout/sidebar.tsx` (client component, event-driven)

**Analog:** `components/layout/sidebar.tsx` itself — the sidebar already links to `APP_ROUTES.settings` (line 19) and the active-link logic (lines 28–29) uses `pathname.startsWith`.

**No change required** for the sidebar itself. The `settings` link already points to `/settings` and the `startsWith('/settings/')` active-link logic will correctly highlight the settings item when on `/settings/profile` or `/settings/categories`.

**If a sub-nav is added inside the settings hub** (agent's discretion), copy the nav item pattern from `topbar.tsx` `DropdownMenuItem asChild` or the existing `sidebar.tsx` `topNavItems` map (lines 11–16):
```typescript
const topNavItems = [
  { href: APP_ROUTES.dashboard, label: 'Dashboard', icon: LayoutDashboard },
  // ...
]
// Rendered as:
{topNavItems.map(({ href, label, icon: Icon }) => {
  const isActive = pathname === href || pathname.startsWith(`${href}/`)
  return (
    <li key={href}>
      <Link href={href} className={cn('...', isActive ? 'active classes' : 'inactive classes')}>
        <ClientMountIcon icon={Icon} className="h-4 w-4 shrink-0" />
        <span className="flex-1">{label}</span>
      </Link>
    </li>
  )
})}
```

---

### `components/profile/connected-accounts-card.tsx` (client component, event-driven + CRUD)

**Primary analog:** `components/auth/social-provider-buttons.tsx` — Provider type, pending state pattern, `authClient` usage, Google/GitHub icons

**Secondary analog:** `components/categories/category-mutation-dialogs.tsx` — Dialog + confirmation + toast + error display patterns

**Composite pattern to follow:**

**Imports block** (model on `social-provider-buttons.tsx` lines 1–8 + `category-mutation-dialogs.tsx` lines 1–36):
```typescript
'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { authClient } from '@/lib/auth-client'
import { APP_ROUTES } from '@/lib/routes'
import type { Provider } from '@/components/auth/social-provider-buttons'
```

**Pending state pattern** (from `social-provider-buttons.tsx` lines 112–128):
```typescript
const [pending, setPending] = useState<Provider | null>(null)

async function handleLink(provider: Provider) {
  setPending(provider)
  try {
    await authClient.linkSocial({
      provider,
      callbackURL: APP_ROUTES.profileSettings + '?linked=' + provider,
      errorCallbackURL: APP_ROUTES.profileSettings + '?error=OAuthCallbackError',
    })
  } finally {
    setPending(null) // Safety reset; won't run on successful browser redirect
  }
}
```

**Account list refresh pattern** (from RESEARCH.md Pattern 2):
```typescript
type LinkedAccount = { providerId: string; id: string }
const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([])
const [loadingAccounts, setLoadingAccounts] = useState(true)

async function refreshAccounts() {
  setLoadingAccounts(true)
  const { data } = await authClient.listAccounts()
  setLinkedAccounts(data ?? [])
  setLoadingAccounts(false)
}

useEffect(() => { refreshAccounts() }, [])
```

**Search params result handling** (initial props from server, from RESEARCH.md Pattern 5):
```typescript
interface ConnectedAccountsCardProps {
  configuredProviders: Provider[]
  initialLinked?: string
  initialError?: string
}
```

On mount, if `initialLinked` is set, call `setTimeout(refreshAccounts, 400)` to handle the timing gap (RESEARCH.md Pitfall 2). Show success toast for `initialLinked`. Show error alert for `initialError`, mapping via a `LINK_ERROR_MESSAGES` record (see below).

**Error message map** (extend from `social-provider-buttons.tsx` lines 29–41 — same map structure):
```typescript
const LINK_ERROR_MESSAGES: Record<string, string> = {
  "email_doesn't_match":
    "L'email del provider non corrisponde all'email del tuo account Sparter.",
  account_already_linked_to_different_user:
    'Questo account social è già collegato a un altro utente.',
  unable_to_link_account: "Impossibile collegare l'account. Riprova.",
  OAuthCallbackError: 'Collegamento non riuscito. Riprova.',
}
const LINK_ERROR_FALLBACK = 'Collegamento non riuscito. Riprova.'
```

Note: always `decodeURIComponent(initialError ?? '')` before map lookup to handle `email_doesn%27t_match` (RESEARCH.md Pitfall 1).

**Unlink confirmation dialog** (from `category-mutation-dialogs.tsx` `DeleteCategoryDialog` pattern lines 259–290):
```typescript
// Wrap unlink button in Dialog — same open/setOpen pattern as useDialogAction
const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false)
const [unlinkTarget, setUnlinkTarget] = useState<Provider | null>(null)

async function handleUnlink(providerId: Provider) {
  const { error } = await authClient.unlinkAccount({ providerId })
  if (error) {
    toast.error('Errore durante la disconnessione.')
    return
  }
  await refreshAccounts()
  toast.success('Provider scollegato.')
  setUnlinkDialogOpen(false)
}
```

Dialog structure copies `DeleteCategoryDialog` (lines 265–289): `DialogTrigger asChild` on the Scollega button, `DialogContent` with `DialogHeader`, `DialogDescription`, `DialogFooter` with cancel (`variant="ghost"`) and confirm (`variant="destructive"`).

**Last-method guard** (from RESEARCH.md Pattern 4):
```typescript
function canUnlink(providerId: Provider): boolean {
  const credentialAccount = linkedAccounts.find(a => a.providerId === 'credential')
  const otherSocialAccounts = linkedAccounts.filter(
    a => a.providerId !== 'credential' && a.providerId !== providerId
  )
  return !!(credentialAccount || otherSocialAccounts.length > 0)
}
```

Render the Scollega button as `disabled={!canUnlink(provider)}` with `title="Non puoi scollegare l'unico metodo di accesso."` when disabled.

**Empty state** (matches `social-provider-buttons.tsx` line 114 pattern — return null / empty):
```typescript
if (configuredProviders.length === 0) {
  return (
    <Card>
      <CardHeader><CardTitle>Account collegati</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Nessun provider social configurato.</p>
      </CardContent>
    </Card>
  )
}
```

**Error/success alert display** (from `profile-form.tsx` lines 39–43):
```typescript
{errorMessage && (
  <Alert variant="destructive" aria-live="polite">
    <AlertDescription>{errorMessage}</AlertDescription>
  </Alert>
)}
```

---

### `tests/profile.spec.ts` (E2E test, update)

**Analog:** `tests/profile.spec.ts` itself — targeted updates only

**Three changes required** (from RESEARCH.md Pitfall 3):

1. **`openProfile` helper** (line 7): Change `page.goto('/profile')` to `page.goto(APP_ROUTES.profileSettings ?? '/settings/profile')` — or use the literal string since tests don't import from lib. Use `'/settings/profile'` directly.

2. **PROF-01 status test** (line 15): Change `page.goto('/profile')` to `page.goto('/settings/profile')`.

3. **PROF-04 topbar navigation assertion** (lines 87–101): Update the `toHaveURL` assertion from `/\/profile/` to `/\/settings\/profile/`. The topbar link now points to `/settings/profile` (D-05).

Keep all other assertions unchanged — the `/\/profile/` regex would match `/settings/profile` but PROF-04 specifically asserts the topbar link destination, so it must become `/settings/profile`.

PROF-06 (line 116): also update `page.goto('/profile')` to `page.goto('/settings/profile')` for the unauthenticated redirect test.

---

### `tests/account-linking.spec.ts` (NEW E2E test)

**Analog:** `tests/auth.spec.ts` — exact fixme stub structure (lines 70–101)

**Import pattern** (from all existing spec files):
```typescript
import { expect, test, type Page } from '@playwright/test'
```

**Staging helper pattern** (from `tests/profile.spec.ts` lines 3–8):
```typescript
async function openProfileSettings(page: Page) {
  await page.setExtraHTTPHeaders({
    'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key',
  })
  await page.goto('/settings/profile')
}
```

**Fixme stub structure** (from `tests/auth.spec.ts` lines 70–101):
```typescript
test.describe('Account Linking - LINK-01: Google link', () => {
  test('LINK-01 /settings/profile shows Account collegati card', async ({ page }) => {
    await openProfileSettings(page)
    await expect(page.getByRole('heading', { name: 'Account collegati', level: 3 })).toBeVisible()
  })

  test('LINK-01 live Google link flow', async () => {
    test.fixme()
    // LINK-01: Clicking "Collega" for Google on /settings/profile → OAuth round-trip →
    // redirects to /settings/profile?linked=google → card shows Collegato state.
    // Manual only — requires real Google OAuth credentials.
  })
})
```

Navigation tests (settings hub, `/profile` redirect) must use the real page goto + expect, not fixme. Only live OAuth operations use `test.fixme()`.

---

### `tests/connected-accounts-card.test.tsx` (NEW unit test)

**Analog:** `tests/oauth-ui.test.tsx` — exact pattern (lines 1–74)

**Mock setup pattern** (from `tests/oauth-ui.test.tsx` lines 1–14):
```typescript
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    listAccounts: vi.fn(),
    linkSocial: vi.fn(),
    unlinkAccount: vi.fn(),
  },
}))

const { ConnectedAccountsCard } = await import(
  '@/components/profile/connected-accounts-card'
)
```

**Test structure** (model on `oauth-ui.test.tsx` `describe` blocks):
```typescript
describe('ConnectedAccountsCard (LINK-04)', () => {
  it('renders empty state when configuredProviders is empty', () => {
    // renderToStaticMarkup with configuredProviders=[]
    // expect 'Nessun provider social configurato.'
  })

  it('renders Google row when providers=[google]', () => { ... })

  it('renders both rows when providers=[google, github]', () => { ... })

  // For linked state tests: need to control listAccounts mock return value
  // Use vi.mocked(authClient.listAccounts).mockResolvedValue({ data: [...] })
})

describe('ConnectedAccountsCard unlink guard (LINK-03)', () => {
  it('disables unlink when only one account remains (credential only)', () => { ... })
  it('enables unlink when two or more accounts exist', () => { ... })
})
```

Note: `renderToStaticMarkup` works for sync rendering. For async hooks (`useEffect`), use `@testing-library/react` `render` + `waitFor` pattern if testing linked state. The `oauth-ui.test.tsx` uses `renderToStaticMarkup` for the initial render test — follow the same approach for initial/static rendering tests; switch to `@testing-library/react` only if testing post-hook state.

---

## Shared Patterns

### `verifySession()` — Server component session guard
**Source:** `lib/dal/auth.ts` lines 10–48
**Apply to:** `app/(app)/settings/profile/page.tsx`
```typescript
import { verifySession } from '@/lib/dal/auth'
// In async server component:
const session = await verifySession()
// Returns { userId, email, subscriptionPlan, role } or redirects to /login
```
Note: `verifySession` is `import 'server-only'` — never import in client components.

### Toast success/error — Client mutation feedback
**Source:** `components/profile/profile-form.tsx` lines 3 + 20–24
```typescript
import { toast } from 'sonner'
// Success:
toast.success('Profilo aggiornato.')
// Error (shown inline via state, or via toast for async operations):
toast.error('Errore durante la disconnessione.')
```
**Apply to:** `components/profile/connected-accounts-card.tsx`

### `useActionState` + `submittedRef` — Form action state tracking
**Source:** `components/profile/profile-form.tsx` lines 3 + 17–25
```typescript
const [state, action, isPending] = useActionState(updateProfileAction, { error: null })
const submittedRef = useRef(false)
useEffect(() => {
  if (submittedRef.current && state.error === null) {
    toast.success('Profilo aggiornato.')
    submittedRef.current = false
  }
}, [state])
```
**Apply to:** Any form-based mutations. The `connected-accounts-card` uses `authClient` methods (not server actions), so it uses local `useState` + async handler instead. This pattern is reference only.

### Confirmation dialog structure
**Source:** `components/categories/category-mutation-dialogs.tsx` lines 259–290 (`DeleteCategoryDialog`)
```typescript
<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>
    <Button type="button" variant="ghost" ...>...</Button>
  </DialogTrigger>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>...</DialogTitle>
      <DialogDescription>...</DialogDescription>
    </DialogHeader>
    <form action={submit} className="flex flex-col gap-4">
      <ActionError error={state.error} />
      <DialogFooter>
        <DialogClose asChild><Button type="button" variant="ghost">Annulla</Button></DialogClose>
        <Button type="submit" variant="destructive" disabled={isPending}>Conferma</Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```
**Apply to:** Unlink confirmation dialog in `connected-accounts-card.tsx`. Replace `form action={submit}` with `onClick={handleUnlink}` since the unlink is a direct `authClient` call, not a server action.

### Inline error display
**Source:** `components/categories/category-mutation-dialogs.tsx` lines 79–87 (`ActionError`)
```typescript
function ActionError({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  )
}
```
**Apply to:** Error display in `connected-accounts-card.tsx` for link error (`initialError` prop).

### Route constants usage
**Source:** `lib/routes.ts` lines 3–12 + `components/layout/sidebar.tsx` lines 9, 11–19
```typescript
import { APP_ROUTES } from '@/lib/routes'
// Always reference route constants; never hardcode strings in components
href={APP_ROUTES.profileSettings}
```
**Apply to:** All new files that reference `/settings/profile` or `/profile`.

### Provider type reuse
**Source:** `components/auth/social-provider-buttons.tsx` line 9
```typescript
export type Provider = 'google' | 'github'
```
**Apply to:** `connected-accounts-card.tsx` — import `type { Provider }` from this file. Do not redeclare.

### Staging bypass pattern for Playwright tests
**Source:** `tests/profile.spec.ts` lines 3–8
```typescript
async function openProfileSettings(page: Page) {
  await page.setExtraHTTPHeaders({
    'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key',
  })
  await page.goto('/settings/profile')
}
```
**Apply to:** `tests/account-linking.spec.ts` — copy this helper, change URL to `/settings/profile`.

---

## No Analog Found

All files have close analogs in the codebase. No files require falling back to RESEARCH.md patterns only.

---

## Metadata

**Analog search scope:** `app/(app)/`, `components/`, `lib/`, `tests/`
**Files scanned:** 14 source files read directly
**Pattern extraction date:** 2026-05-22
