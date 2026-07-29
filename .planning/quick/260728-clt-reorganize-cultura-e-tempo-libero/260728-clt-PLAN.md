---
id: 260728-clt
description: Reorganize the "cultura e tempo libero" taxonomy (option A)
status: planned
date: 2026-07-28
---

# Quick Task 260728-clt: reorganize "cultura e tempo libero"

## Decision

Option A, chosen 2026-07-28 after reviewing the three-category ADR proposal.

The proposal (split into `Cultura e intrattenimento` / `Abbonamenti e contenuti digitali` /
`Attività ricreative`) was rejected on two grounds:

1. `CONTEXT.md:141` closes the OUT-category list with `_Avoid_: abbonamenti come categoria`,
   and `CONTEXT.md:106` records that the recurring/subscription insight is an orthogonal cut
   (flag/view), not a taxonomy axis. `Abbonamenti e contenuti digitali` is precisely the
   wrapper category that was already dissolved.
2. `Cinema` / `Teatro` / `Concerti` / `Mostre` are third-level granularity promoted to the
   second level. Sparter has two levels only, so each of those costs a permanent row in every
   report while sharing one nature (`discretionary`) — no new analytical cut, only noise.

The trigger case ("an hour of ice skating while on holiday") initially looked like it already
had a home under `vacanze > attivita-e-intrattenimento`. It does not: Phase 67 (TAG-06,
D-11/D-12/D-13) deactivated that subcategory along with `cibo-e-bevande`, deliberately
narrowing `vacanze` to intrinsically-travel spend and moving trip context onto Tags. So the
gap is real — Phase 67 removed a home without creating its replacement — and what was also
missing is the written arbitration rule saying context does not outrank the object.

## Scope

Category 22 stays a single category. No new categories, no SQL migration (seed data only).

1. `scripts/seed-data.ts` — rename `cinema ed eventi` / `cinema-ed-eventi` to
   `spettacoli` / `spettacoli`; add `attività ricreative` / `attivita-ricreative`
   (categoryId 22, natureId 4). seed-data always reflects the current canonical state
   (cf. `carburante-e-ricarica`), while seed-extras migrates already-seeded databases.
2. `tests/fixtures/v2-taxonomy-manifest.ts` — keep the contract fixture in sync: rename the
   entry, add the new slug. The manifest also feeds `buildNatureSlugMap` in seed-extras, so a
   missing entry would leave the new subcategory outside the nature-assignment step.
3. `scripts/seed-extras.ts` — append step `reorganize-leisure-subcategories`: rename
   `cinema-ed-eventi` → `spettacoli` via `renameSubcategoryGuarded`, then idempotently insert
   `attivita-ricreative`. Historical entries at lines 538-539 and 647-648 (`cinema`/`eventi` →
   `cinema-ed-eventi`) are NOT touched: they are already-executed migration history and
   rewriting them would change what past runs claim to have done. Since the new step runs
   after step 9, a legacy database still holding `cinema` converges correctly.
4. `CONTEXT.md` — update the category listing and record the two arbitration rules.

## Out of scope

- No `Abbonamenti e contenuti digitali` category (see Decision).
- No change to `vacanze`. Dissolving it into an event tag is the target direction but belongs
  to the tag phase, not here.
- No new categorization patterns. `attivita-ricreative` therefore has no Tier-1 regex and is
  hand-assign only for now. Note that `seed-patterns-data.ts:126` currently routes
  `pattinaggio` to `sport-e-fitness`, which contradicts the new recreational/sporting rule —
  left as-is because rerouting a live pattern changes auto-categorization of existing
  transactions and was not part of the agreed scope.

## Tasks

1. seed-data + manifest fixture (rename + insert)
2. seed-extras migration step
3. CONTEXT.md arbitration rules

## Verification

- `node_modules/.bin/vitest run tests/seed-taxonomy.test.ts tests/seed-extras-steps.test.ts`
- `node_modules/.bin/tsc --noEmit`
- `yarn check:language`
