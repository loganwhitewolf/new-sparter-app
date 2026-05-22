# Milestones

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
