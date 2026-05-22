---
phase: 32
plan: "01"
subsystem: routing/ia
tags: [auth, oauth, settings, routing, ia]
dependency_graph:
  requires:
    - "32-00: Wave 0 test scaffolding (account-linking.spec.ts, profile.spec.ts)"
  provides:
    - "APP_ROUTES.profile + APP_ROUTES.profileSettings in lib/routes.ts"
    - "/settings hub page (no redirect)"
    - "/profile compatibility redirect shim to /settings/profile"
    - "Topbar Profilo link targeting APP_ROUTES.profileSettings"
    - "components/settings/settings-hub.tsx (reusable hub component)"
  affects:
    - "Plan 02: /settings/profile page body (needs profileSettings route + redirect shim working)"
    - "tests/profile.spec.ts: PROF-04 now asserts /settings/profile"
tech_stack:
  added: []
  patterns:
    - "Server component hub page (no verifySession, proxy.ts handles auth)"
    - "Next.js redirect() shim for backward compatibility"
    - "Route constant usage in client component (topbar) via APP_ROUTES"
key_files:
  created:
    - components/settings/settings-hub.tsx
  modified:
    - lib/routes.ts
    - app/(app)/settings/page.tsx
    - app/(app)/profile/page.tsx
    - components/layout/topbar.tsx
decisions:
  - "SettingsHub extracted as separate server component from settings/page.tsx for reusability (D-01)"
  - "APP_ROUTES.profile = '/profile' as compat alias, APP_ROUTES.profileSettings = '/settings/profile' as canonical (D-03, D-04)"
  - "/profile redirect shim contains no old imports — Plan 02 re-imports profile body in /settings/profile"
metrics:
  duration: "~3 minutes"
  completed_date: "2026-05-22"
  tasks_completed: 3
  tasks_total: 3
  files_created: 1
  files_modified: 4
---

# Phase 32 Plan 01: Settings IA Routing Scaffold Summary

**One-liner:** Settings IA reshaped — /settings becomes a hub with Card links, /profile issues a 307 redirect shim to /settings/profile, topbar Profilo link retargeted to APP_ROUTES.profileSettings using new route constants.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add APP_ROUTES.profile + profileSettings to lib/routes.ts | 41db699 | lib/routes.ts |
| 2 | Convert /settings to hub + extract settings-hub.tsx | 0d5af35 | app/(app)/settings/page.tsx, components/settings/settings-hub.tsx |
| 3 | Replace /profile with redirect shim + retarget topbar | a888cf2 | app/(app)/profile/page.tsx, components/layout/topbar.tsx |

## What Was Built

**Task 1 — lib/routes.ts:** Added two new route constants after `categorySettings`. `profile: '/profile'` serves as backward compat alias (D-04). `profileSettings: '/settings/profile'` is the canonical profile route (D-03). All existing keys preserved; helper functions unchanged.

**Task 2 — /settings hub + SettingsHub component:** `app/(app)/settings/page.tsx` replaced the former `redirect(APP_ROUTES.categorySettings)` shim with a proper hub layout containing an H1 "Impostazioni" heading and the `<SettingsHub />` component. `components/settings/settings-hub.tsx` is a new pure server component (no `'use client'`, no `verifySession()`) that renders a 2-column Card grid with links to `/settings/profile` (Profilo) and `/settings/categories` (Categorie) using `APP_ROUTES` constants.

**Task 3 — /profile redirect shim + topbar retargeting:** `app/(app)/profile/page.tsx` stripped down to 6 lines — imports `redirect` and `APP_ROUTES`, calls `redirect(APP_ROUTES.profileSettings)`. All old imports (verifySession, getUserProfile, ProfileForm, Card primitives) removed; Plan 02 re-imports them in `/settings/profile`. `components/layout/topbar.tsx` received an `APP_ROUTES` import and the Profilo `<Link>` href changed from hardcoded `"/profile"` to `{APP_ROUTES.profileSettings}`.

## Verification

- `yarn tsc --noEmit` — 6 pre-existing errors only (Wave 0 RED for ConnectedAccountsCard + production-smoke/set-r2-cors pre-existing). Zero new errors in the 5 touched files.
- `yarn playwright test --list tests/account-linking.spec.ts tests/profile.spec.ts` — 23 tests listed, 0 parse errors.
- `yarn playwright test --list tests/account-linking.spec.ts --grep "LINK-04 /settings hub renders"` — exactly 1 test listed (Wave 0 sanity check).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The `/profile` redirect target (`/settings/profile`) will 404 until Plan 02 ships the new profile page — this is expected transient state within the same phase execution (documented in plan task 3 sequencing note).

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. Trust boundaries unchanged:
- `SettingsHub` is a static server component with no user data — T-32-03 `accept` disposition confirmed.
- `/profile` redirect uses Next.js server-side `redirect()` — T-32-02 `mitigate` confirmed.
- Topbar link change only (href attribute) — T-32-04 `mitigate` confirmed; proxy.ts still gates destination.

## Self-Check: PASSED

- `lib/routes.ts` — profile and profileSettings entries: FOUND
- `components/settings/settings-hub.tsx` — FOUND
- `app/(app)/settings/page.tsx` — SettingsHub + Impostazioni: FOUND, no redirect: CONFIRMED
- `app/(app)/profile/page.tsx` — redirect shim, 6 lines: FOUND
- `components/layout/topbar.tsx` — APP_ROUTES import + profileSettings href: FOUND
- Commits 41db699, 0d5af35, a888cf2 — all in git log: CONFIRMED
