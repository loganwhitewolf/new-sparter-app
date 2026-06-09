---
phase: 41-collapsible-sidebar
reviewed: 2026-06-07T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - components/layout/sidebar-provider.tsx
  - components/ui/tooltip.tsx
  - components/layout/app-shell.tsx
  - components/layout/sidebar.tsx
  - app/(app)/layout.tsx
  - components/layout/bottom-nav.tsx
  - components/settings/settings-hub.tsx
  - tests/app-layout-guard.test.ts
  - tests/profile.spec.ts
  - tests/layout.spec.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 41: Code Review Report

**Reviewed:** 2026-06-07T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

This phase implements the collapsible sidebar feature: a `SidebarProvider` context with `localStorage` persistence, an `AppShell` flex layout, a refactored `Sidebar` with icon-only collapsed mode and tooltips, a `BottomNav` for mobile, an onboarding gate in the RSC layout, and accompanying unit/E2E tests.

The implementation is structurally sound and the hydration guard approach (SSR default = expanded, restore on mount) is correct. Four warnings and three info items were found. No blockers.

The most significant findings are: a dead `mounted` state variable in `sidebar-provider.tsx` that adds noise but no function; a mismatched STAGING_KEY fallback in `layout.spec.ts` that produces misleading test failures when the env var is absent; a missing test case for the `onboardingCompletedAt !== null, txCount === 0` branch; and both `<nav>` elements lacking `aria-label`, which causes screen readers to announce two unlabelled navigation landmarks.

---

## Warnings

### WR-01: Dead `mounted` state in `SidebarProvider` — never read, never exported

**File:** `components/layout/sidebar-provider.tsx:20`
**Issue:** `const [mounted, setMounted] = useState(false)` is declared and set to `true` inside the `useEffect`, but it is never read anywhere in the component and is not part of the context value. The state update on mount causes a superfluous re-render of every context consumer immediately after the first paint. `Sidebar` solves the same problem with its own local `mounted` state (line 52); the provider's copy is entirely orphaned.
**Fix:** Remove lines 20 and 28 (`const [mounted, setMounted] = useState(false)` and `setMounted(true)`).

```tsx
// Before
const [collapsed, setCollapsed] = useState(false)
const [mounted, setMounted] = useState(false)          // dead

useEffect(() => {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored !== null) {
    setCollapsed(stored === 'true')
  }
  setMounted(true)                                     // triggers useless re-render
}, [])

// After
const [collapsed, setCollapsed] = useState(false)

useEffect(() => {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored !== null) {
    setCollapsed(stored === 'true')
  }
}, [])
```

---

### WR-02: `layout.spec.ts` hardcoded STAGING_KEY fallback makes tests silently pass with wrong assertions

**File:** `tests/layout.spec.ts:21,29,36,45,54,64,74,95`
**Issue:** Every authenticated test in `layout.spec.ts` sends `process.env.STAGING_KEY ?? 'test-staging-key'` as the `x-staging-key` header. The proxy only bypasses auth when `process.env.STAGING_KEY` is defined **and** matches the header value. When `STAGING_KEY` is not set in the test environment, the bypass never fires; the server redirects to `/login`; and the assertions fail with errors like "sidebar not visible" or "200 expected, got 302" — not with a clear "env var missing" message. The fallback `'test-staging-key'` gives the false impression that tests can run without the env var.

`profile.spec.ts` correctly uses `requireStagingKey()` which throws a descriptive error immediately. `layout.spec.ts` should do the same.

**Fix:** Replace all `process.env.STAGING_KEY ?? 'test-staging-key'` occurrences with a shared helper or an explicit guard at the top of the file:

```ts
// At the top of layout.spec.ts
import { expect, test } from '@playwright/test'

function requireStagingKey(): string {
  const key = process.env.STAGING_KEY
  if (!key) throw new Error('STAGING_KEY env var is required for E2E tests')
  return key
}

// Usage:
await page.setExtraHTTPHeaders({ 'x-staging-key': requireStagingKey() })
```

---

### WR-03: Missing test case for `txCount === 0 && completedAt !== null` branch in layout guard

**File:** `tests/app-layout-guard.test.ts:84`
**Issue:** The `app/(app)/layout.tsx` onboarding gate has two guards in sequence: first `txCount === 0`, then inside that branch, `completedAt === null`. The only redirect happens when **both** are true. The test suite never covers the path where `txCount === 0` but `completedAt` is not null — the user has completed onboarding but later deleted all transactions. In that scenario the layout must **not** redirect, but there is no test asserting this. The `beforeEach` always seeds `getOnboardingCompletedAt.mockResolvedValue(null)`, so the completed-at truthy path is never exercised.
**Fix:** Add a test case:

```ts
it('does NOT redirect when txCount === 0 but onboardingCompletedAt is set', async () => {
  mockPathname('/dashboard')
  mocks.getTransactionCount.mockResolvedValue(0)
  mocks.getOnboardingCompletedAt.mockResolvedValue(new Date('2025-01-01'))

  await expect(AppLayout({ children: null })).resolves.not.toThrow()
  expect(mocks.redirect).not.toHaveBeenCalled()
})
```

---

### WR-04: Both `<nav>` landmarks lack `aria-label` — screen readers announce two unnamed navigation regions

**File:** `components/layout/sidebar.tsx:62` / `components/layout/bottom-nav.tsx:26`
**Issue:** WCAG 2.4.1 (Bypass Blocks) and the ARIA authoring practices require that when a page contains multiple `<nav>` landmarks, each must have a distinguishing accessible name. The sidebar `<nav>` (line 62) and the bottom `<nav>` (line 26) both lack `aria-label`. Screen readers will announce them as "navigation" and "navigation" with no way to distinguish them.
**Fix:**

```tsx
// sidebar.tsx line 62
<nav aria-label="Navigazione principale" ...>

// bottom-nav.tsx line 26
<nav aria-label="Navigazione mobile" data-bottom-nav ...>
```

---

## Info

### IN-01: `TooltipProvider` wraps the nav list unconditionally, including when expanded

**File:** `components/layout/sidebar.tsx:92-127`
**Issue:** `<TooltipProvider>` wraps the entire `<ul>` regardless of the `collapsed` state. When the sidebar is expanded, no `<Tooltip>` components are mounted (they are gated at line 115 with `collapsed && mounted`), so the provider has zero active consumers but is still rendered. This is harmless but adds a React tree node and an extra context value on every render when expanded. Moving the provider inside the conditional tooltip branch, or rendering it only when `collapsed` is true, would be cleaner.
**Fix:** Wrap only when collapsed, or accept as-is — this is a style/tree-depth concern, not a bug.

---

### IN-02: `BottomNav` settings link uses `APP_ROUTES.settings` (`/settings`) while the hub page is a dead-end for back navigation

**File:** `components/layout/bottom-nav.tsx:15`
**Issue:** The mobile bottom nav links to `/settings` which renders `SettingsHub`. The active-state logic (`pathname === '/settings' || pathname.startsWith('/settings/')`) means the "Impostazioni" item stays active on `/settings/profile` and `/settings/categories`. This is consistent behaviour; however it is worth noting for future subroutes. No code change is required.

---

### IN-03: `app-layout-guard.test.ts` does not cover the `/import` exemption path

**File:** `tests/app-layout-guard.test.ts:84`
**Issue:** The exemption list in `app/(app)/layout.tsx` includes `/import` (added alongside `/onboarding` and `/settings`), but no test verifies that a user with 0 transactions on `/import` is not redirected. The `/onboarding` and `/settings` exemptions are covered (lines 101-118). A missing `/import` test means a future regression that removes or misspells the import exemption would not be caught.
**Fix:** Add:

```ts
it('does NOT redirect when txCount === 0 and pathname starts with /import (exemption)', async () => {
  mockPathname('/import')
  mocks.getTransactionCount.mockResolvedValue(0)

  await expect(AppLayout({ children: null })).resolves.not.toThrow()
  expect(mocks.redirect).not.toHaveBeenCalled()
})
```

---

_Reviewed: 2026-06-07T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
