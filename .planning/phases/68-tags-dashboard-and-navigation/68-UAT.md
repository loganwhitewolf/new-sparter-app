---
status: testing
phase: 68-tags-dashboard-and-navigation
source: [68-VERIFICATION.md]
started: 2026-07-21T00:00:00Z
updated: 2026-07-21T00:00:00Z
---

## Current Test

number: 1
name: Tag-section caption with a very wide date range fits on one line
expected: |
  On `/dashboard/tags`, a tag whose transactions span several years shows a caption
  like "142 movimenti · 01/01/2020–31/12/2026" that fits on ONE line without visually
  wrapping or overflowing the card, at both mobile (~375px) and desktop widths.
steps: |
  1. Create or seed a tag and assign it transactions whose dates span multiple years
     (e.g. 2020 through 2026) so the caption's date range is as wide as realistic.
  2. Open `/dashboard/tags` and locate that tag's card.
  3. View at a narrow mobile viewport (~375px) and at desktop width.
why_human: |
  Purely visual/rendering assertion. The caption `<p>` (`components/dashboard/tag-ranking-list.tsx:87`,
  `text-xs text-muted-foreground`) carries NO `line-clamp`/`truncate` class (unlike the card title,
  which has `truncate`+`title=`). Whether it stays on one line depends on real font metrics and
  content width, which static code inspection / grep cannot confirm. Flagged by the plan itself as
  `verification: backstop`.
disposition_if_fails: |
  If the caption wraps/overflows at a common width, add `truncate` + a `title={captionText}` attribute
  to the caption element (mirroring the title's existing treatment) — a one-line component fix.

## Gaps

_None beyond the single visual item above. All automated must-haves (36/37) verified; full suite
(1723 tests) green; `check:language` clean._
