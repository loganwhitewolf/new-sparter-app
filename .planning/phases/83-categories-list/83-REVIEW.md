---
phase: 83-categories-list
reviewed: 2026-08-03T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - components/dashboard/category-ranking-list.tsx
  - tests/category-ranking-list.test.tsx
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 83: Code Review Report (re-review after 83-06 gap closure)

**Reviewed:** 2026-08-03
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found (no Critical findings; the CR-01 (NEW) blocker is closed)

## Prior Review

This review **overwrites** the previous full-phase `83-REVIEW.md`, which is preserved verbatim in
git commit `ad2382a4`. That review's Critical finding, **CR-01 (NEW)** — an allocation-direction
row producing a `?type=allocation` detail URL the detail page coerces to `?type=out`, landing on a
€0 page with a back link to the wrong list — is the gap plan `83-06` (commit `3edab68f`) was
written to close. This review judges only whether that fix is correct; it does not re-litigate
83-01..83-05, which were already reviewed and adjudicated (that review's `WR-01` sort-toggle
desync finding and its carried-forward `IN-01`/`IN-02`/`IN-03` items are untouched by this diff and
out of this review's scope per the task's `known_non_issues`).

## Summary

The fix in `components/dashboard/category-ranking-list.tsx` guards the allocation-direction row's
name element: instead of an unconditional `<Link href={buildDashboardCategoryDetailHref(...)}>`,
the component now branches on `direction` and renders a non-interactive `<span aria-disabled="true">`
for `allocation`, computing no href at all for that branch. This closes CR-01 (NEW) **by
construction**: `buildDashboardCategoryDetailHref` has exactly one production call site in the
whole codebase (confirmed via `grep -rn`), and it now sits only inside the non-allocation JSX
branch. No `?type=allocation` URL can be produced by this component under any prop combination.
`out` and `in` rows are byte-identical to pre-fix behavior (same `href` expression, same classes,
same `aria-label`, same `title`). The new test correctly proves all three directions in one place,
including the "no `<a>` at all" assertion the locked decision required verbatim, and it is not
trivially passing: `CategorySparkline` (also rendered in the row) contains no anchor of its own, so
the assertion genuinely depends on the guard, not on an accident of unrelated markup.

Two non-blocking issues remain: the accessibility affordance for the disabled row is thin (no
explanation of *why* it's inert, and `aria-disabled` on a bare `<span>` with no ARIA role is of
questionable value to assistive technology), and the D-13/CLIST-07 rationale comment that used to
document *why* the href threads the same year was deleted rather than preserved/relocated. Two
Info-level test-quality notes round out the findings.

## Warnings

### WR-01: `aria-disabled="true"` on a role-less `<span>` communicates little to assistive technology, and the row's lost link affordance is unexplained

**File:** `components/dashboard/category-ranking-list.tsx:99-106`
**Issue:** `aria-disabled` is a supported state on interactive widget roles (`button`, `link`,
`menuitem`, etc.), where it is meaningful because the element *would otherwise* be operable. A
`<span>` carries the implicit ARIA role `generic`, which has no operable semantics — in practice,
NVDA/VoiceOver/JAWS commonly render this element to a screen-reader user exactly like plain text,
with no signal that it used to be (or elsewhere still is) a clickable row. Sighted keyboard users
lose the previous `aria-label` (`"{name}: apri dettaglio categoria"`) entirely, and no `title` or
visible copy on the row explains that Accantonamenti's detail view isn't available yet — a user
tabbing/scanning the list has no way to learn *why* this row behaves differently from the
Uscite/Entrate rows above and below it in the same list, only that it silently doesn't respond.
This is exactly the tension the review brief asked to be honest about: `aria-disabled` is defined
for elements that *can* be disabled, and a plain `<span>` isn't one of them.
**Fix:** Either (a) give the span `role="link"` so `aria-disabled` sits on a role that actually
supports it and is consistently announced, or (b) add a visually-hidden explanation reachable by
AT, e.g.:
```tsx
<span
  className="block truncate text-base font-semibold text-foreground"
  aria-disabled="true"
  title={category.name}
>
  {category.name}
  <span className="sr-only"> — dettaglio non disponibile per Accantonamenti</span>
</span>
```
This is a UX/a11y quality gap, not a functional regression — the guard itself is correct and the
row is provably non-interactive either way (no `<a>`, no `role="link"` today, no `tabIndex`).

### WR-02: The D-13/CLIST-07 year-coherence rationale comment was deleted, not relocated

**File:** `components/dashboard/category-ranking-list.tsx:96-98` (removed content: former lines
78-81 pre-fix)
**Issue:** The pre-fix code carried this comment directly above the (now-deleted) unconditional
`href` const:
```
// D-13/CLIST-07: the row's link carries the SAME year the row's own total was computed
// from — the coherence test "clicking a row must not change the numbers" holds by
// construction.
```
This documented *why* `year` (and not some other value) is threaded into
`buildDashboardCategoryDetailHref`'s `{ year, type: direction, lens }` call — a locked design
decision (D-13) whose rationale is not otherwise obvious from the call site alone. The 83-06 diff
replaces it with a comment about the CR-01 (NEW) guard only; the D-13 rationale is now
undocumented anywhere in this file. A future edit to the `out`/`in` branch's href (e.g. during the
Phase 84 detail-page rewrite, when this component may be revisited again) has no in-file
explanation of why `year` must match the row's own computed total — only that a broken link class
was once fixed here.
**Fix:** Restore the D-13/CLIST-07 comment above the `Link`'s inline `href=` expression in the
non-allocation branch (lines 108-109), in addition to — not instead of — the new CR-01 comment:
```tsx
// D-13/CLIST-07: the row's link carries the SAME year the row's own total was computed from —
// the coherence test "clicking a row must not change the numbers" holds by construction.
<Link
  href={buildDashboardCategoryDetailHref(category.id, { year, type: direction, lens })}
  ...
```

## Info

### IN-03: D-04's five row fields are not all asserted together for the `allocation` direction in the new guard test

**File:** `tests/category-ranking-list.test.tsx:102-116`
**Issue:** The new CR-01 (NEW) guard test's `allocation` block asserts name, `Totale`, the
sparkline's `aria-label`, and `aria-disabled="true"`, but does not assert the share-percentage
label or the projection value/label for the allocation row — two of D-04's five required fields.
Coverage of those two fields under `direction="allocation"` currently comes only incidentally from
the unrelated `'resolves the percentage bar colour per direction'` test (line 161), which asserts
the bar-colour class, not the share text or projection text. Since the percentage-bar and
projection JSX blocks are unconditional and direction-agnostic (untouched by this fix), the actual
regression risk is low, but the guard test's own contract (83-06-PLAN.md's stated intent: "keeps
all five D-04 fields") isn't literally exercised in one place.
**Fix:** Add two more assertions to the `allocationHtml` block, e.g.
`expect(allocationHtml).toContain('A questo passo')` and an assertion on the interpolated share
label text, so the "all five D-04 fields" claim is verified directly rather than by inference from
a different test.

### IN-04: `toContain('<a')` / `not.toContain('<a')` is a substring match, not a tag-boundary match

**File:** `tests/category-ranking-list.test.tsx:87-88, 99-100, 111`
**Issue:** These assertions check for the raw two-character substring `<a`, which would also match
the opening of any future tag beginning with `a` (e.g. `<abbr>`, `<audio>`, `<article>`) introduced
anywhere in the row's markup — not necessarily an anchor. Today no such tag exists in this
component or in `CategorySparkline` (verified by grep), so the assertion is currently sound, but it
is fragile against unrelated future markup changes elsewhere in the row. This exact phrasing was
explicitly requested by 83-VERIFICATION.md's locked decision ("an allocation row must emit no `<a>`
element"), so this is not a defect introduced by the executor — it's a pre-existing test-contract
choice worth flagging if the row's markup grows.
**Fix (optional, low priority):** Use a tag-boundary-safe pattern instead, e.g.
`expect(allocationHtml).not.toMatch(/<a[\s>]/)` and `expect(outHtml).toMatch(/<a[\s>]/)`, which
only matches an actual `<a ...>` or `<a>` open tag.

---

_Reviewed: 2026-08-03T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
