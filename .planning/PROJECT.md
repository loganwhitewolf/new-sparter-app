# Project

## What This Is

Sparter is a personal finance app for the Italian market. It supports email/password and Google/GitHub OAuth authentication with account linking, transaction and expense management, import history, CSV/Excel/PDF import flows backed by Cloudflare R2, user-managed categories, a year-scoped dashboard overview (grouped bar chart, 4 KPI cards, per-month movers drill-down, filter chips by income type and expense nature, FlowNature education popovers, uncategorized nudge), deviation analysis, a regex discovery pipeline (standalone post-categorization service with dedup gates, IDOR-guarded retroactive platform-scoped apply, and a reusable Files-table trigger), a guided first-import onboarding flow, a unified subcategory picker bottom sheet across all 7 selection surfaces, a collapsible icon-rail sidebar, structured logging, and a health endpoint. The app is deployed on Vercel (operator action) or runnable locally with a Supabase/R2 stack.

## Core Value

The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending — all running on a zero-cost personal deploy with real database persistence and repeatable migration/deploy procedures.

## Project Shape

- **Complexity:** complex
- **Why:** The app spans Next.js server runtime, Better Auth (email/password + OAuth), Drizzle/Postgres, Cloudflare R2, production environment variables, migrations, categorization tiers, dashboard deviation analytics, and external free-tier platform limits.

## Current State

All milestones M001–v2.2 (Phases 1–57) complete. The app now has:
- Email/password + Google/GitHub OAuth auth with account linking (link/unlink from /settings/profile)
- Import management, categorization (Tier 1 regex, Tier 2 history, Tier 3 AI gated)
- Pattern suggestions: detect recurring uncategorized descriptions → review and promote during analysis → re-run post-import from `/import/[fileId]/suggestions`
- Category settings with user-owned and system categories/subcategories on the v2.0 nature→direction model: `direction`(4) + `nature`(8) FK-backed lookup tables, `sub_category.nature_id` FK, `direction.included_in_totals` as the single totals-exclusion source (`category.type`/`flow_nature`/`amount_sign`/`exclude_from_totals` removed)
- Direction-based dashboard/surfaces (v2.0): 4-direction view with allocation bucket, algebraic-sum aggregation, cascade options + table filters keyed by direction
- Explicit transaction pairing (v2.0): 1:1 order↔refund linking with algebraic netting across all 8 dashboard aggregation sites, searchable counterpart picker, inline signed-net badge + popover, and unlink-restores-baseline
- Redesigned year-scoped `/dashboard/overview` (v1.16): grouped Entrate/Uscite bar chart with always-on compact labels, 4 KPI cards (Entrate/Uscite/Bilancio/Tasso risparmio) with YTD-vs-prior delta and sentiment reading lines, filter chips for income type and expense nature, FlowNature ⓘ education popovers, inline amber uncategorized nudge with localStorage dismiss, per-month movers drill-down (click bar → top movers panel, humanized Italian copy, "spesa nuova" for new spend, defaults to last month with data)
- First-import onboarding (5-step flow: upload → overview → education → categorize → outro); routing gate via RSC layout
- Unified subcategory picker (vaul bottom sheet, type chips, master-detail rail, most-used section) across all 7 selection surfaces; pattern form reduced to regex + description + picker
- Collapsible icon-rail sidebar with localStorage-persisted state; Topbar removed; BottomNav 5th Impostazioni entry; ThemeToggle in SettingsHub
- R2 upload services, Drizzle migrations, operational health diagnostics
- Zero-cost deploy runbook at `docs/deploy/vercel-supabase-r2.md`
- Standalone Expense (v2.4): inline "spesa a sé / non aggregare" action in the categorization flow on any transaction; `detachTransactionToDedicatedExpense` accepts `subCategoryId` and persists it on both the multi-tx and new single-tx in-place re-hash paths; `SINGLE_TRANSACTION_EXPENSE` guard removed; row-title display precedence fixed to `customTitle → expenseTitle → description` (checkpoint bug fix, `transaction.description`/hash/aggregation/Tier 2 untouched)

Live Vercel/Supabase/R2 deploy is operator-pending (R038, R039, R041). Code, config, and runbook are complete.

## Current Milestone: v2.4 — Standalone Expense (Phase 61 complete — ready to ship)

**Goal:** Give the user a way to isolate a single transaction from `descriptionHash` aggregation at categorization time — a general "treat as a standalone expense / do not aggregate" action — so shared-subscription reimbursements and ambiguous person-to-person inflows are categorized correctly without polluting the sender's aggregate or the Tier 2 history.

**Delivered (Phase 61, verified 2026-07-01, 8/8 must-haves):**
- Inline "standalone expense" action in the categorization flow: captures a title + subcategory and detaches the transaction into a dedicated expense with a synthetic `descriptionHash`. General — available on any transaction — not a counterparty category.
- Single-transaction in-place path that lifts the `SINGLE_TRANSACTION_EXPENSE` guard in `lib/services/transaction-detach.ts` by re-hashing the existing expense row (no new expense, no orphan).
- Checkpoint bug fix: row title now falls back `customTitle → expenseTitle → description` so a renamed standalone expense's title is reflected on the transaction row (previously stuck on the raw bank description).

**Decision contract:** LOCKED in `docs/adr/0016-shared-costs-net-by-subcategory-inflows-isolated-per-transaction.md` + `CONTEXT.md` (Standalone Expense entry). The option-A netting doctrine is already usable with zero code; this milestone builds only the isolation capability. Deferred: normalized Subscriptions view; split of a single inflow across subcategories.

**Status:** Phase 61 complete and verified. Milestone ready for `/gsd-complete-milestone v2.4` (tag) when desired — same pattern as v2.3.

## Last Shipped Milestone: v2.3 — Platform Identity & Format Ownership (shipped 2026-06-30)

**Goal:** Make Platform a globally shared, moderated identity (never user-owned) and move private ownership onto the Import Format, eliminating duplicate platforms and the seed id collision.

**Target features:**
- Platform is never user-owned: drop `platform.visibility`, rename `platform.ownerUserId` → `proposedByUserId`; review lifecycle via `reviewStatus` (pending = visible only to proposer; approved = shared with all). Existing private platforms migrated via backfill.
- Private Import Format decoupled from private Platform: `accessibleWhere` allows a user-owned format to be visible on a global/approved platform.
- Import wizard attaches a new private Import Format to an existing Platform when format detection fails; a new Platform is created only when none fits, and is born `pending`.
- Seed linkage by slug: seeded import formats reference the platform by slug (no hardcoded id); the Trade Republic id-8 collision is eliminated; runtime FK stays `platformId`.
- DescriptionStripPattern reference cleanup: docs/glossary (and any stale code/comments) reflect that the strip pattern lives on `import_format_version` (ADR 0013), not `platform`.

**Decision contract:** LOCKED in `docs/adr/0015-platform-global-moderated-format-private.md` + `CONTEXT.md` (Platform / Import Format entries). No discovery to redo. Deferred: operator approval UI (multi-user only).

## Last Shipped Milestone: v2.2 — PDF Import (shipped 2026-06-26)

**Goal:** Enable importing PDF bank statements (first real case: Trade Republic), starting with a refactor that separates the parsing contract from Platform identity.

**Delivered:**
- Import Format refactor: parsing contract moved from `platform` to `import_format_version` (ADR 0013); behavior-preserving — 7 CSV fixture hashes identical before/after regression test; `platform` is now pure identity.
- Trade Republic PDF import: per-bank template recognized by markers, normalized to `ParsedImportFile` with synthetic headers; amount sign via positional X coordinates (`unpdf`); "TRANSAZIONI SUL CONTO" section only; minimal `descriptionStripPattern` so recurring savings plan rows aggregate.

**Status:** Phases 56–57 complete. All 10 requirements satisfied. PR #24 open — requires `yarn db:migrate → seed → seed-extras → seed-patterns` before merge (migration 0022 has critical backfill).

## Prior Shipped Milestone: v2.1 — Regex Discovery & Transaction Unification (shipped 2026-06-22)

**Goal:** Re-architect regex discovery as a separate step downstream of auto-categorization, removing duplicate and already-covered proposals, with a reusable trigger and a cleaned-up import summary.

**Delivered:**
- Standalone `discoverRegexCandidates` service operating on post-categorization Set B only; no fileId or import context required; platform-specific normalization strip applied before clustering.
- Two-list `DiscoveryResult`: `candidates` (genuine prefix+variable families) and `singleCategorizationSuggestions` (identical-after-normalization groups). Check 1 (active-pattern dedup) and Check 2 (manual-history hash dedup) gates applied before output.
- `promoteSuggestionAction` resolves `platformId` server-side from `fileId` (IDOR guard); calls `applyNewPatternToPlatformExpenses` (platform-scoped Set B apply); returns inline Italian count copy on the suggestion card.
- `discoverRegexCandidates` reachable from two entry points: auto post-import non-fatal run with `discoveryCount` CTA (TRIG-01), and per-row "Ricontrolla regex" via `recheckRegexAction` from the Files table (TRIG-02).
- `detectPatternSuggestions` removed; `sampleRows` capped at 10; `SuggestionSection` with distinct headings + intro text; SUMUI-03 discovery-step paragraph.

**Status:** All 5 phases (51–55) shipped. 14/14 requirements satisfied (v2.1-MILESTONE-AUDIT.md: passed). Operator deploy (R038/R039/R041) remains operator-pending.

## Last Shipped Milestone: v2.0 — Nature/Direction Model Realignment (shipped 2026-06-14)

**Goal:** Replace the dual-axis `category.type` + `nature` classification with a single nature→direction model backed by lookup tables, migrate and recategorize all existing data, and add explicit transaction pairing on top of the implicit netting.

**Target features:**
- **NATURE-TABLE-01** — `direction`(4) + `nature`(9) lookup tables, `sub_category.nature_id` FK; remove `category.type` / `flow_nature` / `amount_sign` (supersedes ADR 0008); dissolve & rename categories and subcategories per `.planning/nature-remapping-WORKING.md` (23 categories · ~65 subcategories · 9 natures); rework `seed-data`/`seed-extras`; migrate + recategorize existing transactions; update dashboard/KPI/cascade/filters to direction + algebraic sum (4-direction view incl. `allocation`); deprecate `exclude_from_totals` in favour of `direction.included_in_totals`.
- **TX-PAIRING-01** — explicit transaction↔opposite linking (order↔refund), additive over the implicit subcategory netting (ADR 0004); ships as the final phase.

**Status:** all 5 phases complete (2026-06-14). Phase 50 (transaction-pairing, TX-PAIRING-01) shipped the explicit 1:1 order↔refund linking — `transaction_pair` table (migration 0020, applied), ownership-validating service (atomic, opposite-sign-enforced), shared `isNotSecondary()`/`effectiveAmount()` netting across all 8 dashboard aggregation sites, and the picker/badge/popover UI. Milestone v2.0 is ready for `/gsd-complete-milestone`.

**Design status:** LOCKED & certified. Contract: `docs/adr/0012-direction-derived-from-nature-allocation.md`, `CONTEXT.md`, `.planning/nature-remapping-WORKING.md`. No discovery to redo.

**Prior milestone:** v1.16 (Dashboard Overview Redesign) shipped 2026-06-09; see `.planning/milestones/v1.16-ROADMAP.md`. EDU-FUT-01 (FlowNature taxonomy rename) is absorbed into NATURE-TABLE-01. Operator deploy R038/R039/R041 remain operator-pending.

## Architecture / Key Patterns

- Next.js 16 App Router with React 19 and server actions/route handlers.
- Drizzle ORM + PostgreSQL, with SQL migrations generated by `drizzle-kit generate` and applied by `scripts/migrate.ts`; `drizzle-kit push` is not allowed in production.
- Better Auth with Drizzle adapter — email/password + Google/GitHub OAuth. Social providers activated by env vars only (`GOOGLE_CLIENT_ID`, `GITHUB_CLIENT_ID`). Account linking via `authClient.linkSocial` / `authClient.unlinkAccount`.
- Cloudflare R2 via S3-compatible SDK and presigned browser PUT uploads; upload diagnostics must not log presigned URLs, file contents, raw SDK/request objects, or credentials.
- Pino structured logging with optional Better Stack transport and AsyncLocalStorage request/user context propagation.
- `/api/health` is the operational diagnostic surface for DB and R2 readiness and always returns structured JSON.
- Developer-facing code, comments, route names, tests, and docs are English; Italian is allowed only for intentional product/domain surfaces.
- Decimal.js for all monetary arithmetic — never native `+`, `-`, `*`, `/` on amounts.
- Dashboard deviation: `computeDeviation` + `buildDeviationMap` in `lib/utils/dashboard.ts`; `getCategoryDeviations` DAL in `lib/dal/dashboard.ts`; Reference Period = last completed calendar month, Baseline = 3 months prior, noise threshold = €15.
- Settings navigation: `/settings` hub → `/settings/profile` (profile + linked accounts), `/settings/categories`; `/profile` is a compatibility redirect shim.
- Pattern suggestions follow `docs/adr/0002-pattern-suggestion-detection.md`: tokenize descriptions by whitespace, strip purely numeric tokens, emit longest common prefixes with at least 2 tokens and at least 2 uncategorized matches, infer `detectedAmountSign`, cap UI-facing suggestions at 5, and re-run post-import analysis from persisted transactions rather than raw R2 files.

## Capability Contract

### Validated (M001–v1.15)

- ✓ Pino structured logging, AsyncLocalStorage context, optional Better Stack — M002
- ✓ Full import lifecycle (pending → uploaded → analyzing → analyzed → importing → imported → failed) — M004
- ✓ Import statistics, deduplication, platform detection, recovery wizard — M004
- ✓ User-managed platforms, custom regex patterns, paid-tier gating — M005
- ✓ Category and subcategory management, categorization UX — M005
- ✓ Dashboard overview, category ranking, drill-down reporting — M006
- ✓ Production migration CLI, health/smoke diagnostics — M007
- ✓ Dashboard deviation badges, EntrateUsciteChart, BilancioBarsChart, sort toggle — v1.8/M008
- ✓ Google + GitHub OAuth sign-in/register with env-conditional provider activation — v1.9
- ✓ Account linking: link/unlink social providers from /settings/profile with canUnlink guard — v1.9
- ✓ Registration guardrail removed — any user can register freely via OAuth or email/password — v1.9
- ✓ Pattern suggestion detection: `detectPatternSuggestions` utility; tokenize, strip numeric tokens, longest-prefix grouping, escaping — v1.10
- ✓ Import analysis returns `patternSuggestions`; detection in isolated try/catch, capped at 5 sorted by matchCount — v1.10
- ✓ Import review: `SuggestionSection` + `SuggestionCard` + `promoteSuggestionAction`; promote suggestion to pattern before import commit — v1.10
- ✓ Post-import re-analysis: `/import/[fileId]/suggestions` page from persisted transactions; "Rivedi suggerimenti" dropdown — v1.10
- ✓ FlowNature: `nature` enum column on `sub_category`; stacked nature-segmented EntrateUsciteChart; URL-persisted legend toggles; nature editable in /settings/categories — v1.11
- ✓ First-import onboarding: 5-step flow (upload → overview → education → categorize → outro); RSC layout routing gate (`count(transaction) === 0 → /onboarding`); progress dots; dark/light variant per step — v1.12
- ✓ Unified subcategory picker: `SubcategoryPicker` (vaul bottom sheet, type chips, master-detail rail, search-collapse, most-used DAL query) adopted across all 7 surfaces; `CategoryCombobox` + cascading Selects deleted; pattern form reduced to regex + description + Categorizza picker; `amountSign` derived server-side from category type per ADR 0008 — v1.13
- ✓ Unified table filter & sort: `DataTableToolbar` + `TableConfig` declarative system across Transactions, Expenses, Files; URL-first filtering, server-side WHERE, `id` tiebreaker on all DAL sorts; `MonthMultiPicker`, `AmountRangePicker`; Expenses no temporal filter (ADR 0009/0010) — v1.14
- ✓ Collapsible icon-rail sidebar: `SidebarProvider` + `useSidebarCollapsed` (localStorage-backed, SSR-safe); `AppShell` drives `<aside>` width (w-16/w-60); chevron toggle + tooltips in collapsed mode; user Avatar dropdown at bottom; topbar deleted; BottomNav 5th Impostazioni entry; ThemeToggle in SettingsHub Aspetto section (ADR 0011) — v1.15
- ✓ Dashboard overview redesign: year-scoped overview page with grouped Entrate/Uscite bar chart (variant A, always-on compact labels), 4 KPI cards with YTD delta + sentiment reading lines, FlowNature filter chips (income type + expense nature), ⓘ legend popovers + per-chip tooltips, inline amber uncategorized nudge (localStorage dismiss, lastSeenCount reappear), per-month movers drill-down (click bar → panel, humanized copy, "spesa nuova" for new spend, default = last month with data); `income_extraordinary` FlowNature member added (9 members total) — v1.16

### Validated (v2.0–v2.2)

- ✓ NATURE-TABLE-01 — `direction`(4) + `nature`(8) FK-backed lookup tables; `sub_category.nature_id` FK; `category.type`/`flow_nature`/`amount_sign`/`exclude_from_totals` removed; 23-category/87-subcategory reseed; migration 0018 applied; 4-direction dashboard with algebraic-sum aggregation — v2.0
- ✓ TX-PAIRING-01 — explicit 1:1 order↔refund linking (`transaction_pair`, migration 0020); ownership-validating service; shared `isNotSecondary()`/`effectiveAmount()` fragments at all 8 aggregation sites; picker/badge/popover UI — v2.0
- ✓ Regex discovery pipeline refactor: standalone `discoverRegexCandidates` service over post-categorization Set B; RDISC-01/02 routing (regex vs single-cat), Check 1 active-pattern dedup, Check 2 manual-history hash dedup — v2.1
- ✓ Platform-scoped retroactive apply: `promoteSuggestionAction` with IDOR guard (`getPlatformIdForUserFile`); `applyNewPatternToPlatformExpenses`; inline Italian count feedback on suggestion card — v2.1
- ✓ Reusable discovery trigger: auto post-import non-fatal run with `discoveryCount` CTA (TRIG-01) + per-row "Ricontrolla regex" via `recheckRegexAction` from Files table (TRIG-02) — single service, no divergent implementation — v2.1
- ✓ Import summary UX: `sampleRows` capped at 10; distinct regex/single-cat section headings with intro text (SUMUI-02); SUMUI-03 discovery-step cue paragraph — v2.1
- ✓ IFMT-01–05: parsing contract moved from `platform` to `import_format_version` (ADR 0013); `platform` is pure identity; 7 CSV fixture hashes regression-proved identical; format versioning per-platform expressible with `unique(platformId, version)` — v2.2
- ✓ PDF-01–05: Trade Republic PDF import via `unpdf` positional X-coordinate sign detection, Decimal.js balance chain validation, "TRANSAZIONI SUL CONTO" section extraction; PDF rows normalized to `ParsedImportFile` — detector/normalize/dedup/preview pass unchanged; user-friendly Italian error UX for unrecognized PDF formats — v2.2

### Active (carryover / operator-pending)

- [ ] R029 — Categorization revalidation for all entrypoints (partial, M005 covered existing ones)
- [ ] R038 — Vercel Hobby/free deploy (operator-pending)
- [ ] R039 — Supabase Free Postgres production database (operator-pending)
- [ ] R041 — Cloudflare R2 production storage (operator-pending)

### Out of Scope

- Mobile app — web-first; PWA acceptable later
- Video/audio features — not relevant for finance
- Multi-user / team accounts — single-user personal finance for v1.x
- Staging environment — free-tier cost constraint
- Offline mode — real-time data is core value
- Apple OAuth — requires Apple Developer account and certificate; defer to v2
- Magic link / passwordless — out of scope for v1.x
- SSO / SAML — single-user personal finance, not enterprise

## Milestone Sequence

- [x] M001: Migration — Established the initial migrated app foundation.
- [x] M002: Observability — Added structured logging, health diagnostics, and safe operational surfaces.
- [x] M003: Transactions, Deduplication & Inline Categorization — Delivered transaction identity, aggregation, and categorization behavior.
- [x] M004: Import Management — Delivered import lifecycle management, unknown-format recovery, and safe deletion flows.
- [x] M005: Category Management & UX Polish — Delivered user category management and categorization UX improvements.
- [x] M006: Dashboard Insight Suite — Delivered dashboard overview, category insights, and drill-down reporting.
- [x] M007: Zero-cost Production Deploy — Deploy runbook, Vercel env contract, R2/Supabase config, smoke suite. Operator deploy pending.
- [x] v1.8 / M008: Dashboard Intelligence — Deviation view, chart clarity, sort toggle. Shipped 2026-05-20.
- [x] v1.9: Social Auth — Google/GitHub OAuth login/register, account linking UI, registration guardrail removed. Shipped 2026-05-22.
- [x] v1.10: Pattern Suggestions — Detect recurring uncategorized bank descriptions and promote useful suggestions to categorization patterns. Shipped 2026-05-25.
- [x] v1.11: FlowNature & Segmented Chart — `nature` enum on subcategories, stacked nature chart with legend toggles, nature management in settings. Shipped 2026-05-26.
- [x] v1.12: First-import Onboarding — 5-step guided flow for new users; RSC layout routing gate; categorization wizard with nature badges. Shipped 2026-05-28.
- [x] v1.13: Unified Categorization Picker — Single `SubcategoryPicker` (vaul bottom sheet) across all 7 surfaces; pattern form rework; `amountSign` derived from subcategory type per ADR 0008. Shipped 2026-06-02.
- [x] v1.15 Phase 41: Collapsible Sidebar — Icon-rail sidebar with localStorage-persisted collapse state, chevron toggle, tooltips in collapsed mode, user dropdown at bottom; Topbar removed; BottomNav 5th "Impostazioni" entry; ThemeToggle moved to SettingsHub Aspetto section. Shipped 2026-06-07.
- [x] v1.16: Dashboard Overview Redesign — Year-scoped overview redesign: grouped bar chart (variant A), 4 KPI cards with delta + reading lines, filter chips, FlowNature education popovers, uncategorized nudge, per-month movers drill-down. Shipped 2026-06-09.
- [x] v2.0: Nature/Direction Model Realignment — nature→direction lookup-table model, data migration/recategorization, explicit transaction pairing. Shipped 2026-06-14.
- [x] v2.1: Regex Discovery & Transaction Unification — standalone discovery service, dedup gates, IDOR-guarded retroactive apply, reusable trigger, cleaned import summary. Shipped 2026-06-22.
- [x] v2.2: PDF Import — Import Format refactor (`platform`→`import_format_version`) + Trade Republic PDF import via `unpdf` positional extraction (ADR 0013/0014). Shipped 2026-06-26.
- [x] v2.3: Platform Identity & Format Ownership — Platform as globally shared moderated identity (pending→approved), private ownership on Import Format only, seed slug-linkage fix (ADR 0015). Shipped 2026-06-30 (PR #31, tag v2.3).
- [x] v2.4: Standalone Expense — general "treat as standalone / don't aggregate" action in categorization + in-place single-transaction isolation, lifting the SINGLE_TRANSACTION_EXPENSE guard (ADR 0016). Phase 61 verified 2026-07-01; milestone tag pending.

## Key Decisions

| Decision | Outcome | Status |
|----------|---------|--------|
| Decimal.js for all monetary arithmetic | No native JS arithmetic on amounts throughout | ✓ Good |
| `drizzle-kit push` never in production | SQL migration files via `drizzle-kit generate` + `scripts/migrate.ts` | ✓ Good |
| Presigned PUT for R2 uploads | No file bytes proxied through server actions | ✓ Good |
| Better Auth + Drizzle pg adapter | Session checks only in edge proxy | ✓ Good |
| Import deduplication by descriptionHash | Handles overlapping bank exports | ✓ Good |
| Categorization tier gating (free/basic/pro) | Regex (T1) + history (T2) + AI (T3) | ✓ Good |
| Dashboard deviation: fixed Reference Period | Hardcoded last-month regardless of caller preset (D-02) | ✓ Good |
| Noise threshold €15 for deviation display | Micro-spend categories excluded from deviation | ✓ Good |
| MonthlyTrendChart deleted, two focused charts | Cleaner signal per chart (D-10/D-11/D-12) | ✓ Good |
| Sort default = deviation on categories page | Most actionable sort first; URL omits when default (D-07) | ✓ Good |
| OAuth activation via CLIENT_ID env var only | Presence of ID = activation signal; missing SECRET = loud crash at first use | ✓ Good |
| OAuth vars commented out in .env.example | Prevents accidental secret commit by copy-paste | ✓ Good |
| `canUnlink` checks credential OR other social | More robust than total-count check | ✓ Good |
| `configuredProviders` from process.env booleans | No NEXT_PUBLIC_* vars needed for provider visibility | ✓ Good |
| `/settings` hub + `/settings/profile` canonical | Settings IA extensible; `/profile` is a compat redirect shim | ✓ Good |
| Registration guardrail removed (REG-01) | `lib/auth/registration.ts` deleted; any OAuth account can register | ✓ Good |
| PatternSuggestion detector uses token-prefix grouping | Deterministic, readable regex prefixes without LLM cost or substring noise | ✓ Good |
| Dismissed pattern suggestions are ephemeral | Avoids schema complexity for low-frequency suggestion noise | ✓ Good |
| Post-import DAL uses `innerJoin` on `importFile` | Ownership enforced at query level; non-null `fileId` for all imported rows | ✓ Good |
| `promoteSuggestionAction` confidence hardcoded 0.85 | No UI knob; consistent with existing pattern confidence semantics | ✓ Good |
| `createPattern` reactivates soft-deleted user patterns on unique conflict | Prevents duplicate errors when user re-promotes a previously deleted pattern | ✓ Good |
| `nature` enum on `sub_category`, `effectiveNature` = COALESCE(override, seed default) | User override wins; system seed provides baseline; null = non classificato | ✓ Good |
| Onboarding routing gate in RSC layout (not proxy.ts) | Drizzle cannot run in Edge runtime; D-11 rationale documented | ✓ Good |
| `SubcategoryPicker` single output: `subCategoryId` | Uniform contract across commit-on-tap and fill-field surfaces | ✓ Good |
| `amountSign` on patterns derived server-side from subcategory's category type (ADR 0008) | Removes manual error-prone UI field; confidence hardcoded to 1 | ✓ Good |
| `getMostUsedSubcategories` DAL scoped per-user and by category type | Cold-start safe: section hidden when empty | ✓ Good |
| Overview chart variant A (grouped bars, no stack-by-nature, no balance series) | PO-approved design; reintroducing nature-stacks would undo the redesign clarity goal | ✓ Good |
| `income_extraordinary` mapped onto existing `nature` enum (in side) | Avoids schema change; income recurring = `income`, extraordinary = `income_extraordinary` | ✓ Good |
| KPI totals ignore chart filter chips | Filter chips answer "where does the money go?"; KPIs answer "how much in total?" — mixing would confuse both | ✓ Good |
| Uncategorized nudge in localStorage only (never DB) | Zero schema cost; per-session semantics acceptable for invitational nudge | ✓ Good |
| Per-month movers via recharts `onClick` on bar | Drill-down stays within the page; no route change or modal required | ✓ Good |
| `fetchMovers` server action (not DAL direct call from RSC) | Enables client-controlled month selection after initial SSR render | ✓ Good |
| Set B filter via `isNull(expense.subCategoryId)` | Covers uncategorized statuses without enumerating them; mirrors `applyNewPatternToExpenses` | ✓ Good |
| `discoverRegexCandidates` reads `descriptionStripPattern` from DAL join result | Platform-level constant available from first row; no separate config fetch | ✓ Good |
| Two-list `DiscoveryResult` (candidates + singleCategorizationSuggestions) | Additive shape; downstream UI and triggers receive both lists without re-querying | ✓ Good |
| Check 2 uses `expenseClassificationHistory source='manual'` | Covers the unique `(userId, descriptionHash)` constraint; not current expense state | ✓ Good |
| `platformId` resolved server-side from `fileId` in `promoteSuggestionAction` | IDOR guard: client never supplies platformId directly; dead prop removed from client chain | ✓ Good |
| Post-commit `discoverRegexCandidates` non-fatal (try/catch, `discoveryCount=0` on error) | Import always succeeds; discovery failure is logged but does not surface to user | ✓ Good |
| `recheckRegexAction` called as plain async fn (not `useActionState`) | Enables `router.push` after await without state machine complexity | ✓ Good |
| Parsing contract owned by `import_format_version`, not `platform` (ADR 0013) | `platform` = pure identity; real per-platform versioning expressible; two-step migration (ADD nullable → data copy → DROP) is safe | ✓ Good |
| Per-bank PDF template, not generic parser (ADR 0014) | "Almost-right" extraction on financial data is worse than no import; 2–3 concrete templates → abstraction emerges naturally | ✓ Good |
| `unpdf` for positional X-coordinate extraction, not `pdf-parse` | Serverless-ready; `pdf-parse` produces flat text with no coordinate info — cannot determine credit/debit sign | ✓ Good |
| Balance chain as explicit import guard for PDF | Any sign error halts import with explicit error; prevents silent bad data on tampered/malformed PDFs | ✓ Good |
| `PDF_IMPORT_PLATFORM_SLUGS` allowlist co-located with `.pdf` dispatch | Single source of truth for PDF-capable banks; no `fileType` column on `import_format_version` (avoids scope creep) | ✓ Good |
| `UNRECOGNIZED_PDF_FORMAT` — single constant for both machine code and Italian fallback | No separate enum; action intercepts the code and enriches with platform list; no internal markers leaked to UI | ✓ Good |
| Single-transaction detach re-hashes the existing expense row in place (no new expense) (ADR 0016) | Multi-tx detach path would leave the source expense orphaned when it held only one transaction; in-place UPDATE avoids the orphan by construction, preserving classification history on the same row/id | ✓ Good |
| Standalone-expense isolation is a general categorization action, not a "money from a person" category | Classifying by counterparty violates CONTEXT.md's categorization rule #1 (by purpose, not by who) and isn't reliably auto-detectable | ✓ Good |
| Row title display precedence: `customTitle → expenseTitle → description` | Latent gap surfaced by v2.4: expense.title updates on standalone-rename but the row kept showing raw bank description, since TransactionTitleEdit never read expenseTitle. Fixed display-only; `transaction.description`/descriptionHash/aggregation/Tier 2 untouched | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-01 — Phase 61 complete, v2.4 Standalone Expense verified and ready to ship*
