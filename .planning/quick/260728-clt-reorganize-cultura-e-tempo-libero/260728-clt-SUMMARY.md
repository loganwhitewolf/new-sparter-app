---
id: 260728-clt
description: Reorganize the "cultura e tempo libero" taxonomy (option A)
status: complete
date: 2026-07-28
branch: gsd/taxonomy-leisure
commits:
  - 8332efa feat(taxonomy) seed-data rename + insert
  - 36ce511 feat(taxonomy) seed-extras step
  - ce9d575 docs(context) arbitration rules
---

# Quick Task 260728-clt — Summary

## What shipped

Category 22 `cultura e tempo libero` keeps its single-category shape and gains one
subcategory; no SQL migration was needed (seed data only).

- `scripts/seed-data.ts` — `cinema ed eventi` / `cinema-ed-eventi` renamed to
  `spettacoli` / `spettacoli`; `attività ricreative` / `attivita-ricreative` added
  (categoryId 22, natureId 4).
- `tests/fixtures/v2-taxonomy-manifest.ts` — contract fixture kept in sync. It is not only a
  test fixture: `buildNatureSlugMap` in seed-extras reads it, so a missing entry would have
  left the new subcategory outside the nature-assignment step.
- `scripts/seed-extras.ts` — step `reorganize-leisure-subcategories`, appended last. Renames
  via the existing `renameSubcategoryGuarded` (id preserved → no expense moves) and inserts
  the new subcategory with the nature resolved by code, following `insertCartoleriaOggettistica`.
- `tests/seed-extras-steps.test.ts` — the `vacanze-audit` LAST assertion relaxed to a
  relative-order one, exactly as Phase 67 did to the assertion before it.
- `CONTEXT.md` — category listing updated plus the two arbitration rules.

## Correction made mid-task

The task was planned on the belief that `vacanze > attivita-e-intrattenimento` was the
natural home for occasional recreation. Reading `seed-extras.ts` showed Phase 67 (TAG-06,
D-11/D-12/D-13) had already deactivated it, together with `cibo-e-bevande`, to keep `vacanze`
to intrinsically-travel spend only, with trip context carried by Tags.

The arbitration rule written into CONTEXT.md is therefore the inverse of the one originally
sketched: trip context does NOT outrank the object of the expense. Skating on holiday is
`cultura e tempo libero > attivita-ricreative` plus the trip Tag.

`CONTEXT.md`'s **Vacanze** line still listed both deactivated subcategories — stale since
Phase 67. Corrected in the same commit, because leaving it would have put a direct
contradiction four lines above the new rule.

## Historical migration entries left untouched

`OUT_MERGE_PAIRS` (538-539) and `SUB_RENAMES` (647-648) map the pre-v2 `cinema` / `eventi`
slugs onto `cinema-ed-eventi`. They record migrations that already ran; rewriting them would
change what past executions claim to have done. The new step runs after them, so a legacy
database still holding `cinema` converges: step 9 folds it into `cinema-ed-eventi`, the new
step renames that to `spettacoli`.

## Verification

- `node_modules/.bin/vitest run` — 149 files, 1836 passed, 1 todo
- `node_modules/.bin/tsc --noEmit` — clean
- `yarn check:language` — passed

The worktree has no `node_modules` of its own; it is symlinked to the main checkout's.
Remove the symlink before deleting the worktree.

## Not done (deliberate)

No categorization patterns were added or changed, so `attivita-ricreative` has no Tier-1
regex and is hand-assign only. `seed-patterns-data.ts:126` still routes `pattinaggio` to
`sport-e-fitness`, which is defensible under the recurrence rule but will misfile occasional
outings. Rerouting a live pattern changes auto-categorization of existing transactions and
was outside the agreed scope — flagged for a follow-up, ideally alongside regex-discovery
for bowling / minigolf / escape room / parchi, which have no pattern at all today.

## Deploy note

This ships seed data, not a migration. After merge: `yarn db:seed` then
`yarn db:seed-extras`. No `db:migrate` needed for this change.
