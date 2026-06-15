# Retrospective

Living retrospective — one section per milestone, newest first.

---

## Milestone: v2.0 — Nature/Direction Model Realignment

**Shipped:** 2026-06-14
**Phases:** 5 (46–50) | **Plans:** 22 | **Tasks:** 37

### What Was Built
Replaced the dual-axis `category.type` + `nature` classification with a single nature→direction model: FK-backed `direction`(4) + `nature`(8) lookup tables (46), a 23-category/87-subcategory reseed (47), migration 0018 + data recategorization with verification assertions (48), the dashboard/surfaces rebuilt on the direction model with algebraic-sum aggregation (49), and explicit 1:1 transaction pairing (order↔refund) with shared netting fragments and a picker/badge/popover UI (50).

### What Worked
- **Design LOCKED before execution** (ADR 0012, CONTEXT.md, nature-remapping-WORKING.md) — zero discovery churn across 5 phases on a schema-breaking change.
- **RED test scaffolds first** (Nyquist Dimension 8) — Phase 50 Wave 0 authored the behavioral contract before any production code, so the service/DAL/netting had verification targets from task one.
- **Shared SQL fragments** (`isNotSecondary()`/`effectiveAmount()`) authored once and reused at all 8 aggregation sites — no per-query re-derivation.

### What Was Inefficient
- **Service-layer integrity gaps slipped to code review**, not planning: self-pairing, non-atomic ownership-then-write, and missing opposite-sign enforcement (CR-01/02/03) — all foreseeable for a join table with no `userId` column.
- **Manual-only UI surface** (the pairing flow has no headless render harness) surfaced 5 real defects only at the operator checkpoint (overflow, stale date window, no-reload refresh, zero-amount popover).
- **Stale tracking artifacts** (7 quick-tasks, 5 traceability rows) accumulated and had to be reconciled at milestone close.

### Patterns Established
- Shared SQL fragment helpers for cross-site aggregation consistency.
- `key`-based remount to resync prop-derived local state (table + dialog) instead of effect-driven setState.
- For integrity tables with no owner column, the service is the *sole* enforcement point — guard self-reference, opposite-sign, and atomicity explicitly.

### Key Lessons
- A join table without a `userId`/owner column shifts 100% of ownership + integrity enforcement onto the service layer — enumerate those guards (self-ref, sign, atomicity) during planning, not in review.
- Budget an operator-verification checkpoint for any UI surface that has no automated render harness.

### Cost Observations
- Model mix: Opus orchestrator + Sonnet executors/verifier/reviewer/fixer.
- Notable: the Phase 50 execute→checkpoint→review→fix loop ran end-to-end in one session with all gates (post-merge tests, schema-drift, code review, verification) green.

---

## Milestone: v1.16 — Dashboard Overview Redesign

**Shipped:** 2026-06-09
**Phases:** 4 (42, 43, 44, 45) | **Plans:** 13 | **Commits:** ~27 | **Timeline:** 3 days (2026-06-07 → 2026-06-09)

### What Was Built

- **Phase 42**: `income_extraordinary` FlowNature member (9-member enum); additive seed STEP for re-bucketing 22 subcategories; `getYearsWithData`, `getOverview`, `getMonthOverMonthCategoryChanges`, `getOverviewChart` DAL; CONTEXT.md glossary update (Reference Period, MonthOverMonthChange)
- **Phase 43**: `OverviewHeader` (year-selector pill), `ReadingKpiCard`/`KpiRow` with sentiment reading lines, `OverviewChart` (grouped Entrate/Uscite bars, always-on compact labels), `resolveYear`, `OverviewEmptyState`; superseded charts/filters/proto deleted; `yarn build` green
- **Phase 44**: `overview-chart-utils.ts` pure filter-reduction helpers; `OverviewNudge` client island with localStorage `lastSeenCount` dismiss; `OverviewChartFilters` chips (income type + expense nature) with ⓘ popovers + per-chip tooltips; filter-aware chart
- **Phase 45**: `fetchMovers` server action (trust boundary + input validation); `formatMoverLine`/`splitMovers` pure humanizers with Vitest; controlled `OverviewChart` (D-03 bar highlight); `OverviewMoversSection`/`OverviewMoversPanel`; `deriveDefaultMonthIndex` + prefetch on page; all MOVE-01..05 verified browser-side

### What Worked

- **Prototype → grill-me → LOCKED decisions**: All major design choices (variant A, header H1, 4 KPIs, localStorage nudge, per-month movers via click) were locked before Phase 42 planning — zero design churn across 13 plans
- **Server action for movers**: `fetchMovers` as server action (rather than DAL in RSC) was the right call — enabled client-controlled month selection after SSR initial load without full page re-render
- **3-day timeline for a full redesign**: 4-phase pipeline with clear DAL → shell → interactions → movers sequence executed cleanly; wave structure within each phase prevented inter-plan conflicts
- **income_extraordinary on existing enum**: Reusing `nature` on the `in` side avoided a schema change while still enabling the income type filter chip — decision confirmed correct at DAL + UI layers

### What Was Inefficient

- Phase 43 worktree had a Rule 3 violation (missing phase-42 files) that required a fix commit mid-execution — indicates the worktree base branch setup needs better pre-flight validation
- UAT checkbox updates (phases 43/44) were not completed at execution time; required manual catch-up at milestone close — should update checkboxes as part of the plan completion flow

### Patterns Established

- `resolveYear(searchParam, availableYears)` — server-side year resolution helper; clamps to valid data range, defaults to current year
- `fetchMovers` server action + `useTransition` client pattern — enables post-SSR month selection without page reload
- `splitMovers(movers)` pure function — separates increases/decreases and hides empty sections; reusable for any "movers" drill-down
- Filter-aware chart reduction via pure `reduceChartData(points, filters)` — no derived state in component; pure function testable in isolation

### Key Lessons

1. **Worktree Rule 3 pre-flight**: Before executing in a new worktree, check that phase N-1 files are present — `git log --oneline HEAD..main` or a fast `ls` of the key dal/component files from prior phases
2. **Update UAT checkboxes at plan completion**: Add a `grep '- \[ \]' *-UAT.md` check to the plan completion template to catch pending scenario markers before marking a plan as done
3. **Lock decisions in archive, not in REQUIREMENTS.md**: The LOCKED design decisions in `app/proto/overview/NOTES.md` were perfectly stable throughout; this is the right place for design decisions (prototype artifacts), not REQUIREMENTS.md checkboxes

---

## Milestone: v1.15 — Collapsible Sidebar

**Shipped:** 2026-06-07
**Phases:** 1 (41) | **Plans:** 3 | **Commits:** ~16

### What Was Built

- `SidebarProvider` + `useSidebarCollapsed`: SSR-safe `useState(false)`, `useEffect` restores from localStorage after mount; `STORAGE_KEY = 'sparter-sidebar-collapsed'`
- `AppShell` client component driving `<aside>` width from SidebarContext; RSC layout simplified to `<SidebarProvider><AppShell>`
- Sidebar rewritten: chevron toggle with alternating aria-labels, icon-only+tooltip collapsed nav (mounted guard for SSR safety), Avatar dropdown at bottom with Profilo + Logout
- BottomNav 5th Impostazioni entry; SettingsHub Aspetto section with ThemeToggle; topbar.tsx deleted
- Nyquist audit: 2 new unit test files, 836 tests green; 2 pre-existing onboarding test failures fixed (R-OB-07, R-OB-09)

### What Worked

- **ADR-first approach**: ADR 0011 locked all design decisions (widths, localStorage key, no topbar) before planning — zero design churn during execution
- **Research phase identified Pitfall 6** (tooltip SSR mismatch) upfront — mounted guard implemented correctly on first try
- **3-plan wave structure** was clean: foundation (provider+tooltip) → visible core (shell+sidebar) → cleanup (mobile+settings+tests); no dependencies reversed

### What Was Inefficient

- Two post-PR fixes needed (React 19 tooltip hydration, missing Impostazioni link) — these should have been caught by E2E before merge
- Two onboarding test failures (`R-OB-07`, `R-OB-09`) were pre-existing but only fixed during this milestone's cleanup; they should have been caught at the time they regressed

### Patterns Established

- RSC layout + `SidebarProvider` + `AppShell` as the three-layer chrome pattern: server-fetches-in-layout, client-island-for-state, render-in-shell
- `mounted && collapsed` guard for any client-only rendering (tooltips, hover states) to avoid SSR hydration mismatch
- ADR as a PLAN.md context reference — executor reads `@docs/adr/NNNN-*.md` directly, no re-negotiation

### Key Lessons

1. **E2E smoke before merge**: The two post-PR fixes (hydration + Impostazioni) were visual/interactive regressions that unit tests won't catch — run `yarn playwright test tests/layout.spec.ts` before merging layout-touching PRs
2. **Fix regressions in the phase that introduces them**: Pre-existing failures left in `in_progress` state add noise to future verification; address them in the phase that touches those files
3. **localStorage booleans are safe without extra guards**: `stored === 'true'` coerces any tampered value to a safe boolean — no validation overhead needed for non-sensitive UI preferences

---

## Milestone: v1.13 — Unified Categorization Picker

**Shipped:** 2026-06-02
**Phases:** 1 (39) | **Plans:** 6 | **Commits:** ~50

### What Was Built

- `SubcategoryPicker` (vaul bottom sheet, variant E): type chips, two-column master-detail, search-collapse, fixed height, single `subCategoryId` output
- `getMostUsedSubcategories` DAL — top ~6 per user by categorization count, cold-start safe
- Adopted in 4 commit-on-tap surfaces (expense, transaction, bulk, onboarding) and 2 fill-field forms (create/edit expense, create transaction)
- Pattern and suggestion-promotion forms reworked: `amountSign` derived server-side from category type (ADR 0008), `confidence` hardcoded 1
- `CategoryCombobox`, onboarding `SubcategoryCombobox`, cascading `Select` pairs deleted
- Prototype route deleted; `yarn build` + `yarn check:language` green

### What Worked

- **Prototype → plan structure**: grill-me + prototype session locked all 10 design decisions before a single line of production code was written — zero design churn during execution
- **Variant E master-detail**: Fixed-height sheet with stable layout (no resize on filter change) proved easy to implement with vaul; the "only inner lists scroll" constraint made the height budget mechanical
- **ADR 0008 as a contract for server-side derivation**: Pattern forms had no ambiguity about who derives `amountSign` — no client-side logic needed, no UI knob
- **Code review caught real regressions**: CR-01 (amount color inversion), CR-02/WR-03 (stale picker body), CR-03 (client-supplied schema bypass), WR-02 (single-char pattern rejection) — all real issues addressed before UAT

### What Was Inefficient

- Wave numbering in PLAN.md was non-sequential (39-05 in Wave 3, 39-04 in Wave 4) — plan index confused the wave ordering; next time keep wave N = plan numeric order
- Nyquist validation ran as a separate phase after UAT rather than inline — gap surfaced PROC-01 (audit trail) which was partially addressed; no execution impact but added a cycle

### Patterns Established

- `SubcategoryPicker` as the single picker contract across all surfaces — output always `subCategoryId`; caller owns the commit
- `buildCategoryOptions` / `filterCategoryOptions` in `lib/categorization/subcategory-options.ts` — shared pure functions for list construction
- `amountSign` derived server-side from `category.type` in DAL/action — avoids client trust for business-critical field

### Key Lessons

1. **Lock the design before writing the PLAN.md** — prototype + grill session upfront eliminated all mid-execution design questions
2. **Wave numbering should match plan numeric order** — 39-03, 39-04, 39-05 in wave order 3→4→5, not swapped; reduces cognitive load during execution tracking
3. **Pattern form amountSign**: Deriving a business-critical field server-side (not trusting client) is the right default — ADR 0008 pattern should apply broadly to any field that can be inferred from a trusted FK

---

## Milestone: v1.12 — First-import Onboarding

**Shipped:** 2026-05-28
**Phases:** 1 (38) | **Plans:** 3 | **Commits:** ~38

### What Was Built

- DAL: `getTransactionCount`, `getTopUncategorizedExpenses`, `getFileCoveredMonths`, `formatMonthRange`
- RSC layout gate in `app/(app)/layout.tsx` — Drizzle cannot run in Edge runtime; D-11 constraint documented
- 5-step onboarding flow: upload (R2 presigned PUT reuse), overview (real transaction data), education (giroconto tip), categorization wizard (FlowNature badges), outro
- Full-screen hero design (dark bg steps 1–3+5, light bg step 4); progress dots + step label

### What Worked

- **RSC layout gate approach**: Clear rationale (Drizzle != Edge) prevented future confusion about why proxy.ts can't do the redirect; D-11 decision well-documented
- **Step 4 reuse of existing actions**: `onboardingCategorizeExpense` thin wrapper over existing categorize action — no duplicated business logic
- **Prototype deletion on merge**: Keeping prototype deletion in the final plan step meant cleanup was automatic; no zombie routes

### What Was Inefficient

- Step 4 onboarding originally used a shadcn `Combobox` — replaced by `SubcategoryPicker` in v1.13 (expected; was already planned as part of the picker migration)

### Patterns Established

- RSC layout guard pattern for transaction-count gates — `async` layout, `getTransactionCount()` inline, `redirect()` conditional
- `formatMonthRange` utility for on-the-fly month range labels from transaction dates

### Key Lessons

1. **Edge runtime constraint**: Any guard that needs DB access goes in RSC layout, not proxy.ts — document this constraint once (D-11) and reference it everywhere
2. **Prototype routes need deletion plans**: Including cleanup in the final plan wave means it can't be forgotten

---

## Milestone: v1.11 — FlowNature & Segmented Chart

**Shipped:** 2026-05-26
**Phases:** 1 (37) | **Plans:** 5 | **Commits:** ~45

### What Was Built

- `flowNatureEnum` migration + `nature` column on `sub_category` and `user_subcategory_override`
- 126 system subcategories seeded with default natures
- `getMonthlyTrendByNature` DAL; `effectiveNature = COALESCE(override, seed default)`
- Stacked nature `EntrateUsciteChart` with URL-persisted legend toggles (`?hidden=` param)
- `SubcategoryNatureSelect` + `setSubcategoryNatureAction` — nature required on creation in settings

### What Worked

- **COALESCE approach**: User override wins over seed default cleanly — no custom merge logic in the application layer
- **URL-persisted toggles**: `?hidden=` param approach was re-usable from existing URL state patterns in the codebase; no new state management needed
- **Wave 0 TDD**: Nature labels utility (`nature-labels.ts`) scaffolded first made subsequent chart implementation mechanical

### What Was Inefficient

- `ignore` category (cat 32) left with null nature — sentinel value needed for chart exclusion; the Transfer/Giroconto categorization rework in a later quick-task clarified the intent post-fact

### Key Lessons

1. **Seed defaults + user override pattern (COALESCE)**: A clean and forward-compatible pattern for any preference-like column — default is authoritative until user overrides
2. **URL params for persistent toggles**: Zero client-side state; survives navigation and sharing; compatible with RSC — use as default for any toggle that belongs in the URL

---

## Milestone: v1.10 — Pattern Suggestions

**Shipped:** 2026-05-25
**Phases:** 4 (33, 34, 35, 36) | **Plans:** 9 | **Quick Tasks:** 2 | **Timeline:** 4 days

### What Was Built

- Pure `detectPatternSuggestions` utility with ADR-compliant token-prefix algorithm
- `ImportAnalysisResult` extended with `patternSuggestions`; detection in isolated try/catch
- `promoteSuggestionAction` server action with auth gate, input validation, anti-tampering
- `SuggestionSection` / `SuggestionCard` / `SuggestionPromoteForm` UI components
- `ImportPreview` + `AnalyzePage` parallel fetch wiring — 577 Vitest tests GREEN
- `getUncategorizedTransactionsByFileId` DAL with `innerJoin` ownership enforcement
- `/import/[fileId]/suggestions` server component page + "Rivedi suggerimenti" dropdown entry
- Quick-task fixes: partial-match-only rule (SUG-07), `applyNewPatternToExpenses` numeric-token strip

### What Worked

- TDD wave structure (RED→GREEN) on phase 35 made the implementation fast and verified from day one — no regressions during wiring
- Isolated try/catch decision for detection early in plan phase removed ambiguity about error handling throughout execution
- `innerJoin` for ownership enforcement in DAL caught the ownership requirement at the data layer — no need for a separate guard elsewhere
- ADR 0002 as a single source of truth made the algorithm contract clear across all 4 phases without re-debating design

### What Was Inefficient

- REQUIREMENTS.md checkboxes for phases 33/34 were not updated during execution — discovered only at milestone close; adds noise to readiness checks
- ROADMAP.md progress table rows for phases 33/34 were not updated after execution — minor tracking lag
- GSD toolkit local install removed from `.claude/` mid-milestone (migration to global install); staged as a large deletion commit, slightly noisy in git log

### Patterns Established

- `normalizeDescription` utility extracted for consistent uppercase+trim — previously inlined in multiple places
- `createPattern` reactivation pattern for soft-deleted rows on unique constraint — reusable DAL pattern for any entity with soft-delete
- Parallel `Promise.all` fetch in server components with owned-resource guard (`notFound()`) — mirrors `AnalyzePage`, now consistent across import sub-pages

### Key Lessons

- Keep phase completion tracking (REQUIREMENTS.md checkboxes, ROADMAP.md table) in sync during execution — stale tracking creates noise at close and can mask genuine gaps
- Quick tasks during a milestone's tail are fine but should note which requirement they affect; 260525-ga2 was effectively REQ-adjacent and should have been linked

---

## Milestone: v1.9 — Social Auth

**Shipped:** 2026-05-22
**Phases:** 3 (30, 31, 32) | **Plans:** 9 | **Commits:** 45

### What Was Built

- Registration guardrail deleted — `lib/auth/registration.ts` and all consumers removed
- Env-conditional Google + GitHub OAuth providers wired into Better Auth via conditional spread
- `SocialProviderButtons` shared client component with inline SVG GitHub icon and Italian error mapping
- Login/Register pages converted to async server components that read `process.env` for active providers
- Settings IA reorganized: `/settings` hub, `/settings/profile` canonical page, `/profile` compat redirect shim
- `ConnectedAccountsCard` — link/unlink flows, `canUnlink` guard, confirmation Dialog, error code decoding

### What Worked

- **Wave 0 TDD scaffolding** (plans 31-01, 32-00): Writing unit specs before implementation made the contracts explicit and caught the lucide-react icon bug early. Both plans ran in ~15 minutes — fast and high-value.
- **Conditional spread pattern for OAuth providers**: Clean, no-code-change activation model. Clear activation signal (CLIENT_ID presence). Documented as an established pattern.
- **Server component + 'use client' split for provider visibility**: No `NEXT_PUBLIC_*` vars needed. The server reads `process.env`, passes booleans down. Simple and correct.
- **`canUnlink` guard based on credential OR other social**: More robust than counting all accounts. Correctly handles the edge case where a user has only one provider linked.
- **Phase 32 code review** (32-REVIEW.md): Caught 3 real issues (CR-01/02, WR-01..03, IN-01..03) including the `errorCallbackURL` bare-URL fix (D-12). Review → fix → commit was clean.

### What Was Inefficient

- **lucide-react icon miss**: RESEARCH.md claimed lucide-react exported a Github icon — it doesn't at v1.14.0. Required an unplanned inline SVG fallback. Better to grep `node_modules` before claiming a dependency provides something.
- **React 19 `renderToStaticMarkup` apostrophe encoding**: Wave 0 test assertion used `'` but React 19 encodes as `&#x27;`. Required a small fix after Wave 0 ran. Worth noting in future Wave 0 test setups using `renderToStaticMarkup`.
- **Traceability table staleness**: REQUIREMENTS.md traceability table was not updated in real-time during Phase 32 execution (LINK-01..04 remained "Pending"). Milestone close required a manual correction. Should update traceability at plan completion, not just at the end.

### Patterns Established

- `...(process.env.PROVIDER_CLIENT_ID ? { provider: { clientId, clientSecret! } } : {})` — conditional spread for optional Better Auth social providers
- Server component page wrapper reading `process.env`, passing config booleans to 'use client' forms — no `NEXT_PUBLIC_*` needed
- `test.fixme()` stubs for live OAuth flows that require real credentials — marks the gap without blocking CI
- `renderToStaticMarkup` unit tests: assert with HTML-entity-aware strings (`&#x27;` not `'`)
- `listAccounts` on mount + 400ms delay refresh after `linkSocial` return — accounts for Better Auth's eventual-consistency pattern

### Key Lessons

1. **Grep `node_modules` before claiming a package exports a symbol** — RESEARCH.md was wrong about lucide-react; a quick grep would have caught it.
2. **Update traceability table at plan completion, not milestone close** — stale "Pending" rows in the traceability table add cleanup cost at archival.
3. **`errorCallbackURL` must be bare (no query string)** — Better Auth appends its own error code; passing `?error=OAuthCallbackError` inline breaks the callback. Caught by code review (D-12).
4. **Wave 0 is worth the 15 minutes** — both Wave 0 plans (31-01, 32-00) caught issues that would have cost more to fix post-implementation.

### Cost Observations

- Sessions: 3 (one per phase)
- Timeline: 2 days (2026-05-21 → 2026-05-22)
- Model mix: primarily Sonnet 4.6
- Notable: Phase 32 had 4 plans instead of 3 due to a Wave 0 plan (32-00) — good investment

---

## Cross-Milestone Trends

| Milestone | Phases | Plans | Days | Key Pattern |
|-----------|--------|-------|------|-------------|
| v1.8 | 1 | 4 | 1 | Deviation utils + chart focused redesign |
| v1.9 | 3 | 9 | 2 | TDD Wave 0 + server-component config pattern |

**Recurring observations:**
- Wave 0 TDD scaffolding pays for itself on UI-heavy phases
- Code review catches real issues (at least 3 per phase with review)
- Inline SVG fallbacks needed when lucide-react lacks a brand icon
