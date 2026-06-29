---
phase: 60-seed-slug-linkage-and-docs
verified: 2026-06-29T15:00:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification: null
gaps: []
deferred: []
behavior_unverified_items: []
human_verification: []
---

# Phase 60: Seed Slug Linkage and Docs Verification Report

**Phase Goal:** Seeded import formats link to their Platform by slug (not by hardcoded id), removing the Trade Republic id-8 collision that made `onConflictDoNothing` silently skip the TR seed; and the stale DescriptionStripPattern documentation/comments are corrected to reflect ADR 0013.

**Verified:** 2026-06-29T15:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All 8 seeded platform entries carry no explicit `id:` — serial assigns, conflict keyed on unique `slug` | ✓ VERIFIED | `awk '/^export const platforms/,/^export const importFormatVersions/' scripts/seed-data.ts \| grep '^\s*id:'` returns 0 matches. Lines 896–939 confirm 8 entries with only `{ name, slug, country }`. |
| 2 | All 8 seeded import format version entries carry `platformSlug: 'slug'` (not `platformId: N`) | ✓ VERIFIED | `grep -c 'platformSlug' scripts/seed-data.ts` returns 8. Lines 950–1093 confirm all 8 entries: general, crypto-com, satispay, intesa-sp, intesa-sp-carta-credito, revolut, fineco, trade-republic. |
| 3 | `seed.ts` queries platform table post-insert and resolves slug→integer id at runtime; insert guarded by `resolvedFormats.length > 0` | ✓ VERIFIED | Line 106: `const allPlatformRows = await db.select({ id: platform.id, slug: platform.slug }).from(platform)`. Line 107: `const slugToId = new Map(...)`. Lines 110–142: `flatMap` resolves each `fv.platformSlug`. Lines 144–146: guard `if (resolvedFormats.length > 0)` before insert. Missing slug emits `{ event: 'seed_warning', ... }` and skips (line 113–119). |
| 4 | CONTEXT.md DescriptionStripPattern glossary entry attributes the field to `import_format_version` (not `platform`) | ✓ VERIFIED | `grep -q 'configurata per Import Format' CONTEXT.md` exits 0. Line 34 reads: "Regex nullable configurata per Import Format (campo `description_strip_pattern` su `import_format_version`, ADR 0013)." No residual "configurata per Platform" found. |
| 5 | Code comments in `regex-discovery.ts` and `pattern-application.ts` attribute `descriptionStripPattern` to import format version | ✓ VERIFIED | `grep -q 'import format version' lib/services/regex-discovery.ts` exits 0. Line 34 (JSDoc): "Applies the import format version descriptionStripPattern (`import_format_version.description_strip_pattern`, ADR 0013)". Line 87 (step-3 inline): "import format version value: `import_format_version.description_strip_pattern`". `grep -q 'import format version' lib/services/pattern-application.ts` exits 0. Line 170: "Mirror the discovery pipeline (CR-02): apply import format version descriptionStripPattern before normalizing". |

**Score: 5/5 truths verified (0 present, behavior-unverified)**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/seed-data.ts` — platforms array: no `id:` field | 8 entries `{ name, slug, country }` | ✓ VERIFIED | Confirmed via direct read (lines 896–939) and awk/grep checks |
| `scripts/seed-data.ts` — importFormatVersions array: `platformSlug` string field | 8 entries with `platformSlug: 'slug'` | ✓ VERIFIED | `grep -c 'platformSlug'` = 8 |
| `scripts/seed.ts` — slug-to-id resolution via DB query | `slugToId` map + `resolvedFormats` flatMap + length guard | ✓ VERIFIED | `grep -c 'resolvedFormats\|slugToId'` = 6 occurrences across the file |
| `CONTEXT.md` — DescriptionStripPattern entry updated | First sentence references `import_format_version` and ADR 0013 | ✓ VERIFIED | Line 34 confirmed |
| `lib/services/regex-discovery.ts` — two comments updated | JSDoc `applyStrip` + step-3 inline | ✓ VERIFIED | Lines 34 and 87 confirmed |
| `lib/services/pattern-application.ts` — one comment updated | CR-02 filter comment | ✓ VERIFIED | Line 170 confirmed |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scripts/seed-data.ts` `importFormatVersions` `platformSlug` | `scripts/seed.ts` `slugToId.get(fv.platformSlug)` | Runtime DB query builds `Map<slug, id>`, `flatMap` resolves each entry | ✓ WIRED | Lines 106–142 of seed.ts |
| `seed.ts` resolved `platformId` | `importFormatVersion` Drizzle insert | `db.insert(importFormatVersion).values(resolvedFormats).onConflictDoNothing()` guarded by length check | ✓ WIRED | Lines 144–146 of seed.ts |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 36 import tests (import-detector + import-hash-contract) pass after slug-based linkage | `npx vitest run tests/import-detector.test.ts tests/import-hash-contract.test.ts` | PASS (36) FAIL (0) | ✓ PASS |
| No TypeScript errors in phase-60 files (`seed-data.ts`, `seed.ts`, `import-detector.test.ts`, `import-hash-contract.test.ts`) | `npx tsc --noEmit 2>&1 \| grep -E "import-detector\|import-hash\|seed\.ts\|seed-data"` | 0 matches | ✓ PASS |

**Note on TypeScript errors:** `npx tsc --noEmit` reports 26 pre-existing errors in `tests/cascade-options.test.ts`, `tests/category-combobox.test.tsx`, `tests/overview-interactions.test.tsx`, `tests/suggestion-card.test.tsx`, `tests/suggestion-promote-form.test.tsx`, and `tests/transactions-dal.test.ts`. None of these files were modified by Phase 60; they are pre-existing failures unrelated to this phase.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PLAT-05 | 60-01-PLAN.md | Seeded format versions link to platform by slug at runtime, not hardcoded integer id | ✓ SATISFIED | Slug-to-id resolution present in seed.ts; `platformSlug` on all 8 format version entries in seed-data.ts; `platforms` array has no `id:` field |
| PLAT-06 | 60-02-PLAN.md | DescriptionStripPattern developer docs corrected to reflect import_format_version ownership (ADR 0013) | ✓ SATISFIED | CONTEXT.md first sentence updated; two comments in regex-discovery.ts updated; one comment in pattern-application.ts updated |

---

### Anti-Patterns Found

No anti-patterns found in the files modified by this phase.

- No `TBD`, `FIXME`, or `XXX` markers in `scripts/seed-data.ts`, `scripts/seed.ts`, `CONTEXT.md`, `lib/services/regex-discovery.ts`, or `lib/services/pattern-application.ts`.
- No stub implementations (all format version entries carry real parsing-contract data, not placeholders).
- No empty handlers or hardcoded-empty return values in the modified code paths.

---

### Human Verification Required

None. All success criteria are verifiable programmatically.

---

## Gaps Summary

No gaps. All 5 must-have truths are VERIFIED against the codebase. The phase goal is achieved:

1. The `platforms` array in `seed-data.ts` carries no `id:` field on any of its 8 entries.
2. The `importFormatVersions` array carries `platformSlug: 'slug'` on all 8 entries.
3. `seed.ts` builds a `Map<slug, number>` from a fresh `SELECT` after the platform insert, resolves each format version via `flatMap`, logs a warning and skips on missing slugs, and guards the insert with a `resolvedFormats.length > 0` check.
4. `CONTEXT.md` DescriptionStripPattern entry now reads "Regex nullable configurata per Import Format (campo `description_strip_pattern` su `import_format_version`, ADR 0013)."
5. Both `lib/services/regex-discovery.ts` (JSDoc + step-3 inline) and `lib/services/pattern-application.ts` (CR-02 comment) attribute `descriptionStripPattern` to import format version.

The Trade Republic id-8 collision is closed: platform conflict is keyed on `slug`, the serial assigns freely, and the format version insert derives its FK from the actual post-insert state of the database.

---

_Verified: 2026-06-29T15:00:00Z_
_Verifier: Claude (gsd-verifier)_
