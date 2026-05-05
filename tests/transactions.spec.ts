// Transaction E2E tests
// Data-dependent acceptance checks are marked fixme — run against staging with seeded DB.
// Runnable smoke checks verify route rendering, safe query handling, and app-shell discoverability.
// Run: npx playwright test tests/transactions.spec.ts

import { expect, test, type Page } from '@playwright/test'

const hasStagingBypass = Boolean(process.env.STAGING_KEY)

async function openTransactions(page: Page, path = '/transazioni') {
  if (process.env.STAGING_KEY) {
    await page.setExtraHTTPHeaders({
      'x-staging-key': process.env.STAGING_KEY,
    })
  }

  await page.goto(path)
}

async function expectTransactionsShell(page: Page) {
  await expect(page.getByRole('heading', { name: 'Transazioni' })).toBeVisible()

  const emptyState = page.getByText('Nessuna transazione trovata')
  const transactionTable = page.getByRole('table', {
    name: /Elenco transazioni importate/i,
  })

  await expect(emptyState.or(transactionTable).first()).toBeVisible()
  await expect(page.getByLabel('Data da')).toBeVisible()
  await expect(page.getByLabel('Data a')).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Piattaforma' })).toBeVisible()
  await expect(
    page.getByRole('combobox', { name: 'Ordina transazioni' }),
  ).toBeVisible()
}

test.describe('Transactions - TX-01: Route smoke', () => {
  test('unauthenticated transactions route redirects to login when no staging bypass is configured', async ({ page }) => {
    test.skip(hasStagingBypass, 'Authenticated route smoke covers this when STAGING_KEY is configured')

    const response = await page.goto('/transazioni')

    expect(response?.url()).toContain('/login')
    await expect(page.getByRole('heading', { name: /accedi/i })).toBeVisible()
  })

  test('renders the transactions route with filters and empty-or-table state', async ({ page }) => {
    test.skip(!hasStagingBypass, 'Requires STAGING_KEY auth bypass or PLAYWRIGHT_BASE_URL pointing to an authenticated staging session')

    await openTransactions(page)

    await expectTransactionsShell(page)
  })

  test('invalid query params render safe defaults instead of a server error', async ({ page }) => {
    test.skip(!hasStagingBypass, 'Requires STAGING_KEY auth bypass or PLAYWRIGHT_BASE_URL pointing to an authenticated staging session')

    await openTransactions(page, '/transazioni?sort=rawRow&dir=sideways&from=bad')

    await expectTransactionsShell(page)
    await expect(page.getByLabel('Data da')).toHaveValue('')
    await expect(
      page.getByRole('button', { name: 'Imposta ordinamento crescente' }),
    ).toBeVisible()
  })
})

test.describe('Transactions - TX-02: App shell navigation', () => {
  test('desktop sidebar exposes a link to transactions', async ({ page }) => {
    test.skip(!hasStagingBypass, 'Requires STAGING_KEY auth bypass to reach the protected app shell')

    await openTransactions(page, '/dashboard')

    await page.getByRole('link', { name: 'Transazioni' }).click()

    await expect(page).toHaveURL(/\/transazioni$/)
    await expect(page.getByRole('heading', { name: 'Transazioni' })).toBeVisible()
  })

  test('mobile bottom nav exposes a link to transactions', async ({ page }) => {
    test.skip(!hasStagingBypass, 'Requires STAGING_KEY auth bypass to reach the protected app shell')

    await page.setViewportSize({ width: 375, height: 812 })
    await openTransactions(page, '/dashboard')

    await page.getByRole('link', { name: 'Transazioni' }).click()

    await expect(page).toHaveURL(/\/transazioni$/)
    await expect(page.getByRole('heading', { name: 'Transazioni' })).toBeVisible()
  })
})

test.describe('Transactions - TX-03: Filter acceptance', () => {
  test('date, platform, and sort controls persist in the URL and refresh rows', async ({ page }) => {
    test.fixme(
      true,
      'Requires seeded imported transactions and at least one platform — run with PLAYWRIGHT_BASE_URL pointing to staging. Acceptance flow: navigate /transazioni, apply Data da/Data a and Piattaforma filters, change Ordina transazioni, verify URL params change and visible rows update.',
    )

    await openTransactions(page)
    await page.getByLabel('Data da').fill('2024-01-01')
    await expect(page).toHaveURL(/from=2024-01-01/)
    await page.getByRole('combobox', { name: 'Piattaforma' }).click()
    await page.getByRole('option').nth(1).click()
    await expect(page).toHaveURL(/platform=/)
    await page.getByRole('combobox', { name: 'Ordina transazioni' }).click()
    await page.getByRole('option', { name: 'Importo' }).click()
    await expect(page).toHaveURL(/sort=amount/)
  })
})
