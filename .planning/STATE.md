---
gsd_state_version: 1.0
milestone: v1.9
milestone_name: Social Auth
status: in_progress
stopped_at: Phase 32 Plan 01 complete
last_updated: "2026-05-22T07:30:00.000Z"
last_activity: 2026-05-22 — Phase 32 Plan 01 complete (settings IA routing scaffold)
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 9
  completed_plans: 8
  percent: 89
---

# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending — all running on a zero-cost personal deploy.
**Current focus:** v1.9 Social Auth — Google and GitHub OAuth with account linking.

## Current Position

Phase: 32 (in progress)
Plan: 32-01 (complete ✓)
Status: Plan 01 complete — settings IA routing scaffold — ready for Plan 02
Last activity: 2026-05-22 — Phase 32 Plan 01 complete

Progress: [████████░░] 89%

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

### Known Gaps

R038, R039, R041 are PARTIAL — live Vercel/Supabase/R2 deploy is operator-pending. Code, config, and runbook complete in M007. See `docs/deploy/vercel-supabase-r2.md`.
R029 — categorization revalidation partial.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-05-22T07:30:00Z
Stopped at: Phase 32 Plan 01 complete
Resume file: None

**Current Phase:** 32 (account-linking) — plans 00 and 01 done, plan 02 pending

**Planned Phase:** 32 (account-linking) — 3 plans — 2026-05-22T06:17:13.727Z
