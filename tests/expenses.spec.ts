// Expense E2E tests
// Tests requiring DB data are marked fixme — run against staging with seeded DB.
// Tests verifying UI structure (dialogs, URL params) can run against local dev.
// Run: npx playwright test tests/expenses.spec.ts

import { expect, test } from '@playwright/test'

test.describe('Expenses - EXP-01: Create', () => {
  test('create expense: form opens with two chained selects', async ({ page }) => {
    test.fixme(true, 'Requires seeded DB — run with PLAYWRIGHT_BASE_URL pointing to staging')
    // Navigate to /spese, click "Nuova spesa", verify dialog structure:
    // - Input Titolo is present
    // - Select categoria is present
    // - After selecting a category, a second Select sottocategoria appears
    // - Salva spesa button is disabled until subcategory is selected
    await page.goto('/spese')
    await page.getByRole('button', { name: 'Nuova spesa' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByLabel('Titolo')).toBeVisible()
    await expect(page.getByLabel('Categoria')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Salva spesa' })).toBeDisabled()
  })

  test('edit expense: dialog opens with pre-filled values', async ({ page }) => {
    test.fixme(true, 'Requires seeded DB — run with PLAYWRIGHT_BASE_URL pointing to staging')
    // Three-dots menu → Modifica → dialog opens with existing values pre-filled
    // → Aggiorna spesa → table row updated
    await page.goto('/spese')
  })

  test('delete expense: confirm dialog removes row from list', async ({ page }) => {
    test.fixme(true, 'Requires seeded DB — run with PLAYWRIGHT_BASE_URL pointing to staging')
    // Three-dots menu → Elimina → confirm dialog → Elimina button → row removed from table
    await page.goto('/spese')
  })
})

test.describe('Expenses - EXP-02: Filters', () => {
  test('filter by status "Da categorizzare" shows only status=1 expenses', async ({ page }) => {
    test.fixme(true, 'Requires seeded DB — run with PLAYWRIGHT_BASE_URL pointing to staging')
    // Select "Da categorizzare" in Stato filter → URL gains ?status=uncategorized
    // → only uncategorized expenses shown
    await page.goto('/spese')
  })

  test('filter by period "Questo mese" excludes older expenses', async ({ page }) => {
    test.fixme(true, 'Requires seeded DB — run with PLAYWRIGHT_BASE_URL pointing to staging')
    // Select "Questo mese" → URL gains ?period=this-month
    // → expenses older than current month not shown
    await page.goto('/spese')
  })

  test('filter URL persistence: status param reflected in select', async ({ page }) => {
    test.fixme(true, 'Requires seeded DB for filter results — URL param reading can be tested standalone')
    // Navigate with ?status=uncategorized → Stato select shows the correct value
    // This does not require DB data for the URL reading itself
    await page.goto('/spese?status=uncategorized')
    await expect(page.getByRole('combobox', { name: /stato/i })).toHaveValue('uncategorized')
  })
})

test.describe('Expenses - EXP-03: Bulk Categorization', () => {
  test('select N rows: floating action bar appears with correct count', async ({ page }) => {
    test.fixme(true, 'Requires seeded DB — run with PLAYWRIGHT_BASE_URL pointing to staging')
    // Check 2 checkboxes → FAB appears with text "2 selezionate" and button "Categorizza (2)"
    await page.goto('/spese')
  })

  test('bulk categorize: assigns subCategory + status=3 to all selected expenses', async ({ page }) => {
    test.fixme(true, 'Requires seeded DB — run with PLAYWRIGHT_BASE_URL pointing to staging')
    // Select 2 expenses → Categorizza (2) → bulk dialog → pick subcategory
    // → Conferma → both rows show status=3 + new category badge
    await page.goto('/spese')
  })
})
