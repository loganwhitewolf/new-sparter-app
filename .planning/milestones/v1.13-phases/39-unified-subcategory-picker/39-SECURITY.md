---
phase: 39
slug: unified-subcategory-picker
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-02
---

# Phase 39 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| picker→Server Action (commit) | tapped subCategoryId crosses into categorizeExpense / bulkCategorize / onboardingCategorizeExpense | subCategoryId (integer, user-visible only) |
| picker→form field (fill-field) | tapped subCategoryId fills hidden form input; submitted later via existing create/update actions | subCategoryId (integer) |
| pattern forms→createPatternAction / updatePatternAction / promoteSuggestionAction | regex + subCategoryId cross server boundary; amountSign and confidence are NOT client-supplied | regex string, subCategoryId |
| client→DAL (getMostUsedSubcategories) | userId sourced from server session only, never client input | userId (server-scoped), allowedTypes filter |
| deletion surface (CategoryCombobox + prototype route) | code removal only; no new runtime trust boundary introduced | n/a |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-39-01 | Information disclosure | getMostUsedSubcategories | mitigate | `verifySession()` called in DAL; `eq(expense.userId, userId)` scopes every row | closed |
| T-39-02 | Spoofing | allowedTypes filter | mitigate | `inArray(category.type, allowedTypes)` enforced server-side in `subcategory-usage.ts`; joined with existing category visibility | closed |
| T-39-03 | Tampering | onChange subCategoryId | accept | Picker is presentation only; existing Server Actions validate subCategoryId via `isSubCategoryVisibleToUser` / Zod | closed |
| T-39-04 | Information disclosure | categories/mostUsed props | mitigate | `getCategories` + `getMostUsedSubcategories` both call `verifySession`; picker renders only server-supplied data | closed |
| T-39-05 | Tampering | committed subCategoryId (commit-on-tap) | accept | Existing `categorizeExpense` / `bulkCategorize` / `onboardingCategorizeExpense` Server Actions validate ownership server-side | closed |
| T-39-06 | Elevation of privilege | bulk expense ids list | accept | `bulkCategorize` scopes expense ids to session user; client passes same `JSON.stringify(selectedIds)` as before | closed |
| T-39-07 | Tampering | hidden subCategoryId form input | accept | `createExpense` / `updateExpense` / `createTransaction` validate subCategoryId server-side (Zod + visibility); picker adds no new trust boundary | closed |
| T-39-08 | Spoofing | edit pre-fill from expense.subCategoryId | accept | Pre-fill reads expense already scoped to session user by page-level DAL; no client-supplied id trusted on server | closed |
| T-39-09 | Tampering | client-supplied amountSign/confidence | mitigate | `amountSign` and `confidence` no longer read from FormData in any of the three pattern actions; derived server-side via `deriveAmountSign(categoryType)` and hardcoded to `confidence=1` (ADR 0008) | closed |
| T-39-10 | Elevation of privilege | subCategoryId for pattern (create/update) | mitigate | `getCategoryTypeForSubCategory` scopes join to user-visible rows (null-or-user for both tables); returns `null` for unowned → action errors out | closed |
| T-39-11 | Information disclosure | amountSign matching across signs | accept | `amountSignMatches` in `lib/services/categorization.ts` is unchanged; no change to selection precedence | closed |
| T-39-12 | Denial of service | deleting in-use component (CategoryCombobox) | mitigate | Pre-deletion grep confirmed zero live imports before removal; `yarn build` backstop passes (exit 0) | closed |
| T-39-13 | Information disclosure | prototype route exposed in production | mitigate | `app/(app)/prototype/subcategory-picker/` deleted from codebase; route absent from compiled build manifest | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

No accepted risks that require separate documentation — all `accept` dispositions are standard boundary clarifications where existing server-side controls are sufficient and unchanged.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-02 | 13 | 13 | 0 | gsd-secure-phase / Claude |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-02
