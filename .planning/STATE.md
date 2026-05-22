---
gsd_state_version: 1.0
milestone: v1.9
milestone_name: Social Auth
current_phase: 32 (account-linking) — all plans complete
status: milestone_complete
stopped_at: v1.9 milestone archived
last_updated: "2026-05-22T00:00:00.000Z"
last_activity: 2026-05-22 — v1.9 Social Auth milestone archived
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 9
  completed_plans: 9
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-22)

**Core value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending — all running on a zero-cost personal deploy.
**Current focus:** Planning next milestone.

## Current Position

Milestone v1.9 archived. All phases complete (30, 31, 32). Ready for next milestone.

Progress: [██████████] 100%

## Accumulated Context

### Decisions

All milestones M001–M008 complete. Full decision log in PROJECT.md.

v1.9 phase structure:

- Phase 30: OAuth provider config + env wiring + guardrail removal (foundation, no UI)
- Phase 31: Social login/register buttons on auth pages (OAUTH-01..05)
- Phase 32: Account linking UI in settings (LINK-01..04)
- Guard OAuth provider activation on CLIENT_ID only; clientSecret uses non-null assertion for loud failure on misconfiguration
- OAuth vars remain commented out in .env.example to prevent accidental secret commit
- Callback URL pattern documented as {BETTER_AUTH_URL}/api/auth/callback/{provider-id}

- Phase 32 Plan 00: Wave 0 test scaffolding complete — unit + E2E stubs + profile.spec.ts retargeted
- PROF-06 retains goto('/profile') to verify Plan 01 compat redirect shim
- Unit test in RED state (correct) until Plan 02 ships ConnectedAccountsCard

- Phase 32 Plan 01: Settings IA routing scaffold complete — /settings hub, /profile redirect shim, topbar retargeted
- APP_ROUTES.profile ('/profile') and APP_ROUTES.profileSettings ('/settings/profile') added to lib/routes.ts
- SettingsHub extracted as server component in components/settings/settings-hub.tsx
- /profile is now a 6-line redirect shim; Plan 02 creates /settings/profile page body

- Phase 32 Plan 02: ConnectedAccountsCard + /settings/profile page complete — LINK-01..04 all satisfied
- React 19 renderToStaticMarkup apostrophe encoding: Wave 0 test assertion updated to &#x27; form
- canUnlink guard checks credential OR other social (more robust than total count)
- configuredProviders derived from process.env booleans — no NEXT_PUBLIC_* vars introduced

### Known Gaps

R038, R039, R041 are PARTIAL — live Vercel/Supabase/R2 deploy is operator-pending. Code, config, and runbook complete in M007. See `docs/deploy/vercel-supabase-r2.md`.
R029 — categorization revalidation partial.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-05-22T07:38:00Z
Stopped at: Phase 32 Plan 02 complete
Resume file: None

**Current Phase:** 32 (account-linking) — all 3 plans complete (00, 01, 02) — Phase 32 DONE
