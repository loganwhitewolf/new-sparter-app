# Milestones

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
