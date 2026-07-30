---
phase: 82-number-engine-and-regression-gate
reviewed: 2026-07-30T16:02:39Z
depth: deep
files_reviewed: 10
files_reviewed_list:
  - lib/dal/covered-months.ts
  - lib/services/pace-and-projection.ts
  - app/(app)/dashboard/categories/page.tsx
  - app/(app)/dashboard/categories/[id]/page.tsx
  - components/dashboard/category-ranking-list.tsx
  - components/dashboard/dashboard-tab-nav.tsx
  - tests/pace-and-projection.test.ts
  - tests/pace-engine-lens-regression.test.ts
  - tests/lens-switch-placement.test.tsx
  - tests/dashboard-filters.test.ts
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 82: Code Review Report

**Reviewed:** 2026-07-30T16:02:39Z
**Depth:** deep
**Files Reviewed:** 10 (in-scope list above) + cross-file trace into `lib/routes.ts`, `lib/dal/dashboard.ts`, `tests/dashboard.spec.ts`, `82-VALIDATION.md`
**Status:** issues_found

## Summary

The engine itself (`lib/dal/covered-months.ts`, `lib/services/pace-and-projection.ts`) is well-built:
Decimal.js is used exclusively for every monetary computation (D-11), user scoping via
`verifySession()` + parameterized `sql` template is correct in both new DAL functions (T-82-01),
`buildYearSeries`'s total is structurally the reduce-sum of the same array it returns (D-07), the
`insufficient` `PaceResult` variant has no `pace`/`projection` field so it cannot be silently
coerced to zero (D-05), and the D-06 hybrid tie case is explicitly tested. The lens-confinement
change (D-12) is correctly wired: `getCategoryRanking`/`getCategoryDetail`/`getCategoryDeviations`
are now called with zero arguments beyond `filters`, so they fall through to their existing
`ledgerEntryCash` default — no `?lens=` URL value can reach Categories' aggregation anymore. The
`tag` param is dropped and `lens` still propagates in `buildDashboardTabHref`, exactly per D-13/D-14.
`vitest run` (172/2128), `tsc --noEmit`, and `check-code-language.mjs` are all clean, and I ran the
real-Postgres `pace-engine-lens-regression.test.ts` directly against `sparter-postgres` — it passes
for real (not skipped).

However, this phase's own stated purpose is to be a **regression gate**, and cross-file tracing
into a Playwright spec that isn't in the file list (because it wasn't touched) turned up exactly
the kind of regression this phase was supposed to catch: `tests/dashboard.spec.ts`, added in Phase
80 specifically to guard the lens switch, still asserts the switch **renders and is functional on
`/dashboard/categories`** — behavior this phase deliberately removed (D-12) without updating the
test. It is filed as the one Critical finding. Four Warnings cover an untested `getCategoryMonthlyAmounts`,
an untested D-05 threshold boundary, dead `lens`-forwarding code left in `lib/routes.ts`, and the
inherited (not new, but explicitly asked about) vacuous-skip risk of the byte-identical regression
suite when Postgres is unreachable and no CI config exists to guard it.

## Critical Issues

### CR-01: Existing Playwright regression test now asserts removed behavior — will fail

**File:** `tests/dashboard.spec.ts:204-238` (test: `'LENS switch renders and is functional on /dashboard/categories and /dashboard/categories/[id]'`)
**Issue:**
This test was added in Phase 80 (`c0197c29 test(80-07): add Playwright LENS coverage across all
four dashboard sub-routes`, tightened in `f2b1c654 fix(80): WR-02 tighten lens-persistence e2e to
catch CR-02`) and asserts:
1. A `Competenza` button is visible on `/dashboard/categories` and clicking it sets `?lens=competenza`.
2. Clicking through to a category detail row lands on a URL that **already carries**
   `?lens=competenza`, because `buildDashboardCategoryDetailHref` used to forward the lens threaded
   through `CategoryRankingList`'s `lens` prop (the WR-02/CR-02 regression it was written to catch).

D-12 (this phase) removes `<LensSwitch>` from both Categories pages entirely and removes the `lens`
prop from `CategoryRankingList` (confirmed: `grep -rl LensSwitch app components/dashboard` now
returns only `lens-switch.tsx` and `overview-header.tsx` — no Categories file renders it). That is
the correct, intended D-12 behavior. But `tests/dashboard.spec.ts` was never touched by any of the
six phase commits (`git diff --stat 77ab3dbd..HEAD` does not list it), so:
- `page.getByRole('button', { name: 'Competenza' })` on `/dashboard/categories` will find nothing →
  `toBeVisible()` fails.
- The row-click-through assertion `expect(page).toHaveURL(/\?.*lens=competenza/)` will fail too,
  since `CategoryRankingList` no longer threads `lens` into `buildDashboardCategoryDetailHref`.

This test is excluded from the vitest run (`vitest.config.ts` excludes `**/*.spec.ts`; Playwright
runs it separately via `yarn test:e2e`), which is exactly why "172 files / 2128 tests green" does
not surface it — the regression is real but invisible to the suite this phase's SUMMARYs point to
as proof of health. `82-VALIDATION.md` also filed "no visible lens control anywhere outside
Overview" purely as a **manual-only** verification, so the automated e2e assertion of the opposite
behavior was never reconciled.
**Fix:** Update (not just leave stale) the Phase-80 test to match D-12: remove or rewrite the
`'LENS switch renders and is functional on /dashboard/categories...'` test to assert the switch is
**absent** and that `lens` does **not** survive a Categories row click-through (mirroring what
`tests/lens-switch-placement.test.tsx` already asserts at the component level, but for the real e2e
surface). Example:
```ts
test('LENS switch is absent on /dashboard/categories and /dashboard/categories/[id] (D-12)', async ({ page }) => {
  await openDashboardPath(page, '/dashboard/categories?lens=competenza')
  await expect(page.getByRole('button', { name: 'Competenza' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Cassa' })).toHaveCount(0)
  // Categories reads cassa regardless of the URL's ?lens= value (D-12).
})
```
Run `yarn test:e2e` (or at minimum this one spec against a running dev server) before closing the
phase — it was evidently never run as part of this phase's verification loop.

## Warnings

### WR-01: `getCategoryMonthlyAmounts` has zero test coverage despite being claimed as verified

**File:** `lib/dal/covered-months.ts:72-112`
**Issue:** No test in the repo ever calls `getCategoryMonthlyAmounts` — `grep -rn
getCategoryMonthlyAmounts tests/` only matches two code comments (in
`tests/pace-and-projection.test.ts:30` and `tests/pace-engine-lens-regression.test.ts:98`) stating
it is "not yet built" / fed by hand instead. Yet `82-01-SUMMARY.md`'s coverage table (`id: D3`)
claims: *"getCategoryMonthlyAmounts returns a 12-entry zero-filled series"* is verified by
`tests/pace-and-projection.test.ts#buildCoveredMonthSeries`, which is a pure unit test fed
hand-built `MonthlyValue[]` fixtures and never imports or invokes the actual DAL function. The real
SQL join chain (`ledgerRowSource` → `expense` → `subCategory`, `dateScopedTransactions` filter,
`coalesce(abs(sum(...)), 0)`, and the `monthsBetween` zero-fill) is therefore unverified against a
real database — including whether the join correctly scopes to a single `categoryId` and whether
the zero-fill actually produces exactly 12 entries with the right keys.
**Fix:** Add a real-Postgres test (in `tests/pace-engine-lens-regression.test.ts` or a sibling
file) that seeds two months of transactions for a category plus one month with none, then asserts
`getCategoryMonthlyAmounts(categoryId, year)` returns all 12 months with the uncovered ones at
`'0.00'` — and add a second-user IDOR case analogous to the one already written for
`getCoveredMonthsInYear`.

### WR-02: D-05's exact threshold (2 Covered Months) is untested on either boundary

**File:** `lib/services/pace-and-projection.ts:36-53`; `tests/pace-and-projection.test.ts`;
`tests/pace-engine-lens-regression.test.ts:113-132`
**Issue:** `MIN_COVERED_MONTHS_FOR_PACE = 2` is the load-bearing threshold the review brief itself
flags ("the 2-Covered-Months threshold and one step either side"), but the only two cases actually
exercised anywhere are `coveredMonthCount === 0` (real-Postgres test, `insufficient`) and
`coveredMonthCount === 3` / `12` (`complete`). Nowhere does a test call `computePaceAndProjection`
with exactly **1** entry (must be `insufficient`) or exactly **2** entries (must be `complete`) —
the actual off-by-one boundary the constant exists to enforce is never probed.
**Fix:** Add to the `describe('Comparison sign convention...')`-style block in
`tests/pace-and-projection.test.ts`:
```ts
it('is insufficient at exactly 1 Covered Month, complete at exactly 2 (D-05 boundary)', () => {
  const oneMonth: MonthlyValue[] = [{ yearMonth: '2026-01', amount: '100.00' }]
  const twoMonths: MonthlyValue[] = [...oneMonth, { yearMonth: '2026-02', amount: '100.00' }]

  expect(computePaceAndProjection(oneMonth)).toEqual({ status: 'insufficient', coveredMonthCount: 1 })
  expect(computePaceAndProjection(twoMonths).status).toBe('complete')
})
```

### WR-03: Dead `lens` field left in `lib/routes.ts` href builders, with a now-stale comment

**File:** `lib/routes.ts:33-38, 57-59, 112-138`
**Issue:** `DashboardCategoryFilters.lens` and the `if (filters.lens === 'competenza') { params.set('lens', ...) }`
blocks in both `buildDashboardCategoriesHref` and `buildDashboardCategoryDetailHref` are dead code
after this phase: `grep -rn "buildDashboardCategoriesHref\|buildDashboardCategoryDetailHref" app
components lib` shows every remaining call site (`categories/page.tsx`, `categories/[id]/page.tsx`,
`category-ranking-list.tsx`) no longer passes `lens` at all — the phase's own diff removed that
argument from every caller. The comment directly above the field (`lib/routes.ts:33-36`) still
reads *"the global cash/accrual lens must survive same-tab category navigation... only appended
when non-default ('competenza'), mirroring how DashboardTabNav forwards ?lens="*, which now
directly contradicts D-12 (this phase's own locked decision) and will mislead the next reader into
thinking Categories still respects a lens. D-12's site inventory explicitly called out
`category-ranking-list.tsx`'s `lens` prop as something that "loses its caller and must be cleaned
up with it" — this is the same cleanup, one file downstream, left undone.
**Fix:** Remove the `lens` field from `DashboardCategoryFilters` and the two `if (filters.lens ===
'competenza')` blocks, and delete the stale comment, since D-12 makes it permanently unreachable
on both Categories surfaces.

### WR-04: RETIRE-05's byte-identical regression can pass vacuously with zero assertions run, and nothing in the repo guards against it

**File:** `tests/pace-engine-lens-regression.test.ts:35-43`
**Issue:** `describeIfReachable = harness.ok ? describe : describe.skip` — when
`sparter-postgres`/`sparter_test` is unreachable, the entire "Covered Months engine" describe block
**and** the RETIRE-05 "byte-identical" describe block are skipped with only a `console.warn`. This
pattern is inherited from `tests/amortization-lens-regression.test.ts` (not new to this phase), and
I confirmed the DB was in fact reachable and the suite genuinely ran and passed when I executed it.
But there is no CI workflow in this repository (`.github/workflows` does not exist) and no other
enforcement that Postgres must be up for `vitest run` / `yarn test` to be considered green — `vitest
run` reports `0 failed` whether these tests ran or were silently skipped, and the skip path only
logs a `console.warn` that a reviewer or CI dashboard could easily miss. Since D-15's entire reason
to exist is proving Overview/Tags totals byte-identical **before** any Categories UI phase begins,
a gate that can silently report green with the proof never having executed defeats the phase's
stated purpose in exactly the environment (a fresh CI runner with no Docker) where it matters most.
**Fix:** At minimum, make the skip loud rather than quiet — fail the run (not just warn) when
`CI` is set and the harness is unreachable, e.g. `if (process.env.CI && !harness.ok) { throw new
Error(...) }` in a top-level `beforeAll`, or add a CI step that explicitly runs `yarn db:up` before
`vitest run` so the regression suite can never legitimately skip in the pipeline that gates merges.
This applies equally to the pre-existing `amortization-lens-regression*.test.ts` files, so is worth
fixing once, shared.

## Info

### IN-01: `lens-switch-placement.test.tsx` verifies absence via source-text grep, not a render

**File:** `tests/lens-switch-placement.test.tsx:8-33`
**Issue:** `expect(source).not.toContain('<LensSwitch')` is a string match against the page's raw
TSX text, not an actual component render/RSC check (documented as a deliberate workaround for the
repo's Node-only test environment lacking jsdom, and an established precedent per the file's own
comment). This is acceptable given the constraint, but it is blind to a conditional/aliased
reintroduction (e.g. `import { LensSwitch as LS } from ...` then `<LS ... />`) and to
`resolveLedgerRowSource` being reached indirectly through a helper. It caught the real regression
in this phase correctly (both strings are genuinely absent), so this is informational, not a defect.
**Fix:** No action required now; if a future phase needs stronger guarantees here, prefer the
Playwright e2e coverage (see CR-01) as the authoritative check rather than strengthening the grep.

### IN-02: `82-VALIDATION.md` left in `draft` / `nyquist_compliant: false` with all sign-off boxes unchecked

**File:** `.planning/phases/82-number-engine-and-regression-gate/82-VALIDATION.md:1-126`
**Issue:** The validation contract's frontmatter (`status: draft`, `nyquist_compliant: false`) and
the "Validation Sign-Off" checklist (all boxes unchecked) were never updated to reflect the phase's
actual completed state, even though all three `82-0{1,2,3}-SUMMARY.md` files report the work done
and tests green. This correlates with CR-01: the "Manual-Only Verifications" table treats "no
visible lens control anywhere outside Overview" as manual-only, so nothing in the validation
contract ever routed to the automated Playwright spec that actually encodes this exact assertion.
**Fix:** Update `82-VALIDATION.md`'s frontmatter and sign-off checklist to match the phase's actual
completion, and add `tests/dashboard.spec.ts`'s LENS describe block to the "Existing infrastructure"
list so a future phase touching lens placement knows to check it (this would have caught CR-01
during planning, before implementation).

---

## Review Fix Pass

**Fixed:** 2026-07-30 (follow-up executor pass, no PLAN.md — findings list is the contract)

### CR-01: Categories LENS e2e test asserted removed behavior — FIXED

**Commit:** `09a8b966` fix(82-review): rewrite Categories LENS e2e test to assert D-12 removal (CR-01)

Renamed and inverted `tests/dashboard.spec.ts`'s `'LENS switch renders and is functional on
/dashboard/categories and /dashboard/categories/[id]'` test (not deleted). It now asserts:
- no `Competenza`/`Cassa` button renders on `/dashboard/categories` or its detail page, with or
  without `?lens=competenza` in the URL;
- the rendered figures (category ranking list `innerText`, and the detail page's "Riepilogo
  categoria" region `innerText`) are byte-identical whether the URL carries `?lens=competenza`
  or not — proving Categories reads cassa regardless of the URL (D-12).

**Playwright execution — honesty note:** attempted via `node_modules/.bin/playwright test
tests/dashboard.spec.ts --grep "LENS"` against the local dev server. All 5 tests in the LENS
describe block — including three this fix pass never touched ("LENS switch renders on
/dashboard/overview...", "lens survives tab navigation", "no switch exists on /tags/[id]") —
failed identically with `net::ERR_TOO_MANY_REDIRECTS` on `page.goto`. This is a pre-existing
local environment/session-setup issue (the staging-bypass header alone does not appear
sufficient to reach an authenticated route in this sandbox — a redirect-loop class of problem
already logged separately for this repo), not a regression introduced by this fix pass: it
reproduces identically on untouched tests in the same file. Verified instead by source review
(the edited assertions match the actual rendered markup: `CategoryRankingList`'s
`aria-label="Classifica categorie"` list, `CategoryDetailSummary`'s
`aria-label="Riepilogo categoria"` region, and the confirmed absence of `<LensSwitch>` in both
Categories pages) plus `node_modules/.bin/tsc --noEmit` (clean). **Do not read this test's
presence in the file as proof it has actually run green in CI or against a live server — it has
not, in this environment.**

### WR-02 (pre-existing from PR #64, not from Phase 82): Tags LENS e2e test asserted a stale disabled control — FIXED

**Commit:** `efcb5e0b` fix(82-review): assert total absence of Tags lens control, not disabled state

`tests/dashboard.spec.ts`'s `'LENS switch is disabled with the explanatory note on
/dashboard/tags'` test dated to Phase 80 (`22759672`), which added a disabled Cassa/Competenza
switch on `/dashboard/tags`. PR #64 (`d12bb7ff`) removed that control entirely (`LSD-05`
comment in `app/(app)/dashboard/tags/page.tsx`) but left the test asserting `toBeDisabled()`.
Renamed and rewrote it to assert total absence of both buttons and the explanatory note
(`toHaveCount(0)`), matching what the page actually renders today. Same Playwright execution
caveat as CR-01 above — attempted, `ERR_TOO_MANY_REDIRECTS` in this environment, verified by
source review + `tsc --noEmit` only.

### WR-03: dead `lens` field in `lib/routes.ts` — the review's suggested fix was wrong; implemented forward-without-consume instead — FIXED

**Commit:** `ff4f1859` fix(82-review): forward ?lens= through Categories without consuming it (WR-03)

The review recommended deleting `DashboardCategoryFilters.lens` and its two `if (filters.lens
=== 'competenza')` blocks as dead code. That would have cemented a real defect: D-13 keeps
`?lens=` propagating through the tab nav so `Overview(competenza) → Categories → back` lands in
competenza, but Plan 82-02 had already removed `parseLensParam` from both Categories pages —
so the three intra-Categories hrefs (sort toggle, row click-through, detail back link) had
stopped forwarding `lens`. Deleting the field would have made that permanent instead of fixing
it.

Implemented forward-without-consume instead:
- Added `LensPassthrough` (a branded `string` type distinct from `Lens`) and
  `extractLensPassthrough()` (raw, unvalidated, never defaults to `'cassa'`) to
  `lib/utils/search-params.ts`.
- `DashboardCategoryFilters.lens` is now typed `LensPassthrough`, not `Lens` — it cannot be
  handed to `resolveLedgerRowSource` (which only accepts a validated `Lens`) without an explicit
  cast, so the misuse D-12 forbids is a type error, not a review convention. Rewrote the stale
  `lib/routes.ts:33-36` comment to describe D-12+D-13 accurately.
- Both Categories pages (`app/(app)/dashboard/categories/page.tsx`,
  `app/(app)/dashboard/categories/[id]/page.tsx`) now read the raw `lens` searchParam and thread
  it into the sort toggle, row click-through (via `CategoryRankingList`'s new `lens` prop), and
  detail back link hrefs — without calling `resolveLedgerRowSource` or passing a
  `ledgerRowSource`/`lens` argument to `getCategoryRanking`/`getCategoryDetail` (both still fall
  through to the `ledgerEntryCash` default, D-12 unchanged).
- Added unit coverage in `tests/dashboard-filters.test.ts` proving `?lens=competenza` survives
  all three hrefs while being omitted entirely when absent from the URL.
- `tests/lens-switch-placement.test.tsx`'s existing source-grep assertions (no `<LensSwitch>`,
  no `resolveLedgerRowSource(` in either Categories page) still pass unchanged, confirming the
  aggregation side of the invariant.

### WR-01: `getCategoryMonthlyAmounts` had zero test coverage; `82-01-SUMMARY.md` falsely claimed it was verified — FIXED

**Commit:** `61bacd85` fix(82-review): add real-Postgres coverage for getCategoryMonthlyAmounts (WR-01)

Added a real-Postgres test in `tests/pace-engine-lens-regression.test.ts`
(`getCategoryMonthlyAmounts — real Postgres (WR-01 review fix, PACE-01 D-02, T-82-01)`) covering:
- **D-02 zero-fill:** a Covered Month (February) with no movement in the target category returns
  `'0.00'` and is present in the 12-entry series, never dropped.
- **T-82-01 user scoping:** querying a second user's `categoryId` under the first user's session
  returns an all-zero 12-entry series, never the second user's real `-999.00` amount — proving
  the `userId` filter inside `dateScopedTransactions` gates every row, not merely the
  `categoryId` join.

Corrected `82-01-SUMMARY.md`'s D3 verification entry, which previously claimed
`getCategoryMonthlyAmounts`'s 12-entry zero-filled series was verified by
`tests/pace-and-projection.test.ts#buildCoveredMonthSeries` — that test is a pure unit test fed
hand-built `MonthlyValue[]` fixtures and never imports or calls the DAL function. The entry now
states plainly that the function was untested from this plan's original commit until this
review fix pass, and cites the new integration test.

### WR-02 (D-05 boundary): `MIN_COVERED_MONTHS_FOR_PACE = 2` boundary untested — FIXED

**Commit:** `eb5824c9` fix(82-review): test MIN_COVERED_MONTHS_FOR_PACE at exactly 1 and 2 (WR-02)

Added two tests to `tests/pace-and-projection.test.ts` (`Pace availability boundary (PACE-03,
D-05: MIN_COVERED_MONTHS_FOR_PACE = 2)`): exactly 1 Covered Month returns `{ status:
'insufficient', coveredMonthCount: 1 }`, exactly 2 returns `'complete'` with `pace` = `'150.00'`
on a `{100.00, 200.00}` fixture. Only 0 and 3/12 were exercised anywhere before this fix.

### WR-04 and IN-01/IN-02 — not addressed in this pass

Out of scope for this fix pass: the findings list provided as the contract for this pass covers
CR-01, the pre-existing Tags test staleness, WR-01, WR-02, and WR-03 only. WR-04 (loud-skip-in-CI
for the `describeIfReachable` harness pattern) and IN-01/IN-02 (grep-based placement test, and
`82-VALIDATION.md` sign-off state) remain open for a future pass.

### Verification after this pass

- `node_modules/.bin/vitest run` — 172 files, 2135 tests passed + 1 todo (2128 → 2135, +7 tests
  added across WR-01/WR-02/WR-03; file count unchanged, no new test files).
- `node_modules/.bin/tsc --noEmit` — clean.
- `yarn build` — clean (pre-existing `unpdf`/`import.meta` compile warning, unrelated).
- `yarn check:language` — clean.
- `yarn test:e2e` (Playwright, `tests/dashboard.spec.ts --grep "LENS"`) — attempted, could not
  complete in this environment (`ERR_TOO_MANY_REDIRECTS` on every test in the LENS block,
  including three untouched by this pass) — see the CR-01/WR-02(tags) notes above. Not executed
  successfully; verified by source review + `tsc --noEmit` instead.
- No existing assertion was weakened. The RETIRE-05 baseline
  (`tests/pace-engine-lens-regression.test.ts`'s "Overview and Tags totals — byte-identical
  regression" describe block) was not modified and its hand-computed expected values are
  unchanged.

---

_Reviewed: 2026-07-30T16:02:39Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
_Review fix pass: 2026-07-30, executor (no PLAN.md; findings list was the contract)_
