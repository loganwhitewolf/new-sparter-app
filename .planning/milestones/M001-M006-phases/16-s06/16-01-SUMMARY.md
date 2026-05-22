---
phase: "16"
plan: "01"
---

# T01: Added IMP-04, IMP-05, IMP-06 Playwright test groups covering delete dialog availability, configure page error state, and importId transaction filter — all three pass locally

**Added IMP-04, IMP-05, IMP-06 Playwright test groups covering delete dialog availability, configure page error state, and importId transaction filter — all three pass locally**

## What Happened

Read the full `tests/import.spec.ts` to understand the existing helper patterns (`openImportPage`, `expectNoSecretDiagnostics`, staging header injection). Also read the referenced input files to confirm exact UI text and component structure:

- `import-row-actions.tsx` confirms delete buttons render only for `status === 'imported'` rows (aria-label: "Elimina importazione {displayName}") and are absent when no imported rows exist.
- `configure/page.tsx` confirms the error branch renders heading "Configura formato importazione", card heading "Formato non configurabile", and a back link "Torna agli import" pointing to `/import`.
- `transactions/page.tsx` confirms the heading is "Transazioni" (not a regex-only Italian variant).

Appended three `test.describe` blocks before the IMP-02 group:

**IMP-04:** Navigates to `/import`, asserts table/empty-state/error-state is visible (matching existing IMP-01/IMP-03 pattern). If the table is visible, asserts delete buttons are accessible for imported rows; if empty state is visible, asserts zero delete buttons are present. Ends with `expectNoSecretDiagnostics`.

**IMP-05:** Navigates to `/import/00000000-0000-4000-8000-000000000099/configure` with staging header. Asserts the page heading "Configura formato importazione" is visible, the error card heading "Formato non configurabile" is visible, the `[role="alert"]` error alert is visible, and the back link has `href="/import"`. Ends with `expectNoSecretDiagnostics`.

**IMP-06:** Navigates to `/transactions?importId=00000000-0000-4000-8000-000000000099` with staging header. Asserts the "Transazioni" heading is visible, a table or empty-state text is visible, no 500/error page text leaked, and `expectNoSecretDiagnostics` passes.

All five existing IMP-02 `test.fixme` tests remain unchanged. Full run: 12 passed, 5 skipped.

## Verification

Ran `npx playwright test tests/import.spec.ts --reporter=list`. IMP-04 ✅, IMP-05 ✅, IMP-06 ✅ all pass. All pre-existing IMP-01/IMP-03 tests still pass. IMP-02 fixme group remains as 5 skipped. Total: 12 passed, 5 skipped in 9.7s.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx playwright test tests/import.spec.ts --reporter=list 2>&1 | grep -E '(passed|failed|fixme|IMP-04|IMP-05|IMP-06)'` | 0 | ✅ pass — IMP-04, IMP-05, IMP-06 all reported as passed | 9700ms |
| 2 | `npx playwright test tests/import.spec.ts --reporter=list 2>&1 | tail -5` | 0 | ✅ pass — 12 passed, 5 skipped, no failures | 9700ms |

## Deviations

IMP-04 description mentioned asserting 'delete action column is absent' but the delete button is per-row (not a column header), so the assertion checks `getByRole('button', { name: /elimina importazione/i }).toHaveCount(0)` instead — semantically equivalent and more accurate to the actual DOM structure.

## Known Issues

None.

## Files Created/Modified

- `tests/import.spec.ts`
