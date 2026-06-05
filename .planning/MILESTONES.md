# Milestones

## v1.14 — Unified Table Filter & Sort

**Shipped:** 2026-06-04
**Phases:** 40 (1 phase)
**Plans:** 5
**Tasks:** 11

### Delivered

Unified filtering and sorting across the Transactions, Expenses, and Files tables behind one declarative `DataTableToolbar` driven by per-table `TableConfig`. URL is the single source of truth, filtering runs server-side, every DAL sort carries an `id` tiebreaker, Expenses have no temporal filter (ADR 0009), and there is no filter engine (ADR 0010).

### Key Accomplishments

1. Shared `TableConfig` / `FilterField` / `SortColumn` types and total URL param parsers (`parseMonths`, `parseAmount`, `parseStatus`, `parseSortDir`) with `id` tiebreaker appended to all transaction and import DAL `orderBy` calls
2. Shared `DataTableToolbar` consuming `TableConfig`: inline search, "Filtri (n)" Popover, active-chip row ("Cancella tutto"), mobile Sheets for filters + sort, desktop `HeaderSortButton` with `aria-sort` and ASC→DESC→off cycle — all state in the URL via `useTableUrl`
3. Session-scoped `getMonthsWithData` DAL (TDD) + data-aware `MonthMultiPicker` (year-grid, presets, "Tutto l'anno") + `AmountRangePicker` (absolute-value inputs) replacing Wave-2 placeholders
4. Three `TableConfig` objects + DAL WHERE conditions + rewired pages: Transactions (months/amount/platform/category/categorization), Expenses (no temporal, all-time default, status-4→uncategorized), Files (3 processing buckets, coverage months, platform, amount)
5. `EmptyState` component (no-data vs no-result) wired in all three table pages, mobile sort button labeled, legacy URL params silently dropped in total-function parsers, prototype route deleted, `yarn build` green

### Known Deferred Items

- Quick-task tracking artifacts acknowledged at close (4) — flagged by the open-artifact audit but triaged as already-shipped or deferred, none part of v1.14 scope: `260524-pha` (empty dir, dup of `pnk`), `260524-pnk` (shipped 889ae56), `260525-ga2` (shipped 4a722f2), `260530-bib-description-strip-pattern` (descriptionStripPattern — shipped separately, migration 0015)
- R038, R039, R041 — live Vercel/Supabase/R2 deploy operator-pending
- R029 — partial categorization revalidation coverage

### Archive

- `.planning/milestones/v1.14-ROADMAP.md`

---

## v1.13 — Unified Categorization Picker

**Shipped:** 2026-06-02
**Phases:** 39 (1 phase)
**Plans:** 6
**Commits:** ~50

### Delivered

Replaced three divergent subcategory-selection implementations with a single reusable `SubcategoryPicker` (vaul bottom sheet, variant E). Adopted across all 7 selection surfaces. Pattern and suggestion-promotion forms reduced to regex + description + Categorizza button; `amountSign` derived server-side from category type per ADR 0008; `confidence` hardcoded to 1. Old `CategoryCombobox`, `SubcategoryCombobox`, and cascading Select pairs deleted.

### Key Accomplishments

1. `SubcategoryPicker` (vaul bottom sheet): fixed-height, type chips (Entrate/Uscite/Trasferimenti), two-column master-detail, search-collapse, single `subCategoryId` output
2. `getMostUsedSubcategories` DAL: top ~6 per-user by categorization count, hidden at cold-start
3. Adopted picker in 4 commit-on-tap surfaces: single expense, transaction-table, bulk, onboarding step 4
4. Adopted picker in 2 fill-field forms: create/edit expense, create transaction — cascading Selects deleted
5. Pattern + suggestion-promotion forms reworked: `amountSign` server-side from category type, `confidence=1` (ADR 0008)
6. Cleanup: `CategoryCombobox` + all legacy picker code deleted; prototype route removed; `yarn build` + `yarn check:language` green

### Known Deferred Items

- `260530-bib-description-strip-pattern` — `descriptionStripPattern` field on Platform (plan exists, not executed; backlog for next milestone)
- R038, R039, R041 — live Vercel/Supabase/R2 deploy operator-pending
- R029 — partial categorization revalidation coverage

### Archive

- `.planning/milestones/v1.13-ROADMAP.md`

---

## v1.12 — First-import Onboarding

**Shipped:** 2026-05-28
**Phases:** 38 (1 phase)
**Plans:** 3
**Commits:** ~38

### Delivered

New users with zero transactions see a dedicated 5-step onboarding flow instead of an empty dashboard. Flow: upload → overview → categorization education → manual categorization wizard → outro. RSC layout routing gate redirects all authenticated routes to `/onboarding` while `count(transaction) === 0`.

### Key Accomplishments

1. DAL foundation: `getTransactionCount`, `getTopUncategorizedExpenses`, `getFileCoveredMonths`, `formatMonthRange`
2. RSC layout gate in `app/(app)/layout.tsx` — Drizzle not allowed in Edge runtime, implemented in RSC per D-11
3. Onboarding route group + Steps 1–3: upload (reuses R2 presigned PUT), overview (real data), education (giroconto tip)
4. Step 4: manual categorization wizard with FlowNature badges + `onboardingCategorizeExpense` action
5. Step 5 outro + full-screen hero design (dark bg Steps 1–3+5, light bg Step 4) + prototype deletion

### Known Deferred Items

- R038, R039, R041 — live Vercel/Supabase/R2 deploy operator-pending
- R029 — partial categorization revalidation coverage

---

## v1.11 — FlowNature & Segmented Chart

**Shipped:** 2026-05-26
**Phases:** 37 (1 phase)
**Plans:** 5
**Commits:** ~45

### Delivered

Added `nature` enum column to `sub_category` and evolved the dashboard chart into a stacked nature-segmented bar chart with URL-persisted legend toggles. Seeded 126 system subcategories with default natures. Exposed nature override in `/settings/categories`.

### Key Accomplishments

1. Schema migration: `flowNatureEnum` on `sub_category` + `user_subcategory_override`; 126 subcategories seeded with defaults
2. `getMonthlyTrendByNature` DAL + `MonthlyNatureTrendPoint`; `effectiveNature = COALESCE(override, seed default)`
3. Stacked nature `EntrateUsciteChart` with URL-persisted legend toggles (`?hidden=` param); null nature → "non classificato"
4. `SubcategoryNatureSelect` + `setSubcategoryNatureAction` in settings — nature required on creation (default: discretionary)
5. NATURE_COLORS: hex values for Recharts fill; `Transfer` flows excluded via existing `excludeFromTotals`

### Known Deferred Items

- R038, R039, R041 — live Vercel/Supabase/R2 deploy operator-pending

---

## v1.10 — Pattern Suggestions

**Shipped:** 2026-05-25
**Phases:** 33–36 (4 phases)
**Plans:** 9
**Quick Tasks:** 2
**Timeline:** 2026-05-22 → 2026-05-25 (4 days)

### Delivered

Full end-to-end pattern suggestion pipeline for the import flow. Users can now discover recurring uncategorized bank descriptions via a deterministic token-prefix detector, see ranked suggestions during import analysis, promote useful ones to categorization patterns before confirming the import, and re-run suggestion analysis after an import from persisted transactions at `/import/[fileId]/suggestions` — without touching the raw R2 file. Two quick-task fixes added: partial-match-only filter (SUG-07) and pattern application bug with numeric token stripping.

### Key Accomplishments

1. Pure `detectPatternSuggestions` utility — tokenizes bank descriptions, strips numeric tokens, emits longest common prefixes (≥2 tokens, ≥2 uncategorized matches), infers `detectedAmountSign`, escapes regex metacharacters
2. `analyzeFile` extended with isolated try/catch pattern detection — detection failures never block import; `ImportAnalysisResult` carries capped, ranked `patternSuggestions`
3. `promoteSuggestionAction` Server Action with `verifySession()` + `CreatePatternSchema.safeParse()` + hardcoded confidence 0.85 — no UI tamperability
4. `SuggestionSection` + `SuggestionCard` + `SuggestionPromoteForm` components wired into `ImportPreview` and `AnalyzePage` via parallel fetch; 577 Vitest tests GREEN
5. `getUncategorizedTransactionsByFileId` DAL function with `innerJoin` ownership enforcement; `/import/[fileId]/suggestions` server component page with `notFound()` guard
6. `createPattern` handles unique-constraint violations by reactivating soft-deleted user patterns instead of throwing

### Known Deferred Items

- REVAL-01: Apply newly created pattern to existing transactions from same import file
- GLOBAL-01: Pattern suggestions across all uncategorized transaction history
- DISM-01: Persistent dismissal of noisy suggestions
- R038/R039/R041 — live Vercel/Supabase/R2 deploy remains operator-pending
- R029 — partial categorization revalidation coverage

### Archive

- `.planning/milestones/v1.10-ROADMAP.md`
- `.planning/milestones/v1.10-REQUIREMENTS.md`

---

## v1.9 — Social Auth

**Shipped:** 2026-05-22
**Phases:** 30–32 (3 phases)
**Plans:** 9
**Commits:** 45

### Delivered

Enabled Google and GitHub OAuth for Sparter: users can sign in or register with social providers, link or unlink providers from a new /settings/profile page, and the registration guardrail has been removed so any OAuth account can register freely. Settings navigation reorganized with a /settings hub and dedicated profile page hosting ConnectedAccountsCard.

### Key Accomplishments

1. Removed registration guardrail (REG-01) — deleted `lib/auth/registration.ts` and all consumers; any user can now register via OAuth or email/password
2. Added env-conditional Google + GitHub OAuth providers to Better Auth via conditional spread on CLIENT_ID — no code change needed to activate a provider
3. `SocialProviderButtons` client component with inline SVG GitHub icon, pending state, Italian error mapping, and per-page `errorCallbackURL`
4. Login and Register pages converted to async server components reading `process.env` — provider buttons appear only when credentials are configured
5. Settings IA reorganized: `/settings` hub, `/settings/profile` canonical page, `/profile` compatibility redirect shim, topbar retargeted
6. `ConnectedAccountsCard` — link/unlink flows via `authClient`, `canUnlink` guard (credential OR other social), confirmation Dialog, `decodeAndMapError`, stable `PROVIDER_ORDER`

### Known Deferred Items

- LINK-01..04 live OAuth E2E tests are `test.fixme()` stubs — require real provider credentials configured for dev URL
- R038/R039/R041 — live Vercel/Supabase/R2 deploy remains operator-pending (code complete in M007)
- R029 — partial categorization revalidation coverage

### Archive

- `.planning/milestones/v1.9-ROADMAP.md`
- `.planning/milestones/v1.9-REQUIREMENTS.md`

---

## v1.8 — Dashboard Intelligence

**Shipped:** 2026-05-20
**Phases:** 29 (1 phase)
**Plans:** 4
**Tasks:** 16 commits

### Delivered

Made the Sparter dashboard actionable at a glance: deviation badges on category pages show % vs 3-month baseline, the old 5-series MonthlyTrendChart is replaced by two focused charts (EntrateUsciteChart + BilancioBarsChart), and a sort toggle lets users rank categories by deviation or amount.

### Key Accomplishments

1. Fixed D-01 date preset bug — `last-month` now correctly computes both `from` and `to` using `month - 1`
2. Built `getCategoryDeviations` DAL: parallel Drizzle queries for reference + baseline periods, Decimal.js arithmetic, noise threshold €15
3. `DeviationBadge` component with correct color polarity (out: positive = red, in: positive = green)
4. Deleted `MonthlyTrendChart` — replaced by `EntrateUsciteChart` (2 bars) + `BilancioBarsChart` (per-month green/red cells)
5. Sort toggle on `/dashboard/categories` — deviation-sort as default, URL-preserving, tab-nav aware
6. 83 tests green (40 phase-29 utils/dal/badge/charts + 43 plan-04 category/filter tests)

### Known Deferred Items

- R038/R039/R041 — live Vercel/Supabase/R2 deploy is operator-pending (code complete in M007)
- R029 — partial categorization revalidation coverage

### Archive

- `.planning/milestones/v1.8-ROADMAP.md`
- `.planning/milestones/v1.8-REQUIREMENTS.md`
