---
gsd_state_version: 1.0
milestone: v1.12
milestone_name: First-import Onboarding
status: Awaiting next milestone
last_updated: "2026-06-02T17:21:32.295Z"
last_activity: 2026-06-02 — Milestone v1.13 completed and archived
progress:
  total_phases: 1
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-22)

**Core value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending — all running on a zero-cost personal deploy.
**Current focus:** v1.13 complete — planning next milestone

## Current Position

Phase: Milestone v1.13 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-06-02 — Milestone v1.13 completed and archived

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

v1.13 / Phase 39 decisions:

- `SubcategoryPicker` (vaul bottom sheet, variant E): single `subCategoryId` output, type chips (Entrate/Uscite/Trasferimenti), two-column master-detail, search-collapse, adopted across all 7 surfaces
- `amountSign` on patterns derived server-side from chosen subcategory's category type per ADR 0008; confidence hardcoded to 1; manual fields removed from pattern/suggestion-promotion forms
- `getMostUsedSubcategories` DAL: top ~6 per-user by categorization count, scoped by allowed category types, hidden at cold-start
- Old pickers deleted: `CategoryCombobox`, onboarding `SubcategoryCombobox`, cascading `Select` pairs
- Prototype route `app/(app)/prototype/subcategory-picker/` deleted on final plan merge

v1.11 / Phase 37 decisions:

- NATURE_COLORS: hex values for Recharts fill (green/orange/blue/purple/red/amber/gray)
- Migration 0012_flow_nature applied to prod DB; 126 subcategories seeded with nature; ignore category (cat 32) left null
- effectiveNature = COALESCE(override.nature, sub.nature) — user override wins over seed default (D-09)
- Default on CreateSubcategoryDialog: 'discretionary' — defensive default, most new subcategories are lifestyle spend
- unclassified sentinel in SubcategoryNatureSelect → null stored on override row → DAL COALESCE falls to seed default
- setSubcategoryNatureAction revalidates /expenses, /transactions, /dashboard, /settings/categories, /import (layout)

### Known Gaps

R038, R039, R041 are PARTIAL — live Vercel/Supabase/R2 deploy is operator-pending. Code, config, and runbook complete in M007. See `docs/deploy/vercel-supabase-r2.md`.
R029 — categorization revalidation partial.

### Blockers/Concerns

None.

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-06-02:

| Category | Item | Status |
|----------|------|--------|
| quick_task | 260524-pha-mostrare-durante-import-solo-pattern-con | empty dir — likely duplicate of pnk variant |
| quick_task | 260524-pnk-mostrare-durante-import-solo-pattern-con | shipped (889ae56) — audit false positive |
| quick_task | 260525-ga2-fix-applynewpatterntoexpenses-pattern-pr | shipped (4a722f2) — audit false positive |
| quick_task | 260529-ds7-onboarding-completed-flag | shipped (1a13048) — audit false positive |
| quick_task | 260529-eh0-remove-onboarding-revalidate | shipped (40af612) — audit false positive |
| quick_task | 260530-bib-description-strip-pattern | PLAN only — feature deferred to next milestone |
| quick_task | 260531-fko-riorganizza-sottocategorie-spesa-categor | shipped (f979ae1) — audit false positive |

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260524-pnk | mostrare durante import solo pattern con porzione stringa uguale non completamente uguali | 2026-05-24 | 889ae56 | [260524-pnk-mostrare-durante-import-solo-pattern-con](.planning/quick/260524-pnk-mostrare-durante-import-solo-pattern-con/) |
| 260525-ga2 | fix applyNewPatternToExpenses: pattern promoted from suggestions not applied to all uncategorized expenses | 2026-05-25 | 4a722f2 | [260525-ga2-fix-applynewpatterntoexpenses-pattern-pr](.planning/quick/260525-ga2-fix-applynewpatterntoexpenses-pattern-pr/) |
| 260529-ds7 | Fix onboarding redirect loop when user deletes import file — onboarding_completed_at flag | 2026-05-29 | 1a13048 | [260529-ds7-onboarding-completed-flag](.planning/quick/260529-ds7-onboarding-completed-flag/) |
| 260529-eh0 | Remove revalidatePath(onboarding) from categorize action — page reload loop during step 4 | 2026-05-29 | 40af612 | [260529-eh0-remove-onboarding-revalidate](.planning/quick/260529-eh0-remove-onboarding-revalidate/) |
| 260529-f3k | Fix post-registration reload loop — signUpAction redirects directly to /onboarding instead of /dashboard | 2026-05-29 | ceb3651 | inline |
| 260529-u9p | Step 2 remove +/- signs from amount cards; Step 4 green done card + stop RSC re-render on categorize | 2026-05-29 | HEAD | inline |
| 260531-fko | Riorganizza sottocategorie Spesa (categoryId 8) — aggiunte 4 nuove, rinominata spesa-bio, migrazione expense + pattern, disattivate prodotti-freschi e prodotti-non-alimentari | 2026-05-31 | f979ae1 | [260531-fko-riorganizza-sottocategorie-spesa-categor](.planning/quick/260531-fko-riorganizza-sottocategorie-spesa-categor/) |
| 260531-trc | Riorganizza categorie Trasferimenti (cat 32: ignore → transfer type) e Rimborsi (cat 26: rename + subcategory delta) — migration, seed-extras, dashboard DAL filter refactor | 2026-05-31 | HEAD | [260531-trc-riorganizza-trasferimenti-rimborsi-categorie](.planning/quick/260531-trc-riorganizza-trasferimenti-rimborsi-categorie/) |

## Session Continuity

Last session: 2026-06-02
Stopped at: Phase 39 complete — milestone v1.13 done
Resume file: None

**Next:** Start the next milestone when ready.

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
