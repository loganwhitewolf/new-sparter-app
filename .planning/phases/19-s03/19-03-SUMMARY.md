---
phase: "19"
plan: "03"
---

# T03: Added a DB-backed Playwright acceptance flow for `/settings/categories` covering category CRUD, personal system-subcategory overrides, linked-expense delete blocking, safe deletion, and pattern assignment.

**Added a DB-backed Playwright acceptance flow for `/settings/categories` covering category CRUD, personal system-subcategory overrides, linked-expense delete blocking, safe deletion, and pattern assignment.**

## What Happened

Created `tests/category-settings-seed.ts` to prepare isolated staging-user data when `DATABASE_URL` and `STAGING_KEY` are available. The helper upserts the staging user, finds an existing active system subcategory for the override scenario without mutating global taxonomy, creates linked and unlinked user-owned rows, inserts one linked expense for the guarded delete path, hard-cleans its own prefixed rows, and synchronizes stale Postgres serial sequences before inserting test rows. Added `tests/categories-settings.spec.ts` with one high-signal browser flow from `/settings/categories`: it creates a category and subcategory, renames both user-owned rows, renames a system subcategory via a per-user override, attempts to delete a linked subcategory and asserts the Italian count-bearing error, deletes an unlinked subcategory, creates a custom pattern from the embedded panel, and asserts the resulting destination label. During verification, fixed Playwright selector assumptions for card titles and addressed a stale DB serial-sequence failure exposed by the first run.

## Verification

Targeted Vitest, Playwright, lint, and language checks passed with concrete command evidence. The Playwright proof ran against the real `/settings/categories` route using the staging-key auth bypass and exercised the full S03 demo flow.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest run tests/category-actions.test.ts tests/category-settings-ui.test.tsx tests/pattern-actions.test.ts tests/categories-dal.test.ts` | 0 | ✅ pass | 1144ms |
| 2 | `yarn playwright test tests/categories-settings.spec.ts --reporter=list` | 0 | ✅ pass | 12248ms |
| 3 | `yarn lint` | 0 | ✅ pass | 4103ms |
| 4 | `yarn check:language` | 0 | ✅ pass | 682ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `tests/category-settings-seed.ts`
- `tests/categories-settings.spec.ts`
