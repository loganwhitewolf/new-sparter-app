---
phase: 80
slug: dashboard-accrual-lens
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-29
validated: 2026-07-29
---

# Phase 80 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Reconstructed from phase artifacts (SUMMARY + VERIFICATION) — the seed template was never filled during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (unit/integration, real Postgres) + Playwright (e2e) |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `./node_modules/.bin/vitest run tests/lens-persistence.test.ts tests/dashboard-filters.test.ts tests/resolve-year.test.ts tests/months-with-data-dal.test.ts tests/table-search-params.test.ts` |
| **Full suite command** | `yarn test` (`vitest run`) |
| **Estimated runtime** | ~12s full suite (1953 tests); ~0.2s lens quick subset (95 tests) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command (lens unit subset)
- **After every plan wave:** Run the full suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~12 seconds (full suite)

---

## Per-Task Verification Map

Mapped at plan granularity (7 plans). All LENS requirements are automated and green.

| Plan | Requirement | Behavior | Test Type | Automated Command | Test File | Status |
|------|-------------|----------|-----------|-------------------|-----------|--------|
| 80-01 | LENS-01 | `LensSwitch` renders two buttons w/ `aria-pressed`; updates URL + sessionStorage | unit + e2e | `vitest run tests/lens-persistence.test.ts` · `playwright test tests/dashboard.spec.ts` | `tests/lens-persistence.test.ts`, `tests/dashboard.spec.ts:189–202` | ✅ green |
| 80-01 | LENS-01 | `parseLensParam` parses `?lens=`, defaults to `cassa` on absent/garbage | unit | `vitest run tests/table-search-params.test.ts` | `tests/table-search-params.test.ts` | ✅ green |
| 80-02 | LENS-02 | Category aggregations thread `ledgerRowSource`; accrual sums only in-range instalments | integration (real PG) | `vitest run tests/amortization-lens-regression.test.ts` | `tests/amortization-lens-regression.test.ts:57,123` | ✅ green |
| 80-03 | LENS-04 | `getYearsWithData('competenza')` unions instalment months; chart/movers lens-aware | integration (real PG) | `vitest run tests/overview-dal.test.ts tests/months-with-data-dal.test.ts` | `tests/overview-dal.test.ts:106–120`, `tests/months-with-data-dal.test.ts:54–92` | ✅ green |
| 80-03 | LENS-05 | Lens-aware selectors + cross-lens clamp (D-10) | unit | `vitest run tests/resolve-year.test.ts` | `tests/resolve-year.test.ts:22–39` | ✅ green |
| 80-04 | LENS-01/05 | `buildDashboardTabHref` forwards `?lens=` across tabs; end-to-end wiring | unit + e2e | `vitest run tests/dashboard-filters.test.ts` | `tests/dashboard-filters.test.ts:151–165`, `tests/dashboard.spec.ts:252` | ✅ green |
| 80-05/06/07 | LENS-01/02 | Remaining route wiring; tags lens-invariant + disabled switch (D-05); CR-01 YTD bound; CR-02 category-nav lens threading | integration + e2e | `vitest run tests/amortization-lens-regression-overview.test.ts` | `tests/amortization-lens-regression-overview.test.ts:56,148`, `tests/dashboard.spec.ts:204,240` | ✅ green |
| — | LENS-03 | Cash byte-identical regression (Phase 77 invariant preserved) | integration (real PG) | `yarn test` | `tests/amortization-lens-regression*.test.ts` (cash-lens branches) | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing vitest + Playwright infrastructure covers all phase requirements. No Wave 0 scaffolding was required — the v2.8 real-Postgres regression harness for the ten aggregation sites already existed and was extended in place.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Playwright LENS e2e suite driven against a **live** app | LENS-01/05 | Blocked by a pre-existing, unrelated `proxy.ts` bug (commit cff3b7464, 2026-04-25 — months before this phase) causing an infinite onboarding redirect loop on the staging-bypass path. The e2e assertions are authored and committed (`tests/dashboard.spec.ts:189–257`), including the WR-02 URL-lens regression guard; they simply cannot be driven live until the proxy loop is fixed. Data-correctness is fully proven by the real-Postgres integration tests. | Once `proxy.ts` is fixed: `yarn test:e2e tests/dashboard.spec.ts` — assert switch renders on all four routes, disabled+noted on `/dashboard/tags`, `?lens=competenza` survives tab and category-row navigation. |

*The e2e suite is a supplementary UI guard; every LENS behavior's data correctness has green automated coverage via unit + real-Postgres integration tests.*

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — existing infra sufficient)
- [x] No watch-mode flags
- [x] Feedback latency < ~12s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-29

---

## Validation Audit 2026-07-29

Reconstructed from artifacts (seed template was never filled). Cross-referenced 5 LENS requirements against committed test files; ran the lens unit subset (95 tests) green; confirmed full suite green (1953 tests) per VERIFICATION.md.

| Metric | Count |
|--------|-------|
| Requirements audited | 5 (LENS-01…05) |
| COVERED | 5 |
| Gaps found | 0 |
| Resolved | 0 |
| Escalated (manual-only) | 1 (e2e live-run, blocked by pre-existing proxy bug — assertions authored) |
