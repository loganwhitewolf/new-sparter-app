---
gsd_state_version: 1.0
milestone: v1.14
milestone_name: milestone
status: "Phase 41 shipped — PR #16"
stopped_at: Phase 40 complete — all 5 plans executed
last_updated: "2026-06-07T14:55:28.319Z"
last_activity: 2026-06-07
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-22)

**Core value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending — all running on a zero-cost personal deploy.
**Current focus:** Phase 41 — collapsible-sidebar

## Current Position

Phase: 41
Plan: Not started
Status: Phase 41 shipped — PR #16
Last activity: 2026-06-07

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

v1.14 / Phase 40 Plan 01 decisions (2026-06-04):

- `TableConfig` / `FilterField` / `SortColumn` types live in `lib/utils/table-config.ts` (types only, no runtime)
- URL param parsers are total functions (never throw); invalid tokens silently dropped (T-40-01 mitigated)
- `buildTransactionOrderBy` returns `SQL[]` array — call site uses spread `.orderBy(...buildTransactionOrderBy(filters))`
- `id` tiebreaker is always the LAST element in every DAL `orderBy` array (D-06)
- `TransactionFilters` extended with `months?/amountMin?/amountMax?` now; WHERE clauses deferred to Wave 4

v1.14 / Phase 40 Plan 04 decisions (2026-06-04):

- `transactionsTableConfig` / `expensesTableConfig` / `filesTableConfig` live in `*.table.ts` colocated with page
- `expensesTableConfig` has NO month-multi field (D-11 confirmed: aggregate entity, no temporal filter)
- expense.status 4 maps to uncategorized bucket via `inArray(['1','4'])` (O-01 resolved conservatively)
- `ExpenseFilters.period` no longer includes `'this-month'` as valid value (D-05 fully applied)
- Platform filter for expenses implemented via `importedFromFileId→file→importFormatVersion→platform` left join
- DataTableToolbar `status` field type supports custom `field.options` override for Files 3-bucket status
- Files statusBucket `'pending'` maps to all transient states: `['uploaded','analyzing','analyzed','importing','pending_upload']`

v1.14 / Phase 40 Plan 05 decisions (2026-06-04):

- Wave 5 URL migration: `from`/`to` dropped from `parseTransactionFilters`; `importedFrom`/`importedTo`/`referenceFrom`/`referenceTo` dropped from `parseImportFilters` (total parsing — legacy links degrade gracefully to default view)
- `EmptyState` variant computed server-side in each page via `hasActiveXxxFilters(params)` helper; no new client state needed
- `app/proto/table-toolbar/` deleted on Wave 5 final plan (mirrors Phase 38/39 convention)
- Mobile sort trigger: `aria-label="Ordina"` added to `DataTableToolbar`

v1.14 / Phase 40 Plan 02 decisions (2026-06-04):

- `useTableUrl(route)` hook: replaceWith/updateParam/updateParams, scroll:false, used by DataTableToolbar
- `nextSort(current, key)` pure helper: inactive→DESC, active DESC→ASC, active ASC→off (D-13)
- `useToolbarSort(route)` exported from DataTableToolbar for desktop HeaderSortButton wiring
- Tests use renderToStaticMarkup + vi.mock factory (project pattern, not @testing-library/react)
- month-multi and amount-range render as placeholders in Wave 2; Wave 3 swaps in real pickers

v1.11 / Phase 37 decisions:

- NATURE_COLORS: hex values for Recharts fill (green/orange/blue/purple/red/amber/gray)
- Migration 0012_flow_nature applied to prod DB; 126 subcategories seeded with nature; ignore category (cat 32) left null
- effectiveNature = COALESCE(override.nature, sub.nature) — user override wins over seed default (D-09)
- Default on CreateSubcategoryDialog: 'discretionary' — defensive default, most new subcategories are lifestyle spend
- unclassified sentinel in SubcategoryNatureSelect → null stored on override row → DAL COALESCE falls to seed default
- setSubcategoryNatureAction revalidates /expenses, /transactions, /dashboard, /settings/categories, /import (layout)
- [Phase ?]: month chips one-per-YYYY-MM, monthLabel labels, amount-range has dual URL keys

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
| 260529-lyd | Public /proto preview area for stakeholder demos — dashboard overview prototype (5 variants) out of (app), Vercel-Preview-gated | 2026-05-29 | c0048e0 | [260529-lyd-proto-public-preview](.planning/quick/260529-lyd-proto-public-preview/) |
| 260531-fko | Riorganizza sottocategorie Spesa (categoryId 8) — aggiunte 4 nuove, rinominata spesa-bio, migrazione expense + pattern, disattivate prodotti-freschi e prodotti-non-alimentari | 2026-05-31 | f979ae1 | [260531-fko-riorganizza-sottocategorie-spesa-categor](.planning/quick/260531-fko-riorganizza-sottocategorie-spesa-categor/) |
| 260531-trc | Riorganizza categorie Trasferimenti (cat 32: ignore → transfer type) e Rimborsi (cat 26: rename + subcategory delta) — migration, seed-extras, dashboard DAL filter refactor | 2026-05-31 | HEAD | [260531-trc-riorganizza-trasferimenti-rimborsi-categorie](.planning/quick/260531-trc-riorganizza-trasferimenti-rimborsi-categorie/) |

## Session Continuity

Last session: 2026-06-04T20:00:00.000Z
Stopped at: Phase 40 complete — all 5 plans executed
Resume file: None

**Next:** Start the next milestone with /gsd-new-milestone.

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 40 P03 | 222 | 2 tasks | 5 files |
| Phase 40 P04 | 739 | 3 tasks | 13 files |
| Phase 40 P05 | 1050 | 2 tasks | 15 files |
