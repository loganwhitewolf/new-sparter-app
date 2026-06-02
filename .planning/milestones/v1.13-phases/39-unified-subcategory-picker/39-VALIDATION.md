---
phase: 39
slug: unified-subcategory-picker
status: complete
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-02
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for the unified-subcategory-picker phase.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `yarn vitest run tests/subcategory-options.test.ts tests/subcategory-usage-dal.test.ts tests/patterns-amount-sign.test.ts tests/subcategory-picker.test.tsx tests/subcategory-picker-deletion.test.ts` |
| **Full suite command** | `yarn vitest run` |
| **Estimated runtime** | ~500ms (phase tests only) |

---

## Sampling Rate

- **After every task commit:** Run quick run command above
- **After every plan wave:** Run full suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 39-01-01 | 01 | 1 | R-UP-04 | T-39-01, T-39-02 | getMostUsedSubcategories scoped to session.userId; no client userId arg | unit | `yarn vitest run tests/subcategory-usage-dal.test.ts` | ✅ | ✅ green |
| 39-01-02 | 01 | 1 | R-UP-04 | — | buildCategoryOptions/filterCategoryOptions with categoryType | unit | `yarn vitest run tests/subcategory-options.test.ts` | ✅ | ✅ green |
| 39-02-01 | 02 | 2 | R-UP-01 | T-39-03, T-39-04 | SubcategoryPicker renders SheetTitle "Categorizza"; onChange fires on tile tap | unit | `yarn vitest run tests/subcategory-picker.test.tsx` | ✅ | ✅ green |
| 39-02-02 | 02 | 2 | R-UP-02 | — | TYPE_FILTERS: Tutte/Entrate/Uscite/Trasferimenti only; no Sistema chip | unit | `yarn vitest run tests/subcategory-picker.test.tsx` | ✅ | ✅ green |
| 39-02-03 | 02 | 2 | R-UP-03 | — | Two-column grid sm:grid-cols-[190px_1fr] in master-detail markup | unit | `yarn vitest run tests/subcategory-picker.test.tsx` | ✅ | ✅ green |
| 39-02-04 | 02 | 2 | R-UP-08 | — | SheetContent has h-[80vh] and sm:h-[600px] fixed-height classes | unit | `yarn vitest run tests/subcategory-picker.test.tsx` | ✅ | ✅ green |
| 39-03-01 | 03 | 3 | R-UP-06 | T-39-05, T-39-06 | SubcategoryCombobox rebuilt; no FlowNature badges per D-05 | unit | `yarn vitest run tests/subcategory-combobox.test.tsx` | ✅ | ✅ green |
| 39-05-01 | 05 | 3 | R-UP-07 | T-39-09, T-39-10 | deriveAmountSign maps out/in/transfer/system correctly | unit | `yarn vitest run tests/patterns-amount-sign.test.ts` | ✅ | ✅ green |
| 39-05-02 | 05 | 3 | R-UP-07 | T-39-10 | getCategoryTypeForSubCategory returns null for invisible subcategory | unit | `yarn vitest run tests/patterns-amount-sign.test.ts` | ✅ | ✅ green |
| 39-05-03 | 05 | 3 | R-UP-07 | T-39-09 | SuggestionPromoteForm has no name="amountSign" input (server-derived) | unit | `yarn vitest run tests/suggestion-promote-form.test.tsx` | ✅ | ✅ green |
| 39-05-04 | 05 | 3 | R-UP-07 | — | SuggestionPromoteForm renders hidden pattern + subCategoryId; no cascading Categoria label | unit | `yarn vitest run tests/suggestion-promote-form.test.tsx` | ✅ | ✅ green |
| 39-06-01 | 06 | 5 | R-UP-09 | T-39-12 | category-combobox.tsx deleted; no live CategoryCombobox imports | smoke | `yarn vitest run tests/subcategory-picker-deletion.test.ts` | ✅ | ✅ green |

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. No Wave 0 stubs needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Commit-on-tap: single expense categorize (expense-categorize-dialog) commits immediately on picker tap | R-UP-06 | Server Action commit via useTransition; requires real DB + auth session | Open an uncategorized expense on /expenses, tap category button, select a subcategory in the picker, verify it commits without a separate submit button |
| Commit-on-tap: bulk categorize commits all selected expenses on single tap | R-UP-06 | Same; requires multiple selected expenses | Select 3 uncategorized expenses, open bulk categorize, tap a subcategory, verify all 3 are categorized |
| Fill-field: expense create/edit form fills subCategoryId without submitting | R-UP-05 | Form lifecycle test requires browser interaction | Open expense form, tap "Categorizza", select subcategory, verify label updates and form is not submitted; then submit and verify expense created |
| Fill-field: transaction create form fills subCategoryId without submitting | R-UP-05 | Same | Open transaction form, same flow |
| Mobile drill-in: left rail hides when rail item active; back button returns to rail | R-UP-03 | Requires mobile viewport rendering | On narrow viewport, tap a category in the rail, verify left column hides; tap back arrow, verify rail is visible again |
| Pattern create/edit form derives amountSign server-side from chosen subcategory | R-UP-07 | Server action behavior with real DB | Create a pattern with an 'out' subcategory, verify the stored pattern has amountSign='negative' |
| yarn check:language passes | R-UP-10 | Language gate | `yarn check:language` exits 0 (confirmed in 39-06 SUMMARY) |
| yarn build exits 0 | R-UP-10 | Build gate | `yarn build` exits 0 (confirmed in 39-06 SUMMARY) |

---

## Validation Audit 2026-06-02

| Metric | Count |
|--------|-------|
| Gaps found (FAILING) | 4 |
| Gaps found (MISSING) | 7 |
| Resolved (automated) | 4 failing fixed + 3 new test files |
| Escalated to manual-only | 8 (R-UP-05 fill-field forms, R-UP-06 commit-on-tap integration, R-UP-03 mobile, R-UP-07 server-side derivation E2E, R-UP-10 build/language) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are in Manual-Only
- [x] No 3 consecutive tasks without automated verify
- [x] No Wave 0 stubs needed (existing infrastructure)
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-02
