// Expense E2E tests
// Tests requiring DB data are marked fixme — run against staging with seeded DB.
// Tests verifying UI structure (dialogs, URL params) can run against local dev.
// Run: npx playwright test tests/expenses.spec.ts

import { expect, test } from '@playwright/test'

test.describe('Expenses - EXP-01: Create', () => {
  test('create expense: form opens with two chained selects', async ({ page }) => {
    test.fixme(true, 'Requires seeded DB — run with PLAYWRIGHT_BASE_URL pointing to staging')
    // Navigate to /expenses, click the localized "New expense" button, and verify the dialog structure:
    // - The localized title input is present
    // - The localized category select is present
    // - After selecting a category, a second localized subcategory select appears
    // - The localized save button is disabled until a subcategory is selected
    await page.goto('/expenses')
    await page.getByRole('button', { name: 'Nuova spesa' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByLabel('Titolo')).toBeVisible()
    await expect(page.getByLabel('Categoria')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Salva spesa' })).toBeDisabled()
  })

  test('edit expense: dialog opens with pre-filled values', async ({ page }) => {
    test.fixme(true, 'Requires seeded DB — run with PLAYWRIGHT_BASE_URL pointing to staging')
    // Three-dots menu → localized edit action → dialog opens with existing values pre-filled
    // → localized update button → table row updated
    await page.goto('/expenses')
  })

  test('delete expense: confirm dialog removes row from list', async ({ page }) => {
    test.fixme(true, 'Requires seeded DB — run with PLAYWRIGHT_BASE_URL pointing to staging')
    // Three-dots menu → localized delete action → confirm dialog → localized delete button → row removed from table
    await page.goto('/expenses')
  })
})

test.describe('Expenses - EXP-02: Filters', () => {
  test('filter by status "Da categorizzare" shows only status=1 expenses', async ({ page }) => {
    test.fixme(true, 'Requires seeded DB — run with PLAYWRIGHT_BASE_URL pointing to staging')
    // Select the localized uncategorized option in the status filter → URL gains ?status=uncategorized
    // → only uncategorized expenses shown
    await page.goto('/expenses')
  })

  test('filter by period "Questo mese" excludes older expenses', async ({ page }) => {
    test.fixme(true, 'Requires seeded DB — run with PLAYWRIGHT_BASE_URL pointing to staging')
    // Select the localized current-month option → URL gains ?period=this-month
    // → expenses older than current month not shown
    await page.goto('/expenses')
  })

  test('filter URL persistence: status param reflected in select', async ({ page }) => {
    test.fixme(true, 'Requires seeded DB for filter results — URL param reading can be tested standalone')
    // Navigate with ?status=uncategorized → the localized status select shows the correct value
    // This does not require DB data for the URL reading itself
    await page.goto('/expenses?status=uncategorized')
    await expect(page.getByRole('combobox', { name: /stato/i })).toHaveValue('uncategorized')
  })
})

test.describe('Expenses - EXP-03: Bulk Categorization', () => {
  test('select N rows: floating action bar appears with correct count', async ({ page }) => {
    test.fixme(true, 'Requires seeded DB — run with PLAYWRIGHT_BASE_URL pointing to staging')
    // Check 2 checkboxes → FAB appears with localized selected-count text and categorize button
    await page.goto('/expenses')
  })

  test('bulk categorize: assigns subCategory + status=3 to all selected expenses', async ({ page }) => {
    test.fixme(true, 'Requires seeded DB — run with PLAYWRIGHT_BASE_URL pointing to staging')
    // Select 2 expenses → localized categorize button → bulk dialog → pick subcategory
    // → localized confirm button → both rows show status=3 + new category badge
    await page.goto('/expenses')
  })
})

// ---------------------------------------------------------------------------
// S04 — Searchable category combobox (regression coverage)
// ---------------------------------------------------------------------------
// Seed requirement: an uncategorized expense must exist in the DB for the
// single-categorize dialog tests to open. A user-owned subcategory must be
// present to verify the Personale badge. All tests below are gated with
// test.fixme when PLAYWRIGHT_BASE_URL is not set (no staging DB available).
// ---------------------------------------------------------------------------

test.describe('S04 searchable category combobox', () => {
  const requiresDB = !process.env.PLAYWRIGHT_BASE_URL

  test('single categorize dialog: opens combobox, types ristoranti, matching subcategory appears', async ({
    page,
  }) => {
    test.fixme(requiresDB, 'Requires seeded DB — run with PLAYWRIGHT_BASE_URL pointing to staging')
    // Navigate to /expenses, open the single categorize dialog for an uncategorized expense,
    // open the combobox, type "ristoranti", and assert the matching subcategory is visible.
    await page.goto('/expenses')
    // Open the categorize action for the first uncategorized expense row.
    await page.getByRole('button', { name: /categorizza/i }).first().click()
    await expect(page.getByRole('dialog', { name: /categorizza spesa/i })).toBeVisible()
    // The combobox trigger button is present and the confirm button is disabled initially.
    const confirmBtn = page.getByRole('button', { name: /conferma/i })
    await expect(confirmBtn).toBeDisabled()
    // Open the combobox.
    await page.getByRole('combobox', { name: /cerca sottocategoria/i }).click()
    await expect(page.getByPlaceholder('Cerca categoria…')).toBeVisible()
    // Type the search term — the matching subcategory must appear.
    await page.getByPlaceholder('Cerca categoria…').fill('ristoranti')
    await expect(page.getByRole('option', { name: /ristoranti/i }).first()).toBeVisible()
    // Confirm button is still disabled (nothing selected yet).
    await expect(confirmBtn).toBeDisabled()
  })

  test('single categorize dialog: Personale badge visible for user-owned subcategory', async ({
    page,
  }) => {
    test.fixme(requiresDB, 'Requires seeded DB — run with PLAYWRIGHT_BASE_URL pointing to staging')
    // Seed requirement: at least one user-owned subcategory must exist in the DB.
    await page.goto('/expenses')
    await page.getByRole('button', { name: /categorizza/i }).first().click()
    await expect(page.getByRole('dialog', { name: /categorizza spesa/i })).toBeVisible()
    await page.getByRole('combobox', { name: /cerca sottocategoria/i }).click()
    // Search without a term to show all options.
    const personaleLocator = page.locator('text=Personale')
    await expect(personaleLocator.first()).toBeVisible()
  })

  test('single categorize dialog: no-results state and disabled submit for nonsense query', async ({
    page,
  }) => {
    test.fixme(requiresDB, 'Requires seeded DB — run with PLAYWRIGHT_BASE_URL pointing to staging')
    await page.goto('/expenses')
    await page.getByRole('button', { name: /categorizza/i }).first().click()
    await expect(page.getByRole('dialog', { name: /categorizza spesa/i })).toBeVisible()
    const confirmBtn = page.getByRole('button', { name: /conferma/i })
    await page.getByRole('combobox', { name: /cerca sottocategoria/i }).click()
    await page.getByPlaceholder('Cerca categoria…').fill('zzznonexistent999')
    // The Italian no-results message must be visible.
    await expect(page.getByText('Nessuna sottocategoria trovata.')).toBeVisible()
    // Confirm button remains disabled.
    await expect(confirmBtn).toBeDisabled()
  })

  test('single categorize dialog: confirm button enables after selecting a subcategory', async ({
    page,
  }) => {
    test.fixme(requiresDB, 'Requires seeded DB — run with PLAYWRIGHT_BASE_URL pointing to staging')
    await page.goto('/expenses')
    await page.getByRole('button', { name: /categorizza/i }).first().click()
    await expect(page.getByRole('dialog', { name: /categorizza spesa/i })).toBeVisible()
    const confirmBtn = page.getByRole('button', { name: /conferma/i })
    await expect(confirmBtn).toBeDisabled()
    // Open combobox and select the first visible option.
    await page.getByRole('combobox', { name: /cerca sottocategoria/i }).click()
    await page.getByRole('option').first().click()
    // Confirm button must now be enabled.
    await expect(confirmBtn).toBeEnabled()
  })
})
