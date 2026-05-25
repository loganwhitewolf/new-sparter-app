---
gsd_state_version: 1.0
milestone: v1.8
milestone_name: FlowNature & Segmented Chart
current_phase: — (milestone complete)
status: completed
last_updated: "2026-05-25T16:38:06.814Z"
last_activity: "2026-05-25 - Completed quick task 260525-ga2: fix applyNewPatternToExpenses"
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 9
  completed_plans: 9
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-22)

**Core value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending — all running on a zero-cost personal deploy.
**Current focus:** Phase --phase — 36

## Current Position

Phase: --phase (36) — EXECUTING
Plan: Not started
Status: Milestone complete
Last activity: 2026-05-25 - Completed quick task 260525-ga2: fix applyNewPatternToExpenses

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

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260524-pnk | mostrare durante import solo pattern con porzione stringa uguale non completamente uguali | 2026-05-24 | 889ae56 | [260524-pnk-mostrare-durante-import-solo-pattern-con](.planning/quick/260524-pnk-mostrare-durante-import-solo-pattern-con/) |
| 260525-ga2 | fix applyNewPatternToExpenses: pattern promoted from suggestions not applied to all uncategorized expenses | 2026-05-25 | 4a722f2 | [260525-ga2-fix-applynewpatterntoexpenses-pattern-pr](.planning/quick/260525-ga2-fix-applynewpatterntoexpenses-pattern-pr/) |

## Session Continuity

Last session: 2026-05-25T16:38:06.809Z
Stopped at: Phase 37 context gathered
Resume file: .planning/phases/37-flow-nature-chart/37-CONTEXT.md

**Current Phase:** — (milestone complete)

**Next:** `/gsd-new-milestone` to plan v1.11
