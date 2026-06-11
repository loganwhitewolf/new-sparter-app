---
phase: 47-taxonomy-seed-rework
verified: 2026-06-11T12:42:00Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
deferred:
  - truth: "Running yarn db:seed + yarn db:seed-extras on a fresh schema produces every subcategory with nature_id"
    addressed_in: "Phase 48"
    evidence: "47-VALIDATION.md Manual-Only table — seed-extras on live v1 DB deferred to Phase 48 dry-run after migrate (D-05); Plan 47-05 success_criteria explicitly 'Phase 47 complete without DB apply'"
---

# Phase 47: taxonomy-seed-rework Verification Report

**Phase Goal:** The seeded taxonomy reflects the final remap from `nature-remapping-WORKING.md` — 23 categories, ~65 subcategories across all 4 directions — and the additive seed machinery is in place so existing deployed rows can be brought up to date without overwriting shipped seed shapes.

**Verified:** 2026-06-11T12:42:00Z  
**Status:** passed  
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `seed-data.ts` exports 23 active categories matching working-doc direction split (4 IN / 16 OUT / 2 ALLOCATION / 1 TRANSFER) | ✓ VERIFIED | `V2_CATEGORY_SLUGS` has 23 slugs; `tests/seed-taxonomy.test.ts` `has 23 active system categories` + `active category slugs match v2 manifest` GREEN |
| 2 | Subcategories match v2 manifest with `natureId` 1–8 on every row | ✓ VERIFIED | 87 subcategories in `seed-data.ts` (87 `categoryId`/`natureId` rows); manifest `V2_SUBCATEGORY_MANIFEST` has 87 entries; tests `every system subcategory has natureId 1-8` + `subcategory slugs and nature codes match manifest` GREEN |
| 3 | Dissolved wrapper categories absent; pruned subcategory slugs inactive | ✓ VERIFIED | `DISSOLVED_CATEGORY_SLUGS` (abbonamenti, assicurazioni, famiglia, …) and `DROPPED_SUBCATEGORY_SLUGS` asserted absent from active sets — tests GREEN |
| 4 | Nature renames applied (`financial`→`investment`, `extraordinary`→`savings`); no `operational` nature in seed | ✓ VERIFIED | `natures` table seed uses codes `savings`/`investment` with comments referencing renames; grep shows no active `operational`/`financial`/`extraordinary` nature codes in taxonomy rows |
| 5 | `categorizationPatterns` sign-agnostic, retargeted to v2 subcategory slugs | ✓ VERIFIED | No `amountSign`/`AmountSign` in `seed-data.ts`; patterns use v2 slugs (e.g. `spesa-quotidiana`); `seed.ts` inserts patterns without amount_sign and throws on missing slugs |
| 6 | `seed.ts` passes `natureId` through subcategory insert; TRANSFER slugs get `excludeFromTotals` | ✓ VERIFIED | `seed.ts:91` cast insert with `natureId`; `seed.ts:94-103` updates `trasferimento-tra-conti`, `addebito-carta-di-credito`, `contante` |
| 7 | `seed-extras.ts` step 1 is no-op (D-06); STEPS 6–12 append v2 insert/migrate/rename/deactivate/backfill | ✓ VERIFIED | `setSubcategoryNature` logs no-op only; `STEPS` registry lines 909–921 includes `v2-insert-*` through `v2-backfill-override-nature-id`; `tests/seed-extras-steps.test.ts` GREEN |
| 8 | `v2-backfill-nature-id` resolves nature by `nature.code`; override backfill step exists | ✓ VERIFIED | `v2BackfillNatureId` uses `UPDATE … nature_id = (SELECT id FROM nature WHERE code = …)`; `v2BackfillOverrideNatureId` copies from linked system sub |
| 9 | R-FN-03 nature assignment tests enabled and GREEN | ✓ VERIFIED | `tests/category-settings-seed.ts` `describe('seed nature assignment (R-FN-03)')` — 4 tests pass (essential, discretionary, transfer `natureId === 6`) |
| 10 | Phase gate: full test suite + build pass | ✓ VERIFIED | `yarn test` → 949 passed; `yarn build` exit 0 (executed 2026-06-11) |

**Score:** 10/10 truths verified (1 roadmap runtime criterion deferred to Phase 48 — see Deferred Items)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | End-to-end `yarn db:seed` + `yarn db:seed-extras` produces fully populated `nature_id` on all rows | Phase 48 | ROADMAP Phase 48 SC2: "Every existing sub_category row has a non-null nature_id FK after the migration"; `47-VALIDATION.md` Manual-Only: "Phase 48 dry-run after migrate"; Plan 47-05: "complete without DB apply" |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `scripts/seed-data.ts` | v2 categories + subCategories + natureId baseline | ✓ VERIFIED | 23 categories, 87 subcategories, 8 natures with `directionId`; sign-agnostic patterns |
| `scripts/seed-extras.ts` | STEPS 6+ v2 deployed-DB transforms + step 1 no-op | ✓ VERIFIED | 12 STEPS; `v2-backfill-nature-id` + `v2-backfill-override-nature-id` present |
| `scripts/seed.ts` | natureId pass-through + v2 excludeFromTotals | ✓ VERIFIED | Insert cast + transfer slug update; pattern missing-slug guard |
| `tests/seed-taxonomy.test.ts` | TAX-01/02 static contract gate | ✓ VERIFIED | 6 tests GREEN |
| `tests/fixtures/v2-taxonomy-manifest.ts` | Explicit slug manifest from working doc | ✓ VERIFIED | `V2_CATEGORY_SLUGS`, `V2_SUBCATEGORY_MANIFEST`, dissolved/dropped lists |
| `tests/seed-extras-steps.test.ts` | STEPS registry smoke test | ✓ VERIFIED | 2 tests GREEN; deactivate before backfill ordering |
| `tests/category-settings-seed.ts` | R-FN-03 nature assertions | ✓ VERIFIED | 4 tests GREEN |
| `.planning/phases/47-taxonomy-seed-rework/47-VALIDATION.md` | Nyquist sign-off | ✓ VERIFIED | `nyquist_compliant: true` in frontmatter |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `seed-data.ts subCategories[].natureId` | `seed-data.ts natures[].id` | explicit integer FK 1–8 | ✓ WIRED | Contract test maps via `NATURE_BY_ID` |
| `seed.ts subCategory insert` | `seed-data subCategories[].natureId` | inferInsert cast | ✓ WIRED | Line 91 passes full subcategory shape |
| `seed.ts categorizationPattern insert` | `seed-data categorizationPatterns[].subCategorySlug` | slug→id map + throw on missing | ✓ WIRED | Lines 132–154 |
| `v2-backfill-nature-id step` | `nature.code lookup` | parameterized SQL UPDATE | ✓ WIRED | `v2BackfillNatureId` + `NATURE_SLUG_MAP` from manifest |
| `v2-backfill-override-nature-id` | `sub_category.nature_id` | JOIN on system sub | ✓ WIRED | SQL UPDATE in step 12 |
| `category-settings-seed R-FN-03` | `seed-data subCategories[].natureId` | import + `NATURE_BY_ID` | ✓ WIRED | Tests import seed-data directly |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `tests/seed-taxonomy.test.ts` | `categories`, `subCategories`, `natures` | `import from '../scripts/seed-data'` | 23/87/8 row literals | ✓ FLOWING |
| `seed.ts` subcategory insert | `subCategories` | `seed-data.ts` export | natureId on each row | ✓ FLOWING |
| `seed-extras v2BackfillNatureId` | slug→natureCode map | `V2_SUBCATEGORY_MANIFEST` via `buildNatureSlugMap()` | Real slug lists per nature code | ✓ FLOWING (static map; DB execution deferred Phase 48) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Taxonomy contract tests | `yarn test tests/seed-taxonomy.test.ts tests/seed-extras-steps.test.ts` | 8 passed | ✓ PASS |
| R-FN-03 nature tests | `yarn test tests/category-settings-seed.ts -t "seed nature assignment"` | 4 passed | ✓ PASS |
| Phase gate | `yarn test && yarn build` | 949 passed; build OK | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no `probe-*.sh` declared in phase plans; not a migration/tooling probe phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| TAX-01 | 47-01, 47-02, 47-03, 47-05 | Seeded taxonomy matches working-doc remap with natureId | ✓ SATISFIED | Manifest + contract tests GREEN; 23 cats / 87 subs |
| TAX-02 | 47-02, 47-03, 47-04 | Dissolutions/renames/wrapper distribution per working doc | ✓ SATISFIED | Dissolved/dropped slug tests GREEN; STEPS 6–10 migrate/rename/deactivate authored |
| TAX-03 | 47-04, 47-05 | `seed-data.ts` v2 baseline + `seed-extras.ts` additive `nature_id` steps; no edits to shipped baseline shapes | ✓ SATISFIED | Baseline wholesale replace in seed-data (fresh installs); legacy transforms in STEPS 6–12 only; DB apply explicitly Phase 48 per REQUIREMENTS.md note |

All three requirement IDs declared in phase plans are accounted for. No orphaned Phase 47 requirement IDs in `REQUIREMENTS.md`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `scripts/seed-extras.ts` | 39, 317, 349, 364 | `TODO(Phase 49):` on legacy steps 3–5 | ℹ️ Info | Formal follow-up reference `#Phase 49`; legacy steps unchanged by design |
| `scripts/seed-data.ts` | 900 | comment "placeholder" for ISO country | ℹ️ Info | Domain comment, not stub implementation |

No unreferenced `TBD`/`FIXME`/`XXX` debt markers in phase-modified files.

### Human Verification Required

None for Phase 47 closure scope. Runtime seed-extras verification on a live v1 database is explicitly scheduled for Phase 48 (`47-VALIDATION.md` Manual-Only table).

### Gaps Summary

No blockers. Phase 47 deliverables — v2 `seed-data.ts` baseline, sign-agnostic patterns, and additive `seed-extras.ts` STEPS 6–12 — are implemented and covered by static contract tests plus the full CI gate (949 tests + build). The ROADMAP success criterion requiring a live `db:seed` + `db:seed-extras` run is intentionally deferred to Phase 48 per D-05; static evidence confirms the machinery is authored and wired.

**Note on subcategory count:** ROADMAP/working-doc summary cites "~65" subcategories; the authoritative manifest (`V2_SUBCATEGORY_MANIFEST`) and `seed-data.ts` contain **87** active subcategories matching the line-by-line working-doc remap. `REQUIREMENTS.md` TAX-01 note aligns with 87. Not treated as a gap.

---

_Verified: 2026-06-11T12:42:00Z_  
_Verifier: Claude (gsd-verifier)_
